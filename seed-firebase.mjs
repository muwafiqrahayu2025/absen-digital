import { initializeApp } from "firebase/app";
import { getDatabase, ref, set } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBLCQuQrw5OA4rKLq-4cm6u2lSgpniuPTA",
  authDomain: "abdi-absendigital.firebaseapp.com",
  databaseURL: "https://abdi-absendigital-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "abdi-absendigital",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const INITIAL_USERS = [
  { id: '1', username: 'admin', name: 'Admin Yayasan TU', role: 'admin', password: 'admin', jabatan: 'Kepala Tata Usaha', phone: '081234567890' },
  { id: '2', username: 'kepsek', name: 'Bambang Sulistyo', role: 'kepala_sekolah', password: 'admin', jabatan: 'Kepala Sekolah', phone: '081234567891' },
  { id: '3', username: 'guru', name: 'Siti Aminah', role: 'guru', password: 'admin', jabatan: 'Guru Ahli Madya', phone: '081234567892' },
  { id: '4', username: 'staf', name: 'Budi Santoso', role: 'staf_sekolah', password: 'admin', jabatan: 'Staf Administrasi', phone: '081234567893' },
  { id: '999', username: 'alpha_project', name: 'System Developer Dev', role: 'developer', password: 'garut001' },
];

const INITIAL_SCHOOL = {
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
};

const INITIAL_OPDS = [
  { id: '1', singkatan: 'DISDIK', nama: 'Dinas Pendidikan & Kebudayaan (Negeri)' },
  { id: '2', singkatan: 'YAYASAN', nama: 'Yayasan Pendidikan Swasta / Badan Penyelenggara' },
  { id: '3', singkatan: 'REKTORAT / KEMDIKBUD', nama: 'Perguruan Tinggi & Rektorat' },
  { id: '4', singkatan: 'INSTANSI / KEMENTERIAN', nama: 'Instansi Pemerintah / Kementerian / Lembaga Pendidikan' },
];

const INITIAL_SATUAN_KERJAS = [
  { id: '1', opdId: '1', singkatan: 'SMP/SMA Negeri 1', nama: 'SMP / SMA / SMK Negeri Unggulan 1' },
  { id: '2', opdId: '2', singkatan: 'Sekolah Terpadu', nama: 'SMP / SMA Swasta Unggulan Terpadu' },
  { id: '3', opdId: '3', singkatan: 'Universitas Nusantara', nama: 'Universitas / Institut / Sekolah Tinggi Nusantara' },
];

const INITIAL_JABATANS = [
  { id: '1', nama: 'Kepala Sekolah / Rektor / Direktur' },
  { id: '2', nama: 'Wakil Kepala / Wakil Rektor Bidang Akademik / Kurikulum' },
  { id: '3', nama: 'Guru / Dosen Ahli Madya' },
  { id: '4', nama: 'Guru / Dosen Ahli Muda' },
  { id: '5', nama: 'Guru / Dosen Pertama' },
  { id: '6', nama: 'Kepala Tata Usaha / Kabiro Administrasi' },
  { id: '7', nama: 'Staf Administrasi & Tenaga Kependidikan' },
  { id: '8', nama: 'Petugas Keamanan / Lobi / Kepegawaian' },
];

const INITIAL_ACADEMIC_YEARS = [
  { id: '1', name: '2026/2027', semester: 'Ganjil', isActive: true },
];

const seedData = {
  users: INITIAL_USERS,
  school: INITIAL_SCHOOL,
  opds: INITIAL_OPDS,
  satuan_kerjas: INITIAL_SATUAN_KERJAS,
  jabatans: INITIAL_JABATANS,
  academicYears: INITIAL_ACADEMIC_YEARS,
  attendance: null,
  cuti_requests: null,
  kinerja_records: null,
  class_schedules: null,
  system_logs: null,
};

async function run() {
  console.log("Pushing universal seed data to Firebase Realtime Database...");
  await set(ref(db, '/'), seedData);
  console.log("Successfully updated Firebase Realtime Database with latest public school/campus data!");
  process.exit(0);
}

run().catch(e => {
  console.error("Error pushing data:", e);
  process.exit(1);
});
