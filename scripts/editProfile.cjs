const fs = require('fs');
let code = fs.readFileSync('src/pages/Profile.tsx', 'utf8');

// 1. Remove activeTab state
code = code.replace(/const \[activeTab, setActiveTab\] = useState<.*?\(.*?\);\r?\n/, '');

// 2. Remove tab bar
const tabBarRegex = /\{\/\* Edit Form tab \*\/\}\r?\n\s*<div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-md">\r?\n\s*<div className="flex border-b border-gray-200 px-4">[\s\S]*?<div className="p-6">\r?\n\s*\{activeTab === "profil" && \(\r?\n\s*<form/m;
code = code.replace(tabBarRegex, `{/* Edit Form tab */}
        <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-md">
          <div className="p-6">
            <div className="mb-6 pb-2 border-b border-gray-200">
              <h3 className="text-lg font-black text-slate-800">Biodata Pegawai</h3>
            </div>
            <form`);

// 3. Remove conditional braces between forms and add divider
const dividerRegex = /<\/form>\r?\n\s*\)\}\r?\n\r?\n\s*\{activeTab === "foto" && \(\r?\n\s*<div className="flex flex-col items-center justify-center py-8 space-y-5 animate-fade-in">/m;
code = code.replace(dividerRegex, `</form>

              <div className="mt-10 pt-8 border-t-2 border-gray-100 flex flex-col items-center justify-center space-y-5 animate-fade-in">`);

// 4. Remove closing brace for foto
const closingRegex = /<\/button>\r?\n\s*<\/div>\r?\n\s*<\/div>\r?\n\s*\)\}\r?\n\r?\n\s*<\/div>\r?\n\s*<\/div>/m;
code = code.replace(closingRegex, `</button>
                </div>
              </div>

          </div>
        </div>`);

fs.writeFileSync('src/pages/Profile.tsx', code, 'utf8');
console.log('Profile.tsx updated successfully via script.');
