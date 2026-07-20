import { auth, dbRealtime } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import { hashPassword } from './localCrypto';
import toast from 'react-hot-toast';

// ───────────────────────────────────────────────────────────────
// DEMO ACCOUNTS DEFINITION
// Login.tsx email mapping:
//   admin          → admin@demo.com
//   kepala_sekolah → kepsek@demo.com
//   guru           → guru@demo.com
//   alpha_project  → alpha@demo.com
// ───────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant_demo';

const DEMO_ACCOUNTS = {
  superAdmin: {
    email: 'alpha@demo.com',
    password: 'alphaproject',
    username: 'alpha_project',
    role: 'developer',
    name: 'Alpha Project Developer',
    phone: '08444444444'
  },
  admin: {
    email: 'admin@demo.com',
    password: 'admin123',
    username: 'admin',
    role: 'admin',
    name: 'Admin Sekolah Demo',
    phone: '08555555555'
  },
  kepsek: {
    email: 'kepsek@demo.com',
    password: 'kepsek123',
    username: 'kepala_sekolah',
    role: 'kepala_sekolah',
    name: 'Dr. Budi Santoso, M.Pd.',
    phone: '08666666666'
  },
  guru: {
    email: 'guru@demo.com',
    password: 'guru123',
    username: 'guru',
    role: 'guru',
    name: 'Siti Rahayu, S.Pd.',
    phone: '' // Kosong = tidak pakai OTP 2FA, login langsung
  }
};

const DEMO_SCHOOL = {
  name: 'SMAN 1 Sekolah Demo ABDI',
  address: 'Jl. Pendidikan No. 1, Jakarta Selatan',
  phone: '021-5555555',
  email: 'info@sekolahdemo.sch.id',
  website: 'www.sekolahdemo.sch.id',
  latitude: -6.200000,
  longitude: 106.816666,
  radius: 300,
  logoUrl: '',
  timezone: 'WIB',
  principalName: 'Dr. Budi Santoso, M.Pd.',
  operationalCheckInLimit: '07:30',
};

/** Buat dummy attendance records untuk 7 hari terakhir */
function generateDummyAttendance(userId: string, userName: string): Record<string, any> {
  const records: Record<string, any> = {};
  const now = new Date();
  const statuses = ['Hadir', 'Hadir', 'Hadir', 'Hadir', 'Terlambat', 'Hadir', 'Izin'];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    // Skip weekend
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const dateStr = d.toISOString().split('T')[0];
    const id = `att_demo_${userId}_${dateStr}`;
    const status = statuses[i % statuses.length];
    records[id] = {
      id,
      userId,
      date: dateStr,
      checkInTime: status !== 'Izin' ? (status === 'Terlambat' ? '08:15:00' : '07:25:00') : null,
      checkOutTime: status !== 'Izin' ? '16:00:00' : null,
      status,
      isSynced: true,
      is_synced: true,
      syncStatus: 'synced',
      latitude: -6.200100,
      longitude: 106.816800,
      distance: 15,
      method: 'scanner',
      notes: status === 'Izin' ? 'Izin keperluan keluarga' : `Presensi demo - ${userName}`,
    };
  }
  return records;
}

async function createOrGetUser(email: string, password: string): Promise<string> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    return cred.user.uid;
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      return cred.user.uid;
    }
    throw error;
  }
}

export const seedDemoUsers = async () => {
  const toastId = toast.loading('⚙️ Menginisialisasi Database Demo...');

  try {
    // === 1. Super Admin / Developer ===
    const saUid = await createOrGetUser(DEMO_ACCOUNTS.superAdmin.email, DEMO_ACCOUNTS.superAdmin.password);
    const saProfile = {
      id: saUid,
      name: DEMO_ACCOUNTS.superAdmin.name,
      username: DEMO_ACCOUNTS.superAdmin.username,
      role: DEMO_ACCOUNTS.superAdmin.role,
      phone: DEMO_ACCOUNTS.superAdmin.phone,
      email: DEMO_ACCOUNTS.superAdmin.email,
      password: hashPassword(DEMO_ACCOUNTS.superAdmin.password),
      createdAt: new Date().toISOString()
    };
    await set(ref(dbRealtime, `global_admins/${saUid}`), true);
    await set(ref(dbRealtime, `user_tenant_mapping/${saUid}`), 'GLOBAL');
    await set(ref(dbRealtime, `global_users/${saUid}`), saProfile);

    // === 2. Admin Sekolah Demo ===
    const adminUid = await createOrGetUser(DEMO_ACCOUNTS.admin.email, DEMO_ACCOUNTS.admin.password);
    const adminProfile = {
      id: adminUid,
      name: DEMO_ACCOUNTS.admin.name,
      username: DEMO_ACCOUNTS.admin.username,
      role: DEMO_ACCOUNTS.admin.role,
      phone: DEMO_ACCOUNTS.admin.phone,
      email: DEMO_ACCOUNTS.admin.email,
      password: hashPassword(DEMO_ACCOUNTS.admin.password),
      createdAt: new Date().toISOString(),
      tenantId: TENANT_ID,
    };
    await set(ref(dbRealtime, `user_tenant_mapping/${adminUid}`), TENANT_ID);
    await set(ref(dbRealtime, `tenants/${TENANT_ID}/users/${adminUid}`), adminProfile);

    // === 3. Kepala Sekolah ===
    const kepsekUid = await createOrGetUser(DEMO_ACCOUNTS.kepsek.email, DEMO_ACCOUNTS.kepsek.password);
    const kepsekProfile = {
      id: kepsekUid,
      name: DEMO_ACCOUNTS.kepsek.name,
      username: DEMO_ACCOUNTS.kepsek.username,
      role: DEMO_ACCOUNTS.kepsek.role,
      phone: DEMO_ACCOUNTS.kepsek.phone,
      email: DEMO_ACCOUNTS.kepsek.email,
      password: hashPassword(DEMO_ACCOUNTS.kepsek.password),
      jabatan: 'Kepala Sekolah',
      createdAt: new Date().toISOString(),
      tenantId: TENANT_ID,
    };
    await set(ref(dbRealtime, `user_tenant_mapping/${kepsekUid}`), TENANT_ID);
    await set(ref(dbRealtime, `tenants/${TENANT_ID}/users/${kepsekUid}`), kepsekProfile);
    // Dummy attendance untuk kepsek
    const kepsekAtt = generateDummyAttendance(kepsekUid, DEMO_ACCOUNTS.kepsek.name);
    for (const [id, record] of Object.entries(kepsekAtt)) {
      await set(ref(dbRealtime, `tenants/${TENANT_ID}/attendance/${id}`), record);
    }

    // === 4. Guru ===
    const guruUid = await createOrGetUser(DEMO_ACCOUNTS.guru.email, DEMO_ACCOUNTS.guru.password);
    const guruProfile = {
      id: guruUid,
      name: DEMO_ACCOUNTS.guru.name,
      username: DEMO_ACCOUNTS.guru.username,
      role: DEMO_ACCOUNTS.guru.role,
      phone: DEMO_ACCOUNTS.guru.phone,
      email: DEMO_ACCOUNTS.guru.email,
      password: hashPassword(DEMO_ACCOUNTS.guru.password),
      jabatan: 'Guru Mata Pelajaran',
      mapelUtama: 'Matematika',
      createdAt: new Date().toISOString(),
      tenantId: TENANT_ID,
    };
    await set(ref(dbRealtime, `user_tenant_mapping/${guruUid}`), TENANT_ID);
    await set(ref(dbRealtime, `tenants/${TENANT_ID}/users/${guruUid}`), guruProfile);
    // Dummy attendance untuk guru
    const guruAtt = generateDummyAttendance(guruUid, DEMO_ACCOUNTS.guru.name);
    for (const [id, record] of Object.entries(guruAtt)) {
      await set(ref(dbRealtime, `tenants/${TENANT_ID}/attendance/${id}`), record);
    }

    // === 5. School Info ===
    await set(ref(dbRealtime, `tenants/${TENANT_ID}/school`), DEMO_SCHOOL);

    toast.success(
      '✅ Database Demo berhasil diinisialisasi!\n\n' +
      'Admin: admin / admin123\n' +
      'Kepala Sekolah: kepala_sekolah / kepsek123\n' +
      'Guru: guru / guru123',
      { id: toastId, duration: 8000 }
    );
  } catch (error: any) {
    console.error('Gagal inisialisasi database demo:', error);
    toast.error(`Gagal inisialisasi: ${error.message}`, { id: toastId });
  }
};
