import React, { useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import { useEditMode } from "./EditModeContext";
import { EditableText } from "./EditableText";
import {
  LayoutDashboard,
  Users,
  School,
  Calendar,
  FileText,
  Save,
  Pencil,
  ToggleLeft,
  ToggleRight,
  LogOut,
  QrCode,
  Scan,
  UserCircle,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CalendarCheck,
  Wifi,
  WifiOff,
  Settings,
  Building,
  Layers,
  Briefcase,
  Award,
  MapPin,
  HelpCircle,
  Palette,
  Terminal,
  CheckCircle2,
  ShieldCheck,
  X,
  Menu,
  Bell,
  BookOpen,
} from "lucide-react";
import { DeveloperSettingsModal } from "./DeveloperSettingsModal";
import { DeveloperSettingsModal } from "./DeveloperSettingsModal";
import { WindowControls } from "./WindowControls";
import toast from "react-hot-toast";
import { cn } from "../lib/utils";
import { db, syncOfflineAttendance } from "../lib/db";
import { getOfflineQueueCount } from "../lib/firebaseSync";
import { useAttendanceEmailNotification } from "../hooks/useAttendanceEmailNotification";
import { useTeacherReminder } from "../hooks/useTeacherReminder";
import { useLicense } from "../hooks/useLicense";
import { PackageActivationCard } from "./PackageActivationCard";
import { ROLE_LABELS } from "../types";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
type NavItemProps = {
  to?: string;
  icon?: React.ReactNode;
  label: string;
  isActive?: boolean;
  children?: NavItemProps[];
  onClick?: () => void;
  badge?: string | number;
};

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const isRouteActive = (to: string, currentPathname: string, currentSearch: string) => {
  if (!to) return false;
  if (to.includes("?")) {
    return currentPathname + currentSearch === to;
  }
  return currentPathname === to && !currentSearch;
};

// ─────────────────────────────────────────────────────────────
// NAV ITEM / GROUP
// ─────────────────────────────────────────────────────────────
const NavGroup: React.FC<{ item: NavItemProps; currentPath: string }> = ({ item, currentPath }) => {
  const { theme } = useTheme();
  const location = useLocation();
  const isAnyChildActive =
    item.children?.some((child) => child.to ? isRouteActive(child.to, location.pathname, location.search) : false) || false;

  const [isOpen, setIsOpen] = useState(() => isAnyChildActive);

  useEffect(() => {
    if (isAnyChildActive) setIsOpen(true);
  }, [isAnyChildActive]);

  const activeClass = "bg-white/20 backdrop-blur-md text-white font-bold border-white/30 shadow-sm";
  const inactiveClass = "border-transparent text-white/75 hover:bg-white/12 hover:text-white";

  if (!item.children) {
    if (item.onClick) {
      return (
        <button
          onClick={item.onClick}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-sm border cursor-pointer",
            inactiveClass
          )}
        >
          <div className="w-5 h-5 flex items-center justify-center shrink-0">{item.icon}</div>
          <span className="flex-1 text-left">
            <EditableText originalText={item.label} />
          </span>
        </button>
      );
    }
    const active = item.to ? isRouteActive(item.to, location.pathname, location.search) : false;
    return (
      <Link
        to={item.to || "#"}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-sm border",
          active ? activeClass : inactiveClass
        )}
      >
        <div className="w-5 h-5 flex items-center justify-center shrink-0">{item.icon}</div>
        <span className="flex-1 truncate">
          <EditableText originalText={item.label} />
        </span>
        {item.badge !== undefined && (
          <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-slate-900 text-[10px] font-black flex items-center justify-center shrink-0">
            {item.badge}
          </span>
        )}
      </Link>
    );
  }

  return (
    <div className="mb-0.5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-150 text-sm border cursor-pointer",
          isAnyChildActive ? activeClass : inactiveClass
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 flex items-center justify-center shrink-0">{item.icon}</div>
          <EditableText originalText={item.label} />
        </div>
        <span className="transition-transform duration-200" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
          <ChevronDown size={13} />
        </span>
      </button>

      {isOpen && (
        <div className="ml-9 mt-0.5 flex flex-col gap-0.5 relative before:absolute before:left-[-12px] before:top-0 before:bottom-0 before:w-px before:bg-white/15">
          {item.children.map((child, index) =>
            child.onClick ? (
              <button
                key={index}
                onClick={child.onClick}
                className="w-full text-left py-2 px-2.5 rounded-lg text-sm transition-all duration-100 text-white/60 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <EditableText originalText={child.label} />
              </button>
            ) : (
              <Link
                key={index}
                to={child.to || "#"}
                className={cn(
                  "py-2 px-2.5 rounded-lg text-sm transition-all duration-100 border",
                  child.to && isRouteActive(child.to, location.pathname, location.search)
                    ? "bg-white/20 text-white font-semibold border-white/20"
                    : "border-transparent text-white/60 hover:text-white hover:bg-white/10"
                )}
              >
                <EditableText originalText={child.label} />
              </Link>
            )
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN LAYOUT
// ─────────────────────────────────────────────────────────────
export function Layout() {
  const { user, logout } = useAuth();
  const isTeacherOrStaff = user?.role === "guru" || user?.role === "dosen" || user?.role === "staf_sekolah" || user?.role === "staf_kampus";
  const [school, setSchool] = useState(() => db.getSchool());
  const { config: licenseConfig } = useLicense();
  const location = useLocation();
  const { theme } = useTheme();
  const { isEditMode, toggleEditMode, saveEdits, customLogo } = useEditMode();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showDevSettings, setShowDevSettings] = useState(false);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const profileRef = React.useRef<HTMLDivElement>(null);

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingQueueCount, setPendingQueueCount] = useState(getOfflineQueueCount());

  // ── Event Listeners ──────────────────────────────────────
  useEffect(() => {
    const handleSchoolUpdate = () => setSchool(db.getSchool());
    const handleOpenPackageModal = () => setShowPackageModal(true);
    window.addEventListener("school_updated", handleSchoolUpdate);
    window.addEventListener("firebase_sync_updated", handleSchoolUpdate);
    window.addEventListener("open_package_modal", handleOpenPackageModal);
    // Sidebar hanya untuk non-teacher/staff
    let handleOpenSidebar: (() => void) | undefined;
    if (!isTeacherOrStaff) {
      handleOpenSidebar = () => setIsSidebarOpen(true);
      window.addEventListener("open_sidebar", handleOpenSidebar);
    }
    return () => {
      window.removeEventListener("school_updated", handleSchoolUpdate);
      window.removeEventListener("firebase_sync_updated", handleSchoolUpdate);
      window.removeEventListener("open_package_modal", handleOpenPackageModal);
      if (handleOpenSidebar) window.removeEventListener("open_sidebar", handleOpenSidebar);
    };
  }, [isTeacherOrStaff]);

  useEffect(() => {
    let wasOffline = !navigator.onLine;
    const updateQueue = () => setPendingQueueCount(getOfflineQueueCount());

    const handleOnline = async () => {
      setIsOnline(true);
      if (wasOffline || getOfflineQueueCount() > 0) {
        toast.dismiss();
        toast.loading("Sinkronisasi otomatis data offline ke Cloud...", { id: "autosync" });
        try {
          const count = await syncOfflineAttendance();
          updateQueue();
          const remaining = getOfflineQueueCount();
          if (remaining === 0) {
            if (count > 0) {
              toast.success(`Sinkronisasi berhasil! ${count} data lokal berhasil diunggah ke server.`, {
                id: "autosync", icon: "🟢", duration: 5000,
              });
            } else {
              toast.success("Koneksi pulih. Sistem kembali Full Online.", { id: "autosync", icon: "🟢", duration: 3000 });
            }
          } else {
            toast.error(`Koneksi pulih namun sisa ${remaining} antrean belum tersinkron ke Cloud.`, { id: "autosync", duration: 5000 });
          }
        } catch (err: any) {
          updateQueue();
          toast.error(err.message || "Sinkronisasi antrean dijadwalkan ulang...", { id: "autosync", duration: 5000 });
        }
        wasOffline = false;
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      wasOffline = true;
      updateQueue();
      toast.dismiss();
      toast.error(
        "Koneksi internet terputus. Aplikasi beralih ke Mode Offline — semua data tetap tersimpan dan akan otomatis tersinkron saat koneksi pulih.",
        { icon: "⚡", duration: 7000 }
      );
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("offline_sync_queue_changed", updateQueue);
    window.addEventListener("attendance_synchronized", updateQueue);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("offline_sync_queue_changed", updateQueue);
      window.removeEventListener("attendance_synchronized", updateQueue);
    };
  }, []);

  useAttendanceEmailNotification();
  useTeacherReminder();

  useEffect(() => { setIsSidebarOpen(false); }, [location.pathname]);

  // ── Auto-close sidebar saat resize ke desktop (md+) ──────────
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setIsSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Tutup sidebar saat ESC ────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsSidebarOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  // ── Data pending cuti untuk badge pimpinan (reaktif via event) ──────────
  const [pendingLeaveCount, setPendingLeaveCount] = React.useState(() => {
    if (user?.role !== "kepala_sekolah") return 0;
    return db.getCutiRequests().filter((c) => c.status === "Pending").length;
  });

  useEffect(() => {
    if (user?.role !== "kepala_sekolah") return;
    const refresh = () => {
      setPendingLeaveCount(db.getCutiRequests().filter((c) => c.status === "Pending").length);
    };
    window.addEventListener("cuti_updated", refresh);
    window.addEventListener("firebase_sync_updated", refresh);
    // Polling ringan setiap 60 detik sebagai fallback
    const poll = setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener("cuti_updated", refresh);
      window.removeEventListener("firebase_sync_updated", refresh);
      clearInterval(poll);
    };
  }, [user?.role]);

  // ─────────────────────────────────────────────────────────
  // MENU DEFINITIONS
  // ─────────────────────────────────────────────────────────

  const adminMenu: { group?: string | null; items: NavItemProps[] }[] = [
    {
      group: null,
      items: [{ to: "/", icon: <LayoutDashboard size={17} />, label: "Beranda" }],
    },
    {
      group: "MANAJEMEN PRESENSI",
      items: [
        {
          label: "Master Data",
          icon: <Layers size={17} />,
          children: [
            { to: "/admin/users?tab=opd", label: "Yayasan / Dinas" },
            { to: "/admin/users?tab=satker", label: "Sekolah / Kampus" },
            { to: "/admin/school", label: "Profil & Kop Surat" },
            { to: "/admin/users?tab=jabatan", label: "Data Jabatan" },
            { to: "/admin/licenses", label: "Lisensi & Paket" },
            { to: "/admin/recaps?tab=export", label: "Ekspor Data" },
          ],
        },
        { to: "/admin/academic", icon: <Calendar size={17} />, label: "Kalender Akademik" },
        { to: "/admin/holidays", icon: <CalendarCheck size={17} />, label: "Hari Libur" },
        { to: "/admin/users?role=guru", icon: <Users size={17} />, label: "Pengajar & Staf" },
        { to: "/admin/attendance", icon: <CalendarCheck size={17} />, label: "Data Presensi" },
        { to: "/admin/validation", icon: <CheckCircle2 size={17} />, label: "Validasi Offline" },
        { to: "/admin/leave", icon: <ClipboardList size={17} />, label: "Izin & Cuti" },
        { to: "/admin/schedule", icon: <Calendar size={17} />, label: "Jadwal Mengajar" },
        { to: "/admin/recaps", icon: <FileText size={17} />, label: "Rekapitulasi" },
        { to: "/admin/ai-analytics", icon: <Award size={17} />, label: "AI Analytics" },
        { to: "/admin/generate-qr", icon: <QrCode size={17} />, label: "Buat QR Harian" },
        { to: "/admin/school-scanner", icon: <Scan size={17} />, label: "Stasiun Scan" },
      ],
    },
    {
      group: "AKUN SAYA",
      items: [
        { to: "/profile", icon: <UserCircle size={17} />, label: "Profil Saya" },
        { icon: <LogOut size={17} />, label: "Keluar", onClick: logout },
      ],
    },
  ];

  const teacherMenu: { group?: string | null; items: NavItemProps[] }[] = [
    {
      group: null,
      items: [
        { to: "/", icon: <LayoutDashboard size={17} />, label: "Beranda" },
        { to: "/?tab=cuti", icon: <ClipboardList size={17} />, label: "Ajukan Izin / Cuti" },
        { to: "/teacher/scan", icon: <Scan size={17} />, label: "Presensi Mandiri (GPS)" },
      ],
    },
    {
      group: "AKUN SAYA",
      items: [
        { to: "/profile", icon: <UserCircle size={17} />, label: "Profil Saya" },
        { icon: <LogOut size={17} />, label: "Keluar", onClick: logout },
      ],
    },
  ];

  const principalMenu: { group?: string | null; items: NavItemProps[] }[] = [
    {
      group: null,
      items: [
        { to: "/", icon: <LayoutDashboard size={17} />, label: "Dashboard Pimpinan" },
      ],
    },
    {
      group: "MANAJEMEN",
      items: [
        {
          to: "/admin/leave",
          icon: <ClipboardList size={17} />,
          label: "Persetujuan Izin / Cuti",
          badge: pendingLeaveCount > 0 ? pendingLeaveCount : undefined,
        },
        { to: "/admin/attendance", icon: <CalendarCheck size={17} />, label: "Data Presensi" },
        { to: "/principal/recaps", icon: <FileText size={17} />, label: "Rekapitulasi" },
        { to: "/admin/ai-analytics", icon: <Award size={17} />, label: "AI Analytics" },
        { to: "/admin/licenses", icon: <Layers size={17} />, label: "Lisensi & Paket" },
        { to: "/admin/school", icon: <Building size={17} />, label: "Profil & Kop Surat" },
        { to: "/teacher/scan", icon: <Scan size={17} />, label: "Presensi Mandiri (GPS)" },
      ],
    },
    {
      group: "AKUN SAYA",
      items: [
        { to: "/profile", icon: <UserCircle size={17} />, label: "Profil Saya" },
        { icon: <LogOut size={17} />, label: "Keluar", onClick: logout },
      ],
    },
  ];

  const developerMenu: { group?: string | null; items: NavItemProps[] }[] = [
    {
      group: null,
      items: [{ to: "/", icon: <LayoutDashboard size={17} />, label: "Beranda" }],
    },
    {
      group: "OPERASIONAL SEKOLAH",
      items: [
        {
          label: "Master Data",
          icon: <Layers size={17} />,
          children: [
            { to: "/admin/users?tab=opd", label: "Yayasan / Dinas" },
            { to: "/admin/users?tab=satker", label: "Sekolah / Kampus" },
            { to: "/admin/school", label: "Lokasi & Geofence" },
            { to: "/admin/users?tab=jabatan", label: "Data Jabatan" },
            { to: "/admin/licenses", label: "Lisensi & Paket" },
            { to: "/admin/recaps?tab=export", label: "Ekspor Data" },
          ],
        },
        { to: "/admin/academic", icon: <Calendar size={17} />, label: "Kalender Akademik" },
        { to: "/admin/holidays", icon: <CalendarCheck size={17} />, label: "Hari Libur" },
        { to: "/admin/users?role=guru", icon: <Users size={17} />, label: "Pengajar & Staf" },
        { to: "/admin/attendance", icon: <CalendarCheck size={17} />, label: "Data Presensi" },
        { to: "/admin/leave", icon: <ClipboardList size={17} />, label: "Izin & Cuti" },
        { to: "/admin/schedule", icon: <Calendar size={17} />, label: "Jadwal Mengajar" },
        { to: "/admin/recaps", icon: <FileText size={17} />, label: "Rekapitulasi" },
        { to: "/admin/ai-analytics", icon: <Award size={17} />, label: "AI Analytics" },
        { to: "/admin/generate-qr", icon: <QrCode size={17} />, label: "Buat QR Harian" },
        { to: "/admin/school-scanner", icon: <Scan size={17} />, label: "Stasiun Scan" },
      ],
    },
    {
      group: "PLATFORM & SISTEM",
      items: [
        { to: "/admin/developer", icon: <Terminal size={17} />, label: "Developer Console" },
        { to: "/admin/school", icon: <Settings size={17} />, label: "Konfigurasi Sistem" },
      ],
    },
    {
      group: "AKUN SAYA",
      items: [
        { to: "/profile", icon: <UserCircle size={17} />, label: "Profil Saya" },
        { icon: <LogOut size={17} />, label: "Keluar", onClick: logout },
      ],
    },
  ];

  const currentMenu =
    user?.role === "developer"
      ? developerMenu
      : user?.role === "admin"
        ? adminMenu
        : user?.role === "kepala_sekolah"
          ? principalMenu
          : user?.role === "guru" || user?.role === "dosen" || user?.role === "staf_sekolah" || user?.role === "staf_kampus"
            ? teacherMenu
            : [];

  // ── Role badge info ───────────────────────────────────────
  const roleLabel = user?.role ? (ROLE_LABELS[user.role] ?? user.role) : "Pengguna";

  const roleBadgeClass =
    user?.role === "developer"
      ? "bg-amber-50 border-amber-200/80 text-amber-700"
      : user?.role === "admin"
        ? "bg-indigo-50/80 border-indigo-200/80 text-indigo-700"
        : user?.role === "kepala_sekolah"
          ? "bg-purple-50 border-purple-200/80 text-purple-700"
          : user?.role === "guru" || user?.role === "dosen"
            ? "bg-emerald-50 border-emerald-200/80 text-emerald-700"
            : "bg-slate-100 border-slate-200/80 text-slate-700";

  const roleBadgeIcon =
    user?.role === "developer" ? <Terminal size={12} className="text-amber-600 shrink-0" /> :
    user?.role === "admin" ? <ShieldCheck size={12} className="text-indigo-600 shrink-0" /> :
    user?.role === "kepala_sekolah" ? <Award size={12} className="text-purple-600 shrink-0" /> :
    <UserCircle size={12} className="text-current shrink-0" />;

  const avatarClass =
    user?.role === "developer"
      ? "bg-gradient-to-br from-amber-400 to-orange-500 shadow-md shadow-amber-500/30"
      : "bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/30";

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  // ── Kunci scroll body saat sidebar mobile terbuka ───────────
  useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isSidebarOpen]);

  return (
    <div className="flex h-screen bg-slate-100 font-sans print:block print:h-auto print:bg-white overflow-hidden relative">
      {/* Mobile Overlay — hanya untuk role non-teacher */}
      {!isTeacherOrStaff && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Tutup sidebar"
        />
      )}

      {/* ── SIDEBAR — Tidak dirender untuk teacher/staf (navigasi via bottom tab bar) ── */}
      {!isTeacherOrStaff && (
      <aside
        className={cn(
          "print:hidden w-64 text-white flex flex-col transition-transform duration-300 ease-in-out z-50 shrink-0 theme-gradient",
          "fixed inset-y-0 left-0 md:relative md:translate-x-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header logo */}
        <div className="h-[68px] flex items-center justify-between gap-3 px-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={customLogo || "/logo-abdi.png"}
              alt="Logo ABDI"
              className="w-10 h-10 object-contain drop-shadow-sm shrink-0"
            />
            <div className="flex flex-col min-w-0">
              <span className="text-base font-black text-white leading-none tracking-widest">ABDI</span>
              <span className="text-[11px] font-semibold text-white/80 leading-none truncate mt-0.5">Absen Digital</span>
            </div>
          </div>
          {/* Tombol close sidebar di mobile */}
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden w-7 h-7 rounded-lg flex items-center justify-center bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition shrink-0 cursor-pointer"
            aria-label="Tutup menu"
          >
            <X size={15} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2.5 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20">
          {currentMenu.map((section, idx) => (
            <div key={idx} className="mb-4 last:mb-0">
              {section.group && (
                <div className="px-3 text-[9.5px] font-black uppercase tracking-[0.15em] mb-1.5 text-white/40">
                  {section.group}
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item, itemIdx) => (
                  <NavGroup key={itemIdx} item={item} currentPath={location.pathname} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User card di bawah sidebar */}
        <div className="p-3 shrink-0 border-t border-white/10">
          {user?.role === "developer" && (
            <div className="mb-2 flex items-center justify-center gap-1.5 px-2 py-1 rounded-lg bg-amber-400/20 border border-amber-400/30">
              <Terminal size={11} className="text-amber-300 shrink-0" />
              <span className="text-[9px] font-black text-amber-300 tracking-widest uppercase">Dev Mode</span>
            </div>
          )}
          <div className="bg-white/12 backdrop-blur-sm rounded-xl p-2.5 flex items-center gap-2.5 border border-white/15">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${avatarClass}`}>
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-white truncate leading-snug">{user?.name || "Pengguna"}</p>
              <p className="text-[10px] text-white/60 truncate leading-snug">{roleLabel}</p>
            </div>
          </div>
          <p className="text-center text-[9px] text-white/30 mt-2">© {new Date().getFullYear()} Alpha Project</p>
        </div>
      </aside>
      )}

      {/* ── MAIN CONTENT ───────────────────────────────────── */}
      <main className={cn("flex-1 flex flex-col overflow-hidden print:overflow-visible print:block print:bg-white bg-slate-50 min-w-0 relative", isTeacherOrStaff ? "pb-16" : "")}>
        {isTeacherOrStaff && <WindowControls />}
        {/* TOPBAR */}
        <header className={cn(
          "print:hidden h-14 bg-white items-center justify-between px-3 sm:px-5 shrink-0 relative z-10 border-b border-slate-200 shadow-sm gap-2",
          isTeacherOrStaff ? "hidden md:flex" : "flex"
        )}>
          {/* Kiri: hamburger + badge role */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              className="cursor-pointer p-2 hover:bg-slate-100 rounded-lg transition-colors md:hidden shrink-0"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Buka menu"
            >
              <Menu size={18} className="text-slate-600" />
            </button>

            {/* Role badge */}
            <span className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-extrabold tracking-wider uppercase whitespace-nowrap shrink-0 border",
              roleBadgeClass
            )}>
              {roleBadgeIcon}
              <span>{roleLabel.toUpperCase()}</span>
            </span>

            {/* Lisensi badge */}
            <button
              onClick={() => setShowPackageModal(true)}
              className={cn(
                "hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold tracking-wide uppercase border shadow-xs transition-all hover:scale-[1.02] active:scale-95 cursor-pointer whitespace-nowrap shrink-0",
                licenseConfig.badgeColor
              )}
              title="Klik untuk lihat detail & aktivasi lisensi paket"
            >
              <Award size={12} className="shrink-0" />
              <span>{licenseConfig.name}</span>
            </button>

            {/* Edit mode — developer only */}
            {user?.role === "developer" && (
              <div className="hidden sm:flex items-center gap-1.5">
                <button
                  onClick={toggleEditMode}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap border cursor-pointer",
                    isEditMode
                      ? "bg-indigo-600 text-white border-indigo-700"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200/80"
                  )}
                  title="Aktifkan/Nonaktifkan Mode Edit Teks"
                >
                  {isEditMode ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                  <span>{isEditMode ? "Edit ON" : "Edit OFF"}</span>
                </button>
                {isEditMode && (
                  <>
                    <button
                      onClick={saveEdits}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition border border-emerald-700 cursor-pointer"
                    >
                      <Save size={11} /> Simpan
                    </button>
                    <button
                      onClick={() => setShowDevSettings(true)}
                      className="flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 transition cursor-pointer"
                      title="Pengaturan Tema & Logo"
                    >
                      <Settings size={12} />
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Nama sekolah */}
            <div className="hidden lg:flex items-center gap-1.5 max-w-[280px]">
              <img
                src={customLogo || school.logoUrl || "/logo.png"}
                alt="Logo Instansi"
                className="w-5 h-5 object-contain shrink-0"
              />
              <span className="font-semibold text-slate-600 text-sm truncate">{school.name}</span>
            </div>
          </div>

          {/* Kanan: status koneksi + profil */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Status koneksi */}
            {isOnline && pendingQueueCount === 0 ? (
              <div
                className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold"
                title="Full Online — Terhubung real-time ke Firebase"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                <Wifi size={11} className="shrink-0 text-emerald-600" />
                <span className="hidden sm:inline">Online</span>
              </div>
            ) : (
              <button
                onClick={async () => {
                  if (!navigator.onLine) {
                    toast.error("Anda masih offline. Data tersimpan dan akan terkirim otomatis saat koneksi pulih.", { icon: "📡", duration: 5000 });
                    return;
                  }
                  if (pendingQueueCount > 0) {
                    const id = toast.loading(`Memproses sinkronisasi ${pendingQueueCount} antrean data...`);
                    try {
                      const count = await syncOfflineAttendance();
                      const remaining = getOfflineQueueCount();
                      setPendingQueueCount(remaining);
                      if (remaining === 0) {
                        toast.success(`${count > 0 ? `${count} data berhasil diunggah` : "Semua antrean data berhasil disinkronkan ke Cloud"}.`, { id, icon: "🟢", duration: 4000 });
                      } else {
                        toast.error(`Sisa ${remaining} antrean belum tersinkron karena kendala jaringan/izin Cloud.`, { id, duration: 5000 });
                      }
                    } catch (err: any) {
                      setPendingQueueCount(getOfflineQueueCount());
                      toast.error(err.message || "Gagal sinkronisasi antrean. Coba lagi nanti.", { id, duration: 5000 });
                    }
                  }
                }}
                className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-800 text-[10px] font-bold animate-pulse cursor-pointer hover:bg-amber-100 transition"
                title={!isOnline ? "Offline Mode" : `Klik untuk sinkronisasi ${pendingQueueCount} antrean`}
              >
                <WifiOff size={11} className="shrink-0 text-amber-600" />
                <span className="hidden sm:inline">{!isOnline ? "Offline" : `Antrean (${pendingQueueCount})`}</span>
              </button>
            )}

            {/* Profil dropdown */}
            <div className="flex items-center gap-2 relative" ref={profileRef}>
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-800 truncate max-w-[140px]">{user?.name || "Pengguna"}</p>
                <p className="text-[10px] font-medium text-slate-400">{roleLabel}</p>
              </div>
              <button
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm cursor-pointer text-white shrink-0",
                  avatarClass
                )}
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                title="Menu Profil"
                aria-label="Buka menu profil"
              >
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </button>

              {isProfileOpen && (
                <div className="absolute top-11 right-0 w-52 bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/60 py-2 px-1.5 z-50 animate-fade-in">
                  <div className="px-3 py-2 border-b border-slate-100 mb-1">
                    <p className="text-sm font-semibold text-slate-800 truncate">{user?.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{roleLabel}</p>
                  </div>
                  <Link
                    to="/profile"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-xl transition-all"
                  >
                    <UserCircle size={15} /> Profil Saya
                  </Link>
                  <button
                    onClick={() => { setIsProfileOpen(false); logout(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-all text-left cursor-pointer"
                  >
                    <LogOut size={15} /> Keluar
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className={cn(
          "flex-1 overflow-y-auto print:overflow-visible print:p-0 flex flex-col",
          isTeacherOrStaff ? "p-0 md:p-5 lg:p-6" : "p-3 sm:p-5 lg:p-6"
        )}>
          <div className={cn(
            "flex-1 flex flex-col",
            isTeacherOrStaff ? "w-full min-h-full" : "max-w-7xl mx-auto w-full"
          )}>
            <Outlet />
          </div>
        </div>
      </main>

      {/* ── MODALS ─────────────────────────────────────────── */}
      {showDevSettings && <DeveloperSettingsModal onClose={() => setShowDevSettings(false)} />}

      {showPackageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl shadow-2xl max-w-3xl w-full border border-indigo-500/30 overflow-hidden relative text-white max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center">
                    <Award size={17} />
                  </div>
                  <div>
                    <h3 className="font-black text-white text-base">Status & Detail Lisensi</h3>
                    <p className="text-xs text-slate-400">Informasi paket aktif dan token instansi</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPackageModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer border border-slate-700"
                >
                  <X size={15} />
                </button>
              </div>
              <PackageActivationCard isModal />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
