import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://jntdnittzmhxemrptysq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpudGRuaXR0em1oeGVtcnB0eXNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MTk5NjcsImV4cCI6MjA5ODE5NTk2N30.ktXUDtcKJ6yVKIKInaFNuG6DY4VF1FbeqYWZJZXpdpg";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── CONFIG PDV ───────────────────────────────────────────────────────────────
const PDV_LIST = [
  { id:"bourg",      nom:"Bourg-la-Reine", full:"Marché Bourg-la-Reine", emoji:"🏪", j:2, jours:"Mer · Sam" },
  { id:"vanves",     nom:"Vanves",         full:"Marché Vanves",         emoji:"🏪", j:1, jours:"Sam" },
  { id:"convention", nom:"Convention",     full:"Marché Convention",     emoji:"🏪", j:1, jours:"Dim" },
  { id:"malakoff",   nom:"Malakoff",       full:"Marché Malakoff",       emoji:"🏪", j:3, jours:"Mer · Ven · Sam" },
  { id:"escudier",   nom:"Escudier",       full:"Marché Escudier",       emoji:"🏪", j:3, jours:"Mar · Ven · Dim" },
  { id:"billancourt",nom:"Billancourt",    full:"Marché Billancourt",    emoji:"🏪", j:2, jours:"Mer · Sam" },
  { id:"trosy",      nom:"Trosy",          full:"Marché Trosy",          emoji:"🏪", j:1, jours:"Sam" },
  { id:"fourche",    nom:"La Fourche",     full:"Marché La Fourche",     emoji:"🏪", j:1, jours:"Dim" },
  { id:"vavin",      nom:"Vavin",          full:"Boutique Vavin",        emoji:"🏬", j:7, jours:"7j/7 · 10h–21h" },
  { id:"alesia",     nom:"Alésia",         full:"Boutique Alésia",       emoji:"🏬", j:7, jours:"7j/7 · 10h–21h" },
];
const TOTAL_J = PDV_LIST.reduce((s,p)=>s+p.j,0);
const MOIS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const JOURS_SEMAINE = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];

// ─── PLAN COMPTABLE DES CHARGES (catégories + sous-catégories) ───────────────
const GROUPES_COMPTA = [
  { id:"g601", label:"1. Achats matières premières (601/602)" },
  { id:"g606", label:"2. Achats non stockés / fonctionnement (606)" },
  { id:"g61",  label:"3. Services extérieurs (61)" },
  { id:"g62",  label:"4. Autres services extérieurs (62)" },
  { id:"g63",  label:"5. Impôts et taxes (63)" },
  { id:"g64",  label:"6. Charges de personnel (64)" },
  { id:"g66",  label:"7. Charges financières (66)" },
  { id:"g67",  label:"8. Charges exceptionnelles (67)" },
  { id:"g68",  label:"9. Dotations aux amortissements (68)" },
  { id:"g0",   label:"À classer" },
];

// ─── RÉFÉRENCES DE PILOTAGE (% du CA) — valeurs par défaut ───────────────────
// Fourchettes de pilotage adaptées à un modèle de restauration rapide "faite
// maison" avec vente directe (marchés + boutiques) — production propre en
// laboratoire central, pas de l'achat-revente ni du traiteur événementiel sur
// devis. Issues de sources professionnelles françaises de la restauration
// (blogs spécialisés, cabinets comptables sectoriels — pas de statistiques
// officielles INSEE disponibles sur ce point depuis 2015).
//
// Ce ne sont que des VALEURS PAR DÉFAUT : chaque patron peut les ajuster à sa
// propre réalité dans l'onglet "🎯 Mes objectifs" (stockées dans app_data,
// clé `objectifsSectoriels`, elles remplacent alors ces valeurs par défaut).
//
// { min, max } = fourchette saine en % du CA. Au-delà de `max`, le poste est
// à surveiller ; en-deçà de `min` ce n'est pas un problème en soi (sauf pour
// la marge nette où c'est l'inverse).
const REFERENCES_SECTORIELLES_DEFAUT = {
  g601: { label:"Matières premières", min:25, max:35, note:"Restauration avec production propre : 25–35% du CA" },
  g606: { label:"Fonctionnement (eau, élec, fournitures)", min:3, max:8, note:"Repère indicatif — à ajuster selon votre expérience" },
  g61:  { label:"Services extérieurs (loyers, droits de place, assurances...)", min:5, max:12, note:"Vos droits de place de marché diffèrent d'un loyer classique — ajustez selon votre réalité" },
  g62:  { label:"Autres services (pub, déplacements, frais bancaires...)", min:3, max:10, note:"Inclut la logistique multi-sites, spécifique à votre modèle — ajustez selon votre réalité" },
  g63:  { label:"Impôts et taxes", min:2, max:4, note:"CFE, taxes locales, formation pro" },
  g64:  { label:"Charges de personnel", min:30, max:40, note:"Production maison (labo + vente) : masse salariale plus élevée que l'achat-revente" },
  primeCost: { label:"Prime cost (matières + personnel)", min:0, max:65, note:"Ne devrait pas dépasser 60–65% du CA — indicateur de survie" },
  margeNette: { label:"Marge nette (résultat net)", min:8, max:15, note:"5–10% = bon, 12–15% = très bon, en restauration avec production propre" },
};

const DEFAULT_COMPTA_CATS = [
  // 1. Achats matières premières — 601/602
  { id:"matieres",        groupe:"g601", label:"Denrées alimentaires",                          type:"variable", montantFixe:0 },
  { id:"boissons",        groupe:"g601", label:"Boissons",                                      type:"variable", montantFixe:0 },
  { id:"packaging",       groupe:"g601", label:"Emballages / contenants / vaisselle jetable",   type:"variable", montantFixe:0 },
  { id:"fourni",          groupe:"g601", label:"Petit matériel consommable",                    type:"variable", montantFixe:0 },
  { id:"fournitures_div", groupe:"g601", label:"Fournitures diverses (nappes, déco table)",     type:"variable", montantFixe:0 },
  // 2. Achats non stockés / fonctionnement — 606
  { id:"eau",             groupe:"g606", label:"Eau",                                           type:"variable", montantFixe:0 },
  { id:"elec",            groupe:"g606", label:"Électricité",                                   type:"variable", montantFixe:0 },
  { id:"gaz",             groupe:"g606", label:"Gaz",                                           type:"variable", montantFixe:0 },
  { id:"fourn_entretien", groupe:"g606", label:"Fournitures d'entretien",                       type:"variable", montantFixe:0 },
  { id:"fourn_admin",     groupe:"g606", label:"Fournitures administratives / bureau",          type:"variable", montantFixe:0 },
  { id:"petit_equip",     groupe:"g606", label:"Petit équipement non immobilisé",               type:"variable", montantFixe:0 },
  // 3. Services extérieurs — 61
  { id:"loyer",           groupe:"g61",  label:"Loyers",                                        type:"fixe",     montantFixe:0 },
  { id:"charges_loc",     groupe:"g61",  label:"Charges locatives / copropriété",               type:"fixe",     montantFixe:0 },
  { id:"entretien_rep",   groupe:"g61",  label:"Entretien et réparation matériel",              type:"variable", montantFixe:0 },
  { id:"maint_info",      groupe:"g61",  label:"Maintenance informatique",                      type:"variable", montantFixe:0 },
  { id:"assurances",      groupe:"g61",  label:"Assurances (RC pro, locaux, marchandises, véhicules)", type:"fixe", montantFixe:0 },
  { id:"loc_event",       groupe:"g61",  label:"Location matériel événementiel",                type:"variable", montantFixe:0 },
  { id:"sous_trait",      groupe:"g61",  label:"Sous-traitance (renfort traiteur)",             type:"variable", montantFixe:0 },
  { id:"formation",       groupe:"g61",  label:"Formation du personnel",                        type:"variable", montantFixe:0 },
  // 4. Autres services extérieurs — 62
  { id:"honoraires",      groupe:"g62",  label:"Honoraires (comptable, avocat)",                type:"variable", montantFixe:0 },
  { id:"pub",             groupe:"g62",  label:"Publicité / marketing / site web",              type:"variable", montantFixe:0 },
  { id:"deplacements",    groupe:"g62",  label:"Déplacements inter-sites (essence, péages, parking)", type:"variable", montantFixe:0 },
  { id:"loc_vehicules",   groupe:"g62",  label:"Location véhicules utilitaires",                type:"variable", montantFixe:0 },
  { id:"postaux",         groupe:"g62",  label:"Frais postaux",                                 type:"variable", montantFixe:0 },
  { id:"telecom",         groupe:"g62",  label:"Télécommunications (téléphone, internet)",      type:"fixe",     montantFixe:0 },
  { id:"commissions",     groupe:"g62",  label:"Commissions plateformes (livraison, réservation)", type:"variable", montantFixe:0 },
  { id:"frais_cb",        groupe:"g62",  label:"Frais bancaires (tenue de compte, TPE)",        type:"variable", montantFixe:0 },
  // 5. Impôts et taxes — 63
  { id:"cfe",             groupe:"g63",  label:"CFE",                                           type:"variable", montantFixe:0 },
  { id:"taxe_sal",        groupe:"g63",  label:"Taxe sur les salaires",                         type:"variable", montantFixe:0 },
  { id:"formation_pro",   groupe:"g63",  label:"Formation professionnelle continue",            type:"variable", montantFixe:0 },
  { id:"taxes_locales",   groupe:"g63",  label:"Autres taxes locales (enseigne, domaine public)", type:"variable", montantFixe:0 },
  { id:"tvs",             groupe:"g63",  label:"Taxe sur véhicules de société",                 type:"variable", montantFixe:0 },
  // 6. Charges de personnel — 64
  { id:"sal",             groupe:"g64",  label:"Salaires bruts (permanents)",                   type:"fixe",     montantFixe:0 },
  { id:"extras",          groupe:"g64",  label:"Salaires extras événementiels",                 type:"variable", montantFixe:0 },
  { id:"cs",              groupe:"g64",  label:"Charges sociales patronales",                   type:"fixe",     montantFixe:0 },
  { id:"avantages",       groupe:"g64",  label:"Tickets restaurant / avantages salariés",       type:"variable", montantFixe:0 },
  // 7. Charges financières — 66
  { id:"interets",        groupe:"g66",  label:"Intérêts d'emprunt",                            type:"fixe",     montantFixe:0 },
  { id:"agios",           groupe:"g66",  label:"Agios bancaires",                               type:"variable", montantFixe:0 },
  { id:"change",          groupe:"g66",  label:"Frais de change",                               type:"variable", montantFixe:0 },
  // 8. Charges exceptionnelles — 67
  { id:"penalites",       groupe:"g67",  label:"Pénalités / litiges",                           type:"variable", montantFixe:0 },
  { id:"mat_perdu",       groupe:"g67",  label:"Matériel détruit / perdu",                      type:"variable", montantFixe:0 },
  { id:"creances",        groupe:"g67",  label:"Créances irrécouvrables",                       type:"variable", montantFixe:0 },
  // 9. Dotations aux amortissements — 68
  { id:"amort_cuisine",   groupe:"g68",  label:"Amortissement matériel de cuisine",             type:"fixe",     montantFixe:0 },
  { id:"amort_vehicule",  groupe:"g68",  label:"Amortissement véhicule frigorifique",           type:"fixe",     montantFixe:0 },
  { id:"amort_equip",     groupe:"g68",  label:"Amortissement autres équipements",              type:"fixe",     montantFixe:0 },
  { id:"amort_info",      groupe:"g68",  label:"Amortissement matériel informatique / caisses", type:"fixe",     montantFixe:0 },
  // À classer
  { id:"autre",           groupe:"g0",   label:"À classer",                                     type:"variable", montantFixe:0 },
];
const DEFAULT_LABO_CATS = DEFAULT_COMPTA_CATS;
const DEFAULT_PDV_CATS = DEFAULT_COMPTA_CATS;
const DEFAULT_PAIEMENTS = [
  { id:"cb",      label:"Carte bancaire" },
  { id:"especes", label:"Espèces" },
  { id:"ticket",  label:"Tickets resto" },
];
// Patrons gérés via Supabase (table patrons)

// ─── PERSISTANCE (Supabase + cache local) ────────────────────────────────────
const uid = () => "u"+Math.random().toString(36).slice(2,8);

// Cache local instantané (pour affichage immédiat pendant le chargement réseau)
function loadCache(){ try{ const d=localStorage.getItem("gk8_cache"); return d?JSON.parse(d):null; }catch{ return null; } }
function saveCache(d){ try{ localStorage.setItem("gk8_cache",JSON.stringify(d)); }catch{} }

function todayKey(){ const d=new Date(); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function moisKey(d=new Date()){ return `${d.getFullYear()}-${d.getMonth()}`; }

function initMois(){
  return { laboCh:{}, pdv:Object.fromEntries(PDV_LIST.map(p=>[p.id,{ca:0,vars:{},clotures:[]}])) };
}
// Garantit que tous les points de vente existent dans un objet "mois", même si
// les données stockées (Supabase ou anciennes versions) en manquaient certains.
function fillPdvKeys(moisObj){
  const pdv = {...(moisObj.pdv||{})};
  PDV_LIST.forEach(p=>{
    if(!pdv[p.id]) pdv[p.id] = {ca:0,vars:{},clotures:[]};
  });
  if(!pdv.evenementiel) pdv.evenementiel = {ca:0, encaissements:[]};
  if(!pdv._depenses) pdv._depenses = [];
  if(!pdv._rapprochements) pdv._rapprochements = [];
  return {...moisObj, laboCh: moisObj.laboCh||{}, pdv};
}
function initLocal(){
  const key=moisKey();
  return {
    laboCats: DEFAULT_LABO_CATS.map(c=>({...c})),
    pdvCats:  Object.fromEntries(PDV_LIST.map(p=>[p.id, DEFAULT_PDV_CATS.map(c=>({...c}))])),
    paiements: DEFAULT_PAIEMENTS.map(p=>({...p})),
    vendeurs: [],
    objectifsSectoriels: JSON.parse(JSON.stringify(REFERENCES_SECTORIELLES_DEFAUT)),
    active: key,
    mois: { [key]: initMois() }
  };
}
function ensureMois(data, key){
  if(data.mois[key]) return {...data, mois:{...data.mois,[key]:fillPdvKeys(data.mois[key])}};
  return {...data, mois:{...data.mois,[key]:initMois()}};
}

// Réconcilie les dépenses du journal (_depenses) avec les vars des PDV
// Utile si des dépenses ont été loggées mais pas correctement appliquées aux vars
function reconcilierDepenses(moisObj){
  const depenses = moisObj.pdv._depenses || [];
  if(depenses.length===0) return moisObj;
  return moisObj;
}
// Migration vers le plan comptable (catégories/sous-catégories).
const MIGRATION_RENAME = {
  matieres:  ["Denrées alimentaires","g601"],
  packaging: ["Emballages / contenants / vaisselle jetable","g601"],
  fourni:    ["Petit matériel consommable","g601"],
  eau:       ["Eau","g606"],
  elec:      ["Électricité","g606"],
  gaz:       ["Gaz","g606"],
  loyer:     ["Loyers","g61"],
  sal:       ["Salaires bruts (permanents)","g64"],
  cs:        ["Charges sociales patronales","g64"],
  carburant: ["Déplacements inter-sites (essence, péages, parking)","g62"],
  transport: ["Déplacements inter-sites (essence, péages, parking)","g62"],
  frais_cb:  ["Frais bancaires (tenue de compte, TPE)","g62"],
  droits:    ["Autres taxes locales (enseigne, domaine public)","g63"],
  autre:     ["À classer","g0"],
};
function upgradeCatList(list){
  let cats = (list||[]).map(c=>{
    const r = MIGRATION_RENAME[c.id];
    return r ? {...c, label:r[0], groupe:r[1]} : c;
  });
  DEFAULT_COMPTA_CATS.forEach(dc=>{
    if(!cats.find(c=>c.id===dc.id || c.label===dc.label)) cats.push({...dc});
  });
  return cats;
}
function migrateLaboCats(data){
  if(data.catsVersion===2){
    let pdvCats = {...data.pdvCats}; let changed=false;
    PDV_LIST.forEach(p=>{
      if(!pdvCats[p.id]){ pdvCats[p.id]=DEFAULT_COMPTA_CATS.map(c=>({...c})); changed=true; }
    });
    return changed ? {...data, pdvCats} : data;
  }
  const laboCats = upgradeCatList(data.laboCats);
  const pdvCats = {...data.pdvCats};
  PDV_LIST.forEach(p=>{ pdvCats[p.id] = upgradeCatList(data.pdvCats?.[p.id]); });
  return {...data, laboCats, pdvCats, catsVersion:2};
}

// Charge toutes les données depuis Supabase (app_data + tous les mois_data)
async function loadFromSupabase(){
  try{
    const { data: appRow, error: e1 } = await supabase.from("app_data").select("*").eq("id","main").maybeSingle();
    if(e1) { console.error("Supabase load error (app_data):", e1); return { data:null, error:e1.message||"Erreur de connexion" }; }
    if(!appRow) return { data:null, error:null }; // pas d'erreur réseau, juste pas encore de données (première utilisation)
    const { data: moisRows, error: e2 } = await supabase.from("mois_data").select("*");
    if(e2) { console.error("Supabase load error (mois_data):", e2); return { data:null, error:e2.message||"Erreur de connexion" }; }
    const mois = {};
    (moisRows||[]).forEach(r=>{ mois[r.mois_key] = fillPdvKeys({ laboCh: r.labo_ch||{}, pdv: r.pdv||{} }); });
    const key = appRow.active_mois || moisKey();
    let result = {
      laboCats: appRow.labo_cats?.length ? appRow.labo_cats : DEFAULT_LABO_CATS.map(c=>({...c})),
      pdvCats: Object.keys(appRow.pdv_cats||{}).length ? appRow.pdv_cats : Object.fromEntries(PDV_LIST.map(p=>[p.id, DEFAULT_PDV_CATS.map(c=>({...c}))])),
      paiements: appRow.paiements?.length ? appRow.paiements : DEFAULT_PAIEMENTS.map(p=>({...p})),
      vendeurs: appRow.vendeurs || [],
      // Objectifs personnalisés de comparaison sectorielle (onglet "Mes objectifs").
      // Repli sur les valeurs par défaut si absent (première utilisation, ou
      // colonne objectifs_sectoriels pas encore créée côté Supabase).
      objectifsSectoriels: (appRow.objectifs_sectoriels && Object.keys(appRow.objectifs_sectoriels).length)
        ? appRow.objectifs_sectoriels
        : JSON.parse(JSON.stringify(REFERENCES_SECTORIELLES_DEFAUT)),
      active: key,
      mois: Object.keys(mois).length ? mois : { [key]: initMois() }
    };
    result = ensureMois(result, key);
    return { data:result, error:null };
  }catch(err){ console.error("Supabase load error:", err); return { data:null, error: err?.message || "Erreur réseau inattendue" }; }
}

// Sauvegarde app_data (config globale) — debounced côté appelant
async function saveAppDataToSupabase(data){
  try{
    const { error } = await supabase.from("app_data").upsert({
      id: "main",
      labo_cats: data.laboCats,
      pdv_cats: data.pdvCats,
      paiements: data.paiements,
      vendeurs: data.vendeurs,
      objectifs_sectoriels: data.objectifsSectoriels || REFERENCES_SECTORIELLES_DEFAUT,
      active_mois: data.active,
      updated_at: new Date().toISOString()
    });
    if(error){ console.error("Supabase save app_data error:", error); return { success:false, error: error.message||"Erreur de sauvegarde" }; }
    return { success:true, error:null };
  }catch(err){ console.error("Supabase save app_data error:", err); return { success:false, error: err?.message || "Erreur réseau inattendue" }; }
}

// Sauvegarde un mois précis
async function saveMoisToSupabase(key, moisObj){
  try{
    const { error } = await supabase.from("mois_data").upsert({
      mois_key: key,
      labo_ch: moisObj.laboCh,
      pdv: moisObj.pdv,
      updated_at: new Date().toISOString()
    });
    if(error){ console.error("Supabase save mois_data error:", error); return { success:false, error: error.message||"Erreur de sauvegarde" }; }
    return { success:true, error:null };
  }catch(err){ console.error("Supabase save mois_data error:", err); return { success:false, error: err?.message || "Erreur réseau inattendue" }; }
}

// ─── ÉCRITURE SÉCURISÉE (anti-écrasement) ─────────────────────────────────────
// Point d'entrée UNIQUE pour toute modification des données de l'app.
// Principe : on ne modifie JAMAIS le state React local directement dans Supabase.
// On recharge toujours la version la plus fraîche depuis Supabase juste avant
// d'écrire, on applique la modification demandée par-dessus cette version
// fraîche, puis on sauvegarde. Ça élimine toute la classe de bugs où deux
// écritures concurrentes (deux onglets, un vendeur + un patron, un import CSV
// en cours...) s'écrasent l'une l'autre au lieu de se cumuler.
//
// conflictNotifier (optionnel) : callback appelé si on détecte que la donnée
// en base avait changé depuis le dernier chargement connu du state local —
// utile pour informer l'utilisateur plutôt que de silencieusement écraser.
let lastKnownRemoteSnapshot = null; // pour détection de conflit (best-effort)

async function safeWriteMois(currentData, key, mutatorFn, conflictNotifier, errorNotifier){
  const { data: remote, error: loadErr } = await loadFromSupabase();
  if(loadErr && errorNotifier){
    errorNotifier(`Impossible de vérifier les dernières données avant d'écrire (${loadErr}). Réessayez dans quelques instants — rien n'a été perdu localement.`);
  }
  const freshData = remote ? migrateLaboCats(remote) : currentData;
  const freshMois = fillPdvKeys(freshData.mois[key] || initMois());

  // Détection de conflit best-effort : si le mois distant existait déjà dans
  // notre state local ET diffère de ce qu'on avait en mémoire, quelqu'un
  // d'autre a écrit entre-temps.
  if(conflictNotifier && currentData.mois[key]){
    const localSerialized = JSON.stringify(fillPdvKeys(currentData.mois[key]));
    const remoteSerialized = JSON.stringify(freshMois);
    if(localSerialized !== remoteSerialized){
      conflictNotifier();
    }
  }

  const newMois = mutatorFn(freshMois);
  const { success, error: saveErr } = await saveMoisToSupabase(key, newMois);
  const newData = {...freshData, mois:{...freshData.mois, [key]:newMois}};
  saveCache(newData); // toujours sauvegardé en local, même si l'écriture distante échoue
  if(!success && errorNotifier){
    errorNotifier(`⚠️ La sauvegarde en ligne a échoué (${saveErr}). Votre saisie est conservée localement sur cet appareil — reconnectez-vous puis ressaisissez cette action pour la synchroniser, ou contactez le support si le problème persiste.`);
  }
  return newData;
}

// Variante pour les données globales (app_data) : catégories, vendeurs, paiements...
async function safeWriteAppData(currentData, mutatorFn, conflictNotifier, errorNotifier){
  const { data: remote, error: loadErr } = await loadFromSupabase();
  if(loadErr && errorNotifier){
    errorNotifier(`Impossible de vérifier les dernières données avant d'écrire (${loadErr}). Réessayez dans quelques instants — rien n'a été perdu localement.`);
  }
  const freshData = remote ? migrateLaboCats(remote) : currentData;

  if(conflictNotifier){
    const localSerialized = JSON.stringify({laboCats:currentData.laboCats,pdvCats:currentData.pdvCats,paiements:currentData.paiements,vendeurs:currentData.vendeurs});
    const remoteSerialized = JSON.stringify({laboCats:freshData.laboCats,pdvCats:freshData.pdvCats,paiements:freshData.paiements,vendeurs:freshData.vendeurs});
    if(localSerialized !== remoteSerialized){
      conflictNotifier();
    }
  }

  const newData = mutatorFn(freshData);
  const { success, error: saveErr } = await saveAppDataToSupabase(newData);
  saveCache(newData);
  if(!success && errorNotifier){
    errorNotifier(`⚠️ La sauvegarde en ligne a échoué (${saveErr}). Votre modification est conservée localement sur cet appareil — reconnectez-vous puis ressaisissez cette action pour la synchroniser, ou contactez le support si le problème persiste.`);
  }
  return newData;
}

// ─── IMPORT CSV — parsing, règles, classification ─────────────────────────────
async function loadImportRules(){
  try{
    const { data, error } = await supabase.from("import_rules").select("*");
    if(error) return {};
    const map={};
    (data||[]).forEach(r=>{ map[r.keyword]=r.target; });
    return map;
  }catch{ return {}; }
}
async function saveImportRule(keyword, target){
  try{ await supabase.from("import_rules").upsert({ keyword, target, updated_at:new Date().toISOString() }); }
  catch(err){ console.error("save rule error",err); }
}

// Parse CSV CIC : DateOp;DateVal;Debit;Credit;Libelle;Solde
function parseCicCsv(text){
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const rows=[];
  for(const line of lines){
    const parts=line.split(";");
    if(parts.length<5) continue;
    const [dateOp,dateVal,debit,credit,libelle,solde] = parts;
    if(!/^\d{2}\/\d{2}\/\d{4}$/.test(dateOp)) continue;
    const montantDebit = debit ? Math.abs(n(debit.replace(",","."))) : 0;
    const montantCredit = credit ? Math.abs(n(credit.replace(",","."))) : 0;
    // Le solde n'est pas toujours présent sur chaque ligne selon l'export CIC ;
    // on ne le garde que s'il ressemble à un nombre valide.
    const soldeStr = (solde||"").trim();
    const montantSolde = soldeStr && /^-?[\d\s]+([.,]\d+)?$/.test(soldeStr) ? n(soldeStr.replace(/\s/g,"").replace(",",".")) : null;
    rows.push({
      id: uid(),
      dateOp, dateVal,
      libelle: (libelle||"").trim(),
      debit: montantDebit,
      credit: montantCredit,
      solde: montantSolde,
    });
  }
  return rows;
}

// Extrait un mot-clé simplifié depuis le libellé + détecte le type de ligne
function extractKeyword(libelle){
  const isComCB = /^COMCB/i.test(libelle);
  const isRemCB = /^REMCB/i.test(libelle);
  const isSumUp = /SUMUP/i.test(libelle);
  const isDepotEspeces = /VERSEMENT|REMISE NUM/i.test(libelle);
  const isPrlv = /^PRLV/i.test(libelle);
  const isPaiementCB = /PAIEMENT CB|PAIEMENT PSC/i.test(libelle);
  const isCheque = /^CHEQUE/i.test(libelle);
  const isVir = /^VIR /i.test(libelle);
  let clean = libelle
    .replace(/COMCB\d+|REMCB\d+|NB\d+|TPE\d+|CARTE\s?\d+|PSC\s?\d+|CB\s?\d{4}|FAC\sDU.*|RL-[\dA-Z-]+|SIRET\s?\d+|G\d{6,}/gi," ")
    .replace(/\s{2,}/g," ").trim();
  return { isComCB, isRemCB, isSumUp, isDepotEspeces, isPrlv, isPaiementCB, isCheque, isVir, clean };
}

function findRuleMatch(clean, rules){
  const upper=clean.toUpperCase();
  let best=null, bestLen=0;
  for(const kw of Object.keys(rules)){
    if(upper.includes(kw.toUpperCase()) && kw.length>bestLen){ best=kw; bestLen=kw.length; }
  }
  return best ? rules[best] : null;
}

// Calcule les mois cibles pour un lissage donné, à partir d'un mois de départ
function moisLissage(startKey, count){
  const [a,m] = startKey.split("-").map(Number);
  const keys=[];
  for(let i=0;i<count;i++){
    let mm=m+i, aa=a;
    while(mm>11){ mm-=12; aa++; }
    keys.push(`${aa}-${mm}`);
  }
  return keys;
}

// ─── DÉTECTION DES DOUBLONS D'IMPORT ──────────────────────────────────────────
function hashRow(row){
  return `${row.dateOp}|${row.libelle}|${row.debit.toFixed(2)}|${row.credit.toFixed(2)}`;
}
// Retourne un Map hash -> solde (quand connu) pour les lignes déjà importées.
// Utilisé à la fois pour exclure les doublons ET pour retrouver, en cas de
// chevauchement entre deux imports, le solde bancaire juste avant la première
// ligne réellement NOUVELLE de cet import — indispensable pour que la
// Vérification A ne se déclenche pas à tort à cause du chevauchement.
async function checkDuplicateHashes(rows){
  try{
    const hashes = rows.map(hashRow);
    const dup = new Map(); // hash -> solde connu (ou null si non stocké)
    for(let i=0;i<hashes.length;i+=200){
      const batch = hashes.slice(i,i+200);
      const { data, error } = await supabase.from("imported_lines").select("hash, solde").in("hash", batch);
      if(!error && data) data.forEach(d=>dup.set(d.hash, d.solde ?? null));
    }
    return dup;
  }catch(err){ console.error("check duplicates error",err); return new Map(); }
}
async function markRowsImported(rows){
  try{
    const records = rows.map(r=>({ hash: hashRow(r), applied_at: new Date().toISOString(), solde: r.solde ?? null }));
    for(let i=0;i<records.length;i+=200){
      await supabase.from("imported_lines").upsert(records.slice(i,i+200));
    }
  }catch(err){ console.error("mark imported error",err); }
}

// ─── RAPPROCHEMENT BANCAIRE ────────────────────────────────────────────────────
// Deux vérifications complémentaires, faites sur les données BRUTES du CSV
// (avant tout classement manuel) :
//
// A) Le solde : on additionne les mouvements du fichier et on vérifie qu'on
//    retombe sur le solde de fin annoncé par la banque. Ça confirme que le
//    fichier a été lu en entier et sans erreur — indépendamment de la façon
//    dont chaque ligne a ensuite été catégorisée.
//
//    Point important : quand un import chevauche partiellement un import
//    précédent (cas courant et volontaire, pour ne rien louper), les lignes
//    en doublon ne doivent PAS être comptées une seconde fois dans le calcul.
//    On se sert du solde déjà connu (stocké lors du import précédent, table
//    imported_lines) de la DERNIÈRE ligne doublon comme point de départ fiable
//    du calcul, et on n'additionne ensuite que les lignes réellement
//    NOUVELLES de cet import. Si aucune ligne doublon n'a de solde connu (premier
//    import, ou chevauchement total), on retombe sur la première ligne du
//    fichier comme avant.
//
// B) L'exhaustivité : on vérifie qu'aucun crédit inhabituel (un encaissement
//    qui n'est ni un règlement CB/SumUp/dépôt espèces déjà couvert par les
//    clôtures) n'est resté sans classement — car ce type de ligne doit
//    toujours attirer l'attention du patron (remboursement fournisseur, etc.)
//
// `duplicateMap` : Map hash -> solde connu, retournée par checkDuplicateHashes.
// `allRows` : TOUTES les lignes lues du fichier (avant exclusion des doublons),
//             dans l'ordre chronologique du CSV — nécessaire pour retrouver la
//             frontière entre "déjà connu" et "nouveau".
function calculerRapprochement(allRows, duplicateMap, pending){
  const rowsAvecSolde = allRows.filter(r=>r.solde!==null && r.solde!==undefined);
  let verifSolde = null;

  if(rowsAvecSolde.length>=1){
    // On cherche la DERNIÈRE ligne (dans l'ordre du fichier) qui est à la
    // fois un doublon connu ET dont le solde stocké est disponible : c'est
    // notre point de départ fiable, juste avant la zone réellement nouvelle.
    let pointDepart = null; // { solde, index }
    rowsAvecSolde.forEach((r,idx)=>{
      const isDup = duplicateMap.has(hashRow(r));
      const soldeConnu = duplicateMap.get(hashRow(r));
      if(isDup && soldeConnu!==null && soldeConnu!==undefined){
        pointDepart = { solde: soldeConnu, index: idx };
      }
    });

    let soldeDepart, ligneDepartIdx;
    if(pointDepart){
      // On repart du solde connu de la dernière ligne doublon, et on
      // n'additionne que les lignes qui suivent (les nouvelles).
      soldeDepart = pointDepart.solde;
      ligneDepartIdx = pointDepart.index + 1;
    } else {
      // Pas de doublon avec solde connu (premier import, ou aucune ligne
      // chevauchante) : on repart comme avant, de la première ligne du fichier.
      const premiere = rowsAvecSolde[0];
      soldeDepart = premiere.solde - premiere.credit + premiere.debit;
      ligneDepartIdx = 0;
    }

    const derniere = rowsAvecSolde[rowsAvecSolde.length-1];
    const rowsAConsiderer = rowsAvecSolde.slice(ligneDepartIdx);
    const totalMouvements = rowsAConsiderer.reduce((s,r)=>s + r.credit - r.debit, 0);
    const soldeTheorique = soldeDepart + totalMouvements;
    const soldeAnnonce = derniere.solde;
    const ecart = Math.round((soldeTheorique - soldeAnnonce) * 100) / 100;
    verifSolde = {
      possible: true,
      soldeDepart, soldeTheorique, soldeAnnonce, ecart,
      coherent: Math.abs(ecart) < 0.01,
      chevauchementDetecte: !!pointDepart,
      nbLignesExclues: pointDepart ? pointDepart.index+1 : 0,
    };
  } else {
    verifSolde = { possible:false };
  }

  // Vérification B — exhaustivité des crédits inhabituels
  // On exclut les crédits déjà couverts par les clôtures (REMCB, SumUp,
  // dépôts d'espèces) : ceux-là sont normaux et ne doivent jamais remonter
  // ici. Seuls les AUTRES crédits (remboursements fournisseurs, etc.) sans
  // classement choisi comptent comme "à vérifier". On ne regarde que les
  // lignes non-doublons (celles réellement soumises au classement).
  const rowsNonDoublons = allRows.filter(r=>!duplicateMap.has(hashRow(r)));
  const creditsInhabituelsNonClasses = rowsNonDoublons.filter(r=>{
    if(r.credit<=0) return false;
    const k = extractKeyword(r.libelle);
    if(k.isRemCB || k.isSumUp || k.isDepotEspeces) return false;
    const choix = pending[r.id];
    return !choix || choix.type==="ignore";
  });

  return { verifSolde, creditsInhabituelsNonClasses };
}

// ─── AUTHENTIFICATION PATRONS (via fonctions sécurisées Supabase) ────────────
async function loginPatron(password){
  try{
    const { data, error } = await supabase.rpc("verify_patron_password", {
      input_password: password
    });
    if(error || !data || data.length===0) return null;
    const patron = data[0];
    await supabase.from("patrons").update({ last_login: new Date().toISOString() }).eq("id", patron.id);
    return patron;
  }catch(err){ console.error("login patron error",err); return null; }
}

async function updatePatronPassword(patronId, newPassword){
  try{
    const { data, error } = await supabase.rpc("update_patron_password", {
      patron_id: patronId,
      new_password: newPassword
    });
    if(error) return false;
    return true;
  }catch(err){ console.error("update password error",err); return false; }
}


// ─── CALCULS ──────────────────────────────────────────────────────────────────
const n = v => parseFloat(v)||0;
function montantCat(cat, vars){ 
  return cat.type==="fixe" 
    ? n(cat.montantFixe) + n(vars?.[cat.id])
    : n(vars?.[cat.id]); 
}
function totalLabo(cats, ch){ return cats.reduce((s,c)=>s+montantCat(c,ch),0); }
function totalDirect(cats, vars){ return cats.reduce((s,c)=>s+montantCat(c,vars),0); }
function repartition(moisPdv){
  const tCA=PDV_LIST.reduce((s,p)=>s+n(moisPdv[p.id]?.ca),0);
  return PDV_LIST.reduce((acc,p)=>{
    const pCA=tCA>0?n(moisPdv[p.id]?.ca)/tCA:1/PDV_LIST.length;
    acc[p.id]=(0.5*pCA+0.5*p.j/TOTAL_J)*100; return acc;
  },{});
}
function calcPDV(pdvMois, pdvCats, pct, tLabo){
  const ca=n(pdvMois.ca), dir=totalDirect(pdvCats,pdvMois.vars);
  const ql=tLabo*(pct/100), res=ca-dir-ql;
  return {ca,dir,ql,res,pctNet:ca>0?res/ca*100:0,seuil:dir+ql};
}

// CA mensuel = somme des clôtures du mois
function caDepuisClotures(clotures=[]){
  return clotures.reduce((s,cl)=>s+cl.modes.reduce((a,m)=>a+n(m.montant),0),0);
}

// ─── OUTILS DE PILOTAGE (identification des postes de charge dominants) ──────

// Total des charges directes cumulées sur tous les PDV pour un mois donné.
function totalChargesDirectesPDV(moisPdv, pdvCats){
  return PDV_LIST.reduce((s,p)=>s + totalDirect(pdvCats[p.id]||[], moisPdv[p.id]?.vars), 0);
}

// Calcule, pour un mois donné, le montant de CHAQUE sous-catégorie de charge
// (labo + tous les PDV confondus), en les regroupant par label pour que
// "Loyers" du labo et "Loyers" d'un PDV comptent ensemble s'ils portent le
// même nom — sinon on distingue par "label (source)".
function ventilationCharges(data, moisObj){
  const map = {}; // clé -> { label, montant, groupe }
  const addTo = (key, label, montant, groupe) => {
    if(!map[key]) map[key] = { label, montant:0, groupe };
    map[key].montant += montant;
  };
  // Labo
  (data.laboCats||[]).forEach(cat=>{
    const montant = montantCat(cat, moisObj.laboCh);
    if(montant>0) addTo(`labo:${cat.id}`, `${cat.label} (Labo)`, montant, cat.groupe);
  });
  // Chaque PDV
  PDV_LIST.forEach(p=>{
    const cats = data.pdvCats[p.id]||[];
    cats.forEach(cat=>{
      const montant = montantCat(cat, moisObj.pdv[p.id]?.vars);
      if(montant>0) addTo(`${p.id}:${cat.id}`, `${cat.label} (${p.nom})`, montant, cat.groupe);
    });
  });
  return map;
}

// Calcule le Top N des charges du mois actif, avec comparaison à la moyenne
// des `histCount` mois précédents pour détecter les postes en dérive.
function topCharges(data, moisActif, moisKeyActif, topN=8, histCount=3){
  const current = ventilationCharges(data, moisActif);

  // Moyenne des mois précédents disponibles (jusqu'à histCount mois)
  const [a,m] = moisKeyActif.split("-").map(Number);
  const prevKeys = [];
  for(let i=1;i<=histCount;i++){
    let mm=m-i, aa=a;
    while(mm<0){ mm+=12; aa--; }
    prevKeys.push(`${aa}-${mm}`);
  }
  const histMoisList = prevKeys.map(k=>data.mois[k]).filter(Boolean).map(fillPdvKeys);
  const histVentilations = histMoisList.map(hm=>ventilationCharges(data, hm));

  const rows = Object.entries(current).map(([key,{label,montant,groupe}])=>{
    const histValues = histVentilations.map(v=>v[key]?.montant||0);
    const histAvg = histValues.length>0 ? histValues.reduce((s,v)=>s+v,0)/histValues.length : null;
    let ecartPct = null;
    if(histAvg!==null && histAvg>0){
      ecartPct = ((montant-histAvg)/histAvg)*100;
    }
    return { key, label, montant, groupe, histAvg, ecartPct, isAnomalie: ecartPct!==null && ecartPct>=50 };
  });

  rows.sort((r1,r2)=>r2.montant-r1.montant);
  return rows.slice(0, topN);
}

// ─── COMPARAISON SECTORIELLE ──────────────────────────────────────────────────
// Pour chaque groupe comptable, calcule le montant réel du mois (labo + tous
// les PDV confondus), son % du CA, et le compare à la fourchette de référence
// sectorielle (REFERENCES_SECTORIELLES_DEFAUT, ou objectifs personnalisés si définis). Ajoute aussi le prime cost (matières
// + personnel) et la marge nette, deux indicateurs de synthèse.
// Statut retourné pour chaque ligne : "bon" (dans la fourchette ou en-dessous
// du max, sauf marge nette où c'est l'inverse), "attention" (léger dépassement,
// jusqu'à +20% du max), "alerte" (dépassement important).
function comparaisonSectorielle(data, moisObj, tCA){
  if(tCA<=0) return [];
  const refs = data.objectifsSectoriels || REFERENCES_SECTORIELLES_DEFAUT;

  // Montant réel par groupe comptable = labo + tous les PDV
  const parGroupe = {};
  GROUPES_COMPTA.forEach(g=>{ parGroupe[g.id]=0; });
  (data.laboCats||[]).forEach(cat=>{ parGroupe[cat.groupe] = (parGroupe[cat.groupe]||0) + montantCat(cat, moisObj.laboCh); });
  PDV_LIST.forEach(p=>{
    (data.pdvCats[p.id]||[]).forEach(cat=>{ parGroupe[cat.groupe] = (parGroupe[cat.groupe]||0) + montantCat(cat, moisObj.pdv[p.id]?.vars); });
  });

  const evalStatut = (pct, ref, inverse=false) => {
    if(inverse){
      // Pour la marge nette : en-dessous du min = problème, au-dessus = bon
      if(pct>=ref.min) return "bon";
      if(pct>=ref.min*0.7) return "attention";
      return "alerte";
    }
    if(pct<=ref.max) return "bon";
    if(pct<=ref.max*1.2) return "attention";
    return "alerte";
  };

  const rows = Object.keys(refs)
    .filter(k=>k!=="primeCost" && k!=="margeNette")
    .map(groupeId=>{
      const ref = refs[groupeId];
      const montant = parGroupe[groupeId]||0;
      const pct = (montant/tCA)*100;
      return { key:groupeId, label:ref.label, montant, pct, ref, statut: evalStatut(pct, ref) };
    });

  // Prime cost = matières premières (g601) + personnel (g64)
  const primeCostMontant = (parGroupe.g601||0) + (parGroupe.g64||0);
  const primeCostPct = (primeCostMontant/tCA)*100;
  rows.push({
    key:"primeCost", label:refs.primeCost.label, montant:primeCostMontant, pct:primeCostPct,
    ref:refs.primeCost, statut: evalStatut(primeCostPct, refs.primeCost), isSynthese:true
  });

  return rows;
}

// ─── EXPORT MENSUEL (CSV / PDF) ────────────────────────────────────────────────
// Assemble toutes les données d'un mois donné (charges détaillées par
// sous-catégorie labo + chaque PDV, encaissements par PDV et mode de
// paiement, événementiel, dépenses manuelles) avec leur % du CA, pour
// analyse. Reprend simplement les montants déjà lissés tels que stockés
// (le lissage éventuel a déjà été appliqué au moment de l'import CSV).
function assemblerDonneesExport(data, moisObj, moisLabel){
  const rep = repartition(moisObj.pdv);
  const tL = totalLabo(data.laboCats, moisObj.laboCh);
  const pdvCalc = PDV_LIST.map(p=>({...p, c: calcPDV(moisObj.pdv[p.id], data.pdvCats[p.id], rep[p.id], tL)}));
  const caEvenementiel = n(moisObj.pdv.evenementiel?.ca);
  const tCA = pdvCalc.reduce((s,p)=>s+p.c.ca,0) + caEvenementiel;

  // 1. Charges détaillées par sous-catégorie (labo + chaque PDV), avec % du CA,
  // regroupées et triées par GROUPE COMPTABLE (1. Matières premières → 9.
  // Amortissements) plutôt que par montant — pour une lecture structurée,
  // cohérente avec le plan comptable déjà utilisé partout ailleurs dans l'app.
  const ventilation = ventilationCharges(data, moisObj);
  const chargesBrutes = Object.values(ventilation).map(c=>({...c, pctCA: tCA>0 ? (c.montant/tCA)*100 : 0}));
  const totalCharges = chargesBrutes.reduce((s,c)=>s+c.montant,0);

  const groupesCharges = GROUPES_COMPTA.map(g=>{
    const items = chargesBrutes.filter(c=>c.groupe===g.id).sort((a,b)=>b.montant-a.montant);
    const totalGroupe = items.reduce((s,c)=>s+c.montant,0);
    return { groupeId:g.id, groupeLabel:g.label, items, totalGroupe, pctCA: tCA>0?(totalGroupe/tCA)*100:0 };
  }).filter(g=>g.items.length>0);
  // Sous-catégories personnalisées sans groupe reconnu, en dernier
  const chargesSansGroupe = chargesBrutes.filter(c=>!GROUPES_COMPTA.find(g=>g.id===c.groupe));
  if(chargesSansGroupe.length>0){
    const totalGroupe = chargesSansGroupe.reduce((s,c)=>s+c.montant,0);
    groupesCharges.push({ groupeId:"autre", groupeLabel:"Autres / personnalisées", items:chargesSansGroupe, totalGroupe, pctCA: tCA>0?(totalGroupe/tCA)*100:0 });
  }

  // 2. Encaissements par PDV et par mode de paiement
  const encaissementsParPdv = PDV_LIST.map(p=>{
    const clotures = moisObj.pdv[p.id]?.clotures||[];
    const parMode = {};
    clotures.forEach(cl=>cl.modes.forEach(m=>{
      const montant = n(m.montant);
      if(montant>0) parMode[m.label] = (parMode[m.label]||0)+montant;
    }));
    const total = Object.values(parMode).reduce((s,v)=>s+v,0);
    return { pdv:p.nom, total, pctCA: tCA>0?(total/tCA)*100:0, parMode };
  }).filter(e=>e.total>0);

  // 2bis. Classement des PDV par rentabilité (CA + résultat net), pour la
  // page dédiée "Détail par point de vente" de l'export — vue simple, sans
  // le détail des charges (juste CA et résultat net, comme sur le Dashboard).
  const classementPdv = [...pdvCalc]
    .sort((a,b)=>b.c.res-a.c.res)
    .map(p=>({ pdv:p.full, ca:p.c.ca, resultatNet:p.c.res, pctNet:p.c.pctNet }));

  // 3. Événementiel
  const encaissementsEvent = (moisObj.pdv.evenementiel?.encaissements||[]).map(e=>({
    date: e.dateLabel, montant: n(e.montant), mode: e.modeLabel, pctCA: tCA>0?(n(e.montant)/tCA)*100:0
  }));

  // 4. Dépenses manuelles (espèces/BL, saisies par patron ou vendeurs)
  const depensesManuelles = (moisObj.pdv._depenses||[]).map(d=>({
    date: d.dateLabel, categorie: d.catLabel, scope: d.scope==="labo"?"Labo":(d.pdvLabel||"PDV"),
    montant: n(d.montant), mode: d.modeLabel, vendeur: d.vendeurNom,
    pctCA: tCA>0?(n(d.montant)/tCA)*100:0
  }));

  // 5. Synthèse
  const totalMat = data.laboCats.filter(c=>c.groupe==="g601"||c.id==="matieres").reduce((s,c)=>s+montantCat(c,moisObj.laboCh),0);
  const tMB = tCA - totalMat;
  const totalChargesPDV = totalChargesDirectesPDV(moisObj.pdv, data.pdvCats);
  const tNet = pdvCalc.reduce((s,p)=>s+p.c.res,0) + caEvenementiel;

  return {
    moisLabel,
    tCA, tMB, totalMat, tL, totalChargesPDV, tNet, totalCharges,
    pctMB: tCA>0?(tMB/tCA)*100:0,
    pctNet: tCA>0?(tNet/tCA)*100:0,
    groupesCharges, encaissementsParPdv, classementPdv, encaissementsEvent, depensesManuelles, caEvenementiel,
  };
}

// Génère le contenu CSV (texte brut, séparateur point-virgule pour Excel FR)
function genererCsvExport(ex){
  const lignes = [];
  const nb = v => v.toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2});
  const pct = v => v.toLocaleString("fr-FR",{minimumFractionDigits:1,maximumFractionDigits:1});

  lignes.push(`Rapport mensuel — ${ex.moisLabel}`);
  lignes.push("");
  lignes.push("SYNTHÈSE");
  lignes.push("Indicateur;Montant (€);% du CA");
  lignes.push(`CA total;${nb(ex.tCA)};100,0`);
  lignes.push(`Matières premières;${nb(ex.totalMat)};${pct(ex.tCA>0?ex.totalMat/ex.tCA*100:0)}`);
  lignes.push(`Marge brute;${nb(ex.tMB)};${pct(ex.pctMB)}`);
  lignes.push(`Charges labo (total);${nb(ex.tL)};${pct(ex.tCA>0?ex.tL/ex.tCA*100:0)}`);
  lignes.push(`Charges directes PDV;${nb(ex.totalChargesPDV)};${pct(ex.tCA>0?ex.totalChargesPDV/ex.tCA*100:0)}`);
  lignes.push(`Résultat net;${nb(ex.tNet)};${pct(ex.pctNet)}`);
  lignes.push("");

  lignes.push("CHARGES DÉTAILLÉES PAR CATÉGORIE COMPTABLE (labo + tous points de vente)");
  lignes.push("Groupe / Sous-catégorie;Montant (€);% du CA");
  ex.groupesCharges.forEach(g=>{
    lignes.push(`${g.groupeLabel};${nb(g.totalGroupe)};${pct(g.pctCA)}`);
    g.items.forEach(c=>lignes.push(`  ${c.label};${nb(c.montant)};${pct(c.pctCA)}`));
  });
  lignes.push(`TOTAL CHARGES;${nb(ex.totalCharges)};${pct(ex.tCA>0?ex.totalCharges/ex.tCA*100:0)}`);
  lignes.push("");

  lignes.push("ENCAISSEMENTS PAR POINT DE VENTE");
  lignes.push("Point de vente;Total (€);% du CA;Détail par mode");
  ex.encaissementsParPdv.forEach(e=>{
    const detail = Object.entries(e.parMode).map(([m,v])=>`${m}: ${nb(v)}€`).join(" | ");
    lignes.push(`${e.pdv};${nb(e.total)};${pct(e.pctCA)};"${detail}"`);
  });
  lignes.push("");

  if(ex.encaissementsEvent.length>0){
    lignes.push("ENCAISSEMENTS ÉVÉNEMENTIEL");
    lignes.push("Date;Montant (€);Mode;% du CA");
    ex.encaissementsEvent.forEach(e=>lignes.push(`${e.date};${nb(e.montant)};${e.mode};${pct(e.pctCA)}`));
    lignes.push("");
  }

  if(ex.depensesManuelles.length>0){
    lignes.push("DÉPENSES MANUELLES (espèces / BL)");
    lignes.push("Date;Catégorie;Affecté à;Montant (€);Mode;Saisi par;% du CA");
    ex.depensesManuelles.forEach(d=>lignes.push(`${d.date};${d.categorie};${d.scope};${nb(d.montant)};${d.mode};${d.vendeur};${pct(d.pctCA)}`));
    lignes.push("");
  }

  lignes.push("DÉTAIL PAR POINT DE VENTE (classé du plus au moins rentable)");
  lignes.push("Point de vente;CA (€);Résultat net (€);% net");
  ex.classementPdv.forEach(p=>lignes.push(`${p.pdv};${nb(p.ca)};${nb(p.resultatNet)};${pct(p.pctNet)}`));

  return lignes.join("\n");
}

// Génère le PDF via impression navigateur : on ouvre une page HTML mise en
// forme dans un nouvel onglet, puis on déclenche window.print() — l'utilisateur
// choisit "Enregistrer en PDF" dans la boîte de dialogue d'impression. Cette
// approche ne nécessite aucune librairie externe, ce qui la rend fiable sur un
// déploiement statique GitHub Pages (pas de dépendance à un CDN qui pourrait
// être indisponible).
function genererPdfExport(ex){
  const nb = v => v.toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2})+" €";
  const pct = v => v.toLocaleString("fr-FR",{minimumFractionDigits:1,maximumFractionDigits:1})+"%";

  const blocGroupeCharge = g => `
    <tr class="groupe-row"><td colspan="2">${g.groupeLabel}</td><td class="num">${nb(g.totalGroupe)}</td><td class="num">${pct(g.pctCA)}</td></tr>
    ${g.items.map(c=>`<tr><td class="indent">${c.label}</td><td></td><td class="num muted">${nb(c.montant)}</td><td class="num muted">${pct(c.pctCA)}</td></tr>`).join("")}
  `;
  const lignePdv = e => {
    const detail = Object.entries(e.parMode).map(([m,v])=>`${m}: ${nb(v)}`).join(" · ");
    return `<tr><td>${e.pdv}</td><td class="num">${nb(e.total)}</td><td class="num">${pct(e.pctCA)}</td><td class="muted small">${detail}</td></tr>`;
  };
  const ligneClassementPdv = (p,i) => `<tr><td>#${i+1}</td><td>${p.pdv}</td><td class="num">${nb(p.ca)}</td><td class="num" style="color:${p.resultatNet>=0?'#2d6a4f':'#c1121f'}">${nb(p.resultatNet)}</td><td class="num">${pct(p.pctNet)}</td></tr>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Rapport ${ex.moisLabel}</title>
<style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;color:#212529;padding:32px;max-width:900px;margin:0 auto;}
  h1{font-size:20px;margin-bottom:2px;}
  h2{font-size:14px;margin:24px 0 8px;padding-bottom:6px;border-bottom:2px solid #2d6a4f;color:#2d6a4f;}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px;}
  th{text-align:left;background:#f8f9fa;padding:6px 8px;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#6c757d;border-bottom:1px solid #e9ecef;}
  td{padding:5px 8px;border-bottom:1px solid #f0f0f0;}
  td.indent{padding-left:20px;}
  .num{text-align:right;font-weight:600;}
  .muted{color:#6c757d;font-weight:400;}
  .small{font-size:10px;}
  .synthese{display:flex;gap:16px;flex-wrap:wrap;margin:16px 0;}
  .kpi{flex:1;min-width:140px;background:#f8f9fa;border-radius:8px;padding:12px;}
  .kpi .label{font-size:10px;text-transform:uppercase;color:#6c757d;margin-bottom:4px;}
  .kpi .val{font-size:18px;font-weight:700;color:#2d6a4f;}
  .total-row{font-weight:700;background:#f8f9fa;}
  .groupe-row{font-weight:700;background:#f1f6f3;}
  .page-break{page-break-before:always;}
  @media print{ body{padding:0;} }
</style></head><body>
  <h1>🫒 Rapport mensuel — ${ex.moisLabel}</h1>
  <div class="muted small">Généré le ${new Date().toLocaleDateString("fr-FR")} · Page 1/2</div>

  <h2>Synthèse</h2>
  <div class="synthese">
    <div class="kpi"><div class="label">CA total</div><div class="val">${nb(ex.tCA)}</div></div>
    <div class="kpi"><div class="label">Marge brute</div><div class="val">${pct(ex.pctMB)}</div></div>
    <div class="kpi"><div class="label">Charges labo</div><div class="val">${nb(ex.tL)}</div></div>
    <div class="kpi"><div class="label">Charges PDV</div><div class="val">${nb(ex.totalChargesPDV)}</div></div>
    <div class="kpi"><div class="label">Résultat net</div><div class="val" style="color:${ex.tNet>=0?'#2d6a4f':'#c1121f'}">${nb(ex.tNet)} (${pct(ex.pctNet)})</div></div>
  </div>

  <h2>Charges par catégorie comptable (labo + tous points de vente)</h2>
  <table>
    <tr><th>Catégorie / Sous-catégorie</th><th></th><th>Montant</th><th>% du CA</th></tr>
    ${ex.groupesCharges.map(blocGroupeCharge).join("")}
    <tr class="total-row"><td colspan="2">TOTAL CHARGES</td><td class="num">${nb(ex.totalCharges)}</td><td class="num">${pct(ex.tCA>0?ex.totalCharges/ex.tCA*100:0)}</td></tr>
  </table>

  <h2>Encaissements par point de vente</h2>
  <table>
    <tr><th>Point de vente</th><th>Total</th><th>% du CA</th><th>Détail par mode</th></tr>
    ${ex.encaissementsParPdv.map(lignePdv).join("")}
  </table>

  ${ex.encaissementsEvent.length>0 ? `
  <h2>Encaissements événementiel</h2>
  <table>
    <tr><th>Date</th><th>Montant</th><th>Mode</th><th>% du CA</th></tr>
    ${ex.encaissementsEvent.map(e=>`<tr><td>${e.date}</td><td class="num">${nb(e.montant)}</td><td>${e.mode}</td><td class="num">${pct(e.pctCA)}</td></tr>`).join("")}
  </table>` : ""}

  ${ex.depensesManuelles.length>0 ? `
  <h2>Dépenses manuelles (espèces / BL)</h2>
  <table>
    <tr><th>Date</th><th>Catégorie</th><th>Affecté à</th><th>Montant</th><th>Mode</th><th>Saisi par</th></tr>
    ${ex.depensesManuelles.map(d=>`<tr><td>${d.date}</td><td>${d.categorie}</td><td class="muted">${d.scope}</td><td class="num">${nb(d.montant)}</td><td>${d.mode}</td><td class="muted small">${d.vendeur}</td></tr>`).join("")}
  </table>` : ""}

  <div class="page-break"></div>
  <h1>🫒 Détail par point de vente — ${ex.moisLabel}</h1>
  <div class="muted small">Classé du plus au moins rentable · Page 2/2</div>

  <h2>Classement des points de vente</h2>
  <table>
    <tr><th>#</th><th>Point de vente</th><th>CA</th><th>Résultat net</th><th>% net</th></tr>
    ${ex.classementPdv.map(ligneClassementPdv).join("")}
  </table>

</body></html>`;

  const w = window.open("", "_blank");
  if(!w){ alert("Le navigateur a bloqué l'ouverture de la fenêtre d'impression. Autorisez les pop-ups pour ce site puis réessayez."); return; }
  w.document.write(html);
  w.document.close();
  w.onload = ()=>{ w.focus(); w.print(); };
}


const C={
  bg:"#f8f9fa",white:"#fff",border:"#e9ecef",
  text:"#212529",textMuted:"#6c757d",textLight:"#adb5bd",
  primary:"#2d6a4f",primaryLight:"#d8f3dc",primaryMuted:"#52b788",
  accent:"#e76f51",accentLight:"#fde8e4",
  warn:"#f4a261",warnLight:"#fef0e4",
  green:"#2d6a4f",greenLight:"#d8f3dc",
  red:"#c1121f",redLight:"#ffe5e5",
  fixe:"#3b5bdb",fixeLight:"#eef2ff",
  variable:"#e67700",variableLight:"#fff3e0",
  shadow:"0 1px 3px rgba(0,0,0,0.08)",
  shadowMd:"0 4px 12px rgba(0,0,0,0.1)",
};
const base={fontFamily:"'Inter',-apple-system,sans-serif",fontSize:14,color:C.text,boxSizing:"border-box"};

// ─── UI ATOMS ─────────────────────────────────────────────────────────────────
function Card({children,style={},pad=20}){
  return <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,boxShadow:C.shadow,padding:pad,...style}}>{children}</div>;
}
function Badge({val}){
  const pos=val>=0;
  return <span style={{display:"inline-flex",alignItems:"center",gap:3,background:pos?C.greenLight:C.redLight,color:pos?C.green:C.red,borderRadius:20,padding:"2px 10px",fontSize:12,fontWeight:600}}>
    {pos?"▲":"▼"} {Math.abs(val).toFixed(1)}%
  </span>;
}
function KPICard({label,value,sub,color=C.primary,accent=false}){
  return <Card style={{flex:1,minWidth:130,background:accent?C.primary:C.white}} pad={16}>
    <div style={{fontSize:11,fontWeight:600,letterSpacing:0.8,color:accent?"rgba(255,255,255,0.65)":C.textMuted,textTransform:"uppercase",marginBottom:6}}>{label}</div>
    <div style={{fontSize:22,fontWeight:700,color:accent?"#fff":color,lineHeight:1.1}}>{value}</div>
    {sub!==undefined&&<div style={{marginTop:6}}>{sub}</div>}
  </Card>;
}
function Label({children}){
  return <div style={{fontSize:11,fontWeight:600,color:C.textMuted,letterSpacing:0.6,textTransform:"uppercase",marginBottom:4}}>{children}</div>;
}
function MoneyInput({value,onChange,disabled=false}){
  const [f,setF]=useState(false);
  return <div style={{position:"relative"}}>
    <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:C.textLight,fontSize:13,pointerEvents:"none"}}>€</span>
    <input type="number" min="0" step="0.01" value={value||""} onChange={e=>onChange(e.target.value)} placeholder="0"
      disabled={disabled} onFocus={()=>setF(true)} onBlur={()=>setF(false)}
      style={{...base,width:"100%",padding:"10px 12px 10px 26px",borderRadius:8,border:`1.5px solid ${disabled?"#e9ecef":f?C.primary:C.border}`,outline:"none",background:disabled?"#f8f9fa":C.white,transition:"border 0.15s"}}/>
  </div>;
}
function SectionHead({children,action}){
  return <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
    <div style={{fontSize:13,fontWeight:700,color:C.text}}>{children}</div>
    {action}
  </div>;
}
// Options de <select> groupées par grande catégorie comptable
function CatOptions({cats}){
  const perso = cats.filter(c=>!GROUPES_COMPTA.find(g=>g.id===c.groupe));
  return <>
    {GROUPES_COMPTA.map(g=>{
      const items = cats.filter(c=>c.groupe===g.id);
      if(items.length===0) return null;
      return <optgroup key={g.id} label={g.label}>
        {items.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
      </optgroup>;
    })}
    {perso.length>0 && <optgroup label="Personnalisées">
      {perso.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
    </optgroup>}
  </>;
}
function TypeToggle({value,onChange}){
  return <div style={{display:"flex",borderRadius:7,overflow:"hidden",border:`1px solid ${C.border}`,flexShrink:0}}>
    {[["fixe","🔒 Fixe"],["variable","📈 Var."]].map(([v,label])=>(
      <button key={v} onClick={()=>onChange(v)} style={{...base,padding:"5px 11px",fontSize:11,fontWeight:600,border:"none",cursor:"pointer",transition:"all 0.15s",
        background:value===v?(v==="fixe"?C.fixe:C.variable):C.white,color:value===v?"#fff":C.textMuted,borderRight:v==="fixe"?`1px solid ${C.border}`:"none"}}>
        {label}
      </button>
    ))}
  </div>;
}

// ─── ÉCRAN DE CONNEXION ───────────────────────────────────────────────────────
function EcranConnexion({onPatron, onVendeur, vendeurs}){
  const [mode,setMode]=useState(null);
  const [pin,setPin]=useState("");
  const [pwd,setPwd]=useState("");
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);

  const handleLoginPatron=async()=>{
    if(!pwd.trim()) return;
    setLoading(true); setErr("");
    const patron = await loginPatron(pwd);
    setLoading(false);
    if(patron){ onPatron(patron); }
    else{ setErr("Mot de passe incorrect"); setPwd(""); }
  };
  const loginVendeur=()=>{
    const v=vendeurs.find(v=>v.pin===pin);
    if(v){ onVendeur(v); }
    else{ setErr("PIN incorrect"); setPin(""); }
  };
  const addPin=(d)=>{
    if(mode==="vendeur"&&pin.length<6) setPin(p=>p+d);
    if(mode==="patron"&&pwd.length<30) setPwd(p=>p+d);
  };
  const delPin=()=>{ if(mode==="vendeur") setPin(p=>p.slice(0,-1)); else setPwd(p=>p.slice(0,-1)); };

  return <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#2d6a4f,#1b4332)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
    <div style={{width:"100%",maxWidth:360}}>
      {/* Logo */}
      <div style={{textAlign:"center",marginBottom:32}}>
        <div style={{fontSize:48,marginBottom:8}}>🫒</div>
        <div style={{fontFamily:"'Inter',sans-serif",fontSize:22,fontWeight:800,color:"#fff",lineHeight:1}}>Traiteur Grec</div>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.55)",marginTop:4,letterSpacing:1}}>GESTION DE RENTABILITÉ</div>
      </div>

      {!mode && <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <button onClick={()=>{setMode("patron");setErr("");}} style={{...base,background:C.white,border:"none",borderRadius:12,padding:"16px 20px",cursor:"pointer",fontWeight:700,fontSize:15,display:"flex",alignItems:"center",gap:12,boxShadow:C.shadowMd}}>
          <span style={{fontSize:24}}>👔</span><div style={{textAlign:"left"}}><div>Accès Patron</div><div style={{fontSize:11,color:C.textMuted,fontWeight:400}}>Dashboard complet</div></div>
        </button>
        <button onClick={()=>{setMode("vendeur");setErr("");}} style={{...base,background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:12,padding:"16px 20px",cursor:"pointer",fontWeight:700,fontSize:15,color:"#fff",display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:24}}>🧑‍💼</span><div style={{textAlign:"left"}}><div>Accès Vendeur</div><div style={{fontSize:11,color:"rgba(255,255,255,0.55)",fontWeight:400}}>Clôture de caisse</div></div>
        </button>
      </div>}

      {mode && <Card pad={24}>
        <button onClick={()=>{setMode(null);setErr("");setPin("");setPwd("");}} style={{...base,background:"none",border:"none",cursor:"pointer",color:C.textMuted,fontSize:12,marginBottom:16,display:"flex",alignItems:"center",gap:4}}>← Retour</button>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:28,marginBottom:6}}>{mode==="patron"?"👔":"🧑‍💼"}</div>
          <div style={{fontWeight:700,fontSize:16}}>{mode==="patron"?"Accès Patron":"Accès Vendeur"}</div>
          <div style={{fontSize:12,color:C.textMuted,marginTop:4}}>{mode==="patron"?"Entrez votre mot de passe":"Entrez votre code PIN"}</div>
        </div>
        {/* Affichage dots */}
        <div style={{display:"flex",justifyContent:"center",gap:10,marginBottom:20}}>
          {Array.from({length:mode==="vendeur"?4:8}).map((_,i)=>{
            const val=mode==="vendeur"?pin:pwd;
            return <div key={i} style={{width:14,height:14,borderRadius:"50%",background:i<val.length?C.primary:C.border,transition:"background 0.15s"}}/>;
          })}
        </div>
        {/* Clavier numérique (vendeur) ou clavier texte (patron) */}
        {mode==="vendeur"
          ?<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
            {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((d,i)=>(
              <button key={i} onClick={()=>d==="⌫"?delPin():d!==""&&addPin(String(d))}
                style={{...base,background:d==="⌫"?C.redLight:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"16px 0",fontSize:20,fontWeight:600,cursor:d===""?"default":"pointer",color:d==="⌫"?C.red:C.text}}>
                {d}
              </button>
            ))}
          </div>
          :<div style={{marginBottom:16}}>
            <input type="password" value={pwd} onChange={e=>setPwd(e.target.value)} placeholder="Mot de passe" onKeyDown={e=>e.key==="Enter"&&handleLoginPatron()}
              style={{...base,width:"100%",padding:"12px 14px",borderRadius:8,border:`1.5px solid ${C.border}`,outline:"none",fontSize:15,textAlign:"center"}}/>
          </div>
        }
        {err&&<div style={{textAlign:"center",color:C.red,fontSize:13,marginBottom:12,fontWeight:500}}>{err}</div>}
        <button onClick={mode==="vendeur"?loginVendeur:handleLoginPatron} disabled={loading}
          style={{...base,width:"100%",background:loading?"#ccc":C.primary,color:"#fff",border:"none",borderRadius:10,padding:"14px",fontWeight:700,fontSize:15,cursor:loading?"not-allowed":"pointer"}}>
          {loading?"⏳ Vérification...":"Connexion"}
        </button>
      </Card>}
    </div>
  </div>;
}

// ─── ÉCRAN VENDEUR ────────────────────────────────────────────────────────────
function EcranVendeur({vendeur, data, onSave, onLogout}){
  const [step,setStep]=useState("pdv"); // pdv | saisie | confirm
  const [pdvId,setPdvId]=useState(null);
  const [modes,setModes]=useState([]);
  const [note,setNote]=useState("");
  const [depenses,setDepenses]=useState([]); // dépenses ajoutées par le vendeur, n'affectent pas le CA
  const [depForm,setDepForm]=useState({montant:"",modeId:"",scope:"pdv",catId:""});

  const [saving,setSaving]=useState(false);
  const [saveError,setSaveError]=useState(null);

  const pdvInfo=PDV_LIST.find(p=>p.id===pdvId);
  const total=modes.reduce((s,m)=>s+n(m.montant),0);
  const pdvCatsActuel = pdvId ? (data.pdvCats[pdvId]||[]) : [];

  const startSaisie=(id)=>{
    const cats = data.pdvCats[id] || DEFAULT_PDV_CATS;
    setPdvId(id);
    setModes(data.paiements.map(p=>({...p,montant:0})));
    setDepenses([]);
    setDepForm({
      montant:"",
      modeId:data.paiements[0]?.id||"",
      scope:"pdv",
      catId:cats[0]?.id||data.laboCats[0]?.id||""
    });
    setStep("saisie");
  };

  const ajouterDepense=()=>{
    if(!n(depForm.montant)) return;
    const cats = depForm.scope==="labo" ? data.laboCats : (pdvCatsActuel.length>0 ? pdvCatsActuel : DEFAULT_PDV_CATS);
    const cat = cats.find(c=>c.id===depForm.catId) || cats[0];
    if(!cat) return;
    const mode = data.paiements.find(p=>p.id===depForm.modeId);
    setDepenses(ds=>[...ds, {
      id:uid(), montant:n(depForm.montant), modeLabel:mode?.label||"—",
      scope:depForm.scope, catId:cat?.id, catLabel:cat?.label||"Autre"
    }]);
    setDepForm({...depForm, montant:""});
  };
  const supprimerDepense=(id)=>setDepenses(ds=>ds.filter(d=>d.id!==id));

  const valider=async ()=>{
    setSaving(true);
    setSaveError(null);
    // Si le vendeur a saisi un montant mais n'a pas cliqué "+ Ajouter", on l'ajoute automatiquement
    let depensesFinales = [...depenses];
    if(n(depForm.montant)>0){
      const cats = depForm.scope==="labo" ? data.laboCats : (pdvCatsActuel.length>0 ? pdvCatsActuel : DEFAULT_PDV_CATS);
      const cat = cats.find(c=>c.id===depForm.catId) || cats[0];
      const mode = data.paiements.find(p=>p.id===depForm.modeId);
      if(cat) depensesFinales = [...depensesFinales, {
        id:uid(), montant:n(depForm.montant), modeLabel:mode?.label||"—",
        scope:depForm.scope, catId:cat?.id, catLabel:cat?.label||"Autre"
      }];
    }
    const key=moisKey();
    // Recharger les données fraîches depuis Supabase avant d'écrire
    // pour éviter d'écraser des données plus récentes
    const { data: remote, error: loadErr } = await loadFromSupabase();
    if(loadErr){
      // On continue quand même avec les données locales disponibles plutôt
      // que de bloquer complètement le vendeur sur le terrain — mais on
      // l'avertit clairement que la synchronisation a un souci.
      setSaveError(`Connexion instable (${loadErr}). La clôture va quand même être enregistrée localement.`);
    }
    const baseData = remote || data;
    const d = ensureMois(baseData, key);
    const cloture={
      id:uid(), vendeurId:vendeur.id, vendeurNom:vendeur.nom,
      pdvId, date:todayKey(), dateLabel:new Date().toLocaleDateString("fr-FR"),
      modes:modes.map(m=>({...m})), total, note
    };
    let mois = d.mois[key];
    const old = mois.pdv[pdvId] || {ca:0,vars:{},clotures:[]};
    const clotures=[...(old.clotures||[]),cloture];
    const ca=caDepuisClotures(clotures);
    let pdvObj = {...mois.pdv, [pdvId]: {...old, ca, clotures}};
    let laboCh = {...mois.laboCh};

    // Applique les dépenses déclarées — sans toucher au CA
    const depLog=[];
    depensesFinales.forEach(dep=>{
      if(dep.scope==="labo"){
        laboCh[dep.catId] = n(laboCh[dep.catId]) + dep.montant;
      } else {
        const pmActuel = pdvObj[pdvId] || {ca:0,vars:{},clotures:[]};
        const varsActuels = pmActuel.vars || {};
        pdvObj = {
          ...pdvObj,
          [pdvId]: {
            ...pmActuel,
            vars: {
              ...varsActuels,
              [dep.catId]: n(varsActuels[dep.catId]) + dep.montant
            }
          }
        };
      }
      depLog.push({
        id:uid(), date:todayKey(), dateLabel:new Date().toLocaleDateString("fr-FR"),
        vendeurNom:vendeur.nom, pdvId, pdvLabel:pdvInfo?.full,
        montant:dep.montant, modeLabel:dep.modeLabel, scope:dep.scope, catLabel:dep.catLabel, catId:dep.catId
      });
    });
    if(depLog.length>0) pdvObj = {...pdvObj, _depenses:[...(mois.pdv._depenses||[]), ...depLog]};

    mois = {...mois, pdv:pdvObj, laboCh};
    const newData={...d, mois:{...d.mois,[key]:mois}};
    const result = await onSave(newData);
    setSaving(false);
    if(result && result.success===false){
      // La sauvegarde en ligne a échoué : on prévient clairement plutôt que
      // de laisser croire que tout s'est bien passé. La donnée reste dans le
      // cache local de cet appareil (saveCache déjà fait dans handleVendeurSave).
      setSaveError(`⚠️ La clôture n'a pas pu être synchronisée en ligne (${result.error}). Elle reste enregistrée sur cet appareil — ne fermez pas cette page et réessayez dès que la connexion revient (bouton ci-dessous), ou signalez-le au patron.`);
      return;
    }
    setStep("confirm");
  };
  const reessayerValidation = ()=>{ valider(); };

  if(step==="confirm") return (
    <div style={{minHeight:"100vh",background:C.primaryLight,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <Card style={{maxWidth:340,width:"100%",textAlign:"center"}} pad={32}>
        <div style={{fontSize:52,marginBottom:12}}>✅</div>
        <div style={{fontWeight:800,fontSize:20,color:C.primary,marginBottom:8}}>Clôture enregistrée !</div>
        <div style={{fontSize:14,color:C.textMuted,marginBottom:4}}>{pdvInfo?.full}</div>
        <div style={{fontSize:28,fontWeight:700,color:C.primary,margin:"16px 0"}}>{total.toLocaleString("fr-FR")} €</div>
        {modes.map(m=>n(m.montant)>0&&<div key={m.id} style={{display:"flex",justifyContent:"space-between",fontSize:13,color:C.textMuted,marginBottom:4}}>
          <span>{m.label}</span><span style={{fontWeight:600}}>{n(m.montant).toLocaleString("fr-FR")} €</span>
        </div>)}
        {depenses.length>0 && <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
          <div style={{fontSize:12,color:C.textMuted,marginBottom:6}}>💸 {depenses.length} dépense(s) déclarée(s)</div>
          {depenses.map(dep=><div key={dep.id} style={{fontSize:12,color:C.textMuted}}>{dep.catLabel} · {dep.montant.toLocaleString("fr-FR")} €</div>)}
        </div>}
        <button onClick={()=>{setStep("pdv");setPdvId(null);setNote("");}} style={{...base,marginTop:20,width:"100%",background:C.primary,color:"#fff",border:"none",borderRadius:10,padding:"13px",fontWeight:700,fontSize:14,cursor:"pointer"}}>
          Nouvelle clôture
        </button>
        <button onClick={onLogout} style={{...base,marginTop:8,width:"100%",background:"transparent",color:C.textMuted,border:`1px solid ${C.border}`,borderRadius:10,padding:"11px",fontWeight:500,fontSize:13,cursor:"pointer"}}>
          Se déconnecter
        </button>
      </Card>
    </div>
  );

  if(step==="pdv") return (
    <div style={{minHeight:"100vh",background:C.bg,padding:20}}>
      <div style={{maxWidth:400,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <div>
            <div style={{fontWeight:800,fontSize:18}}>Bonjour, {vendeur.nom} 👋</div>
            <div style={{fontSize:12,color:C.textMuted,marginTop:2}}>Choisissez votre point de vente</div>
          </div>
          <button onClick={onLogout} style={{...base,background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 12px",fontSize:12,cursor:"pointer",color:C.textMuted}}>Quitter</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {PDV_LIST.map(p=>(
            <button key={p.id} onClick={()=>startSaisie(p.id)}
              style={{...base,background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px",cursor:"pointer",display:"flex",alignItems:"center",gap:14,boxShadow:C.shadow,textAlign:"left",transition:"all 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=C.primary}
              onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
              <span style={{fontSize:26}}>{p.emoji}</span>
              <div>
                <div style={{fontWeight:700,fontSize:15}}>{p.full}</div>
                <div style={{fontSize:12,color:C.textMuted,marginTop:2}}>{p.jours}</div>
              </div>
              <span style={{marginLeft:"auto",fontSize:20,color:C.textLight}}>›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if(step==="saisie") return (
    <div style={{minHeight:"100vh",background:C.bg,padding:20}}>
      <div style={{maxWidth:400,margin:"0 auto"}}>
        <button onClick={()=>setStep("pdv")} style={{...base,background:"none",border:"none",cursor:"pointer",color:C.textMuted,fontSize:13,marginBottom:16,display:"flex",alignItems:"center",gap:4}}>← Changer de point de vente</button>
        <div style={{marginBottom:20}}>
          <div style={{fontWeight:800,fontSize:20}}>{pdvInfo?.emoji} {pdvInfo?.full}</div>
          <div style={{fontSize:12,color:C.textMuted,marginTop:3}}>{new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}</div>
        </div>

        <Card style={{marginBottom:16}}>
          <SectionHead>💰 Clôture de caisse</SectionHead>
          {modes.map((m,i)=>(
            <div key={m.id} style={{marginBottom:14}}>
              <Label>{m.label}</Label>
              <MoneyInput value={m.montant} onChange={v=>setModes(ms=>ms.map((x,j)=>j===i?{...x,montant:v}:x))}/>
            </div>
          ))}
          <div style={{marginTop:8}}>
            <Label>Note (optionnel)</Label>
            <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Météo, événement, incident..."
              style={{...base,width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,outline:"none"}}/>
          </div>
        </Card>

        {/* Dépenses — n'affectent pas le CA */}
        <Card style={{marginBottom:16,background:C.warnLight,border:`1px solid ${C.warn}`}}>
          <SectionHead>💸 Dépense effectuée (optionnel)</SectionHead>
          <div style={{fontSize:11,color:C.textMuted,marginBottom:12}}>N'affecte pas votre chiffre d'affaires — ajoutée directement comme charge.</div>

          {depenses.length>0 && <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12}}>
            {depenses.map(dep=>(
              <div key={dep.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.white,borderRadius:8,padding:"8px 10px"}}>
                <div style={{fontSize:12}}>
                  <strong>{dep.catLabel}</strong> · {dep.modeLabel} {dep.scope==="labo"?"· 🏭":""}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontWeight:700,fontSize:13}}>{dep.montant.toLocaleString("fr-FR")} €</span>
                  <button onClick={()=>supprimerDepense(dep.id)} style={{...base,background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:16}}>×</button>
                </div>
              </div>
            ))}
          </div>}

          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div>
              <Label>Montant</Label>
              <MoneyInput value={depForm.montant} onChange={v=>setDepForm({...depForm,montant:v})}/>
            </div>
            <div>
              <Label>Mode de paiement</Label>
              <select value={depForm.modeId} onChange={e=>setDepForm({...depForm,modeId:e.target.value})}
                style={{...base,width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,outline:"none",fontSize:13}}>
                {data.paiements.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Catégorie</Label>
              <select value={depForm.scope==="labo"?"labo":`pdv:${depForm.catId}`}
                onChange={e=>{
                  const v=e.target.value;
                  if(v.startsWith("labo:")) setDepForm({...depForm,scope:"labo",catId:v.split(":")[1]});
                  else setDepForm({...depForm,scope:"pdv",catId:v.split(":")[1]});
                }}
                style={{...base,width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,outline:"none",fontSize:13}}>
                <optgroup label="🏪 Ce point de vente">
                  {pdvCatsActuel.map(c=><option key={c.id} value={`pdv:${c.id}`}>{c.label}</option>)}
                </optgroup>
                <optgroup label="🏭 Laboratoire (matières, fournitures...)">
                  {data.laboCats.map(c=><option key={c.id} value={`labo:${c.id}`}>{c.label}</option>)}
                </optgroup>
              </select>
            </div>
            <button onClick={ajouterDepense} disabled={!n(depForm.montant)}
              style={{...base,background:n(depForm.montant)?C.accent:"#ccc",color:"#fff",border:"none",borderRadius:8,padding:"10px",fontWeight:600,fontSize:13,cursor:n(depForm.montant)?"pointer":"not-allowed"}}>
              + Ajouter cette dépense
            </button>
          </div>
        </Card>

        {/* Total */}
        <Card style={{background:total>0?C.primary:C.bg,marginBottom:20}} pad={16}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:13,fontWeight:600,color:total>0?"rgba(255,255,255,0.7)":C.textMuted}}>TOTAL CAISSE</div>
            <div style={{fontSize:28,fontWeight:800,color:total>0?"#fff":C.textLight}}>{total.toLocaleString("fr-FR")} €</div>
          </div>
        </Card>

        {saveError && <Card style={{background:C.redLight,border:`1px solid ${C.red}33`,marginBottom:16}} pad={14}>
          <div style={{fontSize:13,color:C.red,fontWeight:600,marginBottom:8}}>{saveError}</div>
          <button onClick={reessayerValidation} disabled={saving}
            style={{...base,background:C.red,color:"#fff",border:"none",borderRadius:8,padding:"9px 16px",fontWeight:600,fontSize:13,cursor:saving?"not-allowed":"pointer"}}>
            🔄 Réessayer
          </button>
        </Card>}

        <button onClick={valider} disabled={total===0||saving}
          style={{...base,width:"100%",background:total>0&&!saving?C.primary:"#ccc",color:"#fff",border:"none",borderRadius:12,padding:"16px",fontWeight:700,fontSize:16,cursor:total>0&&!saving?"pointer":"not-allowed",transition:"background 0.15s"}}>
          {saving?"⏳ Enregistrement...":(()=>{const tot=depenses.length+(n(depForm.montant)>0?1:0);return `Valider la clôture${tot>0?` (+${tot} dépense${tot>1?"s":""})`:""}`;})()}
        </button>
      </div>
    </div>
  );
}

// ─── GESTION VENDEURS ─────────────────────────────────────────────────────────
function GestionVendeurs({vendeurs, onChange}){
  const [nom,setNom]=useState(""); const [pin,setPin]=useState(""); const [err,setErr]=useState("");
  const add=()=>{
    if(!nom.trim()){setErr("Entrez un nom");return;}
    if(pin.length<4){setErr("PIN minimum 4 chiffres");return;}
    if(vendeurs.find(v=>v.pin===pin)){setErr("Ce PIN est déjà utilisé");return;}
    onChange([...vendeurs,{id:uid(),nom:nom.trim(),pin}]);
    setNom("");setPin("");setErr("");
  };
  return <div>
    <Card style={{marginBottom:16}}>
      <SectionHead>➕ Ajouter un vendeur</SectionHead>
      <div style={{display:"grid",gridTemplateColumns:"1fr 120px",gap:10,marginBottom:10}}>
        <div>
          <Label>Prénom / Nom</Label>
          <input value={nom} onChange={e=>setNom(e.target.value)} placeholder="Ex: Marie" style={{...base,width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,outline:"none"}}/>
        </div>
        <div>
          <Label>Code PIN</Label>
          <input type="password" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="4–6 chiffres" style={{...base,width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,outline:"none",textAlign:"center",letterSpacing:4}}/>
        </div>
      </div>
      {err&&<div style={{color:C.red,fontSize:12,marginBottom:8}}>{err}</div>}
      <button onClick={add} style={{...base,background:C.primary,color:"#fff",border:"none",borderRadius:8,padding:"9px 18px",fontWeight:600,cursor:"pointer",fontSize:13}}>Ajouter</button>
    </Card>

    <SectionHead>Vendeurs ({vendeurs.length})</SectionHead>
    {vendeurs.length===0&&<Card pad={24} style={{textAlign:"center"}}><div style={{color:C.textLight,fontSize:13}}>Aucun vendeur enregistré</div></Card>}
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {vendeurs.map(v=>(
        <Card key={v.id} pad={14}>
          <div style={{display:"flex",alignItems:"center",gap:12,justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:36,height:36,borderRadius:10,background:C.primaryLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🧑‍💼</div>
              <div>
                <div style={{fontWeight:600,fontSize:14}}>{v.nom}</div>
                <div style={{fontSize:12,color:C.textMuted}}>PIN : {"•".repeat(v.pin.length)}</div>
              </div>
            </div>
            <button onClick={()=>onChange(vendeurs.filter(x=>x.id!==v.id))}
              style={{...base,background:C.redLight,color:C.red,border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:600}}>
              Supprimer
            </button>
          </div>
        </Card>
      ))}
    </div>
  </div>;
}

// ─── GESTION MODES DE PAIEMENT ────────────────────────────────────────────────
function GestionPaiements({paiements, onChange}){
  const [label,setLabel]=useState("");
  const add=()=>{ if(!label.trim()) return; onChange([...paiements,{id:uid(),label:label.trim()}]); setLabel(""); };
  return <div>
    <Card style={{marginBottom:16}}>
      <SectionHead>➕ Ajouter un mode de paiement</SectionHead>
      <div style={{display:"flex",gap:10}}>
        <input value={label} onChange={e=>setLabel(e.target.value)} placeholder="Ex: Chèques vacances" onKeyDown={e=>e.key==="Enter"&&add()}
          style={{...base,flex:1,padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,outline:"none"}}/>
        <button onClick={add} style={{...base,background:C.primary,color:"#fff",border:"none",borderRadius:8,padding:"9px 16px",fontWeight:600,cursor:"pointer"}}>+</button>
      </div>
    </Card>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {paiements.map(p=>(
        <Card key={p.id} pad={14}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{fontWeight:500,fontSize:14}}>{p.label}</div>
            <button onClick={()=>onChange(paiements.filter(x=>x.id!==p.id))}
              style={{...base,background:C.redLight,color:C.red,border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:600}}>Suppr.</button>
          </div>
        </Card>
      ))}
    </div>
  </div>;
}

// ─── MES OBJECTIFS (fourchettes personnalisables de comparaison sectorielle) ──
// Permet au patron d'ajuster chaque fourchette min/max utilisée dans le bloc
// "Comparaison avec le secteur" du Dashboard, pour remplacer les repères
// génériques par sa propre connaissance fine de son métier — particulièrement
// utile pour les postes où aucune référence sectorielle fiable n'existe pour
// un modèle de vente directe multi-sites (droits de place, logistique...).
function GestionObjectifs({objectifs, onChange}){
  const refsDistantes = objectifs || REFERENCES_SECTORIELLES_DEFAUT;
  const keys = Object.keys(REFERENCES_SECTORIELLES_DEFAUT);

  // CORRECTIF SAUT DE CURSEUR : la saisie se fait dans un état LOCAL
  // (localRefs), qui réagit instantanément sans aller-retour réseau. La
  // sauvegarde vers Supabase (via onChange, qui recharge et écrit en base)
  // ne se déclenche qu'au blur du champ — pas à chaque frappe — ce qui
  // évite que React ne perde la position du curseur pendant la saisie.
  const [localRefs, setLocalRefs] = useState(()=>JSON.parse(JSON.stringify(refsDistantes)));

  // Si les objectifs distants changent pour une autre raison (ex: un autre
  // appareil a modifié entre-temps), on resynchronise l'état local — mais
  // seulement quand on n'est pas en train de taper, pour ne pas écraser une
  // saisie en cours.
  const [editing, setEditing] = useState(false);
  useEffect(()=>{
    if(!editing) setLocalRefs(JSON.parse(JSON.stringify(refsDistantes)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectifs]);

  const updLocal = (key, field, value) => {
    setEditing(true);
    setLocalRefs(prev=>({...prev, [key]: {...prev[key], [field]: value}}));
  };
  const commit = (key, field) => {
    setEditing(false);
    const raw = localRefs[key]?.[field];
    const val = raw===""||raw===undefined||raw===null ? 0 : n(raw);
    const cleaned = {...localRefs, [key]: {...localRefs[key], [field]: val}};
    setLocalRefs(cleaned);
    onChange(cleaned);
  };
  const reinitialiser = () => {
    if(window.confirm("Réinitialiser tous les objectifs aux valeurs par défaut ?")) {
      const fresh = JSON.parse(JSON.stringify(REFERENCES_SECTORIELLES_DEFAUT));
      setLocalRefs(fresh);
      onChange(fresh);
    }
  };

  return <div>
    <Card style={{marginBottom:16,background:C.primaryLight}} pad={16}>
      <div style={{fontSize:12,color:C.textMuted}}>
        Ces fourchettes servent de repère dans le bloc "📐 Comparaison avec le secteur" du Dashboard. Ajustez-les selon votre propre connaissance de votre activité — les valeurs par défaut sont des repères génériques de restauration avec production propre, qui ne collent pas forcément à votre modèle multi-sites (marchés + boutiques).
      </div>
    </Card>

    <SectionHead action={<button onClick={reinitialiser} style={{...base,background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer",color:C.textMuted}}>↺ Réinitialiser</button>}>Vos objectifs par poste</SectionHead>

    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {keys.map(key=>{
        const ref = localRefs[key] || REFERENCES_SECTORIELLES_DEFAUT[key];
        const isMargeNette = key==="margeNette";
        return <Card key={key} pad={16}>
          <div style={{fontWeight:600,fontSize:14,marginBottom:4}}>{ref.label}</div>
          <div style={{fontSize:11,color:C.textLight,marginBottom:12}}>{ref.note}</div>
          <div style={{display:"flex",gap:12,alignItems:"flex-end",flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:100}}>
              <Label>{isMargeNette?"Minimum acceptable (%)":"Minimum (%)"}</Label>
              <div style={{position:"relative"}}>
                <input type="number" min="0" step="0.5" value={ref.min}
                  onChange={e=>updLocal(key,"min",e.target.value)}
                  onBlur={()=>commit(key,"min")}
                  onKeyDown={e=>{ if(e.key==="Enter") e.target.blur(); }}
                  style={{...base,width:"100%",padding:"9px 24px 9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,outline:"none"}}/>
                <span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",color:C.textLight,fontSize:13,pointerEvents:"none"}}>%</span>
              </div>
            </div>
            <div style={{flex:1,minWidth:100}}>
              <Label>{isMargeNette?"Objectif ambitieux (%)":"Maximum (%)"}</Label>
              <div style={{position:"relative"}}>
                <input type="number" min="0" step="0.5" value={ref.max}
                  onChange={e=>updLocal(key,"max",e.target.value)}
                  onBlur={()=>commit(key,"max")}
                  onKeyDown={e=>{ if(e.key==="Enter") e.target.blur(); }}
                  style={{...base,width:"100%",padding:"9px 24px 9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,outline:"none"}}/>
                <span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",color:C.textLight,fontSize:13,pointerEvents:"none"}}>%</span>
              </div>
            </div>
          </div>
        </Card>;
      })}
    </div>
    <div style={{fontSize:11,color:C.textLight,marginTop:12,textAlign:"center"}}>
      💾 Les modifications sont enregistrées automatiquement quand vous quittez un champ (ou appuyez sur Entrée).
    </div>
  </div>;
}

// ─── EXPORT MENSUEL (onglet dédié) ────────────────────────────────────────────
// Permet de choisir un mois (le mois en cours ou un mois passé disponible) et
// d'exporter en CSV ou PDF toutes les charges/encaissements/dépenses du mois,
// détaillés par sous-catégorie, avec leur % du CA — pour analyse approfondie
// des postes où des économies sont possibles.
function PanneauExport({data}){
  const moisDisponibles = Object.keys(data.mois).sort().reverse();
  const [moisChoisi, setMoisChoisi] = useState(data.active);
  const [generating, setGenerating] = useState(false);

  const moisLabel = (key) => {
    const [a,m] = key.split("-").map(Number);
    return `${MOIS[m]} ${a}`;
  };

  const lancerExport = (format) => {
    setGenerating(true);
    try{
      const moisObj = fillPdvKeys(data.mois[moisChoisi] || initMois());
      const ex = assemblerDonneesExport(data, moisObj, moisLabel(moisChoisi));
      if(format==="csv"){
        const csv = genererCsvExport(ex);
        const blob = new Blob(["\uFEFF"+csv], {type:"text/csv;charset=utf-8;"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `rapport_${moisChoisi}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        genererPdfExport(ex);
      }
    } finally {
      setGenerating(false);
    }
  };

  const isMoisEnCours = moisChoisi === moisKey();

  return <div>
    <Card style={{marginBottom:16,background:C.primaryLight}} pad={16}>
      <div style={{fontSize:12,color:C.textMuted}}>
        Exportez toutes les charges, encaissements et dépenses du mois choisi, détaillés par sous-catégorie avec leur % du chiffre d'affaires — pour analyser en détail où se trouvent les postes à optimiser.
      </div>
    </Card>

    <Card style={{marginBottom:16}}>
      <SectionHead>Période</SectionHead>
      <select value={moisChoisi} onChange={e=>setMoisChoisi(e.target.value)}
        style={{...base,width:"100%",padding:"10px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,outline:"none",fontSize:14,marginBottom:8}}>
        {moisDisponibles.map(k=><option key={k} value={k}>{moisLabel(k)}</option>)}
      </select>
      {isMoisEnCours && <div style={{fontSize:11,color:C.textMuted}}>ℹ️ Ce mois est en cours — l'export reflétera les données saisies jusqu'à aujourd'hui.</div>}
    </Card>

    <Card>
      <SectionHead>Format d'export</SectionHead>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <button onClick={()=>lancerExport("pdf")} disabled={generating}
          style={{...base,flex:1,minWidth:140,background:generating?"#ccc":C.primary,color:"#fff",border:"none",borderRadius:10,padding:"14px",fontWeight:700,fontSize:14,cursor:generating?"not-allowed":"pointer"}}>
          📄 Export PDF
        </button>
        <button onClick={()=>lancerExport("csv")} disabled={generating}
          style={{...base,flex:1,minWidth:140,background:generating?"#ccc":C.fixe,color:"#fff",border:"none",borderRadius:10,padding:"14px",fontWeight:700,fontSize:14,cursor:generating?"not-allowed":"pointer"}}>
          📊 Export CSV (Excel)
        </button>
      </div>
      <div style={{fontSize:11,color:C.textLight,marginTop:10}}>
        Le PDF s'ouvre dans un nouvel onglet avec la boîte de dialogue d'impression — choisissez "Enregistrer en PDF" comme destination. Le CSV se télécharge directement, à ouvrir avec Excel ou Google Sheets.
      </div>
    </Card>
  </div>;
}

// ─── IMPORT CSV ───────────────────────────────────────────────────────────────
function ImportCSV({data, md, onApplied}){
  const [text,setText]=useState("");
  const [rows,setRows]=useState(null); // résultat parsing
  const [duplicateHashes,setDuplicateHashes]=useState(new Map());
  const [checkingDup,setCheckingDup]=useState(false);
  const [forceInclude,setForceInclude]=useState({}); // {rowId:true} pour inclure malgré le doublon
  const [rules,setRules]=useState({});
  const [loadingRules,setLoadingRules]=useState(true);
  const [pending,setPending]=useState({}); // {rowId: {type,pdvId,catId,lissage,nbMois}}
  const [applied,setApplied]=useState(null); // résumé après validation

  useEffect(()=>{
    (async()=>{
      const r=await loadImportRules();
      setRules(r); setLoadingRules(false);
    })();
  },[]);

  const handleFile=(e)=>{
    const file=e.target.files?.[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>setText(ev.target.result);
    reader.readAsText(file, "ISO-8859-1"); // encodage courant des exports CIC
  };

  const analyser=async ()=>{
    const parsed=parseCicCsv(text);
    setRows(parsed);
    setCheckingDup(true);
    const dup = await checkDuplicateHashes(parsed);
    setDuplicateHashes(dup);
    setCheckingDup(false);
  };

  // Lignes considérées comme doublons (déjà vues dans un import précédent), sauf si forcées
  const duplicateRows = rows ? rows.filter(r=>duplicateHashes.has(hashRow(r)) && !forceInclude[r.id]) : [];
  const effectiveRows = rows ? rows.filter(r=>!duplicateHashes.has(hashRow(r)) || forceInclude[r.id]) : [];

  // Classification de chaque ligne
  const classified = rows ? effectiveRows.map(row=>{
    const k = extractKeyword(row.libelle);
    let auto=null;

    if(k.isRemCB){
      auto = { type:"ignore", reason:"Encaissement CB — déjà couvert par les clôtures de caisse" };
    } else if(k.isSumUp && row.credit>0){
      auto = { type:"ignore", reason:"Versement SumUp — déjà couvert par les clôtures de caisse" };
    } else if(k.isDepotEspeces && row.credit>0){
      auto = { type:"ignore", reason:"Dépôt d'espèces — déjà couvert par les clôtures de caisse" };
    } else if(k.isComCB){
      auto = { type:"com_cb" };
    } else {
      const rule = findRuleMatch(k.clean, rules);
      if(rule){
        const montant = row.debit||row.credit;
        auto = { ...rule, montant };
      }
    }
    return { row, k, auto };
  }) : [];

  const aClasser = classified.filter(c=>!c.auto && c.row.debit>0); // on ne classe que les débits (charges) pour l'instant
  const reconnues = classified.filter(c=>c.auto && c.auto.type!=="ignore" && c.auto.type!=="com_cb");
  const ignorees = classified.filter(c=>c.auto && c.auto.type==="ignore");
  const comCbLines = classified.filter(c=>c.auto && c.auto.type==="com_cb");
  const totalComCB = comCbLines.reduce((s,c)=>s+c.row.debit,0);
  const credits = classified.filter(c=>!c.auto && c.row.credit>0);

  // Rapprochement bancaire : calculé sur TOUTES les lignes lues du fichier
  // (rows, pas effectiveRows) pour pouvoir détecter la frontière du
  // chevauchement avec un import précédent, en tenant compte des choix de
  // classement en cours (pending).
  const rapprochement = rows ? calculerRapprochement(rows, duplicateHashes, pending) : null;

  // Trouve l'id du mode de paiement "carte bancaire" parmi les modes configurés
  const cbModeId = (()=>{
    const m = data.paiements.find(p=>/cb|carte/i.test(p.label) || p.id==="cb");
    return m?.id;
  })();

  // CB encaissé par point de vente ce mois-ci (via les clôtures vendeurs)
  const cbParPdv = PDV_LIST.reduce((acc,p)=>{
    const clotures = md.pdv[p.id]?.clotures||[];
    const total = clotures.reduce((s,cl)=>{
      const mode = cl.modes.find(m=>m.id===cbModeId);
      return s + (mode?n(mode.montant):0);
    },0);
    acc[p.id]=total; return acc;
  },{});
  const totalCbGlobal = Object.values(cbParPdv).reduce((a,b)=>a+b,0);

  const allCatsLabo = data.laboCats;
  const setPend=(rowId,val)=>setPending(p=>({...p,[rowId]:val}));

  const validerTout = async ()=>{
    // 1. Construire la liste finale d'opérations à appliquer (reconnues + celles classées manuellement)
    const ops=[...reconnues.map(c=>({...c.auto, libelle:c.row.libelle}))];
    for(const c of aClasser){
      const choix=pending[c.row.id];
      if(!choix || choix.type==="ignore") continue;
      if(choix.type==="multi"){
        (choix.repartition||[]).forEach(r=>{
          if(n(r.montant)>0){
            const cats=data.pdvCats[r.pdvId]||[];
            const cat=cats.find(ct=>ct.id===r.catId)||cats[0];
            ops.push({ type:"pdv", pdvId:r.pdvId, catId:r.catId, label:cat?.label||"", montant:n(r.montant), lissage:choix.lissage||"ponctuel", libelle:c.row.libelle });
          }
        });
      } else {
        ops.push({...choix, montant:c.row.debit, libelle:c.row.libelle, _learnKeyword:c.k.clean});
      }
    }
    for(const c of credits){
      const choix=pending[c.row.id];
      if(choix && choix.type!=="ignore"){
        ops.push({...choix, montant:c.row.credit, libelle:c.row.libelle, _learnKeyword:c.k.clean});
      }
    }

    // 1bis. Commissions CB : réparties au prorata du CB encaissé par chaque point de vente
    if(totalComCB>0 && totalCbGlobal>0){
      PDV_LIST.forEach(p=>{
        const part = totalComCB * (cbParPdv[p.id]/totalCbGlobal);
        if(part>0) ops.push({ type:"pdv", pdvId:p.id, catId:"frais_cb", label:"Frais bancaires CB", montant:part, lissage:"ponctuel" });
      });
    }

    // 2. Appliquer chaque opération aux bons mois (avec lissage)
    // CORRECTIF ANTI-ÉCRASEMENT : on repart des données fraîches de Supabase
    // plutôt que de `md`/`data` (potentiellement périmés si quelqu'un d'autre
    // a écrit pendant que le patron classait les lignes du CSV).
    const { data: remoteForImport, error: loadErrImport } = await loadFromSupabase();
    if(loadErrImport) console.error("Rechargement avant import CSV échoué, utilisation des données locales:", loadErrImport);
    const freshDataForImport = remoteForImport ? migrateLaboCats(remoteForImport) : data;
    const startKey = freshDataForImport.active;
    const freshMdForImport = fillPdvKeys(freshDataForImport.mois[startKey] || initMois());
    const moisCache = { [startKey]: freshMdForImport }; // on ne modifie que le mois actif + futurs si lissage

    for(const op of ops){
      const nbMois = op.lissage==="trimestriel"?3 : op.lissage==="annuel"?12 : op.lissage==="personnalise"?(op.nbMois||1) : 1;
      const part = op.montant / nbMois;
      const keys = moisLissage(startKey, nbMois);
      for(const k of keys){
        if(!moisCache[k]){
          moisCache[k] = initMois();
        }
        if(op.type==="labo"){
          const cat = moisCache[k].laboCh || {};
          moisCache[k] = {...moisCache[k], laboCh: {...cat, [op.catId]: (n(cat[op.catId])+part)} };
        } else if(op.type==="pdv"){
          const pdvMois = moisCache[k].pdv[op.pdvId] || {ca:0,vars:{},clotures:[]};
          const vars = pdvMois.vars||{};
          moisCache[k] = {...moisCache[k], pdv: {...moisCache[k].pdv, [op.pdvId]: {...pdvMois, vars:{...vars,[op.catId]:(n(vars[op.catId])+part)}}}};
        } else if(op.type==="ca_event"){
          const ev = moisCache[k].pdv.evenementiel || {ca:0};
          moisCache[k] = {...moisCache[k], pdv: {...moisCache[k].pdv, evenementiel: {ca:(n(ev.ca)+part)}}};
        }
      }
      if(op._learnKeyword){
        await saveImportRule(op._learnKeyword, { type:op.type, pdvId:op.pdvId, catId:op.catId, label:op.label, lissage:op.lissage||"ponctuel", nbMois:op.nbMois });
      }
    }

    // 3. S'assurer que la catégorie "frais_cb" existe dans chaque pdvCats concerné
    let newPdvCats = {...freshDataForImport.pdvCats};
    const pdvIdsUsed = new Set(ops.filter(o=>o.type==="pdv"&&o.catId==="frais_cb").map(o=>o.pdvId));
    pdvIdsUsed.forEach(pid=>{
      const cats=newPdvCats[pid]||[];
      if(!cats.find(c=>c.id==="frais_cb")){
        newPdvCats[pid] = [...cats, {id:"frais_cb",groupe:"g62",label:"Frais bancaires (tenue de compte, TPE)",type:"variable",montantFixe:0}];
      }
    });

    // 4bis. Enregistrer le résultat du rapprochement bancaire de cet import
    // (Vérification A uniquement — objective, indépendante du classement)
    // dans un petit journal consultable ensuite dans l'onglet dédié.
    if(rapprochement && rapprochement.verifSolde.possible){
      const entry = {
        id: uid(),
        date: todayKey(),
        dateLabel: new Date().toLocaleDateString("fr-FR"),
        coherent: rapprochement.verifSolde.coherent,
        ecart: rapprochement.verifSolde.ecart,
        soldeTheorique: rapprochement.verifSolde.soldeTheorique,
        soldeAnnonce: rapprochement.verifSolde.soldeAnnonce,
        chevauchementDetecte: rapprochement.verifSolde.chevauchementDetecte,
        nbLignesExclues: rapprochement.verifSolde.nbLignesExclues,
        nbLignes: effectiveRows.length,
        nbCreditsInhabituels: rapprochement.creditsInhabituelsNonClasses.length,
      };
      const startMois = moisCache[startKey];
      moisCache[startKey] = {...startMois, pdv:{...startMois.pdv, _rapprochements:[...(startMois.pdv._rapprochements||[]), entry]}};
    }

    // 4. Sauvegarder tous les mois touchés + pdvCats si modifiés
    for(const [key,moisObj] of Object.entries(moisCache)){
      await saveMoisToSupabase(key, moisObj);
    }
    const newData = {...freshDataForImport, pdvCats:newPdvCats};
    await saveAppDataToSupabase(newData);

    // 5. Mémoriser l'empreinte de toutes les lignes de ce relevé pour détecter les doublons futurs
    await markRowsImported(rows);

    setApplied({ count: ops.length, total: ops.reduce((s,o)=>s+o.montant,0) });
    onApplied(newData, moisCache[startKey]);
  };

  if(loadingRules) return <Card pad={24}><div style={{color:C.textMuted,fontSize:13}}>Chargement des règles…</div></Card>;

  if(applied) return (
    <Card style={{textAlign:"center"}} pad={32}>
      <div style={{fontSize:44,marginBottom:10}}>✅</div>
      <div style={{fontWeight:800,fontSize:18,color:C.primary,marginBottom:6}}>Import terminé</div>
      <div style={{fontSize:13,color:C.textMuted}}>{applied.count} dépense(s) classée(s) · {applied.total.toLocaleString("fr-FR")} € au total</div>
      <button onClick={()=>{setApplied(null);setRows(null);setText("");}} style={{...base,marginTop:18,background:C.primary,color:"#fff",border:"none",borderRadius:10,padding:"11px 20px",fontWeight:600,cursor:"pointer"}}>Nouvel import</button>
    </Card>
  );

  if(!rows) return (
    <div>
      <Card style={{marginBottom:16}}>
        <SectionHead>📥 Importer un relevé CIC</SectionHead>
        <div style={{fontSize:12,color:C.textMuted,marginBottom:12}}>
          Téléchargez votre relevé en CSV depuis votre espace CIC, puis importez-le ici. L'app classe automatiquement les dépenses connues et vous demande pour les nouvelles. Les lignes liées aux TPE (encaissements CB) sont ignorées car votre CA est déjà saisi via les clôtures de caisse.
        </div>
        <input type="file" accept=".csv,.txt" onChange={handleFile}
          style={{...base,marginBottom:12,fontSize:13}}/>
        <div style={{fontSize:11,color:C.textLight,marginBottom:10}}>— ou collez le contenu directement —</div>
        <textarea value={text} onChange={e=>setText(e.target.value)} rows={6} placeholder="Collez ici le contenu du fichier CSV…"
          style={{...base,width:"100%",padding:10,borderRadius:8,border:`1.5px solid ${C.border}`,fontFamily:"monospace",fontSize:11,outline:"none"}}/>
        <button onClick={analyser} disabled={!text.trim()}
          style={{...base,marginTop:12,background:text.trim()?C.primary:"#ccc",color:"#fff",border:"none",borderRadius:10,padding:"11px 22px",fontWeight:700,cursor:text.trim()?"pointer":"not-allowed"}}>
          Analyser le fichier
        </button>
      </Card>
    </div>
  );


  return <div>
    {checkingDup && <Card style={{marginBottom:16,background:C.bg}} pad={14}>
      <div style={{fontSize:12,color:C.textMuted}}>🔍 Vérification des doublons avec les imports précédents…</div>
    </Card>}

    {duplicateRows.length>0 && <Card style={{marginBottom:16,background:C.redLight,border:`1px solid ${C.red}33`}}>
      <SectionHead>⚠️ Doublons détectés ({duplicateRows.length})</SectionHead>
      <div style={{fontSize:12,color:C.textMuted,marginBottom:10}}>
        Ces lignes correspondent exactement à des transactions déjà importées précédemment (même date, même libellé, même montant) — probablement parce que la période se chevauche avec un import antérieur. Elles sont exclues par défaut.
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {duplicateRows.map(r=>(
          <label key={r.id} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,background:C.white,borderRadius:8,padding:"8px 10px",cursor:"pointer"}}>
            <input type="checkbox" checked={!!forceInclude[r.id]} onChange={e=>setForceInclude(f=>({...f,[r.id]:e.target.checked}))}/>
            <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.dateOp} · {r.libelle}</span>
            <strong>{(r.debit||r.credit).toLocaleString("fr-FR")} €</strong>
          </label>
        ))}
      </div>
      <div style={{fontSize:11,color:C.textLight,marginTop:8}}>Cochez une ligne pour l'inclure malgré tout si elle n'est pas réellement un doublon.</div>
    </Card>}

    <Card style={{background:C.primaryLight,marginBottom:16}} pad={14}>
      <div style={{fontSize:13,fontWeight:700,color:C.primary}}>📊 {effectiveRows.length} ligne(s) à traiter{duplicateRows.length>0?` · ${duplicateRows.length} doublon(s) exclu(s)`:""}</div>
      <div style={{fontSize:12,color:C.textMuted,marginTop:4}}>
        {reconnues.length} reconnues automatiquement · {ignorees.length} ignorées (CA déjà saisi) · {aClasser.length} à classer
      </div>
    </Card>

    {/* Rapprochement bancaire — Vérification A (solde) + B (exhaustivité) */}
    {rapprochement && <Card style={{marginBottom:16, background: rapprochement.verifSolde.possible ? (rapprochement.verifSolde.coherent?C.greenLight:C.redLight) : C.bg, border: rapprochement.verifSolde.possible ? `1px solid ${rapprochement.verifSolde.coherent?C.green:C.red}33` : `1px solid ${C.border}`}}>
      <SectionHead>🔍 Rapprochement bancaire</SectionHead>
      {rapprochement.verifSolde.possible ? (
        rapprochement.verifSolde.coherent ? (
          <div>
            <div style={{fontSize:13,color:C.green,fontWeight:600}}>✅ Solde cohérent avec le relevé — le fichier a été lu en entier, sans écart.</div>
            {rapprochement.verifSolde.chevauchementDetecte && <div style={{fontSize:11,color:C.textMuted,marginTop:4}}>
              ℹ️ Chevauchement avec un import précédent détecté et pris en compte automatiquement ({rapprochement.verifSolde.nbLignesExclues} ligne(s) déjà connue(s) exclues du calcul).
            </div>}
          </div>
        ) : (
          <div>
            <div style={{fontSize:13,color:C.red,fontWeight:700,marginBottom:6}}>⚠️ Écart de {rapprochement.verifSolde.ecart.toLocaleString("fr-FR")} € détecté avec le solde du relevé.</div>
            <div style={{fontSize:12,color:C.textMuted,marginBottom:8}}>
              Solde théorique calculé : {rapprochement.verifSolde.soldeTheorique.toLocaleString("fr-FR")} € · Solde annoncé par la banque : {rapprochement.verifSolde.soldeAnnonce.toLocaleString("fr-FR")} €.
              {rapprochement.verifSolde.chevauchementDetecte && ` (${rapprochement.verifSolde.nbLignesExclues} ligne(s) de chevauchement déjà exclues du calcul.)`}
            </div>
            <div style={{fontSize:11,color:C.textMuted,background:C.white,borderRadius:8,padding:"8px 10px"}}>
              <strong>Que faire ?</strong> Cet écart ne dépend pas de la façon dont vous classez vos dépenses — il indique un souci avec le fichier lui-même. Vérifiez dans l'ordre :
              <br/>1. Que la période exportée depuis CIC ne laisse aucun trou avec le précédent import.
              <br/>2. Que le fichier n'a pas été coupé ou tronqué à l'export.
              <br/>3. Si le doute persiste, ré-exportez un CSV frais et réimportez-le (les doublons seront automatiquement exclus).
            </div>
          </div>
        )
      ) : (
        <div style={{fontSize:12,color:C.textMuted}}>ℹ️ Ce relevé ne contient pas de colonne Solde exploitable — vérification du solde non disponible pour cet import.</div>
      )}
      {rapprochement.creditsInhabituelsNonClasses.length>0 && <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
        <div style={{fontSize:12,fontWeight:600,color:C.accent}}>⚠️ {rapprochement.creditsInhabituelsNonClasses.length} encaissement(s) inhabituel(s) à vérifier</div>
        <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>Ni un règlement CB/SumUp ni un dépôt d'espèces — probablement un remboursement fournisseur ou similaire. Classez-les ci-dessous dans "💰 Encaissements à classer".</div>
      </div>}
    </Card>}

    {reconnues.length>0 && <Card style={{marginBottom:16}}>
      <SectionHead>🟢 Classées automatiquement</SectionHead>
      <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:240,overflowY:"auto"}}>
        {reconnues.map(c=>(
          <div key={c.row.id} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"6px 0",borderBottom:`1px solid ${C.border}`}}>
            <span style={{color:C.textMuted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"60%"}}>{c.row.libelle}</span>
            <span style={{fontWeight:600}}>{c.auto.label||c.auto.catId} · {c.auto.montant.toLocaleString("fr-FR")} €</span>
          </div>
        ))}
      </div>
    </Card>}

    {aClasser.length>0 && <Card style={{marginBottom:16}}>
      <SectionHead>🔴 À classer ({aClasser.length})</SectionHead>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {aClasser.map(c=>{
          const choix=pending[c.row.id]||{type:"ignore"};
          const isMulti = choix.type==="multi";
          return <div key={c.row.id} style={{background:C.bg,borderRadius:10,padding:12}}>
            <div style={{fontSize:12,fontWeight:600,marginBottom:2}}>{c.row.libelle}</div>
            <div style={{fontSize:11,color:C.textMuted,marginBottom:8}}>{c.row.dateOp} · {c.row.debit.toLocaleString("fr-FR")} €</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:isMulti?10:0}}>
              <select value={choix.type==="labo"?"labo":choix.type==="pdv"?`pdv:${choix.pdvId}`:choix.type==="multi"?"multi":"ignore"}
                onChange={e=>{
                  const v=e.target.value;
                  if(v==="ignore") setPend(c.row.id,{type:"ignore"});
                  else if(v==="labo") setPend(c.row.id,{type:"labo",catId:allCatsLabo[0]?.id,label:allCatsLabo[0]?.label,lissage:"ponctuel"});
                  else if(v==="multi"){
                    const repartition=PDV_LIST.map(p=>({pdvId:p.id,montant:"",catId:(data.pdvCats[p.id]||[])[0]?.id}));
                    setPend(c.row.id,{type:"multi",repartition,lissage:"ponctuel"});
                  }
                  else { const pdvId=v.split(":")[1]; const cats=data.pdvCats[pdvId]||[]; setPend(c.row.id,{type:"pdv",pdvId,catId:cats[0]?.id,label:cats[0]?.label,lissage:"ponctuel"}); }
                }}
                style={{...base,padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:12}}>
                <option value="ignore">Ignorer</option>
                <option value="labo">🏭 Charge du Labo</option>
                {PDV_LIST.map(p=><option key={p.id} value={`pdv:${p.id}`}>{p.emoji} {p.nom}</option>)}
                <option value="multi">🔀 Répartir sur plusieurs PDV</option>
              </select>

              {choix.type==="labo" && <select value={choix.catId} onChange={e=>{const cat=allCatsLabo.find(c2=>c2.id===e.target.value);setPend(c.row.id,{...choix,catId:cat.id,label:cat.label});}}
                style={{...base,padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:12}}>
                <CatOptions cats={allCatsLabo}/>
              </select>}

              {choix.type==="pdv" && <select value={choix.catId} onChange={e=>{const cats=data.pdvCats[choix.pdvId]||[];const cat=cats.find(c2=>c2.id===e.target.value);setPend(c.row.id,{...choix,catId:cat.id,label:cat.label});}}
                style={{...base,padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:12}}>
                <CatOptions cats={data.pdvCats[choix.pdvId]||[]}/>
              </select>}

              {choix.type!=="ignore" && choix.type!=="multi" && <select value={choix.lissage||"ponctuel"} onChange={e=>setPend(c.row.id,{...choix,lissage:e.target.value})}
                style={{...base,padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:12}}>
                <option value="ponctuel">Ponctuel (ce mois)</option>
                <option value="trimestriel">Trimestriel (÷3)</option>
                <option value="annuel">Annuel (÷12)</option>
              </select>}
            </div>

            {/* Interface multi-PDV */}
            {isMulti && <div style={{background:C.white,borderRadius:8,padding:10,border:`1px solid ${C.border}`}}>
              <div style={{fontSize:11,color:C.textMuted,marginBottom:8}}>
                Saisissez le montant pour chaque point de vente concerné (total : {c.row.debit.toLocaleString("fr-FR")} €) — laissez 0 pour les autres.
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {choix.repartition.map((r,ri)=>{
                  const cats=data.pdvCats[r.pdvId]||[];
                  const pdv=PDV_LIST.find(p=>p.id===r.pdvId);
                  if(!pdv) return null;
                  return <div key={r.pdvId} style={{display:"grid",gridTemplateColumns:"1fr 120px 140px",gap:8,alignItems:"center"}}>
                    <div style={{fontSize:12,fontWeight:500}}>{pdv.emoji} {pdv.nom}</div>
                    <div style={{position:"relative"}}>
                      <span style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",color:C.textLight,fontSize:11}}>€</span>
                      <input type="number" min="0" step="0.01" value={r.montant||""} placeholder="0"
                        onChange={e=>{
                          const newRep=choix.repartition.map((x,xi)=>xi===ri?{...x,montant:e.target.value}:x);
                          setPend(c.row.id,{...choix,repartition:newRep});
                        }}
                        style={{...base,width:"100%",padding:"6px 8px 6px 22px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,outline:"none"}}/>
                    </div>
                    <select value={r.catId} onChange={e=>{
                        const newRep=choix.repartition.map((x,xi)=>xi===ri?{...x,catId:e.target.value}:x);
                        setPend(c.row.id,{...choix,repartition:newRep});
                      }}
                      style={{...base,padding:"6px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11}}>
                      <CatOptions cats={cats}/>
                    </select>
                  </div>;
                })}
              </div>
              {/* Total saisi vs total réel */}
              {(()=>{
                const totalSaisi=choix.repartition.reduce((s,r)=>s+n(r.montant),0);
                const reste=c.row.debit-totalSaisi;
                return <div style={{marginTop:8,fontSize:11,fontWeight:600,color:Math.abs(reste)<0.01?C.green:C.accent}}>
                  {Math.abs(reste)<0.01?"✅ Total correctement réparti":`⚠️ Reste à répartir : ${reste.toLocaleString("fr-FR")} €`}
                </div>;
              })()}
              <div style={{marginTop:8}}>
                <select value={choix.lissage||"ponctuel"} onChange={e=>setPend(c.row.id,{...choix,lissage:e.target.value})}
                  style={{...base,padding:"6px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:12}}>
                  <option value="ponctuel">Ponctuel (ce mois)</option>
                  <option value="trimestriel">Trimestriel (÷3)</option>
                  <option value="annuel">Annuel (÷12)</option>
                </select>
              </div>
            </div>}
          </div>;
        })}
      </div>
    </Card>}

    {totalComCB>0 && <Card style={{marginBottom:16,background:C.fixeLight,border:`1px solid ${C.fixe}33`}}>
      <SectionHead>💳 Commissions CB — {totalComCB.toLocaleString("fr-FR")} €</SectionHead>
      {totalCbGlobal>0 ? (
        <div>
          <div style={{fontSize:12,color:C.textMuted,marginBottom:10}}>Réparties au prorata du CB encaissé par chaque point de vente ce mois-ci :</div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {PDV_LIST.filter(p=>cbParPdv[p.id]>0).map(p=>{
              const part = totalComCB * (cbParPdv[p.id]/totalCbGlobal);
              return <div key={p.id} style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                <span>{p.emoji} {p.nom} <span style={{color:C.textLight}}>({(cbParPdv[p.id]/totalCbGlobal*100).toFixed(0)}% du CB)</span></span>
                <strong>{part.toLocaleString("fr-FR")} €</strong>
              </div>;
            })}
          </div>
        </div>
      ) : (
        <div style={{fontSize:12,color:C.accent}}>⚠️ Aucun encaissement CB trouvé dans les clôtures de ce mois — impossible de répartir. Vérifiez que vos vendeurs ont bien saisi leurs clôtures avant d'importer.</div>
      )}
    </Card>}

    {credits.length>0 && <Card style={{marginBottom:16,background:C.variableLight}}>
      <SectionHead>💰 Encaissements à classer ({credits.length})</SectionHead>
      <div style={{fontSize:12,color:C.textMuted,marginBottom:10}}>Virements reçus hors TPE/Sumup — par exemple un règlement client pour un événement.</div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {credits.map(c=>{
          const choix=pending[c.row.id]||{type:"ignore"};
          return <div key={c.row.id} style={{background:C.white,borderRadius:10,padding:12}}>
            <div style={{fontSize:12,fontWeight:600,marginBottom:2}}>{c.row.libelle}</div>
            <div style={{fontSize:11,color:C.textMuted,marginBottom:8}}>{c.row.dateOp} · +{c.row.credit.toLocaleString("fr-FR")} €</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <select value={choix.type==="ca_event"?"event":"ignore"}
                onChange={e=>{
                  if(e.target.value==="ignore") setPend(c.row.id,{type:"ignore"});
                  else setPend(c.row.id,{type:"ca_event",label:"Événementiel"});
                }}
                style={{...base,padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:12}}>
                <option value="ignore">Ignorer</option>
                <option value="event">🎉 Événementiel</option>
              </select>
            </div>
          </div>;
        })}
      </div>
    </Card>}

    <button onClick={validerTout} style={{...base,width:"100%",background:C.primary,color:"#fff",border:"none",borderRadius:12,padding:15,fontWeight:700,fontSize:15,cursor:"pointer"}}>
      Valider et appliquer ({reconnues.length + aClasser.filter(c=>pending[c.row.id]&&pending[c.row.id].type!=="ignore").length + credits.filter(c=>pending[c.row.id]&&pending[c.row.id].type!=="ignore").length + (totalComCB>0&&totalCbGlobal>0?PDV_LIST.filter(p=>cbParPdv[p.id]>0).length:0)} opérations)
    </button>
  </div>;
}

// ─── CLÔTURES DU JOUR (vue patron) ───────────────────────────────────────────
// ─── PANNEAU DÉPENSES (saisie manuelle par le patron) ────────────────────────
function PanneauDepenses({data, md, onUpdateMois}){
  const [form,setForm]=useState({montant:"",modeId:data.paiements[0]?.id||"",scope:"labo",pdvId:PDV_LIST[0]?.id,catId:data.laboCats[0]?.id});
  const [reclassant,setReclassant]=useState(null); // dépense en cours de reclassement
  const [reclassForm,setReclassForm]=useState({scope:"labo",pdvId:PDV_LIST[0]?.id,catId:""});

  const catsDisponibles = form.scope==="labo" ? data.laboCats : (data.pdvCats[form.pdvId]||[]);
  const reclassCats = reclassant ? (reclassForm.scope==="labo" ? data.laboCats : (data.pdvCats[reclassForm.pdvId]||[])) : [];

  // CORRECTIF ANTI-ÉCRASEMENT : chaque mutation part désormais d'un mutateur
  // fonctionnel appliqué par onUpdateMois (= upd) sur le mois FRAIS rechargé
  // depuis Supabase, jamais sur `md` capturé au moment du rendu.
  const ajouter = ()=>{
    if(!n(form.montant)) return;
    const cat = catsDisponibles.find(c=>c.id===form.catId) || catsDisponibles[0];
    const mode = data.paiements.find(p=>p.id===form.modeId);
    const pdvInfo = PDV_LIST.find(p=>p.id===form.pdvId);
    const montant = n(form.montant);
    onUpdateMois(freshMois=>{
      let laboCh = {...freshMois.laboCh};
      let pdvObj = {...freshMois.pdv};
      if(form.scope==="labo"){
        laboCh[cat.id] = n(laboCh[cat.id]) + montant;
      } else {
        const pm = pdvObj[form.pdvId];
        pdvObj = {...pdvObj, [form.pdvId]: {...pm, vars:{...pm.vars, [cat.id]:(n(pm.vars?.[cat.id])+montant)}}};
      }
      const log = {
        id:uid(), date:todayKey(), dateLabel:new Date().toLocaleDateString("fr-FR"),
        vendeurNom:"Patron (saisie manuelle)", pdvId:form.scope==="pdv"?form.pdvId:null,
        pdvLabel:form.scope==="pdv"?pdvInfo?.full:null,
        montant, modeLabel:mode?.label||"—", scope:form.scope, catLabel:cat?.label||"Autre", catId:cat?.id
      };
      pdvObj = {...pdvObj, _depenses:[...(freshMois.pdv._depenses||[]), log]};
      return {...freshMois, laboCh, pdv:pdvObj};
    });
    setForm({...form, montant:""});
  };

  const supprimer = (dep)=>{
    onUpdateMois(freshMois=>{
      let laboCh = {...freshMois.laboCh};
      let pdvObj = {...freshMois.pdv};
      if(dep.scope==="labo"){
        laboCh[dep.catId] = Math.max(0, n(laboCh[dep.catId]) - dep.montant);
      } else {
        const pm = pdvObj[dep.pdvId];
        if(pm) pdvObj = {...pdvObj, [dep.pdvId]: {...pm, vars:{...pm.vars, [dep.catId]:Math.max(0,n(pm.vars?.[dep.catId])-dep.montant)}}};
      }
      pdvObj = {...pdvObj, _depenses:(freshMois.pdv._depenses||[]).filter(d=>d.id!==dep.id)};
      return {...freshMois, laboCh, pdv:pdvObj};
    });
  };

  const sauvegarderReclassement = ()=>{
    if(!reclassant) return;
    const cats = reclassForm.scope==="labo" ? data.laboCats : (data.pdvCats[reclassForm.pdvId]||[]);
    const cat = cats.find(c=>c.id===reclassForm.catId) || cats[0];
    const pdvInfo = PDV_LIST.find(p=>p.id===reclassForm.pdvId);
    onUpdateMois(freshMois=>{
      // 1. Retirer l'ancien montant
      let laboCh = {...freshMois.laboCh};
      let pdvObj = {...freshMois.pdv};
      if(reclassant.scope==="labo"){
        laboCh[reclassant.catId] = Math.max(0, n(laboCh[reclassant.catId]) - reclassant.montant);
      } else if(reclassant.pdvId){
        const pm = pdvObj[reclassant.pdvId];
        if(pm) pdvObj = {...pdvObj, [reclassant.pdvId]: {...pm, vars:{...pm.vars, [reclassant.catId]:Math.max(0,n(pm.vars?.[reclassant.catId])-reclassant.montant)}}};
      }
      // 2. Ajouter dans la nouvelle catégorie
      if(reclassForm.scope==="labo"){
        laboCh[cat.id] = n(laboCh[cat.id]) + reclassant.montant;
      } else {
        const pm = pdvObj[reclassForm.pdvId];
        pdvObj = {...pdvObj, [reclassForm.pdvId]: {...pm, vars:{...pm.vars, [cat.id]:(n(pm.vars?.[cat.id])+reclassant.montant)}}};
      }
      // 3. Mettre à jour le log
      const newLog = {...reclassant, scope:reclassForm.scope, catId:cat.id, catLabel:cat.label,
        pdvId:reclassForm.scope==="pdv"?reclassForm.pdvId:null,
        pdvLabel:reclassForm.scope==="pdv"?pdvInfo?.full:null};
      pdvObj = {...pdvObj, _depenses:(freshMois.pdv._depenses||[]).map(d=>d.id===reclassant.id?newLog:d)};
      return {...freshMois, laboCh, pdv:pdvObj};
    });
    setReclassant(null);
  };

  const toutesDepenses = [...(md.pdv._depenses||[])].reverse();
  const totalMois = toutesDepenses.reduce((s,d)=>s+n(d.montant),0);
  const aClasser = toutesDepenses.filter(d=>d.catId==="autre"||d.catLabel==="À classer"||d.catLabel==="Autres");

  return <div>
    {/* Modal de reclassement */}
    {reclassant && <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <Card style={{width:"100%",maxWidth:420}} pad={20}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>🔄 Reclasser cette dépense</div>
        <div style={{fontSize:12,color:C.textMuted,marginBottom:16}}>
          {reclassant.dateLabel} · {reclassant.modeLabel} · <strong>{n(reclassant.montant).toLocaleString("fr-FR")} €</strong>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div>
            <Label>Affecter à</Label>
            <select value={reclassForm.scope==="labo"?"labo":`pdv:${reclassForm.pdvId}`}
              onChange={e=>{
                const v=e.target.value;
                if(v==="labo") setReclassForm({...reclassForm,scope:"labo",catId:data.laboCats[0]?.id});
                else { const pdvId=v.split(":")[1]; setReclassForm({...reclassForm,scope:"pdv",pdvId,catId:(data.pdvCats[pdvId]||[])[0]?.id}); }
              }}
              style={{...base,width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,outline:"none",fontSize:13}}>
              <option value="labo">🏭 Laboratoire</option>
              {PDV_LIST.map(p=><option key={p.id} value={`pdv:${p.id}`}>{p.emoji} {p.full}</option>)}
            </select>
          </div>
          <div>
            <Label>Catégorie</Label>
            <select value={reclassForm.catId} onChange={e=>setReclassForm({...reclassForm,catId:e.target.value})}
              style={{...base,width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,outline:"none",fontSize:13}}>
              <CatOptions cats={reclassCats}/>
            </select>
          </div>
        </div>
        <div style={{display:"flex",gap:10,marginTop:16}}>
          <button onClick={()=>setReclassant(null)} style={{...base,flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"11px",fontWeight:600,cursor:"pointer",color:C.textMuted}}>Annuler</button>
          <button onClick={sauvegarderReclassement} style={{...base,flex:2,background:C.primary,color:"#fff",border:"none",borderRadius:10,padding:"11px",fontWeight:700,cursor:"pointer"}}>Reclasser</button>
        </div>
      </Card>
    </div>}

    {/* Alerte À classer */}
    {aClasser.length>0 && <Card style={{background:C.warnLight,border:`1px solid ${C.warn}`,marginBottom:16}} pad={14}>
      <div style={{fontWeight:700,fontSize:13,color:C.accent,marginBottom:6}}>⚠️ {aClasser.length} dépense(s) à reclasser</div>
      <div style={{fontSize:12,color:C.textMuted}}>Ces dépenses sont classées dans "À classer" — cliquez sur "Reclasser" pour les affecter à la bonne catégorie.</div>
    </Card>}

    <Card style={{marginBottom:20}}>
      <SectionHead>➕ Ajouter une dépense manuelle</SectionHead>
      <div style={{fontSize:12,color:C.textMuted,marginBottom:14}}>Pour les dépenses en espèces ou non visibles dans le relevé bancaire.</div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div>
          <Label>Montant</Label>
          <MoneyInput value={form.montant} onChange={v=>setForm({...form,montant:v})}/>
        </div>
        <div>
          <Label>Mode de paiement</Label>
          <select value={form.modeId} onChange={e=>setForm({...form,modeId:e.target.value})}
            style={{...base,width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,outline:"none",fontSize:13}}>
            {data.paiements.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <Label>Affecter à</Label>
          <select value={form.scope==="labo"?"labo":`pdv:${form.pdvId}`}
            onChange={e=>{
              const v=e.target.value;
              if(v==="labo") setForm({...form,scope:"labo",catId:data.laboCats[0]?.id});
              else { const pdvId=v.split(":")[1]; setForm({...form,scope:"pdv",pdvId,catId:(data.pdvCats[pdvId]||[])[0]?.id}); }
            }}
            style={{...base,width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,outline:"none",fontSize:13}}>
            <option value="labo">🏭 Laboratoire</option>
            {PDV_LIST.map(p=><option key={p.id} value={`pdv:${p.id}`}>{p.emoji} {p.full}</option>)}
          </select>
        </div>
        <div>
          <Label>Catégorie</Label>
          <select value={form.catId} onChange={e=>setForm({...form,catId:e.target.value})}
            style={{...base,width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,outline:"none",fontSize:13}}>
            <CatOptions cats={catsDisponibles}/>
          </select>
        </div>
        <button onClick={ajouter} disabled={!n(form.montant)}
          style={{...base,background:n(form.montant)?C.primary:"#ccc",color:"#fff",border:"none",borderRadius:10,padding:"12px",fontWeight:700,fontSize:14,cursor:n(form.montant)?"pointer":"not-allowed"}}>
          + Ajouter la dépense
        </button>
      </div>
    </Card>

    <SectionHead>Dépenses du mois ({toutesDepenses.length}) {totalMois>0&&`· ${totalMois.toLocaleString("fr-FR")} €`}</SectionHead>
    {toutesDepenses.length===0 && <Card pad={24} style={{textAlign:"center"}}><div style={{color:C.textLight,fontSize:13}}>Aucune dépense ce mois-ci</div></Card>}
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {toutesDepenses.map(dep=>{
        const isAClasser = dep.catId==="autre"||dep.catLabel==="À classer"||dep.catLabel==="Autres";
        return <Card key={dep.id} pad={14} style={isAClasser?{border:`1.5px solid ${C.warn}`,background:C.warnLight}:{}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:13,display:"flex",alignItems:"center",gap:6}}>
                {isAClasser && <span style={{fontSize:11,background:C.accent,color:"#fff",borderRadius:4,padding:"1px 6px"}}>À classer</span>}
                {dep.catLabel} {dep.scope==="labo"?"· 🏭 Labo":`· ${dep.pdvLabel||""}`}
              </div>
              <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>{dep.dateLabel} · {dep.vendeurNom} · {dep.modeLabel}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
              <strong style={{fontSize:15,color:isAClasser?C.accent:C.primary}}>{n(dep.montant).toLocaleString("fr-FR")} €</strong>
              <button onClick={()=>{ setReclassant(dep); setReclassForm({scope:dep.scope||"labo",pdvId:dep.pdvId||PDV_LIST[0]?.id,catId:dep.catId||""}); }}
                style={{...base,background:C.primaryLight,color:C.primary,border:"none",borderRadius:7,padding:"6px 10px",cursor:"pointer",fontSize:12,fontWeight:600}}>
                🔄 Reclasser
              </button>
              <button onClick={()=>supprimer(dep)} style={{...base,background:C.redLight,color:C.red,border:"none",borderRadius:7,padding:"6px 10px",cursor:"pointer",fontSize:12,fontWeight:600}}>Suppr.</button>
            </div>
          </div>
        </Card>;
      })}
    </div>
  </div>;
}

// ─── HISTORIQUE DES CLÔTURES + RÉCAP MODES DE PAIEMENT ───────────────────────
// ─── RAPPROCHEMENT BANCAIRE (onglet dédié) ────────────────────────────────────
// Vue consultable à tout moment (indépendamment du moment de l'import) de
// l'état de cohérence du mois affiché : historique des vérifications de solde
// faites à chaque import CSV de ce mois.
function PanneauRapprochement({moisData}){
  const historique = [...(moisData.pdv._rapprochements||[])].reverse();
  const dernier = historique[0];

  return <div>
    <Card style={{marginBottom:20, background: dernier ? (dernier.coherent?C.greenLight:C.redLight) : C.bg, border: dernier ? `1px solid ${dernier.coherent?C.green:C.red}33` : `1px solid ${C.border}`}} pad={20}>
      <div style={{fontSize:11,fontWeight:600,color:C.textMuted,letterSpacing:0.8,textTransform:"uppercase",marginBottom:8}}>État actuel du mois</div>
      {!dernier ? (
        <div style={{fontSize:14,color:C.textMuted}}>Aucun import CSV avec vérification de solde n'a encore été fait ce mois-ci.</div>
      ) : dernier.coherent ? (
        <div>
          <div style={{fontSize:20,fontWeight:800,color:C.green,marginBottom:4}}>✅ Solde cohérent</div>
          <div style={{fontSize:12,color:C.textMuted}}>Dernière vérification le {dernier.dateLabel} — {dernier.nbLignes} lignes lues, aucun écart avec le relevé bancaire.</div>
        </div>
      ) : (
        <div>
          <div style={{fontSize:20,fontWeight:800,color:C.red,marginBottom:4}}>⚠️ Écart de {dernier.ecart.toLocaleString("fr-FR")} €</div>
          <div style={{fontSize:12,color:C.textMuted}}>Détecté le {dernier.dateLabel} — vérifiez que le dernier fichier importé couvre bien toute la période sans coupure.</div>
        </div>
      )}
      {dernier && dernier.nbCreditsInhabituels>0 && <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`,fontSize:12,color:C.accent,fontWeight:600}}>
        ⚠️ {dernier.nbCreditsInhabituels} encaissement(s) inhabituel(s) restaient à vérifier lors du dernier import — pensez à les classer dans l'onglet Import CSV si ce n'est pas déjà fait.
      </div>}
    </Card>

    <SectionHead>Historique des vérifications ({historique.length})</SectionHead>
    {historique.length===0 && <Card pad={24} style={{textAlign:"center"}}><div style={{color:C.textLight,fontSize:13}}>Aucun historique pour ce mois</div></Card>}
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {historique.map(h=>(
        <Card key={h.id} pad={14}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
            <div>
              <div style={{fontWeight:600,fontSize:13}}>{h.coherent?"✅ Solde cohérent":`⚠️ Écart de ${h.ecart.toLocaleString("fr-FR")} €`}</div>
              <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>{h.dateLabel} · {h.nbLignes} lignes{h.nbCreditsInhabituels>0?` · ${h.nbCreditsInhabituels} encaissement(s) inhabituel(s)`:""}</div>
            </div>
            <div style={{fontSize:11,color:C.textLight,textAlign:"right"}}>
              Théorique : {h.soldeTheorique.toLocaleString("fr-FR")} €<br/>
              Relevé : {h.soldeAnnonce.toLocaleString("fr-FR")} €
            </div>
          </div>
        </Card>
      ))}
    </div>
  </div>;
}

function AllClotures({moisData, onUpdateMois}){
  const [filtreDate,setFiltreDate]=useState("");
  const [editing,setEditing]=useState(null); // clôture en cours de modification
  const [editModes,setEditModes]=useState([]);
  const [editNote,setEditNote]=useState("");

  const entries=[];
  PDV_LIST.forEach(p=>{
    (moisData.pdv[p.id]?.clotures||[]).forEach(c=>entries.push({...c,pdvFull:p.full,pdvEmoji:p.emoji}));
  });

  // Récap par mode de paiement
  const recapModes={};
  entries.forEach(c=>{
    c.modes.forEach(m=>{
      const montant=n(m.montant);
      if(montant>0) recapModes[m.label]=(recapModes[m.label]||0)+montant;
    });
  });
  const totalGlobal = Object.values(recapModes).reduce((a,b)=>a+b,0);
  const depensesVendeurs = moisData.pdv._depenses||[];

  // Filtre
  const filtered = filtreDate.trim()
    ? entries.filter(c=>c.dateLabel.includes(filtreDate.trim())||c.pdvFull.toLowerCase().includes(filtreDate.trim().toLowerCase())||c.vendeurNom.toLowerCase().includes(filtreDate.trim().toLowerCase()))
    : entries;
  const sorted = [...filtered].sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));

  // Ouvrir le formulaire de modification
  const ouvrirEdition=(c)=>{
    setEditing(c);
    setEditModes(c.modes.map(m=>({...m})));
    setEditNote(c.note||"");
  };

  // Sauvegarder la clôture modifiée
  // CORRECTIF ANTI-ÉCRASEMENT : mutateur fonctionnel appliqué sur le mois
  // frais rechargé par onUpdateMois, pas sur moisData capturé au rendu.
  const sauvegarderEdition=()=>{
    const newTotal = editModes.reduce((s,m)=>s+n(m.montant),0);
    const updatedCloture = {...editing, modes:editModes, note:editNote, total:newTotal};
    const pdvId = editing.pdvId;
    onUpdateMois(freshMois=>{
      const pdvMois = freshMois.pdv[pdvId];
      const newClotures = (pdvMois.clotures||[]).map(c=>c.id===editing.id?updatedCloture:c);
      const newCa = caDepuisClotures(newClotures);
      const newPdv = {...freshMois.pdv, [pdvId]:{...pdvMois, clotures:newClotures, ca:newCa}};
      return {...freshMois, pdv:newPdv};
    });
    setEditing(null);
  };

  // Supprimer une clôture
  const supprimerCloture=(c)=>{
    onUpdateMois(freshMois=>{
      const pdvMois = freshMois.pdv[c.pdvId];
      const newClotures = (pdvMois.clotures||[]).filter(x=>x.id!==c.id);
      const newCa = caDepuisClotures(newClotures);
      const newPdv = {...freshMois.pdv, [c.pdvId]:{...pdvMois, clotures:newClotures, ca:newCa}};
      return {...freshMois, pdv:newPdv};
    });
  };

  return <div>
    {/* Modal de modification */}
    {editing && <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <Card style={{width:"100%",maxWidth:420,maxHeight:"90vh",overflowY:"auto"}} pad={20}>
        <div style={{fontWeight:700,fontSize:16,marginBottom:4}}>✏️ Modifier la clôture</div>
        <div style={{fontSize:12,color:C.textMuted,marginBottom:16}}>{editing.pdvEmoji} {editing.pdvFull} · {editing.dateLabel} · par {editing.vendeurNom}</div>
        {editModes.map((m,i)=>(
          <div key={m.id} style={{marginBottom:12}}>
            <Label>{m.label}</Label>
            <MoneyInput value={m.montant} onChange={v=>setEditModes(ms=>ms.map((x,j)=>j===i?{...x,montant:v}:x))}/>
          </div>
        ))}
        <div style={{marginBottom:16}}>
          <Label>Note</Label>
          <input value={editNote} onChange={e=>setEditNote(e.target.value)} placeholder="Note optionnelle…"
            style={{...base,width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,outline:"none"}}/>
        </div>
        <div style={{background:C.primaryLight,borderRadius:8,padding:"10px 14px",marginBottom:16,display:"flex",justifyContent:"space-between"}}>
          <span style={{fontSize:13,color:C.primary,fontWeight:600}}>Nouveau total</span>
          <span style={{fontSize:16,fontWeight:800,color:C.primary}}>{editModes.reduce((s,m)=>s+n(m.montant),0).toLocaleString("fr-FR")} €</span>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>setEditing(null)} style={{...base,flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"11px",fontWeight:600,cursor:"pointer",color:C.textMuted}}>Annuler</button>
          <button onClick={sauvegarderEdition} style={{...base,flex:2,background:C.primary,color:"#fff",border:"none",borderRadius:10,padding:"11px",fontWeight:700,cursor:"pointer"}}>Enregistrer</button>
        </div>
      </Card>
    </div>}

    {/* Récap paiements */}
    <Card style={{background:C.primary,marginBottom:20}} pad={18}>
      <div style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.65)",letterSpacing:0.8,textTransform:"uppercase",marginBottom:8}}>Récap par mode de paiement — ce mois</div>
      {totalGlobal>0 ? (
        <div style={{display:"flex",flexWrap:"wrap",gap:14}}>
          {Object.entries(recapModes).map(([label,montant])=>(
            <div key={label}>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.6)"}}>{label}</div>
              <div style={{fontSize:20,fontWeight:800,color:"#fff"}}>{montant.toLocaleString("fr-FR")} €</div>
            </div>
          ))}
          <div style={{marginLeft:"auto",textAlign:"right"}}>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.6)"}}>Total</div>
            <div style={{fontSize:22,fontWeight:800,color:"#fff"}}>{totalGlobal.toLocaleString("fr-FR")} €</div>
          </div>
        </div>
      ) : <div style={{fontSize:13,color:"rgba(255,255,255,0.6)"}}>Aucune clôture ce mois-ci</div>}
    </Card>

    {depensesVendeurs.length>0 && <Card style={{marginBottom:20,background:C.warnLight,border:`1px solid ${C.warn}`}}>
      <SectionHead>💸 Dépenses déclarées par les vendeurs ({depensesVendeurs.length})</SectionHead>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {[...depensesVendeurs].reverse().map(dep=>(
          <div key={dep.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.white,borderRadius:8,padding:"8px 10px",fontSize:12}}>
            <div>
              <strong>{dep.catLabel}</strong> {dep.scope==="labo"?"· 🏭 Labo":`· ${dep.pdvLabel}`}
              <div style={{color:C.textMuted,fontSize:11}}>{dep.dateLabel} · {dep.vendeurNom} · {dep.modeLabel}</div>
            </div>
            <strong style={{color:C.accent}}>{dep.montant.toLocaleString("fr-FR")} €</strong>
          </div>
        ))}
      </div>
    </Card>}

    {/* Filtre */}
    <div style={{marginBottom:14}}>
      <input value={filtreDate} onChange={e=>setFiltreDate(e.target.value)}
        placeholder="🔍 Filtrer par date (ex: 15/06), point de vente ou vendeur…"
        style={{...base,width:"100%",padding:"10px 14px",borderRadius:10,border:`1.5px solid ${C.border}`,outline:"none",fontSize:13}}/>
    </div>

    <SectionHead>{filtreDate?`Résultats (${sorted.length})`:`Historique des clôtures (${sorted.length})`}</SectionHead>
    {sorted.length===0 && <Card pad={24} style={{textAlign:"center"}}><div style={{color:C.textLight,fontSize:13}}>Aucune clôture trouvée</div></Card>}
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {sorted.map(c=>(
        <Card key={c.id} pad={14}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8,flexWrap:"wrap",gap:6}}>
            <div>
              <div style={{fontWeight:600,fontSize:14}}>{c.pdvEmoji} {c.pdvFull}</div>
              <div style={{fontSize:12,color:C.textMuted}}>par {c.vendeurNom} · {c.dateLabel}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{fontWeight:700,fontSize:18,color:C.primary}}>{n(c.total).toLocaleString("fr-FR")} €</div>
              <button onClick={()=>ouvrirEdition(c)} style={{...base,background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:500,color:C.textMuted}}>✏️ Modifier</button>
              <button onClick={()=>{ if(window.confirm("Supprimer cette clôture ?")) supprimerCloture(c); }}
                style={{...base,background:C.redLight,border:"none",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:500,color:C.red}}>✕</button>
            </div>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {c.modes.filter(m=>n(m.montant)>0).map(m=>(
              <span key={m.id} style={{background:C.primaryLight,color:C.primary,borderRadius:6,padding:"3px 10px",fontSize:12,fontWeight:500}}>
                {m.label} : {n(m.montant).toLocaleString("fr-FR")} €
              </span>
            ))}
          </div>
          {c.note&&<div style={{marginTop:8,fontSize:12,color:C.textMuted,fontStyle:"italic"}}>📝 {c.note}</div>}
        </Card>
      ))}
    </div>
  </div>;
}

// ─── CHARGES LIST (réutilisable) ──────────────────────────────────────────────
function ChargesList({cats,onCatChange,varsMois,onVarsChange,title,addLabel="+ Ajouter"}){
  const [del,setDel]=useState(null);
  const [showAll,setShowAll]=useState(false);
  // Par défaut on n'affiche que les sous-catégories renseignées (+ personnalisées)
  const hasValue=c=> n(c.montantFixe)>0 || n(varsMois?.[c.id])>0;
  const visibleCats = showAll ? cats : cats.filter(c=>hasValue(c)||!GROUPES_COMPTA.find(g=>g.id===c.groupe));
  const updCat=(id,f,v)=>onCatChange(cats.map(c=>c.id===id?{...c,[f]:v}:c));
  const updVar=(id,v)=>onVarsChange({...varsMois,[id]:v});
  const add=()=>onCatChange([...cats,{id:uid(),label:"Nouvelle charge",type:"variable",montantFixe:0}]);
  const remove=id=>{onCatChange(cats.filter(c=>c.id!==id));setDel(null);};
  const tF=cats.filter(c=>c.type==="fixe").reduce((s,c)=>s+n(c.montantFixe),0);
  const tV=cats.filter(c=>c.type==="variable").reduce((s,c)=>s+n(varsMois?.[c.id]),0);
  return <div>
    <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
      <div style={{flex:1,minWidth:130,background:C.fixeLight,borderRadius:8,padding:"8px 12px"}}>
        <div style={{fontSize:10,fontWeight:700,color:C.fixe,textTransform:"uppercase"}}>🔒 Fixes</div>
        <div style={{fontSize:18,fontWeight:700,color:C.fixe,marginTop:2}}>{tF.toLocaleString("fr-FR")} €</div>
      </div>
      <div style={{flex:1,minWidth:130,background:C.variableLight,borderRadius:8,padding:"8px 12px"}}>
        <div style={{fontSize:10,fontWeight:700,color:C.variable,textTransform:"uppercase"}}>📈 Variables</div>
        <div style={{fontSize:18,fontWeight:700,color:C.variable,marginTop:2}}>{tV.toLocaleString("fr-FR")} €</div>
      </div>
    </div>
    <SectionHead action={<button onClick={add} style={{...base,background:C.primary,color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}>{addLabel}</button>}>{title} ({cats.length})</SectionHead>
    <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:C.textMuted,marginBottom:12,cursor:"pointer"}}>
      <input type="checkbox" checked={showAll} onChange={e=>setShowAll(e.target.checked)}/>
      Afficher toutes les sous-catégories (y compris celles à 0 €)
    </label>
    <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:8}}>
      {[...GROUPES_COMPTA.map(g=>({hdr:g.label,items:visibleCats.filter(c=>c.groupe===g.id)})),
        {hdr:"Personnalisées",items:visibleCats.filter(c=>!GROUPES_COMPTA.find(g=>g.id===c.groupe))}]
        .filter(sec=>sec.items.length>0)
        .map(sec=><div key={sec.hdr}>
          <div style={{fontSize:11,fontWeight:700,color:C.textMuted,letterSpacing:0.6,textTransform:"uppercase",marginBottom:8,paddingBottom:4,borderBottom:`1px solid ${C.border}`}}>{sec.hdr}</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {sec.items.map(cat=>{
        const isF=cat.type==="fixe";
        return <div key={cat.id} style={{background:isF?C.fixeLight:C.variableLight,border:`1.5px solid ${isF?C.fixe+"33":C.variable+"33"}`,borderRadius:12,padding:14}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <span style={{fontSize:15,flexShrink:0}}>{isF?"🔒":"📈"}</span>
            <input value={cat.label} onChange={e=>updCat(cat.id,"label",e.target.value)} style={{...base,flex:1,border:"none",outline:"none",background:"transparent",fontSize:15,fontWeight:600,minWidth:0}}/>
            {del===cat.id
              ?<div style={{display:"flex",gap:4}}><button onClick={()=>remove(cat.id)} style={{...base,background:C.red,color:"#fff",border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:12,fontWeight:600}}>Suppr.</button><button onClick={()=>setDel(null)} style={{...base,background:C.border,color:C.textMuted,border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:12}}>Annuler</button></div>
              :<button onClick={()=>setDel(cat.id)} style={{...base,background:"transparent",border:`1px solid ${C.border}`,color:C.textLight,cursor:"pointer",fontSize:18,borderRadius:6,width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center"}} onMouseEnter={e=>e.target.style.color=C.red} onMouseLeave={e=>e.target.style.color=C.textLight}>×</button>
            }
          </div>
          <div style={{display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:120}}>
              <Label>{isF?"Montant fixe (tous les mois)":"Montant ce mois"}</Label>
              {isF?<MoneyInput value={cat.montantFixe} onChange={v=>updCat(cat.id,"montantFixe",v)}/>:<MoneyInput value={varsMois?.[cat.id]} onChange={v=>updVar(cat.id,v)}/>}
            </div>
            {isF && <div style={{flex:1,minWidth:120}}>
              <Label>Supplément ce mois</Label>
              <MoneyInput value={varsMois?.[cat.id]} onChange={v=>updVar(cat.id,v)}/>
              {n(varsMois?.[cat.id])>0 && <div style={{fontSize:10,color:C.fixe,marginTop:3}}>Total : {(n(cat.montantFixe)+n(varsMois?.[cat.id])).toLocaleString("fr-FR")} €</div>}
            </div>}
            <div style={{flexShrink:0}}><Label>Type</Label><TypeToggle value={cat.type} onChange={v=>updCat(cat.id,"type",v)}/></div>
          </div>
          {isF&&<div style={{marginTop:8,fontSize:11,color:C.fixe,background:"rgba(59,91,219,0.08)",borderRadius:6,padding:"3px 8px",display:"inline-block"}}>✓ Reporté automatiquement chaque mois</div>}
        </div>;
      })}
          </div>
        </div>)}
    </div>
  </div>;
}

// ─── PANNEAU LABO ─────────────────────────────────────────────────────────────
function PanneauLabo({laboCats,onLaboCatChange,laboCh,onLaboChChange,moisPdv}){
  const total=totalLabo(laboCats,laboCh);
  const rep=repartition(moisPdv);
  const tCA=PDV_LIST.reduce((s,p)=>s+n(moisPdv[p.id]?.ca),0);
  return <div>
    <Card style={{background:C.primary,marginBottom:20}} pad={20}>
      <div style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.65)",letterSpacing:0.8,textTransform:"uppercase",marginBottom:6}}>Charges totales du labo ce mois</div>
      <div style={{fontSize:36,fontWeight:800,color:"#fff",lineHeight:1}}>{total.toLocaleString("fr-FR")} €</div>
      <div style={{fontSize:12,color:"rgba(255,255,255,0.55)",marginTop:8}}>Répartis automatiquement · 50% CA + 50% jours</div>
    </Card>
    <ChargesList cats={laboCats} onCatChange={onLaboCatChange} varsMois={laboCh} onVarsChange={onLaboChChange} title="Charges du laboratoire"/>
    <div style={{height:24}}/>
    <SectionHead>Répartition automatique</SectionHead>
    <div style={{overflowX:"auto"}}>
      <Card pad={0} style={{overflow:"hidden",minWidth:360}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 52px 60px 68px 88px",padding:"10px 14px",background:"#f8f9fa",borderBottom:`1px solid ${C.border}`}}>
          {["Point de vente","Jours","% CA","% Labo","Quote €"].map(h=><div key={h} style={{fontSize:10,fontWeight:600,color:C.textMuted,letterSpacing:0.5,textTransform:"uppercase"}}>{h}</div>)}
        </div>
        {PDV_LIST.map((p,i)=>{
          const ca=n(moisPdv[p.id]?.ca),pctCA=tCA>0?ca/tCA*100:0,pct=rep[p.id],quote=total*pct/100;
          return <div key={p.id} style={{display:"grid",gridTemplateColumns:"1fr 52px 60px 68px 88px",padding:"10px 14px",borderBottom:i<PDV_LIST.length-1?`1px solid ${C.border}`:"none",background:i%2===0?C.white:"#fafafa",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,fontSize:13,fontWeight:500}}><span>{p.emoji}</span>{p.nom}</div>
            <div style={{fontSize:12,color:C.textMuted,textAlign:"center"}}>{p.j}j</div>
            <div style={{fontSize:12,color:C.textMuted,textAlign:"center"}}>{pctCA.toFixed(1)}%</div>
            <div style={{fontSize:13,fontWeight:700,color:C.primary,textAlign:"center"}}>{pct.toFixed(1)}%</div>
            <div style={{fontSize:12,fontWeight:600,textAlign:"right",color:quote>0?C.text:C.textLight}}>{Math.round(quote).toLocaleString("fr-FR")} €</div>
          </div>;
        })}
      </Card>
    </div>
  </div>;
}

// ─── PANNEAU PDV ──────────────────────────────────────────────────────────────
function PanneauPDV({pdvMois,onPdvChange,pdvCats,onPdvCatChange,tLabo,info,pct}){
  const c=calcPDV(pdvMois,pdvCats,pct,tLabo);
  const clotures=pdvMois.clotures||[];
  return <div>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:18,flexWrap:"wrap"}}>
      <span style={{background:C.primaryLight,color:C.primary,borderRadius:20,padding:"3px 12px",fontSize:12,fontWeight:600}}>{info.jours}</span>
      <span style={{fontSize:12,color:C.textMuted}}>— {info.j}j/sem</span>
    </div>
    <Card style={{background:C.warnLight,border:`1px solid ${C.warn}`,marginBottom:20}} pad={16}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <div><div style={{fontSize:11,fontWeight:700,color:C.accent,textTransform:"uppercase",marginBottom:4}}>Quote-part labo — automatique</div>
        <div style={{fontSize:12,color:C.textMuted}}>{pct.toFixed(2)}% · méthode 50/50</div></div>
        <div style={{fontSize:26,fontWeight:800,color:C.accent}}>{Math.round(c.ql).toLocaleString("fr-FR")} €</div>
      </div>
    </Card>
    <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
      <KPICard label="CA du mois" value={`${c.ca.toLocaleString("fr-FR")} €`} accent/>
      <KPICard label="Résultat net" value={`${c.res.toLocaleString("fr-FR")} €`} sub={<Badge val={c.pctNet}/>} color={c.res>=0?C.green:C.red}/>
      <KPICard label="Seuil équilibre" value={`${Math.round(c.seuil).toLocaleString("fr-FR")} €`} sub={<span style={{fontSize:12,fontWeight:600,color:c.ca>=c.seuil?C.green:C.accent}}>{c.ca>=c.seuil?"✅ Atteint":"⚠️ Non atteint"}</span>}/>
    </div>

    {/* Clôtures du mois */}
    {clotures.length>0&&<Card style={{marginBottom:16}}>
      <SectionHead>📋 Clôtures du mois ({clotures.length})</SectionHead>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {[...clotures].reverse().map(cl=>(
          <div key={cl.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
            <div><div style={{fontSize:13,fontWeight:500}}>{cl.dateLabel}</div><div style={{fontSize:11,color:C.textMuted}}>par {cl.vendeurNom}</div></div>
            <div style={{fontWeight:700,fontSize:15,color:C.primary}}>{n(cl.total).toLocaleString("fr-FR")} €</div>
          </div>
        ))}
      </div>
    </Card>}

    <ChargesList cats={pdvCats} onCatChange={onPdvCatChange} varsMois={pdvMois.vars} onVarsChange={v=>onPdvChange({...pdvMois,vars:v})} title="📋 Charges directes" addLabel="+ Ajouter"/>
    <Card style={{marginTop:16}}>
      <SectionHead>Décomposition</SectionHead>
      {[["CA",c.ca,C.text,false],["− Charges directes",-c.dir,C.red,false],["− Quote-part labo",-c.ql,C.accent,false],["= Résultat",c.res,c.res>=0?C.green:C.red,true]].map(([l,v,col,b],i,arr)=>(
        <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:i<arr.length-1?`1px solid ${C.border}`:"none"}}>
          <span style={{fontSize:13,color:b?C.text:C.textMuted,fontWeight:b?600:400}}>{l}</span>
          <span style={{fontSize:b?16:13,fontWeight:b?700:500,color:col}}>{v>=0?"+":""}{v.toLocaleString("fr-FR")} €</span>
        </div>
      ))}
    </Card>
  </div>;
}

// ─── CASCADE RÉSULTAT (CA → Marge brute → Résultat net) ──────────────────────
// Vue compacte, sans jargon, qui montre le chemin entre le CA et le résultat
// net : où l'argent part, étape par étape. Objectif : qu'un chef d'entreprise
// comprenne en 5 secondes d'où vient un résultat net éloigné du CA, sans
// avoir à ouvrir chaque point de vente un par un.
function CascadeResultat({tCA, totalMat, tMB, autresChargesLabo, totalChargesPDV, tNet}){
  const rows = [
    { label:"CA total", val:tCA, kind:"start" },
    { label:"− Matières premières", val:-totalMat, kind:"neg" },
    { label:"= Marge brute", val:tMB, kind:"subtotal" },
    { label:"− Autres charges labo (loyers, salaires, assurances...)", val:-autresChargesLabo, kind:"neg" },
    { label:"− Charges directes des points de vente", val:-totalChargesPDV, kind:"neg" },
    { label:"= Résultat net", val:tNet, kind:"total" },
  ];
  const maxAbs = Math.max(...rows.map(r=>Math.abs(r.val)), 1);
  return <Card style={{marginBottom:20}}>
    <SectionHead>🧭 D'où vient ce résultat ?</SectionHead>
    <div style={{display:"flex",flexDirection:"column",gap:2}}>
      {rows.map((r,i)=>{
        const isBold = r.kind==="subtotal"||r.kind==="total"||r.kind==="start";
        const color = r.kind==="neg" ? C.red : (r.val>=0?C.primary:C.red);
        const barPct = Math.min(100, Math.abs(r.val)/maxAbs*100);
        return <div key={i} style={{padding:"8px 0",borderTop:r.kind==="subtotal"||r.kind==="total"?`1.5px solid ${C.border}`:"none"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <span style={{fontSize:13,fontWeight:isBold?700:400,color:isBold?C.text:C.textMuted}}>{r.label}</span>
            <span style={{fontSize:isBold?15:13,fontWeight:isBold?700:600,color}}>
              {r.val>=0&&r.kind!=="neg"?"":r.val<0?"":"+"}{r.val.toLocaleString("fr-FR",{maximumFractionDigits:0})} €
            </span>
          </div>
          <div style={{background:C.bg,borderRadius:3,height:5,overflow:"hidden"}}>
            <div style={{width:`${barPct}%`,height:"100%",borderRadius:3,background:r.kind==="neg"?C.accent:(r.val>=0?C.primaryMuted:C.red),transition:"width 0.5s"}}/>
          </div>
        </div>;
      })}
    </div>
  </Card>;
}

// ─── TOP CHARGES (identification des postes dominants pour agir dessus) ──────
// Classement des plus grosses charges du mois, tous PDV + labo confondus,
// avec comparaison à la moyenne des 3 mois précédents pour repérer d'un coup
// d'œil un poste qui dérive (ex: loyer trimestriel mal lissé, dépense
// dupliquée...). C'est le cœur de l'outil de pilotage : voir vite où va
// l'argent pour pouvoir agir dessus.
function TopChargesPanel({rows, tCA}){
  if(rows.length===0) return null;
  const maxMontant = Math.max(...rows.map(r=>r.montant), 1);
  return <Card style={{marginBottom:20}}>
    <SectionHead>🔎 Top charges du mois</SectionHead>
    <div style={{fontSize:11,color:C.textMuted,marginBottom:14}}>
      Les postes qui pèsent le plus ce mois-ci, comparés à leur moyenne des 3 derniers mois. 🔴 = poste en forte hausse (+50% ou plus) à vérifier en priorité.
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {rows.map(r=>{
        const barPct = Math.min(100, r.montant/maxMontant*100);
        const pctCA = tCA>0 ? r.montant/tCA*100 : 0;
        return <div key={r.key}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4,gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0}}>
              {r.isAnomalie && <span title="Forte hausse vs les 3 derniers mois" style={{fontSize:13,flexShrink:0}}>🔴</span>}
              <span style={{fontSize:13,fontWeight:500,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.label}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
              {r.ecartPct!==null && <span style={{fontSize:11,fontWeight:600,color:r.isAnomalie?C.red:(r.ecartPct<0?C.green:C.textLight)}}>
                {r.ecartPct>0?"+":""}{r.ecartPct.toFixed(0)}%
              </span>}
              <span style={{fontSize:13,fontWeight:700,color:C.text,minWidth:80,textAlign:"right"}}>{r.montant.toLocaleString("fr-FR",{maximumFractionDigits:0})} €</span>
            </div>
          </div>
          <div style={{background:C.bg,borderRadius:3,height:6,overflow:"hidden"}}>
            <div style={{width:`${barPct}%`,height:"100%",borderRadius:3,background:r.isAnomalie?C.red:C.primaryMuted,transition:"width 0.5s"}}/>
          </div>
          <div style={{fontSize:10,color:C.textLight,marginTop:2}}>{pctCA.toFixed(1)}% du CA total</div>
        </div>;
      })}
    </div>
  </Card>;
}

// ─── COMPARAISON SECTORIELLE (repères du métier) ──────────────────────────────
// Situe chaque grand poste de charge (en % du CA) par rapport aux fourchettes
// habituellement observées dans la restauration/traiteur événementiel en
// France. Objectif : repérer d'un coup d'œil les postes qui méritent d'être
// creusés en priorité pour gagner en rentabilité.
function ComparaisonSectoriellePanel({rows, margeNettePct, objectifs}){
  if(rows.length===0) return null;
  const statutColor = { bon:C.green, attention:C.warn, alerte:C.red };
  const statutBg = { bon:C.greenLight, attention:C.warnLight, alerte:C.redLight };
  const statutIcon = { bon:"✅", attention:"⚠️", alerte:"🔴" };

  const margeRef = (objectifs||REFERENCES_SECTORIELLES_DEFAUT).margeNette;
  const margeStatut = margeNettePct>=margeRef.min ? "bon" : (margeNettePct>=margeRef.min*0.7 ? "attention" : "alerte");

  return <Card style={{marginBottom:20}}>
    <SectionHead>📐 Comparaison avec le secteur</SectionHead>
    <div style={{fontSize:11,color:C.textMuted,marginBottom:14}}>
      Vos postes de charge comparés aux fourchettes habituelles d'un traiteur événementiel en France. Ce sont des repères de pilotage, pas des normes absolues — à recouper avec votre expert-comptable.
    </div>

    {/* Marge nette en avant, c'est l'indicateur de synthèse le plus parlant */}
    <div style={{background:statutBg[margeStatut],border:`1px solid ${statutColor[margeStatut]}33`,borderRadius:10,padding:14,marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:12,fontWeight:700,color:statutColor[margeStatut]}}>{statutIcon[margeStatut]} Marge nette</div>
          <div style={{fontSize:10,color:C.textMuted,marginTop:2}}>Repère secteur : {margeRef.min}–{margeRef.max}%</div>
        </div>
        <div style={{fontSize:22,fontWeight:800,color:statutColor[margeStatut]}}>{margeNettePct.toFixed(1)}%</div>
      </div>
    </div>

    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {rows.map(r=>{
        const barPct = Math.min(100, (r.pct/r.ref.max)*100);
        return <div key={r.key} style={r.isSynthese?{paddingTop:10,borderTop:`1px solid ${C.border}`}:{}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4,gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0}}>
              <span style={{fontSize:12,flexShrink:0}}>{statutIcon[r.statut]}</span>
              <span style={{fontSize:13,fontWeight:r.isSynthese?700:500,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.label}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
              <span style={{fontSize:11,color:C.textLight}}>repère {r.ref.min}–{r.ref.max}%</span>
              <span style={{fontSize:13,fontWeight:700,color:statutColor[r.statut],minWidth:50,textAlign:"right"}}>{r.pct.toFixed(1)}%</span>
            </div>
          </div>
          <div style={{background:C.bg,borderRadius:3,height:6,overflow:"hidden"}}>
            <div style={{width:`${barPct}%`,height:"100%",borderRadius:3,background:statutColor[r.statut],transition:"width 0.5s"}}/>
          </div>
          <div style={{fontSize:10,color:C.textLight,marginTop:2}}>{r.montant.toLocaleString("fr-FR",{maximumFractionDigits:0})} € · {r.ref.note}</div>
        </div>;
      })}
    </div>
  </Card>;
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({data,moisData,onUpdateMois}){
  const [montantEvent,setMontantEvent]=useState("");
  const [modeEvent,setModeEvent]=useState("");
  const [savingEvent,setSavingEvent]=useState(false);
  const tL=totalLabo(data.laboCats,moisData.laboCh);
  const rep=repartition(moisData.pdv);
  const pdvs=PDV_LIST.map(p=>({...p,c:calcPDV(moisData.pdv[p.id],data.pdvCats[p.id],rep[p.id],tL)}));
  const caEvenementiel = n(moisData.pdv.evenementiel?.ca);
  const tCA=pdvs.reduce((a,p)=>a+p.c.ca,0) + caEvenementiel;
  const tNet=pdvs.reduce((a,p)=>a+p.c.res,0) + caEvenementiel;
  // Marge brute = CA − groupe "Achats matières premières" (601/602) du labo
  const totalMat=data.laboCats.filter(c=>c.groupe==="g601"||c.id==="matieres")
    .reduce((s,c)=>s+montantCat(c,moisData.laboCh),0);
  const tMB=tCA-totalMat;
  const pctMB=tCA>0?tMB/tCA*100:0;
  const sorted=[...pdvs].sort((a,b)=>b.c.res-a.c.res);
  const today=todayKey();
  const cloturesDuJour=PDV_LIST.flatMap(p=>(moisData.pdv[p.id]?.clotures||[]).filter(c=>c.date===today));

  // Outils de pilotage : décomposition CA→résultat + top charges du mois
  const totalChargesPDV = totalChargesDirectesPDV(moisData.pdv, data.pdvCats);
  const autresChargesLabo = tL - totalMat;
  const topChargesRows = topCharges(data, moisData, data.active, 8, 3);
  const comparaisonRows = comparaisonSectorielle(data, moisData, tCA);
  const margeNettePct = tCA>0 ? (tNet/tCA)*100 : 0;

  // CORRECTIF ANTI-ÉCRASEMENT : onUpdateMois (= upd, voir AppPatron) recharge
  // déjà Supabase juste avant d'écrire et applique ce mutateur sur le mois
  // FRAIS — jamais sur un state React local potentiellement périmé. C'est le
  // même point d'entrée sécurisé utilisé par toutes les autres écritures.
  const ajouterEvenementiel=async ()=>{
    if(!n(montantEvent)) return;
    setSavingEvent(true);
    const newEnc = {
      id:uid(), montant:n(montantEvent),
      modeLabel:modeEvent||"Non précisé",
      date:todayKey(), dateLabel:new Date().toLocaleDateString("fr-FR")
    };
    await onUpdateMois(freshMois=>{
      const ev = freshMois.pdv.evenementiel||{ca:0,encaissements:[]};
      const encaissements = [...(ev.encaissements||[]), newEnc];
      const newCa = encaissements.reduce((s,e)=>s+n(e.montant),0);
      return {...freshMois, pdv:{...freshMois.pdv, evenementiel:{ca:newCa, encaissements}}};
    });
    setMontantEvent(""); setModeEvent(""); setSavingEvent(false);
  };

  return <div>
    {cloturesDuJour.length>0&&<Card style={{background:C.primaryLight,border:`1px solid ${C.primaryMuted}`,marginBottom:20}} pad={14}>
      <div style={{fontSize:12,fontWeight:700,color:C.primary,marginBottom:4}}>✅ {cloturesDuJour.length} clôture{cloturesDuJour.length>1?"s":""} saisie{cloturesDuJour.length>1?"s":""} aujourd'hui</div>
      <div style={{fontSize:12,color:C.textMuted}}>Total du jour : <strong style={{color:C.primary}}>{cloturesDuJour.reduce((s,c)=>s+n(c.total),0).toLocaleString("fr-FR")} €</strong></div>
    </Card>}
    <div style={{display:"flex",gap:12,marginBottom:24,flexWrap:"wrap"}}>
      <KPICard label="CA Total" value={`${tCA.toLocaleString("fr-FR")} €`} accent/>
      <KPICard label="Marge brute" value={`${pctMB.toFixed(1)}%`} sub={<Badge val={pctMB}/>} color={C.primary}/>
      <KPICard label="Résultat net" value={`${tNet.toLocaleString("fr-FR")} €`} sub={<Badge val={tCA>0?tNet/tCA*100:0}/>} color={tNet>=0?C.green:C.red}/>
      <KPICard label="Charges labo" value={`${tL.toLocaleString("fr-FR")} €`} color={C.accent}/>
      <KPICard label="Charges directes PDV" value={`${totalChargesPDV.toLocaleString("fr-FR")} €`} color={C.accent}/>
    </div>

    <CascadeResultat tCA={tCA} totalMat={totalMat} tMB={tMB} autresChargesLabo={autresChargesLabo} totalChargesPDV={totalChargesPDV} tNet={tNet}/>
    <TopChargesPanel rows={topChargesRows} tCA={tCA}/>
    <ComparaisonSectoriellePanel rows={comparaisonRows} margeNettePct={margeNettePct} objectifs={data.objectifsSectoriels}/>

    <Card style={{background:C.fixeLight,marginBottom:20}} pad={16}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:13,fontWeight:700,color:C.fixe}}>🎉 CA Événementiel ce mois</div>
        <div style={{fontSize:18,fontWeight:800,color:C.fixe}}>{caEvenementiel.toLocaleString("fr-FR")} €</div>
      </div>
      {/* Historique des encaissements événementiels */}
      {(moisData.pdv.evenementiel?.encaissements||[]).length>0 && <div style={{marginBottom:12,display:"flex",flexDirection:"column",gap:4}}>
        {(moisData.pdv.evenementiel.encaissements||[]).map(e=>(
          <div key={e.id} style={{display:"flex",justifyContent:"space-between",fontSize:12,background:"rgba(59,91,219,0.06)",borderRadius:6,padding:"5px 10px"}}>
            <span style={{color:C.textMuted}}>{e.dateLabel} · {e.modeLabel}</span>
            <strong style={{color:C.fixe}}>{n(e.montant).toLocaleString("fr-FR")} €</strong>
          </div>
        ))}
      </div>}
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:120}}><MoneyInput value={montantEvent} onChange={setMontantEvent}/></div>
        <select value={modeEvent} onChange={e=>setModeEvent(e.target.value)}
          style={{...base,padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,outline:"none",fontSize:13,minWidth:140}}>
          <option value="">Mode de paiement…</option>
          <option value="Virement bancaire">Virement bancaire</option>
          <option value="Espèces">Espèces</option>
          <option value="BL">BL</option>
          <option value="Tickets resto">Tickets resto</option>
          <option value="Chèque">Chèque</option>
          <option value="CB">CB</option>
        </select>
        <button onClick={ajouterEvenementiel} disabled={!n(montantEvent)||!modeEvent||savingEvent}
          style={{...base,background:n(montantEvent)&&modeEvent&&!savingEvent?C.fixe:"#ccc",color:"#fff",border:"none",borderRadius:8,padding:"9px 16px",fontWeight:600,fontSize:13,cursor:n(montantEvent)&&modeEvent&&!savingEvent?"pointer":"not-allowed"}}>
          {savingEvent?"⏳...":"+ Ajouter"}
        </button>
      </div>
    </Card>
    <SectionHead>Classement des points de vente</SectionHead>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {sorted.map((p,i)=>{
        const pctCA=tCA>0?p.c.ca/tCA*100:0;
        return <Card key={p.id} pad={16}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,flexWrap:"wrap",gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:28,height:28,borderRadius:8,background:C.primaryLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:C.primary}}>#{i+1}</div>
              <div><div style={{fontWeight:600,fontSize:14}}><span>{p.emoji}</span> {p.full}</div><div style={{fontSize:11,color:C.textMuted,marginTop:2}}>{p.jours}</div></div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontWeight:700,fontSize:16,color:C.primary}}>{p.c.ca.toLocaleString("fr-FR")} €</div>
              <div style={{marginTop:3}}><Badge val={p.c.pctNet}/></div>
            </div>
          </div>
          <div style={{background:C.bg,borderRadius:4,height:5,overflow:"hidden",marginBottom:6}}>
            <div style={{width:`${pctCA}%`,height:"100%",background:p.c.res>=0?C.primaryMuted:C.accent,borderRadius:4,transition:"width 0.6s"}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.textMuted,flexWrap:"wrap",gap:4}}>
            <span>{pctCA.toFixed(1)}% du CA · labo: {rep[p.id].toFixed(1)}%</span>
            <span style={{fontWeight:600,color:p.c.res>=0?C.green:C.red}}>Net: {p.c.res.toLocaleString("fr-FR")} €</span>
          </div>
        </Card>;
      })}
    </div>
  </div>;
}

// ─── APP PATRON ───────────────────────────────────────────────────────────────

// ─── CONTRÔLE CAISSE ──────────────────────────────────────────────────────────
function ControleCaisse({moisData, paiements}){
  // Modes hors CB (on exclut les modes contenant "cb" ou "carte")
  const modesCash = paiements.filter(p=>!/cb|carte bancaire/i.test(p.label));

  // 1. Encaissements depuis les clôtures vendeurs, par mode
  const encaissements = {}; // { modeLabel: montant }
  PDV_LIST.forEach(p=>{
    (moisData.pdv[p.id]?.clotures||[]).forEach(cl=>{
      cl.modes.forEach(m=>{
        if(!/cb|carte bancaire/i.test(m.label) && n(m.montant)>0){
          encaissements[m.label] = (encaissements[m.label]||0) + n(m.montant);
        }
      });
    });
  });
  // CA événementiel — uniquement les encaissements en espèces ou BL (pas virements/CB)
  const encaissementsEvent = moisData.pdv.evenementiel?.encaissements||[];
  const isPhysique = (modeLabel) => /espèces|espece|^bl$|tickets? resto/i.test(modeLabel);
  const caEventEspeces = encaissementsEvent
    .filter(e=>isPhysique(e.modeLabel))
    .reduce((s,e)=>s+n(e.montant),0);

  // 2. Dépenses payées en modes hors CB (depuis _depenses)
  const depenses = {}; // { modeLabel: montant }
  (moisData.pdv._depenses||[]).forEach(dep=>{
    if(!/cb|carte bancaire/i.test(dep.modeLabel||"") && n(dep.montant)>0){
      depenses[dep.modeLabel] = (depenses[dep.modeLabel]||0) + n(dep.montant);
    }
  });

  // 3. Tous les modes détectés
  const tousLesModes = [...new Set([
    ...Object.keys(encaissements),
    ...Object.keys(depenses),
  ])];

  const totalEncaisse = Object.values(encaissements).reduce((a,b)=>a+b,0) + caEventEspeces;
  const totalDepenses = Object.values(depenses).reduce((a,b)=>a+b,0);
  const totalRestant = totalEncaisse - totalDepenses;

  return <div>
    {/* Total global */}
    <Card style={{background:C.primary,marginBottom:20}} pad={20}>
      <div style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.65)",letterSpacing:0.8,textTransform:"uppercase",marginBottom:6}}>
        Espèces & BL à récupérer ce mois
      </div>
      <div style={{fontSize:40,fontWeight:800,color:"#fff",lineHeight:1}}>{totalRestant.toLocaleString("fr-FR")} €</div>
      <div style={{display:"flex",gap:20,marginTop:10,flexWrap:"wrap"}}>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.65)"}}>
          Encaissé : <strong style={{color:"#fff"}}>{totalEncaisse.toLocaleString("fr-FR")} €</strong>
        </div>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.65)"}}>
          Dépensé : <strong style={{color:"#fff"}}>− {totalDepenses.toLocaleString("fr-FR")} €</strong>
        </div>
      </div>
    </Card>

    {/* Détail par mode de paiement */}
    <SectionHead>Détail par mode de paiement</SectionHead>
    <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
      {tousLesModes.length===0 && caEventEspeces===0 && (
        <Card pad={24} style={{textAlign:"center"}}>
          <div style={{color:C.textLight,fontSize:13}}>Aucune clôture saisie ce mois-ci</div>
        </Card>
      )}
      {tousLesModes.map(mode=>{
        const enc = (encaissements[mode]||0);
        const dep = (depenses[mode]||0);
        const restant = enc - dep;
        return <Card key={mode} pad={16}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:12}}>{mode}</div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:10}}>
            <div style={{flex:1,minWidth:100,background:C.greenLight,borderRadius:8,padding:"8px 12px"}}>
              <div style={{fontSize:10,color:C.green,fontWeight:600,textTransform:"uppercase",letterSpacing:0.6}}>Encaissé</div>
              <div style={{fontSize:18,fontWeight:700,color:C.green}}>{enc.toLocaleString("fr-FR")} €</div>
            </div>
            <div style={{flex:1,minWidth:100,background:C.redLight,borderRadius:8,padding:"8px 12px"}}>
              <div style={{fontSize:10,color:C.red,fontWeight:600,textTransform:"uppercase",letterSpacing:0.6}}>Dépensé</div>
              <div style={{fontSize:18,fontWeight:700,color:C.red}}>− {dep.toLocaleString("fr-FR")} €</div>
            </div>
            <div style={{flex:1,minWidth:100,background:restant>=0?C.primaryLight:C.redLight,borderRadius:8,padding:"8px 12px"}}>
              <div style={{fontSize:10,color:restant>=0?C.primary:C.red,fontWeight:600,textTransform:"uppercase",letterSpacing:0.6}}>À récupérer</div>
              <div style={{fontSize:18,fontWeight:700,color:restant>=0?C.primary:C.red}}>{restant.toLocaleString("fr-FR")} €</div>
            </div>
          </div>
          {/* Barre de progression encaissé vs dépensé */}
          {enc>0 && <div style={{background:C.bg,borderRadius:4,height:6,overflow:"hidden"}}>
            <div style={{width:`${Math.min(dep/enc*100,100)}%`,height:"100%",background:C.accent,borderRadius:4,transition:"width 0.5s"}}/>
          </div>}
          {enc>0 && <div style={{fontSize:10,color:C.textMuted,marginTop:4}}>{dep>0?`${(dep/enc*100).toFixed(0)}% dépensé`:"Aucune dépense"}</div>}
        </Card>;
      })}
      {caEventEspeces>0 && <Card pad={16}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:12}}>🎉 Événementiel (espèces & BL)</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:100,background:C.greenLight,borderRadius:8,padding:"8px 12px"}}>
            <div style={{fontSize:10,color:C.green,fontWeight:600,textTransform:"uppercase",letterSpacing:0.6}}>Encaissé</div>
            <div style={{fontSize:18,fontWeight:700,color:C.green}}>{caEventEspeces.toLocaleString("fr-FR")} €</div>
          </div>
          <div style={{flex:1,minWidth:100,background:C.primaryLight,borderRadius:8,padding:"8px 12px"}}>
            <div style={{fontSize:10,color:C.primary,fontWeight:600,textTransform:"uppercase",letterSpacing:0.6}}>À récupérer</div>
            <div style={{fontSize:18,fontWeight:700,color:C.primary}}>{caEventEspeces.toLocaleString("fr-FR")} €</div>
          </div>
        </div>
        {encaissementsEvent.filter(e=>!isPhysique(e.modeLabel)).length>0 &&
          <div style={{marginTop:8,fontSize:11,color:C.textMuted}}>
            ℹ️ {encaissementsEvent.filter(e=>!isPhysique(e.modeLabel)).reduce((s,e)=>s+n(e.montant),0).toLocaleString("fr-FR")} € en virement/CB exclus du contrôle caisse
          </div>
        }
      </Card>}
    </div>

    {/* Détail par point de vente */}
    <SectionHead>Détail par point de vente</SectionHead>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {PDV_LIST.map(p=>{
        const clotures = moisData.pdv[p.id]?.clotures||[];
        const totalPdv = clotures.reduce((s,cl)=>
          s+cl.modes.filter(m=>!/cb|carte bancaire/i.test(m.label)).reduce((a,m)=>a+n(m.montant),0),0);
        if(totalPdv===0) return null;
        return <Card key={p.id} pad={14}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontWeight:600,fontSize:13}}>{p.emoji} {p.full}</div>
            <div style={{fontWeight:700,fontSize:16,color:C.primary}}>{totalPdv.toLocaleString("fr-FR")} €</div>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
            {(()=>{
              const modes={};
              clotures.forEach(cl=>cl.modes.filter(m=>!/cb|carte bancaire/i.test(m.label)&&n(m.montant)>0).forEach(m=>{modes[m.label]=(modes[m.label]||0)+n(m.montant);}));
              return Object.entries(modes).map(([label,montant])=>(
                <span key={label} style={{background:C.primaryLight,color:C.primary,borderRadius:6,padding:"3px 10px",fontSize:12,fontWeight:500}}>
                  {label} : {montant.toLocaleString("fr-FR")} €
                </span>
              ));
            })()}
          </div>
        </Card>;
      })}
    </div>
  </div>;
}

// ─── MON COMPTE (changement de mot de passe) ─────────────────────────────────
function MonCompte({patron, onLogout}){
  const [pwd,setPwd]=useState("");
  const [pwd2,setPwd2]=useState("");
  const [msg,setMsg]=useState(null);
  const [loading,setLoading]=useState(false);

  const changer=async()=>{
    if(pwd.length<6){ setMsg({ok:false,txt:"Mot de passe trop court (6 caractères minimum)"}); return; }
    if(pwd!==pwd2){ setMsg({ok:false,txt:"Les deux mots de passe ne correspondent pas"}); return; }
    setLoading(true);
    const ok=await updatePatronPassword(patron.id, pwd);
    setLoading(false);
    if(ok){ setMsg({ok:true,txt:"Mot de passe changé ! Reconnectez-vous avec votre nouveau mot de passe."}); setPwd(""); setPwd2(""); }
    else{ setMsg({ok:false,txt:"Erreur lors du changement"}); }
  };

  return <div>
    <Card style={{marginBottom:16}}>
      <div style={{fontSize:14,color:C.textMuted,marginBottom:16}}>Connecté en tant que <strong style={{color:C.primary}}>{patron.nom}</strong></div>
      <SectionHead>🔑 Changer mon mot de passe</SectionHead>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div>
          <Label>Nouveau mot de passe</Label>
          <input type="password" value={pwd} onChange={e=>setPwd(e.target.value)} placeholder="Minimum 6 caractères"
            style={{...base,width:"100%",padding:"10px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,outline:"none"}}/>
        </div>
        <div>
          <Label>Confirmer le mot de passe</Label>
          <input type="password" value={pwd2} onChange={e=>setPwd2(e.target.value)} placeholder="Répétez le mot de passe"
            style={{...base,width:"100%",padding:"10px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,outline:"none"}}/>
        </div>
        {msg&&<div style={{fontSize:13,fontWeight:500,color:msg.ok?C.green:C.red,background:msg.ok?C.greenLight:C.redLight,borderRadius:8,padding:"8px 12px"}}>{msg.txt}</div>}
        <button onClick={changer} disabled={loading||!pwd||!pwd2}
          style={{...base,background:loading||!pwd||!pwd2?"#ccc":C.primary,color:"#fff",border:"none",borderRadius:10,padding:"12px",fontWeight:700,cursor:loading||!pwd||!pwd2?"not-allowed":"pointer"}}>
          {loading?"⏳ Enregistrement...":"Changer le mot de passe"}
        </button>
      </div>
    </Card>
    <Card>
      <SectionHead>🚪 Déconnexion</SectionHead>
      <button onClick={onLogout} style={{...base,background:C.redLight,color:C.red,border:"none",borderRadius:10,padding:"12px 20px",fontWeight:600,cursor:"pointer"}}>
        Se déconnecter
      </button>
    </Card>
  </div>;
}

function AppPatron({data,setData,patron,onLogout}){
  const [page,setPage]=useState("dashboard");
  const [menu,setMenu]=useState(false);
  const [conflictMsg,setConflictMsg]=useState(null);
  // Repliée par défaut : il faut cliquer pour dérouler les 10 points de vente,
  // afin que la liste de gauche ne prenne pas trop de place.
  const [pdvMenuOuvert,setPdvMenuOuvert]=useState(false);
  const key=data.active;
  const [an,mi]=key.split("-").map(Number);
  const getMois=()=>fillPdvKeys(data.mois[key]||initMois());
  const md=getMois();

  const notifyConflict=()=>{
    setConflictMsg("Les données ont été modifiées ailleurs entre-temps (autre appareil, import, ou saisie vendeur). Votre action a été appliquée sur la version la plus récente — rien n'a été perdu.");
    setTimeout(()=>setConflictMsg(null), 8000);
  };
  const [errorMsg,setErrorMsg]=useState(null);
  const notifyError=(msg)=>{
    setErrorMsg(msg);
    // Pas de disparition automatique pour une vraie erreur : contrairement au
    // conflit (résolu automatiquement, informatif), une erreur réseau reste
    // affichée jusqu'à ce que l'utilisateur la ferme, car elle peut nécessiter
    // une action de sa part (réessayer, vérifier sa connexion).
  };

  // CORRECTIF ANTI-ÉCRASEMENT : point d'entrée UNIQUE pour toute modification
  // du mois actif. mutatorFn reçoit toujours le mois FRAIS (rechargé depuis
  // Supabase juste avant) et retourne le nouveau mois — jamais de state local
  // périmé écrit directement en base.
  const upd=async (mutatorFnOrObject)=>{
    const mutatorFn = typeof mutatorFnOrObject==="function"
      ? mutatorFnOrObject
      : ()=>mutatorFnOrObject; // rétro-compatibilité : accepte aussi un objet mois direct
    const newData = await safeWriteMois(data, key, mutatorFn, notifyConflict, notifyError);
    setData(newData);
  };
  // Idem pour les données globales (catégories, vendeurs, paiements...)
  const updData=async (mutatorFnOrObject)=>{
    const mutatorFn = typeof mutatorFnOrObject==="function"
      ? mutatorFnOrObject
      : ()=>mutatorFnOrObject;
    const newData = await safeWriteAppData(data, mutatorFn, notifyConflict, notifyError);
    setData(newData);
  };
  const goMois=d=>{
    let m=mi+d,a=an; if(m>11){m=0;a++;} if(m<0){m=11;a--;}
    const k=`${a}-${m}`;
    setData(prev=>{
      const u=ensureMois({...prev,active:k},k);
      saveCache(u); saveAppDataToSupabase(u);
      if(!prev.mois[k]) saveMoisToSupabase(k, u.mois[k]);
      return u;
    });
  };
  const tL=totalLabo(data.laboCats,md.laboCh);
  const rep=repartition(md.pdv);
  const info=PDV_LIST.find(p=>p.id===page);
  const nav=[
    {id:"dashboard",label:"Dashboard",icon:"📊"},
    {id:"depenses",label:"Dépenses",icon:"💸"},
    {id:"clotures",label:"Clôtures",icon:"📋"},
    {id:"import",label:"Import CSV",icon:"📥"},
    {id:"labo",label:"Laboratoire",icon:"🏭"},
    {id:"vendeurs",label:"Vendeurs",icon:"🧑‍💼"},
    {id:"paiements",label:"Modes de paiement",icon:"💳"},
    {id:"objectifs",label:"Mes objectifs",icon:"🎯"},
    {id:"export",label:"Export",icon:"📄"},
    {id:"caisse",label:"Contrôle caisse",icon:"🏦"},
    {id:"rapprochement",label:"Rapprochement",icon:"🔍"},
    {id:"compte",label:"Mon compte",icon:"🔑"},
  ];
  return <div style={{...base,minHeight:"100vh",background:C.bg}}>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
    <style>{`@media(min-width:768px){#sidebar{transform:translateX(0)!important;box-shadow:none!important;}#overlay{display:none!important;}#main{margin-left:224px!important;}}input[type=number]::-webkit-inner-spin-button{opacity:0}*{box-sizing:border-box;}`}</style>
    {/* Bandeau de conflit — s'affiche quand une écriture concurrente a été détectée et automatiquement résolue */}
    {conflictMsg && <div style={{position:"fixed",top:0,left:0,right:0,zIndex:300,background:C.warn,color:"#fff",padding:"10px 16px",fontSize:13,fontWeight:600,textAlign:"center",boxShadow:C.shadowMd}}>
      ⚠️ {conflictMsg}
    </div>}
    {/* Bandeau d'erreur réseau — reste affiché jusqu'à fermeture manuelle, car
        une vraie erreur de sauvegarde peut nécessiter une action du patron
        (vérifier la connexion, réessayer) plutôt qu'un simple avertissement. */}
    {errorMsg && <div style={{position:"fixed",top:0,left:0,right:0,zIndex:300,background:C.red,color:"#fff",padding:"10px 16px",fontSize:13,fontWeight:600,textAlign:"center",boxShadow:C.shadowMd,display:"flex",alignItems:"center",justifyContent:"center",gap:12}}>
      <span>🔴 {errorMsg}</span>
      <button onClick={()=>setErrorMsg(null)} style={{...base,background:"rgba(255,255,255,0.2)",border:"none",borderRadius:6,padding:"3px 10px",fontSize:12,fontWeight:600,color:"#fff",cursor:"pointer",flexShrink:0}}>OK</button>
    </div>}
    {/* HEADER */}
    <div style={{background:C.white,borderBottom:`1px solid ${C.border}`,padding:"0 16px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,boxShadow:C.shadow}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <button onClick={()=>setMenu(!menu)} style={{...base,background:"transparent",border:"none",cursor:"pointer",padding:6,borderRadius:6,display:"flex",flexDirection:"column",gap:4}}>
          {[0,1,2].map(i=><div key={i} style={{width:20,height:2,background:C.text,borderRadius:1}}/>)}
        </button>
        <span style={{fontSize:18}}>🫒</span>
        <div><div style={{fontWeight:800,fontSize:14,lineHeight:1}}>Traiteur Grec</div><div style={{fontSize:9,color:C.textMuted,letterSpacing:0.3}}>MODE PATRON</div></div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <button onClick={()=>goMois(-1)} style={{...base,background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,width:30,height:30,cursor:"pointer",fontWeight:700,fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
        <div style={{textAlign:"center",minWidth:76}}><div style={{fontWeight:700,fontSize:13}}>{MOIS[mi]}</div><div style={{fontSize:9,color:C.textMuted}}>{an}</div></div>
        <button onClick={()=>goMois(1)} style={{...base,background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,width:30,height:30,cursor:"pointer",fontWeight:700,fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
        <button onClick={onLogout} style={{...base,background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:"5px 10px",fontSize:11,cursor:"pointer",color:C.textMuted,marginLeft:4}}>Quitter</button>
      </div>
    </div>
    <div style={{display:"flex",minHeight:"calc(100vh - 56px)"}}>
      <div id="sidebar" style={{width:224,flexShrink:0,background:C.white,borderRight:`1px solid ${C.border}`,padding:"10px 7px",overflowY:"auto",position:"fixed",top:56,bottom:0,left:0,zIndex:90,transform:menu?"translateX(0)":"translateX(-100%)",transition:"transform 0.22s",boxShadow:menu?C.shadowMd:"none"}}>
        {nav.map(item=>{
          const active=page===item.id;
          return <button key={item.id} onClick={()=>{setPage(item.id);setMenu(false);}}
            style={{...base,width:"100%",textAlign:"left",padding:"10px 12px",borderRadius:8,border:"none",background:active?C.primaryLight:"transparent",color:active?C.primary:C.textMuted,cursor:"pointer",fontWeight:active?600:400,display:"flex",alignItems:"center",gap:8,marginBottom:2,fontSize:13}}>
            <span style={{fontSize:15}}>{item.icon}</span><span style={{flex:1}}>{item.label}</span>
          </button>;
        })}

        {/* Catégorie repliable "Points de vente" — regroupe les 8 marchés + 2
            boutiques pour ne pas surcharger la liste de gauche. Repliée par
            défaut. Le Laboratoire reste une entrée indépendante au-dessus. */}
        <button onClick={()=>setPdvMenuOuvert(o=>!o)}
          style={{...base,width:"100%",textAlign:"left",padding:"10px 12px",borderRadius:8,border:"none",background:"transparent",color:C.textMuted,cursor:"pointer",fontWeight:400,display:"flex",alignItems:"center",gap:8,marginBottom:2,fontSize:13}}>
          <span style={{fontSize:15}}>🏪</span><span style={{flex:1}}>Points de vente</span>
          <span style={{fontSize:11,color:C.textLight,transform:pdvMenuOuvert?"rotate(90deg)":"none",transition:"transform 0.15s"}}>›</span>
        </button>
        {pdvMenuOuvert && PDV_LIST.map(p=>{
          const active=page===p.id;
          const c=calcPDV(md.pdv[p.id],data.pdvCats[p.id],rep[p.id]||0,tL);
          const dot = (c&&c.ca>0) ? <span style={{width:7,height:7,borderRadius:"50%",background:c.res>=0?C.green:C.red,display:"inline-block"}}/> : null;
          return <button key={p.id} onClick={()=>{setPage(p.id);setMenu(false);}}
            style={{...base,width:"100%",textAlign:"left",padding:"9px 12px 9px 30px",borderRadius:8,border:"none",background:active?C.primaryLight:"transparent",color:active?C.primary:C.textMuted,cursor:"pointer",fontWeight:active?600:400,display:"flex",alignItems:"center",gap:8,marginBottom:2,fontSize:13}}>
            <span style={{fontSize:14}}>{p.emoji}</span><span style={{flex:1}}>{p.nom}</span>{dot}
          </button>;
        })}
      </div>
      {menu&&<div id="overlay" onClick={()=>setMenu(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.3)",zIndex:80}}/>}
      <div id="main" style={{flex:1,padding:"20px 16px",marginLeft:0,overflowX:"hidden"}}>
        <div style={{marginBottom:18}}>
          <h1 style={{...base,fontSize:18,fontWeight:800,margin:0}}>
            {page==="dashboard"?"📊 Dashboard":page==="depenses"?"💸 Dépenses":page==="clotures"?"📋 Clôtures":page==="import"?"📥 Import CSV":page==="labo"?"🏭 Laboratoire":page==="vendeurs"?"🧑‍💼 Gestion vendeurs":page==="paiements"?"💳 Modes de paiement":page==="objectifs"?"🎯 Mes objectifs":page==="export"?"📄 Export mensuel":page==="caisse"?"🏦 Contrôle caisse":page==="rapprochement"?"🔍 Rapprochement bancaire":page==="compte"?"🔑 Mon compte":`${info?.emoji} ${info?.full}`}
          </h1>
          {info&&<div style={{fontSize:12,color:C.textMuted,marginTop:3}}>{info.jours}</div>}
        </div>
        {page==="dashboard"&&<Dashboard data={data} moisData={md} onUpdateMois={upd}/>}
        {page==="depenses"&&<PanneauDepenses data={data} md={md} onUpdateMois={upd} patron={patron}/>}
        {page==="clotures"&&<AllClotures moisData={md} onUpdateMois={upd} patron={patron}/>}
        {page==="labo"&&<PanneauLabo laboCats={data.laboCats} onLaboCatChange={c=>updData(fresh=>({...fresh,laboCats:c}))} laboCh={md.laboCh} onLaboChChange={c=>upd(freshMois=>({...freshMois,laboCh:c}))} moisPdv={md.pdv}/>}
        {info&&<PanneauPDV pdvMois={md.pdv[page]} onPdvChange={p=>upd(freshMois=>({...freshMois,pdv:{...freshMois.pdv,[page]:p}}))} pdvCats={data.pdvCats[page]} onPdvCatChange={c=>updData(fresh=>({...fresh,pdvCats:{...fresh.pdvCats,[page]:c}}))} tLabo={tL} info={info} pct={rep[page]}/>}
        {page==="vendeurs"&&<GestionVendeurs vendeurs={data.vendeurs} patron={patron} onChange={v=>updData(fresh=>({...fresh,vendeurs:v}))}/>}
        {page==="import"&&<ImportCSV data={data} md={md} patron={patron} onApplied={async (newData,newMois)=>{ await updData(()=>newData); await upd(()=>newMois); }}/>}
        {page==="paiements"&&<GestionPaiements paiements={data.paiements} onChange={p=>updData(fresh=>({...fresh,paiements:p}))}/>}
        {page==="objectifs"&&<GestionObjectifs objectifs={data.objectifsSectoriels} onChange={o=>updData(fresh=>({...fresh,objectifsSectoriels:o}))}/>}
        {page==="export"&&<PanneauExport data={data}/>}
        {page==="caisse"&&<ControleCaisse moisData={md} paiements={data.paiements}/>}
        {page==="rapprochement"&&<PanneauRapprochement moisData={md}/>}
        {page==="compte"&&<MonCompte patron={patron} onLogout={onLogout}/>}
      </div>
    </div>
  </div>;
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App(){
  const [data,setData]=useState(()=>loadCache()||initLocal());
  const [ready,setReady]=useState(false);
  const [syncError,setSyncError]=useState(null); // null = pas d'erreur, sinon message d'erreur
  const [retryCount,setRetryCount]=useState(0);
  // Toujours démarrer sur l'écran de connexion
  const [session,setSession]=useState(null); // null | {role:"patron"} | {role:"vendeur", vendeur:{}}

  useEffect(()=>{
    let mounted=true;
    loadFromSupabase().then(({data:remote, error})=>{
      if(!mounted) return;
      if(remote){
        const migrated = migrateLaboCats(remote);
        setData(migrated); saveCache(migrated);
        setSyncError(null);
        if(migrated!==remote) saveAppDataToSupabase(migrated);
      }
      else if(error){
        // Vraie erreur réseau/Supabase : on le signale clairement plutôt que
        // de basculer silencieusement sur le cache local sans prévenir.
        const hasCache = !!loadCache();
        setSyncError(hasCache
          ? `Connexion au serveur impossible (${error}). Vous travaillez actuellement sur une copie locale enregistrée sur cet appareil — vos nouvelles saisies pourront ne pas se synchroniser tant que la connexion n'est pas rétablie.`
          : `Connexion au serveur impossible (${error}), et aucune donnée locale disponible sur cet appareil. Vérifiez votre connexion internet puis réessayez.`);
      }
      // Si remote est null sans erreur : première utilisation, pas de souci réseau, rien à signaler.
      setReady(true);
    });
    return ()=>{ mounted=false; };
  },[retryCount]);

  const reessayerChargement = ()=>{
    setReady(false);
    setRetryCount(c=>c+1);
  };

  // Sauvegarde déclenchée par la clôture d'un vendeur
  const handleVendeurSave=async (nd)=>{
    saveCache(nd); // toujours sauvegardé localement en premier, même si le réseau échoue ensuite
    setData(nd);
    const key=nd.active;
    const { success, error } = await saveMoisToSupabase(key, nd.mois[key]);
    return { success, error };
  };

  if(!ready) return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#2d6a4f,#1b4332)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14}}>
      <div style={{fontSize:44}}>🫒</div>
      <div style={{color:"#fff",fontWeight:700,fontFamily:"'Inter',sans-serif",fontSize:15}}>Chargement des données…</div>
    </div>
  );

  // Erreur de connexion au démarrage : on informe clairement plutôt que de
  // laisser l'utilisateur travailler sans savoir que la synchronisation a un
  // problème (risque de saisies non sauvegardées en ligne, silencieusement).
  if(syncError){
    const hasCache = !!loadCache();
    return (
      <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#2d6a4f,#1b4332)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div style={{background:"#fff",borderRadius:16,padding:28,maxWidth:420,width:"100%",textAlign:"center"}}>
          <div style={{fontSize:44,marginBottom:10}}>⚠️</div>
          <div style={{fontWeight:800,fontSize:17,marginBottom:10,color:"#c1121f"}}>Problème de connexion</div>
          <div style={{fontSize:13,color:"#6c757d",marginBottom:20,lineHeight:1.5}}>{syncError}</div>
          <button onClick={reessayerChargement}
            style={{fontFamily:"'Inter',sans-serif",width:"100%",background:"#2d6a4f",color:"#fff",border:"none",borderRadius:10,padding:"13px",fontWeight:700,fontSize:14,cursor:"pointer",marginBottom:hasCache?10:0}}>
            🔄 Réessayer
          </button>
          {hasCache && <button onClick={()=>setSyncError(null)}
            style={{fontFamily:"'Inter',sans-serif",width:"100%",background:"transparent",color:"#6c757d",border:"1px solid #e9ecef",borderRadius:10,padding:"11px",fontWeight:500,fontSize:13,cursor:"pointer"}}>
            Continuer avec les données locales
          </button>}
        </div>
      </div>
    );
  }

  // Écran de connexion toujours affiché si pas de session active
  if(!session) return (
    <EcranConnexion
      onPatron={async(patron)=>{
        setSession({role:"patron", patron});
      }}
      onVendeur={v=>setSession({role:"vendeur",vendeur:v})}
      vendeurs={data.vendeurs}
    />
  );

  if(session.role==="vendeur") return (
    <EcranVendeur
      vendeur={session.vendeur}
      data={data}
      onSave={handleVendeurSave}
      onLogout={()=>setSession(null)}
    />
  );

  return (
    <AppPatron
      data={data}
      setData={setData}
      patron={session.patron}
      onLogout={()=>setSession(null)}
    />
  );
}
