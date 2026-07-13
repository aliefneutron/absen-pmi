import { useState, useRef, useEffect, useMemo } from 'react';
import { MapPin, Clock, CheckCircle2, AlertCircle, Camera as CameraIcon, Calendar as CalendarIcon, Navigation, Shield, FileText, Users, Star, Lock, Paperclip } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, buttonVariants } from '../components/ui/button';
import { cn } from '../lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth-context';
import { serverTimestamp, collection, doc, onSnapshot, setDoc, query, where, getDocs, limit, getDocFromServer } from 'firebase/firestore';
import { format, isMonday, isTuesday, isWednesday, isThursday, isFriday, subMinutes, parse, addMinutes, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';
import { id } from 'date-fns/locale';
import History from './History';
import { getCurrentShift, getShiftStatus, getCheckOutStatus, getFridayEarlyCheckOutStatus } from '../lib/shift';

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export default function Dashboard() {
  const { user, profile, isAdmin } = useAuth();
  const [now, setNow] = useState(new Date());
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasAttendedToday, setHasAttendedToday] = useState(false);
  const [hasCheckedOutToday, setHasCheckedOutToday] = useState(false);
  const [recordedTime, setRecordedTime] = useState<Date | null>(null);
  const [checkOutRecordedTime, setCheckOutRecordedTime] = useState<Date | null>(null);
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [selectedLocationIndex, setSelectedLocationIndex] = useState<number | null>(null);
  const [userRosters, setUserRosters] = useState<any[]>([]);
  
  // Bidang Roster State
  const [showBidangRoster, setShowBidangRoster] = useState(false);
  const [bidangUsers, setBidangUsers] = useState<any[]>([]);
  const [bidangRosters, setBidangRosters] = useState<any[]>([]);
  const [isFetchingBidang, setIsFetchingBidang] = useState(false);

  // Event attendance state
  const [hasAttendedEventToday, setHasAttendedEventToday] = useState(false);
  const [eventAttendanceData, setEventAttendanceData] = useState<any>(null);

  // Leave request states
  const [dashboardTab, setDashboardTab] = useState<'history' | 'leave'>('history');
  const [myLeaves, setMyLeaves] = useState<any[]>([]);
  const [leaveForm, setLeaveForm] = useState({
    leaveType: 'I',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    reason: ''
  });
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [leaveAttachment, setLeaveAttachment] = useState<string | null>(null);
  const [leaveAttachmentName, setLeaveAttachmentName] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Ukuran file maksimal adalah 2MB');
        e.target.value = '';
        return;
      }
      setLeaveAttachmentName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLeaveAttachment(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Roster Sync
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'rosters'), where('userId', '==', user.uid));
    return onSnapshot(q, (snap) => {
      setUserRosters(snap.docs.map(d => d.data()));
    });
  }, [user]);

  // Sync My Leave Requests
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'leaves'),
      where('userId', '==', user.uid)
    );
    return onSnapshot(q, (snap) => {
      const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetched.sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      setMyLeaves(fetched);
    });
  }, [user]);

  // Shift state
  const activeShiftInfo = useMemo(() => {
    if (!settings) return null;
    
    // 1. Check today's assigned roster
    const todayStr = format(now, 'yyyy-MM-dd');
    const todayRoster = userRosters.find(r => r.date === todayStr);
    const infoToday = getCurrentShift(now, settings.shifts, todayRoster?.shiftName);
    
    // If it's a normal day shift or we are in the start part of overnight shift
    if (infoToday && (infoToday.shift || (infoToday as any).isOff)) {
      return infoToday;
    }

    // 2. Check yesterday's roster (for the "tail" of an overnight shift)
    const yesterdayStr = format(addMinutes(now, -1440), 'yyyy-MM-dd');
    const yesterdayRoster = userRosters.find(r => r.date === yesterdayStr);
    const infoYesterday = getCurrentShift(now, settings.shifts, yesterdayRoster?.shiftName);

    if (infoYesterday && infoYesterday.shift) {
       // Only return if it's actually an overnight shift and we are in the late part
       const isOvernight = infoYesterday.shift.startTime > infoYesterday.shift.endTime;
       if (isOvernight && infoYesterday.logicalDate === yesterdayStr) {
         return infoYesterday;
       }
    }

    // 3. Check if a shift is starting soon (30 min buffer for notification only)
    if (!infoToday && todayRoster?.shiftName) {
      const shift = settings.shifts.find((s: any) => s.name === todayRoster.shiftName);
      if (shift) {
        const start = parse(shift.startTime, 'HH:mm', now);
        const buffer = subMinutes(start, 30);
        if (now >= buffer && now < start) {
          return { shift, logicalDate: todayStr, isUpcoming: true };
        }
      }
    }

    return null;
  }, [now, settings, userRosters]);

  const currentShift = activeShiftInfo?.shift;
  const logicalDate = activeShiftInfo?.logicalDate;
  const isOffDay = (activeShiftInfo as any)?.isOff;

  const checkOutInfo = useMemo(() => {
    if (!currentShift || !now) return null;
    return getCheckOutStatus(now, currentShift);
  }, [now, currentShift]);

  // Aturan Khusus Jumat: window absen pulang dimajukan ke sekitar 10:30
  const fridayEarlyInfo = useMemo(() => {
    if (!currentShift || !settings) return null;
    return getFridayEarlyCheckOutStatus(
      now,
      currentShift,
      settings.fridayEarlyEnd || null,
      profile?.bidang || null
    );
  }, [now, currentShift, settings, profile?.bidang]);

  // Apakah window absen pulang sedang aktif (normal ATAU Jumat khusus)
  const isEffectiveCheckOutWindow =
    checkOutInfo?.isCheckOutWindow || fridayEarlyInfo?.isCheckOutWindow || false;


  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;

    // 1. Real-time Config Sync
    const docRef = doc(db, 'settings', 'global');
    const unsubscribeSettings = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data());
      } else {
        const defaultSettings = { 
          officeLat: -6.1751, 
          officeLng: 106.8272, 
          radius: 100, 
          startTime: '07:00', 
          lateTime: '08:00',
          shifts: [
            { name: 'Pagi', startTime: '07:30', endTime: '13:30' },
            { name: 'Sore', startTime: '13:30', endTime: '19:30' },
            { name: 'Malam', startTime: '19:30', endTime: '07:30' },
          ]
        };
        setSettings(defaultSettings);
      }
    });

    // 2. Continuous Location Tracking
    let watchId: number | null = null;
    const startWatching = () => {
      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          (pos) => setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          (err) => {
            console.error('GPS Error:', err);
            toast.error('Masalah GPS: Pastikan lokasi aktif & izin diberikan.');
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
      }
    };
    startWatching();


    return () => {
      unsubscribeSettings();
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [user]);

  // Active Event calculation
  const activeEvent = useMemo(() => {
    if (!settings?.event?.isActive) return null;
    const today = format(now, 'yyyy-MM-dd');
    const start = settings.event.startDate || settings.event.date;
    const end = settings.event.endDate || settings.event.date;
    if (start && end && today >= start && today <= end) return settings.event;
    return null;
  }, [settings, now]);

  const isEventTime = useMemo(() => {
    if (!activeEvent) return false;
    const currentTime = format(now, 'HH:mm');
    return currentTime >= activeEvent.startTime && currentTime <= activeEvent.endTime;
  }, [activeEvent, now]);

  // Derived state: Multi-Location Distance Calculation
  const locationStats = useMemo(() => {
    if (!location || !settings) return { isWithinRange: false, nearestDistance: null, nearestLocationName: null, isEventMatch: false };
    
    let nearestDistance = Infinity;
    let nearestLocName: string | null = null;
    let withinAny = false;
    let isEventMatch = false;

    // 1. Check Special Event Location (Prioritize)
    if (activeEvent && activeEvent.lat && activeEvent.lng) {
      const dist = calculateDistance(location.latitude, location.longitude, Number(activeEvent.lat), Number(activeEvent.lng));
      nearestDistance = dist;
      nearestLocName = `LOKASI ACARA: ${activeEvent.name}`;
      if (dist <= (Number(activeEvent.radius) || 100)) {
        withinAny = true;
        isEventMatch = true;
      }
    }

    // 2. Check Multi-Locations
    if (settings.locations && settings.locations.length > 0) {
      if (selectedLocationIndex !== null && settings.locations[selectedLocationIndex]) {
        const selLoc = settings.locations[selectedLocationIndex];
        const dist = calculateDistance(location.latitude, location.longitude, Number(selLoc.lat), Number(selLoc.lng));
        const locRadius = Number(selLoc.radius) || Number(settings.radius) || 100;
        if (dist < nearestDistance) {
          nearestDistance = dist;
          nearestLocName = selLoc.name;
        }
        if (dist <= locRadius) withinAny = true;
      } else {
        settings.locations.forEach((loc: any) => {
          const dist = calculateDistance(location.latitude, location.longitude, Number(loc.lat), Number(loc.lng));
          const locRadius = Number(loc.radius) || Number(settings.radius) || 100;
          if (dist < nearestDistance) {
            nearestDistance = dist;
            nearestLocName = loc.name;
          }
          if (dist <= locRadius) withinAny = true;
        });
      }
    }

    // 3. Fallback to legacy single office location
    if (settings.officeLat && settings.officeLng) {
      const dist = calculateDistance(location.latitude, location.longitude, Number(settings.officeLat), Number(settings.officeLng));
      const globalRadius = Number(settings.radius) || 100;
      if (dist < nearestDistance) {
        nearestDistance = dist;
        nearestLocName = 'Kantor Utama';
      }
      if (dist <= globalRadius) withinAny = true;
    }

    return { 
      isWithinRange: withinAny, 
      nearestDistance: nearestDistance === Infinity ? null : nearestDistance, 
      nearestLocationName: nearestLocName,
      nearestRadius: Number(settings.radius) || 100,
      isEventMatch
    };
  }, [location, settings, activeEvent, selectedLocationIndex]);

  const isWithinRange = locationStats.isWithinRange;
  const distance = locationStats.nearestDistance;

  // 3. Attendance Check Trigger
  useEffect(() => {
    if (user && logicalDate && currentShift) {
      checkTodayAttendance(logicalDate, currentShift.name);
    }
  }, [user, logicalDate, currentShift?.name]);

  const checkTodayAttendance = async (dateStr?: string, shiftName?: string) => {
    if (!user) return;
    const targetDate = dateStr || logicalDate || format(new Date(), 'yyyy-MM-dd');
    const targetShift = shiftName || currentShift?.name;

    const q = query(
      collection(db, 'attendance'),
      where('userId', '==', user.uid)
    );
    const snap = await getDocs(q);

    let regular = false;
    let event = false;
    
    // Check event attendance for today
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    snap.docs.forEach((d) => {
      const data = d.data();
      if (data.isEvent && data.date === todayStr) {
        event = true;
        setEventAttendanceData(data);
      }
    });
    setHasAttendedEventToday(event);

    // First, check if there is an approved leave record for today (which applies all day)
    const leaveLog = snap.docs.find(d => {
      const data = d.data();
      return data.date === targetDate && data.isLeave === true && !data.isEvent;
    });

    if (leaveLog) {
      const data = leaveLog.data();
      setAttendanceData(data);
      setHasAttendedToday(true);
      return;
    }

    // Check regular shift attendance
    if (!targetShift) {
      setHasAttendedToday(false);
      return;
    }
    const shiftLog = snap.docs.find(d => {
      const data = d.data();
      return data.date === targetDate && data.shiftName === targetShift && !data.isEvent;
    });
    
    if (shiftLog) {
      const data = shiftLog.data();
      setAttendanceData(data);
      setHasAttendedToday(true);
      if (data.timestamp) {
        setRecordedTime(data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp));
      }
      if (data.checkOutTimestamp) {
        setHasCheckedOutToday(true);
        setCheckOutRecordedTime(data.checkOutTimestamp.toDate ? data.checkOutTimestamp.toDate() : new Date(data.checkOutTimestamp));
      } else {
        setHasCheckedOutToday(false);
        setCheckOutRecordedTime(null);
      }
    } else {
      setHasAttendedToday(false);
      setAttendanceData(null);
      setHasCheckedOutToday(false);
      setCheckOutRecordedTime(null);
    }
  };

  const isScheduleDay = useMemo(() => {
    // Mode Acara BYPASS semua pembatasan hari
    if (activeEvent && isEventTime) return true;
    return settings?.enabledDays 
      ? settings.enabledDays.includes(format(now, 'EEEE'))
      : (isMonday(now) || isTuesday(now) || isWednesday(now) || isThursday(now) || isFriday(now));
  }, [settings, now, activeEvent, isEventTime]);

  console.log('Dashboard State:', { 
    hasUser: !!user, 
    hasLocation: !!location, 
    hasSettings: !!settings, 
    hasPhoto: !!photo,
    isScheduleDay,
    loading
  });
  

  const startCamera = async () => {
    if (!isWithinRange) {
      toast.error(`Anda berada di luar jangkauan (${Math.round(distance || 0)}m). Kamera tidak dapat diaktifkan.`);
      return;
    }
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengakses kamera');
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Compress foto secara otomatis (resize & compress) agar ukuran minimum (~50-100KB)
      const maxWidth = 480; 
      const scale = Math.min(maxWidth / video.videoWidth, 1);
      
      canvas.width = video.videoWidth * scale;
      canvas.height = video.videoHeight * scale;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Horizontal flip for mirror effect
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      
      // Kompresi kualitas gambar (0.4) agar hemat Firestore & Storage
      const dataUrl = canvas.toDataURL('image/jpeg', 0.4); 
      setPhoto(dataUrl);
      
      // Stop camera
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      setShowCamera(false);
    }
  };

  const handleAttendance = async () => {
    console.log('handleAttendance started');
    if (!user || !location || !settings || !photo) {
      toast.error('Data belum lengkap (Lokasi/Foto)');
      return;
    }

    if (!isScheduleDay) {
      toast.error(`Hari ini (${format(now, 'EEEE')}) bukan jadwal absen sesuai konfigurasi.`);
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Memproses absensi...');
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Koneksi lambat. Silakan coba lagi.')), 60000)
    );
    
    try {
      const attendancePromise = (async () => {
        if (!isWithinRange) {
          const nearestMsg = locationStats.nearestLocationName 
            ? `dari ${locationStats.nearestLocationName}` 
            : 'dari lokasi absen';
          throw new Error(`Anda berada di luar jangkauan (${Math.round(distance || 0)}m ${nearestMsg})`);
        }

        const today = format(now, 'yyyy-MM-dd');
        const timeStr = format(now, 'HH:mm');
        const selfieUrl = photo;

        // === MODE ACARA ===
        const isEventAttendance = !!(activeEvent && (locationStats as any).isEventMatch);

        if (isEventAttendance) {
          // Validasi waktu acara
          if (timeStr < activeEvent.startTime) {
            throw new Error(`Absen acara belum dibuka. Mulai pukul ${activeEvent.startTime} WIB`);
          }
          if (timeStr > activeEvent.endTime) {
            throw new Error(`Absen acara sudah ditutup. Berakhir pukul ${activeEvent.endTime} WIB`);
          }
          // Cegah double absen acara
          if (hasAttendedEventToday) {
            throw new Error('Anda sudah melakukan absen untuk acara ini hari ini.');
          }

          const eventRecordId = `${user.uid}_${today}_event`;
          const eventRecord = {
            userId: user.uid,
            userName: profile?.displayName || user.displayName || user.email?.split('@')[0] || 'Unknown',
            userEmail: user.email,
            timestamp: serverTimestamp(),
            date: today,
            month: today.substring(0, 7),
            location: location,
            isWithinRange: true,
            isLate: false,
            isEvent: true,
            eventName: activeEvent.name,
            selfieUrl: selfieUrl,
          };

          await setDoc(doc(db, 'attendance', eventRecordId), eventRecord);
          setHasAttendedEventToday(true);
          setEventAttendanceData({ ...eventRecord, timestamp: now });
          return `Absen Acara "${activeEvent.name}" berhasil dicatat!`;
        }

        // === MODE REGULER (dengan shift) ===
        if (!currentShift || !logicalDate) {
          throw new Error('Tidak ada jadwal shift aktif saat ini.');
        }

        if ((activeShiftInfo as any)?.isUpcoming) {
          throw new Error(`Absen Shift ${currentShift.name} belum dibuka. Silakan kembali pada pukul ${currentShift.startTime} WIB.`);
        }

        const isCheckOut = hasAttendedToday && !hasCheckedOutToday && isEffectiveCheckOutWindow;
        const recordId = `${user.uid}_${logicalDate}_${currentShift.name}`;

        if (isCheckOut) {
          const updateData = {
            checkOutTimestamp: serverTimestamp(),
            checkOutLocation: location,
            checkOutSelfieUrl: selfieUrl,
          };
          await setDoc(doc(db, 'attendance', recordId), updateData, { merge: true });
          setHasCheckedOutToday(true);
          setCheckOutRecordedTime(now);
          setAttendanceData((prev: any) => ({ ...prev, ...updateData, checkOutTimestamp: now }));
          return `Absen Pulang Shift ${currentShift.name} berhasil dicatat!`;
        } else {
          const { isLate, graceThresholdDate, shiftStartDate } = getShiftStatus(now, currentShift);
          const lateDuration = isLate ? Math.max(0, Math.floor((now.getTime() - shiftStartDate.getTime()) / 1000)) : 0;
          
          const record = {
            userId: user.uid,
            userName: profile?.displayName || user.displayName || user.email?.split('@')[0] || 'Unknown',
            userEmail: user.email,
            timestamp: serverTimestamp(),
            date: logicalDate,
            month: logicalDate.substring(0, 7),
            shiftName: currentShift.name,
            location: location,
            isWithinRange: true,
            isLate: isLate,
            lateDuration: lateDuration,
            lateThreshold: format(graceThresholdDate, 'HH:mm:ss'),
            selfieUrl: selfieUrl,
          };

          await setDoc(doc(db, 'attendance', recordId), record);
          setHasAttendedToday(true);
          setRecordedTime(now);
          setAttendanceData(record);
          return isLate ? `Absen Datang Shift ${currentShift.name} (Terlambat ${Math.floor(lateDuration/60)}m) tercatat!` : `Absen Datang Shift ${currentShift.name} berhasil dicatat!`;
        }
      })();

      const successMessage = await Promise.race([attendancePromise, timeoutPromise]) as string;
      toast.success(successMessage, { id: toastId });
    } catch (err: any) {
      console.error('Attendance Error:', err);
      toast.error(err.message || 'Gagal menyimpan absen. Coba lagi.', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // Apakah masih butuh absen acara (acara aktif, sedang jam acara, belum absen)
  const needsEventAttendance = activeEvent && isEventTime && !hasAttendedEventToday;



  const fetchBidangRoster = async () => {
    if (!profile?.bidang || isFetchingBidang) return;
    setIsFetchingBidang(true);
    try {
      // 1. Fetch users in same bidang
      const usersQ = query(collection(db, 'users'), where('bidang', '==', profile.bidang));
      const usersSnap = await getDocs(usersQ);
      const bUsers = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
      setBidangUsers(bUsers);

      // 2. Fetch rosters for current month
      const startStr = format(startOfMonth(now), 'yyyy-MM-dd');
      const endStr = format(endOfMonth(now), 'yyyy-MM-dd');
      const rosterQ = query(collection(db, 'rosters'), where('date', '>=', startStr), where('date', '<=', endStr));
      const rosterSnap = await getDocs(rosterQ);
      
      const bRosters = rosterSnap.docs
        .map(d => d.data())
        .filter(r => bUsers.some(u => u.uid === r.userId));
        
      setBidangRosters(bRosters);
      setShowBidangRoster(true);
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengambil jadwal piket bidang.');
    } finally {
      setIsFetchingBidang(false);
    }
  };

  const handleLeaveRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason.trim()) {
      toast.error('Mohon lengkapi semua bidang isian');
      return;
    }

    if (leaveForm.startDate > leaveForm.endDate) {
      toast.error('Tanggal mulai tidak boleh melebihi tanggal selesai');
      return;
    }

    setSubmittingLeave(true);
    const toastId = toast.loading('Mengirim pengajuan izin...');
    try {
      const requestId = `leave_${Date.now()}_${user.uid.substring(0, 5)}`;
      const requestData = {
        userId: user.uid,
        userName: profile?.displayName || user.displayName || user.email?.split('@')[0] || 'Unknown',
        userBidang: profile?.bidang || 'Umum',
        userEmail: user.email,
        leaveType: leaveForm.leaveType,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        reason: leaveForm.reason.trim(),
        status: 'PENDING',
        attachmentUrl: leaveAttachment || null,
        attachmentName: leaveAttachmentName || null,
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, 'leaves', requestId), requestData);
      toast.success('Pengajuan izin berhasil dikirim!', { id: toastId });
      setLeaveAttachment(null);
      setLeaveAttachmentName('');
      setLeaveForm({
        leaveType: 'I',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        reason: ''
      });
    } catch (err: any) {
      console.error('Submit Leave Error:', err);
      toast.error(`Gagal mengirim pengajuan: ${err.message || err.toString()}`, { id: toastId });
    } finally {
      setSubmittingLeave(false);
    }
  };

  const renderLeaveSection = () => {
    const leaveTypes: any = {
      'I': { label: 'Izin', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
      'S': { label: 'Sakit', bg: 'bg-rose-50 text-rose-700 border-rose-200' },
      'C': { label: 'Cuti', bg: 'bg-purple-50 text-purple-700 border-purple-200' },
      'T': { label: 'Tugas Luar', bg: 'bg-slate-50 text-slate-700 border-slate-200' }
    };

    const statusTypes: any = {
      'PENDING': { label: 'Menunggu', bg: 'bg-amber-100 text-amber-800 border-amber-200' },
      'APPROVED': { label: 'Disetujui', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
      'REJECTED': { label: 'Ditolak', bg: 'bg-rose-100 text-rose-800 border-rose-200' }
    };

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Form Pengajuan */}
          <Card id="leave-form-card" className="border border-slate-200 shadow-sm overflow-hidden bg-white md:col-span-5 flex flex-col h-fit">
            <CardHeader className="p-4 border-b bg-slate-50/50">
              <CardTitle className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <FileText size={14} className="text-red-500" /> Formulir Izin Baru
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-5">
              <form onSubmit={handleLeaveRequestSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Nama Pegawai</Label>
                    <div className="relative">
                      <Input 
                        value={profile?.displayName || user?.displayName || user?.email?.split('@')[0] || ''} 
                        readOnly
                        className="h-9 text-xs bg-slate-50 border-slate-200 text-slate-500 font-bold uppercase cursor-not-allowed pr-7 truncate"
                      />
                      <Lock className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Bidang</Label>
                    <div className="relative">
                      <Input 
                        value={profile?.bidang || 'Umum'} 
                        readOnly
                        className="h-9 text-xs bg-slate-50 border-slate-200 text-slate-500 font-bold uppercase cursor-not-allowed pr-7 truncate"
                      />
                      <Lock className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Jenis Izin</Label>
                  <select 
                    value={leaveForm.leaveType} 
                    onChange={e => setLeaveForm({...leaveForm, leaveType: e.target.value})}
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus:ring-1 focus:ring-red-500 font-bold uppercase text-slate-700 cursor-pointer"
                  >
                    <option value="I">Izin (I)</option>
                    <option value="S">Sakit (S)</option>
                    <option value="C">Cuti (C)</option>
                    <option value="T">Tugas Luar (T)</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Tanggal Mulai</Label>
                    <Input 
                      type="date" 
                      value={leaveForm.startDate} 
                      onChange={e => setLeaveForm({...leaveForm, startDate: e.target.value})}
                      className="h-9 text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Tanggal Selesai</Label>
                    <Input 
                      type="date" 
                      value={leaveForm.endDate} 
                      onChange={e => setLeaveForm({...leaveForm, endDate: e.target.value})}
                      className="h-9 text-xs bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                   <Label className="text-[10px] font-black uppercase text-slate-400">Keterangan / Alasan</Label>
                   <Input 
                     value={leaveForm.reason} 
                     onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})}
                     placeholder="Tulis alasan izin..."
                     className="h-9 text-xs bg-white"
                   />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Unggah File Lampiran (Opsional)</Label>
                  <div className="relative">
                    <Input 
                      type="file" 
                      accept="image/*,application/pdf"
                      onChange={handleFileChange}
                      className="h-9 text-xs bg-white file:bg-slate-100 file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-wider file:text-slate-600 file:mr-2 cursor-pointer border-slate-200"
                    />
                  </div>
                  {leaveAttachmentName && (
                    <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-tight flex items-center gap-1 mt-1">
                      <CheckCircle2 size={10} /> Terunggah: {leaveAttachmentName}
                    </p>
                  )}
                </div>

                <Button type="submit" disabled={submittingLeave} className="w-full h-9 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-[9px] shadow-lg shadow-red-100">
                   {submittingLeave ? 'MENGIRIM...' : 'KIRIM PENGAJUAN'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Riwayat Pengajuan */}
          <Card className="border border-slate-200 shadow-sm overflow-hidden bg-white md:col-span-7 flex flex-col h-fit">
            <CardHeader className="p-4 border-b bg-slate-50/50">
              <CardTitle className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Clock size={14} className="text-red-500" /> Riwayat Pengajuan Saya
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-auto max-h-[380px]">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-[9px] uppercase font-black py-2 pl-4">Tipe</TableHead>
                    <TableHead className="text-[9px] uppercase font-black py-2">Tanggal</TableHead>
                    <TableHead className="text-[9px] uppercase font-black py-2">Alasan</TableHead>
                    <TableHead className="text-[9px] uppercase font-black py-2 text-right pr-4">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myLeaves.map((leave) => {
                    const typeInfo = leaveTypes[leave.leaveType] || { label: 'Izin', bg: 'bg-slate-100 text-slate-800' };
                    const statusInfo = statusTypes[leave.status] || { label: leave.status, bg: 'bg-slate-100 text-slate-800' };
                    return (
                      <TableRow key={leave.id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="py-2.5 pl-4">
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${typeInfo.bg}`}>
                            {typeInfo.label}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5 text-[10px] font-bold text-slate-600 leading-tight">
                          {leave.startDate === leave.endDate ? (
                            <span>{leave.startDate}</span>
                          ) : (
                            <span>{leave.startDate}<br/><span className="text-[8px] text-slate-400">s/d</span><br/>{leave.endDate}</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 text-[10px] font-semibold text-slate-700 italic max-w-[120px]" title={leave.reason}>
                          <div className="truncate">"{leave.reason}"</div>
                          {leave.attachmentUrl && (
                            <a 
                              href={leave.attachmentUrl} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="inline-flex items-center gap-1 text-[8px] font-black uppercase text-red-600 hover:text-red-700 mt-1 cursor-pointer hover:underline"
                            >
                              <Paperclip size={10} /> Lihat Lampiran
                            </a>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 text-right pr-4">
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${statusInfo.bg}`}>
                            {statusInfo.label}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {myLeaves.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Belum ada riwayat pengajuan izin.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
      {/* Left Panel: Check-in Actions */}
      <section className="lg:col-span-12 xl:col-span-5 space-y-6">
        {/* Banner Mode Acara */}
        {activeEvent && (
          <div className="bg-amber-600 rounded-2xl p-4 shadow-lg shadow-amber-200 border-b-4 border-amber-800 animate-in fade-in slide-in-from-top-4 duration-500 relative overflow-hidden group">
            <div className="flex items-start justify-between relative z-10">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="bg-white/20 text-white border-white/20 text-[8px] font-black uppercase tracking-tighter px-2">Mode Acara Aktif</Badge>
                  {isEventTime && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
                </div>
                <h4 className="text-white font-black text-sm uppercase tracking-tight leading-tight">{activeEvent.name}</h4>
                <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                  <Clock size={10} /> {activeEvent.startTime} - {activeEvent.endTime} WIB
                </p>
                {hasAttendedEventToday && (
                  <p className="text-emerald-200 text-[9px] font-black uppercase tracking-widest flex items-center gap-1 mt-1">
                    <CheckCircle2 size={10} /> Absen acara sudah tercatat
                  </p>
                )}
              </div>
              <Star className="text-white/20 -mr-2" size={40} />
            </div>
            {!isEventTime && (
              <div className="mt-3 py-1.5 px-3 bg-black/20 rounded-lg border border-white/10">
                <p className="text-white text-[9px] font-bold uppercase tracking-widest text-center">Menunggu Waktu Pelaksanaan ({activeEvent.startTime} WIB)</p>
              </div>
            )}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-white/10 transition-colors" />
          </div>
        )}
        {hasAttendedToday && (!isEffectiveCheckOutWindow || hasCheckedOutToday) && !needsEventAttendance ? (
          attendanceData?.isLeave ? (
            (() => {
              const typeColors: any = {
                'I': { bg: 'bg-amber-600', ring: 'ring-amber-100', shadow: 'shadow-amber-200', title: 'Status: Izin' },
                'S': { bg: 'bg-red-600', ring: 'ring-red-100', shadow: 'shadow-red-200', title: 'Status: Sakit' },
                'C': { bg: 'bg-purple-600', ring: 'ring-purple-100', shadow: 'shadow-purple-200', title: 'Status: Cuti' },
                'T': { bg: 'bg-slate-600', ring: 'ring-slate-100', shadow: 'shadow-slate-200', title: 'Status: Tugas Luar' }
              };
              const colors = typeColors[attendanceData.leaveType] || typeColors['I'];
              return (
                <Card className="border border-slate-200 shadow-sm overflow-hidden flex flex-col bg-white animate-in fade-in duration-300">
                  <CardHeader className="bg-slate-50/50 border-b py-3 px-5 flex flex-row items-center justify-between space-y-0">
                     <div className="flex flex-col">
                        <p className="text-base font-black text-red-600 uppercase tracking-tight leading-tight">Halo, {profile?.displayName || user?.displayName?.split(' ')[0] || 'Pegawai'}</p>
                        {profile?.nip && <p className="text-[10px] font-mono font-bold text-slate-600 tracking-wider">ID Pegawai: {profile.nip}</p>}
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{profile?.bidang || 'Staf Operasional'}</p>
                     </div>
                     <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-black rounded italic uppercase border border-emerald-200">Izin Disetujui</span>
                  </CardHeader>
                  <CardContent className="pt-8 pb-8 px-8 flex flex-col items-center justify-center space-y-6">
                    <div className="mx-auto mb-2 relative">
                      <div className={`${colors.bg} p-4 rounded-2xl shadow-lg ${colors.shadow} ring-4 ${colors.ring} flex items-center justify-center w-16 h-16`}>
                        <FileText className="h-8 w-8 text-white" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-0.5 border-2 border-white">
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    <CardTitle className="text-slate-800 text-lg font-black uppercase tracking-tight">{colors.title}</CardTitle>
                    <p className="text-slate-500 text-xs font-semibold text-center leading-normal">
                      Catatan kehadiran khusus telah disetujui (Admin bypass).
                    </p>
                    {attendanceData.leaveReason && (
                      <div className="text-center bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl w-full max-w-xs shadow-inner">
                        <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest mb-1">Keterangan / Alasan</p>
                        <p className="text-xs font-bold text-slate-700 italic">"{attendanceData.leaveReason}"</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()
          ) : (
            (() => {
              const isWaitingForCheckOut = !hasCheckedOutToday;
              return (
                <Card className="border border-slate-200 shadow-sm overflow-hidden flex flex-col bg-emerald-50/50 animate-in fade-in duration-300">
                  <CardHeader className="bg-emerald-100/50 border-b border-emerald-200/60 py-3 px-5 flex flex-row items-center justify-between space-y-0">
                     <div className="flex flex-col">
                        <p className="text-base font-black text-emerald-800 uppercase tracking-tight leading-tight">Halo, {profile?.displayName || user?.displayName?.split(' ')[0] || 'Pegawai'}</p>
                        {profile?.nip && <p className="text-[10px] font-mono font-bold text-emerald-700 tracking-wider">ID Pegawai: {profile.nip}</p>}
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">{profile?.bidang || 'Staf Operasional'}</p>
                     </div>
                     <span className="px-2 py-0.5 bg-emerald-600 text-white text-[9px] font-black rounded italic uppercase border border-emerald-700 shadow-sm">Sudah Absen</span>
                  </CardHeader>
                  <CardContent className="pt-8 pb-8 px-8 flex flex-col items-center justify-center space-y-6">
                    <div className="mx-auto mb-2 relative">
                      <div className="bg-white rounded-2xl flex items-center justify-center overflow-hidden w-16 h-16 mx-auto border-2 border-emerald-200 shadow-md">
                        <img src="/icon-192.png" alt="PMI Logo" className="w-12 h-12 object-contain" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-0.5 border-2 border-white">
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    <CardTitle className="text-emerald-800 text-lg font-black uppercase tracking-tight text-center">
                      {isWaitingForCheckOut ? `Sudah Absen Datang ${attendanceData?.shiftName || ''}` : `Absen Selesai ${attendanceData?.shiftName || ''}`}
                    </CardTitle>
                    <p className="text-emerald-600 text-xs font-semibold text-center leading-normal max-w-xs">
                      {isWaitingForCheckOut 
                        ? 'Terima kasih, absen datang Anda sudah tercatat. Jangan lupa untuk absen pulang nanti.' 
                        : 'Terima kasih, kehadiran dan jam pulang Anda hari ini sudah tercatat.'}
                    </p>
                    <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
                      <div className="text-center bg-white border border-emerald-200/80 px-4 py-2.5 rounded-xl shadow-sm">
                        <p className="text-[9px] uppercase font-black text-emerald-700 tracking-widest mb-0.5">Masuk</p>
                        <p className="text-xl font-black text-emerald-900 tabular-nums tracking-tight">{recordedTime ? format(recordedTime, 'HH:mm', { locale: id }) : '-'}</p>
                      </div>
                      <div className="text-center bg-white border border-emerald-200/80 px-4 py-2.5 rounded-xl shadow-sm">
                        <p className="text-[9px] uppercase font-black text-emerald-700 tracking-widest mb-0.5">Pulang</p>
                        <p className="text-xl font-black text-emerald-900 tabular-nums tracking-tight">{checkOutRecordedTime ? format(checkOutRecordedTime, 'HH:mm', { locale: id }) : '-'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()
          )
        ) : isOffDay && !hasAttendedToday ? (
          <Card className="border border-slate-200 shadow-sm overflow-hidden flex flex-col bg-amber-50 animate-in fade-in duration-300">
            <CardHeader className="bg-amber-100/50 border-b border-amber-200/60 py-3 px-5 flex flex-row items-center justify-between space-y-0">
               <div className="flex flex-col">
                  <p className="text-base font-black text-amber-800 uppercase tracking-tight leading-tight">Halo, {profile?.displayName || user?.displayName?.split(' ')[0] || 'Pegawai'}</p>
                  {profile?.nip && <p className="text-[10px] font-mono font-bold text-amber-700 tracking-wider">ID Pegawai: {profile.nip}</p>}
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">{profile?.bidang || 'Staf Operasional'}</p>
               </div>
               <span className="px-2 py-0.5 bg-amber-500 text-white text-[9px] font-black rounded italic uppercase border border-amber-600 shadow-sm">Libur</span>
            </CardHeader>
            <CardContent className="pt-8 pb-8 px-8 flex flex-col items-center justify-center space-y-6">
              <div className="mx-auto mb-2 relative">
                <div className="bg-white p-4 rounded-2xl shadow-md border border-amber-200 flex items-center justify-center w-16 h-16">
                  <CalendarIcon className="h-8 w-8 text-amber-500" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-amber-500 rounded-full p-1 border-2 border-white">
                  <Shield className="h-3 w-3 text-white" />
                </div>
              </div>
              <CardTitle className="text-amber-900 font-black uppercase tracking-tight text-lg text-center">Hari Libur Terjadwal</CardTitle>
              <p className="text-xs text-amber-700 font-semibold text-center leading-normal max-w-xs">
                Berdasarkan sistem penjadwalan dinas (Roster), hari ini Anda dijadwalkan untuk <strong>LIBUR</strong>. Manfaatkan waktu ini untuk beristirahat!
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border border-slate-200 shadow-sm overflow-hidden flex flex-col bg-white">
            <CardHeader className="bg-slate-50/50 border-b py-3 px-5 flex flex-row items-center justify-between space-y-0">
               <div className="flex flex-col">
                  <p className="text-base font-black text-red-600 uppercase tracking-tight leading-tight">Halo, {profile?.displayName || user?.displayName?.split(' ')[0] || 'Pegawai'}</p>
                  {profile?.nip && <p className="text-[10px] font-mono font-bold text-slate-600 tracking-wider">ID Pegawai: {profile.nip}</p>}
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{profile?.bidang || 'Staf Operasional'}</p>
               </div>
               <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-black rounded italic uppercase border border-emerald-200">Lokasi Terverifikasi</span>
            </CardHeader>
            
            <CardContent className="pt-6 pb-8 px-8 flex flex-col items-center justify-center space-y-6">
              <div className="text-center space-y-1 mb-2">
                <h2 className="text-4xl font-black tabular-nums tracking-tighter text-slate-800">
                  {format(now, 'HH:mm:ss')}
                </h2>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest italic leading-none">
                  {format(now, 'EEEE, dd-MM-yyyy', { locale: id })}
                </p>
              </div>

              {/* Selfie Viewport */}
              <div className="relative w-full max-w-[280px] aspect-[3/4] bg-slate-900 rounded-3xl overflow-hidden border-8 border-slate-100 shadow-inner group">
                {!photo && !showCamera ? (
                  <div
                    onClick={startCamera}
                    className={cn(
                      "absolute inset-0 flex flex-col items-center justify-center gap-3 transition-all",
                      isWithinRange 
                        ? "cursor-pointer bg-slate-800/80 hover:bg-slate-800 group-hover:scale-105" 
                        : "cursor-not-allowed bg-slate-900/90 grayscale"
                    )}
                  >
                    <div className={cn(
                      "bg-white p-2 rounded-2xl flex items-center justify-center overflow-hidden",
                      !isWithinRange && "opacity-50"
                    )}>
                      <img src="/icon-192.png" alt="PMI Logo" className="w-12 h-12 object-contain" />
                    </div>
                    <span className={cn(
                      "text-[10px] uppercase font-black tracking-widest",
                      isWithinRange ? "text-red-300" : "text-rose-400"
                    )}>
                      {isWithinRange ? 'Ketuk untuk memulai kamera' : 'Di luar jangkauan'}
                    </span>
                  </div>
                ) : showCamera ? (
                  <>
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
                    <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_center,_transparent_0%,_black_100%)] pointer-events-none" />
                    <div className="absolute bottom-6 left-0 right-0 flex justify-center">
                      <Button onClick={takePhoto} className="rounded-full w-14 h-14 p-0 shadow-2xl border-4 border-white/50 bg-red-600 hover:bg-red-700">
                        <div className="w-8 h-8 rounded-full bg-white" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <img src={photo} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 opacity-20 bg-red-900/10 pointer-events-none" />
                    <Button 
                      onClick={() => setPhoto(null)} 
                      variant="secondary" size="sm" 
                      className="absolute top-4 right-4 rounded-full h-8 px-4 text-[10px] font-black uppercase bg-white/90 backdrop-blur-sm border shadow-sm"
                    >
                      Ulangi
                    </Button>
                  </>
                )}
                <div className="absolute bottom-4 right-4 px-2 py-0.5 bg-black/40 backdrop-blur-md rounded text-[8px] font-bold text-white uppercase tracking-tighter border border-white/10">Aman 1080p</div>
              </div>

              <Button 
                disabled={loading} 
                onClick={() => {
                  if (!photo) toast.error('Silakan ambil foto selfie terlebih dahulu');
                  else if (!location) toast.error('Sedang mencari lokasi GPS...');
                  else if (!isScheduleDay) toast.error('Hari ini bukan jadwal absen');
                  else handleAttendance();
                }}
                className="w-full max-w-[280px] h-auto bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black shadow-xl shadow-red-200 transition-all active:scale-95 py-5 px-4 text-xl tracking-wide leading-none"
              >
                {loading ? 'MEMPROSES...' : (hasAttendedToday && !hasCheckedOutToday ? 'ABSEN PULANG' : 'ABSEN DATANG')}
              </Button>

              {/* Info jam khusus Jumat */}
              {fridayEarlyInfo && !hasAttendedToday && (
                <div className="w-full max-w-[280px] bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2.5 shadow-sm">
                  <span className="text-amber-500 text-base">🕙</span>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-700">Jumat — Rawat Jalan</p>
                    <p className="text-[10px] font-bold text-amber-800 leading-tight">
                      Absen pulang tersedia pkl {fridayEarlyInfo.checkOutTime} WIB
                    </p>
                  </div>
                </div>
              )}

              {/* Sub info section */}
              <div className="w-full max-w-[280px] bg-slate-50 border border-slate-100 rounded-xl flex flex-col items-center gap-1.5 py-3 px-4 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase leading-none">
                  {settings?.enabledDays && settings.enabledDays.length > 0
                    ? settings.enabledDays.map((d: string) => d.substring(0, 3).toUpperCase()).join(' · ')
                    : 'MON · TUE · WED · THU · FRI'}
                </span>

                {location && distance !== null && (
                  <span className={cn(
                    "text-[11px] font-black leading-none",
                    distance <= (locationStats.nearestRadius || 100) ? "text-emerald-500" : "text-rose-500"
                  )}>
                    {Math.round(distance)}m dari {locationStats.nearestLocationName || 'lokasi absen'}
                  </span>
                )}

                {!location && !loading && (
                  <span className="text-[10px] font-bold text-amber-500 leading-none">
                    ⌛ Mencari GPS...
                  </span>
                )}
                {!isScheduleDay && (
                  <span className="text-[10px] font-black text-rose-500 leading-none animate-pulse">
                    ⛔ Off Schedule
                  </span>
                )}
              </div>
            </CardContent>

            <CardFooter className="bg-slate-50 border-t p-4 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 w-full">
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1">Lokasi Saat Ini</p>
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className={location ? "text-red-500" : "text-slate-300"} />
                    <p className="text-[10px] font-mono font-bold text-slate-700">
                      {location ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : 'SCANNING...'}
                    </p>
                  </div>
                  <div className="absolute right-2 top-2 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Navigation size={12} className="rotate-45" />
                  </div>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Titik Absen</p>
                    {settings?.locations?.length > 0 && (
                      <button 
                        onClick={() => setSelectedLocationIndex(null)}
                        className={cn(
                          "text-[8px] font-black uppercase tracking-tighter transition-colors",
                          selectedLocationIndex === null ? "text-red-500" : "text-slate-300 hover:text-red-400"
                        )}
                      >
                        Auto Detect
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center border border-slate-100 shadow-sm p-0.5 overflow-hidden">
                      <img src="/icon-512.png" alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    {settings?.locations?.length > 0 ? (
                      <select 
                        value={selectedLocationIndex === null ? "" : selectedLocationIndex}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedLocationIndex(val === "" ? null : parseInt(val));
                        }}
                        className="bg-transparent border-none p-0 text-[10px] font-black text-slate-700 uppercase tracking-tight focus:ring-0 cursor-pointer w-full appearance-none"
                      >
                        {selectedLocationIndex === null && (
                          <option value="">{locationStats.nearestLocationName} (Otomatis)</option>
                        )}
                        {settings.locations.map((loc: any, idx: number) => (
                          <option key={idx} value={idx}>{loc.name}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-[10px] font-black text-slate-700 uppercase tracking-tight">
                        {locationStats.nearestLocationName || 'Node Utama'}
                      </p>
                    )}
                  </div>
                   <div className="absolute right-2 top-2 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Shield size={12} />
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-x-6 gap-y-3 px-1">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-red-400" />
                  <p className="text-[10px] font-mono font-black text-slate-500 uppercase tracking-widest">
                    {currentShift ? `Shift ${currentShift.name}: ${currentShift.startTime} - ${currentShift.endTime} WIB` : 'Tidak Ada Shift Aktif'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                   <div className={cn(
                     "w-2 h-2 rounded-full animate-pulse",
                     location ? "bg-emerald-500" : "bg-amber-500"
                   )} />
                   <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Telemetri Langsung</span>
                </div>
              </div>
            </CardFooter>
          </Card>
        )}

        {/* Notifications */}
        <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden">
          <CardHeader className="p-4 border-b bg-slate-50/30">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Daftar Notifikasi</h3>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
             <div className="flex items-start gap-4 p-3 bg-red-50/50 border-l-4 border-red-500 rounded-lg text-xs leading-relaxed group hover:bg-red-50 transition-colors">
               <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 animate-pulse shrink-0"></div>
               <div>
                  <p className="text-red-900 font-bold uppercase text-[10px] mb-0.5 tracking-tight">Siaran Jadwal</p>
                  <p className="text-red-800 opacity-80">
                    {activeEvent 
                      ? `MODE ACARA AKTIF: ${activeEvent.name}. Lokasi dan waktu absen disesuaikan untuk acara ini.`
                      : `Siklus absen hari ${
                          settings?.enabledDays && settings.enabledDays.length > 0
                            ? (() => {
                                const dayMap: any = {
                                  'Monday': 'Senin', 'Tuesday': 'Selasa', 'Wednesday': 'Rabu',
                                  'Thursday': 'Kamis', 'Friday': 'Jumat', 'Saturday': 'Sabtu', 'Sunday': 'Minggu'
                                };
                                const translated = settings.enabledDays.map((d: string) => dayMap[d] || d);
                                return translated.length > 1 ? `${translated[0]} - ${translated[translated.length - 1]}` : (translated[0] || 'Senin - Jumat');
                              })()
                            : 'Senin - Jumat'
                        } tetap aktif. Pastikan verifikasi GPS menyala.`}
                  </p>
               </div>
             </div>
             {/* Notifikasi khusus event: sebelum waktu mulai */}
             {activeEvent && !isEventTime && format(now, 'HH:mm') < activeEvent.startTime && (
               <div className="flex items-start gap-4 p-3 bg-amber-50 border-l-4 border-amber-400 rounded-lg text-xs leading-relaxed">
                 <div className="w-2 h-2 bg-amber-400 rounded-full mt-1.5 shrink-0"></div>
                 <div>
                   <p className="text-amber-900 font-bold uppercase text-[10px] mb-0.5 tracking-tight">Sistem Siaga Acara</p>
                   <p className="text-amber-800 opacity-80">Absen acara "{activeEvent.name}" belum dibuka. Silakan kembali pukul {activeEvent.startTime} WIB.</p>
                 </div>
               </div>
             )}
             {/* Notifikasi event sudah selesai */}
             {hasAttendedEventToday && eventAttendanceData && (
               <div className="flex items-start gap-4 p-3 bg-emerald-50 border-l-4 border-emerald-500 rounded-lg text-xs leading-relaxed">
                 <div className="w-2 h-2 bg-emerald-500 rounded-full mt-1.5 shrink-0"></div>
                 <div>
                   <p className="text-emerald-900 font-bold uppercase text-[10px] mb-0.5 tracking-tight">Absen Acara Tercatat</p>
                   <p className="text-emerald-800 opacity-80">Kehadiran acara "{eventAttendanceData.eventName}" berhasil dicatat pukul {eventAttendanceData.timestamp?.toDate ? format(eventAttendanceData.timestamp.toDate(), 'HH:mm') : format(new Date(eventAttendanceData.timestamp), 'HH:mm')} WIB.</p>
                 </div>
               </div>
             )}
             {(activeShiftInfo as any)?.isUpcoming && (
                <div className="flex items-start gap-4 p-3 bg-slate-100 border-l-4 border-slate-400 rounded-lg text-xs leading-relaxed">
                  <div className="w-2 h-2 bg-slate-400 rounded-full mt-1.5 shrink-0"></div>
                  <div>
                     <p className="text-slate-900 font-bold uppercase text-[10px] mb-0.5 tracking-tight">Sistem Siaga</p>
                     <p className="text-slate-800 opacity-80">Absen Shift {currentShift?.name} belum dibuka. Silakan kembali pada pukul {currentShift?.startTime} WIB.</p>
                  </div>
                </div>
              )}
              {currentShift && getShiftStatus(now, currentShift).isLate && !hasAttendedToday && (
                <div className="flex items-start gap-4 p-3 bg-rose-50 border-l-4 border-rose-500 rounded-lg text-xs leading-relaxed">
                  <div className="w-2 h-2 bg-rose-500 rounded-full mt-1.5 animate-bounce shrink-0"></div>
                  <div>
                     <p className="text-rose-900 font-bold uppercase text-[10px] mb-0.5 tracking-tight">Peringatan Terlambat</p>
                     <p className="text-rose-800 opacity-80">Waktu masuk Shift {currentShift.name} telah lewat batas toleransi ({getShiftStatus(now, currentShift).graceThreshold}). Status kehadiran akan ditandai terlambat.</p>
                  </div>
                </div>
              )}
              {hasAttendedToday && !hasCheckedOutToday && checkOutInfo?.isCheckOutWindow && (
                <div className="flex items-start gap-4 p-3 bg-emerald-50 border-l-4 border-emerald-500 rounded-lg text-xs leading-relaxed">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full mt-1.5 animate-bounce shrink-0"></div>
                  <div>
                     <p className="text-emerald-900 font-bold uppercase text-[10px] mb-0.5 tracking-tight">Waktunya Pulang</p>
                     <p className="text-emerald-800 opacity-80">Jendela waktu absen pulang untuk Shift {currentShift?.name} telah terbuka. Silakan lakukan absen pulang.</p>
                  </div>
                </div>
              )}
              {/* Notifikasi khusus Jumat rawat jalan */}
              {fridayEarlyInfo && !hasCheckedOutToday && (
                <div className="flex items-start gap-4 p-3 bg-amber-50 border-l-4 border-amber-400 rounded-lg text-xs leading-relaxed">
                  <div className="w-2 h-2 bg-amber-400 rounded-full mt-1.5 animate-pulse shrink-0"></div>
                  <div>
                    <p className="text-amber-900 font-bold uppercase text-[10px] mb-0.5 tracking-tight">⚕️ Jumat — Rawat Jalan</p>
                    {fridayEarlyInfo.isTooEarly && (
                      <p className="text-amber-800 opacity-80">
                        Window absen pulang rawat jalan akan dibuka pukul <strong>{format(fridayEarlyInfo.checkOutWindowStart, 'HH:mm')}</strong> WIB
                        (s.d. {format(fridayEarlyInfo.checkOutWindowEnd, 'HH:mm')} WIB).
                      </p>
                    )}
                    {fridayEarlyInfo.isCheckOutWindow && hasAttendedToday && (
                      <p className="text-amber-800 opacity-80">
                        Window absen pulang rawat jalan <strong>sedang aktif</strong> hingga pukul {format(fridayEarlyInfo.checkOutWindowEnd, 'HH:mm')} WIB. Silakan absen pulang!
                      </p>
                    )}
                    {fridayEarlyInfo.isCheckOutWindow && !hasAttendedToday && (
                      <p className="text-amber-800 opacity-80">
                        Absen datang terlebih dahulu, kemudian lakukan absen pulang rawat jalan sebelum pukul {format(fridayEarlyInfo.checkOutWindowEnd, 'HH:mm')} WIB.
                      </p>
                    )}
                    {fridayEarlyInfo.isExpired && (
                      <p className="text-amber-800 opacity-80">
                        Window absen pulang rawat jalan telah berakhir (pukul {format(fridayEarlyInfo.checkOutWindowEnd, 'HH:mm')} WIB). Gunakan absen pulang shift normal.
                      </p>
                    )}
                  </div>
                </div>
              )}
               {isOffDay && (
                 <div className="flex items-start gap-4 p-3 bg-amber-50 border-l-4 border-amber-500 rounded-lg text-xs leading-relaxed">
                   <div className="w-2 h-2 bg-amber-500 rounded-full mt-1.5 shrink-0"></div>
                   <div>
                      <p className="text-amber-900 font-bold uppercase text-[10px] mb-0.5 tracking-tight">Status Libur</p>
                      <p className="text-amber-800 opacity-80">Berdasarkan jadwal piket, hari ini Anda dijadwalkan **LIBUR (OFF)**. Nikmati waktu istirahat Anda!</p>
                   </div>
                 </div>
               )}
               {!currentShift && !isOffDay && (
                <div className="flex items-start gap-4 p-3 bg-amber-50 border-l-4 border-amber-500 rounded-lg text-xs leading-relaxed">
                  <div className="w-2 h-2 bg-amber-500 rounded-full mt-1.5 shrink-0"></div>
                  <div>
                     <p className="text-amber-900 font-bold uppercase text-[10px] mb-0.5 tracking-tight">Di Luar Jam Piket</p>
                <p className="text-amber-800 opacity-80">Tidak ada jadwal piket yang aktif saat ini. Silakan periksa jadwal piket Anda.</p>
                  </div>
                </div>
              )}
          </CardContent>
          <CardFooter className="bg-slate-50 border-t p-4 flex flex-col gap-2.5">
             <Button 
               onClick={() => {
                 setDashboardTab('leave');
                 toast.success('Formulir pengajuan izin dibuka di bagian bawah halaman!');
                 setTimeout(() => {
                   const el = document.getElementById('leave-form-card');
                   if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                 }, 150);
               }}
               className="w-full text-[10px] uppercase font-black tracking-widest bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-100 h-10 transition-all active:scale-95"
             >
               <FileText size={14} className="mr-2" />
               Ajukan Izin Pegawai
             </Button>

             <Dialog open={showBidangRoster} onOpenChange={setShowBidangRoster}>
               <DialogTrigger
                 render={
                   <Button onClick={fetchBidangRoster} disabled={isFetchingBidang} variant="outline" className="w-full text-[10px] uppercase font-black tracking-widest border-red-200 text-red-600 hover:bg-red-50 h-10">
                     <Users size={14} className="mr-2" />
                     {isFetchingBidang ? 'Memuat Jadwal...' : 'Lihat Jadwal Piket'}
                   </Button>
                 }
               />
               <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col p-0">
                 <DialogHeader className="p-4 border-b bg-slate-50 shrink-0">
                   <DialogTitle className="text-xs font-black uppercase tracking-widest text-slate-700">Jadwal Piket: {profile?.bidang || ''}</DialogTitle>
                   <DialogDescription className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                     Bulan {format(now, 'MMMM yyyy', { locale: id })}
                   </DialogDescription>
                 </DialogHeader>
                 <div className="overflow-auto flex-1 p-4">
                   <Table>
                     <TableHeader className="bg-slate-50/80">
                       <TableRow>
                         <TableHead className="sticky top-0 left-0 bg-slate-50 z-30 text-[9px] uppercase font-black shadow-[2px_0_5px_rgba(0,0,0,0.05)] py-2 border-b">Pegawai</TableHead>
                         {eachDayOfInterval({ start: startOfMonth(now), end: endOfMonth(now) }).map(date => (
                           <TableHead key={date.toISOString()} className="sticky top-0 bg-slate-50 z-20 text-center min-w-[40px] px-1 py-2 text-[9px] font-black uppercase border-b">
                             <span className="opacity-50">{format(date, 'EEE', { locale: id })}</span><br/>
                             <span className="text-slate-800">{format(date, 'dd')}</span>
                           </TableHead>
                         ))}
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {bidangUsers.map(emp => (
                         <TableRow key={emp.uid} className="hover:bg-slate-50 transition-colors">
                           <TableCell className="sticky left-0 bg-white z-10 py-2 border-r shadow-[2px_0_5px_rgba(0,0,0,0.02)] min-w-[120px]">
                             <p className="font-black text-[10px] uppercase text-slate-700 leading-tight">{emp.displayName || emp.name || 'Pegawai'}</p>
                           </TableCell>
                           {eachDayOfInterval({ start: startOfMonth(now), end: endOfMonth(now) }).map(date => {
                             const dateStr = format(date, 'yyyy-MM-dd');
                             const roster = bidangRosters.find(r => r.userId === emp.uid && r.date === dateStr);
                             return (
                               <TableCell key={date.toISOString()} className="text-center p-1 border-r border-b last:border-r-0">
                                 {roster ? (
                                    <Badge variant="outline" className={cn(
                                      "text-[8px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm",
                                      roster.shiftName === 'OFF' ? "bg-slate-100 text-slate-400 border-slate-200" : "bg-red-50 text-red-600 border-red-200"
                                    )}>
                                      {roster.shiftName === 'OFF' ? 'L' : roster.shiftName}
                                    </Badge>
                                 ) : (
                                    <span className="text-[8px] text-slate-300">-</span>
                                 )}
                               </TableCell>
                             )
                           })}
                         </TableRow>
                       ))}
                       {bidangUsers.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={32} className="py-8 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              Belum ada data pegawai di bidang ini.
                            </TableCell>
                          </TableRow>
                       )}
                     </TableBody>
                   </Table>
                 </div>
               </DialogContent>
             </Dialog>
          </CardFooter>
        </Card>
      </section>

      {/* Center/Right Panel: Dashboard Stats & Analytics */}
      {isAdmin && (
        <section className="lg:col-span-12 xl:col-span-7 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-white border border-slate-200 shadow-sm p-5 flex flex-col justify-center relative overflow-hidden group hover:ring-2 ring-red-100 transition-all">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 relative z-10">Hari Terjadwal</span>
              <div className="flex items-center gap-1.5 relative z-10 flex-wrap">
                {(settings?.enabledDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']).map((day: string) => (
                  <span key={day} className="px-2.5 py-1 bg-red-100 text-red-700 rounded-md font-black text-[10px] tracking-tight">{day.substring(0, 3).toUpperCase()}</span>
                ))}
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:scale-110 transition-transform">
                <CalendarIcon size={100} />
              </div>
            </Card>
            
            <Card className="bg-white border border-slate-200 shadow-sm p-5 flex flex-col justify-center relative overflow-hidden group hover:ring-2 ring-emerald-100 transition-all">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 relative z-10">Akurasi Lokasi</span>
              <div className="flex items-baseline gap-1 relative z-10">
                <span className="text-4xl font-black text-emerald-600 tracking-tighter tabular-nums">98.4</span>
                <span className="text-sm font-bold text-emerald-500">%</span>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight relative z-10 animate-pulse">
                {locationStats.isWithinRange ? 'LOKASI_TERKUNCI' : 'DI_LUAR_RADIUS'}
              </span>
              <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:scale-110 transition-transform text-emerald-600">
                <MapPin size={100} />
              </div>
            </Card>

            <Card className="bg-white border border-slate-200 shadow-sm p-5 flex flex-col justify-center relative overflow-hidden group hover:ring-2 ring-amber-100 transition-all">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 relative z-10">Status Hari Ini</span>
              <span className={`text-3xl font-black tracking-tighter relative z-10 ${hasAttendedToday ? (attendanceData?.isLeave ? 'text-red-600' : 'text-emerald-600') : 'text-amber-500'}`}>
                {hasAttendedToday ? (attendanceData?.isLeave ? 'IZIN' : 'TERCATAT') : 'MENUNGGU'}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight relative z-10">Verifikasi sedang berlangsung</span>
              <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:scale-110 transition-transform text-amber-600">
                <CheckCircle2 size={100} />
              </div>
            </Card>
          </div>

          <div id="dashboard-tabs-container" className="flex bg-slate-100 p-1 rounded-xl w-full max-w-xs border border-slate-200">
            <button
              onClick={() => setDashboardTab('history')}
              className={cn(
                "flex-1 py-1.5 text-[9px] uppercase font-black tracking-widest rounded-lg transition-all duration-200",
                dashboardTab === 'history'
                  ? "bg-white text-red-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              Riwayat
            </button>
            <button
              onClick={() => setDashboardTab('leave')}
              className={cn(
                "flex-1 py-1.5 text-[9px] uppercase font-black tracking-widest rounded-lg transition-all duration-200",
                dashboardTab === 'leave'
                  ? "bg-white text-red-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              Ajukan Izin
            </button>
          </div>

          {dashboardTab === 'history' ? (
            <History standalone={false} />
          ) : (
            renderLeaveSection()
          )}
        </section>
      )}

      {!isAdmin && (
        <section className="lg:col-span-12 xl:col-span-7 space-y-6">
          <div id="dashboard-tabs-container" className="flex bg-slate-100 p-1 rounded-xl w-full max-w-xs border border-slate-200">
            <button
              onClick={() => setDashboardTab('history')}
              className={cn(
                "flex-1 py-1.5 text-[9px] uppercase font-black tracking-widest rounded-lg transition-all duration-200",
                dashboardTab === 'history'
                  ? "bg-white text-red-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              Riwayat
            </button>
            <button
              onClick={() => setDashboardTab('leave')}
              className={cn(
                "flex-1 py-1.5 text-[9px] uppercase font-black tracking-widest rounded-lg transition-all duration-200",
                dashboardTab === 'leave'
                  ? "bg-white text-red-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              Ajukan Izin
            </button>
          </div>

          {dashboardTab === 'history' ? (
            <History standalone={false} />
          ) : (
            renderLeaveSection()
          )}
        </section>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

