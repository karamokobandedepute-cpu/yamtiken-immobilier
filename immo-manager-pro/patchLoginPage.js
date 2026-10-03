const fs = require('fs');
let c = fs.readFileSync('client/src/pages/LoginPage.jsx', 'utf8');

const extranetLink = `
        {/* Lien Portail Locataire */}
        <div className="text-center mt-6">
          <p className="text-white text-sm mb-2">Vous êtes un locataire ou un souscripteur ?</p>
          <a href="/extranet" className="inline-block px-6 py-2 bg-white/20 hover:bg-white/30 text-white font-medium rounded-full transition-colors border border-white/40">
            Accéder au Portail Locataire
          </a>
        </div>
`;

if (!c.includes('Portail Locataire')) {
  c = c.replace(/\{\/\* Footer \*\/\}/, extranetLink + '\n        {/* Footer */}');
  fs.writeFileSync('client/src/pages/LoginPage.jsx', c);
}
