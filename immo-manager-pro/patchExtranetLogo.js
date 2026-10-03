const fs = require('fs');
let c = fs.readFileSync('client/src/pages/extranet/ExtranetPortal.jsx', 'utf8');

c = c.replace(
  /import \{ Home, Key, FileText, LogOut, CheckCircle, Clock \} from 'lucide-react';/,
  "import { Home, Key, FileText, LogOut, CheckCircle, Clock } from 'lucide-react';\nimport logoImg from '../../assets/logo/logo behemoth.png';"
);

const logoHtml = `
          <div className="flex justify-center mb-6">
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
              <img src={logoImg} alt="Yamtiken Behemoth" className="w-24 h-24 object-contain" />
            </div>
          </div>
`;

c = c.replace(
  /<div className="flex justify-center">\s*<div className="bg-green-100 p-3 rounded-full">\s*<Home className="h-12 w-12 text-green-600" \/>\s*<\/div>\s*<\/div>/,
  logoHtml
);

const navLogo = `
            <div className="flex items-center gap-3 font-bold text-xl">
              <img src={logoImg} alt="Logo" className="w-8 h-8 object-contain bg-white rounded-md p-1" />
              Mon Portail Immobilier
            </div>
`;

c = c.replace(
  /<div className="flex items-center gap-2 font-bold text-xl">\s*<Home size=\{24\} \/> Mon Portail Immobilier\s*<\/div>/,
  navLogo
);

fs.writeFileSync('client/src/pages/extranet/ExtranetPortal.jsx', c);
