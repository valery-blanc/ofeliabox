// Verifie la logique de masquage sans navigateur.
//
// On extrait les fonctions du fichier livre et on les execute contre un DOM
// minimal. Ce qu'on veut prouver tient en trois points, et chacun a deja ete
// une source de bug ailleurs dans ce projet :
//   1. le masque ne renseigne pas sur la longueur reelle ;
//   2. « Copier » copie la VRAIE valeur, meme masquee ;
//   3. la bascule revient exactement a l'etat de depart.
import fs from 'fs';

const html = fs.readFileSync('./creds_final.html', 'utf8');
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// Un DOM minimal : juste ce que les fonctions touchent.
function faireElement() {
  const e = {
    _cls: new Set(), dataset: {}, textContent: '', title: '',
    classList: {
      add: (c) => e._cls.add(c),
      remove: (c) => e._cls.delete(c),
      contains: (c) => e._cls.has(c),
    },
    isContentEditable: false,
    // Le code livre pose des attributs d'accessibilite : le double doit les
    // accepter, sinon on teste les limites du double et non le code.
    _attrs: {},
    setAttribute: (k, v) => { e._attrs[k] = v; },
    getAttribute: (k) => e._attrs[k],
    // `style` existe sur tout element reel : sans lui, le retour visuel de
    // `copier` fait echouer le test pour une raison qui n'est pas la sienne.
    style: {},
  };
  return e;
}

let copie = null;
const contexte = {
  navigator: { clipboard: { writeText: (t) => { copie = t; return Promise.resolve(); } } },
  setTimeout: () => 0,
  clearTimeout: () => {},
  document: { getElementById: () => null },
};

const extrait = (nom) => {
  const i = js.indexOf('function ' + nom);
  if (i < 0) throw new Error('fonction introuvable : ' + nom);
  // On coupe a la prochaine declaration de premier niveau.
  const reste = js.slice(i + 1);
  const j = reste.search(/\nfunction |\n\(function/);
  return js.slice(i, j < 0 ? undefined : i + 1 + j);
};

const source = ['masquer', 'demasquer', 'basculerVisibilite', 'copier']
  .map(extrait).join('\n');
const f = new Function('navigator', 'setTimeout', 'clearTimeout',
  source + '\nreturn { masquer, demasquer, basculerVisibilite, copier };');
const M = f(contexte.navigator, contexte.setTimeout, contexte.clearTimeout);

let echecs = 0;
const verifier = (nom, condition, detail) => {
  if (condition) console.log('  OK    ' + nom);
  else { console.log('  ECHEC ' + nom + (detail ? ' -> ' + detail : '')); echecs++; }
};

// 1. Le masque ne trahit pas la longueur du mot de passe.
const court = faireElement(); court.dataset.valeur = 'abc123';
const long = faireElement(); long.dataset.valeur = 'un-mot-de-passe-tres-long-2026';
M.masquer(court); M.masquer(long);
verifier('le masque ne revele pas la longueur',
  court.textContent === long.textContent,
  `"${court.textContent}" vs "${long.textContent}"`);
verifier('le masque ne contient aucun caractere du mot de passe',
  !/[a-z0-9]/i.test(court.textContent), court.textContent);

// 2. Copier fonctionne meme masque — c'est le geste le plus sur.
copie = null;
M.copier(court, null);
verifier('copier renvoie la vraie valeur quand c est masque',
  copie === 'abc123', String(copie));

// 3. La bascule est reversible a l'identique.
const oeil = faireElement();
const v = faireElement(); v.dataset.valeur = 'Ofelia2026';
M.masquer(v);
const masqueDepart = v.textContent;
M.basculerVisibilite(v, oeil);
verifier('demasquer affiche la vraie valeur', v.textContent === 'Ofelia2026', v.textContent);
verifier('l icone change en position revelee', oeil.textContent !== '', oeil.textContent);
copie = null; M.copier(v, null);
verifier('copier fonctionne aussi une fois revele', copie === 'Ofelia2026', String(copie));
M.basculerVisibilite(v, oeil);
verifier('re-masquer revient a l etat de depart',
  v.textContent === masqueDepart && v.classList.contains('masque'), v.textContent);

// 4. Une valeur sans dataset (nom d'utilisateur) se copie quand meme.
const nu = faireElement(); nu.textContent = 'admin';
copie = null; M.copier(nu, null);
verifier('copier marche sans dataset (nom d utilisateur)', copie === 'admin', String(copie));

console.log();
if (echecs) { console.log(echecs + ' verification(s) en echec'); process.exit(1); }
console.log('les 8 verifications passent');
