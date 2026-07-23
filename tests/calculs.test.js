// â”€â”€â”€ TESTS AUTOMATISÃ‰S â€” CALCULS FINANCIERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Objectif : vÃ©rifier que les fonctions de calcul critiques (rÃ©partition du
// labo, marges, rÃ©sultat net, rapprochement bancaire...) continuent de
// produire les bons rÃ©sultats Ã  chaque modification du code. Ces tests
// tournent automatiquement via GitHub Actions Ã  chaque envoi de code
// (voir .github/workflows/test.yml) â€” si un calcul casse, le dÃ©ploiement du
// site est bloquÃ© AVANT que la version buggÃ©e n'arrive en ligne.
//
// Les fonctions testÃ©es sont importÃ©es directement depuis src/App.jsx (voir
// les exports en toute fin de ce fichier) â€” pas de copie dupliquÃ©e qui
// pourrait diverger silencieusement du vrai code de l'app.

import { describe, it, expect } from 'vitest';
import {
  n, montantCat, totalLabo, totalDirect, repartition, calcPDV, caDepuisClotures,
  totalChargesDirectesPDV, extractKeyword, hashRow, moisLissage,
  fillPdvKeys, initMois, ensureMois, GROUPES_COMPTA, PDV_LIST,
} from '../src/App.jsx';

// â”€â”€â”€ n() â€” conversion sÃ©curisÃ©e en nombre â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
describe('n() â€” conversion sÃ©curisÃ©e en nombre', () => {
  it('convertit une chaÃ®ne numÃ©rique valide', () => {
    expect(n('42.5')).toBe(42.5);
  });
  it('retourne 0 pour une valeur vide', () => {
    expect(n('')).toBe(0);
  });
  it('retourne 0 pour undefined/null', () => {
    expect(n(undefined)).toBe(0);
    expect(n(null)).toBe(0);
  });
  it('retourne 0 pour une chaÃ®ne non numÃ©rique', () => {
    expect(n('abc')).toBe(0);
  });
  it('gÃ¨re un nombre dÃ©jÃ  numÃ©rique', () => {
    expect(n(100)).toBe(100);
  });
});

// â”€â”€â”€ montantCat() â€” calcul du montant d'une charge (fixe vs variable) â”€â”€â”€â”€â”€â”€â”€â”€â”€
describe('montantCat() â€” montant fixe vs variable', () => {
  it('charge fixe : montantFixe + supplÃ©ment du mois', () => {
    const cat = { id: 'loyer', type: 'fixe', montantFixe: 3000 };
    const vars = { loyer: 11235.24 };
    // Cas rÃ©el rencontrÃ© : loyer trimestriel mal lissÃ© (3000 fixe + 11235,24 en supplÃ©ment)
    expect(montantCat(cat, vars)).toBeCloseTo(14235.24, 2);
  });
  it('charge fixe sans supplÃ©ment ce mois : juste le montant fixe', () => {
    const cat = { id: 'loyer', type: 'fixe', montantFixe: 3000 };
    expect(montantCat(cat, {})).toBe(3000);
  });
  it('charge variable : uniquement le montant saisi ce mois', () => {
    const cat = { id: 'matieres', type: 'variable', montantFixe: 0 };
    const vars = { matieres: 8500 };
    expect(montantCat(cat, vars)).toBe(8500);
  });
  it('charge variable sans saisie : 0', () => {
    const cat = { id: 'matieres', type: 'variable', montantFixe: 0 };
    expect(montantCat(cat, {})).toBe(0);
    expect(montantCat(cat, undefined)).toBe(0);
  });
});

// â”€â”€â”€ totalLabo() / totalDirect() â€” somme des charges d'une liste â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
describe('totalLabo() et totalDirect() â€” somme de charges', () => {
  const cats = [
    { id: 'loyer', type: 'fixe', montantFixe: 3000 },
    { id: 'matieres', type: 'variable', montantFixe: 0 },
    { id: 'elec', type: 'variable', montantFixe: 0 },
  ];
  const vars = { loyer: 0, matieres: 8500, elec: 450 };

  it('additionne correctement toutes les catÃ©gories', () => {
    // 3000 (loyer fixe) + 8500 (matiÃ¨res) + 450 (Ã©lec) = 11950
    expect(totalLabo(cats, vars)).toBe(11950);
    expect(totalDirect(cats, vars)).toBe(11950); // mÃªme logique
  });
  it('liste vide retourne 0', () => {
    expect(totalLabo([], vars)).toBe(0);
  });
});

// â”€â”€â”€ repartition() â€” rÃ©partition automatique des charges labo sur les PDV â”€â”€â”€â”€
describe('repartition() â€” mÃ©thode 50% CA + 50% jours d\'ouverture', () => {
  it('avec CA nul partout, la rÃ©partition se fait uniquement sur les jours', () => {
    const moisPdv = Object.fromEntries(PDV_LIST.map(p => [p.id, { ca: 0 }]));
    const rep = repartition(moisPdv);
    // TOTAL_J = 2+1+1+3+3+2+1+1+7+7 = 28
    // Sans CA, pCA = 1/10 (rÃ©partition Ã©gale) pour chaque PDV
    // pct = (0.5 * 1/10 + 0.5 * j/28) * 100
    const bourg = rep['bourg']; // j=2
    const attendu = (0.5 * (1/10) + 0.5 * (2/28)) * 100;
    expect(bourg).toBeCloseTo(attendu, 5);
  });
  it('la somme de toutes les rÃ©partitions fait 100%', () => {
    const moisPdv = Object.fromEntries(PDV_LIST.map((p, i) => [p.id, { ca: (i + 1) * 1000 }]));
    const rep = repartition(moisPdv);
    const total = Object.values(rep).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(100, 5);
  });
  it('un PDV avec plus de CA obtient une part plus grande (toutes choses Ã©gales par ailleurs)', () => {
    const moisPdv = Object.fromEntries(PDV_LIST.map(p => [p.id, { ca: 0 }]));
    moisPdv['vanves'] = { ca: 10000 }; // vanves j=1, seul Ã  avoir du CA
    const rep = repartition(moisPdv);
    // Vanves doit avoir la plus grosse part de tous les PDV avec j=1 (vanves, convention, trosy, fourche ont tous j=1)
    expect(rep['vanves']).toBeGreaterThan(rep['convention']);
    expect(rep['vanves']).toBeGreaterThan(rep['trosy']);
  });
});

// â”€â”€â”€ calcPDV() â€” calcul du rÃ©sultat d'un point de vente â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
describe('calcPDV() â€” rÃ©sultat net d\'un PDV', () => {
  it('calcule correctement CA - charges directes - quote-part labo', () => {
    const pdvMois = { ca: 5000, vars: { loyer_pdv: 500 } };
    const pdvCats = [{ id: 'loyer_pdv', type: 'variable', montantFixe: 0 }];
    const pct = 20; // 20% du labo rÃ©parti sur ce PDV
    const tLabo = 10000;
    const result = calcPDV(pdvMois, pdvCats, pct, tLabo);
    // ca=5000, dir=500, ql=10000*20/100=2000, res=5000-500-2000=2500
    expect(result.ca).toBe(5000);
    expect(result.dir).toBe(500);
    expect(result.ql).toBe(2000);
    expect(result.res).toBe(2500);
    expect(result.pctNet).toBeCloseTo(50, 5); // 2500/5000*100
  });
  it('CA nul => pctNet Ã  0 (pas de division par zÃ©ro)', () => {
    const pdvMois = { ca: 0, vars: {} };
    const result = calcPDV(pdvMois, [], 10, 5000);
    expect(result.pctNet).toBe(0);
  });
  it('seuil d\'Ã©quilibre = charges directes + quote-part labo', () => {
    const pdvMois = { ca: 1000, vars: { x: 300 } };
    const pdvCats = [{ id: 'x', type: 'variable', montantFixe: 0 }];
    const result = calcPDV(pdvMois, pdvCats, 10, 2000);
    // dir=300, ql=200, seuil=500
    expect(result.seuil).toBe(500);
  });
});

// â”€â”€â”€ caDepuisClotures() â€” CA mensuel Ã  partir des clÃ´tures vendeurs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
describe('caDepuisClotures() â€” somme des clÃ´tures', () => {
  it('additionne tous les modes de toutes les clÃ´tures', () => {
    const clotures = [
      { modes: [{ montant: 100 }, { montant: 50 }] },
      { modes: [{ montant: 200 }] },
    ];
    expect(caDepuisClotures(clotures)).toBe(350);
  });
  it('liste vide retourne 0', () => {
    expect(caDepuisClotures([])).toBe(0);
    expect(caDepuisClotures(undefined)).toBe(0);
  });
});

// â”€â”€â”€ totalChargesDirectesPDV() â€” total des charges directes tous PDV â”€â”€â”€â”€â”€â”€â”€â”€â”€
describe('totalChargesDirectesPDV() â€” somme sur tous les points de vente', () => {
  it('additionne les charges directes de tous les PDV', () => {
    const moisPdv = Object.fromEntries(PDV_LIST.map(p => [p.id, { vars: {} }]));
    moisPdv['vanves'].vars = { loyer: 100 };
    moisPdv['bourg'].vars = { loyer: 200 };
    const pdvCats = Object.fromEntries(PDV_LIST.map(p => [p.id, [{ id: 'loyer', type: 'variable', montantFixe: 0 }]]));
    expect(totalChargesDirectesPDV(moisPdv, pdvCats)).toBe(300);
  });
});

// â”€â”€â”€ extractKeyword() â€” dÃ©tection des lignes CSV (REMCB, SumUp, dÃ©pÃ´ts...) â”€â”€â”€
describe('extractKeyword() â€” dÃ©tection des types de lignes bancaires', () => {
  it('dÃ©tecte un encaissement REMCB', () => {
    const k = extractKeyword('REMCB1234567 CARTE 12345');
    expect(k.isRemCB).toBe(true);
  });
  it('dÃ©tecte une commission COMCB', () => {
    const k = extractKeyword('COMCB1234567');
    expect(k.isComCB).toBe(true);
  });
  it('dÃ©tecte un versement SumUp', () => {
    const k = extractKeyword('VIR SUMUP PAYMENTS SA');
    expect(k.isSumUp).toBe(true);
  });
  it('dÃ©tecte un dÃ©pÃ´t d\'espÃ¨ces', () => {
    expect(extractKeyword('VERSEMENT ESPECES').isDepotEspeces).toBe(true);
    expect(extractKeyword('REMISE NUM 12345').isDepotEspeces).toBe(true);
  });
  it('un libellÃ© normal n\'est reconnu comme aucun type spÃ©cial', () => {
    const k = extractKeyword('FACTURE FOURNISSEUR XYZ');
    expect(k.isRemCB).toBe(false);
    expect(k.isComCB).toBe(false);
    expect(k.isSumUp).toBe(false);
    expect(k.isDepotEspeces).toBe(false);
  });
});

// â”€â”€â”€ hashRow() â€” identifiant unique d'une ligne CSV (dÃ©tection doublons) â”€â”€â”€â”€â”€
describe('hashRow() â€” hash de dÃ©tection des doublons', () => {
  it('deux lignes identiques donnent le mÃªme hash', () => {
    const row1 = { dateOp: '01/07/2026', libelle: 'TEST', debit: 10, credit: 0 };
    const row2 = { dateOp: '01/07/2026', libelle: 'TEST', debit: 10, credit: 0 };
    expect(hashRow(row1)).toBe(hashRow(row2));
  });
  it('deux lignes avec un montant diffÃ©rent donnent un hash diffÃ©rent', () => {
    const row1 = { dateOp: '01/07/2026', libelle: 'TEST', debit: 10, credit: 0 };
    const row2 = { dateOp: '01/07/2026', libelle: 'TEST', debit: 20, credit: 0 };
    expect(hashRow(row1)).not.toBe(hashRow(row2));
  });
});

// â”€â”€â”€ moisLissage() â€” calcul des mois cibles pour un lissage (trimestriel...) â”€â”€
describe('moisLissage() â€” rÃ©partition sur plusieurs mois', () => {
  it('lissage ponctuel (1 mois) : retourne juste le mois de dÃ©part', () => {
    expect(moisLissage('2026-6', 1)).toEqual(['2026-6']); // juillet = index 6
  });
  it('lissage trimestriel : 3 mois consÃ©cutifs', () => {
    expect(moisLissage('2026-6', 3)).toEqual(['2026-6', '2026-7', '2026-8']);
  });
  it('gÃ¨re le changement d\'annÃ©e (dÃ©cembre â†’ janvier)', () => {
    // DÃ©cembre 2026 (index 11) + 2 mois => janvier 2027, fÃ©vrier 2027
    expect(moisLissage('2026-11', 3)).toEqual(['2026-11', '2027-0', '2027-1']);
  });
});

// â”€â”€â”€ fillPdvKeys() / initMois() / ensureMois() â€” cohÃ©rence de la structure â”€â”€â”€â”€
describe('fillPdvKeys(), initMois(), ensureMois() â€” intÃ©gritÃ© des donnÃ©es mois', () => {
  it('initMois() crÃ©e un mois avec les 10 PDV initialisÃ©s Ã  0', () => {
    const mois = initMois();
    expect(Object.keys(mois.pdv).length).toBe(PDV_LIST.length);
    PDV_LIST.forEach(p => {
      expect(mois.pdv[p.id].ca).toBe(0);
      expect(mois.pdv[p.id].clotures).toEqual([]);
    });
  });
  it('fillPdvKeys() complÃ¨te un mois auquel il manque des PDV', () => {
    const moisIncomplet = { laboCh: {}, pdv: { vanves: { ca: 100, vars: {}, clotures: [] } } };
    const complet = fillPdvKeys(moisIncomplet);
    expect(Object.keys(complet.pdv).length).toBe(PDV_LIST.length);
    expect(complet.pdv.vanves.ca).toBe(100); // la donnÃ©e existante est prÃ©servÃ©e
  });
  it('fillPdvKeys() ajoute toujours evenementiel et _depenses et _rapprochements', () => {
    const moisVide = { laboCh: {}, pdv: {} };
    const complet = fillPdvKeys(moisVide);
    expect(complet.pdv.evenementiel).toEqual({ ca: 0, encaissements: [] });
    expect(complet.pdv._depenses).toEqual([]);
    expect(complet.pdv._rapprochements).toEqual([]);
  });
  it('ensureMois() crÃ©e le mois s\'il n\'existe pas encore', () => {
    const data = { mois: {} };
    const result = ensureMois(data, '2026-6');
    expect(result.mois['2026-6']).toBeDefined();
    expect(Object.keys(result.mois['2026-6'].pdv).length).toBe(PDV_LIST.length);
  });
});

// â”€â”€â”€ GROUPES_COMPTA â€” cohÃ©rence du plan comptable â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
describe('GROUPES_COMPTA â€” intÃ©gritÃ© du plan comptable', () => {
  it('contient bien les 9 groupes + Ã  classer', () => {
    expect(GROUPES_COMPTA.length).toBe(10);
  });
  it('chaque groupe a un id et un label', () => {
    GROUPES_COMPTA.forEach(g => {
      expect(g.id).toBeTruthy();
      expect(g.label).toBeTruthy();
    });
  });
});

// â”€â”€â”€ PDV_LIST â€” intÃ©gritÃ© de la liste des points de vente â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
describe('PDV_LIST â€” intÃ©gritÃ© des 10 points de vente', () => {
  it('contient exactement 10 points de vente', () => {
    expect(PDV_LIST.length).toBe(10);
  });
  it('chaque PDV a un nombre de jours d\'ouverture positif', () => {
    PDV_LIST.forEach(p => {
      expect(p.j).toBeGreaterThan(0);
    });
  });
  it('tous les ids sont uniques', () => {
    const ids = PDV_LIST.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
