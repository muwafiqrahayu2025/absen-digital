const fs = require('fs');
let code = fs.readFileSync('src/pages/Profile.tsx', 'utf8');

// The marker where the content starts
const contentStart = code.indexOf('<div className="p-6">');
if (contentStart === -1) throw new Error("Could not find content start");

// Find Biodata block
const biodataStart = code.indexOf('<div className="mb-6 pb-2 border-b border-gray-200">', contentStart);
const biodataEnd = code.indexOf('</form>', biodataStart) + '</form>'.length;
let biodataBlock = code.substring(biodataStart, biodataEnd);

// Find Foto block
const fotoStartMatch = code.match(/<div className="mt-10 pt-8 border-t-2 border-gray-100 flex flex-col items-center justify-center space-y-5 animate-fade-in">/);
if (!fotoStartMatch) throw new Error("Could not find foto start");
const fotoStart = fotoStartMatch.index;

const fotoEndMatch = code.substring(fotoStart).match(/<\/button>\r?\n\s*<\/div>\r?\n\s*<\/div>/);
if (!fotoEndMatch) throw new Error("Could not find foto end");
const fotoEnd = fotoStart + fotoEndMatch.index + fotoEndMatch[0].length;

let fotoBlock = code.substring(fotoStart, fotoEnd);

// Restyle Biodata block (just the container)
biodataBlock = `<div className="mt-10 pt-8 border-t-2 border-gray-100">\n            ` + biodataBlock;

// Restyle Foto block
fotoBlock = fotoBlock.replace(
  /<div className="mt-10 pt-8 border-t-2 border-gray-100 flex flex-col items-center justify-center space-y-5 animate-fade-in">/,
  `<div className="mb-6 pb-2 border-b border-gray-200">
              <h3 className="text-lg font-black text-slate-800">Pas Foto Resmi</h3>
            </div>
            <div className="flex flex-col items-center justify-center space-y-5 animate-fade-in">`
);

// We need to replace the entire chunk spanning from biodataStart to fotoEnd
const prefix = code.substring(0, biodataStart);
const suffix = code.substring(fotoEnd);

const newCode = prefix + fotoBlock + '\n\n            ' + biodataBlock + suffix;

fs.writeFileSync('src/pages/Profile.tsx', newCode, 'utf8');
console.log('Successfully swapped Biodata and Foto sections.');
