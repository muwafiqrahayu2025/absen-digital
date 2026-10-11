const fs = require('fs');

let content = fs.readFileSync('src/pages/Profile.tsx', 'utf-8');

const firebaseImports = 'import { update } from "firebase/database";\nimport { updateProfile } from "firebase/auth";\nimport { getTenantRef, auth } from "../lib/firebase";\n';
if (!content.includes('import { update } from "firebase/database"')) {
  content = content.replace('import { db } from "../lib/db";', 'import { db } from "../lib/db";\n' + firebaseImports);
}

const oldHandleSaveProfile = `  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const { satker, ...restFormData } = formData;
    const dataToSave = {
      ...restFormData,
      satuanKerja: satker, // keep in sync with schema
    };

    // Use centralized db.updateUser for consistent local + cloud sync
    db.updateUser(user.id, dataToSave);
    login({ ...user, ...dataToSave });
    setConfirmProfile(false);
    toast.success("Profil personel berhasil diperbarui.");
    window.dispatchEvent(new Event("users_updated"));
  };`;

const newHandleSaveProfile = `  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.id) {
      toast.error("Gagal menyimpan: ID Pengguna tidak ditemukan.");
      return;
    }

    const { satker, ...restFormData } = formData;
    const dataToSave = {
      ...restFormData,
      satuanKerja: satker, // keep in sync with schema
      phone: formData.phone,
      email: formData.email,
    };

    try {
      const userRef = getTenantRef(\`users/\${user.id}\`);
      await update(userRef, dataToSave);
      
      if (auth.currentUser && dataToSave.name) {
        await updateProfile(auth.currentUser, { displayName: dataToSave.name });
      }

      db.updateUser(user.id, dataToSave);
      login({ ...user, ...dataToSave });
      setConfirmProfile(false);
      toast.success("Profil personel berhasil diperbarui ke server.");
      window.dispatchEvent(new Event("users_updated"));
    } catch (error: any) {
      toast.error(error.message || "Gagal menyimpan perubahan ke server");
    }
  };`;

content = content.replace(oldHandleSaveProfile, newHandleSaveProfile);
content = content.replace(oldHandleSaveProfile.replace(/\n/g, '\r\n'), newHandleSaveProfile);

const oldHandleSaveAccount = `  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Use centralized db.updateUser for consistent local + cloud sync
    db.updateUser(user.id, accountData);
    login({ ...user, ...accountData });
    setConfirmAccount(false);
    toast.success("Kredensial login akun berhasil diperbarui.");
    window.dispatchEvent(new Event("users_updated"));
  };`;

const newHandleSaveAccount = `  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.id) {
      toast.error("Gagal menyimpan: ID Pengguna tidak ditemukan.");
      return;
    }

    try {
      const userRef = getTenantRef(\`users/\${user.id}\`);
      await update(userRef, accountData);

      db.updateUser(user.id, accountData);
      login({ ...user, ...accountData });
      setConfirmAccount(false);
      toast.success("Kredensial login akun berhasil diperbarui ke server.");
      window.dispatchEvent(new Event("users_updated"));
    } catch (error: any) {
      toast.error(error.message || "Gagal menyimpan perubahan ke server");
    }
  };`;

content = content.replace(oldHandleSaveAccount, newHandleSaveAccount);
content = content.replace(oldHandleSaveAccount.replace(/\n/g, '\r\n'), newHandleSaveAccount);

fs.writeFileSync('src/pages/Profile.tsx', content);
