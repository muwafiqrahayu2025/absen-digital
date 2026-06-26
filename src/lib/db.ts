import { User, School, AcademicYear, Holiday, AttendanceRecord, OPD, SatuanKerja, Jabatan, CutiRequest, KinerjaRecord, ClassSchedule } from '../types';
import { pushToFirebase } from './firebaseSync';

const INITIAL_USERS: User[] = [
  { id: '1', username: 'admin', name: 'Admin Madrasah', role: 'admin', password: 'admin' },
  { id: '999', username: 'alpha_project', name: 'System Developer', role: 'developer', password: 'garut001' },
];

const INITIAL_SCHOOL: School = {
  name: 'Nama Sekolah Kita',
  address: 'Alamat Sekolah Anda',
  phone: '021-xxxxxxx',
  operationalCheckInLimit: '08:00',
  adminEmail: 'admin@madrasah.sch.id',
  latitude: -6.200000,
  longitude: 106.816666,
  radius: 120,
  principalName: 'Nama Kepala Sekolah',
  principalNip: '-',
  gasWebAppUrl: 'https://script.google.com/macros/s/AKfycbxFdrxQCGEIXs5KE7MxQEw03ly4e_LWRBF5kflgpG4CGhzAdtRHcxj45AbH6d8q87ej/exec',
  whatsappApiKey: '28JCsreqtvjsUnTzgLeo',
  whatsappApiKeyOtp: '',
};

const INITIAL_OPDS: OPD[] = [];

const INITIAL_SATUAN_KERJAS: SatuanKerja[] = [];

const INITIAL_JABATANS: Jabatan[] = [];

const INITIAL_CUTI: CutiRequest[] = [];

const INITIAL_SCHEDULES: ClassSchedule[] = [];

const INITIAL_ACADEMIC_YEARS: AcademicYear[] = [
  { id: '1', name: '2026/2027', semester: 'Ganjil', isActive: true },
];

// Database Version Control to safely purge old cache on deploy
const DB_VERSION_KEY = 'madrasah_db_version';
const CURRENT_DB_VERSION = 'v6_clean_state';
if (localStorage.getItem(DB_VERSION_KEY) !== CURRENT_DB_VERSION) {
  localStorage.clear();
  localStorage.setItem(DB_VERSION_KEY, CURRENT_DB_VERSION);
}

export const db = {
  getUsers: (): User[] => {
    const data = localStorage.getItem('users');
    let list = data ? (JSON.parse(data) || []) : [];
    
    // Filter out any null or undefined entries
    list = list.filter((u: any) => u !== null && u !== undefined);

    // Force reset if outdated role or first initialization
    if (list.length === 0 || list.some((u: any) => u?.role === 'kepala_sekolah' || u?.username === 'kepsek')) {
      localStorage.setItem('users', JSON.stringify(INITIAL_USERS));
      return INITIAL_USERS;
    }

    // Ensure dev user always exists and has the correct role
    const devIndex = list.findIndex((u: any) => u.username === 'alpha_project');
    if (devIndex === -1) {
      const devUser: User = { id: '999', username: 'alpha_project', name: 'Alpha Project', role: 'developer', password: 'garut001' };
      list.push(devUser);
      localStorage.setItem('users', JSON.stringify(list));
      pushToFirebase('users', list.reduce((acc, user) => { acc[user.id] = user; return acc; }, {} as Record<string, User>));
    } else if (list[devIndex].role !== 'developer') {
      list[devIndex].role = 'developer';
      list[devIndex].password = 'garut001';
      localStorage.setItem('users', JSON.stringify(list));
      pushToFirebase('users', list.reduce((acc, user) => { acc[user.id] = user; return acc; }, {} as Record<string, User>));
    }

    return list;
  },
  setUsers: (users: User[]) => {
    localStorage.setItem('users', JSON.stringify(users));
    const usersMap = users.reduce((acc, user) => {
      acc[user.id] = user;
      return acc;
    }, {} as Record<string, User>);
    pushToFirebase('users', usersMap);
  },
  updateUserPassword: (username: string, newPassword: string): boolean => {
    const users = db.getUsers();
    const userIndex = users.findIndex(u => u.username === username);
    if (userIndex !== -1) {
      users[userIndex].password = newPassword;
      db.setUsers(users);
      return true;
    }
    return false;
  },
  updateUser: (id: string, updates: Partial<User>): boolean => {
    const users = db.getUsers();
    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex !== -1) {
      users[userIndex] = { ...users[userIndex], ...updates };
      db.setUsers(users);
      return true;
    }
    return false;
  },

  getSchool: (): School => {
    const data = localStorage.getItem('school');
    const school = data ? (JSON.parse(data) || INITIAL_SCHOOL) : INITIAL_SCHOOL;

    // Only reset if data from an OLD version of this app is detected (different coordinates or institution name)
    const isOldData =
      school.latitude === -7.284183356403829 ||
      school.latitude === -6.175110 ||
      school.name === 'KANTOR BKPSDM - DEPOK';
    if (isOldData) {
      const resetSchool = { ...school, ...INITIAL_SCHOOL };
      localStorage.setItem('school', JSON.stringify(resetSchool));
      return resetSchool;
    }
    
    // Auto-fill API keys if they were added via code but missing from local storage
    if (!school.gasWebAppUrl || !school.whatsappApiKey) {
       const mergedSchool = { 
         ...school, 
         gasWebAppUrl: school.gasWebAppUrl || INITIAL_SCHOOL.gasWebAppUrl,
         whatsappApiKey: school.whatsappApiKey || INITIAL_SCHOOL.whatsappApiKey
       };
       // We don't save to localStorage immediately to avoid overwriting their work,
       // but we return it so the UI populates it.
       return mergedSchool;
    }

    return school;
  },
  setSchool: (school: School) => {
    localStorage.setItem('school', JSON.stringify(school));
    pushToFirebase('school', school);
  },
  
  getOPDs: (): OPD[] => {
    const stored = localStorage.getItem('opds');
    const data = stored ? (JSON.parse(stored) || []) : [];
    if (!Array.isArray(data) || data.length === 0 || data.some((t: any) => t.singkatan === 'BKPSDM' || t.singkatan === 'DISDIK')) {
      localStorage.setItem('opds', JSON.stringify(INITIAL_OPDS));
      return INITIAL_OPDS;
    }
    return data;
  },
  setOPDs: (opds: OPD[]) => {
    localStorage.setItem('opds', JSON.stringify(opds));
    const opdsMap = opds.reduce((acc, o) => { acc[o.id] = o; return acc; }, {} as Record<string, OPD>);
    pushToFirebase('opds', opdsMap);
  },

  getSatuanKerjas: (): SatuanKerja[] => {
    const stored = localStorage.getItem('satuan_kerjas');
    const data = stored ? (JSON.parse(stored) || []) : [];
    // Only reset if data from an OLD institution (BKPSDM) is detected — 'MTs. Al-Hidayah' is a valid name here
    if (!Array.isArray(data) || data.some((t: any) => t.singkatan === 'BKPSDM KANTOR')) {
      localStorage.setItem('satuan_kerjas', JSON.stringify(INITIAL_SATUAN_KERJAS));
      return INITIAL_SATUAN_KERJAS;
    }
    return data;
  },
  setSatuanKerjas: (sk: SatuanKerja[]) => {
    localStorage.setItem('satuan_kerjas', JSON.stringify(sk));
    const skMap = sk.reduce((acc, s) => { acc[s.id] = s; return acc; }, {} as Record<string, SatuanKerja>);
    pushToFirebase('satuan_kerjas', skMap);
  },

  getJabatans: (): Jabatan[] => {
    const stored = localStorage.getItem('jabatans');
    const data = stored ? (JSON.parse(stored) || []) : [];
    if (!Array.isArray(data) || data.length === 0 || data.some((t: any) => t.nama === 'Kepala Bidang Mutasi dan Promosi')) {
      localStorage.setItem('jabatans', JSON.stringify(INITIAL_JABATANS));
      return INITIAL_JABATANS;
    }
    return data;
  },
  setJabatans: (jb: Jabatan[]) => {
    localStorage.setItem('jabatans', JSON.stringify(jb));
    const jbMap = jb.reduce((acc, j) => { acc[j.id] = j; return acc; }, {} as Record<string, Jabatan>);
    pushToFirebase('jabatans', jbMap);
  },

  getCutiRequests: (): CutiRequest[] => {
    const stored = localStorage.getItem('cuti_requests');
    const data = stored ? (JSON.parse(stored) || []) : [];
    if (!Array.isArray(data) || data.length === 0) {
      localStorage.setItem('cuti_requests', JSON.stringify(INITIAL_CUTI));
      return INITIAL_CUTI;
    }
    return data;
  },
  setCutiRequests: (cr: CutiRequest[]) => {
    localStorage.setItem('cuti_requests', JSON.stringify(cr));
    const crMap = cr.reduce((acc, c) => { acc[c.id] = c; return acc; }, {} as Record<string, CutiRequest>);
    pushToFirebase('cuti_requests', crMap);
    window.dispatchEvent(new Event('cuti_updated'));
  },

  getKinerjas: (): KinerjaRecord[] => {
    const stored = localStorage.getItem('kinerja_records');
    return stored ? (JSON.parse(stored) || []) : [];
  },
  setKinerjas: (kr: KinerjaRecord[]) => {
    localStorage.setItem('kinerja_records', JSON.stringify(kr));
    const krMap = kr.reduce((acc, k) => { acc[k.id] = k; return acc; }, {} as Record<string, KinerjaRecord>);
    pushToFirebase('kinerja_records', krMap);
    window.dispatchEvent(new Event('kinerja_updated'));
  },

  getAcademicYears: (): AcademicYear[] => {
    const stored = localStorage.getItem('academicYears');
    return stored ? (JSON.parse(stored) || INITIAL_ACADEMIC_YEARS) : INITIAL_ACADEMIC_YEARS;
  },
  setAcademicYears: (ay: AcademicYear[]) => {
    localStorage.setItem('academicYears', JSON.stringify(ay));
    const ayMap = ay.reduce((acc, a) => { acc[a.id] = a; return acc; }, {} as Record<string, AcademicYear>);
    pushToFirebase('academicYears', ayMap);
  },
  
  getHolidays: (): Holiday[] => {
    const stored = localStorage.getItem('holidays');
    return stored ? (JSON.parse(stored) || []) : [];
  },
  setHolidays: (data: Holiday[]) => {
    localStorage.setItem('holidays', JSON.stringify(data));
    const dataMap = data.reduce((acc, h) => { acc[h.id] = h; return acc; }, {} as Record<string, Holiday>);
    pushToFirebase('holidays', dataMap);
  },
  
  getSchedules: (): ClassSchedule[] => {
    const data = localStorage.getItem('class_schedules');
    if (!data) {
      localStorage.setItem('class_schedules', JSON.stringify(INITIAL_SCHEDULES));
      return INITIAL_SCHEDULES;
    }
    return JSON.parse(data);
  },
  saveSchedule: (data: ClassSchedule) => {
    const list = db.getSchedules();
    const idx = list.findIndex(s => s.id === data.id);
    if (idx !== -1) list[idx] = data;
    else list.push(data);
    localStorage.setItem('class_schedules', JSON.stringify(list));
    const listMap = list.reduce((acc, s) => { acc[s.id] = s; return acc; }, {} as Record<string, ClassSchedule>);
    pushToFirebase('class_schedules', listMap);
  },
  deleteSchedule: (id: string) => {
    const list = db.getSchedules().filter(s => s.id !== id);
    localStorage.setItem('class_schedules', JSON.stringify(list));
    const listMap = list.reduce((acc, s) => { acc[s.id] = s; return acc; }, {} as Record<string, ClassSchedule>);
    pushToFirebase('class_schedules', listMap);
  },

  getAttendance: (): AttendanceRecord[] => {
    const stored = localStorage.getItem('attendance');
    return stored ? (JSON.parse(stored) || []) : [];
  },
  setAttendance: (a: AttendanceRecord[]) => {
    localStorage.setItem('attendance', JSON.stringify(a));
    const aMap = a.reduce((acc, att) => { acc[att.id] = att; return acc; }, {} as Record<string, AttendanceRecord>);
    pushToFirebase('attendance', aMap);
  },

  getSystemLogs: (): any[] => {
    const stored = localStorage.getItem('system_logs');
    return stored ? (JSON.parse(stored) || []) : [];
  },
  addSystemLog: (log: { type: string; title: string; message: string; recipient: string }) => {
    const logs = db.getSystemLogs();
    const newLog = {
      id: String(Date.now() + Math.random()),
      timestamp: new Date().toISOString(),
      ...log
    };
    localStorage.setItem('system_logs', JSON.stringify([newLog, ...logs].slice(0, 100)));
    window.dispatchEvent(new Event('system_logs_updated'));
  }
};

export const getSyncSimulationMode = (): 'healthy' | 'unstable' | 'offline' => 
  (localStorage.getItem('sync_sim_mode') as any) || 'healthy';

export const setSyncSimulationMode = (mode: 'healthy' | 'unstable' | 'offline') => 
  localStorage.setItem('sync_sim_mode', mode);

export const syncOfflineAttendance = async (): Promise<number> => {
  const simMode = getSyncSimulationMode();
  
  if (simMode === 'offline') {
    throw new Error('Koneksi internet terputus (Mode Simulasi Offline Aktif).');
  }

  const attendance = db.getAttendance();
  const unsynced = attendance.filter(a => !a.isSynced || a.syncStatus === 'failed' || a.syncStatus === 'pending');
  if (unsynced.length === 0) return 0;

  // Mark all processing records as 'syncing' initially
  const processing = attendance.map(a => {
    if (!a.isSynced || a.syncStatus === 'failed' || a.syncStatus === 'pending') {
      return { ...a, syncStatus: 'syncing' as const };
    }
    return a;
  });
  db.setAttendance(processing);
  window.dispatchEvent(new Event('attendance_synchronized'));

  let successfulCount = 0;

  for (let i = 0; i < unsynced.length; i++) {
    const record = unsynced[i];
    
    // Process each record individually with a short artificial network delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    const currentAttendance = db.getAttendance();
    const targetIdx = currentAttendance.findIndex(a => a.id === record.id);
    if (targetIdx === -1) continue;

    const currentAttempts = (record.syncAttempts || 0) + 1;

    // Simulate unstable network failures (50% failure rate for 'unstable' mode)
    const isFailedTransition = simMode === 'unstable' && Math.random() < 0.5;

    if (isFailedTransition) {
      currentAttendance[targetIdx] = {
        ...currentAttendance[targetIdx],
        isSynced: false,
        syncStatus: 'failed',
        syncAttempts: currentAttempts,
        syncError: 'Eror 504: Gateway Timeout (Koneksi tidak stabil)'
      };
    } else {
      currentAttendance[targetIdx] = {
        ...currentAttendance[targetIdx],
        isSynced: true,
        syncStatus: 'synced',
        syncAttempts: currentAttempts,
        syncError: undefined
      };
      successfulCount++;
    }

    // Save progressively to localStorage
    db.setAttendance(currentAttendance);
    window.dispatchEvent(new Event('attendance_synchronized'));
  }

  const finalCheck = db.getAttendance().filter(a => !a.isSynced).length;
  if (finalCheck > 0 && successfulCount === 0) {
    throw new Error('Sebagian atau seluruh data gagal disinkronkan karena eror jaringan.');
  }

  return successfulCount;
};
