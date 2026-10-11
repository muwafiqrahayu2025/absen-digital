import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { dbRealtime, db } from "../../lib/firebase";
import { ref, update, remove, get, onValue } from "firebase/database";
import { collection, doc, setDoc, query, orderBy, onSnapshot as onFirestoreSnapshot } from "firebase/firestore";
import { Building2, Search, Calendar, Users, Mail, ShieldCheck, ToggleLeft, ToggleRight, Info, Trash2, Pencil, X, Plus } from "lucide-react";
import { useGlobalSettings } from "../../hooks/useGlobalSettings";
import { useAuth } from "../../components/AuthContext";
import toast from "react-hot-toast";

export function ManageTenants() {
  // ── [NULL-SAFETY] Destructure dengan fallback aman ────────────────────
  const authContext = useAuth();
  const user = authContext?.user;
  const setActiveTenantId = authContext?.setActiveTenantId;
  const setImpersonatedRole = authContext?.setImpersonatedRole;
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const globalSettingsHook = useGlobalSettings();
  const settings = globalSettingsHook?.settings ?? { waFallbackEnabled: false };
  const settingsLoading = globalSettingsHook?.loading ?? false;
  const updateSettings = globalSettingsHook?.updateSettings;
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  
  // Advanced Table States
  const [activeTab, setActiveTab] = useState('active');
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [editPackage, setEditPackage] = useState("trial");
  const [editQuota, setEditQuota] = useState<number | string>(50);
  const [editExpired, setEditExpired] = useState("");

  // Edit Form State
  const [editFormData, setEditFormData] = useState({ name: "", email: "" });
  const [isSaving, setIsSaving] = useState(false);

  // Create Form State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState({ name: "", email: "", id: "" });
  const [isCreating, setIsCreating] = useState(false);

  const handleImpersonate = (tenantId: string, tenantName: string) => {
    // ── [NULL-SAFETY] Pastikan fungsi context tersedia sebelum dipanggil ──
    if (!setActiveTenantId) {
      toast.error("Fitur impersonasi tidak tersedia saat ini.");
      return;
    }
    if (window.confirm(`Masuk ke Mode Uji Lab sebagai ${tenantName}? Sidebar dan Dasbor akan menampilkan data instansi ini.`)) {
      setActiveTenantId(tenantId);
      setImpersonatedRole?.('admin');
      toast.success(`Memasuki Mode Uji Lab untuk instansi: ${tenantName}`);
      setTimeout(() => {
        window.location.href = '/admin';
      }, 500);
    }
  };

  const handleOpenManage = (tenant: any) => {
    setSelectedTenant(tenant);
    setEditPackage(tenant?.raw?.license?.plan || "trial");
    setEditQuota(tenant?.raw?.license?.maxUsers || 50);
    setEditExpired(tenant?.raw?.license?.expiresAt || "");
    setIsManageModalOpen(true);
  };

  const handleSaveManage = async () => {
    if (!selectedTenant) return;
    try {
      const toastId = toast.loading("Menyimpan konfigurasi lisensi...");
      await update(ref(dbRealtime, `tenants/${selectedTenant.id}/license`), {
        plan: editPackage,
        maxUsers: Number(editQuota),
        expiresAt: editExpired || null
      });
      toast.success(`Berhasil memperbarui lisensi untuk ${selectedTenant?.name || selectedTenant.id}`, { id: toastId });
      closeModals();
    } catch (err: any) {
      toast.error("Gagal menyimpan data: " + err.message);
    }
  };

  const handleMoveToTrash = async (tenantId: string) => {
    if (!window.confirm("Yakin ingin memindahkan instansi ini ke Tong Sampah?")) return;
    try {
      await update(ref(dbRealtime, `tenants/${tenantId}`), {
        isDeleted: true,
        deletedAt: new Date().toISOString()
      });
      toast.success("Instansi dipindahkan ke Tong Sampah.");
    } catch (err: any) {
      toast.error("Gagal memindahkan ke Tong Sampah: " + err.message);
    }
  };

  const handleRestoreTenant = async (tenantId: string) => {
    if (!window.confirm("Yakin ingin memulihkan instansi ini?")) return;
    try {
      await update(ref(dbRealtime, `tenants/${tenantId}`), {
        isDeleted: null,
        deletedAt: null
      });
      toast.success("Instansi berhasil dipulihkan.");
    } catch (err: any) {
      toast.error("Gagal memulihkan instansi: " + err.message);
    }
  };

  const handlePermanentDelete = async (tenantId: string) => {
    if (!window.confirm("PERINGATAN KRITIS: Anda yakin ingin MENGHAPUS PERMANEN instansi ini beserta seluruh datanya? Aksi ini TIDAK DAPAT DIBATALKAN.")) return;
    const toastId = toast.loading(`Menghapus instansi permanen...`);
    setIsDeleting(true);
    try {
      const usersSnap = await get(ref(dbRealtime, `tenants/${tenantId}/users`));
      if (usersSnap.exists()) {
        const usersData = usersSnap.val();
        const mappingUpdates: Record<string, null> = {};
        Object.keys(usersData).forEach(uid => {
          mappingUpdates[uid] = null;
        });
        if (Object.keys(mappingUpdates).length > 0) {
          await update(ref(dbRealtime, 'user_tenant_mapping'), mappingUpdates);
        }
      }
      
      await remove(ref(dbRealtime, `tenants/${tenantId}`));
      toast.success(`Instansi berhasil dihapus permanen.`, { id: toastId });
    } catch (error: any) {
      console.error("Error deleting tenant:", error);
      toast.error(`Gagal menghapus instansi: ${error.message}`, { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleSuspend = async (tenant: any) => {
    const isCurrentlyActive = tenant.isActive !== false; // default true if not set
    const actionText = isCurrentlyActive ? "Suspend" : "Aktifkan";
    if (window.confirm(`Apakah Anda yakin ingin ${actionText} instansi ${tenant.name}?`)) {
      const toastId = toast.loading(`Mengubah status instansi...`);
      try {
        const updates: any = {};
        updates[`tenants/${tenant.id}/isActive`] = !isCurrentlyActive;
        await update(ref(dbRealtime), updates);
        toast.success(`Status instansi berhasil diubah menjadi ${!isCurrentlyActive ? 'Aktif' : 'Suspend'}.`, { id: toastId });
      } catch (error: any) {
        console.error("Error toggling tenant status:", error);
        toast.error(`Gagal mengubah status: ${error.message}`, { id: toastId });
      }
    }
  };

  const openEditModal = (tenant: any) => {
    setSelectedTenant(tenant);
    setEditFormData({ name: tenant.name, email: tenant.email });
    setIsEditModalOpen(true);
  };

  const openInfoModal = (tenant: any) => {
    setSelectedTenant(tenant);
    setIsInfoModalOpen(true);
  };

  const closeModals = () => {
    setIsEditModalOpen(false);
    setIsInfoModalOpen(false);
    setIsCreateModalOpen(false);
    setIsManageModalOpen(false);
    setSelectedTenant(null);
  };

  // ── [BUG-FIX #1] handleCloseManage tidak pernah didefinisikan di v.lama ─
  // Baris 467 memanggil handleCloseManage → TypeError: handleCloseManage is not a function
  // Solusi: alias langsung ke closeModals
  const handleCloseManage = closeModals;

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validasi
    if (!createFormData.name || !createFormData.email || !createFormData.id) {
      toast.error("Semua kolom (Nama Instansi, Email Admin, Tenant ID) wajib diisi!");
      return;
    }
    
    // Validasi format Tenant ID (hanya huruf kecil dan angka, tanpa spasi)
    const idRegex = /^[a-z0-9]+$/;
    if (!idRegex.test(createFormData.id)) {
      toast.error("Tenant ID hanya boleh berisi huruf kecil dan angka, tanpa spasi.");
      return;
    }
    
    const toastId = toast.loading("Mendaftarkan...");
    setIsCreating(true);
    
    try {
      const now = new Date().toISOString();
      const newTenantData = {
        name: createFormData.name,
        email: createFormData.email,
        tenantId: createFormData.id,
        createdAt: now,
        status: "AKTIF"
      };
      
      // Simpan ke Firestore
      await setDoc(doc(db, 'tenants', createFormData.id), newTenantData);
      
      toast.success("Instansi baru berhasil didaftarkan", { id: toastId });
      setCreateFormData({ name: "", email: "", id: "" });
      closeModals();
    } catch (error: any) {
      console.error("Error creating tenant in Firestore:", error);
      toast.error(`Gagal mendaftarkan instansi: ${error.message}`, { id: toastId });
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;
    
    const toastId = toast.loading("Menyimpan perubahan...");
    setIsSaving(true);
    
    try {
      const updates: any = {};
      updates[`tenants/${selectedTenant.id}/school/name`] = editFormData.name;
      updates[`tenants/${selectedTenant.id}/school/email`] = editFormData.email;
      
      await update(ref(dbRealtime), updates);
      toast.success("Data instansi berhasil diperbarui.", { id: toastId });
      closeModals();
    } catch (error: any) {
      console.error("Error updating tenant:", error);
      toast.error(`Gagal menyimpan: ${error.message}`, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };
  useEffect(() => {
    const tenantsRef = ref(dbRealtime, 'tenants');
    
    // Fallback loading timeout
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 10000);

    const unsubscribe = onValue(tenantsRef, (snapshot) => {
      clearTimeout(timeoutId);
      const data = snapshot.val() || {};
      const tenantsArray = Object.keys(data).map(id => {
        const tData = data[id] || {};
        const schoolData = tData.school || {};
        const name = schoolData.name || tData.name || "Nama Instansi Belum Diatur";
        const email = schoolData.email || tData.email || "-";
        
        let registrationDate = "Tanggal tidak tersedia";
        const rawDate = schoolData.createdAt || tData.createdAt;
        if (rawDate) {
          try {
            registrationDate = new Date(rawDate).toLocaleDateString('id-ID', {
              day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });
          } catch (e) {
            console.error("Failed to parse tenant date", e);
          }
        }
        
        // ── [BUG-FIX #4] isActive logic sebelumnya: !tData.isDeleted ──────
        // Masalah: tenant yang suspend (isActive: false) tetap tampil sebagai
        // aktif karena hanya cek isDeleted, bukan isActive field yang sesungguhnya.
        // Perbaikan: cek keduanya — harus aktif DAN belum dihapus.
        const isActiveFlag = tData.isActive !== false && !tData.isDeleted;

        return {
          id,
          name,
          email,
          registrationDate,
          userCount: tData.users ? Object.keys(tData.users).filter(k => tData.users[k] !== null).length : 0,
          isActive: isActiveFlag,
          raw: tData
        };
      }).sort((a, b) => {
        const dateA = a.raw?.school?.createdAt || a.raw?.createdAt || 0;
        const dateB = b.raw?.school?.createdAt || b.raw?.createdAt || 0;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
      
      setTenants(tenantsArray);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching tenants from Realtime DB:", error);
      clearTimeout(timeoutId);
      setLoading(false);
    });

    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, []);

  const searchStr = searchQuery.toLowerCase();
  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(searchStr) || 
    t.id.toLowerCase().includes(searchStr) ||
    t.email.toLowerCase().includes(searchStr)
  );
  
  const activeTenants = filteredTenants.filter(t => !t.raw?.isDeleted);
  const archivedTenants = filteredTenants.filter(t => t.raw?.isDeleted);

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <ShieldCheck className="text-indigo-600" size={28} />
            Daftar Klien (Tenants)
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Monitoring seluruh instansi yang terdaftar di dalam platform SaaS. Akses eksklusif Super Admin.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors shadow-sm"
            >
              <Plus size={16} />
              Daftarkan Instansi Baru
            </button>
            <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl font-bold text-sm border border-indigo-100 flex items-center gap-2">
              <Building2 size={16} />
              Total Instansi: {tenants.length}
            </div>
          </div>
          
          <div className="bg-white border border-slate-200 px-4 py-2.5 rounded-xl flex items-center gap-3 w-full sm:w-auto mt-2">
            <div>
              <div className="text-xs font-bold text-slate-800">Alternatif WA.me Klien</div>
              <div className="text-[10px] text-slate-500">Buka link wa.me jika klien tidak punya API</div>
            </div>
            <button
              disabled={settingsLoading || !updateSettings}
              onClick={() => {
                // ── [BUG-FIX #2] updateSettings bisa undefined jika hook belum siap ─
                if (typeof updateSettings === 'function') {
                  updateSettings({ waFallbackEnabled: !settings.waFallbackEnabled });
                } else {
                  toast.error("Pengaturan belum siap, coba lagi sebentar.");
                }
              }}
              className={`ml-auto transition-colors focus:outline-none disabled:opacity-50 ${settings.waFallbackEnabled ? 'text-emerald-500' : 'text-slate-300'}`}
            >
              {settings.waFallbackEnabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
            </button>
          </div>
        </div>
      </div>

      {/* Search Section */}
      <div className="bg-white p-4 rounded-2xl border border-slate-150 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari berdasarkan nama instansi, ID, atau email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl outline-none text-xs bg-slate-50/50"
          />
        </div>
      </div>

      {/* Table Section (Migrated from Dashboard) */}
      <div id="tenant-table-section" className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50">
          <h3 className="font-black text-slate-800">Daftar Instansi (Tenants)</h3>
          <div className="flex bg-slate-200/50 p-1 rounded-lg">
            <button onClick={() => setActiveTab('active')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'active' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Instansi Aktif</button>
            <button onClick={() => setActiveTab('archived')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'archived' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Tong Sampah / Arsip</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans">
            <thead>
              <tr className="bg-slate-100 text-slate-600 text-[11px] uppercase tracking-wider">
                <th className="p-4 font-bold w-16 text-center">No</th>
                <th className="p-4 font-bold">Nama Instansi</th>
                <th className="p-4 font-bold">Email & Tanggal</th>
                <th className="p-4 font-bold text-center">Statistik</th>
                <th className="p-4 font-bold text-center">Status</th>
                <th className="p-4 font-bold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {loading ? (
                // ── [NULL-SAFETY] Loading state eksplisit — cegah render data null ──
                <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-bold animate-pulse">Memuat data instansi...</td></tr>
              ) : !Array.isArray(tenants) ? (
                // ── [NULL-SAFETY] Guard: jika tenants bukan array (edge case) ──────
                <tr><td colSpan={6} className="p-8 text-center text-rose-400">Gagal memuat data. Silakan refresh halaman.</td></tr>
              ) : (activeTab === 'active' ? activeTenants : archivedTenants).length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Belum ada instansi di tab ini.</td></tr>
              ) : (
                (activeTab === 'active' ? activeTenants : archivedTenants).map((tenant: any, idx: number) => (
                  <tr key={tenant.id} className="hover:bg-slate-50 transition">
                    <td className="p-4 text-center text-slate-400 font-bold font-mono text-xs">{idx + 1}</td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{tenant.name}</div>
                      <code className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-mono mt-1 inline-block">{tenant.id}</code>
                    </td>
                    <td className="p-4">
                      <div className="text-slate-600 text-xs flex items-center gap-1"><Mail size={12}/> {tenant.email}</div>
                      <div className="text-slate-400 text-[10px] flex items-center gap-1 mt-0.5"><Calendar size={10}/> {tenant.registrationDate}</div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="inline-flex items-center gap-1.5 bg-sky-50 text-sky-700 border border-sky-100 px-2 py-1 rounded-lg text-[10px] font-bold">
                        <Users size={12} />
                        {tenant.userCount} Pegawai
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                          tenant.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {tenant.isActive ? 'Aktif' : 'Suspended'}
                        </span>
                        {activeTab === 'active' && (
                          <button
                            onClick={() => handleToggleSuspend(tenant)}
                            className={`text-[10px] font-bold mt-1 focus:outline-none transition-colors ${tenant.isActive ? 'text-rose-500 hover:text-rose-700' : 'text-emerald-500 hover:text-emerald-700'}`}
                          >
                            {tenant.isActive ? 'Suspend' : 'Activate'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      {activeTab === 'active' ? (
                        <div className="flex justify-end items-center gap-2">
                          <button onClick={() => openInfoModal(tenant)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Detail"><Info size={16}/></button>
                          <button onClick={() => openEditModal(tenant)} className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors" title="Edit Profil"><Pencil size={16}/></button>
                          <button onClick={() => handleImpersonate(tenant.id, tenant.name)} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-xs font-bold transition">Uji Lab</button>
                          <button onClick={() => handleOpenManage(tenant)} className="px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-xs font-bold transition">Lisensi</button>
                          <button onClick={() => handleMoveToTrash(tenant.id)} className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-bold transition">Hapus</button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleRestoreTenant(tenant.id)} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg text-xs font-bold transition">Restore</button>
                          <button onClick={() => handlePermanentDelete(tenant.id)} disabled={isDeleting} className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-bold transition disabled:opacity-50">Hapus Permanen</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Manage License */}
      {isManageModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl animate-slide-up">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Kelola Lisensi: {selectedTenant?.name || 'Instansi'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Paket Lisensi</label>
                <select value={editPackage} onChange={e => setEditPackage(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200">
                  <option value="trial">Trial</option>
                  <option value="full">Pro / Full</option>
                  <option value="hibah">Hibah / Enterprise</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Batas Kuota Pengguna</label>
                <input type="number" value={editQuota} onChange={e => setEditQuota(Number(e.target.value))} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Kedaluwarsa</label>
                <input type="date" value={editExpired} onChange={e => setEditExpired(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={handleCloseManage} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition">Batal</button>
              <button onClick={handleSaveManage} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition">Simpan Perubahan</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Plus size={18} className="text-indigo-500" />
                Daftarkan Instansi Baru
              </h3>
              <button onClick={closeModals} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Nama Instansi</label>
                <input
                  type="text"
                  required
                  value={createFormData.name}
                  onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition-all"
                  placeholder="Masukkan nama instansi"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Email Admin</label>
                <input
                  type="email"
                  required
                  value={createFormData.email}
                  onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition-all"
                  placeholder="Masukkan email admin instansi"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Tenant ID</label>
                <input
                  type="text"
                  required
                  value={createFormData.id}
                  onChange={(e) => setCreateFormData({ ...createFormData, id: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition-all"
                  placeholder="Masukkan ID instansi (unik, tanpa spasi)"
                />
                <p className="text-[10px] text-slate-500 mt-1">Hanya huruf kecil dan angka. Contoh: sekolahnusantara</p>
              </div>
              
              <div className="pt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModals}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                  disabled={isCreating}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isCreating ? "Mendaftarkan..." : "Daftarkan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Pencil size={18} className="text-amber-500" />
                Edit Instansi
              </h3>
              <button onClick={closeModals} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Nama Instansi</label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition-all"
                  placeholder="Masukkan nama instansi"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Email Admin Klien</label>
                <input
                  type="email"
                  required
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition-all"
                  placeholder="Masukkan email admin"
                />
              </div>
              
              <div className="pt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModals}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                  disabled={isSaving}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {isInfoModalOpen && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Info size={18} className="text-blue-500" />
                Detail Instansi
              </h3>
              <button onClick={closeModals} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">ID Instansi</div>
                  <div className="text-sm font-mono text-slate-700">{selectedTenant.id}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Nama Instansi</div>
                  <div className="text-sm font-bold text-slate-800">{selectedTenant.name}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Email Admin</div>
                  <div className="text-sm text-slate-700 flex items-center gap-1.5">
                    <Mail size={14} className="text-slate-400" />
                    {selectedTenant.email}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Tanggal Daftar</div>
                  <div className="text-sm text-slate-700 flex items-center gap-1.5">
                    <Calendar size={14} className="text-slate-400" />
                    {selectedTenant.registrationDate}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Status Aktif</div>
                  <div className="mt-1">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider ${
                      selectedTenant.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {selectedTenant.isActive ? 'Aktif' : 'Suspended'}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Jumlah Pegawai</div>
                  <div className="text-sm text-slate-700 flex items-center gap-1.5">
                    <Users size={14} className="text-slate-400" />
                    {selectedTenant.userCount} Pengguna
                  </div>
                </div>
              </div>
              <div className="pt-2 flex justify-end">
                <button
                  onClick={closeModals}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
