const fs = require('fs');
let c = fs.readFileSync('client/src/pages/extranet/ExtranetPortal.jsx', 'utf8');

const adminLink = `
        {/* Lien Administration */}
        <div className="text-center mt-6">
          <a href="/login" className="inline-block px-4 py-2 text-green-700 font-medium hover:underline">
            Accès Collaborateurs (Administration)
          </a>
        </div>
`;

if (!c.includes('Accès Collaborateurs')) {
  c = c.replace(/<\/div>\n    \);/, adminLink + '\n      </div>\n    );');
  fs.writeFileSync('client/src/pages/extranet/ExtranetPortal.jsx', c);
}
