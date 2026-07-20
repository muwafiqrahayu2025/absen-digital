import React, { useState, useEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { db } from "../../lib/db";
import { User, Role, OPD, SatuanKerja, Jabatan } from "../../types";
import { Plus, Edit2, Trash2, Layers, Building, Briefcase, Award, Search, Users, X, Printer, QrCode, UserCircle, Save } from 'lucide-react';
import toast from "react-hot-toast";
import { QRCodeSVG } from "qrcode.react";
import { EditableText } from "../../components/EditableText";
import { useAuth } from "../../components/AuthContext";
import { useFirebaseData } from "../../hooks/useFirebaseData";
import { dbRealtime, getTenantRef } from "../../lib/firebase";
import { ref, set, remove } from "firebase/database";

export function ManageUsers() {
  const { user: currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "pegawai";
  const roleFilter = searchParams.get("role");
  const { data: usersData, loading: usersLoading, isOffline } = useFirebaseData('users');
  const { data: opdsData } = useFirebaseData('opds');
  const { data: satkersData } = useFirebaseData('satuanKerjas');
  const { data: jabatansData } = useFirebaseData('jabatans');
  const { data: schoolData } = useFirebaseData('school');

  const users = React.useMemo(() => Array.isArray(usersData) ? usersData : Object.values(usersData || {}), [usersData]) as User[];
  const opds = React.useMemo(() => Array.isArray(opdsData) ? opdsData : Object.values(opdsData || {}), [opdsData]) as OPD[];
  const satuanKerjas = React.useMemo(() => Array.isArray(satkersData) ? satkersData : Object.values(satkersData || {}), [satkersData]) as SatuanKerja[];
  const jabatans = React.useMemo(() => Array.isArray(jabatansData) ? jabatansData : Object.values(jabatansData || {}), [jabatansData]) as Jabatan[];

  const school = schoolData || db.getSchool();
  const yayasanName = "YAYASAN " + (school.name || "AL-HIDAYAH").replace(/^(mts\.|smp|sma|ma|sd|mi)\s+/i, "").toUpperCase();

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // Modals visibility states
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isOpdModalOpen, setIsOpdModalOpen] = useState(false);
  const [isSatkerModalOpen, setIsSatkerModalOpen] = useState(false);
  // MIN-02 FIX: typo corrected from isJababanModalOpen to isJabatanModalOpen
  const [isJabatanModalOpen, setIsJabatanModalOpen] = useState(false);

  // Edit target states
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedUserForQR, setSelectedUserForQR] = useState<User | null>(null);
  const [editingOpd, setEditingOpd] = useState<OPD | null>(null);
  const [editingSatker, setEditingSatker] = useState<SatuanKerja | null>(null);
  const [editingJabatan, setEditingJabatan] = useState<Jabatan | null>(null);

  // Form states
  const [userForm, setUserForm] = useState({
    username: "",
    name: "",
    role: "guru" as Role,
    password: "",
    nip: "",
    phone: "",
    email: "",
    opd: "-",
    satuanKerja: "",
    jabatan: "",
    mapelUtama: "",
    mapelSertifikasi: "",
  });

  const [opdForm, setOpdForm] = useState({
    singkatan: "",
    nama: "",
  });

  const [satkerForm, setSatkerForm] = useState({
    singkatan: "",
    nama: "",
    opdId: "1",
  });

  const [jabForm, setJabForm] = useState({
    kategori: "Guru Mapel",
    keterangan: "",
    nama: "",
  });

  // Handle Deletions
  const handleDeleteUser = async (id: string) => {
    if (isOffline) { toast.error("Koneksi terputus. Tidak bisa menghapus saat offline."); return; }
    if (confirm("Yakin ingin menghapus data pegawai ini dari portal presensi?")) {
      await remove(getTenantRef(`users/${id}`));
      toast.success("Pegawai berhasil dihapus");
    }
  };

  const handleDeleteOpd = async (id: string) => {
    if (isOffline) { toast.error("Koneksi terputus. Tidak bisa menghapus saat offline."); return; }
    if (
      confirm(
        "Yakin ingin menghapus Yayasan ini? Semua unit di bawahnya mungkin terpengaruh.",
      )
    ) {
      await remove(getTenantRef(`opds/${id}`));
      toast.success("Yayasan berhasil dihapus");
    }
  };

  const handleDeleteSatker = async (id: string) => {
    if (isOffline) { toast.error("Koneksi terputus. Tidak bisa menghapus saat offline."); return; }
    if (confirm("Yakin ingin menghapus Satuan Kerja ini?")) {
      await remove(getTenantRef(`satuanKerjas/${id}`));
      toast.success("Satuan Kerja berhasil dihapus");
    }
  };

  const handleDeleteJabatan = async (id: string) => {
    if (isOffline) { toast.error("Koneksi terputus. Tidak bisa menghapus saat offline."); return; }
    if (confirm("Yakin ingin menghapus formasi Jabatan ini?")) {
      await remove(getTenantRef(`jabatans/${id}`));
      toast.success("Jabatan berhasil dihapus");
    }
  };

  // Open Add Modals
  const handleAddUserOpen = () => {
    setEditingUser(null);
    setUserForm({
      username: "",
      name: "",
      role: "guru",
      password: "",
      nip: "",
      phone: "",
      email: "",
      opd: opds[0]?.singkatan || "-",
      satuanKerja: satuanKerjas[0]?.nama || "",
      jabatan: jabatans[0]?.nama || "",
      mapelUtama: "",
      mapelSertifikasi: "",
    });
    setIsUserModalOpen(true);
  };

  const handleAddOpdOpen = () => {
    setEditingOpd(null);
    setOpdForm({ singkatan: "", nama: "" });
    setIsOpdModalOpen(true);
  };

  const handleAddSatkerOpen = () => {
    setEditingSatker(null);
    setSatkerForm({ singkatan: "", nama: "", opdId: opds[0]?.id || "1" });
    setIsSatkerModalOpen(true);
  };

  const handleAddJabatanOpen = () => {
    setEditingJabatan(null);
    setJabForm({ kategori: "Guru Mapel", keterangan: "", nama: "" });
    setIsJabatanModalOpen(true);
  };

  // Open Edit Modals
  const handleEditUserOpen = (u: User) => {
    setEditingUser(u);
    setUserForm({
      username: u.username,
      name: u.name,
      role: u.role,
      password: u.password || "",
      nip: u.nip || "",
      phone: u.phone || "",
      email: u.email || "",
      opd: u.opd || "-",
      satuanKerja:
        u.satuanKerja ||
        "Instansi / Sekolah / Kampus",
      jabatan: u.jabatan || "Posisi / Jabatan",
      mapelUtama: u.mapelUtama || "",
      mapelSertifikasi: u.mapelSertifikasi || "",
    });
    setIsUserModalOpen(true);
  };

  const handleEditOpdOpen = (o: OPD) => {
    setEditingOpd(o);
    setOpdForm({ singkatan: o.singkatan, nama: o.nama });
    setIsOpdModalOpen(true);
  };

  const handleEditSatkerOpen = (s: SatuanKerja) => {
    setEditingSatker(s);
    setSatkerForm({ singkatan: s.singkatan, nama: s.nama, opdId: s.opdId });
    setIsSatkerModalOpen(true);
  };

  const handleEditJabatanOpen = (j: Jabatan) => {
    setEditingJabatan(j);
    let kat = "Lainnya";
    let ket = "";
    if (j.nama.startsWith("Guru Mapel")) {
      kat = "Guru Mapel"; ket = j.nama.replace("Guru Mapel", "").trim();
    } else if (j.nama.startsWith("Staf Tata Usaha")) {
      kat = "Staf Tata Usaha"; ket = j.nama.replace("Staf Tata Usaha", "").trim();
    } else if (j.nama.startsWith("Tenaga Kependidikan Lainnya")) {
      kat = "Tenaga Kependidikan Lainnya"; ket = j.nama.replace("Tenaga Kependidikan Lainnya", "").trim();
    } else {
      kat = "Lainnya"; ket = j.nama;
    }
    setJabForm({ kategori: kat, keterangan: ket, nama: j.nama });
    setIsJabatanModalOpen(true);
  };

  // Save Handlers
  const handleUserSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOffline) { toast.error("Koneksi terputus. Tidak bisa menyimpan saat offline."); return; }
    const id = editingUser ? editingUser.id : Math.random().toString(36).substring(2, 9);
    const updatedUser = { ...userForm, id };
    await set(getTenantRef(`users/${id}`), updatedUser);
    toast.success(editingUser ? "Pembaruan data pegawai berhasil disimpan!" : "Guru/Staf baru berhasil didaftarkan!");
    setIsUserModalOpen(false);
  };

  const handleOpdSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOffline) { toast.error("Koneksi terputus. Tidak bisa menyimpan saat offline."); return; }
    const tenantId = localStorage.getItem("abdi_active_tenant_id");
    if (!tenantId || tenantId === 'undefined' || tenantId === 'null') {
      toast.error("Error: Data Sekolah (tenantId) tidak valid! Silakan relogin.");
      return;
    }
    const singkatan = (opdForm.singkatan || opdForm.nama).toUpperCase();
    const nama = opdForm.nama.toUpperCase();
    const id = editingOpd ? editingOpd.id : String(Date.now());
    const updatedOpd = { id, singkatan, nama };
    
    const dbPath = `opds/${id}`;
    const fullRef = getTenantRef(dbPath);
    console.log("=== DEBUG YAYASAN/OPD SAVE ===");
    console.log("PATH REF: ", fullRef.toString());
    console.log("TENANT ID: ", localStorage.getItem("abdi_active_tenant_id"));
    console.log("PAYLOAD: ", updatedOpd);

    try {
      await set(fullRef, updatedOpd);
      toast.success(editingOpd ? "OPD berhasil diubah" : "OPD Baru berhasil ditambahkan");
      setIsOpdModalOpen(false);
    } catch (error: any) {
      console.error("FIREBASE ERROR ON SAVE OPD:", error);
      toast.error(`Akses Ditolak! Path: ${dbPath}`);
    }
  };

  const handleSatkerSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOffline) { toast.error("Koneksi terputus. Tidak bisa menyimpan saat offline."); return; }
    const tenantId = localStorage.getItem("abdi_active_tenant_id");
    if (!tenantId || tenantId === 'undefined' || tenantId === 'null') {
      toast.error("Error: Data Sekolah (tenantId) tidak valid! Silakan relogin.");
      return;
    }
    const singkatan = (satkerForm.singkatan || satkerForm.nama).toUpperCase();
    const nama = satkerForm.nama.toUpperCase();
    const id = editingSatker ? editingSatker.id : String(Date.now());
    const updatedSatker = { id, singkatan, nama, opdId: satkerForm.opdId };
    await set(getTenantRef(`satuanKerjas/${id}`), updatedSatker);
    toast.success(editingSatker ? "Satuan Kerja berhasil diubah" : "Satuan Kerja baru didaftarkan");
    setIsSatkerModalOpen(false);

    // Otomatis ganti nama Instansi Utama (SMA / SMP / Kampus Unggulan Nusantara) ketika user menginput data di satuan kerja
    const currentSchool = school;
    if (currentSchool) {
      const isDefaultSchoolName =
        currentSchool.name === "SMA / SMP / Kampus Unggulan Nusantara" ||
        currentSchool.name.toUpperCase() === "SMA / SMP / KAMPUS UNGGULAN NUSANTARA" ||
        currentSchool.name.includes("Kampus Unggulan Nusantara");

      if (isDefaultSchoolName || !editingSatker) {
        const updatedSchool = {
          ...currentSchool,
          name: nama,
          nama_instansi: nama,
          kopSurat: {
            ...(currentSchool.kopSurat || {}),
            nama_instansi: nama,
          }
        };
        await set(getTenantRef('school'), updatedSchool);
        if (isDefaultSchoolName) {
          toast.success(`🎉 Nama Instansi & Kop Surat otomatis diganti menjadi: ${nama}`, { duration: 4500 });
        }
      }
    }
  };

  const handleJabatanSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOffline) { toast.error("Koneksi terputus. Tidak bisa menyimpan saat offline."); return; }
    const finalNama = jabForm.kategori === "Lainnya" ? jabForm.nama : `${jabForm.kategori} ${jabForm.keterangan}`.trim();
    const id = editingJabatan ? editingJabatan.id : String(Date.now());
    const updatedJabatan = { id, nama: finalNama };
    await set(getTenantRef(`jabatans/${id}`), updatedJabatan);
    toast.success(editingJabatan ? "Formasi Jabatan berhasil diubah" : "Formasi Jabatan baru ditambahkan");
    setIsJabatanModalOpen(false);
  };

  // Filter lists based on Search bar
  const query = searchQuery.toLowerCase();

  const filteredUsers = users.filter((u) => {
    if (u.role === "developer" && currentUser?.role !== "developer") {
      return false;
    }
    const matchesSearch =
      (u.name || "").toLowerCase().includes(query) ||
      (u.username || "").toLowerCase().includes(query) ||
      ((u.nip || "").toLowerCase().includes(query)) ||
      ((u.jabatan || "").toLowerCase().includes(query));
    if (roleFilter) {
      return matchesSearch && u.role === roleFilter;
    }
    return matchesSearch;
  });

  const filteredOpds = opds.filter(
    (o) =>
      (o.nama || "").toLowerCase().includes(query) ||
      (o.singkatan || "").toLowerCase().includes(query),
  );

  const filteredSatkers = satuanKerjas.filter(
    (s) =>
      (s.nama || "").toLowerCase().includes(query) ||
      (s.singkatan || "").toLowerCase().includes(query),
  );

  const filteredJabatans = jabatans.filter((j) =>
    (j.nama || "").toLowerCase().includes(query),
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight capitalize">
            {activeTab === "pegawai" && <EditableText originalText="Data Pegawai / Guru / Dosen" />}
            {activeTab === "opd" && <EditableText originalText="Master Lembaga / Yayasan / Dinas" />}
            {activeTab === "satker" && <EditableText originalText="Master Satuan Kerja / Sekolah / Kampus" />}
            {activeTab === "jabatan" && <EditableText originalText="Master Data Jabatan" />}
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {activeTab === "pegawai" && (
              <EditableText originalText="Manajemen data login personal pegawai / guru / dosen / staf, pembagian jabatan, dan ID Pegawai / NIP / NIDN / NIK." />
            )}
            {activeTab === "opd" && (
              <EditableText originalText="Daftar lembaga naungan (Dinas / Yayasan / Rektorat) penyelenggara instansi atau sekolah." />
            )}
            {activeTab === "satker" && (
              <EditableText originalText="Daftar satuan kerja atau unit pelayanan sekolah / kampus / instansi." />
            )}
            {activeTab === "jabatan" && (
              <EditableText originalText="Pengaturan spesifikasi formasi jabatan pegawai / guru / dosen." />
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (activeTab === "pegawai") handleAddUserOpen();
            if (activeTab === "opd") handleAddOpdOpen();
            if (activeTab === "satker") handleAddSatkerOpen();
            if (activeTab === "jabatan") handleAddJabatanOpen();
          }}
          className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
        >
          <Plus size={16} />
          {/* UBAHAN: TOMBOL DIUBAH MENJADI "Tambah Data" */}
          <EditableText originalText="Tambah Data" />
        </button>
      </div>

      {/* FILTER SEARCH BAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-150 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Cari kata kunci data..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl outline-none text-xs bg-slate-50/50"
          />
        </div>
      </div>

      {isOffline && (
        <div className="bg-amber-100 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-center gap-3">
          <div className="shrink-0">
            <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-sm">Mode Luring (Offline) Aktif</p>
            <p className="text-xs mt-0.5">Koneksi terputus. Pengelolaan Data Master membutuhkan koneksi internet aktif. Form CRUD telah dikunci.</p>
          </div>
        </div>
      )}

      {usersLoading ? (
         <div className="flex justify-center p-8 text-slate-400 font-medium">Memuat data...</div>
      ) : (
      <>
      {/* RENDER TABLE ACCORDING TO THE ACTIVE TAB SELECTION */}

      {/* 1. PEGAWAI TAB VIEW */}
      {activeTab === "pegawai" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#17a2b8] text-white">
                <tr>
                  <th className="p-4">Foto / Biodata Pegawai</th>
                  <th className="p-4">ID Pegawai / NIP / NIDN / NIK</th>
                  <th className="p-4">Organisasi / Lembaga</th>
                  <th className="p-4">Unit Satker</th>
                  <th className="p-4">Jabatan Fungsional</th>
                  <th className="p-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      Pegawai tidak ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition">
                      <td className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                          {/* BUG-09 FIX: Use actual user photoUrl instead of hardcoded Unsplash image */}
                          {u.photoUrl ? (
                            <img
                              src={u.photoUrl}
                              alt={u.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <img
                              src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
                              alt={u.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.onerror = null;
                                target.src = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
                              }}
                            />
                          )}
                        </div>
                        <div>
                          <div className="font-extrabold text-slate-800 text-sm leading-tight">
                            {u.name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5 capitalize">
                            {u.role.replace("_", " ")}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-600">
                        {u.nip || "—"}
                      </td>
                      <td className="p-4 font-bold text-slate-800">
                        {u.opd || "-"}
                      </td>
                      <td className="p-4 text-slate-500 text-[11px] max-w-xs truncate">
                        {u.satuanKerja || "—"}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-indigo-600">
                          {u.jabatan || "Guru Utama"}
                        </div>
                        {u.role === "guru" && (u.mapelUtama || u.mapelSertifikasi) && (
                          <div className="flex flex-wrap gap-1 mt-1 max-w-xs">
                            {u.mapelUtama && (
                              <span className="bg-sky-50 text-sky-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-sky-150">
                                📚 {u.mapelUtama}
                              </span>
                            )}
                            {u.mapelSertifikasi && (
                              <span className="bg-emerald-50 text-emerald-850 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-150">
                                🏅 Cert: {u.mapelSertifikasi}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedUserForQR(u)}
                            className="p-2 text-emerald-600 hover:text-emerald-800 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-600 rounded-xl transition-all duration-200"
                            title="Pratinjau / Cetak Kartu Presensi QR"
                          >
                            <QrCode size={13} />
                          </button>
                          <button
                            onClick={() => handleEditUserOpen(u)}
                            className="p-2 text-indigo-600 hover:text-indigo-800 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 text-indigo-600 rounded-xl transition-all duration-200"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            disabled={u.username === "admin"}
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-2 text-rose-600 hover:text-rose-800 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-600 rounded-xl transition-all duration-200 disabled:opacity-40"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. OPD TAB VIEW MATCHING SCREENSHOT PAGE 14 */}
      {activeTab === "opd" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#17a2b8] text-white">
                <tr>
                  <th className="p-4 text-center w-16">No</th>
                  <th className="px-4 py-3 text-left font-bold text-white uppercase text-[11px] tracking-wider border-r border-white/20">
                    <EditableText originalText="Lembaga Penyelenggara (Yayasan)" />
                  </th>
                  <th className="p-4 text-right w-36">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {filteredOpds.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-slate-400">
                      Lembaga Naungan tidak ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredOpds.map((o, index) => (
                    <tr key={o.id} className="hover:bg-slate-50/60 transition">
                      <td className="p-4 text-center text-slate-400 font-bold font-mono">
                        {index + 1}
                      </td>
                      <td className="p-4 font-bold text-slate-800">{o.nama}</td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => handleEditOpdOpen(o)}
                            className="p-2 text-indigo-600 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 text-indigo-600 rounded-xl transition-all duration-200"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteOpd(o.id)}
                            className="p-2 text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-600 rounded-xl transition-all duration-200"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. SATUAN KERJA TAB VIEW */}
      {activeTab === "satker" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#17a2b8] text-white">
                <tr>
                  <th className="p-4 text-center w-16">No</th>
                  <th className="p-4">Nama Lengkap Satuan Kerja / Sekolah / Kampus</th>
                  <th className="p-4">Lembaga Naungan</th>
                  <th className="p-4 text-right w-36">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {filteredSatkers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400">
                      Satuan Kerja tidak ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredSatkers.map((s, index) => {
                    const assocOpd = opds.find((o) => o.id === s.opdId);
                    return (
                      <tr
                        key={s.id}
                        className="hover:bg-slate-50/60 transition"
                      >
                        <td className="p-4 text-center text-slate-400 font-bold font-mono">
                          {index + 1}
                        </td>
                        <td className="p-4 font-bold text-slate-800">
                          {s.nama}
                        </td>
                        <td className="p-4">
                          <span className="bg-slate-100 text-slate-700 font-bold py-1 px-2.5 rounded font-mono uppercase text-[10px]">
                            {assocOpd?.nama || "-"}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => handleEditSatkerOpen(s)}
                              className="p-2 text-indigo-600 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 text-indigo-600 rounded-xl transition-all duration-200"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteSatker(s.id)}
                              className="p-2 text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-600 rounded-xl transition-all duration-200"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. JABATAN TAB VIEW */}
      {activeTab === "jabatan" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#17a2b8] text-white">
                <tr>
                  <th className="p-4 text-center w-24">No</th>
                  <th className="p-4">Nama Formasi Jabatan</th>
                  <th className="p-4 text-right w-36">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {filteredJabatans.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-slate-400">
                      Jabatan tidak ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredJabatans.map((j, index) => (
                    <tr key={j.id} className="hover:bg-slate-50/60 transition">
                      <td className="p-4 text-center text-slate-400 font-bold font-mono">
                        {index + 1}
                      </td>
                      <td className="p-4 font-bold text-slate-850 text-sm">
                        {j.nama}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => handleEditJabatanOpen(j)}
                            className="p-2 text-indigo-600 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 text-indigo-600 rounded-xl transition-all duration-200"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteJabatan(j.id)}
                            className="p-2 text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-600 rounded-xl transition-all duration-200"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ALL FORM MODALES DEFINITIONS */}

      {/* A. USER modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] flex flex-col shadow-xl border border-slate-100 overflow-hidden relative">
            {/* Close Button X */}
            <button
              onClick={() => setIsUserModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors z-10"
            >
              <X size={20} />
            </button>

            <div className="p-6 border-b border-slate-100 shrink-0">
              <h3 className="text-lg font-black text-slate-800">
                {editingUser ? "Edit Personel" : "Tambah Guru & Staf Baru"}
              </h3>
            </div>

            <form
              onSubmit={handleUserSave}
              className="flex flex-col flex-1 min-h-0"
            >
              <div className="p-6 space-y-4 text-xs font-sans overflow-y-auto flex-1">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Nama Lengkap & Gelar
                  </label>
                  <input
                    required
                    value={userForm.name}
                    onChange={(e) =>
                      setUserForm({ ...userForm, name: e.target.value })
                    }
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl"
                    placeholder="Contoh: LISAL FAISAL, S.Pd."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    ID Pegawai / NIP / NIDN / NIK
                  </label>
                  <input
                    required
                    value={userForm.nip}
                    onChange={(e) =>
                      setUserForm({ ...userForm, nip: e.target.value })
                    }
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl"
                    placeholder="Contoh: 198001012005011001"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Username Portal
                    </label>
                    <input
                      required
                      value={userForm.username}
                      onChange={(e) =>
                        setUserForm({ ...userForm, username: e.target.value })
                      }
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Password Sesi
                    </label>
                    {/* UX-06 FIX: type="password" so plaintext isn't visible */}
                    <input
                      required
                      type="password"
                      value={userForm.password}
                      onChange={(e) =>
                        setUserForm({ ...userForm, password: e.target.value })
                      }
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Lembaga Naungan
                  </label>
                  <select
                    value={userForm.opd}
                    onChange={(e) =>
                      setUserForm({ ...userForm, opd: e.target.value })
                    }
                    className="w-full px-3.5 py-2 border border-slate-200 bg-white rounded-xl"
                  >
                    {opds.map((op) => (
                      <option key={op.id} value={op.singkatan}>
                        {op.singkatan} - {op.nama}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Satuan Kerja / Sekolah / Kampus
                  </label>
                  <select
                    value={userForm.satuanKerja}
                    onChange={(e) =>
                      setUserForm({ ...userForm, satuanKerja: e.target.value })
                    }
                    className="w-full px-3.5 py-2 border border-slate-200 bg-white rounded-xl"
                  >
                    <option value="" disabled>-- Pilih Satuan Kerja --</option>
                    {satuanKerjas.map((sk) => (
                      <option key={sk.id} value={sk.nama}>
                        {sk.nama}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Formasi Jabatan
                  </label>
                  <select
                    value={userForm.jabatan}
                    onChange={(e) =>
                      setUserForm({ ...userForm, jabatan: e.target.value })
                    }
                    className="w-full px-3.5 py-2 border border-slate-200 bg-white rounded-xl"
                  >
                    <option value="" disabled>-- Pilih Jabatan --</option>
                    {jabatans.map((jb) => (
                      <option key={jb.id} value={jb.nama}>
                        {jb.nama}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Akses Portal / Role
                  </label>
                  <select
                    value={userForm.role}
                    onChange={(e) =>
                      setUserForm({ ...userForm, role: e.target.value as Role })
                    }
                    className="w-full px-3.5 py-2 border border-slate-200 bg-white rounded-xl"
                  >
                    <option value="guru">Guru (Pengajar Sekolah)</option>
                    <option value="dosen">Dosen (Pengajar Kampus)</option>
                    <option value="staf_sekolah">Staf / Tenaga Kependidikan Sekolah</option>
                    <option value="staf_kampus">Staf / Tenaga Kependidikan Kampus</option>
                    <option value="kepala_sekolah">Pimpinan (Kepsek / Rektor / Direktur)</option>
                    <option value="admin">Administrator Sistem</option>
                    {currentUser?.role === "developer" && (
                      <option value="developer">SaaS Developer / Dev</option>
                    )}
                  </select>
                </div>


                {userForm.role === "guru" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-l-4 border-sky-400 pl-3 bg-sky-50/50 p-3 rounded-xl">
                    <div>
                      <label className="block text-[10px] font-bold text-sky-800 uppercase mb-1">
                        📚 MaPel Utama (bisa &gt; 1)
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Matematika, IPA"
                        value={userForm.mapelUtama}
                        onChange={(e) =>
                          setUserForm({ ...userForm, mapelUtama: e.target.value })
                        }
                        className="w-full px-3.5 py-2 text-xs border border-sky-200 bg-white rounded-xl focus:outline-none focus:border-sky-500"
                      />
                      <p className="text-[9px] text-slate-400 mt-0.5">Pisahkan mata pelajaran dengan koma</p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-sky-800 uppercase mb-1">
                        🏅 MaPel Sertifikasi
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Matematika"
                        value={userForm.mapelSertifikasi}
                        onChange={(e) =>
                          setUserForm({ ...userForm, mapelSertifikasi: e.target.value })
                        }
                        className="w-full px-3.5 py-2 text-xs border border-sky-200 bg-white rounded-xl focus:outline-none focus:border-sky-500"
                      />
                      <p className="text-[9px] text-slate-400 mt-0.5">Sesuai Bidang Keahlian / Keilmuan / Sertifikasi</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-100 flex gap-3 shrink-0 justify-end">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
                ><X size={16} /> Batal</button>
                <button
                  type="submit"
                  className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
                >
                  <Save className="w-4 h-4" /> {editingUser ? "Simpan Perubahan" : "Tambah Personel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* B. OPD MODAL */}
      {isOpdModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-100 relative">
            <button
              onClick={() => setIsOpdModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-black text-slate-800 mb-4 pr-8">
              {editingOpd
                ? "Edit Lembaga Penyelenggara"
                : "Tambah Lembaga Naungan Baru"}
            </h3>
            <form
              onSubmit={handleOpdSave}
              className="space-y-4 text-xs font-sans"
            >

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Nama Yayasan / Lembaga Lengkap
                </label>
                <input
                  required
                  value={opdForm.nama}
                  onChange={(e) =>
                    setOpdForm({ ...opdForm, nama: e.target.value })
                  }
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl"
                  placeholder="Contoh: KEMENTERIAN AGAMA KABUPATEN DEPOK"
                />
              </div>
              <div className="flex gap-3 pt-4 justify-end">
                <button
                  type="button"
                  onClick={() => setIsOpdModalOpen(false)}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
                ><X size={16} /> Batal</button>
                <button
                  type="submit"
                  className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
                >
                  <Save className="w-4 h-4" /> Simpan Lembaga
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* C. SATKER MODAL */}
      {isSatkerModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-100 relative">
            <button
              onClick={() => setIsSatkerModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-black text-slate-800 mb-4 pr-8">
              {editingSatker
                ? "Edit Satuan Kerja / Sekolah"
                : "Tambah Satuan Kerja / Sekolah Baru"}
            </h3>
            <form
              onSubmit={handleSatkerSave}
              className="space-y-4 text-xs font-sans"
            >

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Nama Satuan Kerja / Sekolah Lengkap
                </label>
                <input
                  required
                  value={satkerForm.nama}
                  onChange={(e) =>
                    setSatkerForm({ ...satkerForm, nama: e.target.value })
                  }
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl"
                  placeholder="Contoh: NAMA INSTANSI / SEKOLAH ANDA"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Lembaga Naungan
                </label>
                <select
                  value={satkerForm.opdId}
                  onChange={(e) =>
                    setSatkerForm({ ...satkerForm, opdId: e.target.value })
                  }
                  className="w-full px-3.5 py-2 border border-slate-200 bg-white rounded-xl"
                >
                  {opds.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nama}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-4 justify-end">
                <button
                  type="button"
                  onClick={() => setIsSatkerModalOpen(false)}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
                ><X size={16} /> Batal</button>
                <button
                  type="submit"
                  className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
                >
                  <Save className="w-4 h-4" /> Simpan Satuan Kerja
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* D. JABATAN MODAL */}
      {isJabatanModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-100 relative">
            <button
              onClick={() => setIsJabatanModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-black text-slate-800 mb-4 pr-8">
              {editingJabatan ? "Edit Jabatan" : "Tambah Formasi Jabatan Baru"}
            </h3>
            <form
              onSubmit={handleJabatanSave}
              className="space-y-4 text-xs font-sans"
            >
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Kategori Formasi Jabatan
                </label>
                <select
                  value={jabForm.kategori}
                  onChange={(e) => setJabForm({ ...jabForm, kategori: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl mb-3"
                >
                  <option value="Guru Mapel">Guru Mapel</option>
                  <option value="Staf Tata Usaha">Staf Tata Usaha</option>
                  <option value="Tenaga Kependidikan Lainnya">Tenaga Kependidikan Lainnya</option>
                  <option value="Lainnya">Lainnya (Ketik Sendiri)</option>
                </select>

                {jabForm.kategori !== "Lainnya" ? (
                  <>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Keterangan / Spesifikasi (Opsional)
                    </label>
                    <input
                      value={jabForm.keterangan}
                      onChange={(e) => setJabForm({ ...jabForm, keterangan: e.target.value })}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl"
                      placeholder={jabForm.kategori === "Guru Mapel" ? "Contoh: Matematika" : "Contoh: Keuangan"}
                    />
                  </>
                ) : (
                  <>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Nama Formasi Lengkap
                    </label>
                    <input
                      required
                      value={jabForm.nama}
                      onChange={(e) => setJabForm({ ...jabForm, nama: e.target.value })}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl"
                      placeholder="Contoh: Kepala Perpustakaan"
                    />
                  </>
                )}
              </div>
              <div className="flex gap-3 pt-4 justify-end">
                <button
                  type="button"
                  onClick={() => setIsJabatanModalOpen(false)}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
                ><X size={16} /> Batal</button>
                <button
                  type="submit"
                  className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
                >
                  <Save className="w-4 h-4" /> Simpan Jabatan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* E. KARTU QR MODAL */}
      {selectedUserForQR && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 no-print">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-100 relative">
            <button
              onClick={() => setSelectedUserForQR(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-black text-slate-800 mb-6 pr-8 text-center sm:text-left">
              Kartu Presensi QR Guru & Staf
            </h3>

            <div className="flex flex-col items-center gap-6">
              {/* Visual ID Card Face */}
              <div
                id="print-card-area"
                className="w-[350px] h-[210px] bg-gradient-to-br from-emerald-800 to-emerald-950 rounded-2xl p-4 text-white flex flex-col justify-between shadow-lg relative overflow-hidden border border-emerald-700 shrink-0 font-sans mx-auto"
              >
                {/* Background decorations */}
                <div className="absolute top-[-30px] right-[-30px] w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none" />
                <div className="absolute bottom-[-30px] left-[-30px] w-32 h-32 bg-white/5 rounded-full blur-xl pointer-events-none" />

                {/* Card Header */}
                <div className="flex gap-2 items-center border-b border-white/10 pb-2 shrink-0">
                  <img
                    src={school.logoUrl || "/logo.png"}
                    alt="Logo"
                    className="w-8 h-8 object-contain shrink-0"
                    onError={(e) => { e.currentTarget.src = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png" }}
                  />
                  <div className="text-left">
                    <h5 className="text-[10px] font-black tracking-tight leading-tight uppercase">{yayasanName}</h5>
                    <p className="text-[7.5px] font-bold text-emerald-300 leading-none">{school.name.toUpperCase()}</p>
                  </div>
                </div>

                {/* Card Body */}
                <div className="flex gap-3 items-center flex-1 py-2">
                  {/* Photo */}
                  <div className="w-16 h-20 rounded-lg overflow-hidden bg-slate-100/10 border border-white/10 shrink-0 flex items-center justify-center relative">
                    <UserCircle size={48} className="text-white/30" />
                  </div>

                  {/* Profile details */}
                  <div className="text-left flex-1 min-w-0 space-y-1">
                    <h6 className="font-extrabold text-[11px] leading-snug truncate uppercase tracking-wide text-yellow-300 font-sans">
                      {selectedUserForQR.name}
                    </h6>
                    <div className="space-y-0.5 text-[8.5px] font-medium text-slate-205 text-slate-200">
                      <p className="truncate">NIP: {selectedUserForQR.nip || "—"}</p>
                      <p className="truncate">Role: {selectedUserForQR.role.replace("_", " ").toUpperCase()}</p>
                      <p className="truncate">Jabatan: {selectedUserForQR.jabatan || "Guru Utama"}</p>
                    </div>
                  </div>

                  {/* QR Code */}
                  <div className="bg-white p-1.5 rounded-lg shrink-0 flex items-center justify-center border border-white/20">
                    <QRCodeSVG
                      value={JSON.stringify({
                        type: "personal_qr",
                        userId: selectedUserForQR.id,
                        name: selectedUserForQR.name,
                        nip: selectedUserForQR.nip,
                      })}
                      size={70}
                      imageSettings={(() => {
                        const personalLogoUrl = localStorage.getItem(`qr_embedded_logo_personal_${selectedUserForQR.id}`) || localStorage.getItem("qr_embedded_logo_admin") || school.logoUrl || "/logo.png";
                        return personalLogoUrl ? {
                          src: personalLogoUrl,
                          x: undefined,
                          y: undefined,
                          height: 16,
                          width: 16,
                          excavate: true,
                        } : undefined;
                      })()}
                    />
                  </div>
                </div>

                {/* Card Footer */}
                <div className="border-t border-white/10 pt-1.5 flex justify-between items-center text-[7.5px] font-mono text-slate-350 tracking-wider shrink-0 uppercase">
                  <span>KARTU PRESENSI PERSONAL GURU</span>
                  <span className="font-bold text-emerald-300">ONLINE</span>
                </div>
              </div>

              <div className="flex gap-3 w-full pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedUserForQR(null)}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl theme-gradient border border-white/20 shadow-md hover:shadow-lg hover:-translate-y-[2px] active:translate-y-[2px] transition-all duration-200"
                ><X size={16} /> Tutup</button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl theme-gradient border border-white/20 shadow-md hover:shadow-lg hover:-translate-y-[2px] active:translate-y-[2px] transition-all duration-200"
                >
                  <Printer size={14} /> Cetak Kartu QR
                </button>
              </div>
            </div>

            <style>
              {`
                @media print {
                  body * {
                    visibility: hidden;
                  }
                  #print-card-area, #print-card-area * {
                    visibility: visible;
                  }
                  #print-card-area {
                    position: absolute;
                    left: 50%;
                    top: 40%;
                    transform: translate(-50%, -50%) scale(1.4);
                    border: none !important;
                    box-shadow: none !important;
                  }
                  .no-print {
                    display: none !important;
                  }
                }
              `}
            </style>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
