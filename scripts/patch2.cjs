const fs = require('fs');

let content = fs.readFileSync('src/pages/Profile.tsx', 'utf-8');

// We need to inject imports if they don't exist
const firebaseImports = `import { update } from "firebase/database";
import { updateProfile } from "firebase/auth";
import { getTenantRef, auth } from "../lib/firebase";\n`;

if (!content.includes('import { update } from "firebase/database"')) {
  // Put it right after import { db } from "../lib/db";
  content = content.replace('import { db } from "../lib/db";', 'import { db } from "../lib/db";\n' + firebaseImports);
}

// Replace handleSaveProfile
const oldSaveProfile = `  const handleSaveProfile = (e: React.FormEvent) => {
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

const newSaveProfile = `  const handleSaveProfile = async (e: React.FormEvent) => {
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

// Because of different line endings, it's safer to use regex
const saveProfileRegex = /  const handleSaveProfile = \(e: React\.FormEvent\) => \{[\s\S]*?window\.dispatchEvent\(new Event\("users_updated"\)\);\n  \};/m;
content = content.replace(saveProfileRegex, newSaveProfile);

// Replace handleSaveAccount
const newSaveAccount = `  const handleSaveAccount = async (e: React.FormEvent) => {
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
      toast.success("Kredensial login akun berhasil diperbarui.");
      window.dispatchEvent(new Event("users_updated"));
    } catch (error: any) {
      toast.error(error.message || "Gagal menyimpan perubahan ke server");
    }
  };`;

const saveAccountRegex = /  const handleSaveAccount = \(e: React\.FormEvent\) => \{[\s\S]*?window\.dispatchEvent\(new Event\("users_updated"\)\);\n  \};/m;
content = content.replace(saveAccountRegex, newSaveAccount);

fs.writeFileSync('src/pages/Profile.tsx', content);
