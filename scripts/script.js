
const fs = require('fs');
const path = 'd:/DATA ABFA/project aplikasi/absen-digital/src/pages/Profile.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

const toDelete = [
  [555, 867],
  [282, 303],
  [183, 214],
  [127, 129],
  [114, 117],
  [81, 99],
];

for (const [start, end] of toDelete) {
  lines.splice(start - 1, end - start + 1);
}

const stateReplaceStart = 23;
const stateReplaceEnd = 35;
lines.splice(stateReplaceStart - 1, stateReplaceEnd - stateReplaceStart + 1,
  '  const [activeTab, setActiveTab] = useState<\\'profil\\' | \\'foto\\'>(\\'profil\\');',
  '  const [photoBase64, setPhotoBase64] = useState<string>(\\'\\');',
  '  const [selectedPhotoName, setSelectedPhotoName] = useState<string>(\\'\\');',
  '  const photoInputRef = useRef<HTMLInputElement>(null);',
  '  const [confirmProfile, setConfirmProfile] = useState(false);'
);

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('File successfully updated.');

