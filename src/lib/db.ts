import { User, School, AcademicYear, Holiday, AttendanceRecord, OPD, SatuanKerja, Jabatan, CutiRequest, KinerjaRecord, ClassSchedule } from '../types';
import { pushToFirebase, processOfflineQueue } from './firebaseSync';
import { idbStorage } from './idbStorage';

/**
 * SECURITY: Strip sensitive fields before syncing to Firebase Cloud.
 * Passwords are ONLY stored in localStorage (local device), never in the cloud.
 */
const sanitizeUserForCloud = (user: User): Omit<User, 'password'> => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _pw, ...safeUser } = user;
  return safeUser;
};

const INITIAL_USERS: User[] = [
  { id: '1', username: 'admin', name: 'Admin Yayasan TU', role: 'admin', password: 'admin', jabatan: 'Kepala Tata Usaha' },
  { id: '2', username: 'guru', name: 'Guru Demo', role: 'guru', password: 'guru', jabatan: 'Guru / Dosen Pertama' },
  { id: '3', username: 'staf', name: 'Staf Demo', role: 'staf_sekolah', password: 'staf', jabatan: 'Staf Administrasi & Tenaga Kependidikan' },
  { id: '4', username: 'kepsek', name: 'Kepala Sekolah Demo', role: 'kepala_sekolah', password: 'kepsek', jabatan: 'Kepala Sekolah / Rektor / Direktur' },
  { id: '999', username: 'alpha_project', name: 'System Developer Dev', role: 'developer', password: 'garut001' },
];

const INITIAL_SCHOOL: School = {
  name: 'SMA / SMP / Kampus Unggulan Nusantara',
  address: 'Jl. Pendidikan Nasional No. 1, Kota / Kabupaten',
  phone: '021-88997766',
  operationalCheckInLimit: '07:30',
  adminEmail: 'admin@sekolah-kampus.id',
  latitude: -6.200000,
  longitude: 106.816666,
  radius: 120,
  principalName: 'Prof. / Dr. H. Bambang Sulistyo, M.Pd.',
  principalNip: '197505122003121004',
  gasWebAppUrl: 'https://script.google.com/macros/s/AKfycbxFdrxQCGEIXs5KE7MxQEw03ly4e_LWRBF5kflgpG4CGhzAdtRHcxj45AbH6d8q87ej/exec',
  whatsappApiKey: 'f1nsc3bxtB8fsxi9YGugNWgFeX7hII0v9fJKEniC09s1EOnB7I7Dpyd.ZT5frc0v',
  whatsappApiKeyOtp: '',
  waGatewayProvider: 'wablas',
  wablasServerUrl: 'https://smg.wablas.com',
  kopSurat: {
    nama_dinas: 'YAYASAN PENDIDIKAN DAN KEBUDAYAAN',
    nama_instansi: 'SMA / SMP / KAMPUS UNGGULAN NUSANTARA',
    alamat: 'Jl. Pendidikan Nasional No. 1, Kota / Kabupaten, Provinsi Jawa Barat',
    telepon: '021-88997766',
    email: 'admin@sekolah-kampus.id',
    website: 'https://sekolah-kampus.id',
    kode_pos: '44151',
    logo_url: '',
  },
  logo_url: '',
  nama_dinas: 'YAYASAN PENDIDIKAN DAN KEBUDAYAAN',
  nama_instansi: 'SMA / SMP / KAMPUS UNGGULAN NUSANTARA',
  telepon: '021-88997766',
  email: 'admin@sekolah-kampus.id',
  website: 'https://sekolah-kampus.id',
  kode_pos: '44151',
  marqueeText: '',
};

const INITIAL_OPDS: OPD[] = [
  { id: '1', singkatan: 'DISDIK', nama: 'Dinas Pendidikan & Kebudayaan (Negeri)' },
  { id: '2', singkatan: 'YAYASAN', nama: 'Yayasan Pendidikan Swasta / Badan Penyelenggara' },
  { id: '3', singkatan: 'REKTORAT / KEMDIKBUD', nama: 'Perguruan Tinggi & Rektorat' },
  { id: '4', singkatan: 'INSTANSI / KEMENTERIAN', nama: 'Instansi Pemerintah / Kementerian / Lembaga Pendidikan' },
];

const INITIAL_SATUAN_KERJAS: SatuanKerja[] = [
  { id: '1', opdId: '1', singkatan: 'SMP/SMA Negeri 1', nama: 'SMP / SMA / SMK Negeri Unggulan 1' },
  { id: '2', opdId: '2', singkatan: 'Sekolah Terpadu', nama: 'SMP / SMA Swasta Unggulan Terpadu' },
  { id: '3', opdId: '3', singkatan: 'Universitas Nusantara', nama: 'Universitas / Institut / Sekolah Tinggi Nusantara' },
];

const INITIAL_JABATANS: Jabatan[] = [
  { id: '1', nama: 'Kepala Sekolah / Rektor / Direktur' },
  { id: '2', nama: 'Wakil Kepala / Wakil Rektor Bidang Akademik / Kurikulum' },
  { id: '3', nama: 'Guru / Dosen Ahli Madya' },
  { id: '4', nama: 'Guru / Dosen Ahli Muda' },
  { id: '5', nama: 'Guru / Dosen Pertama' },
  { id: '6', nama: 'Kepala Tata Usaha / Kabiro Administrasi' },
  { id: '7', nama: 'Staf Administrasi & Tenaga Kependidikan' },
  { id: '8', nama: 'Petugas Keamanan / Lobi / Kepegawaian' },
];

const INITIAL_CUTI: CutiRequest[] = [];

const INITIAL_SCHEDULES: ClassSchedule[] = [];

const INITIAL_ACADEMIC_YEARS: AcademicYear[] = [
  { id: '1', name: '2026/2027', semester: 'Ganjil', isActive: true },
];

// Database Version Control to safely purge old cache on deploy
const DB_VERSION_KEY = 'instansi_sekolah_db_version';
const CURRENT_DB_VERSION = 'v13_demo_accounts_home_v2';
if (localStorage.getItem(DB_VERSION_KEY) !== CURRENT_DB_VERSION) {
  // Pertahankan key-key penting yang tidak boleh hilang saat purge versi
  const preservedKeys: Record<string, string | null> = {
    qr_kiosk_bg_url: localStorage.getItem('qr_kiosk_bg_url'),
    qr_embedded_logo_admin: localStorage.getItem('qr_embedded_logo_admin'),
    current_active_qr: localStorage.getItem('current_active_qr'),
    abdi_registration_token: localStorage.getItem('abdi_registration_token'),
    active_session_user: localStorage.getItem('active_session_user'),
    login_bg_custom_data: localStorage.getItem('login_bg_custom_data'),
  };
  localStorage.clear();
  localStorage.setItem(DB_VERSION_KEY, CURRENT_DB_VERSION);
  // Kembalikan key-key yang dipertahankan jika ada nilainya
  Object.entries(preservedKeys).forEach(([key, val]) => {
    if (val) localStorage.setItem(key, val);
  });
}


function parseArrayStorage<T = any>(key: string, initialData: T[] = []): T[] {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return initialData;
    const parsed = JSON.parse(stored);
    if (!parsed) return initialData;
    const list = Array.isArray(parsed) ? parsed : Object.values(parsed);
    const validList = list.filter((item: any) => item !== null && item !== undefined && typeof item === 'object');
    return validList.length > 0 ? (validList as T[]) : initialData;
  } catch (e) {
    return initialData;
  }
}

export const db = {
  getUsers: (includeSystemAccounts: boolean = false): User[] => {
    let list = parseArrayStorage<User>('users', INITIAL_USERS);
    list = list.map((u: any) => {
      const migrated = { ...u };
      if (migrated.role === 'kepala_madrasah') migrated.role = 'kepala_sekolah';
      if (migrated.role === 'staf') migrated.role = 'staf_sekolah';
      return migrated;
    });

    // Reset ke data awal jika kosong
    if (list.length === 0) {
      localStorage.setItem('users', JSON.stringify(INITIAL_USERS));
      list = INITIAL_USERS;
    }

    // Pastikan akun developer selalu ada dan memiliki role serta password yang benar
    const devIndex = list.findIndex((u: any) => u.username === 'alpha_project');
    let hasChanged = false;
    if (devIndex === -1) {
      const devUser: User = { id: '999', username: 'alpha_project', name: 'Alpha Project', role: 'developer', password: 'garut001' };
      list.push(devUser);
      hasChanged = true;
    } else if (list[devIndex].role !== 'developer' || !list[devIndex].password || list[devIndex].password === '') {
      list[devIndex].role = 'developer';
      list[devIndex].password = 'garut001';
      hasChanged = true;
    }

    // Pastikan akun admin juga tidak kehilangan password
    const adminIndex = list.findIndex((u: any) => u.username === 'admin');
    if (adminIndex !== -1 && (!list[adminIndex].password || list[adminIndex].password === '')) {
      list[adminIndex].password = 'admin';
      hasChanged = true;
    }

    if (hasChanged) {
      localStorage.setItem('users', JSON.stringify(list));
      pushToFirebase('users', list.reduce((acc: any, user: User) => { acc[user.id] = sanitizeUserForCloud(user); return acc; }, {} as Record<string, Omit<User, 'password'>>));
    }

    if (includeSystemAccounts) {
      return list;
    }

    try {
      const activeStored = localStorage.getItem('active_session_user');
      if (activeStored) {
        const activeUser = JSON.parse(activeStored);
        if (activeUser && activeUser.role === 'developer') {
          return list;
        }
      }
    } catch (e) {}

    return list.filter((u: User) => u.role !== 'developer');
  },
  setUsers: (users: User[]) => {
    let usersToSave = [...users];
    const devIndex = usersToSave.findIndex((u) => u.role === 'developer' || u.username === 'alpha_project');
    if (devIndex === -1) {
      try {
        const raw = localStorage.getItem('users');
        if (raw) {
          const existing = JSON.parse(raw);
          const existingDevs = existing.filter((u: any) => u.role === 'developer' || u.username === 'alpha_project');
          if (existingDevs.length > 0) {
            usersToSave = [...usersToSave, ...existingDevs];
          } else {
            usersToSave.push({ id: '999', username: 'alpha_project', name: 'Alpha Project', role: 'developer', password: 'garut001' });
          }
        }
      } catch (e) {}
    }

    localStorage.setItem('users', JSON.stringify(usersToSave));
    idbStorage.setItem('master_users', 'users', usersToSave);
    // SECURITY: Only push sanitized (password-less) data to Firebase Cloud
    const usersMap = usersToSave.reduce((acc, user) => {
      acc[user.id] = sanitizeUserForCloud(user);
      return acc;
    }, {} as Record<string, Omit<User, 'password'>>);
    pushToFirebase('users', usersMap);
  },
  updateUserPassword: (username: string, newPassword: string): boolean => {
    const users = db.getUsers(true);
    const userIndex = users.findIndex(u => u.username === username);
    if (userIndex !== -1) {
      users[userIndex].password = newPassword;
      db.setUsers(users);
      return true;
    }
    return false;
  },
  updateUser: (id: string, updates: Partial<User>): boolean => {
    const users = db.getUsers(true);
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
      school.name === 'KANTOR BKPSDM - DEPOK' ||
      (typeof school.name === 'string' && (school.name.toLowerCase().includes('madrasah') || school.name.toLowerCase().includes('kemenag')));
    if (isOldData) {
      const resetSchool = { ...school, ...INITIAL_SCHOOL };
      localStorage.setItem('school', JSON.stringify(resetSchool));
      return resetSchool;
    }
    
    // Auto-fill API keys or Kop Surat if missing from local storage
    if (!school.gasWebAppUrl || !school.whatsappApiKey || !school.waGatewayProvider || !school.kopSurat || school.whatsappApiKey === '28JCsreqtvjsUnTzgLeo') {
       const mergedSchool: School = { 
         ...school, 
         gasWebAppUrl: school.gasWebAppUrl || INITIAL_SCHOOL.gasWebAppUrl,
         whatsappApiKey: school.whatsappApiKey === '28JCsreqtvjsUnTzgLeo' ? INITIAL_SCHOOL.whatsappApiKey : (school.whatsappApiKey || INITIAL_SCHOOL.whatsappApiKey),
         waGatewayProvider: school.waGatewayProvider || INITIAL_SCHOOL.waGatewayProvider,
         wablasServerUrl: school.wablasServerUrl || INITIAL_SCHOOL.wablasServerUrl,
         kopSurat: school.kopSurat || {
           nama_dinas: school.nama_dinas || 'YAYASAN PENDIDIKAN DAN KEBUDAYAAN',
           nama_instansi: school.nama_instansi || school.name || INITIAL_SCHOOL.name,
           alamat: school.alamat || school.address || INITIAL_SCHOOL.address,
           telepon: school.telepon || school.phone || INITIAL_SCHOOL.phone,
           email: school.email || school.adminEmail || INITIAL_SCHOOL.adminEmail,
           website: school.website || 'https://sekolah-kampus.id',
           kode_pos: school.kode_pos || '44151',
           logo_url: school.logo_url || school.logoUrl || '',
         }
       };
       return mergedSchool;
    }

    return school;
  },
  setSchool: (school: School) => {
    localStorage.setItem('school', JSON.stringify(school));
    idbStorage.setItem('master_school', 'school', school);
    pushToFirebase('school', school);
    window.dispatchEvent(new Event('school_updated'));
  },
  updateSchool: (updates: Partial<School> | School): School => {
    const current = db.getSchool();
    const updated = { ...current, ...updates };
    db.setSchool(updated);
    return updated;
  },
  
  getOPDs: (): OPD[] => {
    const data = parseArrayStorage<OPD>('opds', INITIAL_OPDS);
    if (data.some((t: any) => t && (t.singkatan === 'BKPSDM' || t.singkatan === 'DISDIK'))) {
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
    const data = parseArrayStorage<SatuanKerja>('satuan_kerjas', INITIAL_SATUAN_KERJAS);
    // Only reset if data from an OLD institution (BKPSDM) is detected — 'MTs. Al-Hidayah' is a valid name here
    if (data.some((t: any) => t && t.singkatan === 'BKPSDM KANTOR')) {
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
    const data = parseArrayStorage<Jabatan>('jabatans', INITIAL_JABATANS);
    if (data.some((t: any) => t && t.nama === 'Kepala Bidang Mutasi dan Promosi')) {
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
    return parseArrayStorage<CutiRequest>('cuti_requests', INITIAL_CUTI);
  },
  setCutiRequests: (cr: CutiRequest[]) => {
    localStorage.setItem('cuti_requests', JSON.stringify(cr));
    const crMap = cr.reduce((acc, c) => { acc[c.id] = c; return acc; }, {} as Record<string, CutiRequest>);
    pushToFirebase('cuti_requests', crMap);
    window.dispatchEvent(new Event('cuti_updated'));
  },

  getKinerjas: (): KinerjaRecord[] => {
    return parseArrayStorage<KinerjaRecord>('kinerja_records', []);
  },
  setKinerjas: (kr: KinerjaRecord[]) => {
    localStorage.setItem('kinerja_records', JSON.stringify(kr));
    const krMap = kr.reduce((acc, k) => { acc[k.id] = k; return acc; }, {} as Record<string, KinerjaRecord>);
    pushToFirebase('kinerja_records', krMap);
    window.dispatchEvent(new Event('kinerja_updated'));
  },

  getAcademicYears: (): AcademicYear[] => {
    return parseArrayStorage<AcademicYear>('academicYears', INITIAL_ACADEMIC_YEARS);
  },
  setAcademicYears: (ay: AcademicYear[]) => {
    localStorage.setItem('academicYears', JSON.stringify(ay));
    const ayMap = ay.reduce((acc, a) => { acc[a.id] = a; return acc; }, {} as Record<string, AcademicYear>);
    pushToFirebase('academicYears', ayMap);
  },
  
  getHolidays: (): Holiday[] => {
    return parseArrayStorage<Holiday>('holidays', []);
  },
  setHolidays: (data: Holiday[]) => {
    localStorage.setItem('holidays', JSON.stringify(data));
    const dataMap = data.reduce((acc, h) => { acc[h.id] = h; return acc; }, {} as Record<string, Holiday>);
    pushToFirebase('holidays', dataMap);
  },
  
  getSchedules: (): ClassSchedule[] => {
    return parseArrayStorage<ClassSchedule>('class_schedules', INITIAL_SCHEDULES);
  },
  saveSchedule: (data: ClassSchedule) => {
    const list = db.getSchedules();
    const idx = list.findIndex(s => s && s.id === data.id);
    if (idx !== -1) list[idx] = data;
    else list.push(data);
    localStorage.setItem('class_schedules', JSON.stringify(list));
    const listMap = list.reduce((acc, s) => { acc[s.id] = s; return acc; }, {} as Record<string, ClassSchedule>);
    pushToFirebase('class_schedules', listMap);
  },
  deleteSchedule: (id: string) => {
    const list = db.getSchedules().filter(s => s && s.id !== id);
    localStorage.setItem('class_schedules', JSON.stringify(list));
    const listMap = list.reduce((acc, s) => { acc[s.id] = s; return acc; }, {} as Record<string, ClassSchedule>);
    pushToFirebase('class_schedules', listMap);
  },

  getAttendance: (): AttendanceRecord[] => {
    return parseArrayStorage<AttendanceRecord>('attendance', []);
  },
  setAttendance: (a: AttendanceRecord[]) => {
    const formatted = a.filter(rec => rec && typeof rec === 'object').map(rec => ({
      ...rec,
      is_synced: rec.isSynced !== undefined ? rec.isSynced : false,
      updated_at: (rec as any).updated_at || new Date().toISOString()
    }));
    localStorage.setItem('attendance', JSON.stringify(formatted));
    idbStorage.setItem('attendance_logs', 'attendance', formatted);
    const aMap = formatted.reduce((acc, att) => { acc[att.id] = att; return acc; }, {} as Record<string, any>);
    pushToFirebase('attendance', aMap);
  },

  getSystemLogs: (): any[] => {
    return parseArrayStorage<any>('system_logs', []);
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
  },

  getDeviceSessionLogs: (): any[] => {
    const logs = parseArrayStorage<any>('device_session_logs', []);
    if (logs.length === 0) {
      // Inisialisasi default log pertama kali jika belum ada agar langsung terlihat di UI
      const initLog = [
        {
          id: 'devlog-init-1',
          timestamp: new Date().toISOString(),
          userId: 'alpha_project',
          userName: 'Alpha Project Dev',
          userRole: 'developer',
          action: 'LOGIN',
          ipAddress: '127.0.0.1 (Local Verified)',
          device: {
            os: 'Windows 11',
            browser: 'Google Chrome 138',
            category: 'Desktop',
            screenResolution: '1920x1080',
            rawUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
          },
          details: 'Sesi developer login dan inisialisasi modul keamanan',
          status: 'SUCCESS'
        }
      ];
      localStorage.setItem('device_session_logs', JSON.stringify(initLog));
      return initLog;
    }
    return logs;
  },
  addDeviceSessionLog: (log: any) => {
    const logs = db.getDeviceSessionLogs();
    const updated = [log, ...logs].slice(0, 500); // Simpan sampai 500 log terakhir
    localStorage.setItem('device_session_logs', JSON.stringify(updated));
    window.dispatchEvent(new Event('device_session_logs_updated'));
  }
};

export const getSyncSimulationMode = (): 'healthy' | 'unstable' | 'offline' => 
  (localStorage.getItem('sync_sim_mode') as any) || 'healthy';

export const setSyncSimulationMode = (mode: 'healthy' | 'unstable' | 'offline') => 
  localStorage.setItem('sync_sim_mode', mode);

export const syncOfflineAttendance = async (): Promise<number> => {
  const simMode = getSyncSimulationMode();
  
  if (simMode === 'offline' || !navigator.onLine) {
    throw new Error('Koneksi internet terputus. Data tersimpan dengan aman di perangkat lokal dan akan otomatis diunggah saat internet terhubung kembali.');
  }

  const attendance = db.getAttendance();
  const unsynced = attendance.filter(a => !a.isSynced || (a as any).is_synced === false || a.syncStatus === 'failed' || a.syncStatus === 'pending');
  if (unsynced.length === 0) {
    const queueRes = await processOfflineQueue();
    if (queueRes.pending > 0 && queueRes.synced === 0) {
      throw new Error(`Gagal mengunggah ${queueRes.pending} data antrean ke server Cloud. Periksa stabilitas koneksi atau izin Firebase Anda.`);
    }
    return queueRes.synced;
  }

  // Mark all processing records as 'syncing' initially
  const processing = attendance.map(a => {
    if (!a.isSynced || !(a as any).is_synced || a.syncStatus === 'failed' || a.syncStatus === 'pending') {
      return { ...a, syncStatus: 'syncing' as const };
    }
    return a;
  });
  localStorage.setItem('attendance', JSON.stringify(processing));
  window.dispatchEvent(new Event('attendance_synchronized'));

  const queueRes = await processOfflineQueue();
  if (queueRes.pending > 0 && queueRes.synced === 0) {
    throw new Error(`Sebagian atau seluruh data (${queueRes.pending} antrean) gagal disinkronkan karena gangguan jaringan Cloud. Sistem akan terus mencoba di latar belakang.`);
  }

  return queueRes.synced;
};
