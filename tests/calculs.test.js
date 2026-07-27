// ─── TESTS AUTOMATISÉS — CALCULS FINANCIERS ────────────────────────────────────
// Objectif : vérifier que les fonctions de calcul critiques (répartition du
// labo, marges, résultat net, rapprochement bancaire...) continuent de
// produire les bons résultats à chaque modification du code. Ces tests
// tournent automatiquement via GitHub Actions à chaque envoi de code
// (voir .github/workflows/test.yml) — si un calcul casse, le déploiement du
// site est bloqué AVANT que la version buggée n'arrive en ligne.
//
// Les fonctions testées sont importées directement depuis src/App.jsx (voir
// les exports en toute fin de ce fichier) — pas de copie dupliquée qui
// pourrait diverger silencieusement du vrai code de l'app.

import { describe, it, expect } from 'vitest';
import {
  n, montantCat, totalLabo, totalDirect, repartition, calcPDV, caDepuisClotures,
  totalChargesDirectesPDV, extractKeyword, hashRow, moisLissage,
  fillPdvKeys, initMois, ensureMois, GROUPES_COMPTA, PDV_LIST,
} from '../src/App.jsx';

// ─── n() — conversion sécurisée en nombre ─────────────────────────────────────
describe('n() — conversion sécurisée en nombre', () => {
  it('convertit une chaîne numérique valide', () => {
    expect(n('42.5')).toBe(42.5);
  });
  it('retourne 0 pour une valeur vide', () => {
    expect(n('')).toBe(0);
  });
  it('retourne 0 pour undefined/null', () => {
    expect(n(undefined)).toBe(0);
    expect(n(null)).toBe(0);
  });
  it('retourne 0 pour une chaîne non numérique', () => {
    expect(n('abc')).toBe(0);
  });
  it('gère un nombre déjà numérique', () => {
    expect(n(100)).toBe(100);
  });
});

// ─── montantCat() — calcul du montant d'une charge (fixe vs variable) ─────────
describe('montantCat() — montant fixe vs variable', () => {
  it('charge fixe : montantFixe + supplément du mois', () => {
    const cat = { id: 'loyer', type: 'fixe', montantFixe: 3000 };
    const vars = { loyer: 11235.24 };
    // Cas réel rencontré : loyer trimestriel mal lissé (3000 fixe + 11235,24 en supplément)
    expect(montantCat(cat, vars)).toBeCloseTo(14235.24, 2);
  });
  it('charge fixe sans supplément ce mois : juste le montant fixe', () => {
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

// ─── totalLabo() / totalDirect() — somme des charges d'une liste ─────────────
describe('totalLabo() et totalDirect() — somme de charges', () => {
  const cats = [
    { id: 'loyer', type: 'fixe', montantFixe: 3000 },
    { id: 'matieres', type: 'variable', montantFixe: 0 },
    { id: 'elec', type: 'variable', montantFixe: 0 },
  ];
  const vars = { loyer: 0, matieres: 8500, elec: 450 };

  it('additionne correctement toutes les catégories', () => {
    // 3000 (loyer fixe) + 8500 (matières) + 450 (élec) = 11950
    expect(totalLabo(cats, vars)).toBe(11950);
    expect(totalDirect(cats, vars)).toBe(11950); // même logique
  });
  it('liste vide retourne 0', () => {
    expect(totalLabo([], vars)).toBe(0);
  });
});

// ─── repartition() — répartition automatique des charges labo sur les PDV ────
describe('repartition() — méthode 50% CA + 50% jours d\'ouverture', () => {
  it('avec CA nul partout, la répartition se fait uniquement sur les jours', () => {
    const moisPdv = Object.fromEntries(PDV_LIST.map(p => [p.id, { ca: 0 }]));
    const rep = repartition(moisPdv);
    // TOTAL_J = 2+1+1+3+3+2+1+1+7+7 = 28
    // Sans CA, pCA = 1/10 (répartition égale) pour chaque PDV
    // pct = (0.5 * 1/10 + 0.5 * j/28) * 100
    const bourg = rep['bourg']; // j=2
    const attendu = (0.5 * (1/10) + 0.5 * (2/28)) * 100;
    expect(bourg).toBeCloseTo(attendu, 5);
  });
  it('la somme de toutes les répartitions fait 100%', () => {
    const moisPdv = Object.fromEntries(PDV_LIST.map((p, i) => [p.id, { ca: (i + 1) * 1000 }]));
    const rep = repartition(moisPdv);
    const total = Object.values(rep).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(100, 5);
  });
  it('un PDV avec plus de CA obtient une part plus grande (toutes choses égales par ailleurs)', () => {
    const moisPdv = Object.fromEntries(PDV_LIST.map(p => [p.id, { ca: 0 }]));
    moisPdv['vanves'] = { ca: 10000 }; // vanves j=1, seul à avoir du CA
    const rep = repartition(moisPdv);
    // Vanves doit avoir la plus grosse part de tous les PDV avec j=1 (vanves, convention, trosy, fourche ont tous j=1)
    expect(rep['vanves']).toBeGreaterThan(rep['convention']);
    expect(rep['vanves']).toBeGreaterThan(rep['trosy']);
  });
});

// ─── calcPDV() — calcul du résultat d'un point de vente ───────────────────────
describe('calcPDV() — résultat net d\'un PDV', () => {
  it('calcule correctement CA - charges directes - quote-part labo', () => {
    const pdvMois = { ca: 5000, vars: { loyer_pdv: 500 } };
    const pdvCats = [{ id: 'loyer_pdv', type: 'variable', montantFixe: 0 }];
    const pct = 20; // 20% du labo réparti sur ce PDV
    const tLabo = 10000;
    const result = calcPDV(pdvMois, pdvCats, pct, tLabo);
    // ca=5000, dir=500, ql=10000*20/100=2000, res=5000-500-2000=2500
    expect(result.ca).toBe(5000);
    expect(result.dir).toBe(500);
    expect(result.ql).toBe(2000);
    expect(result.res).toBe(2500);
    expect(result.pctNet).toBeCloseTo(50, 5); // 2500/5000*100
  });
  it('CA nul => pctNet à 0 (pas de division par zéro)', () => {
    const pdvMois = { ca: 0, vars: {} };
    const result = calcPDV(pdvMois, [], 10, 5000);
    expect(result.pctNet).toBe(0);
  });
  it('seuil d\'équilibre = charges directes + quote-part labo', () => {
    const pdvMois = { ca: 1000, vars: { x: 300 } };
    const pdvCats = [{ id: 'x', type: 'variable', montantFixe: 0 }];
    const result = calcPDV(pdvMois, pdvCats, 10, 2000);
    // dir=300, ql=200, seuil=500
    expect(result.seuil).toBe(500);
  });
});

// ─── caDepuisClotures() — CA mensuel à partir des clôtures vendeurs ───────────
describe('caDepuisClotures() — somme des clôtures', () => {
  it('additionne tous les modes de toutes les clôtures', () => {
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

// ─── totalChargesDirectesPDV() — total des charges directes tous PDV ─────────
describe('totalChargesDirectesPDV() — somme sur tous les points de vente', () => {
  it('additionne les charges directes de tous les PDV', () => {
    const moisPdv = Object.fromEntries(PDV_LIST.map(p => [p.id, { vars: {} }]));
    moisPdv['vanves'].vars = { loyer: 100 };
    moisPdv['bourg'].vars = { loyer: 200 };
    const pdvCats = Object.fromEntries(PDV_LIST.map(p => [p.id, [{ id: 'loyer', type: 'variable', montantFixe: 0 }]]));
    expect(totalChargesDirectesPDV(moisPdv, pdvCats)).toBe(300);
  });
});

// ─── extractKeyword() — détection des lignes CSV (REMCB, SumUp, dépôts...) ───
describe('extractKeyword() — détection des types de lignes bancaires', () => {
  it('détecte un encaissement REMCB', () => {
    const k = extractKeyword('REMCB1234567 CARTE 12345');
    expect(k.isRemCB).toBe(true);
  });
  it('détecte une commission COMCB', () => {
    const k = extractKeyword('COMCB1234567');
    expect(k.isComCB).toBe(true);
  });
  it('détecte un versement SumUp', () => {
    const k = extractKeyword('VIR SUMUP PAYMENTS SA');
    expect(k.isSumUp).toBe(true);
  });
  it('détecte un dépôt d\'espèces', () => {
    expect(extractKeyword('VERSEMENT ESPECES').isDepotEspeces).toBe(true);
    expect(extractKeyword('REMISE NUM 12345').isDepotEspeces).toBe(true);
  });
  it('un libellé normal n\'est reconnu comme aucun type spécial', () => {
    const k = extractKeyword('FACTURE FOURNISSEUR XYZ');
    expect(k.isRemCB).toBe(false);
    expect(k.isComCB).toBe(false);
    expect(k.isSumUp).toBe(false);
    expect(k.isDepotEspeces).toBe(false);
  });
});

// ─── hashRow() — identifiant unique d'une ligne CSV (détection doublons) ─────
describe('hashRow() — hash de détection des doublons', () => {
  it('deux lignes identiques donnent le même hash', () => {
    const row1 = { dateOp: '01/07/2026', libelle: 'TEST', debit: 10, credit: 0 };
    const row2 = { dateOp: '01/07/2026', libelle: 'TEST', debit: 10, credit: 0 };
    expect(hashRow(row1)).toBe(hashRow(row2));
  });
  it('deux lignes avec un montant différent donnent un hash différent', () => {
    const row1 = { dateOp: '01/07/2026', libelle: 'TEST', debit: 10, credit: 0 };
    const row2 = { dateOp: '01/07/2026', libelle: 'TEST', debit: 20, credit: 0 };
    expect(hashRow(row1)).not.toBe(hashRow(row2));
  });
});

// ─── moisLissage() — calcul des mois cibles pour un lissage (trimestriel...) ──
describe('moisLissage() — répartition sur plusieurs mois', () => {
  it('lissage ponctuel (1 mois) : retourne juste le mois de départ', () => {
    expect(moisLissage('2026-6', 1)).toEqual(['2026-6']); // juillet = index 6
  });
  it('lissage trimestriel : 3 mois consécutifs', () => {
    expect(moisLissage('2026-6', 3)).toEqual(['2026-6', '2026-7', '2026-8']);
  });
  it('gère le changement d\'année (décembre → janvier)', () => {
    // Décembre 2026 (index 11) + 2 mois => janvier 2027, février 2027
    expect(moisLissage('2026-11', 3)).toEqual(['2026-11', '2027-0', '2027-1']);
  });
});

// ─── fillPdvKeys() / initMois() / ensureMois() — cohérence de la structure ────
describe('fillPdvKeys(), initMois(), ensureMois() — intégrité des données mois', () => {
  it('initMois() crée un mois avec les 10 PDV initialisés à 0', () => {
    const mois = initMois();
    expect(Object.keys(mois.pdv).length).toBe(PDV_LIST.length);
    PDV_LIST.forEach(p => {
      expect(mois.pdv[p.id].ca).toBe(0);
      expect(mois.pdv[p.id].clotures).toEqual([]);
    });
  });
  it('fillPdvKeys() complète un mois auquel il manque des PDV', () => {
    const moisIncomplet = { laboCh: {}, pdv: { vanves: { ca: 100, vars: {}, clotures: [] } } };
    const complet = fillPdvKeys(moisIncomplet);
    // fillPdvKeys() ajoute les 10 PDV + 3 clés supplémentaires (evenementiel,
    // _depenses, _rapprochements) — soit 13 clés au total, pas seulement 10.
    PDV_LIST.forEach(p => {
      expect(complet.pdv[p.id]).toBeDefined();
    });
    expect(complet.pdv.vanves.ca).toBe(100); // la donnée existante est préservée
  });
  it('fillPdvKeys() ajoute toujours evenementiel et _depenses et _rapprochements', () => {
    const moisVide = { laboCh: {}, pdv: {} };
    const complet = fillPdvKeys(moisVide);
    expect(complet.pdv.evenementiel).toEqual({ ca: 0, encaissements: [] });
    expect(complet.pdv._depenses).toEqual([]);
    expect(complet.pdv._rapprochements).toEqual([]);
  });
  it('ensureMois() crée le mois s\'il n\'existe pas encore', () => {
    const data = { mois: {} };
    const result = ensureMois(data, '2026-6');
    expect(result.mois['2026-6']).toBeDefined();
    expect(Object.keys(result.mois['2026-6'].pdv).length).toBe(PDV_LIST.length);
  });
});

// ─── GROUPES_COMPTA — cohérence du plan comptable ─────────────────────────────
describe('GROUPES_COMPTA — intégrité du plan comptable', () => {
  it('contient bien les 9 groupes + à classer', () => {
    expect(GROUPES_COMPTA.length).toBe(10);
  });
  it('chaque groupe a un id et un label', () => {
    GROUPES_COMPTA.forEach(g => {
      expect(g.id).toBeTruthy();
      expect(g.label).toBeTruthy();
    });
  });
});

// ─── PDV_LIST — intégrité de la liste des points de vente ────────────────────
describe('PDV_LIST — intégrité des 10 points de vente', () => {
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
