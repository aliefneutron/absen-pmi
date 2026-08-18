import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, getDocs, doc, setDoc, getDoc, where, serverTimestamp, updateDoc, deleteField, deleteDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isAfter, isBefore, isSameDay, subMinutes, parse, addMinutes } from 'date-fns';
import { id } from 'date-fns/locale';
import { BarChart as BarChartIcon, Settings, Download, Search, MapPin, Check, Users, UserPlus, Upload, X, Smartphone, RefreshCw, Edit2, Trash2, FileText, CalendarRange, Clock, AlertTriangle, Navigation, Star, Paperclip, Copy, CheckSquare, UserCheck, UserX, Save, Sliders } from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/auth-context';

export default function Admin() {
  const { isSuperAdmin } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<string[]>(['RAWAT INAP', 'UGD', 'KLASTER 1', 'KLASTER 2', 'KLASTER 3', 'KLASTER 4', 'LABORATORIUM', 'FARMASI']);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    officeLat: 0,
    officeLng: 0,
    radius: 100,
    startTime: '07:00',
    lateTime: '08:00',
    enabledDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    locations: [] as any[],
    shifts: [
      { name: 'Pagi', startTime: '07:30', endTime: '13:30' },
      { name: 'Sore', startTime: '13:30', endTime: '19:30' },
      { name: 'Malam', startTime: '19:30', endTime: '07:30' },
    ],
    event: {
      isActive: false,
      name: '',
      startDate: '',
      endDate: '',
      startTime: '08:00',
      endTime: '17:00',
      lat: 0,
      lng: 0,
      radius: 100,
      assignedUserIds: [] as string[],
    } as any
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [eventSearchTerm, setEventSearchTerm] = useState('');
  const [eventEmployeeSearch, setEventEmployeeSearch] = useState('');
  const [eventBidangFilter, setEventBidangFilter] = useState('ALL');
  const [eventTabSubView, setEventTabSubView] = useState<'config' | 'logs' | 'assigned'>('config');
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [leaveEmployeeSearchTerm, setLeaveEmployeeSearchTerm] = useState('');
  const [dailySearchTerm, setDailySearchTerm] = useState('');
  const [dailyStatusFilter, setDailyStatusFilter] = useState('all');

  const [reportType, setReportType] = useState<'harian' | 'bulanan'>('harian');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [reportDate, setReportDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportMonth, setReportMonth] = useState(format(new Date(), 'yyyy-MM'));

  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayDesc, setNewHolidayDesc] = useState('');

  // Leave management state
  const [leaveForm, setLeaveForm] = useState({
    employeeId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    leaveType: 'I',
    reason: ''
  });
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);

  // Employee management state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ name: '', email: '', role: 'staff', nip: '', bidang: 'RAWAT INAP' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [employeeImportProgress, setEmployeeImportProgress] = useState(0);
  const [employeeImportTotal, setEmployeeImportTotal] = useState(0);

  // Edit employee state
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUpdatingEmployee, setIsUpdatingEmployee] = useState(false);

  // Delete employee state
  const [deletingEmployee, setDeletingEmployee] = useState<any | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeletingEmployee, setIsDeletingEmployee] = useState(false);

  // Reset device state
  const [resettingEmployee, setResettingEmployee] = useState<any | null>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Database flush state
  const [isClearLogsDialogOpen, setIsClearLogsDialogOpen] = useState(false);
  const [isClearingLogs, setIsClearingLogs] = useState(false);
  const [isClearMonthLogsDialogOpen, setIsClearMonthLogsDialogOpen] = useState(false);
  const [isClearingMonthLogs, setIsClearingMonthLogs] = useState(false);
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [newDepartment, setNewDepartment] = useState('');
  const [isAddingDepartment, setIsAddingDepartment] = useState(false);

  // Roster management state
  const [rosters, setRosters] = useState<any[]>([]);
  const [rosterMonth, setRosterMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [isImportingRoster, setIsImportingRoster] = useState(false);
  const [rosterImportProgress, setRosterImportProgress] = useState(0);
  const [rosterImportTotal, setRosterImportTotal] = useState(0);
  const [isClearingData, setIsClearingData] = useState(false);
  const [isImportingHistory, setIsImportingHistory] = useState(false);
  const [historyImportProgress, setHistoryImportProgress] = useState(0);
  const [historyImportTotal, setHistoryImportTotal] = useState(0);
  const [historyImportMonth, setHistoryImportMonth] = useState(format(new Date(), 'yyyy-MM'));
  const historyFileRef = useRef<HTMLInputElement>(null);
  const rosterFileRef = useRef<HTMLInputElement>(null);

  // Helper function for downloading Excel files with correct filename
  const downloadExcelFile = (wb: XLSX.WorkBook, filename: string) => {
    // Gunakan Data URI secara langsung untuk kompatibilitas maksimal dengan WebView (misal: Kodular)
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    const url = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + wbout;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Pending and historic leaves state
  const [leaves, setLeaves] = useState<any[]>([]);

  // Trigger fetchLogs setiap kali reportMonth berubah
  useEffect(() => {
    fetchLogs(reportMonth);
  }, [reportMonth]);

  // Update reportMonth secara otomatis jika user mengganti reportDate ke bulan yang berbeda
  useEffect(() => {
    const newMonth = reportDate.substring(0, 7);
    if (newMonth !== reportMonth) {
      setReportMonth(newMonth); // Ini otomatis memanggil fetchLogs untuk bulan tersebut
    }
  }, [reportDate]);

  useEffect(() => {
    fetchEmployees();
    fetchSettings();
    fetchDepartments();
    fetchRosters(rosterMonth);

    // Realtime Leaves Sync (manually sorted in memory)
    const unsubscribeLeaves = onSnapshot(collection(db, 'leaves'), (snap) => {
      const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetched.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return timeB - timeA;
      });
      setLeaves(fetched);
    }, (err) => {
      console.error("Leaves Sync Error:", err);
    });

    return () => {
      unsubscribeLeaves();
    };
  }, []);

  const fetchLogs = async (monthStr: string) => {
    setLoading(true);
    try {
      // Paginasi & Filter Bulan: Hanya ambil data untuk bulan yang dipilih agar irit kuota Reads
      const q = query(
        collection(db, 'attendance'),
        where('month', '==', monthStr)
      );
      const snap = await getDocs(q);
      let fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Filter out super admins
      fetched = fetched.filter((log: any) => log.userEmail !== 'aliefneutron@gmail.com' && log.userEmail !== 'aliefcorp.app@gmail.com');

      // Sort manually to avoid index requirement
      fetched.sort((a: any, b: any) => {
        const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp || 0).getTime();
        const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp || 0).getTime();
        return timeB - timeA;
      });

      setLogs(fetched);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRosters = async (monthStr: string) => {
    try {
      const q = query(collection(db, 'rosters'), where('date', '>=', `${monthStr}-01`), where('date', '<=', `${monthStr}-31`));
      const snap = await getDocs(q);
      setRosters(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error("Fetch Rosters Error:", err);
    }
  };

  const updateRoster = async (employeeId: string, date: string, shiftName: string) => {
    try {
      const docId = `${employeeId}_${date}`;
      const emp = employees.find(e => e.id === employeeId || e.uid === employeeId);
      if (!emp) return;

      if (shiftName === 'OFF' || shiftName === '') {
        await deleteDoc(doc(db, 'rosters', docId));
        setRosters(prev => prev.filter(r => r.id !== docId));
      } else {
        const data = {
          userId: employeeId,
          userName: emp.displayName || emp.name,
          bidang: emp.bidang || '-',
          date: date,
          shiftName: shiftName,
          updatedAt: serverTimestamp()
        };
        await setDoc(doc(db, 'rosters', docId), data);
        setRosters(prev => {
          const filtered = prev.filter(r => r.id !== docId);
          return [...filtered, { id: docId, ...data }];
        });
      }
      toast.success('Jadwal diperbarui');
    } catch (err) {
      toast.error('Gagal memperbarui jadwal');
    }
  };

  const importRosterExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingRoster(true);
    setRosterImportProgress(0);
    setRosterImportTotal(0);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];

        // Peek at data to decide format
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        if (rows.length < 2) throw new Error("File kosong");

        let count = 0;

        // Detect Grid Format:
        // - Row 2 has 'email'/'nama' in col 0, and '1' in col 1 or 2
        const row2 = rows[1] || [];
        const col0 = row2[0]?.toString().toLowerCase().trim();
        const isNameFormat = col0 === 'nama'; // new format with nama+bidang
        const isEmailFormat = col0 === 'email'; // old format with email
        const isGridFormat = (isNameFormat || isEmailFormat) && (row2[1]?.toString() === '1' || row2[2]?.toString() === '1');

        if (isGridFormat) {
          const monthStr = rosterMonth; // e.g., "2026-05"
          if (!monthStr) {
            toast.error("Pilih bulan di aplikasi terlebih dahulu agar sistem tahu bulan apa yang diimpor");
            return;
          }

          // Determine data column offset: nama format has bidang in col1, data starts col2
          const dataOffset = isNameFormat ? 2 : 1;
          const totalRowsToProcess = rows.length - 2;
          setRosterImportTotal(totalRowsToProcess);

          for (let i = 2; i < rows.length; i++) {
            if (i % 5 === 0) {
              setRosterImportProgress(i - 2);
              await new Promise(resolve => setTimeout(resolve, 0));
            }

            const row = rows[i];
            const identifier = row[0]?.toString().trim();
            if (!identifier) continue;

            // Skip bidang header rows (rows starting with '---')
            if (identifier.startsWith('---')) continue;

            // Find employee by name (case-insensitive) or email
            const identifierLower = identifier.toLowerCase();
            const emp = employees.find(e => {
              if (isEmailFormat) {
                return e.email?.toLowerCase() === identifierLower;
              } else {
                // Match by name (displayName or name), trim and case-insensitive
                const empName = (e.displayName || e.name || '').toLowerCase().trim();
                return empName === identifierLower;
              }
            });
            if (!emp) continue;

            // Iterate days 1-31
            for (let day = 1; day <= 31; day++) {
              const code = row[dataOffset - 1 + day]?.toString().toUpperCase();
              if (!code) continue;

              let shiftName = '';
              if (code === 'P') shiftName = 'Pagi';
              else if (code === 'S') shiftName = 'Sore';
              else if (code === 'M') shiftName = 'Malam';
              else if (code === 'L') shiftName = 'Libur';
              else if (code === 'OFF') shiftName = 'OFF';

              if (shiftName) {
                const dateStr = `${monthStr}-${day.toString().padStart(2, '0')}`;
                // Check if day is valid for this month
                try {
                  const dateObj = parse(dateStr, 'yyyy-MM-dd', new Date());
                  if (format(dateObj, 'yyyy-MM') === monthStr) {
                    const docId = `${emp.id || emp.uid}_${dateStr}`;
                    await setDoc(doc(db, 'rosters', docId), {
                      userId: emp.id || emp.uid,
                      userName: emp.displayName || emp.name,
                      bidang: emp.bidang || '-',
                      date: dateStr,
                      shiftName: shiftName,
                      updatedAt: serverTimestamp()
                    });
                    count++;
                  }
                } catch (e) { }
              }
            }
          }
          setRosterImportProgress(totalRowsToProcess);
        } else {
          // Fallback to Vertical Format
          const data = XLSX.utils.sheet_to_json(ws) as any[];
          setRosterImportTotal(data.length);
          for (let i = 0; i < data.length; i++) {
            if (i % 10 === 0) {
              setRosterImportProgress(i);
              await new Promise(resolve => setTimeout(resolve, 0));
            }
            const item = data[i];
            const email = (item.email || item.Email || '').toLowerCase().trim();
            let rawDate = item.tanggal || item.Tanggal || item.date || item.Date;
            const shift = item.shift || item.Shift || 'OFF';

            if (email && rawDate) {
              let normalizedDate = '';
              if (rawDate instanceof Date) {
                normalizedDate = format(rawDate, 'yyyy-MM-dd');
              } else if (typeof rawDate === 'string') {
                if (rawDate.includes('-')) {
                  const parts = rawDate.split('-');
                  if (parts[0].length === 2) {
                    try {
                      const parsed = parse(rawDate, 'dd-MM-yyyy', new Date());
                      normalizedDate = format(parsed, 'yyyy-MM-dd');
                    } catch (e) { normalizedDate = rawDate; }
                  } else {
                    normalizedDate = rawDate;
                  }
                } else {
                  normalizedDate = rawDate;
                }
              }

              const emp = employees.find(e => e.email?.toLowerCase() === email);
              if (emp && normalizedDate) {
                const docId = `${emp.id || emp.uid}_${normalizedDate}`;
                await setDoc(doc(db, 'rosters', docId), {
                  userId: emp.id || emp.uid,
                  userName: emp.displayName || emp.name,
                  bidang: emp.bidang || '-',
                  date: normalizedDate,
                  shiftName: shift,
                  updatedAt: serverTimestamp()
                });
                count++;
              }
            }
          }
          setRosterImportProgress(data.length);
        }

        toast.success(`${count} jadwal berhasil diimpor`);
        fetchRosters(rosterMonth);
      } catch (err) {
        console.error(err);
        toast.error('Gagal impor jadwal. Pastikan format sesuai.');
      } finally {
        setIsImportingRoster(false);
        setRosterImportProgress(0);
        setRosterImportTotal(0);
        if (rosterFileRef.current) rosterFileRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadJadwalTemplate = () => {
    try {
      const baseDate = parse(rosterMonth || format(new Date(), 'yyyy-MM'), 'yyyy-MM', new Date());
      const monthName = format(baseDate, 'MMMM yyyy', { locale: id }).toUpperCase();

      // Header Row 2: nama, bidang, 1, 2, 3...
      const headers = ['nama', 'bidang'];
      for (let i = 1; i <= 31; i++) headers.push(i.toString());

      // Group employees by bidang
      const bidangMap = new Map<string, any[]>();
      approvedEmployees.forEach(emp => {
        const bidang = (emp.bidang || 'LAINNYA').toUpperCase();
        if (!bidangMap.has(bidang)) bidangMap.set(bidang, []);
        bidangMap.get(bidang)!.push(emp);
      });

      const rows: any[][] = [];

      if (bidangMap.size === 0) {
        // Placeholder row jika tidak ada pegawai
        const placeholder = ['Contoh Nama', 'BIDANG'];
        for (let i = 1; i <= 31; i++) placeholder.push('');
        rows.push(placeholder);
      } else {
        for (const [bidang, emps] of bidangMap.entries()) {
          // Baris header bidang sebagai separator
          const bidangHeader = [`--- ${bidang} ---`, ''];
          for (let i = 1; i <= 31; i++) bidangHeader.push('');
          rows.push(bidangHeader);

          // Baris setiap pegawai dalam bidang ini
          emps.forEach(emp => {
            const row = [emp.displayName || emp.name || '', bidang];
            for (let i = 1; i <= 31; i++) row.push('');
            rows.push(row);
          });
        }
      }

      const data = [
        [monthName], // Row 1: nama bulan
        headers,      // Row 2: header kolom
        ...rows
      ];

      const ws = XLSX.utils.aoa_to_sheet(data);

      // Styling: lebarkan kolom nama dan bidang
      ws['!cols'] = [
        { wch: 28 }, // nama
        { wch: 16 }, // bidang
        ...Array(31).fill({ wch: 5 }), // hari 1-31
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Jadwal');
      downloadExcelFile(wb, `Template_Jadwal_${rosterMonth || format(new Date(), 'yyyy-MM')}.xlsx`);
    } catch (err) {
      console.error("Template Error:", err);
      toast.error("Gagal mengunduh template. Pastikan bulan sudah dipilih.");
    }
  };

  const fetchEmployees = async () => {
    try {
      // First try with ordering (requires index)
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Filter out super admin only (by role 'superadmin', specific emails, or specific name)
      // while keeping regular 'admin' role in the roster
      data = data.filter((emp: any) => {
        const isSuperAdminRole = emp.role === 'superadmin';
        const isSuperAdminEmail = emp.email === 'aliefneutron@gmail.com' || emp.email === 'aliefcorp.app@gmail.com';
        const isSuperAdminName = (emp.name || '').toUpperCase() === 'ALIEF NEUTRON' || (emp.displayName || '').toUpperCase() === 'ALIEF NEUTRON';
        return !isSuperAdminRole && !isSuperAdminEmail && !isSuperAdminName;
      });

      setEmployees(data);
    } catch (err: any) {
      console.error("Fetch Employees (ordered) failed:", err);
      // Fallback: try without ordering if index is missing
      try {
        const qSimple = query(collection(db, 'users'));
        const snapSimple = await getDocs(qSimple);
        let data = snapSimple.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        data = data.filter((emp: any) => {
          const isSuperAdminRole = emp.role === 'superadmin';
          const isSuperAdminEmail = emp.email === 'aliefneutron@gmail.com' || emp.email === 'aliefcorp.app@gmail.com';
          const isSuperAdminName = (emp.name || '').toUpperCase() === 'ALIEF NEUTRON' || (emp.displayName || '').toUpperCase() === 'ALIEF NEUTRON';
          return !isSuperAdminRole && !isSuperAdminEmail && !isSuperAdminName;
        });

        setEmployees(data);
      } catch (err2: any) {
        console.error("Fetch Employees (simple) failed:", err2);
        toast.error('Gagal mengambil data pegawai. Cek koneksi atau izin database.');
      }
    }
  };

  const fetchDepartments = async () => {
    try {
      const docRef = doc(db, 'settings', 'departments');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const list = docSnap.data().list || [];
        setDepartments(list);
        // Sync newEmployee.bidang agar cocok dengan pilihan pertama yang ditampilkan di select
        if (list.length > 0) {
          setNewEmployee(prev => ({ ...prev, bidang: list[0] }));
        }
      } else {
        // Initialize with defaults if not exists
        const defaults = ['RAWAT INAP', 'UGD', 'KLASTER 1', 'KLASTER 2', 'KLASTER 3', 'KLASTER 4', 'LABORATORIUM', 'FARMASI'];
        await setDoc(docRef, { list: defaults });
        setDepartments(defaults);
        setNewEmployee(prev => ({ ...prev, bidang: defaults[0] }));
      }
    } catch (err) {
      console.error("Fetch Departments Error:", err);
    }
  };

  const addDepartment = async () => {
    if (!newDepartment.trim()) return;
    if (departments.includes(newDepartment.trim().toUpperCase())) {
      toast.error('Bidang sudah ada');
      return;
    }

    setIsAddingDepartment(true);
    try {
      const updated = [...departments, newDepartment.trim().toUpperCase()];
      await setDoc(doc(db, 'settings', 'departments'), { list: updated });
      setDepartments(updated);
      setNewDepartment('');
      toast.success('Bidang berhasil ditambahkan');
    } catch (err: any) {
      console.error("Add Department Error:", err);
      toast.error(`Gagal menambahkan bidang: ${err.message || 'Izin ditolak'}`);
    } finally {
      setIsAddingDepartment(false);
    }
  };

  const removeDepartment = async (dept: string) => {
    try {
      const updated = departments.filter(d => d !== dept);
      await setDoc(doc(db, 'settings', 'departments'), { list: updated });
      setDepartments(updated);
      toast.success('Bidang berhasil dihapus');
    } catch (err: any) {
      console.error("Remove Department Error:", err);
      toast.error(`Gagal menghapus bidang: ${err.message || 'Izin ditolak'}`);
    }
  };

  const manualAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployee.name || !newEmployee.email) {
      toast.error('Nama dan Email wajib diisi');
      return;
    }

    setIsAddingEmployee(true);
    const toastId = toast.loading('Menambahkan/Memperbarui pegawai...');
    try {
      const emailLower = newEmployee.email.toLowerCase().trim();

      // Check if exists
      const q = query(collection(db, 'users'), where('email', '==', emailLower));
      const snap = await getDocs(q);

      if (!snap.empty) {
        // Sort docs: prioritize real UID docs (not pre_/import_ prefixed) and ones with deviceId
        const sortedDocs = [...snap.docs].sort((a, b) => {
          const score = (d: any) => {
            const data = d.data();
            let s = 0;
            if (!d.id.startsWith('pre_') && !d.id.startsWith('import_')) s += 10; // real UID
            if (data.deviceId) s += 5;
            if (data.uid) s += 3;
            if (data.nip) s += 2;
            return s;
          };
          return score(b) - score(a);
        });

        // Update only the best (primary) document
        const primaryDoc = sortedDocs[0];
        await updateDoc(doc(db, 'users', primaryDoc.id), {
          displayName: newEmployee.name,
          name: newEmployee.name,
          nip: newEmployee.nip,
          bidang: newEmployee.bidang,
          role: newEmployee.role,
          status: 'approved',
          email: emailLower,
          updatedAt: serverTimestamp()
        });

        // Delete all duplicate (non-primary) documents
        const duplicates = sortedDocs.slice(1);
        if (duplicates.length > 0) {
          const deletePromises = duplicates.map(d =>
            deleteDoc(doc(db, 'users', d.id)).catch(err => console.warn('Could not delete duplicate:', d.id, err))
          );
          await Promise.all(deletePromises);
          toast.success(`Data pegawai diperbarui & ${duplicates.length} duplikat dihapus`, { id: toastId });
        } else {
          toast.success('Data pegawai diperbarui', { id: toastId });
        }
      } else {
        // Create new pre-registered entry
        const id = `pre_${Date.now()}`;
        await setDoc(doc(db, 'users', id), {
          ...newEmployee,
          email: emailLower,
          displayName: newEmployee.name,
          name: newEmployee.name,
          status: 'approved',
          createdAt: serverTimestamp(),
        });
        toast.success('Pegawai berhasil ditambahkan', { id: toastId });
      }

      setNewEmployee({ name: '', email: '', role: 'staff', nip: '', bidang: departments[0] || 'RAWAT INAP' });
      setShowAddForm(false);
      await fetchEmployees();
    } catch (err: any) {
      console.error("Manual Add Error:", err);
      toast.error(`Gagal: ${err.message || 'Izin ditolak'}`, { id: toastId });
    } finally {
      setIsAddingEmployee(false);
    }
  };

  const handleDeduplicate = async () => {
    setIsDeduplicating(true);
    const toastId = toast.loading('Membersihkan data ganda...');
    try {
      const q = query(collection(db, 'users'));
      const snap = await getDocs(q);
      const allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

      const emailMap = new Map<string, any[]>();
      allUsers.forEach(u => {
        const email = u.email?.toLowerCase().trim();
        if (!email) return;
        if (!emailMap.has(email)) emailMap.set(email, []);
        emailMap.get(email)!.push(u);
      });

      let deleteCount = 0;
      let mergeCount = 0;
      for (const [, users] of emailMap.entries()) {
        if (users.length > 1) {
          // Prioritas: real UID > punya deviceId (tersinkron perangkat) > punya nip > punya bidang
          users.sort((a, b) => {
            const score = (u: any) => {
              let s = 0;
              if (!u.id.startsWith('pre_') && !u.id.startsWith('import_')) s += 20; // real UID
              if (u.deviceId) s += 10; // sudah tersinkron perangkat - PRIORITAS TINGGI
              if (u.nip) s += 5;
              if (u.bidang) s += 3;
              if (u.uid) s += 2;
              if (u.createdAt?.toDate) s += 1;
              return s;
            };
            return score(b) - score(a);
          });

          // Pemenang = doc teratas (real UID + punya deviceId = score tertinggi)
          const winner = users[0];
          const losers = users.slice(1);

          // MERGE dulu: salin field yang kosong di winner dari loser sebelum hapus
          // Ini memastikan data nip/bidang/status dari pre-registrasi tidak hilang
          const mergedFields: any = {};
          for (const loser of losers) {
            if (!winner.nip && loser.nip) mergedFields.nip = loser.nip;
            if (!winner.bidang && loser.bidang) mergedFields.bidang = loser.bidang;
            if (!winner.displayName && loser.displayName) mergedFields.displayName = loser.displayName;
            if (!winner.name && loser.name) mergedFields.name = loser.name;
            if (!winner.role && loser.role) mergedFields.role = loser.role;
            // Jika winner masih pending tapi loser sudah approved → ambil approved
            if (winner.status === 'pending' && loser.status === 'approved') {
              mergedFields.status = 'approved';
            }
          }

          if (Object.keys(mergedFields).length > 0) {
            await updateDoc(doc(db, 'users', winner.id), mergedFields).catch(err =>
              console.warn('Could not merge fields:', winner.id, err)
            );
            mergeCount++;
          }

          // Baru hapus loser setelah data sudah aman di-merge ke winner
          for (const loser of losers) {
            await deleteDoc(doc(db, 'users', loser.id)).catch(err =>
              console.warn('Could not delete:', loser.id, err)
            );
            deleteCount++;
          }
        }
      }

      toast.success(`Berhasil membersihkan ${deleteCount} data ganda.`, { id: toastId });
      fetchEmployees();
    } catch (err: any) {
      console.error("Deduplicate Error:", err);
      toast.error("Gagal membersihkan data.", { id: toastId });
    } finally {
      setIsDeduplicating(false);
    }
  };

  const submitLeaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveForm.employeeId || !leaveForm.date || !leaveForm.leaveType) {
      toast.error('Mohon lengkapi data izin');
      return;
    }
    const emp = employees.find(e => e.id === leaveForm.employeeId || e.uid === leaveForm.employeeId);
    if (!emp) return;

    setIsSubmittingLeave(true);
    try {
      const recordId = `${emp.id || emp.uid}_${leaveForm.date}`;
      const record = {
        userId: emp.id || emp.uid,
        userName: emp.displayName || emp.name || emp.email?.split('@')[0] || 'Unknown',
        userEmail: emp.email,
        timestamp: serverTimestamp(),
        date: leaveForm.date,
        month: leaveForm.date.substring(0, 7),
        isLeave: true,
        leaveType: leaveForm.leaveType,
        leaveReason: leaveForm.reason
      };

      await setDoc(doc(db, 'attendance', recordId), record);
      toast.success(`Status ${leaveForm.leaveType} berhasil disimpan untuk ${record.userName}`);
      setLeaveForm({ ...leaveForm, employeeId: '', reason: '' });
      fetchLogs(reportMonth);
    } catch (err) {
      console.error(err);
      toast.error('Gagal menyimpan data izin');
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const handleApproveLeave = async (leaveReq: any) => {
    const toastId = toast.loading(`Menyetujui izin ${leaveReq.userName}...`);
    try {
      // 1. Generate dates between startDate and endDate
      const days = eachDayOfInterval({
        start: parse(leaveReq.startDate, 'yyyy-MM-dd', new Date()),
        end: parse(leaveReq.endDate, 'yyyy-MM-dd', new Date())
      });

      // 2. Write attendance records for each date
      for (const day of days) {
        const dateStr = format(day, 'yyyy-MM-dd');
        const recordId = `${leaveReq.userId}_${dateStr}`;
        const record = {
          userId: leaveReq.userId,
          userName: leaveReq.userName,
          userEmail: leaveReq.userEmail || '',
          timestamp: serverTimestamp(),
          date: dateStr,
          month: dateStr.substring(0, 7),
          isLeave: true,
          leaveType: leaveReq.leaveType,
          leaveReason: leaveReq.reason
        };
        await setDoc(doc(db, 'attendance', recordId), record);
      }

      // 3. Update the leave request status in 'leaves' collection
      await updateDoc(doc(db, 'leaves', leaveReq.id), {
        status: 'APPROVED',
        approvedAt: serverTimestamp(),
        approvedBy: 'Admin'
      });

      toast.success(`Izin ${leaveReq.userName} berhasil disetujui`, { id: toastId });
      fetchLogs(reportMonth); // Refresh reports to show leave immediately
    } catch (err: any) {
      console.error("Approve Leave Error:", err);
      toast.error(`Gagal menyetujui izin: ${err.message || err.toString()}`, { id: toastId });
    }
  };

  const handleRejectLeave = async (leaveReq: any) => {
    const toastId = toast.loading(`Menolak izin ${leaveReq.userName}...`);
    try {
      await updateDoc(doc(db, 'leaves', leaveReq.id), {
        status: 'REJECTED',
        rejectedAt: serverTimestamp(),
        rejectedBy: 'Admin'
      });
      toast.success(`Izin ${leaveReq.userName} ditolak`, { id: toastId });
    } catch (err: any) {
      console.error("Reject Leave Error:", err);
      toast.error(`Gagal menolak izin: ${err.message || err.toString()}`, { id: toastId });
    }
  };

  const confirmResetDevice = (emp: any) => {
    setResettingEmployee({
      id: emp.id || emp.uid,
      name: emp.displayName || emp.name || 'Pegawai'
    });
    setIsResetDialogOpen(true);
  };

  const handleResetDevice = async () => {
    if (!resettingEmployee) return;

    setIsResetting(true);
    try {
      await updateDoc(doc(db, 'users', resettingEmployee.id), {
        deviceId: deleteField()
      });
      toast.success('Kunci perangkat berhasil direset');
      setIsResetDialogOpen(false);
      fetchEmployees();
    } catch (err) {
      console.error('Reset Device Error:', err);
      toast.error('Gagal mereset perangkat');
    } finally {
      setIsResetting(false);
    }
  };

  const startEditEmployee = (emp: any) => {
    const empBidang = emp.bidang || '';
    // Normalisasi: pastikan bidang yang ada di state cocok dengan salah satu entry di departments
    // Jika bidang kosong atau tidak ditemukan, gunakan departments[0] agar tampilan select selalu sinkron
    const normalizedBidang = departments.find(d => d === empBidang) || empBidang || departments[0] || '';
    setEditingEmployee({
      id: emp.id || emp.uid,
      displayName: emp.displayName || emp.name || '',
      nip: emp.nip || '',
      bidang: normalizedBidang,
      role: emp.role || 'staff'
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateEmployee = async () => {
    if (!editingEmployee) return;
    setIsUpdatingEmployee(true);
    try {
      await updateDoc(doc(db, 'users', editingEmployee.id), {
        displayName: editingEmployee.displayName,
        nip: editingEmployee.nip,
        bidang: editingEmployee.bidang,
        role: editingEmployee.role,
        updatedAt: serverTimestamp()
      });
      toast.success('Profil pegawai diperbarui');
      setIsEditDialogOpen(false);
      fetchEmployees();
    } catch (err) {
      console.error('Update Employee Error:', err);
      toast.error('Gagal memperbarui pegawai');
    } finally {
      setIsUpdatingEmployee(false);
    }
  };

  const confirmDeleteEmployee = (emp: any) => {
    setDeletingEmployee({
      id: emp.id || emp.uid,
      name: emp.displayName || emp.name || 'Pegawai'
    });
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteEmployee = async () => {
    if (!deletingEmployee) return;

    setIsDeletingEmployee(true);
    try {
      await deleteDoc(doc(db, 'users', deletingEmployee.id));
      toast.success('Pegawai berhasil dihapus');
      setIsDeleteDialogOpen(false);
      fetchEmployees();
    } catch (err) {
      console.error('Delete Employee Error:', err);
      toast.error('Gagal menghapus pegawai');
    } finally {
      setIsDeletingEmployee(false);
    }
  };

  const handleApproveUser = async (userId: string) => {
    const toastId = toast.loading('Menyetujui pendaftaran user...');
    try {
      await updateDoc(doc(db, 'users', userId), {
        status: 'approved',
        updatedAt: serverTimestamp()
      });
      toast.success('Pendaftaran user berhasil disetujui!', { id: toastId });
      await fetchEmployees();
    } catch (err: any) {
      console.error("Approve user error:", err);
      toast.error(`Gagal menyetujui: ${err.message}`, { id: toastId });
    }
  };

  const handleRejectUser = async (userId: string) => {
    const toastId = toast.loading('Menolak pendaftaran user...');
    try {
      await updateDoc(doc(db, 'users', userId), {
        status: 'rejected',
        updatedAt: serverTimestamp()
      });
      toast.success('Pendaftaran user ditolak.', { id: toastId });
      await fetchEmployees();
    } catch (err: any) {
      console.error("Reject user error:", err);
      toast.error(`Gagal menolak: ${err.message}`, { id: toastId });
    }
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setEmployeeImportProgress(0);
    setEmployeeImportTotal(0);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        let count = 0;
        setEmployeeImportTotal(data.length);
        for (let i = 0; i < data.length; i++) {
          if (i % 5 === 0) {
            setEmployeeImportProgress(i);
            await new Promise(resolve => setTimeout(resolve, 0));
          }
          const item = data[i];
          const email = item.email || item.Email || item.EMAIL || item['Email'] || item['email'] || '';
          const name = item['nama lengkap'] || item['Nama Lengkap'] || item['NAMA LENGKAP'] || item.nama || item.Nama || item.NAMA || item.name || item.Name || item.NAME || '';
          const nip = item['ID Pegawai'] || item['id pegawai'] || item['ID PEGAWAI'] || item['Id Pegawai'] || item['id_pegawai'] || item.nip || item.Nip || item.NIP || '';
          const bidang = item.bidang || item.Bidang || item.BIDANG || '';
          const role = (item.role || item.Role || item.ROLE || 'staff').toLowerCase();

          if (email && name) {
            const emailLower = email.toLowerCase().trim();

            // Check if exists
            const q = query(collection(db, 'users'), where('email', '==', emailLower));
            const snap = await getDocs(q);

            if (!snap.empty) {
              // Update all existing matching documents
              const updatePromises = snap.docs.map(existingDoc =>
                updateDoc(doc(db, 'users', existingDoc.id), {
                  displayName: name,
                  name: name,
                  nip: nip.toString().trim(),
                  bidang: bidang.toString().trim(),
                  role: role === 'admin' ? 'admin' : 'staff',
                  status: 'approved',
                  updatedAt: serverTimestamp()
                })
              );
              await Promise.all(updatePromises);
            } else {
              // Create new
              const id = `import_${Date.now()}_${count}`;
              await setDoc(doc(db, 'users', id), {
                email: emailLower,
                displayName: name,
                name: name,
                nip: nip.toString().trim(),
                bidang: bidang.toString().trim(),
                role: role === 'admin' ? 'admin' : 'staff',
                status: 'approved',
                createdAt: serverTimestamp(),
              });
            }
            count++;
          }
        }

        setEmployeeImportProgress(data.length);
        toast.success(`${count} pegawai berhasil diproses (tambah/update)`);
        fetchEmployees();
      } catch (err) {
        toast.error('Gagal mengimpor file Excel');
        console.error(err);
      } finally {
        setIsImporting(false);
        setEmployeeImportProgress(0);
        setEmployeeImportTotal(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadHistoryTemplate = () => {
    try {
      if (!historyImportMonth) {
        toast.error("Pilih bulan terlebih dahulu");
        return;
      }
      const dateObj = parse(historyImportMonth, 'yyyy-MM', new Date());
      const monthName = format(dateObj, 'MMMM yyyy', { locale: id }).toUpperCase();

      const headers = ['NAMA', 'BIDANG'];
      for (let i = 1; i <= 31; i++) headers.push(i.toString());

      // Group employees by bidang
      const bidangMap = new Map<string, any[]>();
      employees.forEach(emp => {
        const bidang = (emp.bidang || 'LAINNYA').toUpperCase();
        if (!bidangMap.has(bidang)) bidangMap.set(bidang, []);
        bidangMap.get(bidang)!.push(emp);
      });

      const rows: any[][] = [];

      if (bidangMap.size === 0) {
        const placeholder = ['Contoh Nama', 'BIDANG'];
        for (let i = 1; i <= 31; i++) placeholder.push('');
        rows.push(placeholder);
      } else {
        for (const [bidang, emps] of bidangMap.entries()) {
          const bidangHeader = [`--- ${bidang} ---`, ''];
          for (let i = 1; i <= 31; i++) bidangHeader.push('');
          rows.push(bidangHeader);

          emps.forEach(emp => {
            const row = [emp.displayName || emp.name || '', bidang];
            for (let i = 1; i <= 31; i++) row.push('');
            rows.push(row);
          });
        }
      }

      const data = [
        [monthName], // Row 1: nama bulan
        headers,      // Row 2: header kolom
        ...rows
      ];

      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [
        { wch: 28 }, // nama
        { wch: 16 }, // bidang
        ...Array(31).fill({ wch: 5 }), // hari 1-31
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template_Riwayat_Absen');
      downloadExcelFile(wb, `Template_Impor_Riwayat_Absen_${historyImportMonth}.xlsx`);
    } catch (err) {
      console.error("Template Error:", err);
      toast.error("Gagal mengunduh template.");
    }
  };

  const importHistoryExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingHistory(true);
    setHistoryImportProgress(0);
    setHistoryImportTotal(0);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];

        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        if (rows.length < 2) throw new Error("File kosong");

        let successCount = 0;
        let errorCount = 0;

        const row2 = rows[1] || [];
        const col0 = row2[0]?.toString().toLowerCase().trim();
        const isNameFormat = col0 === 'nama';
        const isEmailFormat = col0 === 'email';
        const isGridFormat = (isNameFormat || isEmailFormat) && (row2[1]?.toString() === '1' || row2[2]?.toString() === '1');

        if (!isGridFormat) {
          throw new Error("Format file tidak dikenali. Pastikan menggunakan template grid yang diunduh.");
        }

        const monthStr = historyImportMonth;
        if (!monthStr) {
          throw new Error("Pilih bulan di aplikasi terlebih dahulu.");
        }

        const dataOffset = isNameFormat ? 2 : 1;
        const totalRowsToProcess = rows.length - 2;
        setHistoryImportTotal(totalRowsToProcess);

        for (let i = 2; i < rows.length; i++) {
          // Update progress and yield to event loop every 5 rows to keep UI responsive
          if (i % 5 === 0) {
            setHistoryImportProgress(i - 2);
            await new Promise(resolve => setTimeout(resolve, 0));
          }

          const row = rows[i];
          const identifier = row[0]?.toString().trim();
          if (!identifier || identifier.startsWith('---')) continue;

          const identifierLower = identifier.toLowerCase();
          const emp = employees.find(e => {
            if (isEmailFormat) {
              return e.email?.toLowerCase() === identifierLower;
            } else {
              const empName = (e.displayName || e.name || '').toLowerCase().trim();
              return empName === identifierLower;
            }
          });
          if (!emp) {
            errorCount++;
            continue;
          }

          let alfaCount = 0;

          for (let day = 1; day <= 31; day++) {
            const code = row[dataOffset - 1 + day]?.toString().toUpperCase();
            if (!code) continue;

            let shiftName = '';
            if (code === 'P') shiftName = 'Pagi';
            else if (code === 'S') shiftName = 'Sore';
            else if (code === 'M') shiftName = 'Malam';
            else if (code === 'L') shiftName = 'Libur';
            else if (code === 'OFF') shiftName = 'OFF';
            else continue; // Abaikan kode yang tidak dikenal

            const dateStr = `${monthStr}-${day.toString().padStart(2, '0')}`;

            // 1. Simpan ke koleksi rosters (agar sistem tahu jadwalnya, termasuk L dan OFF)
            const rosterId = `${emp.uid || emp.id}_${dateStr}`;
            const rosterRecord = {
              userId: emp.uid || emp.id,
              userName: emp.displayName || emp.name || 'Unknown',
              userEmail: emp.email,
              date: dateStr,
              month: monthStr,
              shiftName: shiftName,
              updatedAt: serverTimestamp()
            };
            await setDoc(doc(db, 'rosters', rosterId), rosterRecord);

            // 2. Buat log absen HANYA untuk P, S, M
            if (['Pagi', 'Sore', 'Malam'].includes(shiftName)) {
              const shiftObj = settings?.shifts?.find((s: any) => s.name === shiftName);
              if (shiftObj) {
                const rand = Math.random();
                let status = 'normal';
                if (rand > 0.85 && rand <= 0.92) status = 'late';
                else if (rand > 0.92 && rand <= 0.97) status = 'leave';
                else if (rand > 0.97) {
                  if (alfaCount < 2) {
                    status = 'alfa';
                    alfaCount++;
                  } else {
                    status = 'normal';
                  }
                }

                if (status === 'alfa') {
                  // Skip creating attendance log, roster is already created
                  continue;
                }

                const recordId = `${emp.uid || emp.id}_${dateStr}_${shiftName}`;

                let timestamp = new Date(`${dateStr}T${shiftObj.startTime}:00`);
                let checkOutTimestamp = new Date(`${dateStr}T${shiftObj.endTime}:00`);
                if (shiftObj.startTime > shiftObj.endTime) {
                  checkOutTimestamp.setDate(checkOutTimestamp.getDate() + 1);
                }

                let isLate = false;
                let isLeave = false;
                let leaveType = '';
                let lateDuration = 0;

                if (status === 'leave') {
                  isLeave = true;
                  leaveType = Math.random() > 0.5 ? 'I' : 'S';
                  // For leave, timestamp is just the start of the shift
                } else if (status === 'late') {
                  isLate = true;
                  // Late by 5 to 60 minutes
                  const lateMins = Math.floor(Math.random() * 55) + 5;
                  timestamp.setMinutes(timestamp.getMinutes() + lateMins);
                  lateDuration = lateMins * 60; // Convert to seconds

                  // Checkout is normal, maybe a bit late
                  checkOutTimestamp.setMinutes(checkOutTimestamp.getMinutes() + Math.floor(Math.random() * 30));
                } else {
                  // Normal: arrive 0 to 30 mins early
                  timestamp.setMinutes(timestamp.getMinutes() - Math.floor(Math.random() * 30));
                  // Checkout: leave 0 to 30 mins late
                  checkOutTimestamp.setMinutes(checkOutTimestamp.getMinutes() + Math.floor(Math.random() * 30));
                }

                const record: any = {
                  userId: emp.uid || emp.id,
                  userName: emp.displayName || emp.name || 'Unknown',
                  userEmail: emp.email,
                  timestamp: timestamp,
                  date: dateStr,
                  month: monthStr,
                  shiftName: shiftName,
                  location: { latitude: settings?.officeLat || -6.1751, longitude: settings?.officeLng || 106.8272 },
                  isWithinRange: true,
                  isLate: isLate,
                  lateDuration: lateDuration,
                  lateThreshold: shiftObj.startTime + ':00',
                  selfieUrl: null,
                  isLeave: isLeave,
                };

                if (isLeave) {
                  record.leaveType = leaveType;
                  record.leaveReason = 'Generated Dummy Data';
                } else {
                  record.checkOutTimestamp = checkOutTimestamp;
                  record.checkOutLocation = { latitude: settings?.officeLat || -6.1751, longitude: settings?.officeLng || 106.8272 };
                  record.isLateCheckOut = false;
                }

                await setDoc(doc(db, 'attendance', recordId), record);
                successCount++;
              }
            }
          }
        }

        setHistoryImportProgress(totalRowsToProcess);
        toast.success(`Impor selesai: ${successCount} data absen berhasil dibuat, ${errorCount} baris gagal/dilewati.`);
        fetchLogs(reportMonth);
      } catch (err: any) {
        console.error("Import History Error:", err);
        toast.error(`Gagal mengimpor: ${err.message}`);
      } finally {
        setIsImportingHistory(false);
        setHistoryImportProgress(0);
        setHistoryImportTotal(0);
        if (historyFileRef.current) historyFileRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const clearMonthData = async () => {
    if (!historyImportMonth) {
      toast.error("Pilih bulan terlebih dahulu");
      return;
    }
    if (!confirm(`Yakin ingin MENGHAPUS SEMUA data absen dan jadwal untuk bulan ${historyImportMonth}?`)) return;

    setIsClearingData(true);
    const toastId = toast.loading(`Menghapus data bulan ${historyImportMonth}...`);
    try {
      // Delete attendance
      const attQuery = query(collection(db, 'attendance'), where('month', '==', historyImportMonth));
      const attSnap = await getDocs(attQuery);

      // Delete rosters
      const rosterQuery = query(collection(db, 'rosters'), where('month', '==', historyImportMonth));
      const rosterSnap = await getDocs(rosterQuery);

      const allDocs = [...attSnap.docs.map(d => d.ref), ...rosterSnap.docs.map(d => d.ref)];

      // Process in batches of 500
      for (let i = 0; i < allDocs.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = allDocs.slice(i, i + 500);
        chunk.forEach(ref => batch.delete(ref));
        await batch.commit();
      }

      toast.success(`Berhasil menghapus ${attSnap.size} absen dan ${rosterSnap.size} jadwal.`, { id: toastId });
      fetchLogs(reportMonth);
    } catch (err) {
      console.error(err);
      toast.error("Gagal menghapus data", { id: toastId });
    } finally {
      setIsClearingData(false);
    }
  };

  const exportToExcel = () => {
    try {
      if (logs.length === 0 && employees.length === 0) {
        toast.error('Tidak ada data untuk diekspor');
        return;
      }

      const wb = XLSX.utils.book_new();

      // Sheet 1: Attendance Logs (Shift Regular)
      const regularLogs = logs.filter(l => !l.isEvent);
      if (regularLogs.length > 0) {
        const attendanceData = regularLogs.map(log => ({
          'Nama Pegawai': log.userName,
          'Email': log.userEmail,
          'Tanggal': log.date,
          'Shift': log.shiftName || '-',
          'Waktu (Masuk | Pulang)': `${log.timestamp?.toDate ? format(log.timestamp.toDate(), 'HH:mm:ss') : format(new Date(log.timestamp), 'HH:mm:ss')} | ${log.checkOutTimestamp ? (log.checkOutTimestamp?.toDate ? format(log.checkOutTimestamp.toDate(), 'HH:mm:ss') : format(new Date(log.checkOutTimestamp), 'HH:mm:ss')) : '--:--:--'}`,
          'Status': log.isLate ? 'TERLAMBAT' : 'ON-TIME',
          'Latitude': log.location?.latitude || 'N/A',
          'Longitude': log.location?.longitude || 'N/A',
          'Foto': log.selfieUrl?.startsWith('data:') ? 'BASE64_IMAGE_DATA' : log.selfieUrl
        }));
        const wsLogs = XLSX.utils.json_to_sheet(attendanceData);
        XLSX.utils.book_append_sheet(wb, wsLogs, 'Attendance_Reguler');
      }

      // Sheet 1b: Event Attendance Logs
      const eventLogs = logs.filter(l => l.isEvent);
      if (eventLogs.length > 0) {
        const eventData = eventLogs.map(log => ({
          'Nama Pegawai': log.userName,
          'Email': log.userEmail,
          'Nama Acara': log.eventName || 'Acara Khusus',
          'Tanggal': log.date,
          'Waktu Datang': log.timestamp?.toDate ? format(log.timestamp.toDate(), 'HH:mm:ss') : format(new Date(log.timestamp), 'HH:mm:ss'),
          'Waktu Pulang': log.checkOutTimestamp ? (log.checkOutTimestamp?.toDate ? format(log.checkOutTimestamp.toDate(), 'HH:mm:ss') : format(new Date(log.checkOutTimestamp), 'HH:mm:ss')) : '-',
          'Latitude': log.location?.latitude || 'N/A',
          'Longitude': log.location?.longitude || 'N/A',
          'Foto': log.selfieUrl?.startsWith('data:') ? 'BASE64_IMAGE_DATA' : log.selfieUrl
        }));
        const wsEvents = XLSX.utils.json_to_sheet(eventData);
        XLSX.utils.book_append_sheet(wb, wsEvents, 'Attendance_Acara');
      }

      // Sheet 2: Employee Data
      if (employees.length > 0) {
        const employeeData = employees.map(emp => ({
          'Nama Lengkap': emp.displayName || emp.name || 'Unknown',
          'ID Pegawai': emp.nip || '-',
          'Bidang': emp.bidang || '-',
          'Email': emp.email || '-',
          'Role / Akses': emp.role?.toUpperCase() || 'STAFF',
          'Status': emp.status?.toUpperCase() || 'APPROVED',
          'Device ID': emp.deviceId ? 'TERKUNCI' : 'TIDAK ADA',
          'Tanggal Bergabung': emp.createdAt?.toDate ? format(emp.createdAt.toDate(), 'dd/MM/yyyy') : 'N/A'
        }));
        const wsEmployees = XLSX.utils.json_to_sheet(employeeData);
        XLSX.utils.book_append_sheet(wb, wsEmployees, 'Data_Pegawai');
      }

      // Sheet 3: Global Config
      if (settings) {
        const configData = [{
          'Latitude Kantor': settings.officeLat || '-',
          'Longitude Kantor': settings.officeLng || '-',
          'Radius Absen (m)': settings.radius || '-',
          'Jam Masuk (WIB)': settings.startTime || '-',
          'Batas Terlambat (WIB)': settings.lateTime || '-',
          'Hari Operasional': settings.enabledDays ? settings.enabledDays.join(', ') : '-'
        }];
        const wsConfig = XLSX.utils.json_to_sheet(configData);
        XLSX.utils.book_append_sheet(wb, wsConfig, 'Global_Config');
      }

      const fileName = `PMI_System_Arch_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`;
      downloadExcelFile(wb, fileName);
      toast.success('Semua data berhasil diekspor!');
    } catch (err) {
      toast.error('Gagal mengekspor data');
      console.error(err);
    }
  };

  const exportLaporanHarian = () => {
    try {
      const wb = XLSX.utils.book_new();
      const dailyData = filteredDailyReportData.map(item => ({
        'Nama Lengkap': item.displayName || item.name || 'Unknown',
        'ID Pegawai': item.nip || '-',
        'Bidang': item.bidang || '-',
        'Status': item.log ? (item.log.isLeave ? `IZIN/SAKIT (${item.log.leaveType})` : (item.log.isLate ? 'TERLAMBAT' : 'TEPAT WAKTU')) : (item.roster && item.roster.shiftName !== 'OFF' && item.roster.shiftName !== 'Libur' ? 'ALFA / TIDAK ABSEN' : 'LIBUR / TIDAK TERJADWAL'),
        'Waktu (Masuk | Pulang)': item.log ? (item.log.isLeave ? '-' : `${format(item.log.timestamp?.toDate ? item.log.timestamp.toDate() : new Date(item.log.timestamp), 'HH:mm:ss')} | ${item.log.checkOutTimestamp ? format(item.log.checkOutTimestamp?.toDate ? item.log.checkOutTimestamp.toDate() : new Date(item.log.checkOutTimestamp), 'HH:mm:ss') : '--:--:--'}`) : '-'
      }));
      const ws = XLSX.utils.json_to_sheet(dailyData);
      XLSX.utils.book_append_sheet(wb, ws, `Harian_${reportDate}`);
      downloadExcelFile(wb, `Laporan_Harian_${reportDate}.xlsx`);
      toast.success('Laporan Harian berhasil diekspor!');
    } catch (err) {
      toast.error('Gagal mengekspor Laporan Harian');
    }
  };

  const exportLaporanBulanan = () => {
    try {
      const wb = XLSX.utils.book_new();
      const monthlyData = monthlyReportData.map(item => ({
        'Nama Lengkap': item.displayName || item.name || 'Unknown',
        'ID Pegawai': item.nip || '-',
        'Bidang': item.bidang || '-',
        'Total Hari Kerja Act': item.workingDays,
        'Hadir Tepat Waktu': item.totalTepatWaktu,
        '% Tepat Waktu': getPercentage(item.totalTepatWaktu, item.workingDays),
        'Hadir Terlambat': item.totalTelat,
        '% Terlambat': getPercentage(item.totalTelat, item.workingDays),
        'Izin/Sakit/Cuti/Tugas': item.totalLeave || 0,
        'Total Hadir': item.totalHadir,
        '% Kehadiran': getPercentage(item.totalHadir, item.workingDays),
        'Total Alfa': item.alfa,
        '% Alfa': getPercentage(item.alfa, item.workingDays)
      }));
      const ws = XLSX.utils.json_to_sheet(monthlyData);
      XLSX.utils.book_append_sheet(wb, ws, `Bulanan_${reportMonth}`);
      downloadExcelFile(wb, `Laporan_Bulanan_${reportMonth}.xlsx`);
      toast.success('Laporan Bulanan berhasil diekspor!');
    } catch (err) {
      toast.error('Gagal mengekspor Laporan Bulanan');
    }
  };

  const exportLaporanAcara = () => {
    try {
      const wb = XLSX.utils.book_new();
      const eventLogsOnly = logs.filter(l => l.isEvent && l.date.startsWith(reportMonth));
      if (eventLogsOnly.length === 0) {
        toast.error('Tidak ada data absen acara untuk bulan terpilih');
        return;
      }
      const eventData = eventLogsOnly.map(item => ({
        'Nama Lengkap': item.userName || 'Unknown',
        'Email': item.userEmail || '-',
        'Nama Acara': item.eventName || '-',
        'Tanggal Acara': item.date,
        'Waktu Datang': item.timestamp?.toDate ? format(item.timestamp.toDate(), 'HH:mm:ss') : format(new Date(item.timestamp), 'HH:mm:ss'),
        'Waktu Pulang': item.checkOutTimestamp ? (item.checkOutTimestamp?.toDate ? format(item.checkOutTimestamp.toDate(), 'HH:mm:ss') : format(new Date(item.checkOutTimestamp), 'HH:mm:ss')) : '-',
        'Latitude': item.location?.latitude || 'N/A',
        'Longitude': item.location?.longitude || 'N/A'
      }));
      const ws = XLSX.utils.json_to_sheet(eventData);
      XLSX.utils.book_append_sheet(wb, ws, 'Absen_Acara');
      downloadExcelFile(wb, `Laporan_Absen_Acara_${reportMonth}.xlsx`);
      toast.success('Laporan Absen Acara berhasil diekspor!');
    } catch (err) {
      toast.error('Gagal mengekspor Laporan Absen Acara');
    }
  };

  const fetchSettings = async () => {
    const docSnap = await getDoc(doc(db, 'settings', 'global'));
    if (docSnap.exists()) {
      setSettings(docSnap.data() as any);
    }
  };

  const isEmployeeAssignedToEvent = (emp: any) => {
    const assigned = (settings.event?.assignedUserIds || []) as string[];
    if (!Array.isArray(assigned) || assigned.length === 0) return false;
    const empId = emp.id || emp.uid;
    const empEmail = emp.email?.toLowerCase().trim();
    return Boolean(
      (empId && assigned.includes(empId)) ||
      (emp.uid && assigned.includes(emp.uid)) ||
      (empEmail && assigned.includes(empEmail))
    );
  };

  const toggleEmployeeEventAssignment = (emp: any) => {
    const currentAssigned = (((settings as any).event?.assignedUserIds || []) as string[]).slice();
    const empId = emp.id || emp.uid;
    const empEmail = emp.email?.toLowerCase().trim();
    const isCurrently = isEmployeeAssignedToEvent(emp);

    let nextAssigned: string[];
    if (isCurrently) {
      nextAssigned = currentAssigned.filter(
        id => id !== empId && id !== emp.uid && id !== empEmail
      );
    } else {
      nextAssigned = [...currentAssigned];
      if (empId && !nextAssigned.includes(empId)) nextAssigned.push(empId);
      if (empEmail && !nextAssigned.includes(empEmail)) nextAssigned.push(empEmail);
    }

    setSettings({
      ...settings,
      event: {
        ...((settings as any).event || {}),
        assignedUserIds: nextAssigned
      }
    } as any);
  };

  const handleSelectAllEventEmployees = (listToSelect: any[]) => {
    const currentAssigned = new Set(((settings as any).event?.assignedUserIds || []) as string[]);
    listToSelect.forEach(emp => {
      const empId = emp.id || emp.uid;
      const empEmail = emp.email?.toLowerCase().trim();
      if (empId) currentAssigned.add(empId);
      if (empEmail) currentAssigned.add(empEmail);
    });
    setSettings({
      ...settings,
      event: {
        ...((settings as any).event || {}),
        assignedUserIds: Array.from(currentAssigned)
      }
    } as any);
    toast.success(`${listToSelect.length} pegawai ditambahkan ke penugasan acara`);
  };

  const handleClearAllEventEmployees = () => {
    setSettings({
      ...settings,
      event: {
        ...((settings as any).event || {}),
        assignedUserIds: []
      }
    } as any);
    toast.info('Daftar penugasan acara dikosongkan');
  };

  const copyToClipboard = (text: string | number | undefined | null, label: string) => {
    if (!text) return;
    const textStr = text.toString();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textStr).then(() => {
        toast.success(`${label} berhasil disalin ke clipboard!`);
      }).catch((err) => {
        console.error('navigator.clipboard failed, trying fallback...', err);
        fallbackCopy(textStr, label);
      });
    } else {
      fallbackCopy(textStr, label);
    }
  };

  const fallbackCopy = (text: string, label: string) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.position = 'fixed';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) {
        toast.success(`${label} berhasil disalin ke clipboard!`);
      } else {
        toast.error(`Gagal menyalin ${label}`);
      }
    } catch (err) {
      console.error('Fallback copy failed:', err);
      toast.error(`Gagal menyalin ${label}`);
    }
  };

  const setToMyLocation = () => {
    if (navigator.geolocation) {
      toast.promise(
        new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setSettings({
                ...settings,
                officeLat: parseFloat(pos.coords.latitude.toFixed(6)),
                officeLng: parseFloat(pos.coords.longitude.toFixed(6))
              });
              resolve(pos);
            },
            (err) => reject(err),
            { enableHighAccuracy: true }
          );
        }),
        {
          loading: 'Mengambil koordinat GPS...',
          success: 'Koordinat berhasil diset ke lokasi Anda!',
          error: 'Gagal mendapatkan lokasi. Pastikan izin GPS aktif.'
        }
      );
    } else {
      toast.error('Browser tidak mendukung Geolocation');
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      // Validate settings to avoid NaN which Firestore rejects
      const sanitizedSettings: any = {
        ...settings,
        officeLat: Number(settings.officeLat) || 0,
        officeLng: Number(settings.officeLng) || 0,
        radius: Number(settings.radius) || 100,
        startTime: settings.startTime || '07:00',
        lateTime: settings.lateTime || '08:00',
        enabledDays: settings.enabledDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        holidays: (settings as any).holidays || {},
        locations: (settings.locations || []).map((loc: any) => ({
          ...loc,
          lat: Number(loc.lat),
          lng: Number(loc.lng),
          radius: Number(loc.radius) || 100
        })),
        shifts: (settings.shifts || [
          { name: 'Pagi', startTime: '07:00', endTime: '14:00', toleranceMinutes: 30 },
          { name: 'Sore', startTime: '14:00', endTime: '21:00', toleranceMinutes: 30 },
          { name: 'Malam', startTime: '21:00', endTime: '07:00', toleranceMinutes: 30 },
        ]).map((s: any) => ({
          name: s.name,
          startTime: s.startTime,
          endTime: s.endTime,
          toleranceMinutes: isNaN(Number(s.toleranceMinutes)) ? 30 : Number(s.toleranceMinutes)
        })),
        fridayEarlyEnd: {
          enabled: (settings as any).fridayEarlyEnd?.enabled || false,
          checkOutTime: (settings as any).fridayEarlyEnd?.checkOutTime || '10:30',
          exemptBidangs: (settings as any).fridayEarlyEnd?.exemptBidangs || ['RAWAT INAP', 'UGD'],
        },
        event: {
          isActive: (settings as any).event?.isActive || false,
          name: (settings as any).event?.name || '',
          startDate: (settings as any).event?.startDate || '',
          endDate: (settings as any).event?.endDate || '',
          startTime: (settings as any).event?.startTime || '08:00',
          endTime: (settings as any).event?.endTime || '17:00',
          lat: Number((settings as any).event?.lat) || 0,
          lng: Number((settings as any).event?.lng) || 0,
          radius: Number((settings as any).event?.radius) || 100,
          assignedUserIds: Array.isArray((settings as any).event?.assignedUserIds)
            ? (settings as any).event.assignedUserIds
            : [],
        }
      };

      await setDoc(doc(db, 'settings', 'global'), sanitizedSettings);
      setSettings(sanitizedSettings);
      toast.success('Pengaturan berhasil disinkronisasi!');
    } catch (err: any) {
      console.error('Save Settings Error:', err);
      toast.error(`Gagal menyimpan: ${err.message || 'Izin ditolak'}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h} Jam, ${m} Menit, ${s} Detik`;
  };

  const getPercentage = (value: number, total: number) => {
    if (!total) return '0.0%';
    return `${((value / total) * 100).toFixed(1)}%`;
  };

  const handleClearLogs = async () => {
    setIsClearingLogs(true);
    try {
      const q = query(collection(db, 'attendance'));
      const snap = await getDocs(q);
      const docs = snap.docs;

      // Delete in chunks of 100 to avoid client-side choking
      for (let i = 0; i < docs.length; i += 100) {
        const chunk = docs.slice(i, i + 100);
        await Promise.all(chunk.map(d => deleteDoc(doc(db, 'attendance', d.id))));
      }

      toast.success(`Berhasil menghapus ${docs.length} riwayat absensi. Data pegawai tetap terjaga.`);
      setIsClearLogsDialogOpen(false);
      fetchLogs(reportMonth);
    } catch (err) {
      console.error('Clear DB Error:', err);
      toast.error('Gagal mengosongkan database absen');
    } finally {
      setIsClearingLogs(false);
    }
  };

  const handleClearMonthLogs = async () => {
    setIsClearingMonthLogs(true);
    try {
      const q = query(collection(db, 'attendance'), where('month', '==', reportMonth));
      const snap = await getDocs(q);
      const docs = snap.docs;

      // Also delete rosters for that month
      const qRoster = query(collection(db, 'rosters'), where('month', '==', reportMonth));
      const snapRoster = await getDocs(qRoster);
      const docsRoster = snapRoster.docs;

      // Delete in chunks of 100 to avoid client-side choking
      for (let i = 0; i < docs.length; i += 100) {
        const chunk = docs.slice(i, i + 100);
        await Promise.all(chunk.map(d => deleteDoc(doc(db, 'attendance', d.id))));
      }

      for (let i = 0; i < docsRoster.length; i += 100) {
        const chunk = docsRoster.slice(i, i + 100);
        await Promise.all(chunk.map(d => deleteDoc(doc(db, 'rosters', d.id))));
      }

      toast.success(`Berhasil menghapus ${docs.length} riwayat absensi dan ${docsRoster.length} jadwal piket untuk bulan ${reportMonth}.`);
      setIsClearMonthLogsDialogOpen(false);
      fetchLogs(reportMonth);
      fetchRosters(reportMonth);
    } catch (err) {
      console.error('Clear Month DB Error:', err);
      toast.error('Gagal mengosongkan database absen bulan ini');
    } finally {
      setIsClearingMonthLogs(false);
    }
  };

  const filteredLogs = logs.filter(log =>
    !log.isEvent && (
      log.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userEmail?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const filteredEventLogs = logs.filter(log =>
    log.isEvent && (
      log.userName?.toLowerCase().includes(eventSearchTerm.toLowerCase()) ||
      log.userEmail?.toLowerCase().includes(eventSearchTerm.toLowerCase()) ||
      log.eventName?.toLowerCase().includes(eventSearchTerm.toLowerCase())
    )
  );

  const approvedEmployees = employees.filter(emp => emp.status !== 'pending' && emp.status !== 'rejected');
  const pendingEmployees = employees.filter(emp => emp.status === 'pending');
  const pendingCount = pendingEmployees.length;

  const filteredEmployees = approvedEmployees.filter(emp =>
    emp.name?.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
    emp.email?.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
    emp.displayName?.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
    emp.nip?.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
    emp.bidang?.toLowerCase().includes(employeeSearchTerm.toLowerCase())
  );

  // Group data for chart (Daily count for current month, exclude events)
  const chartData = logs.filter(l => !l.isEvent).reduce((acc: any[], log) => {
    const date = log.date;
    const existing = acc.find(i => i.date === date);
    if (existing) {
      existing.count += 1;
      if (log.isLate) existing.late += 1;
    } else {
      acc.push({ date, count: 1, late: log.isLate ? 1 : 0 });
    }
    return acc;
  }, []).sort((a: any, b: any) => a.date.localeCompare(b.date)).slice(-7);

  // Generate Daily Report Data (excluding events)
  const dailyReportData = approvedEmployees.map(emp => {
    const email = emp.email?.toLowerCase();
    const log = logs.find(l => l.userEmail?.toLowerCase() === email && l.date === reportDate && !l.isEvent);
    const roster = rosters.find(r => (r.userId === emp.id || r.userId === emp.uid || r.userEmail?.toLowerCase() === email) && r.date === reportDate);
    return { ...emp, log, roster };
  });

  // First, filter by search term (Name, ID Pegawai, Bidang, Email) to support dynamic badge adjustments
  const searchedDailyReportData = dailyReportData.filter(item => {
    const searchLower = dailySearchTerm.toLowerCase().trim();
    if (!searchLower) return true;

    return (
      (item.displayName || item.name || '').toLowerCase().includes(searchLower) ||
      (item.nip || '').toLowerCase().includes(searchLower) ||
      (item.bidang || '').toLowerCase().includes(searchLower) ||
      (item.email || '').toLowerCase().includes(searchLower)
    );
  });

  // Stats summary for daily report buttons - dynamically adapts to active search!
  const statsHarian = {
    all: searchedDailyReportData.length,
    tepatWaktu: searchedDailyReportData.filter(item => item.log && !item.log.isLeave && !item.log.isLate).length,
    terlambat: searchedDailyReportData.filter(item => item.log && !item.log.isLeave && item.log.isLate).length,
    izin: searchedDailyReportData.filter(item => item.log?.isLeave === true).length,
    alfa: searchedDailyReportData.filter(item => !item.log && item.roster && item.roster.shiftName !== 'OFF' && item.roster.shiftName !== 'Libur').length,
    libur: searchedDailyReportData.filter(item => !item.log && (!item.roster || item.roster.shiftName === 'OFF' || item.roster.shiftName === 'Libur')).length,
  };

  // Filtered Daily Report Data based on status filters applied to the searched list
  const filteredDailyReportData = searchedDailyReportData.filter(item => {
    if (dailyStatusFilter === 'all') return true;

    const hasLog = !!item.log;
    const isLeave = item.log?.isLeave === true;
    const isLate = item.log?.isLate === true;
    const isRosterActive = item.roster && item.roster.shiftName !== 'OFF' && item.roster.shiftName !== 'Libur';

    if (dailyStatusFilter === 'tepat_waktu') {
      return hasLog && !isLeave && !isLate;
    }
    if (dailyStatusFilter === 'terlambat') {
      return hasLog && !isLeave && isLate;
    }
    if (dailyStatusFilter === 'izin') {
      return isLeave;
    }
    if (dailyStatusFilter === 'alfa') {
      return !hasLog && isRosterActive;
    }
    if (dailyStatusFilter === 'libur') {
      return !hasLog && !isRosterActive;
    }

    return true;
  });

  // Generate Monthly Report Data
  const monthlyReportData = approvedEmployees.map(emp => {
    const email = emp.email?.toLowerCase();
    const empLogs = logs.filter(l => l.userEmail?.toLowerCase() === email && l.date.startsWith(reportMonth) && !l.isEvent);

    const totalHadir = empLogs.filter(l => !l.isLeave).length;
    const totalTelat = empLogs.filter(l => !l.isLeave && l.isLate).length;
    const totalLateDuration = empLogs.reduce((acc, l) => acc + (l.lateDuration || 0), 0);
    const totalTepatWaktu = totalHadir - totalTelat;
    const totalLeave = empLogs.filter(l => l.isLeave).length;

    const today = new Date();
    const [year, month] = reportMonth.split('-');
    const start = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endOfThisMonth = new Date(parseInt(year), parseInt(month), 0);
    const end = endOfThisMonth > today && start.getMonth() === today.getMonth() && start.getFullYear() === today.getFullYear() ? today : endOfThisMonth;

    let baseWorkingDays = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = format(d, 'yyyy-MM-dd');
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];
      const isEnabledDay = ((settings as any).enabledDays || []).includes(dayName);
      const isHoliday = !!((settings as any).holidays && (settings as any).holidays[dateStr]);
      if (isEnabledDay && !isHoliday) {
        baseWorkingDays++;
      }
    }

    let empWorkingDays = baseWorkingDays;
    const bidang = (emp.bidang || '').toUpperCase();

    // Teknisi dan Keamanan menggunakan jadwal piket (roster)
    if (bidang.includes('TEKNISI') || bidang.includes('KEAMANAN')) {
      const empRosters = rosters.filter(r => r.userEmail?.toLowerCase() === email && r.date.startsWith(reportMonth));
      if (empRosters.length > 0) {
        empWorkingDays = empRosters.filter(r => {
          const rDate = new Date(r.date);
          return rDate <= end && r.shiftName !== 'OFF' && r.shiftName !== 'Libur';
        }).length;
      } else {
        empWorkingDays = 0; // Jika tidak ada jadwal sama sekali
      }
    } else {
      // Administrasi, Kebersihan, dll menggunakan baseWorkingDays (hari normal dikurangi libur)
      empWorkingDays = baseWorkingDays;
    }

    const alfa = Math.max(0, empWorkingDays - totalHadir - totalLeave);
    return { ...emp, totalHadir, totalTelat, totalLateDuration, totalTepatWaktu, totalLeave, alfa, workingDays: empWorkingDays };
  });

  return (
    <div id="admin-main-container" className="space-y-6 pb-12">
      <div id="admin-header" className="flex items-center justify-between px-2">
        <div>
          <h2 id="admin-title" className="text-2xl font-black tracking-tight text-slate-800 uppercase">Pusat Kontrol</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Manajemen & Analitik Keamanan</p>
        </div>
        <div className="flex gap-2">
          <Button id="admin-export-btn" variant="outline" size="sm" onClick={exportToExcel} className="h-8 text-[10px] font-black uppercase tracking-widest border-slate-200 shadow-sm">
            <Download size={14} className="mr-1" /> Ekspor Arsip
          </Button>
        </div>
      </div>

      <Tabs id="admin-tabs" defaultValue="rekap" className="w-full">
        <TabsList id="admin-tabs-list" className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-8 bg-slate-200/50 p-1 rounded-xl h-auto border border-slate-200 gap-1">
          <TabsTrigger id="trigger-rekap" value="rekap" className="font-black text-[10px] py-2 uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-sm rounded-lg transition-all shrink-0">
            <Users size={14} className="mr-2" /> Rekap Data
          </TabsTrigger>
          <TabsTrigger id="trigger-acara" value="acara" className="font-black text-[10px] py-2 uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-sm rounded-lg transition-all shrink-0">
            <Star size={14} className="mr-2 text-amber-500 fill-amber-500" /> ACARA LUAR
          </TabsTrigger>
          <TabsTrigger id="trigger-laporan" value="laporan" className="font-black text-[10px] py-2 uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-sm rounded-lg transition-all shrink-0">
            <FileText size={14} className="mr-2" /> Laporan
          </TabsTrigger>
          <TabsTrigger id="trigger-roster" value="roster" className="font-black text-[10px] py-2 uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-sm rounded-lg transition-all shrink-0">
            <CalendarRange size={14} className="mr-2" /> Jadwal Piket
          </TabsTrigger>
          <TabsTrigger id="trigger-employees" value="employees" className="font-black text-[10px] py-2 uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-sm rounded-lg transition-all shrink-0">
            <Users size={14} className="mr-2" /> List Pegawai
          </TabsTrigger>
          <TabsTrigger id="trigger-approvals" value="approvals" className="font-black text-[10px] py-2 uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-sm rounded-lg transition-all shrink-0 relative">
            <UserPlus size={14} className="mr-2" /> Persetujuan
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-1.5 px-1.5 py-0.5 text-[8px] font-black rounded-full bg-red-600 text-white animate-pulse">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger id="trigger-izin" value="izin" className="font-black text-[10px] py-2 uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-sm rounded-lg transition-all shrink-0">
            <CalendarRange size={14} className="mr-2" /> Kelola Izin
          </TabsTrigger>
          <TabsTrigger id="trigger-settings" value="settings" className="font-black text-[10px] py-2 uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-sm rounded-lg transition-all shrink-0">
            <Settings size={14} className="mr-2" /> Konfigurasi Global
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rekap" className="space-y-6 mt-6">
          {/* Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden group">
              <div className="p-4 flex flex-col justify-center">
                <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest mb-1 group-hover:text-red-600 transition-colors">Jumlah Rekaman</p>
                <div className="flex items-baseline gap-1">
                  <h3 className="text-3xl font-black text-slate-800 tabular-nums">{logs.length}</h3>
                  <span className="text-[10px] font-bold text-slate-400 font-mono">UUID</span>
                </div>
              </div>
            </Card>
            <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden group">
              <div className="p-4 flex flex-col justify-center border-l-4 border-amber-500">
                <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest mb-1">Terlambat</p>
                <div className="flex items-baseline gap-1">
                  <h3 className="text-3xl font-black text-amber-600 tabular-nums">{logs.filter(l => l.isLate).length}</h3>
                  <span className="text-[10px] font-bold text-slate-400 font-mono">PENGGUNA</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Chart */}
          <Card className="border border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="p-4 border-b bg-slate-50/50 flex flex-row items-center justify-between">
              <CardTitle className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <BarChartIcon size={14} className="text-red-500" />
                Tren Kehadiran (7 Hari)
              </CardTitle>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Dataset Langsung</span>
            </CardHeader>
            <CardContent className="h-56 pt-6 px-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
                    tickFormatter={(val) => val.split('-').slice(1).reverse().join('/')}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px', fontWeight: 800 }}
                    cursor={{ fill: '#f8fafc' }}
                  />
                  <Bar dataKey="count" name="TEPAT WAKTU" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="late" name="TERLAMBAT" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Detailed Table */}
          <Card className="border border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="p-4 border-b bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Log Audit Utama</h3>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                <Input
                  placeholder="Cari nama/email..."
                  className="pl-9 h-8 bg-white border-slate-200 text-xs font-medium placeholder:text-slate-300 focus-visible:ring-red-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow className="border-b border-slate-200">
                    <TableHead className="font-black text-[9px] uppercase tracking-widest py-4">Identitas Pegawai</TableHead>
                    <TableHead className="font-black text-[9px] uppercase tracking-widest py-4">Shift</TableHead>
                    <TableHead className="font-black text-[9px] uppercase tracking-widest py-4">Tanggal</TableHead>
                    <TableHead className="font-black text-[9px] uppercase tracking-widest py-4">Waktu (Masuk | Pulang)</TableHead>
                    <TableHead className="font-black text-[9px] uppercase tracking-widest py-4">Status</TableHead>
                    <TableHead className="font-black text-[9px] uppercase tracking-widest py-4 text-right">Jejak Visual</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.slice(0, 50).map((log) => ( // Batasi tampilan tabel hanya 50 data teratas
                    <TableRow key={log.id} className="group hover:bg-red-50/30 transition-colors border-b border-slate-100 last:border-0 italic">
                      <TableCell className="py-4">
                        <p className="font-black text-slate-800 text-[11px] leading-tight uppercase">{log.userName}</p>
                        <p className="text-[9px] text-slate-400 font-mono lower-case tracking-tight">{log.userEmail}</p>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className="text-[9px] font-black uppercase border-red-200 text-red-700 bg-red-50">
                          {log.shiftName || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4">
                        <p className="text-[10px] font-black text-slate-700 tabular-nums leading-tight uppercase font-mono">
                          {(() => {
                            const [y, m, d] = log.date.split('-');
                            return `${d}-${m}-${y}`;
                          })()}
                        </p>
                      </TableCell>
                      <TableCell className="py-4">
                        <p className="text-[10px] font-black text-slate-700 tabular-nums leading-tight uppercase font-mono">
                          {log.isLeave ? (
                            '-'
                          ) : (
                            `${format(log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp), 'HH:mm:ss')} | ${log.checkOutTimestamp ? format(log.checkOutTimestamp?.toDate ? log.checkOutTimestamp.toDate() : new Date(log.checkOutTimestamp), 'HH:mm:ss') : '--:--:--'}`
                          )}
                        </p>
                      </TableCell>
                      <TableCell className="py-4">
                        {log.isLeave ? (
                          (() => {
                            const labels: any = { 'I': 'IZIN', 'S': 'SAKIT', 'C': 'CUTI', 'T': 'TUGAS LUAR' };
                            const bgColors: any = { 'I': 'bg-amber-100 text-amber-700 border-amber-200', 'S': 'bg-rose-100 text-rose-700 border-rose-200', 'C': 'bg-purple-100 text-purple-700 border-purple-200', 'T': 'bg-slate-100 text-slate-700 border-slate-200' };
                            const label = labels[log.leaveType] || 'IZIN';
                            const colors = bgColors[log.leaveType] || bgColors['I'];
                            return (
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-tighter ${colors}`}>
                                {label}
                              </span>
                            );
                          })()
                        ) : log.isLate ? (
                          <span className="px-2 py-0.5 bg-amber-500 text-white rounded-full text-[9px] font-black uppercase tracking-tighter shadow-xs">TERLAMBAT</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-600 text-white rounded-full text-[9px] font-black uppercase tracking-tighter shadow-xs">TEPAT WAKTU</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <div className="inline-block">
                          <div
                            onClick={() => log.selfieUrl && setSelectedPhoto(log.selfieUrl)}
                            className={`h-10 w-10 rounded-lg overflow-hidden border border-slate-200 shadow-sm transition-all hover:ring-2 ring-red-500 scale-95 hover:scale-100 ${log.selfieUrl ? 'cursor-pointer' : ''}`}
                          >
                            {log.selfieUrl ? (
                              <img src={log.selfieUrl} alt="Selfie" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-300 uppercase">Tidak Ada Foto</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="acara" className="space-y-6 mt-6">
          {/* Header Acara Luar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shadow-xs">
                <Star size={22} className="fill-amber-500 text-amber-500" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  Manajemen & Rekap Acara Luar
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Atur konfigurasi acara luar, tentukan pegawai yang ditugaskan, dan pantau log kehadiran presensi acara.
                </p>
              </div>
            </div>
            {settings.event?.isActive ? (
              <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[10px] uppercase tracking-wider px-3 py-1 flex items-center gap-1.5 self-start sm:self-auto shadow-xs">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                Mode Acara Aktif
              </Badge>
            ) : (
              <Badge variant="outline" className="text-slate-400 border-slate-200 text-[10px] font-bold uppercase tracking-wider px-3 py-1 self-start sm:self-auto">
                Mode Acara Nonaktif
              </Badge>
            )}
          </div>

          {/* Stats Summary Event */}
          {(() => {
            const assignedList = employees.filter(emp => isEmployeeAssignedToEvent(emp));
            const attendedUserEmails = new Set(
              logs
                .filter(l => l.isEvent && l.date.startsWith(reportMonth))
                .map(l => l.userEmail?.toLowerCase().trim())
                .filter(Boolean)
            );
            const attendedCount = assignedList.filter(emp => attendedUserEmails.has(emp.email?.toLowerCase().trim())).length;

            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border border-slate-200 shadow-xs bg-white overflow-hidden group">
                  <div className="p-4 flex flex-col justify-center border-l-4 border-amber-500">
                    <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest mb-1 group-hover:text-red-600 transition-colors">Jumlah Absen Acara ({reportMonth})</p>
                    <div className="flex items-baseline gap-1">
                      <h3 className="text-3xl font-black text-slate-800 tabular-nums">{logs.filter(l => l.isEvent && l.date.startsWith(reportMonth)).length}</h3>
                      <span className="text-[10px] font-bold text-slate-400 font-mono">REKAMAN</span>
                    </div>
                  </div>
                </Card>

                <Card className="border border-slate-200 shadow-xs bg-white overflow-hidden group">
                  <div className="p-4 flex flex-col justify-center border-l-4 border-emerald-500">
                    <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest mb-1 group-hover:text-emerald-600 transition-colors">Pegawai Ditugaskan</p>
                    <div className="flex items-baseline gap-1">
                      <h3 className="text-3xl font-black text-slate-800 tabular-nums">{assignedList.length}</h3>
                      <span className="text-[10px] font-bold text-slate-400 font-mono">ORANG</span>
                      {assignedList.length > 0 && (
                        <span className="text-[10px] font-bold text-emerald-600 ml-2 font-mono">
                          ({attendedCount} Hadir)
                        </span>
                      )}
                    </div>
                  </div>
                </Card>

                {settings.event?.isActive ? (
                  <Card className="border border-slate-200 shadow-xs bg-white overflow-hidden">
                    <div className="p-4 flex flex-col justify-between h-full border-l-4 border-blue-500">
                      <div>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[8px] font-black uppercase tracking-widest">Acara Berlangsung</span>
                        <h4 className="text-xs font-black text-slate-800 uppercase mt-1 flex items-center gap-1.5 truncate"><Star size={13} className="text-amber-500 fill-amber-500 shrink-0" />{settings.event.name || 'Acara Khusus'}</h4>
                        <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 truncate">{settings.event.startDate} s/d {settings.event.endDate} | {settings.event.startTime}-{settings.event.endTime} WIB</p>
                      </div>
                    </div>
                  </Card>
                ) : (
                  <Card className="border border-slate-200 shadow-xs bg-white overflow-hidden">
                    <div className="p-4 flex flex-col justify-center h-full border-l-4 border-slate-300">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status Acara</span>
                      <p className="text-xs font-bold text-slate-500 mt-1">Mode Acara Tidak Aktif</p>
                    </div>
                  </Card>
                )}
              </div>
            );
          })()}

          {/* Sub Navigation & Action Header Event */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100/90 p-1 shadow-xs">
                <button
                  type="button"
                  onClick={() => setEventTabSubView('config')}
                  className={cn(
                    "px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5",
                    eventTabSubView === 'config' ? "bg-white text-slate-900 shadow-xs font-black" : "text-slate-500 hover:text-slate-800 font-bold"
                  )}
                >
                  <Sliders size={13} className="text-amber-500" /> Pengaturan & Petugas
                </button>
                <button
                  type="button"
                  onClick={() => setEventTabSubView('logs')}
                  className={cn(
                    "px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5",
                    eventTabSubView === 'logs' ? "bg-white text-slate-900 shadow-xs font-black" : "text-slate-500 hover:text-slate-800 font-bold"
                  )}
                >
                  <FileText size={13} /> Log Absen Masuk ({filteredEventLogs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setEventTabSubView('assigned')}
                  className={cn(
                    "px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5",
                    eventTabSubView === 'assigned' ? "bg-white text-slate-900 shadow-xs font-black" : "text-slate-500 hover:text-slate-800 font-bold"
                  )}
                >
                  <UserCheck size={13} /> Status Petugas ({employees.filter(emp => isEmployeeAssignedToEvent(emp)).length})
                </button>
              </div>

              {eventTabSubView !== 'config' && (
                <>
                  <Input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="h-8 font-mono text-xs w-36 bg-white" />
                  <Button onClick={exportLaporanAcara} size="sm" variant="outline" className="h-8 border-slate-200 shadow-xs text-[10px] font-black uppercase text-red-600 hover:text-white hover:bg-red-600">
                    <Download size={13} className="mr-1" /> Ekspor Excel
                  </Button>
                </>
              )}
            </div>

            {eventTabSubView !== 'config' && (
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                <Input
                  placeholder="Cari nama, email, acara..."
                  className="pl-9 h-8 bg-white border-slate-200 text-xs font-medium placeholder:text-slate-300 focus-visible:ring-red-500"
                  value={eventSearchTerm}
                  onChange={(e) => setEventSearchTerm(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* SubView 1: CONFIGURATION & EMPLOYEE ASSIGNMENT */}
          {eventTabSubView === 'config' && (
            <Card className="border border-slate-200 shadow-xs bg-white overflow-hidden p-6 space-y-6">
              <div className="space-y-4">
                <CardHeader className="p-0">
                  <CardTitle className="text-xs font-black text-slate-700 uppercase tracking-widest flex gap-2 items-center">
                    <Star size={16} className="text-amber-500 fill-amber-500" /> Konfigurasi Acara Luar & Penugasan Petugas
                  </CardTitle>
                  <CardDescription className="text-xs font-medium text-slate-400 mt-1">
                    Aktifkan mode acara luar, atur jadwal & lokasi GPS acara, dan daftarkan petugas yang berhak absen.
                  </CardDescription>
                </CardHeader>

                <div className="p-4 sm:p-5 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-5">
                  {/* Toggle aktif */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black uppercase text-amber-900 tracking-wider">Aktifkan Mode Acara Luar</p>
                      <p className="text-[10px] text-amber-700 font-medium mt-0.5">Jika aktif, sistem akan mengizinkan presensi acara luar bagi pegawai yang terdaftar.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const current = (settings as any).event?.isActive || false;
                        setSettings({
                          ...settings,
                          event: {
                            ...((settings as any).event || {}),
                            isActive: !current,
                          }
                        } as any);
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${(settings as any).event?.isActive ? 'bg-amber-500' : 'bg-slate-200'
                        }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${(settings as any).event?.isActive ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                    </button>
                  </div>

                  {/* Status badge */}
                  {(settings as any).event?.isActive && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/20 rounded-lg border border-amber-300">
                      <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                      <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Mode Acara Luar Sedang Aktif — Pegawai Terdaftar Dapat Melakukan Absensi Acara</p>
                    </div>
                  )}

                  {/* Form detail acara */}
                  <div className="space-y-4">
                    {/* Nama acara */}
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-amber-800">Nama Acara Luar</Label>
                      <input
                        type="text"
                        value={(settings as any).event?.name || ''}
                        onChange={(e) => setSettings({
                          ...settings,
                          event: { ...((settings as any).event || {}), name: e.target.value }
                        } as any)}
                        placeholder="Contoh: Posko Siaga Bencana / Rapat Koordinasi PMI 2026"
                        className="w-full h-9 px-3 rounded-lg border border-amber-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>

                    {/* Tanggal acara */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-amber-800">Tanggal Mulai</Label>
                        <Input
                          type="date"
                          value={(settings as any).event?.startDate || ''}
                          onChange={(e) => setSettings({
                            ...settings,
                            event: { ...((settings as any).event || {}), startDate: e.target.value }
                          } as any)}
                          className="h-9 text-xs bg-white border-amber-200 focus-visible:ring-amber-400"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-amber-800">Tanggal Selesai</Label>
                        <Input
                          type="date"
                          value={(settings as any).event?.endDate || ''}
                          onChange={(e) => setSettings({
                            ...settings,
                            event: { ...((settings as any).event || {}), endDate: e.target.value }
                          } as any)}
                          className="h-9 text-xs bg-white border-amber-200 focus-visible:ring-amber-400"
                        />
                      </div>
                    </div>

                    {/* Waktu absen acara */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-amber-800">Jam Buka Absen</Label>
                        <Input
                          type="time"
                          value={(settings as any).event?.startTime || '08:00'}
                          onChange={(e) => setSettings({
                            ...settings,
                            event: { ...((settings as any).event || {}), startTime: e.target.value }
                          } as any)}
                          className="h-9 text-xs font-mono bg-white border-amber-200 focus-visible:ring-amber-400"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-amber-800">Jam Tutup Absen</Label>
                        <Input
                          type="time"
                          value={(settings as any).event?.endTime || '17:00'}
                          onChange={(e) => setSettings({
                            ...settings,
                            event: { ...((settings as any).event || {}), endTime: e.target.value }
                          } as any)}
                          className="h-9 text-xs font-mono bg-white border-amber-200 focus-visible:ring-amber-400"
                        />
                      </div>
                    </div>

                    {/* Lokasi GPS acara */}
                    <div className="space-y-2 pt-2 border-t border-amber-200/80">
                      <Label className="text-[10px] font-black uppercase text-amber-800 flex items-center gap-1.5">
                        <MapPin size={13} /> Titik Lokasi GPS Acara & Radius
                      </Label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[9px] font-bold text-amber-700 uppercase">Latitude</Label>
                          <div className="relative flex items-center">
                            <Input
                              type="text"
                              value={(settings as any).event?.lat || ''}
                              onChange={(e) => setSettings({
                                ...settings,
                                event: { ...((settings as any).event || {}), lat: parseFloat(e.target.value) || 0 }
                              } as any)}
                              placeholder="-6.0000"
                              className="h-8 pr-7 text-xs font-mono bg-white border-amber-200 focus-visible:ring-amber-400"
                            />
                            <button
                              type="button"
                              onClick={() => copyToClipboard((settings as any).event?.lat, 'Latitude')}
                              title="Salin Latitude"
                              className="absolute right-1.5 h-6 w-6 p-1 rounded-md hover:bg-amber-100 text-amber-500 hover:text-amber-700 transition-colors flex items-center justify-center"
                            >
                              <Copy size={11} />
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] font-bold text-amber-700 uppercase">Longitude</Label>
                          <div className="relative flex items-center">
                            <Input
                              type="text"
                              value={(settings as any).event?.lng || ''}
                              onChange={(e) => setSettings({
                                ...settings,
                                event: { ...((settings as any).event || {}), lng: parseFloat(e.target.value) || 0 }
                              } as any)}
                              placeholder="106.0000"
                              className="h-8 pr-7 text-xs font-mono bg-white border-amber-200 focus-visible:ring-amber-400"
                            />
                            <button
                              type="button"
                              onClick={() => copyToClipboard((settings as any).event?.lng, 'Longitude')}
                              title="Salin Longitude"
                              className="absolute right-1.5 h-6 w-6 p-1 rounded-md hover:bg-amber-100 text-amber-500 hover:text-amber-700 transition-colors flex items-center justify-center"
                            >
                              <Copy size={11} />
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] font-bold text-amber-700 uppercase">Radius (Meter)</Label>
                          <Input
                            type="number"
                            value={(settings as any).event?.radius || 100}
                            onChange={(e) => setSettings({
                              ...settings,
                              event: { ...((settings as any).event || {}), radius: parseInt(e.target.value) || 100 }
                            } as any)}
                            className="h-8 text-xs font-mono bg-white border-amber-200"
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-[9px] font-black uppercase tracking-widest border-amber-200 text-amber-800 bg-white hover:bg-amber-100/60"
                        onClick={() => {
                          if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition((pos) => {
                              setSettings({
                                ...settings,
                                event: {
                                  ...((settings as any).event || {}),
                                  lat: parseFloat(pos.coords.latitude.toFixed(6)),
                                  lng: parseFloat(pos.coords.longitude.toFixed(6)),
                                }
                              } as any);
                              toast.success('Koordinat lokasi acara diset ke posisi Anda saat ini!');
                            }, () => {
                              toast.error('Gagal mendapatkan GPS. Pastikan izin lokasi aktif.');
                            }, { enableHighAccuracy: true });
                          }
                        }}
                      >
                        <Navigation size={11} className="mr-1 text-amber-600" /> Gunakan Lokasi Saya Saat Ini
                      </Button>
                    </div>

                    {/* === DAFTAR PENUGASAN PEGAWAI UNTUK ACARA === */}
                    <div className="space-y-3 pt-3 border-t border-amber-200/80">
                      {(() => {
                        const filteredEmployeesForEvent = employees.filter(emp => {
                          const matchesSearch =
                            (emp.displayName || emp.name || '').toLowerCase().includes(eventEmployeeSearch.toLowerCase()) ||
                            (emp.email || '').toLowerCase().includes(eventEmployeeSearch.toLowerCase()) ||
                            (emp.nip || '').toLowerCase().includes(eventEmployeeSearch.toLowerCase());
                          const matchesBidang = eventBidangFilter === 'ALL' || (emp.bidang || '').toUpperCase() === eventBidangFilter.toUpperCase();
                          return matchesSearch && matchesBidang;
                        });
                        const assignedEmployeesCount = employees.filter(emp => isEmployeeAssignedToEvent(emp)).length;

                        return (
                          <>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <Label className="text-[10px] font-black uppercase text-amber-900 flex items-center gap-1.5">
                                  <Users size={14} className="text-amber-600" /> Penugasan Pegawai (Petugas Acara Luar)
                                </Label>
                                <p className="text-[9px] text-amber-700 font-medium">
                                  Hanya pegawai yang ditugaskan yang dapat melakukan presensi di acara ini. Pegawai yang tidak ditugaskan tetap mengikuti jadwal shift / hari normal.
                                </p>
                              </div>
                              <Badge className="bg-amber-600 hover:bg-amber-600 text-white font-black text-[9px] uppercase tracking-wider px-2.5 py-0.5 self-start sm:self-auto shadow-xs">
                                {assignedEmployeesCount} Dari {employees.length} Pegawai Ditugaskan
                              </Badge>
                            </div>

                            {/* Toolbar Pencarian & Aksi Cepat */}
                            <div className="bg-amber-100/60 p-3 rounded-xl border border-amber-200/90 space-y-2.5">
                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                                <div className="sm:col-span-7 relative">
                                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-amber-500 w-3.5 h-3.5" />
                                  <Input
                                    placeholder="Cari nama, NIP, atau email pegawai..."
                                    value={eventEmployeeSearch}
                                    onChange={(e) => setEventEmployeeSearch(e.target.value)}
                                    className="pl-8 h-8 text-xs bg-white border-amber-200 text-slate-700 placeholder:text-slate-400 focus-visible:ring-amber-400"
                                  />
                                </div>
                                <div className="sm:col-span-5">
                                  <select
                                    value={eventBidangFilter}
                                    onChange={(e) => setEventBidangFilter(e.target.value)}
                                    aria-label="Filter Bidang"
                                    className="w-full h-8 px-2.5 text-xs bg-white border border-amber-200 rounded-md font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                                  >
                                    <option value="ALL">Semua Bidang ({employees.length})</option>
                                    {departments.map(dept => {
                                      const count = employees.filter(e => (e.bidang || '').toUpperCase() === dept.toUpperCase()).length;
                                      return <option key={dept} value={dept}>{dept} ({count})</option>;
                                    })}
                                  </select>
                                </div>
                              </div>

                              {/* Tombol aksi massal */}
                              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200/60">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSelectAllEventEmployees(filteredEmployeesForEvent)}
                                  className="h-7 px-2 text-[9px] font-black uppercase tracking-wider bg-white border-amber-300 text-amber-800 hover:bg-amber-200/50"
                                >
                                  <CheckSquare size={11} className="mr-1 text-emerald-600" />
                                  Pilih Semua Hasil Filter ({filteredEmployeesForEvent.length})
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSelectAllEventEmployees(employees)}
                                  className="h-7 px-2 text-[9px] font-black uppercase tracking-wider bg-white border-amber-300 text-amber-800 hover:bg-amber-200/50"
                                >
                                  <Users size={11} className="mr-1 text-amber-600" />
                                  Pilih Semua Pegawai ({employees.length})
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={handleClearAllEventEmployees}
                                  disabled={assignedEmployeesCount === 0}
                                  className="h-7 px-2 text-[9px] font-black uppercase tracking-wider bg-white border-amber-300 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                                >
                                  <X size={11} className="mr-1 text-rose-600" />
                                  Kosongkan Pilihan
                                </Button>
                              </div>
                            </div>

                            {/* Chip ringkasan pegawai terpilih (jika ada) */}
                            {assignedEmployeesCount > 0 && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[9px] font-black uppercase text-amber-800">
                                  <span>Pegawai Yang Telah Ditugaskan:</span>
                                  <span className="text-amber-600 font-mono">Klik tanda silang (x) untuk mencoret</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-white/90 rounded-xl border border-amber-200">
                                  {employees.filter(emp => isEmployeeAssignedToEvent(emp)).map(emp => (
                                    <Badge
                                      key={emp.id || emp.uid}
                                      variant="outline"
                                      className="bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900 text-[9px] font-bold py-0.5 pl-2 pr-1 gap-1 flex items-center shadow-xs"
                                    >
                                      <span>{emp.displayName || emp.name}</span>
                                      <span className="text-[8px] text-amber-600 font-mono">({emp.bidang || 'Staff'})</span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleEmployeeEventAssignment(emp);
                                        }}
                                        className="w-3.5 h-3.5 rounded-full hover:bg-amber-200 flex items-center justify-center text-amber-800 ml-0.5"
                                      >
                                        <X size={9} />
                                      </button>
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Daftar Checkbox Pegawai */}
                            <div className="border border-amber-200 rounded-xl bg-white overflow-hidden shadow-xs">
                              <div className="bg-amber-100/70 px-3 py-2 border-b border-amber-200 flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-amber-900">
                                <span>Daftar Pegawai ({filteredEmployeesForEvent.length})</span>
                                <span>Status Penugasan</span>
                              </div>
                              <div className="max-h-64 overflow-y-auto divide-y divide-amber-100">
                                {filteredEmployeesForEvent.length === 0 ? (
                                  <div className="py-6 text-center text-xs text-amber-700 font-medium">
                                    Tidak ada data pegawai yang sesuai dengan filter/pencarian.
                                  </div>
                                ) : (
                                  filteredEmployeesForEvent.map(emp => {
                                    const isAssigned = isEmployeeAssignedToEvent(emp);
                                    return (
                                      <div
                                        key={emp.id || emp.uid}
                                        onClick={() => toggleEmployeeEventAssignment(emp)}
                                        className={cn(
                                          "flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors select-none",
                                          isAssigned ? "bg-amber-50/80 hover:bg-amber-100/70" : "hover:bg-slate-50"
                                        )}
                                      >
                                        <div className="flex items-center gap-3 min-w-0">
                                          <input
                                            type="checkbox"
                                            checked={isAssigned}
                                            onChange={() => { }} // Handled by parent onClick
                                            className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                          />
                                          <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <p className="font-bold text-slate-800 text-xs truncate">{emp.displayName || emp.name || 'Pegawai'}</p>
                                              {emp.nip && (
                                                <span className="text-[9px] font-mono font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                                                  {emp.nip}
                                                </span>
                                              )}
                                              <span className="text-[9px] font-bold text-amber-700 bg-amber-100/60 border border-amber-200 px-1.5 py-0.2 rounded uppercase">
                                                {emp.bidang || 'Staff'}
                                              </span>
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-mono truncate">{emp.email || '-'}</p>
                                          </div>
                                        </div>
                                        <div>
                                          {isAssigned ? (
                                            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[8px] font-black uppercase tracking-wider px-2 py-0.5">
                                              Ditugaskan
                                            </Badge>
                                          ) : (
                                            <Badge variant="outline" className="text-slate-400 border-slate-200 text-[8px] font-semibold uppercase tracking-wider px-2 py-0.5">
                                              Tidak Ikut
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    <p className="text-[9px] text-amber-700 font-bold italic bg-amber-100/50 p-2.5 rounded-xl border border-amber-200/80">
                      * Mode Acara Luar aktif akan memperbolehkan absensi di luar jadwal reguler dan hari libur bagi pegawai yang ditugaskan, selama berada di dalam radius lokasi acara dan dalam jendela waktu yang ditentukan. Pegawai yang tidak ditugaskan tetap mengikuti jadwal shift normal.
                    </p>
                  </div>
                </div>

                {/* Tombol Simpan Konfigurasi Acara Luar */}
                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    onClick={saveSettings}
                    disabled={savingSettings}
                    className="h-10 px-6 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-widest shadow-md shadow-amber-200 transition-all active:scale-95"
                  >
                    <Save size={14} className="mr-2" />
                    {savingSettings ? 'Menyimpan Pengaturan...' : 'Simpan Pengaturan Acara Luar'}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* SubView 2: Event Logs Table */}
          {eventTabSubView === 'logs' && (
            <Card className="border border-slate-200 shadow-xs overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/80">
                    <TableRow className="border-b border-slate-200">
                      <TableHead className="font-black text-[9px] uppercase tracking-widest py-4">Identitas Pegawai</TableHead>
                      <TableHead className="font-black text-[9px] uppercase tracking-widest py-4">Nama Acara</TableHead>
                      <TableHead className="font-black text-[9px] uppercase tracking-widest py-4">Tanggal</TableHead>
                      <TableHead className="font-black text-[9px] uppercase tracking-widest py-4">Waktu Absen</TableHead>
                      <TableHead className="font-black text-[9px] uppercase tracking-widest py-4">Koordinat GPS</TableHead>
                      <TableHead className="font-black text-[9px] uppercase tracking-widest py-4 text-right">Selfie</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEventLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-xs font-medium text-slate-400 uppercase tracking-widest">Tidak ada rekaman absen acara</TableCell>
                      </TableRow>
                    ) : (
                      filteredEventLogs.map((log) => (
                        <TableRow key={log.id} className="group hover:bg-red-50/30 transition-colors border-b border-slate-100 last:border-0 italic">
                          <TableCell className="py-4">
                            <p className="font-black text-slate-800 text-[11px] leading-tight uppercase">{log.userName}</p>
                            <p className="text-[9px] text-slate-400 font-mono lower-case tracking-tight">{log.userEmail}</p>
                          </TableCell>
                          <TableCell className="py-4">
                            <Badge variant="outline" className="text-[9px] font-black uppercase bg-amber-50 text-amber-800 border-amber-300">
                              <Star size={9} className="mr-1 fill-amber-500 text-amber-500" />
                              {log.eventName || 'Acara Luar'}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4 font-bold text-slate-700 text-xs">{log.date}</TableCell>
                          <TableCell className="py-4 font-mono font-bold text-slate-800 text-xs">
                            {format(log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp), 'HH:mm:ss')}
                          </TableCell>
                          <TableCell className="py-4 font-mono text-[9px] text-slate-400">
                            {log.lat?.toFixed(5)}, {log.lng?.toFixed(5)}
                          </TableCell>
                          <TableCell className="text-right py-4">
                            <div className="inline-block">
                              <div
                                onClick={() => log.selfieUrl && setSelectedPhoto(log.selfieUrl)}
                                className={`h-10 w-10 rounded-lg overflow-hidden border border-slate-200 shadow-xs transition-all hover:ring-2 ring-red-500 scale-95 hover:scale-100 ${log.selfieUrl ? 'cursor-pointer' : ''}`}
                              >
                                {log.selfieUrl ? (
                                  <img src={log.selfieUrl} alt="Selfie" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-full h-full bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-300 uppercase">Tidak Ada Foto</div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {/* SubView 3: Assigned Officers Attendance Status */}
          {eventTabSubView === 'assigned' && (
            <Card className="border border-slate-200 shadow-xs overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/80">
                    <TableRow className="border-b border-slate-200">
                      <TableHead className="font-black text-[9px] uppercase tracking-widest py-3">Nama Pegawai</TableHead>
                      <TableHead className="font-black text-[9px] uppercase tracking-widest py-3">NIP / ID</TableHead>
                      <TableHead className="font-black text-[9px] uppercase tracking-widest py-3">Bidang</TableHead>
                      <TableHead className="font-black text-[9px] uppercase tracking-widest py-3">Status Kehadiran</TableHead>
                      <TableHead className="font-black text-[9px] uppercase tracking-widest py-3">Waktu Terakhir</TableHead>
                      <TableHead className="font-black text-[9px] uppercase tracking-widest py-3 text-right">Foto Selfie</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const assignedList = employees
                        .filter(emp => isEmployeeAssignedToEvent(emp))
                        .filter(emp => {
                          if (!eventSearchTerm) return true;
                          const term = eventSearchTerm.toLowerCase();
                          return (
                            (emp.displayName || emp.name || '').toLowerCase().includes(term) ||
                            (emp.email || '').toLowerCase().includes(term) ||
                            (emp.nip || '').toLowerCase().includes(term) ||
                            (emp.bidang || '').toLowerCase().includes(term)
                          );
                        });

                      if (assignedList.length === 0) {
                        return (
                          <TableRow>
                            <TableCell colSpan={6} className="py-10 text-center text-xs font-medium text-slate-400 uppercase tracking-widest">
                              {employees.some(emp => isEmployeeAssignedToEvent(emp))
                                ? 'Tidak ada petugas cocok dengan pencarian'
                                : 'Belum ada pegawai yang ditugaskan ke acara luar ini. Silakan atur di Tab Pengaturan & Petugas di atas.'}
                            </TableCell>
                          </TableRow>
                        );
                      }

                      return assignedList.map(emp => {
                        const empEmail = emp.email?.toLowerCase().trim();
                        const empId = emp.id || emp.uid;
                        const empEventLogs = logs.filter(
                          l => l.isEvent &&
                            l.date.startsWith(reportMonth) &&
                            (
                              (empEmail && l.userEmail?.toLowerCase().trim() === empEmail) ||
                              (empId && l.userId === empId)
                            )
                        );
                        const latestLog = empEventLogs[0];
                        const hasAttended = Boolean(latestLog);

                        return (
                          <TableRow key={emp.id || emp.uid} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                            <TableCell className="py-3">
                              <p className="font-bold text-slate-800 text-xs">{emp.displayName || emp.name || 'Pegawai'}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{emp.email || '-'}</p>
                            </TableCell>
                            <TableCell className="py-3 font-mono text-xs text-slate-600 font-semibold">
                              {emp.nip || '-'}
                            </TableCell>
                            <TableCell className="py-3">
                              <Badge variant="outline" className="text-[9px] font-bold uppercase bg-slate-50 text-slate-700 border-slate-200">
                                {emp.bidang || 'Staff'}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3">
                              {hasAttended ? (
                                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider gap-1">
                                  <Check size={10} /> Sudah Absen ({empEventLogs.length}x)
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 text-[9px] font-black uppercase tracking-wider">
                                  Belum Absen
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="py-3 font-mono text-xs text-slate-600">
                              {latestLog ? (
                                <div>
                                  <span className="font-bold text-slate-800">
                                    {format(latestLog.timestamp?.toDate ? latestLog.timestamp.toDate() : new Date(latestLog.timestamp), 'HH:mm:ss')}
                                  </span>
                                  <span className="text-[10px] text-slate-400 ml-1">({latestLog.date})</span>
                                </div>
                              ) : (
                                <span className="text-slate-300 italic">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right py-3">
                              {latestLog?.selfieUrl ? (
                                <div
                                  onClick={() => setSelectedPhoto(latestLog.selfieUrl)}
                                  className="inline-block h-8 w-8 rounded-md overflow-hidden border border-slate-200 shadow-xs cursor-pointer hover:ring-2 ring-red-500 transition-all"
                                >
                                  <img src={latestLog.selfieUrl} alt="Selfie" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                </div>
                              ) : (
                                <span className="text-slate-300 text-xs italic">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      });
                    })()}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="laporan" className="space-y-6 mt-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
              <Button variant={reportType === 'harian' ? 'default' : 'ghost'} size="sm" onClick={() => setReportType('harian')} className="h-8 text-[10px] font-black uppercase tracking-widest"><CalendarRange size={14} className="mr-2" /> Harian</Button>
              <Button variant={reportType === 'bulanan' ? 'default' : 'ghost'} size="sm" onClick={() => setReportType('bulanan')} className="h-8 text-[10px] font-black uppercase tracking-widest"><Clock size={14} className="mr-2" /> Bulanan</Button>
            </div>
            <div className="flex gap-2 items-center">
              {reportType === 'harian' ? (
                <>
                  <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="h-9 font-mono text-xs w-40 bg-white" />
                  <Button onClick={exportLaporanHarian} size="sm" variant="outline" className="h-9 border-slate-200 shadow-sm text-[10px] font-black uppercase"><Download size={14} className="mr-1" /> Export Harian</Button>
                </>
              ) : (
                <>
                  <Input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="h-9 font-mono text-xs w-40 bg-white" />
                  <Button onClick={exportLaporanBulanan} size="sm" variant="outline" className="h-9 border-slate-200 shadow-sm text-[10px] font-black uppercase"><Download size={14} className="mr-1" /> Export Bulanan</Button>
                </>
              )}
            </div>
          </div>

          {isSuperAdmin && (
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex-1 w-full">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">Impor Riwayat Absen</h4>
                <p className="text-[10px] text-slate-500 font-bold">Masukkan data absensi historis via Excel (format grid/jadwal).</p>
                {isImportingHistory && historyImportTotal > 0 && (
                  <div className="mt-3 w-full max-w-md">
                    <div className="flex justify-between text-[9px] font-bold text-slate-500 mb-1 uppercase">
                      <span>Proses Impor...</span>
                      <span>{Math.round((historyImportProgress / historyImportTotal) * 100)}% ({historyImportProgress}/{historyImportTotal})</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${Math.round((historyImportProgress / historyImportTotal) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2 items-center">
                <Input
                  type="month"
                  value={historyImportMonth}
                  onChange={(e) => setHistoryImportMonth(e.target.value)}
                  className="h-9 font-mono text-xs w-40 bg-white"
                  disabled={isImportingHistory}
                />
                <Button onClick={downloadHistoryTemplate} disabled={isImportingHistory} size="sm" variant="outline" className="h-9 border-slate-200 shadow-sm text-[10px] font-black uppercase text-slate-600">
                  Unduh Template
                </Button>
                <Button
                  onClick={() => historyFileRef.current?.click()}
                  disabled={isImportingHistory || isClearingData}
                  size="sm"
                  variant="outline"
                  className="h-9 border-slate-200 shadow-sm text-[10px] font-black uppercase text-blue-600 hover:text-white hover:bg-blue-600"
                >
                  <Upload size={14} className="mr-1" /> {isImportingHistory ? 'Mengimpor...' : 'Impor Data'}
                </Button>
                <Button
                  onClick={clearMonthData}
                  disabled={isImportingHistory || isClearingData}
                  size="sm"
                  variant="outline"
                  className="h-9 border-slate-200 shadow-sm text-[10px] font-black uppercase text-red-600 hover:text-white hover:bg-red-600"
                >
                  <Trash2 size={14} className={`mr-1 ${isClearingData ? 'animate-spin' : ''}`} /> {isClearingData ? 'Menghapus...' : 'Bersihkan Data'}
                </Button>
                <input type="file" ref={historyFileRef} className="hidden" accept=".xlsx, .xls" onChange={importHistoryExcel} />
              </div>
            </div>
          )}

          <Card className="border border-slate-200 shadow-sm overflow-hidden bg-white">
            {reportType === 'harian' ? (
              <>
                <CardHeader className="p-4 border-b bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Laporan Presensi Harian: {(() => {
                        const [y, m, d] = reportDate.split('-');
                        return `${d}-${m}-${y}`;
                      })()}
                    </h3>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-1">Total Pegawai: {statsHarian.all} Orang</p>
                  </div>
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                    <Input
                      placeholder="Cari nama, ID Pegawai, bidang..."
                      className="pl-9 h-8 bg-white border-slate-200 text-xs font-medium placeholder:text-slate-300 focus-visible:ring-red-500 shadow-sm"
                      value={dailySearchTerm}
                      onChange={(e) => setDailySearchTerm(e.target.value)}
                    />
                  </div>
                </CardHeader>

                <div className="p-4 border-b bg-slate-50/20 flex flex-wrap gap-2 items-center">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-2">Filter Status:</span>
                  <button
                    onClick={() => setDailyStatusFilter('all')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 border",
                      dailyStatusFilter === 'all'
                        ? "bg-slate-800 text-white border-slate-800 shadow-sm scale-105"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    Semua
                    <span className={cn(
                      "px-1.5 py-0.5 rounded-full text-[8px] font-mono",
                      dailyStatusFilter === 'all' ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                    )}>{statsHarian.all}</span>
                  </button>

                  <button
                    onClick={() => setDailyStatusFilter('tepat_waktu')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 border",
                      dailyStatusFilter === 'tepat_waktu'
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm scale-105"
                        : "bg-white text-emerald-600 border-slate-200 hover:bg-emerald-50/30"
                    )}
                  >
                    Tepat Waktu
                    <span className={cn(
                      "px-1.5 py-0.5 rounded-full text-[8px] font-mono",
                      dailyStatusFilter === 'tepat_waktu' ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-600"
                    )}>{statsHarian.tepatWaktu}</span>
                  </button>

                  <button
                    onClick={() => setDailyStatusFilter('terlambat')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 border",
                      dailyStatusFilter === 'terlambat'
                        ? "bg-amber-500 text-white border-amber-500 shadow-sm scale-105"
                        : "bg-white text-amber-600 border-slate-200 hover:bg-amber-50/30"
                    )}
                  >
                    Terlambat
                    <span className={cn(
                      "px-1.5 py-0.5 rounded-full text-[8px] font-mono",
                      dailyStatusFilter === 'terlambat' ? "bg-white/20 text-white" : "bg-amber-50 text-amber-600"
                    )}>{statsHarian.terlambat}</span>
                  </button>

                  <button
                    onClick={() => setDailyStatusFilter('izin')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 border",
                      dailyStatusFilter === 'izin'
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm scale-105"
                        : "bg-white text-blue-600 border-slate-200 hover:bg-blue-50/30"
                    )}
                  >
                    Izin / Sakit
                    <span className={cn(
                      "px-1.5 py-0.5 rounded-full text-[8px] font-mono",
                      dailyStatusFilter === 'izin' ? "bg-white/20 text-white" : "bg-blue-50 text-blue-600"
                    )}>{statsHarian.izin}</span>
                  </button>

                  <button
                    onClick={() => setDailyStatusFilter('alfa')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 border",
                      dailyStatusFilter === 'alfa'
                        ? "bg-rose-600 text-white border-rose-600 shadow-sm scale-105"
                        : "bg-white text-rose-600 border-slate-200 hover:bg-rose-50/30"
                    )}
                  >
                    Alfa
                    <span className={cn(
                      "px-1.5 py-0.5 rounded-full text-[8px] font-mono",
                      dailyStatusFilter === 'alfa' ? "bg-white/20 text-white" : "bg-rose-50 text-rose-600"
                    )}>{statsHarian.alfa}</span>
                  </button>

                  <button
                    onClick={() => setDailyStatusFilter('libur')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 border",
                      dailyStatusFilter === 'libur'
                        ? "bg-slate-500 text-white border-slate-500 shadow-sm scale-105"
                        : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    Libur
                    <span className={cn(
                      "px-1.5 py-0.5 rounded-full text-[8px] font-mono",
                      dailyStatusFilter === 'libur' ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                    )}>{statsHarian.libur}</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/80">
                      <TableRow>
                        <TableHead className="font-black text-[9px] uppercase tracking-widest py-4">Nama Pegawai</TableHead>
                        <TableHead className="font-black text-[9px] uppercase tracking-widest py-4">ID Pegawai / Bidang</TableHead>
                        <TableHead className="font-black text-[9px] uppercase tracking-widest py-4">Status / Waktu</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDailyReportData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="py-8 text-center">
                            <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                              <Search size={24} className="text-slate-300 stroke-[1.5]" />
                              <p className="text-xs font-black uppercase tracking-widest">Tidak ada data pegawai</p>
                              <p className="text-[10px] font-medium text-slate-400 normal-case">Coba sesuaikan kata kunci pencarian atau filter status Anda.</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredDailyReportData.map((item, idx) => (
                          <TableRow key={idx} className="group hover:bg-slate-50 border-b border-slate-100 last:border-0 italic">
                            <TableCell className="py-4">
                              <p className="font-black text-slate-800 text-[11px] leading-tight uppercase">{item.displayName || item.name || 'Unknown'}</p>
                              <p className="text-[9px] text-slate-400 font-mono tracking-tight">{item.email}</p>
                            </TableCell>
                            <TableCell className="py-4">
                              <p className="font-mono text-[10px] text-slate-500">{item.nip || '-'}</p>
                              <Badge variant="secondary" className="text-[9px] font-bold uppercase py-0 px-2 mt-1 bg-slate-100 text-slate-600">{item.bidang || '-'}</Badge>
                            </TableCell>
                            <TableCell className="py-4">
                              {item.log ? (
                                item.log.isLeave ? (
                                  <>
                                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter border-amber-200 text-amber-700 bg-amber-50">
                                      IZIN / SAKIT / CUTI ({item.log.leaveType})
                                    </Badge>
                                    {item.log.leaveReason && (
                                      <p className="text-[9px] font-semibold text-slate-500 mt-1 uppercase italic">
                                        Alasan: {item.log.leaveReason}
                                      </p>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    {item.log.isLate ? (
                                      <>
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter bg-amber-500 text-white shadow-xs">
                                          TERLAMBAT
                                        </span>
                                        <div className="text-[9px] font-black text-amber-600 mt-1 uppercase tracking-tighter">
                                          Terlambat: {Math.floor((item.log.lateDuration || 0) / 60)} Menit
                                        </div>
                                      </>
                                    ) : (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter bg-emerald-600 text-white shadow-xs">
                                        TEPAT WAKTU
                                      </span>
                                    )}
                                    <div className="text-[10px] font-mono text-slate-500 mt-1">
                                      {format(item.log.timestamp?.toDate ? item.log.timestamp.toDate() : new Date(item.log.timestamp), 'HH:mm:ss')} | {item.log.checkOutTimestamp ? format(item.log.checkOutTimestamp?.toDate ? item.log.checkOutTimestamp.toDate() : new Date(item.log.checkOutTimestamp), 'HH:mm:ss') : '--:--:--'}
                                    </div>
                                  </>
                                )
                              ) : item.roster && item.roster.shiftName !== 'OFF' && item.roster.shiftName !== 'Libur' ? (
                                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter border-rose-200 text-rose-500 bg-rose-50/50">
                                  <AlertTriangle size={10} className="mr-1" /> ALFA / TIDAK ABSEN
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter border-slate-200 text-slate-400 bg-slate-50/50">
                                  LIBUR / TIDAK TERJADWAL
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <>
                <CardHeader className="p-4 border-b bg-slate-50/50">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Hari Kerja Efektif: {monthlyReportData[0]?.workingDays || 0} Hari (sd Hari Ini)</h3>
                </CardHeader>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/80">
                      <TableRow>
                        <TableHead className="font-black text-[9px] uppercase tracking-widest py-4">Nama Pegawai</TableHead>
                        <TableHead className="font-black text-[9px] uppercase tracking-widest py-4 text-center">Hadir</TableHead>
                        <TableHead className="font-black text-[9px] uppercase tracking-widest py-4 text-center">Tepat Wkt</TableHead>
                        <TableHead className="font-black text-[9px] uppercase tracking-widest py-4 text-center">Terlambat</TableHead>
                        <TableHead className="font-black text-[9px] uppercase tracking-widest py-4 text-center">Total Terlambat</TableHead>
                        <TableHead className="font-black text-[9px] uppercase tracking-widest py-4 text-center text-rose-600">Alfa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyReportData.map((item, idx) => (
                        <TableRow key={idx} className="group hover:bg-slate-50 border-b border-slate-100 last:border-0 italic">
                          <TableCell className="py-4">
                            <p className="font-black text-slate-800 text-[11px] leading-tight uppercase">{item.displayName || item.name || 'Unknown'}</p>
                            <p className="text-[9px] text-slate-400 font-mono tracking-tight">{item.bidang || '-'}</p>
                          </TableCell>
                          <TableCell className="py-4 text-center font-black text-[12px] text-red-600">
                            {item.totalHadir}
                            <p className="text-[9px] font-bold text-slate-400 mt-0.5">{getPercentage(item.totalHadir, item.workingDays)}</p>
                          </TableCell>
                          <TableCell className="py-4 text-center font-bold text-[11px] text-emerald-600">
                            {item.totalTepatWaktu}
                            <p className="text-[9px] font-bold text-emerald-500/80 mt-0.5">{getPercentage(item.totalTepatWaktu, item.workingDays)}</p>
                          </TableCell>
                          <TableCell className="py-4 text-center font-bold text-[11px] text-amber-500">
                            {item.totalTelat}
                            <p className="text-[9px] font-bold text-amber-400 mt-0.5">{getPercentage(item.totalTelat, item.workingDays)}</p>
                          </TableCell>
                          <TableCell className="py-4 text-center font-bold text-[9px] text-rose-600">
                            {formatDuration(item.totalLateDuration)}
                          </TableCell>
                          <TableCell className="py-4 text-center font-black text-[12px] text-rose-600 bg-rose-50/30">
                            {item.alfa}
                            <p className="text-[9px] font-bold text-rose-500/80 mt-0.5">{getPercentage(item.alfa, item.workingDays)}</p>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </Card>
        </TabsContent>
        <TabsContent value="roster" className="space-y-6 mt-6 italic">
          {/* Monitoring Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden">
              <div className="p-4 flex flex-col justify-center border-l-4 border-red-500">
                <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest mb-1">Harusnya Hadir Hari Ini</p>
                <h3 className="text-2xl font-black text-slate-800 tabular-nums">
                  {rosters.filter(r => r.date === format(new Date(), 'yyyy-MM-dd') && r.shiftName !== 'OFF' && r.shiftName !== 'Libur').length}
                </h3>
                <p className="text-[8px] font-bold text-slate-400 uppercase">Sesuai Jadwal Piket</p>
              </div>
            </Card>
            <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden">
              <div className="p-4 flex flex-col justify-center border-l-4 border-emerald-500">
                <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest mb-1">Sudah Absen</p>
                <h3 className="text-2xl font-black text-emerald-600 tabular-nums">
                  {rosters.filter(r => {
                    const isToday = r.date === format(new Date(), 'yyyy-MM-dd');
                    const hasLog = logs.some(l => l.date === r.date && l.shiftName === r.shiftName && (l.userId === r.userId || l.userEmail === r.userEmail));
                    return isToday && r.shiftName !== 'OFF' && r.shiftName !== 'Libur' && hasLog;
                  }).length}
                </h3>
                <p className="text-[8px] font-bold text-slate-400 uppercase">Terverifikasi Sistem</p>
              </div>
            </Card>
            <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden">
              <div className="p-4 flex flex-col justify-center border-l-4 border-rose-500">
                <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest mb-1">Tidak Absen (Bolos/Telat)</p>
                <h3 className="text-2xl font-black text-rose-600 tabular-nums">
                  {rosters.filter(r => {
                    const isToday = r.date === format(new Date(), 'yyyy-MM-dd');
                    const hasLog = logs.some(l => l.date === r.date && l.shiftName === r.shiftName && (l.userId === r.userId || l.userEmail === r.userEmail));
                    const hasLeave = logs.some(l => l.date === r.date && l.isLeave === true && (l.userId === r.userId || l.userEmail === r.userEmail));
                    return isToday && r.shiftName !== 'OFF' && r.shiftName !== 'Libur' && !hasLog && !hasLeave;
                  }).length}
                </h3>
                <p className="text-[8px] font-bold text-rose-400 uppercase animate-pulse">Perlu Tindak Lanjut</p>
              </div>
            </Card>
          </div>

          {/* List Monitoring Detail */}
          {rosters.filter(r => {
            const isToday = r.date === format(new Date(), 'yyyy-MM-dd');
            const hasLog = logs.some(l => l.date === r.date && l.shiftName === r.shiftName && (l.userId === r.userId || l.userEmail === r.userEmail));
            const hasLeave = logs.some(l => l.date === r.date && l.isLeave === true && (l.userId === r.userId || l.userEmail === r.userEmail));
            return isToday && r.shiftName !== 'OFF' && r.shiftName !== 'Libur' && !hasLog && !hasLeave;
          }).length > 0 && (
              <Card className="border border-rose-200 shadow-md bg-rose-50/30 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
                <CardHeader className="p-4 border-b border-rose-100 bg-rose-50 flex flex-row items-center justify-between">
                  <CardTitle className="text-[10px] font-black text-rose-700 uppercase tracking-widest flex items-center gap-2">
                    <AlertTriangle size={14} className="text-rose-500 animate-bounce" />
                    Daftar Tidak Absen Hari Ini
                  </CardTitle>
                  <Badge variant="outline" className="bg-white border-rose-200 text-rose-600 text-[8px] font-black uppercase">Segera Cek</Badge>
                </CardHeader>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-rose-100">
                        <TableHead className="text-[9px] font-black uppercase text-rose-600/70">Nama Pegawai</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-rose-600/70">Bidang</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-rose-600/70 text-center">Shift</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-rose-600/70 text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rosters.filter(r => {
                        const isToday = r.date === format(new Date(), 'yyyy-MM-dd');
                        const hasLog = logs.some(l => l.date === r.date && l.shiftName === r.shiftName && (l.userId === r.userId || l.userEmail === r.userEmail));
                        const hasLeave = logs.some(l => l.date === r.date && l.isLeave === true && (l.userId === r.userId || l.userEmail === r.userEmail));
                        return isToday && r.shiftName !== 'OFF' && r.shiftName !== 'Libur' && !hasLog && !hasLeave;
                      }).map((m, idx) => (
                        <TableRow key={idx} className="border-b border-rose-50 last:border-0 hover:bg-rose-100/30 transition-colors">
                          <TableCell className="py-3">
                            <p className="font-black text-slate-800 text-[10px] uppercase">{m.userName}</p>
                          </TableCell>
                          <TableCell className="py-3">
                            <p className="text-[9px] text-slate-500 font-bold uppercase">{m.bidang}</p>
                          </TableCell>
                          <TableCell className="py-3 text-center">
                            <Badge className={cn(
                              "text-[8px] font-black px-2 py-0",
                              m.shiftName === 'Pagi' ? "bg-emerald-500" : m.shiftName === 'Sore' ? "bg-amber-500" : "bg-red-500"
                            )}>
                              {m.shiftName}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3 text-right">
                            <span className="text-[8px] font-black text-rose-500 uppercase tracking-tighter italic">Belum Ada Rekaman</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}

          <Card className="border border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="p-4 border-b bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1 w-full">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Manajemen Jadwal Piket</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Input jadwal piket harian pegawai</p>
                {isImportingRoster && rosterImportTotal > 0 && (
                  <div className="mt-3 w-full max-w-md">
                    <div className="flex justify-between text-[9px] font-bold text-slate-500 mb-1 uppercase">
                      <span>Proses Impor...</span>
                      <span>{Math.round((rosterImportProgress / rosterImportTotal) * 100)}% ({rosterImportProgress}/{rosterImportTotal})</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-2 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${Math.round((rosterImportProgress / rosterImportTotal) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="month"
                  value={rosterMonth}
                  onChange={(e) => {
                    setRosterMonth(e.target.value);
                    fetchRosters(e.target.value);
                  }}
                  className="h-8 text-[10px] w-40 bg-white"
                  disabled={isImportingRoster}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => rosterFileRef.current?.click()}
                  disabled={isImportingRoster}
                  className="h-8 text-[9px] font-black uppercase tracking-widest border-slate-200"
                >
                  <Upload size={14} className="mr-1.5" /> {isImportingRoster ? 'Mengimpor...' : 'Impor Jadwal'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={downloadJadwalTemplate}
                  disabled={isImportingRoster}
                  className="h-8 text-[8px] font-bold uppercase tracking-widest text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Download size={12} className="mr-1.5" /> Template
                </Button>
                <input type="file" ref={rosterFileRef} className="hidden" accept=".xlsx, .xls" onChange={importRosterExcel} />
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow>
                    <TableHead className="sticky left-0 bg-slate-50 z-20 font-black text-[9px] uppercase tracking-widest py-4 border-r shadow-[2px_0_5px_rgba(0,0,0,0.05)]">Pegawai</TableHead>
                    {rosterMonth && eachDayOfInterval({
                      start: startOfMonth(parse(rosterMonth, 'yyyy-MM', new Date())),
                      end: endOfMonth(parse(rosterMonth, 'yyyy-MM', new Date()))
                    }).map(date => (
                      <TableHead key={format(date, 'yyyy-MM-dd')} className="text-center min-w-[50px] font-black text-[9px] uppercase tracking-widest py-2 px-1 border-r last:border-0">
                        <span className="opacity-50">{format(date, 'EEE')}</span><br />
                        <span className="text-slate-800">{format(date, 'dd')}</span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    // Group approved employees by bidang
                    const bidangOrder: string[] = [];
                    const bidangGroups: Record<string, any[]> = {};
                    approvedEmployees.forEach(emp => {
                      const bidang = (emp.bidang || 'LAINNYA').toUpperCase();
                      if (!bidangGroups[bidang]) {
                        bidangGroups[bidang] = [];
                        bidangOrder.push(bidang);
                      }
                      bidangGroups[bidang].push(emp);
                    });

                    const rows: React.ReactNode[] = [];
                    const dayIntervals = rosterMonth ? eachDayOfInterval({
                      start: startOfMonth(parse(rosterMonth, 'yyyy-MM', new Date())),
                      end: endOfMonth(parse(rosterMonth, 'yyyy-MM', new Date()))
                    }) : [];
                    const totalCols = dayIntervals.length;

                    bidangOrder.forEach(bidang => {
                      // Bidang header row
                      rows.push(
                        <TableRow key={`header-${bidang}`} className="bg-slate-100 hover:bg-slate-100">
                          <TableCell
                            colSpan={totalCols + 1}
                            className="sticky left-0 py-2 px-3 border-r bg-slate-100 z-10"
                          >
                            <span className="text-[9px] font-black uppercase tracking-widest text-red-700 flex items-center gap-2">
                              <span className="inline-block w-2 h-2 rounded-full bg-red-500"></span>
                              {bidang}
                              <span className="font-normal text-slate-400 ml-1">{bidangGroups[bidang].length} pegawai</span>
                            </span>
                          </TableCell>
                        </TableRow>
                      );

                      // Employee rows in this bidang
                      bidangGroups[bidang].forEach(emp => {
                        rows.push(
                          <TableRow key={emp.id} className="hover:bg-slate-50 italic">
                            <TableCell className="sticky left-0 bg-white z-10 py-3 border-r min-w-[150px] shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                              <p className="font-black text-slate-800 text-[10px] uppercase leading-tight">{emp.displayName || emp.name}</p>
                              <p className="text-[8px] text-slate-400 font-mono">{emp.bidang || '-'}</p>
                            </TableCell>
                            {dayIntervals.map(date => {
                              const dateStr = format(date, 'yyyy-MM-dd');
                              const roster = rosters.find(r => r.userId === (emp.id || emp.uid) && r.date === dateStr);
                              return (
                                <TableCell key={dateStr} className="p-0 text-center border-r last:border-0 h-12">
                                  <select
                                    value={roster?.shiftName || ''}
                                    onChange={(e) => updateRoster(emp.id || emp.uid, dateStr, e.target.value)}
                                    className={cn(
                                      "w-full h-full text-[9px] font-black p-0 text-center border-none appearance-none cursor-pointer focus:ring-1 focus:ring-inset focus:ring-red-500 bg-transparent transition-colors",
                                      roster?.shiftName === 'Pagi' ? "bg-emerald-50 text-emerald-700" :
                                        roster?.shiftName === 'Sore' ? "bg-amber-50 text-amber-700" :
                                          roster?.shiftName === 'Malam' ? "bg-orange-50 text-orange-700" :
                                            roster?.shiftName === 'Libur' ? "bg-rose-50 text-rose-700" :
                                              roster?.shiftName === 'OFF' ? "bg-slate-100 text-slate-500" : "text-slate-200"
                                    )}
                                  >
                                    <option value="" className="text-slate-300">-</option>
                                    <option value="Pagi" className="bg-white text-emerald-600 font-bold">P</option>
                                    <option value="Sore" className="bg-white text-amber-600 font-bold">S</option>
                                    <option value="Malam" className="bg-white text-orange-600 font-bold">M</option>
                                    <option value="Libur" className="bg-white text-rose-600 font-bold">L</option>
                                    <option value="OFF" className="bg-white text-slate-500 font-bold text-[8px]">OFF</option>
                                  </select>
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      });
                    });

                    return rows;
                  })()}
                </TableBody>
              </Table>
            </div>
            <CardFooter className="p-3 bg-slate-50 border-t flex justify-between items-center">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">P: Pagi | S: Sore | M: Malam | L: Libur | OFF: Tidak Tetap</p>
              <p className="text-[8px] font-bold text-red-500 uppercase tracking-widest">Klik sel untuk mengubah shift</p>
            </CardFooter>
          </Card>
        </TabsContent>
        <TabsContent value="employees" className="space-y-6 mt-6">
          <Card className="border border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="p-4 border-b bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Direktori Pegawai</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Kelola akses & izin</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-[9px] font-black uppercase tracking-widest border-slate-200"
                  onClick={() => setShowAddForm(!showAddForm)}
                >
                  <UserPlus size={14} className="mr-1.5" /> {showAddForm ? 'Batal' : 'Tambah Pegawai'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-[9px] font-black uppercase tracking-widest border-slate-200"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                >
                  <Upload size={14} className="mr-1.5" /> {isImporting ? 'Mengimpor...' : 'Impor Excel'}
                </Button>
                {isImporting && employeeImportTotal > 0 && (
                  <div className="w-32 ml-2">
                    <div className="flex justify-between text-[8px] font-bold text-slate-500 mb-0.5 uppercase">
                      <span>Proses...</span>
                      <span>{Math.round((employeeImportProgress / employeeImportTotal) * 100)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-red-500 h-1.5 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${Math.round((employeeImportProgress / employeeImportTotal) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-[9px] font-black uppercase tracking-widest border-rose-200 text-rose-600 hover:bg-rose-50"
                  onClick={handleDeduplicate}
                  disabled={isDeduplicating}
                >
                  <Trash2 size={14} className="mr-1.5" /> {isDeduplicating ? 'Membersihkan...' : 'Bersihkan Duplikat'}
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleExcelImport}
                />

                <div id="employee-search-container" className="relative w-full sm:w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3" />
                  <Input
                    placeholder="Cari..."
                    className="pl-8 h-8 bg-white border-slate-200 text-[10px] font-medium placeholder:text-slate-300 focus-visible:ring-red-500"
                    value={employeeSearchTerm}
                    onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>

            {showAddForm && (
              <div className="p-4 bg-slate-50/50 border-b border-slate-200 animate-in fade-in slide-in-from-top-2 duration-200">
                <form onSubmit={manualAddEmployee} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-slate-400">Nama Lengkap</Label>
                    <Input
                      placeholder="misal: John Doe"
                      value={newEmployee.name}
                      onChange={e => setNewEmployee({ ...newEmployee, name: e.target.value })}
                      className="h-8 text-[10px] bg-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-slate-400">Alamat Email</Label>
                    <Input
                      placeholder="email@perusahaan.com"
                      type="email"
                      value={newEmployee.email}
                      onChange={e => setNewEmployee({ ...newEmployee, email: e.target.value })}
                      className="h-8 text-[10px] bg-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-slate-400">ID Pegawai</Label>
                    <Input
                      placeholder="ID Pegawai"
                      value={newEmployee.nip}
                      onChange={e => setNewEmployee({ ...newEmployee, nip: e.target.value })}
                      className="h-8 text-[10px] bg-white font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-slate-400">Bidang</Label>
                    <select
                      value={newEmployee.bidang}
                      onChange={e => setNewEmployee({ ...newEmployee, bidang: e.target.value })}
                      className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-[10px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500"
                    >
                      {departments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-slate-400">Peran Sistem</Label>
                    <select
                      value={newEmployee.role}
                      onChange={e => setNewEmployee({ ...newEmployee, role: e.target.value })}
                      className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-[10px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500"
                    >
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <Button
                    type="submit"
                    disabled={isAddingEmployee}
                    className="h-8 bg-red-600 text-white font-black text-[9px] uppercase tracking-widest"
                  >
                    {isAddingEmployee ? 'Menambahkan...' : 'Konfirmasi Tambah'}
                  </Button>
                </form>
              </div>
            )}

            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow className="border-b border-slate-200">
                    <TableHead className="font-black text-[9px] uppercase tracking-widest py-4">Nama Pegawai</TableHead>
                    <TableHead className="font-black text-[9px] uppercase tracking-widest py-4">ID Pegawai</TableHead>
                    <TableHead className="font-black text-[9px] uppercase tracking-widest py-4">Bidang</TableHead>
                    <TableHead className="font-black text-[9px] uppercase tracking-widest py-4">Email Kontak</TableHead>
                    <TableHead className="font-black text-[9px] uppercase tracking-widest py-4">Peran / Akses</TableHead>
                    <TableHead className="font-black text-[9px] uppercase tracking-widest py-4">Bergabung</TableHead>
                    <TableHead className="font-black text-[9px] uppercase tracking-widest py-4 text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((emp) => (
                    <TableRow key={emp.id} className="group hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 italic">
                      <TableCell className="py-4">
                        <p className="font-black text-slate-800 text-[11px] leading-tight uppercase">{emp.displayName || emp.name || 'Unknown'}</p>
                      </TableCell>
                      <TableCell className="py-4 font-mono text-[10px] text-slate-500">
                        {emp.nip || '-'}
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant="secondary" className="text-[9px] font-bold uppercase py-0 px-2 bg-slate-100 text-slate-600">
                          {emp.bidang || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 font-mono text-[10px] text-slate-400">
                        {emp.email}
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className={`w-fit text-[9px] font-black uppercase ${emp.role === 'admin' ? 'border-red-200 text-red-700 bg-red-50' : 'border-slate-200 text-slate-500 bg-slate-50'}`}>
                            {emp.role}
                          </Badge>
                          {emp.status && (
                            <Badge variant="outline" className={`w-fit text-[8px] font-bold uppercase ${emp.status === 'approved' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' :
                              emp.status === 'pending' ? 'border-amber-200 text-amber-600 bg-amber-50 animate-pulse' :
                                'border-rose-200 text-rose-600 bg-rose-50'
                              }`}>
                              {emp.status}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-4 text-[10px] font-mono text-slate-400">
                        {emp.createdAt?.toDate ? format(emp.createdAt.toDate(), 'dd/MM/yyyy') : 'N/A'}
                      </TableCell>
                      <TableCell className="py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {emp.email === 'aliefneutron@gmail.com' ? (
                            <Badge className="bg-red-600 text-white text-[8px] font-black uppercase tracking-widest px-3 py-1 border-none shadow-sm">
                              Master Admin
                            </Badge>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startEditEmployee(emp)}
                                className="h-7 w-7 p-0 border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-red-600 transition-all"
                              >
                                <Edit2 size={12} />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => confirmDeleteEmployee(emp)}
                                className="h-7 w-7 p-0 border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-all"
                              >
                                <Trash2 size={12} />
                              </Button>
                              <div className="w-px h-7 bg-slate-100 mx-1" />
                              {emp.deviceId ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => confirmResetDevice(emp)}
                                  className="h-7 text-[8px] font-black uppercase tracking-widest border-rose-200 text-rose-600 hover:bg-rose-50 px-2"
                                >
                                  <RefreshCw size={10} className="mr-1" /> Reset Perangkat
                                </Button>
                              ) : (
                                <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest italic pr-2 self-center">Tidak Ada Perangkat</span>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center text-slate-400 font-bold uppercase tracking-widest">
                        Tidak ada pegawai yang ditemukan sesuai kriteria
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="approvals" className="space-y-6 mt-6">
          <Card className="border border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="p-4 border-b bg-slate-50/50">
              <div>
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Persetujuan Akun Baru</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Tinjau permohonan registrasi pegawai</p>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow className="border-b border-slate-200">
                    <TableHead className="font-black text-[9px] uppercase tracking-widest py-4">Nama Pegawai</TableHead>
                    <TableHead className="font-black text-[9px] uppercase tracking-widest py-4">ID Pegawai</TableHead>
                    <TableHead className="font-black text-[9px] uppercase tracking-widest py-4">Bidang</TableHead>
                    <TableHead className="font-black text-[9px] uppercase tracking-widest py-4">Email</TableHead>
                    <TableHead className="font-black text-[9px] uppercase tracking-widest py-4">Status</TableHead>
                    <TableHead className="font-black text-[9px] uppercase tracking-widest py-4 text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingEmployees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/50">
                        Tidak ada permohonan persetujuan tertunda.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendingEmployees.map((emp) => (
                      <TableRow key={emp.id} className="hover:bg-slate-50/50 transition-colors border-b">
                        <TableCell className="font-bold text-xs text-slate-800 py-3">{emp.displayName || emp.name}</TableCell>
                        <TableCell className="font-mono text-xs text-slate-600 py-3">{emp.nip || '-'}</TableCell>
                        <TableCell className="text-xs text-slate-700 py-3">
                          <Badge variant="outline" className="font-bold text-[9px] bg-slate-50 border-slate-200 text-slate-700">
                            {emp.bidang || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 py-3">{emp.email}</TableCell>
                        <TableCell className="py-3">
                          <Badge variant="outline" className="font-black text-[9px] bg-amber-50 border-amber-200 text-amber-600 animate-pulse uppercase tracking-widest">
                            {emp.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right py-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] uppercase tracking-wider h-8"
                              onClick={() => handleApproveUser(emp.id || emp.uid)}
                            >
                              <Check size={12} className="mr-1" /> Setujui
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="bg-rose-600 hover:bg-rose-700 text-white font-black text-[9px] uppercase tracking-wider h-8"
                              onClick={() => handleRejectUser(emp.id || emp.uid)}
                            >
                              <X size={12} className="mr-1" /> Tolak
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-6 space-y-6">
          <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b p-4">
              <CardTitle className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex gap-2 items-center">
                <Clock size={14} className="text-red-500" /> Siklus Shift & Tugas
              </CardTitle>
              <CardDescription className="text-xs font-medium text-slate-400">Konfigurasi shift, jendela operasional, dan masa tenggang.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              {/* Shift Configuration */}
              <div className="space-y-4">
                <Label className="text-[11px] font-black uppercase text-red-600 tracking-wider">Jadwal Shift & Jendela Waktu</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(settings.shifts || []).map((shift, idx) => {
                    const tol = shift.toleranceMinutes ?? 30;
                    const shiftBase = parse(shift.startTime || '07:00', 'HH:mm', new Date());
                    const onTimeLimit = format(addMinutes(shiftBase, tol), 'HH:mm');
                    const lateStart = format(addMinutes(shiftBase, tol + 1), 'HH:mm');

                    return (
                      <Card key={idx} className="border border-slate-200 shadow-sm bg-slate-50/50 p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <Badge className="bg-red-600 text-white font-black text-[9px] uppercase tracking-widest">Shift {shift.name}</Badge>
                          <span className="text-[9px] font-bold text-slate-400 uppercase italic">Toleransi: {tol} Menit</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase text-slate-400">Waktu Mulai</Label>
                            <Input
                              type="time"
                              value={shift.startTime}
                              className="h-8 text-[10px] font-mono bg-white border-slate-200 px-2"
                              onChange={(e) => {
                                const newShifts = [...(settings.shifts || [])];
                                newShifts[idx].startTime = e.target.value;
                                setSettings({ ...settings, shifts: newShifts });
                              }}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase text-slate-400">Waktu Selesai</Label>
                            <Input
                              type="time"
                              value={shift.endTime}
                              className="h-8 text-[10px] font-mono bg-white border-slate-200 px-2"
                              onChange={(e) => {
                                const newShifts = [...(settings.shifts || [])];
                                newShifts[idx].endTime = e.target.value;
                                setSettings({ ...settings, shifts: newShifts });
                              }}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase text-slate-400">Toleransi (Mnt)</Label>
                            <Input
                              type="number"
                              min={0}
                              max={180}
                              value={shift.toleranceMinutes ?? 30}
                              className="h-8 text-[10px] font-mono bg-white border-slate-200 px-2"
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                const newShifts = [...(settings.shifts || [])];
                                newShifts[idx].toleranceMinutes = isNaN(val) ? 0 : val;
                                setSettings({ ...settings, shifts: newShifts });
                              }}
                            />
                          </div>
                        </div>
                        <div className="pt-1 border-t border-slate-200">
                          <p className="text-[8px] font-bold text-slate-400 uppercase leading-tight italic">
                            * Absen mulai {shift.startTime} WIB. Tepat waktu s/d {onTimeLimit} WIB (Terlambat mulai {lateStart} WIB).
                          </p>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>

              <div className="w-full h-px bg-slate-100" />

              {/* === ATURAN KHUSUS JUMAT === */}
              <div className="space-y-4">
                <CardHeader className="p-0">
                  <CardTitle className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex gap-2 items-center">
                    <Clock size={14} className="text-amber-500" /> Aturan Khusus Jumat — Rawat Jalan
                  </CardTitle>
                  <CardDescription className="text-xs font-medium text-slate-400 mt-1">
                    Pegawai Shift Pagi (non-24 jam) dapat absen pulang lebih awal di hari Jumat untuk keperluan rawat jalan.
                  </CardDescription>
                </CardHeader>

                <div className="p-4 bg-amber-50/60 border border-amber-100 rounded-xl space-y-5">
                  {/* Toggle aktif */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase text-amber-800 tracking-wider">Aktifkan Fitur Rawat Jalan</p>
                      <p className="text-[9px] text-amber-600 font-medium mt-0.5">Jika aktif, window absen pulang di hari Jumat akan disesuaikan untuk shift pagi.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const current = (settings as any).fridayEarlyEnd?.enabled || false;
                        setSettings({
                          ...settings,
                          fridayEarlyEnd: {
                            ...((settings as any).fridayEarlyEnd || {}),
                            enabled: !current,
                            checkOutTime: (settings as any).fridayEarlyEnd?.checkOutTime || '10:30',
                            exemptBidangs: (settings as any).fridayEarlyEnd?.exemptBidangs || ['RAWAT INAP', 'UGD'],
                          }
                        } as any);
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${(settings as any).fridayEarlyEnd?.enabled ? 'bg-amber-500' : 'bg-slate-200'
                        }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${(settings as any).fridayEarlyEnd?.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                    </button>
                  </div>

                  {(settings as any).fridayEarlyEnd?.enabled && (
                    <>
                      {/* Jam Absen Pulang */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[9px] font-black uppercase text-amber-700">Jam Absen Pulang Jumat</Label>
                          <Input
                            type="time"
                            value={(settings as any).fridayEarlyEnd?.checkOutTime || '10:30'}
                            onChange={(e) => setSettings({
                              ...settings,
                              fridayEarlyEnd: {
                                ...((settings as any).fridayEarlyEnd || {}),
                                checkOutTime: e.target.value,
                              }
                            } as any)}
                            className="h-9 text-sm font-mono bg-white border-amber-200 focus-visible:ring-amber-400"
                          />
                          <p className="text-[8px] text-amber-600 font-bold italic">
                            * Window aktif: dari jam ini sampai +30 menit
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[9px] font-black uppercase text-amber-700">Contoh Window</Label>
                          <div className="h-9 px-3 bg-white border border-amber-200 rounded-md flex items-center">
                            <span className="text-[10px] font-mono font-black text-amber-700">
                              {(() => {
                                const t = (settings as any).fridayEarlyEnd?.checkOutTime || '10:30';
                                const [h, m] = t.split(':').map(Number);
                                const startMin = h * 60 + m;
                                const endMin = h * 60 + m + 30;
                                const fmt = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
                                return `${fmt(startMin)} – ${fmt(endMin)} WIB`;
                              })()}
                            </span>
                          </div>
                          <p className="text-[8px] text-amber-600 font-bold italic">Interval window absen pulang aktif</p>
                        </div>
                      </div>

                      {/* Bidang yang dikecualikan */}
                      <div className="space-y-2">
                        <Label className="text-[9px] font-black uppercase text-amber-700">Bidang yang Dikecualikan (Shift 24 Jam)</Label>
                        <p className="text-[8px] text-amber-600 font-bold">Bidang di bawah tetap mengikuti jam shift normal, tidak terpengaruh aturan Jumat.</p>
                        <div className="flex flex-wrap gap-2">
                          {departments.map(dept => {
                            const exempts: string[] = (settings as any).fridayEarlyEnd?.exemptBidangs || ['RAWAT INAP', 'UGD'];
                            const isExempt = exempts.includes(dept);
                            return (
                              <button
                                key={dept}
                                type="button"
                                onClick={() => {
                                  const current: string[] = (settings as any).fridayEarlyEnd?.exemptBidangs || ['RAWAT INAP', 'UGD'];
                                  const updated = isExempt
                                    ? current.filter(b => b !== dept)
                                    : [...current, dept];
                                  setSettings({
                                    ...settings,
                                    fridayEarlyEnd: {
                                      ...((settings as any).fridayEarlyEnd || {}),
                                      exemptBidangs: updated,
                                    }
                                  } as any);
                                }}
                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border ${isExempt
                                  ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                                  : 'bg-white border-amber-200 text-amber-600 hover:border-amber-400'
                                  }`}
                              >
                                {isExempt ? '⛔ ' : ''}{dept}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[8px] text-amber-500 font-bold italic">
                          * Bidang berwarna oranye = dikecualikan (shift 24 jam, absen normal).
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>



              <div className="space-y-4">
                <CardHeader className="p-0">
                  <CardTitle className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex gap-2 items-center">
                    <Users size={14} className="text-red-500" /> Daftar Bidang / Departemen
                  </CardTitle>
                  <CardDescription className="text-xs font-medium text-slate-400 mt-1">Tambahkan atau hapus nama bidang yang terdaftar di sistem.</CardDescription>
                </CardHeader>
                <div className="flex gap-2 max-w-md">
                  <Input
                    placeholder="Nama Bidang Baru..."
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    className="h-9 text-xs bg-slate-50 border-slate-200 focus-visible:ring-red-500"
                  />
                  <Button
                    onClick={addDepartment}
                    disabled={isAddingDepartment}
                    className="h-9 px-4 bg-red-600 text-white font-black text-[9px] uppercase tracking-widest"
                  >
                    {isAddingDepartment ? 'Menyimpan...' : 'Tambah'}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {departments.map(dept => (
                    <div key={dept} className="px-3 py-1.5 bg-slate-50 text-slate-700 font-bold text-[10px] uppercase flex items-center gap-1.5 border border-slate-200 rounded-lg select-none">
                      {dept}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeDepartment(dept);
                        }}
                        className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-0.5 rounded-full transition-all duration-200 active:scale-75 ml-1 cursor-pointer inline-flex items-center justify-center border-none bg-transparent"
                        title={`Hapus ${dept}`}
                      >
                        <X size={12} className="stroke-[2.5]" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="w-full h-px bg-slate-100" />

              <CardHeader className="p-0">
                <CardTitle className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex gap-2 items-center">
                  <MapPin size={14} className="text-red-500" /> Multi-Lokasi Presensi
                </CardTitle>
                <CardDescription className="text-xs font-medium text-slate-400 mt-1">Daftarkan beberapa titik koordinat wilayah absen.</CardDescription>
              </CardHeader>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-slate-400">Nama Lokasi</Label>
                    <Input id="loc-name" placeholder="Kantor Utama" className="h-8 text-xs bg-white" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-slate-400">Latitude</Label>
                    <div className="relative flex items-center">
                      <Input id="loc-lat" type="text" placeholder="0.0000" className="h-8 pr-7 text-xs bg-white font-mono focus-visible:ring-slate-400" />
                      <button
                        type="button"
                        onClick={() => {
                          const val = (document.getElementById('loc-lat') as HTMLInputElement).value;
                          copyToClipboard(val, 'Latitude');
                        }}
                        title="Salin Latitude"
                        className="absolute right-1.5 h-6 w-6 p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center"
                      >
                        <Copy size={11} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-slate-400">Longitude</Label>
                    <div className="relative flex items-center">
                      <Input id="loc-lng" type="text" placeholder="0.0000" className="h-8 pr-7 text-xs bg-white font-mono focus-visible:ring-slate-400" />
                      <button
                        type="button"
                        onClick={() => {
                          const val = (document.getElementById('loc-lng') as HTMLInputElement).value;
                          copyToClipboard(val, 'Longitude');
                        }}
                        title="Salin Longitude"
                        className="absolute right-1.5 h-6 w-6 p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center"
                      >
                        <Copy size={11} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-slate-400">Radius (m)</Label>
                    <div className="flex gap-2">
                      <Input id="loc-radius" type="number" placeholder="100" className="h-8 text-xs bg-white w-20" />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          const name = (document.getElementById('loc-name') as HTMLInputElement).value;
                          const lat = parseFloat((document.getElementById('loc-lat') as HTMLInputElement).value);
                          const lng = parseFloat((document.getElementById('loc-lng') as HTMLInputElement).value);
                          const rad = parseInt((document.getElementById('loc-radius') as HTMLInputElement).value) || 100;

                          if (name && !isNaN(lat) && !isNaN(lng)) {
                            const newLocs = [...(settings.locations || []), { name, lat, lng, radius: rad }];
                            setSettings({ ...settings, locations: newLocs });
                            (document.getElementById('loc-name') as HTMLInputElement).value = '';
                            (document.getElementById('loc-lat') as HTMLInputElement).value = '';
                            (document.getElementById('loc-lng') as HTMLInputElement).value = '';
                            (document.getElementById('loc-radius') as HTMLInputElement).value = '';
                            toast.success('Lokasi ditambahkan! Jangan lupa klik "Terapkan Pola Konfigurasi" di bawah untuk menyimpan permanen.');
                          } else {
                            toast.error('Lengkapi data lokasi');
                          }
                        }}
                        className="h-8 bg-red-600 text-white font-black text-[9px] uppercase tracking-widest px-4"
                      >
                        Tambah
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(settings.locations || []).map((loc, i) => (
                    <Card key={i} className="p-3 border border-slate-200 bg-white relative group overflow-hidden">
                      <div className="flex justify-between items-start relative z-10">
                        <div>
                          <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">{loc.name}</p>
                          <p className="text-[9px] font-mono text-slate-400 mt-1">{loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}</p>
                          <Badge variant="outline" className="mt-2 text-[8px] font-bold uppercase tracking-tighter border-slate-200">Radius: {loc.radius}m</Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const newLocs = settings.locations.filter((_, idx) => idx !== i);
                            setSettings({ ...settings, locations: newLocs });
                          }}
                          className="h-6 w-6 text-slate-300 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                      <div className="absolute -right-2 -bottom-2 opacity-[0.03] group-hover:scale-110 transition-transform">
                        <MapPin size={60} />
                      </div>
                    </Card>
                  ))}
                  {(settings.locations || []).length === 0 && (
                    <div className="col-span-full p-8 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                      <MapPin className="mx-auto text-slate-200 mb-2" size={32} />
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Belum ada multi-lokasi. Menggunakan koordinat default.</p>
                    </div>
                  )}
                </div>

                <div className="w-full h-px bg-slate-100" />

                <CardHeader className="p-0">
                  <CardTitle className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex gap-2 items-center">
                    <Clock size={14} className="text-red-500" /> Parameter Hari & Libur
                  </CardTitle>
                </CardHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Hari Operasional</Label>
                      <div className="flex flex-wrap gap-2">
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                          const isSelected = (settings.enabledDays || []).includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => {
                                const currentDays = settings.enabledDays || [];
                                const newDays = isSelected
                                  ? currentDays.filter(d => d !== day)
                                  : [...currentDays, day];
                                setSettings({ ...settings, enabledDays: newDays });
                              }}
                              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border ${isSelected
                                ? 'bg-red-600 border-red-600 text-white shadow-md shadow-red-100'
                                : 'bg-white border-slate-200 text-slate-400 hover:border-red-300'
                                }`}
                            >
                              {day.substring(0, 3)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                </div>
              </div>

            </CardContent>
            <CardFooter className="bg-slate-50 border-t p-4 flex justify-between items-center gap-4 flex-wrap">
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => setIsClearMonthLogsDialogOpen(true)}
                  variant="outline"
                  className="h-10 px-6 border-amber-200 text-amber-600 hover:bg-amber-50 font-black uppercase tracking-widest text-[10px] transition-all"
                >
                  <Trash2 size={14} className="mr-2" /> Hapus Data Bulan Ini
                </Button>
                <Button
                  type="button"
                  onClick={() => setIsClearLogsDialogOpen(true)}
                  variant="outline"
                  className="h-10 px-6 border-rose-200 text-rose-600 hover:bg-rose-50 font-black uppercase tracking-widest text-[10px] transition-all"
                >
                  <Trash2 size={14} className="mr-2" /> Kosongkan Data Absensi
                </Button>
              </div>
              <Button
                onClick={saveSettings}
                disabled={savingSettings}
                className="h-10 px-8 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-red-100 transition-all active:scale-95"
              >
                {savingSettings ? 'Menyinkronkan...' : 'Terapkan Pola Konfigurasi'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        <TabsContent value="izin" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Left: Input Status Manual */}
            <div className="xl:col-span-4">
              <Card className="border border-slate-200 shadow-sm overflow-hidden bg-white h-fit">
                <CardHeader className="p-4 border-b bg-slate-50/50">
                  <CardTitle className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <FileText size={14} className="text-red-500" />
                    Bypass / Input Status Manual
                  </CardTitle>
                  <CardDescription className="text-xs uppercase tracking-widest font-medium text-slate-400">Bypass absensi harian secara manual.</CardDescription>
                </CardHeader>
                <CardContent className="p-5">
                  <form onSubmit={submitLeaveForm} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Pilih Pegawai</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                        <Input
                          placeholder="Cari nama pegawai..."
                          className="pl-9 h-9 bg-white border-slate-200 text-xs font-medium placeholder:text-slate-300 focus-visible:ring-red-500 mb-1.5"
                          value={leaveEmployeeSearchTerm}
                          onChange={(e) => setLeaveEmployeeSearchTerm(e.target.value)}
                        />
                      </div>
                      <select
                        value={leaveForm.employeeId}
                        onChange={e => setLeaveForm({ ...leaveForm, employeeId: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer text-slate-700"
                      >
                        <option value="">-- Pilih Pegawai --</option>
                        {employees
                          .filter(emp =>
                            (emp.displayName || emp.name || emp.email || '').toLowerCase().includes(leaveEmployeeSearchTerm.toLowerCase())
                          )
                          .slice(0, 100)
                          .map(emp => (
                            <option key={emp.id || emp.uid} value={emp.id || emp.uid}>{emp.displayName || emp.name || emp.email}</option>
                          ))
                        }
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Pilih Tanggal</Label>
                        <Input
                          type="date"
                          value={leaveForm.date}
                          onChange={e => setLeaveForm({ ...leaveForm, date: e.target.value })}
                          className="h-9 text-xs bg-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Jenis Status</Label>
                        <select
                          value={leaveForm.leaveType}
                          onChange={e => setLeaveForm({ ...leaveForm, leaveType: e.target.value })}
                          className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus:ring-1 focus:ring-red-500 font-black uppercase text-slate-700 cursor-pointer"
                        >
                          <option value="I">Izin (I)</option>
                          <option value="S">Sakit (S)</option>
                          <option value="C">Cuti (C)</option>
                          <option value="T">Tugas Luar (T)</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Keterangan / Alasan</Label>
                      <Input
                        value={leaveForm.reason}
                        onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                        placeholder="Misal: Surat dokter terlampir"
                        className="h-9 text-xs bg-white"
                      />
                    </div>

                    <div className="pt-1">
                      <Button type="submit" disabled={isSubmittingLeave} className="w-full h-9 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-[9px] shadow-lg shadow-red-100">
                        {isSubmittingLeave ? 'MEMPROSES...' : 'SIMPAN STATUS ABSENSI'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Right: Daftar Pengajuan Izin */}
            <div className="xl:col-span-8">
              <Card className="border border-slate-200 shadow-sm overflow-hidden bg-white h-full flex flex-col">
                <CardHeader className="p-4 border-b bg-slate-50/50 flex flex-row items-center justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <CalendarRange size={14} className="text-red-500" />
                      Daftar Pengajuan Izin Pegawai
                    </CardTitle>
                    <CardDescription className="text-xs uppercase tracking-widest font-medium text-slate-400">Kelola dan setujui pengajuan izin mandiri dari pegawai.</CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[8px] font-black uppercase bg-red-50 text-red-600 border-red-200">
                    {leaves.filter(l => l.status === 'PENDING').length} Menunggu Persetujuan
                  </Badge>
                </CardHeader>
                <CardContent className="p-0 overflow-auto max-h-[500px]">
                  <Table>
                    <TableHeader className="bg-slate-50/60 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="text-[9px] uppercase font-black py-3 pl-4">Pegawai</TableHead>
                        <TableHead className="text-[9px] uppercase font-black py-3">Jenis</TableHead>
                        <TableHead className="text-[9px] uppercase font-black py-3">Tanggal</TableHead>
                        <TableHead className="text-[9px] uppercase font-black py-3">Keterangan / Alasan</TableHead>
                        <TableHead className="text-[9px] uppercase font-black py-3">Status</TableHead>
                        <TableHead className="text-[9px] uppercase font-black py-3 text-right pr-4">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaves.map((leave) => {
                        const leaveTypes: any = {
                          'I': { label: 'Izin', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
                          'S': { label: 'Sakit', bg: 'bg-rose-50 text-rose-700 border-rose-200' },
                          'C': { label: 'Cuti', bg: 'bg-purple-50 text-purple-700 border-purple-200' },
                          'T': { label: 'Tugas Luar', bg: 'bg-slate-50 text-slate-700 border-slate-200' }
                        };

                        const statusTypes: any = {
                          'PENDING': { label: 'Menunggu', bg: 'bg-amber-100 text-amber-800 border-amber-200 animate-pulse' },
                          'APPROVED': { label: 'Disetujui', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
                          'REJECTED': { label: 'Ditolak', bg: 'bg-rose-100 text-rose-800 border-rose-200' }
                        };

                        const typeInfo = leaveTypes[leave.leaveType] || { label: 'Izin', bg: 'bg-slate-100 text-slate-800' };
                        const statusInfo = statusTypes[leave.status] || { label: leave.status, bg: 'bg-slate-100 text-slate-800' };

                        return (
                          <TableRow key={leave.id} className="hover:bg-slate-50/30 transition-colors">
                            <TableCell className="py-3 pl-4">
                              <p className="font-black text-[10px] uppercase text-slate-700 leading-none">{leave.userName}</p>
                              <div className="flex gap-1.5 items-center mt-1">
                                <span className="text-[8px] font-mono text-slate-400">{leave.userEmail}</span>
                                {leave.userBidang && (
                                  <span className="text-[7px] font-black uppercase bg-slate-100 text-slate-500 px-1 rounded">
                                    {leave.userBidang}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-3">
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${typeInfo.bg}`}>
                                {typeInfo.label}
                              </span>
                            </TableCell>
                            <TableCell className="py-3 text-[10px] font-bold text-slate-600 leading-tight">
                              {leave.startDate === leave.endDate ? (
                                <span>{leave.startDate}</span>
                              ) : (
                                <span>{leave.startDate}<br /><span className="text-[8px] text-slate-400">s/d</span><br />{leave.endDate}</span>
                              )}
                            </TableCell>
                            <TableCell className="py-3 text-[10px] font-semibold text-slate-700 italic max-w-[150px]" title={leave.reason}>
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
                            <TableCell className="py-3">
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${statusInfo.bg}`}>
                                {statusInfo.label}
                              </span>
                            </TableCell>
                            <TableCell className="py-3 text-right pr-4">
                              {leave.status === 'PENDING' ? (
                                <div className="flex justify-end gap-1.5">
                                  <Button
                                    onClick={() => handleApproveLeave(leave)}
                                    size="sm"
                                    className="h-7 w-7 p-0 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md shadow-sm transition-transform active:scale-95"
                                    title="Setujui"
                                  >
                                    <Check size={12} />
                                  </Button>
                                  <Button
                                    onClick={() => handleRejectLeave(leave)}
                                    size="sm"
                                    className="h-7 w-7 p-0 bg-rose-600 hover:bg-rose-700 text-white rounded-md shadow-sm transition-transform active:scale-95"
                                    title="Tolak"
                                  >
                                    <X size={12} />
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-[8px] font-bold uppercase text-slate-400 italic">
                                  Selesai
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {leaves.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="py-12 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Belum ada pengajuan izin dari pegawai.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Employee Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-slate-50/80 p-6 border-b">
            <DialogTitle className="text-xl font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
              <Edit2 size={20} className="text-red-600" /> Edit Profil
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-slate-400 uppercase tracking-widest">
              Perbarui identitas & akses pegawai.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nama Lengkap</Label>
              <Input
                value={editingEmployee?.displayName || ''}
                onChange={e => setEditingEmployee({ ...editingEmployee, displayName: e.target.value })}
                className="bg-slate-50 border-slate-200 focus:ring-red-500 font-medium h-10"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">ID Pegawai</Label>
                <Input
                  value={editingEmployee?.nip || ''}
                  onChange={e => setEditingEmployee({ ...editingEmployee, nip: e.target.value })}
                  className="bg-slate-50 border-slate-200 focus:ring-red-500 font-mono text-sm h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Bidang</Label>
                <select
                  value={editingEmployee?.bidang || ''}
                  onChange={e => setEditingEmployee({ ...editingEmployee, bidang: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500 font-medium"
                >
                  {/* Jika bidang pegawai tidak ada di daftar departments, tambahkan sebagai opsi agar state tetap akurat */}
                  {editingEmployee?.bidang && !departments.includes(editingEmployee.bidang) && (
                    <option key={editingEmployee.bidang} value={editingEmployee.bidang}>{editingEmployee.bidang}</option>
                  )}
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">System Role</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="role"
                    value="staff"
                    checked={editingEmployee?.role === 'staff'}
                    onChange={() => setEditingEmployee({ ...editingEmployee, role: 'staff' })}
                    className="w-4 h-4 text-red-600 focus:ring-red-500 border-slate-300"
                  />
                  <span className={`text-xs font-bold uppercase tracking-wider ${editingEmployee?.role === 'staff' ? 'text-red-600' : 'text-slate-400'}`}>Staff</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="role"
                    value="admin"
                    checked={editingEmployee?.role === 'admin'}
                    onChange={() => setEditingEmployee({ ...editingEmployee, role: 'admin' })}
                    className="w-4 h-4 text-red-600 focus:ring-red-500 border-slate-300"
                  />
                  <span className={`text-xs font-bold uppercase tracking-wider ${editingEmployee?.role === 'admin' ? 'text-red-600' : 'text-slate-400'}`}>Admin</span>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter className="bg-slate-50 p-6 border-t gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              className="font-black uppercase tracking-widest text-[10px] h-10 border-slate-200"
            >
              Batal
            </Button>
            <Button
              onClick={handleUpdateEmployee}
              disabled={isUpdatingEmployee}
              className="bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-[10px] h-10 shadow-lg shadow-red-100"
            >
              {isUpdatingEmployee ? 'Menyinkronkan...' : 'Simpan Perubahan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px] bg-white border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-rose-50 p-6 border-b">
            <DialogTitle className="text-xl font-black uppercase tracking-widest text-rose-800 flex items-center gap-2">
              <Trash2 size={20} className="text-rose-600" /> Hapus Pegawai
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-rose-600 uppercase tracking-widest opacity-70">
              Tindakan ini permanen & tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6">
            <p className="text-sm text-slate-600 font-medium">
              Apakah Anda yakin ingin menghapus data pegawai <span className="font-black text-slate-900">"{deletingEmployee?.name}"</span>?
            </p>
            <p className="text-[10px] text-slate-400 mt-2 italic font-bold uppercase tracking-tight">
              * Akses login & riwayat perangkat terkait akan diputuskan.
            </p>
          </div>

          <DialogFooter className="bg-slate-50 p-6 border-t gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              className="font-black uppercase tracking-widest text-[10px] h-10 border-slate-200"
            >
              Batal
            </Button>
            <Button
              onClick={handleDeleteEmployee}
              disabled={isDeletingEmployee}
              className="bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-widest text-[10px] h-10 shadow-lg shadow-rose-100"
            >
              {isDeletingEmployee ? 'MENGHAPUS...' : 'YA, HAPUS DATA'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Device Confirmation Dialog */}
      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="sm:max-w-[400px] bg-white border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-amber-50 p-6 border-b">
            <DialogTitle className="text-xl font-black uppercase tracking-widest text-amber-800 flex items-center gap-2">
              <RefreshCw size={20} className="text-amber-600" /> Reset Device Lock
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-amber-600 uppercase tracking-widest opacity-70">
              Sinkronisasi ulang identitas perangkat.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6">
            <p className="text-sm text-slate-600 font-medium">
              Yakin ingin mereset kunci perangkat untuk <span className="font-black text-slate-900">"{resettingEmployee?.name}"</span>?
            </p>
            <p className="text-[10px] text-slate-400 mt-2 italic font-bold uppercase tracking-tight">
              * Pegawai akan diizinkan mendaftarkan perangkat baru pada login berikutnya.
            </p>
          </div>

          <DialogFooter className="bg-slate-50 p-6 border-t gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsResetDialogOpen(false)}
              className="font-black uppercase tracking-widest text-[10px] h-10 border-slate-200"
            >
              Batal
            </Button>
            <Button
              onClick={handleResetDevice}
              disabled={isResetting}
              className="bg-amber-600 hover:bg-amber-700 text-white font-black uppercase tracking-widest text-[10px] h-10 shadow-lg shadow-amber-100"
            >
              {isResetting ? 'RESETTING...' : 'KONFIRMASI RESET'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Database Confirmation Dialog */}
      <Dialog open={isClearLogsDialogOpen} onOpenChange={setIsClearLogsDialogOpen}>
        <DialogContent className="sm:max-w-[400px] bg-white border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-rose-50 p-6 border-b border-rose-100">
            <DialogTitle className="text-xl font-black uppercase tracking-widest text-rose-800 flex items-center gap-2">
              <AlertTriangle size={20} className="text-rose-600" /> PERINGATAN
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-rose-600 uppercase tracking-widest opacity-70">
              Pengosongan Database Absensi
            </DialogDescription>
          </DialogHeader>

          <div className="p-6">
            <p className="text-sm text-slate-600 font-medium">
              Apakah Anda yakin ingin <span className="font-black text-rose-600">menghapus SEMUA data absensi</span>?
            </p>
            <p className="text-[10px] text-slate-400 mt-2 italic font-bold uppercase tracking-tight">
              * Info: Data daftar pegawai Anda akan dipertahankan tetap aman. Pastikan Anda telah melakukan Export/Backup arsip bulan ini sebelum melanjutkan!
            </p>
          </div>

          <DialogFooter className="bg-slate-50 p-6 border-t gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsClearLogsDialogOpen(false)}
              className="font-black uppercase tracking-widest text-[10px] h-10 border-slate-200"
              disabled={isClearingLogs}
            >
              Batal
            </Button>
            <Button
              onClick={handleClearLogs}
              disabled={isClearingLogs}
              className="bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-widest text-[10px] h-10 shadow-lg shadow-rose-100"
            >
              {isClearingLogs ? 'MENGHAPUS...' : 'YA, KOSONGKAN ABSENSI'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Month Database Confirmation Dialog */}
      <Dialog open={isClearMonthLogsDialogOpen} onOpenChange={setIsClearMonthLogsDialogOpen}>
        <DialogContent className="sm:max-w-[400px] bg-white border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-amber-50 p-6 border-b border-amber-100">
            <DialogTitle className="text-xl font-black uppercase tracking-widest text-amber-800 flex items-center gap-2">
              <AlertTriangle size={20} className="text-amber-600" /> PERINGATAN
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-amber-600 uppercase tracking-widest opacity-70">
              Hapus Data Bulan Ini
            </DialogDescription>
          </DialogHeader>

          <div className="p-6">
            <p className="text-sm text-slate-600 font-medium">
              Apakah Anda yakin ingin <span className="font-black text-amber-600">menghapus data absensi dan jadwal piket bulan {reportMonth}</span>?
            </p>
            <p className="text-[10px] text-slate-400 mt-2 italic font-bold uppercase tracking-tight">
              * Info: Tindakan ini akan menghapus semua riwayat absen dan jadwal piket untuk bulan {reportMonth}.
            </p>
          </div>

          <DialogFooter className="bg-slate-50 p-6 border-t gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsClearMonthLogsDialogOpen(false)}
              className="font-black uppercase tracking-widest text-[10px] h-10 border-slate-200"
              disabled={isClearingMonthLogs}
            >
              Batal
            </Button>
            <Button
              onClick={handleClearMonthLogs}
              disabled={isClearingMonthLogs}
              className="bg-amber-600 hover:bg-amber-700 text-white font-black uppercase tracking-widest text-[10px] h-10 shadow-lg shadow-amber-100"
            >
              {isClearingMonthLogs ? 'MENGHAPUS...' : 'YA, HAPUS DATA BULAN INI'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo Viewer Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="sm:max-w-[400px] bg-transparent border-none shadow-none p-0 overflow-hidden outline-none">
          {selectedPhoto && (
            <div className="flex flex-col items-center justify-center p-4">
              <div className="relative group">
                <img
                  src={selectedPhoto}
                  alt="Visual Trace Zoom"
                  className="w-full max-w-sm rounded-2xl object-contain shadow-2xl border-4 border-white/20"
                />
                <div className="absolute inset-0 rounded-2xl ring-1 ring-white/10 pointer-events-none" />
              </div>
              <p className="mt-4 px-4 py-1.5 bg-black/60 backdrop-blur-md rounded-full text-[9px] font-black text-white uppercase tracking-[0.2em] border border-white/20 shadow-xl">
                Klik di luar untuk menutup
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

