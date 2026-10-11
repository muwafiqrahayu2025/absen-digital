const fs = require('fs');

let content = fs.readFileSync('src/pages/Profile.tsx', 'utf-8');

content = content.replace(
  `      const { satker, ...restFormData } = formData;\r\n      dataToSave = {\r\n        ...restFormData,\r\n        satuanKerja: satker, // keep in sync with schema\r\n      };\r\n    }`,
  `      const { satker, ...restFormData } = formData;\n      dataToSave = {\n        ...restFormData,\n        satuanKerja: satker, // keep in sync with schema\n        phone: formData.phone,\n        email: formData.email,\n      };\n    }`
);

// Fallback in case line endings are \n
content = content.replace(
  `      const { satker, ...restFormData } = formData;\n      dataToSave = {\n        ...restFormData,\n        satuanKerja: satker, // keep in sync with schema\n      };\n    }`,
  `      const { satker, ...restFormData } = formData;\n      dataToSave = {\n        ...restFormData,\n        satuanKerja: satker, // keep in sync with schema\n        phone: formData.phone,\n        email: formData.email,\n      };\n    }`
);

content = content.replace(
  `const uid = auth.currentUser?.uid || (user as any)?.uid || user?.id;\r\n      const userRef = ref(dbRealtime, \`users/\${uid}\`);`,
  `const uid = auth.currentUser?.uid || (user as any)?.uid || user?.id;\n      const userRef = getTenantRef(\`users/\${uid}\`);`
);

content = content.replace(
  `const uid = auth.currentUser?.uid || (user as any)?.uid || user?.id;\n      const userRef = ref(dbRealtime, \`users/\${uid}\`);`,
  `const uid = auth.currentUser?.uid || (user as any)?.uid || user?.id;\n      const userRef = getTenantRef(\`users/\${uid}\`);`
);

fs.writeFileSync('src/pages/Profile.tsx', content);

let content2 = fs.readFileSync('src/components/ProfileTabContent.tsx', 'utf-8');
content2 = content2.replace(
  `const dataToSave = { ...restFormData, satuanKerja: satker };`,
  `const dataToSave = { ...restFormData, satuanKerja: satker, phone: formData.phone, email: formData.email };`
);
fs.writeFileSync('src/components/ProfileTabContent.tsx', content2);
