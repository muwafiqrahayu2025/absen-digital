export interface TestimonialItem {
  id: string;
  name: string;
  role: string;
  school: string;
  location: string;
  avatar: string;
  rating: number;
  quote: string;
  highlight: string;
}

export const TESTIMONIALS_DATA: TestimonialItem[] = [
  {
    id: "1",
    name: "Drs. H. Ahmad Fauzi, M.Pd.",
    role: "Kepala Sekolah / Rektor",
    school: "SMA / SMP / Kampus Terpadu 1",
    location: "Jakarta Selatan",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    rating: 5,
    highlight: "Rekap BOSP 3 Detik",
    quote: "Dulu setiap akhir bulan staf tata usaha kami selalu lembur sampai malam merekap absen kertas 60 guru untuk audit BOSP. Sejak pakai ABDI, rekap bulanan selesai dalam 3 detik tinggal klik Unduh Excel. Sangat membantu dan akurat!"
  },
  {
    id: "2",
    name: "Hj. Nuryanti, S.Ag., M.Si.",
    role: "Ketua Yayasan",
    school: "YPI Al-Hikmah",
    location: "Bandung",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
    rating: 5,
    highlight: "Bebas Antre Fingerprint",
    quote: "Guru-guru sangat puas dengan fitur absen GPS Saku. Begitu memarkir motor di halaman sekolah langsung klik absen di HP masing-masing tanpa harus antre panjang dan berkerumun di mesin fingerprint lagi."
  },
  {
    id: "3",
    name: "H. Bambang Subagyo, M.Pd.",
    role: "Kepala Sekolah",
    school: "SMAN 2 Surabaya",
    location: "Surabaya",
    avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80",
    rating: 5,
    highlight: "Anti Fake GPS Akurat",
    quote: "Sistem Geofencing dan verifikasi foto selfie ABDI luar biasa ampuh. Coba-coba pakai fake location langsung ketahuan dan ditolak otomatis oleh sistem. Kedisiplinan guru meningkat drastis hingga 98%."
  },
  {
    id: "4",
    name: "Siti Aminah, S.Pd.I.",
    role: "Wakasek Kurikulum / Warek",
    school: "SMP / SMA Negeri 3",
    location: "Yogyakarta",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
    rating: 5,
    highlight: "Jadwal Mengajar Terintegrasi",
    quote: "Integrasi jadwal jam mengajar guru dengan presensi harian membuat saya mudah memantau siapa guru yang sedang jam kosong atau digantikan guru piket saat ada yang izin sakit."
  },
  {
    id: "5",
    name: "Ir. Wahyu Pratama, M.T.",
    role: "Kepala Sekolah",
    school: "SMK Negeri 1 Tekno",
    location: "Semarang",
    avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80",
    rating: 5,
    highlight: "Aplikasi Sangat Ringan",
    quote: "Karena berbasis PWA modern, aplikasi ini tidak membebani memori HP guru yang spesifikasinya beragam. Bukanya super cepat, tidak pernah hang, dan support offline saat Wi-Fi lab sedang gangguan."
  },
  {
    id: "6",
    name: "Rina Marlina, S.Kom.",
    role: "Kepala Tata Usaha",
    school: "SMA Islam Al-Azhar",
    location: "Bekasi",
    avatar: "https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=150&auto=format&fit=crop&q=80",
    rating: 5,
    highlight: "Notifikasi WhatsApp Otomatis",
    quote: "Notifikasi WA otomatisnya sangat disukai pengurus sekolah. Begitu ada guru terlambat atau mengajukan cuti, pesan langsung masuk ke WA Kepala Sekolah untuk langsung di-approve dari HP."
  },
  {
    id: "7",
    name: "Dr. H. Mukhlis Hidayat, M.A.",
    role: "Kepala Sekolah / Dekan",
    school: "SMP / SMA Terpadu Malang",
    location: "Malang",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
    rating: 5,
    highlight: "Hemat Anggaran Sekolah",
    quote: "Biaya langganan ABDI jauh lebih murah dibanding perawatan mesin fingerprint fisik yang sering rusak sensornya. Ditambah lagi ada paket hibah khusus yang membantu efisiensi sekolah / kampus kami."
  },
  {
    id: "8",
    name: "Dewi Lestari, S.Pd.",
    role: "Guru Senior Matematika",
    school: "SMAN 5 Taruna",
    location: "Makassar",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    rating: 5,
    highlight: "Mudah Dipahami Guru Senior",
    quote: "Awalnya saya kira bakal ribet karena umur saya sudah 54 tahun. Ternyata tampilannya sangat jelas, tulisannya besar, dan tombol absennya tinggal sentuh sekali langsung berhasil."
  },
  {
    id: "9",
    name: "I Wayan Sudiana, M.Pd.",
    role: "Kepala Sekolah",
    school: "SMA Negeri 2",
    location: "Denpasar",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    rating: 5,
    highlight: "Stasiun Pemindai QR Lobi",
    quote: "Fitur Stasiun Pemindai di tablet lobi sangat praktis untuk tamu sekolah dan staf yang lupa bawa HP. Tinggal hadapkan kartu QR, suara sapaan otomatis berbunyi menyambut kedatangan."
  },
  {
    id: "10",
    name: "H. Syamsul Bahri, Lc., M.E.",
    role: "Pimpinan Yayasan / Rektor",
    school: "Institut & Sekolah Terpadu",
    location: "Medan",
    avatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80",
    rating: 5,
    highlight: "Dukungan Tim Teknis Siaga",
    quote: "Pelayanan tim support ABDI sangat responsif. Setiap ada kendala atau pertanyaan seputar pengaturan jam shift pesantren, CS langsung merespons dan membantu via remote."
  },
  {
    id: "11",
    name: "Nurul Hidayah, S.E.",
    role: "Staf Kepegawaian / SDM",
    school: "SMP / SMA Negeri 1",
    location: "Palembang",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80",
    rating: 5,
    highlight: "Kop Surat & Tanda Tangan Sah",
    quote: "Laporan PDF yang dihasilkan sudah ada format resmi DINAS/INSTANSI lengkap dengan kop instansi dan barcode validasi. Sangat mempercepat proses pencairan tunjangan maupun audit internal."
  },
  {
    id: "12",
    name: "Hendra Saputra, S.Pd., Gr.",
    role: "Pembina OSIS & Guru IT",
    school: "SMAN 1 Teladan",
    location: "Yogyakarta",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80",
    rating: 5,
    highlight: "Teknologi Paling Modern",
    quote: "Secara arsitektur software, ABDI jauh melampaui aplikasi presensi lain. UI/UX nya sekelas aplikasi startup internasional dengan mode gelap dan micro-animation yang mulus."
  },
  {
    id: "13",
    name: "Hj. Fitriani Kusuma, M.Pd.",
    role: "Kepala Sekolah",
    school: "SD Negeri 1 Bogor",
    location: "Bogor",
    avatar: "https://images.unsplash.com/photo-1548142813-c348350df52b?w=150&auto=format&fit=crop&q=80",
    rating: 5,
    highlight: "Presensi Guru Makin Tertib",
    quote: "Sangat bersyukur mengenal ABDI. Sekarang tidak ada lagi titip absen atau manipulasi jam datang. Semua terekam akurat berdasarkan koordinat GPS gerbang sekolah."
  },
  {
    id: "14",
    name: "Drs. M. Zainuddin, M.M.",
    role: "Pengawas Sekolah / Asesor Kampus",
    school: "Dinas Pendidikan / Dikti",
    location: "Tangerang",
    avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80",
    rating: 5,
    highlight: "Rekomendasi Utama Akreditasi",
    quote: "Saat visitasi akreditasi sekolah, asesor sangat mengapresiasi sistem digitalisasi presensi kepegawaian menggunakan ABDI. Arsipnya rapi, digital, dan valid dapat dipertanggungjawabkan."
  },
  {
    id: "15",
    name: "Yuniar Rahmawati, S.Ak.",
    role: "Bendahara Sekolah",
    school: "SMK BKKBN Nusantara",
    location: "Surakarta",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    rating: 5,
    highlight: "Perhitungan Potongan Otomatis",
    quote: "Fitur kalkulasi keterlambatan dan potongan uang makan otomatisnya luar biasa akurat. Saya tidak perlu menghitung manual satu per satu menit keterlambatan guru di akhir bulan."
  }
];
