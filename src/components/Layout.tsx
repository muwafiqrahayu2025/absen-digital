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
} from "lucide-react";
import { DeveloperSettingsModal } from "./DeveloperSettingsModal";
import toast from "react-hot-toast";
import { cn } from "../lib/utils";
import { db, syncOfflineAttendance } from "../lib/db";
import { useAttendanceEmailNotification } from "../hooks/useAttendanceEmailNotification";
import { useTeacherReminder } from "../hooks/useTeacherReminder";

type NavItemProps = {
  to?: string;
  icon?: React.ReactNode;
  label: string;
  isActive?: boolean;
  children?: NavItemProps[];
  onClick?: () => void;
};

const isRouteActive = (to: string, currentPathname: string, currentSearch: string) => {
  if (!to) return false;
  if (to.includes('?')) {
    return currentPathname + currentSearch === to;
  }
  return currentPathname === to && !currentSearch;
};

const NavGroup: React.FC<{ item: NavItemProps; currentPath: string }> = ({
  item,
  currentPath,
}) => {
  const { theme } = useTheme();
  const location = useLocation();
  const { user } = useAuth();
  const isDeveloper = user?.role === "developer";

  const isAnyChildActive = item.children?.some(
    (child) => child.to ? isRouteActive(child.to, location.pathname, location.search) : false,
  ) || false;

  const [isOpen, setIsOpen] = useState(() => isAnyChildActive);

  useEffect(() => {
    if (isAnyChildActive) {
      setIsOpen(true);
    }
  }, [isAnyChildActive]);

  if (!item.children) {
    if (item.onClick) {
      return (
        <button
          onClick={item.onClick}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-sm text-white/80 hover:bg-white/15 hover:text-white border border-transparent cursor-pointer"
        >
          <div className="w-5 h-5 flex items-center justify-center shrink-0">
            {item.icon}
          </div>
          <EditableText originalText={item.label} />
        </button>
      );
    }
    const active = item.to ? isRouteActive(item.to, location.pathname, location.search) : false;
    return (
      <Link
        to={item.to || "#"}
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-sm border",
          active
            ? "bg-white/20 backdrop-blur-md text-white font-black border-white/30 shadow-sm shadow-purple-500/10"
            : "border-transparent text-white/80 hover:bg-white/15 hover:text-white",
        )}
      >
        <div className="w-5 h-5 flex items-center justify-center shrink-0">
          {item.icon}
        </div>
        <EditableText originalText={item.label} />
      </Link>
    );
  }

  return (
    <div className="mb-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 text-sm border cursor-pointer",
          isAnyChildActive
            ? "bg-white/20 backdrop-blur-md text-white font-black border-white/30 shadow-sm shadow-purple-500/10"
            : "border-transparent text-white/80 hover:bg-white/15 hover:text-white",
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 flex items-center justify-center shrink-0">
            {item.icon}
          </div>
          <EditableText originalText={item.label} />
        </div>
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {isOpen && (
        <div className="ml-10 mt-1 flex flex-col gap-1 relative before:absolute before:left-[-1.25rem] before:top-0 before:bottom-0 before:w-px before:bg-white/20">
          {item.children.map((child, index) =>
            child.onClick ? (
              <button
                key={index}
                onClick={child.onClick}
                className="w-full text-left py-2 px-3 rounded-xl text-sm transition-all duration-150 text-white/70 hover:text-white hover:bg-white/15 relative before:absolute before:left-[-1.25rem] before:top-1/2 before:-mt-px before:w-3 before:h-px before:bg-white/20 cursor-pointer"
              >
                <EditableText originalText={child.label} />
              </button>
            ) : (
              <Link
                key={index}
                to={child.to || "#"}
                className={cn(
                  "py-2 px-3 rounded-xl text-sm transition-all duration-150 relative before:absolute before:left-[-1.25rem] before:top-1/2 before:-mt-px before:w-3 before:h-px before:bg-white/20 border",
                  child.to && isRouteActive(child.to, location.pathname, location.search)
                    ? "bg-white/20 backdrop-blur-md text-white font-black border-white/30 shadow-sm shadow-purple-500/10"
                    : "border-transparent text-white/70 hover:text-white hover:bg-white/15",
                )}
              >
                <EditableText originalText={child.label} />
              </Link>
            ),
          )}
        </div>
      )}
    </div>
  );
};

export function Layout() {
  const { user, logout } = useAuth();
  const school = db.getSchool();
  const location = useLocation();
  const { theme } = useTheme();
  const { isEditMode, toggleEditMode, saveEdits, customLogo } = useEditMode();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showDevSettings, setShowDevSettings] = useState(false);  const profileRef = React.useRef<HTMLDivElement>(null);

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    let wasOffline = !navigator.onLine;

    const handleOnline = async () => {
      setIsOnline(true);
      if (wasOffline) {
        toast.dismiss();
        toast.loading("Sinkronisasi otomatis absensi lokal...", {
          id: "autosync",
        });
        try {
          const count = await syncOfflineAttendance();
          if (count > 0) {
            toast.success(
              `Absensi disinkronkan! Berhasil mengunggah ${count} data lokal ke server.`,
              {
                id: "autosync",
                icon: "🟢",
                duration: 5000,
              },
            );
          } else {
            toast.success("Koneksi internet terhubung kembali!", {
              id: "autosync",
              icon: "🟢",
              duration: 3000,
            });
          }
        } catch (err) {
          toast.error("Gagal melakukan sinkronisasi otomatis.", {
            id: "autosync",
          });
        }
        wasOffline = false;
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      wasOffline = true;
      toast.dismiss();
      toast.error(
        "Koneksi internet terputus! Anda sedang offline. Absensi Anda tetap tersimpan secara lokal dan akan disinkronkan nanti.",
        {
          icon: "⚠️",
          duration: 6000,
        },
      );
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useAttendanceEmailNotification();
  useTeacherReminder();

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const adminMenu = [
    {
      group: null,
      items: [
        { to: "/", icon: <LayoutDashboard size={18} />, label: "Dashboard" },
      ],
    },
    {
      group: "MAIN NAVIGATION",
      items: [
        {
          label: "Master Data",
          icon: <Layers size={18} />,
          children: [
            { to: "/admin/users?tab=opd", label: "Data Yayasan" },
            { to: "/admin/users?tab=satker", label: "Data Madrasah" },
            { to: "/admin/school", label: "Data Lokasi Presensi" },
            { to: "/admin/users?tab=jabatan", label: "Data Jabatan" },
            { to: "/admin/recaps?tab=export", label: "Ekspor Data" },
          ],
        },
        {
          to: "/admin/academic",
          icon: <Calendar size={18} />,
          label: "Kalender / Jadwal",
        },
        {
          to: "/admin/users?role=guru",
          icon: <Users size={18} />,
          label: "Guru & Staf",
        },
        {
          to: "/admin/attendance",
          icon: <CalendarCheck size={18} />,
          label: "Data Presensi",
        },
        {
          to: "/admin/leave",
          icon: <ClipboardList size={18} />,
          label: "Izin/Cuti",
        },
        {
          to: "/admin/schedule",
          icon: <Calendar size={18} />,
          label: "Manajemen Jadwal",
        },
        {
          to: "/admin/recaps",
          icon: <FileText size={18} />,
          label: "Rekapitulasi",
        },
        {
          to: "/admin/generate-qr",
          icon: <QrCode size={18} />,
          label: "Buat QR Harian",
        },
        {
          to: "/admin/school-scanner",
          icon: <Scan size={18} />,
          label: "Stasiun Pemindai Sekolah",
        },
      ],
    },
    {
      group: "SAYA",
      items: [
        {
          to: "/profile",
          icon: <UserCircle size={18} />,
          label: "Profil Saya",
        },
        { icon: <LogOut size={18} />, label: "Keluar", onClick: logout },
      ],
    },
  ];

  const teacherMenu = [
    {
      group: null,
      items: [
        {
          to: "/",
          icon: <LayoutDashboard size={18} />,
          label: "Saku Presensi App",
        },
        {
          to: "/teacher/scan",
          icon: <Scan size={18} />,
          label: "Absen Mandiri (GPS)",
        },
      ],
    },
    {
      group: "SAYA",
      items: [
        {
          to: "/profile",
          icon: <UserCircle size={18} />,
          label: "Profil Saya",
        },
        { icon: <LogOut size={18} />, label: "Keluar", onClick: logout },
      ],
    },
  ];

  const principalMenu = [
    {
      group: null,
      items: [
        {
          to: "/",
          icon: <LayoutDashboard size={18} />,
          label: "Dashboard Kamad",
        },
        {
          to: "/admin/leave",
          icon: <ClipboardList size={18} />,
          label: "Persetujuan Izin/Cuti",
        },
        {
          to: "/principal/recaps",
          icon: <FileText size={18} />,
          label: "Rekapitulasi Absensi",
        },
      ],
    },
    {
      group: "SAYA",
      items: [
        {
          to: "/profile",
          icon: <UserCircle size={18} />,
          label: "Profil Saya",
        },
        { icon: <LogOut size={18} />, label: "Keluar", onClick: logout },
      ],
    },
  ];

  const developerMenu = [
    ...adminMenu.slice(0, -1),
    {
      group: "SYSTEM CONFIG",
      items: [
        {
          to: "/admin/developer",
          icon: <Terminal size={18} />,
          label: "Sistem Pengembang",
        }
      ]
    },
    adminMenu[adminMenu.length - 1]
  ];

  const currentMenu: { group?: string | null; items: NavItemProps[] }[] =
    user?.role === "developer"
      ? developerMenu
      : user?.role === "admin"
      ? adminMenu
      : user?.role === "guru" || user?.role === "staf_sekolah"
        ? teacherMenu
        : user?.role === "kepala_madrasah"
          ? principalMenu
          : [];

  return (
    <div className="flex h-screen bg-slate-100 font-sans print:block print:h-auto print:bg-white overflow-hidden relative">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}


      {/* Sidebar - Dynamic Gradient */}
      <aside
        className={cn(
          "print:hidden w-64 text-white flex flex-col transition-all duration-500 z-50 shrink-0 relative theme-gradient",
          "fixed inset-y-0 left-0 md:relative md:translate-x-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo Area */}
        <div className="h-20 flex items-center gap-3 px-5 mt-1 pb-2">
          <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
            <img
              src={customLogo || "/logo.png"}
              alt="Logo"
              className="w-12 h-12 object-contain drop-shadow-sm"
            />
          </div>
          <div className="flex flex-col min-w-0 justify-center pt-1">
            <span className="text-xl font-black text-white leading-none tracking-[0.28em] drop-shadow-sm mb-1 ml-0.5">ABDI</span>
            <span className="text-sm font-bold text-white/95 leading-none truncate mb-1">Absen Digital</span>
            <span className="text-[10px] text-white/70 leading-none truncate">Sistem Presensi Terpadu</span>
          </div>
        </div>

        <nav className="flex-1 py-2 px-3 overflow-y-auto">
          {currentMenu.map((section, idx) => (
            <div key={idx} className="mb-5 last:mb-0">
              {section.group && (
                <div className="px-4 text-[10px] font-bold uppercase tracking-widest mb-2 text-white/50">
                  {section.group}
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item, itemIdx) => (
                  <NavGroup
                    key={itemIdx}
                    item={item}
                    currentPath={location.pathname}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom user card */}
        <div className="p-4 shrink-0">
          <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-3 flex items-center gap-3 border border-white/20">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-300 to-pink-400 flex items-center justify-center text-white font-bold text-xs shrink-0">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white truncate">{user?.name}</p>
              <p className="text-[10px] text-white/60 truncate capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-[9px] text-white/40 font-medium tracking-wide">&copy; {new Date().getFullYear()} Alpha Project</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden print:overflow-visible print:block print:bg-white bg-[#f5f3ff]">
        <header className="print:hidden h-16 bg-white flex items-center justify-between px-4 sm:px-6 shrink-0 relative z-10 border-b border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3 text-slate-700 font-medium">
            <button
              className="cursor-pointer p-2 hover:bg-slate-100 rounded-md transition-colors md:hidden"
              onClick={() => setIsSidebarOpen(true)}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="uppercase font-bold tracking-wider text-slate-800 text-sm hidden sm:inline-block">
                {user?.role === "developer"
                  ? "DEVELOPER"
                  : user?.role === "admin"
                  ? "ADMINISTRATOR"
                  : user?.role === "kepala_madrasah"
                    ? "KEPALA SEKOLAH"
                    : user?.role === "guru"
                      ? "GURU"
                      : "STAF SEKOLAH"}
              </span>
              <span className="uppercase font-bold tracking-wider text-slate-800 text-sm sm:hidden">
                {user?.role === "developer"
                  ? "DEV"
                  : user?.role === "admin"
                  ? "ADMIN"
                  : user?.role === "kepala_madrasah"
                    ? "KEPALA"
                    : user?.role === "guru"
                      ? "GURU"
                      : "STAF"}
              </span>
              
              <div className="h-4 sm:h-5 w-[1.5px] bg-slate-300/80 rounded-full hidden sm:block"></div>
              
              {user?.role === "developer" && (
                <div className="flex items-center gap-2 ml-2">
                  <button
                    onClick={toggleEditMode}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${isEditMode ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-transparent'}`}
                  >
                    {isEditMode ? <ToggleRight size={16} className="text-indigo-600" /> : <ToggleLeft size={16} />}
                    <span className="hidden md:inline">{isEditMode ? 'Edit Mode ON' : 'Edit Mode OFF'}</span>
                  </button>
                  {isEditMode && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={saveEdits}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-sm"
                      >
                        <Save size={14} />
                        <span className="hidden md:inline">Simpan</span>
                      </button>
                      <button
                        onClick={() => setShowDevSettings(true)}
                        className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors shadow-sm"
                        title="Pengaturan Tema & Logo"
                      >
                        <Settings size={16} />
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              <div className="hidden sm:flex items-center gap-2 max-w-[150px] md:max-w-[250px] lg:max-w-[400px]">
                <img 
                  src={customLogo || school.logoUrl || "/logo.png"} 
                  alt="Logo Sekolah" 
                  className="w-5 h-5 sm:w-6 sm:h-6 object-contain drop-shadow-sm"
                />
                <span className="font-semibold text-slate-600 text-sm truncate">
                  {school.name}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Status Koneksi */}
            <div className="flex items-center">
              {isOnline ? (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] sm:text-xs font-semibold shadow-xs"
                  title="Koneksi terhubung dengan internet"
                >
                  <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-emerald-500"></span>
                  </span>
                  <Wifi
                    size={12}
                    className="sm:size-3.5 shrink-0 text-emerald-600"
                  />
                  <span>Online</span>
                </div>
              ) : (
                <div
                  className="flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] sm:text-xs font-semibold shadow-xs animate-pulse"
                  title="Koneksi sedang offline. Absensi disimpan di memori lokal dan akan disinkronkan otomatis ketika online."
                >
                  <WifiOff
                    size={11}
                    className="sm:size-3.5 shrink-0 text-rose-600"
                  />
                  <span className="max-w-[70px] sm:max-w-[175px] md:max-w-none truncate text-rose-800">
                    <span className="sm:hidden">Offline</span>
                    <span className="hidden sm:inline font-semibold">
                      Offline — Absensi Sinkron Nanti
                    </span>
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 relative" ref={profileRef}>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-800">
                  {user?.role === "developer"
                    ? "Developer"
                    : user?.role === "admin"
                    ? "Admin"
                    : user?.role === "kepala_madrasah"
                      ? "Kepala Sekolah"
                      : user?.role === "guru"
                        ? "Guru"
                        : "Staf Sekolah"}
                </p>
              </div>
              <div
                className="w-9 h-9 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center font-bold text-sm cursor-pointer hover:bg-slate-300 transition-colors"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                title="Menu Profil"
              >
                <UserCircle size={24} />
              </div>

              {isProfileOpen && (
                <div className="absolute top-12 right-0 w-48 bg-white/75 backdrop-blur-xl rounded-2xl shadow-lg border border-white/60 py-2.5 px-1.5 z-50">
                  <div className="px-4 py-2 border-b border-slate-100 mb-1">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {user?.name}
                    </p>
                    <p className="text-xs text-slate-500 capitalize">
                      {user?.role.replace("_", " ")}
                    </p>
                  </div>
                  <Link
                    to="/profile"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-white/50 hover:scale-[1.01] rounded-xl transition-all duration-200"
                  >
                    <UserCircle size={16} />
                    Profil
                  </Link>
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-500/15 hover:scale-[1.01] rounded-xl transition-all duration-200 text-left"
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto print:overflow-visible p-4 sm:p-6 lg:p-8 print:p-0">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>

      {/* Modals */}
      {showDevSettings && (
        <DeveloperSettingsModal onClose={() => setShowDevSettings(false)} />
      )}
    </div>
  );
}
