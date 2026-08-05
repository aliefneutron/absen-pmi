import { format, parse, addMinutes, isBefore, isAfter, subMinutes } from 'date-fns';

export interface Shift {
  name: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  toleranceMinutes?: number; // Toleransi keterlambatan dalam menit (default: 30)
}

export const DEFAULT_SHIFTS: Shift[] = [
  { name: 'Pagi', startTime: '07:00', endTime: '14:00', toleranceMinutes: 30 },
  { name: 'Sore', startTime: '14:00', endTime: '21:00', toleranceMinutes: 30 },
  { name: 'Malam', startTime: '21:00', endTime: '07:00', toleranceMinutes: 30 },
];

export function getCurrentShift(now: Date, shiftSettings?: Shift[], assignedShiftName?: string) {
  let shifts = shiftSettings && shiftSettings.length > 0 ? shiftSettings : DEFAULT_SHIFTS;
  
  if (assignedShiftName) {
    if (assignedShiftName === 'OFF') return { isOff: true };
    const matchedShift = shifts.find(s => s.name === assignedShiftName);
    if (!matchedShift) return null;
    
    const start = matchedShift.startTime.trim();
    const end = matchedShift.endTime.trim();
    const isCrossMidnight = start > end;
    
    let shiftStartDate = parse(start, 'HH:mm', now);
    shiftStartDate.setSeconds(0);
    shiftStartDate.setMilliseconds(0);
    
    let shiftEndDate = parse(end, 'HH:mm', now);
    shiftEndDate.setSeconds(59);
    shiftEndDate.setMilliseconds(999);
    
    if (isCrossMidnight) {
      shiftEndDate = addMinutes(shiftEndDate, 1440);
    }
    
    // Check window for today (30m buffer before start to 30m after end)
    const windowStart = subMinutes(shiftStartDate, 30);
    const windowEnd = addMinutes(shiftEndDate, 30);
    
    if (isCrossMidnight) {
      const prevStartDate = subMinutes(shiftStartDate, 1440);
      const prevEndDate = subMinutes(shiftEndDate, 1440);
      const prevWindowStart = subMinutes(prevStartDate, 30);
      const prevWindowEnd = addMinutes(prevEndDate, 30);
      
      if (now >= prevWindowStart && now <= prevWindowEnd) {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        return {
          shift: matchedShift,
          logicalDate: format(yesterday, 'yyyy-MM-dd')
        };
      }
    }
    
    if (now >= windowStart && now <= windowEnd) {
      return {
        shift: matchedShift,
        logicalDate: format(now, 'yyyy-MM-dd')
      };
    }
    
    return {
      shift: matchedShift,
      logicalDate: format(now, 'yyyy-MM-dd')
    };
  }
  
  // === NO SPECIFIC ASSIGNED SHIFT (AUTO-DETECT FROM ALL SHIFTS) ===
  type ShiftCandidate = {
    shift: Shift;
    startDate: Date;
    endDate: Date;
    checkInStart: Date;
    checkOutEnd: Date;
    logicalDate: string;
  };
  
  const candidates: ShiftCandidate[] = [];
  
  for (const shift of shifts) {
    const start = shift.startTime.trim();
    const end = shift.endTime.trim();
    const isCrossMidnight = start > end;
    
    let startDate = parse(start, 'HH:mm', now);
    startDate.setSeconds(0);
    startDate.setMilliseconds(0);
    
    let endDate = parse(end, 'HH:mm', now);
    endDate.setSeconds(59);
    endDate.setMilliseconds(999);
    
    if (isCrossMidnight) {
      endDate = addMinutes(endDate, 1440);
    }
    
    candidates.push({
      shift,
      startDate,
      endDate,
      checkInStart: subMinutes(startDate, 30),
      checkOutEnd: addMinutes(endDate, 30),
      logicalDate: format(now, 'yyyy-MM-dd')
    });
    
    // Cross-midnight yesterday instance (e.g. shift malam starting 21:00 yesterday ending 07:00 today)
    if (isCrossMidnight) {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const prevStartDate = subMinutes(startDate, 1440);
      const prevEndDate = subMinutes(endDate, 1440);
      candidates.push({
        shift,
        startDate: prevStartDate,
        endDate: prevEndDate,
        checkInStart: subMinutes(prevStartDate, 30),
        checkOutEnd: addMinutes(prevEndDate, 30),
        logicalDate: format(yesterday, 'yyyy-MM-dd')
      });
    }
  }
  
  // Priority 1: Shift whose primary working hours directly contain `now` (startDate <= now <= endDate)
  // If multiple overlap, the one with the latest startDate wins (e.g. at 14:05, Sore starting 14:00 wins over Pagi)
  const activeWorkingShifts = candidates.filter(c => now >= c.startDate && now <= c.endDate);
  if (activeWorkingShifts.length > 0) {
    activeWorkingShifts.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
    const best = activeWorkingShifts[0];
    return { shift: best.shift, logicalDate: best.logicalDate };
  }
  
  // Priority 2: In early check-in buffer (30m before shift starts: checkInStart <= now < startDate)
  const earlyShifts = candidates.filter(c => now >= c.checkInStart && now < c.startDate);
  if (earlyShifts.length > 0) {
    earlyShifts.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    const best = earlyShifts[0];
    return { shift: best.shift, logicalDate: best.logicalDate };
  }
  
  // Priority 3: In checkout window (endDate < now <= checkOutEnd)
  const checkoutShifts = candidates.filter(c => now > c.endDate && now <= c.checkOutEnd);
  if (checkoutShifts.length > 0) {
    checkoutShifts.sort((a, b) => b.endDate.getTime() - a.endDate.getTime());
    const best = checkoutShifts[0];
    return { shift: best.shift, logicalDate: best.logicalDate };
  }
  
  // Priority 4: Closest shift by start time
  candidates.sort((a, b) => Math.abs(a.startDate.getTime() - now.getTime()) - Math.abs(b.startDate.getTime() - now.getTime()));
  if (candidates.length > 0) {
    return { shift: candidates[0].shift, logicalDate: candidates[0].logicalDate };
  }
  
  return null;
}

export function getShiftStatus(now: Date, shift: Shift) {
  const start = shift.startTime.trim();
  const end = shift.endTime.trim();
  const isCrossMidnight = start > end;
  
  // Use a base date for parsing and RESET seconds/ms to ensure clean comparison
  let shiftStartDate = parse(start, 'HH:mm', now);
  shiftStartDate.setSeconds(0);
  shiftStartDate.setMilliseconds(0);
  
  // If it's a cross-midnight shift and current time is between 00:00 and shift end time,
  // it means the shift actually started on the previous calendar day.
  const currentTimeStr = format(now, 'HH:mm');
  if (isCrossMidnight && currentTimeStr <= end) {
    shiftStartDate = subMinutes(shiftStartDate, 1440); // subtract 24 hours
  }
  
  // Tolerance in minutes (default: 30 minutes)
  const tolerance = (shift as any).toleranceMinutes ?? 30;
  const graceThreshold = addMinutes(shiftStartDate, tolerance);
  
  // Set graceThreshold boundary to the end of that minute (59s 999ms)
  // For example: startTime = 07:00, tolerance = 30m -> graceThreshold = 07:30:59.999
  // Anyone checking in at 07:30:00 - 07:30:59 is considered ON TIME (Tepat Waktu).
  // They are only late starting from 07:31:00 onwards.
  const graceThresholdEndOfMinute = new Date(graceThreshold);
  graceThresholdEndOfMinute.setSeconds(59);
  graceThresholdEndOfMinute.setMilliseconds(999);
  
  // A record is late if current time is strictly AFTER the end of the grace threshold minute
  const isLate = isAfter(now, graceThresholdEndOfMinute);
  
  return {
    isLate,
    startTime: format(shiftStartDate, 'HH:mm'),
    shiftStartDate: shiftStartDate,
    graceThreshold: format(graceThreshold, 'HH:mm'),
    graceThresholdDate: graceThresholdEndOfMinute
  };
}

export function getCheckOutStatus(now: Date, shift: Shift) {
  const end = shift.endTime.trim();
  const start = shift.startTime.trim();
  const isCrossMidnight = start > end;
  
  let shiftEndDate = parse(end, 'HH:mm', now);
  shiftEndDate.setSeconds(0);
  shiftEndDate.setMilliseconds(0);
  
  const currentTimeStr = format(now, 'HH:mm');
  
  if (isCrossMidnight && currentTimeStr >= start) {
    shiftEndDate = addMinutes(shiftEndDate, 1440);
  }

  const checkOutWindowStart = shiftEndDate;
  // Window absen pulang normal: 30 menit setelah shift berakhir (sampai akhir menit :59)
  const checkOutWindowEnd = addMinutes(shiftEndDate, 30);
  checkOutWindowEnd.setSeconds(59);
  checkOutWindowEnd.setMilliseconds(999);
  
  // Pegawai dapat absen pulang kapan saja setelah shift berakhir (termasuk jika terlambat)
  const isCheckOutWindow = now >= checkOutWindowStart;
  const isOnTimeCheckOut = now >= checkOutWindowStart && now <= checkOutWindowEnd;
  const isLateCheckOut = now > checkOutWindowEnd;
  
  return {
    isCheckOutWindow,
    isOnTimeCheckOut,
    isLateCheckOut,
    checkOutWindowStart,
    checkOutWindowEnd
  };
}

// === ATURAN KHUSUS JUMAT ===

export interface FridayEarlyEndConfig {
  enabled: boolean;
  checkOutTime: string;    // HH:mm, default "10:30"
  exemptBidangs: string[]; // Bidang yang dikecualikan, e.g. ["RAWAT INAP", "UGD"]
}

/**
 * Cek apakah window absen pulang khusus Jumat berlaku untuk pegawai ini.
 * Hanya berlaku jika:
 * 1. Hari ini Jumat
 * 2. Konfigurasi fridayEarlyEnd aktif
 * 3. Bidang pegawai TIDAK termasuk dalam daftar exemptBidangs
 * 4. Shift aktif adalah shift pagi (startTime sebelum jam 12:00)
 */
export function getFridayEarlyCheckOutStatus(
  now: Date,
  currentShift: Shift | null | undefined,
  fridayConfig: FridayEarlyEndConfig | null | undefined,
  userBidang: string | null | undefined
) {
  // 1. Hanya hari Jumat
  if (format(now, 'EEEE') !== 'Friday') return null;

  // 2. Konfigurasi harus aktif
  if (!fridayConfig?.enabled) return null;

  // 3. Bidang pegawai tidak boleh masuk daftar yang dikecualikan (shift 24 jam)
  const bidang = (userBidang || '').toUpperCase().trim();
  const exempts = (fridayConfig.exemptBidangs || ['RAWAT INAP', 'UGD']).map((b: string) => b.toUpperCase().trim());
  if (exempts.includes(bidang)) return null;

  // 4. Hanya untuk shift pagi (startTime sebelum jam 12:00)
  if (!currentShift) return null;
  const startHour = parseInt(currentShift.startTime.split(':')[0], 10);
  if (startHour >= 12) return null;

  // Bangun window check-out: mulai dari jam yang dikonfigurasi, +30 menit
  const checkOutTimeStr = fridayConfig.checkOutTime || '10:30';
  const checkOutBase = parse(checkOutTimeStr, 'HH:mm', now);
  checkOutBase.setSeconds(0);
  checkOutBase.setMilliseconds(0);
  const windowStart = checkOutBase;                        // default: 10:30
  const windowEnd = addMinutes(checkOutBase, 30);          // default: 11:00
  windowEnd.setSeconds(59);
  windowEnd.setMilliseconds(999);

  const isCheckOutWindow = now >= windowStart && now <= windowEnd;
  const isTooEarly = now < windowStart;
  const isExpired = now > windowEnd;

  return {
    isEarlyCheckOut: true,
    isCheckOutWindow,
    isTooEarly,
    isExpired,
    checkOutWindowStart: windowStart,
    checkOutWindowEnd: windowEnd,
    checkOutTime: checkOutTimeStr,
  };
}
