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

const DEFAULT_LABO_CATS = [
  { id:"matieres",  label:"Achats matières premières", type:"variable", montantFixe:0 },
  { id:"loyer",     label:"Loyer",                     type:"fixe",     montantFixe:0 },
  { id:"elec",      label:"Électricité",               type:"variable", montantFixe:0 },
  { id:"eau",       label:"Eau",                       type:"variable", montantFixe:0 },
  { id:"sal",       label:"Salaires bruts",            type:"fixe",     montantFixe:0 },
  { id:"cs",        label:"Charges sociales",          type:"fixe",     montantFixe:0 },
  { id:"fourni",    label:"Fournitures",               type:"variable", montantFixe:0 },
  { id:"carburant", label:"Carburant",                 type:"variable", montantFixe:0 },
  { id:"packaging", label:"Packaging",                 type:"variable", montantFixe:0 },
  { id:"autre",     label:"Autres",                    type:"variable", montantFixe:0 },
];
const DEFAULT_PDV_CATS = [
  { id:"loyer",     label:"Loyer / Emplacement", type:"fixe",     montantFixe:0 },
  { id:"elec",      label:"Électricité",          type:"variable", montantFixe:0 },
  { id:"sal",       label:"Salaires",             type:"fixe",     montantFixe:0 },
  { id:"cs",        label:"Charges sociales",     type:"fixe",     montantFixe:0 },
  { id:"droits",    label:"Droits de marché",     type:"fixe",     montantFixe:0 },
  { id:"transport", label:"Transport",            type:"variable", montantFixe:0 },
  { id:"autre",     label:"Autres",               type:"variable", montantFixe:0 },
];
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
  if(!pdv.evenementiel) pdv.evenementiel = {ca:0};
  if(!pdv._depenses) pdv._depenses = [];
  return {...moisObj, laboCh: moisObj.laboCh||{}, pdv};
}
function initLocal(){
  const key=moisKey();
  return {
    laboCats: DEFAULT_LABO_CATS.map(c=>({...c})),
    pdvCats:  Object.fromEntries(PDV_LIST.map(p=>[p.id, DEFAULT_PDV_CATS.map(c=>({...c}))])),
    paiements: DEFAULT_PAIEMENTS.map(p=>({...p})),
    vendeurs: [],
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

  // Recalcule les vars uniquement depuis les sources fiables :
  // 1. On ne touche pas aux vars existants qui viennent du CSV ou de l'onglet Dépenses patron
  // 2. On s'assure juste que chaque dépense vendeur est reflétée
  // Méthode : on compare ce qui devrait être dans vars vs ce qui y est
  // Pour éviter les doubles comptages, on ne fait rien ici — les dépenses
  // vendeur sont déjà appliquées au moment de la saisie.
  // Ce flag est juste pour s'assurer que fillPdvKeys initialise bien les vars.
  return moisObj;
}
function migrateLaboCats(data){
  let cats = (data.laboCats||[]).filter(c=>c.id!=="gaz");
  let changed = cats.length !== (data.laboCats||[]).length;
  if(!cats.find(c=>c.id==="carburant")){
    cats = [...cats, {id:"carburant", label:"Carburant", type:"variable", montantFixe:0}];
    changed = true;
  }
  if(!cats.find(c=>c.id==="packaging")){
    cats = [...cats, {id:"packaging", label:"Packaging", type:"variable", montantFixe:0}];
    changed = true;
  }

  // S'assure que chaque point de vente actuel a bien ses catégories de charges
  // (utile après l'ajout de nouveaux points de vente, ex: Trosy, Escudier...)
  let pdvCats = {...data.pdvCats};
  PDV_LIST.forEach(p=>{
    if(!pdvCats[p.id]){
      pdvCats[p.id] = DEFAULT_PDV_CATS.map(c=>({...c}));
      changed = true;
    }
  });

  if(!changed) return data;
  return {...data, laboCats:cats, pdvCats};
}

// Charge toutes les données depuis Supabase (app_data + tous les mois_data)
async function loadFromSupabase(){
  try{
    const { data: appRow, error: e1 } = await supabase.from("app_data").select("*").eq("id","main").maybeSingle();
    if(e1 || !appRow) return null;
    const { data: moisRows, error: e2 } = await supabase.from("mois_data").select("*");
    if(e2) return null;
    const mois = {};
    (moisRows||[]).forEach(r=>{ mois[r.mois_key] = fillPdvKeys({ laboCh: r.labo_ch||{}, pdv: r.pdv||{} }); });
    const key = appRow.active_mois || moisKey();
    let result = {
      laboCats: appRow.labo_cats?.length ? appRow.labo_cats : DEFAULT_LABO_CATS.map(c=>({...c})),
      pdvCats: Object.keys(appRow.pdv_cats||{}).length ? appRow.pdv_cats : Object.fromEntries(PDV_LIST.map(p=>[p.id, DEFAULT_PDV_CATS.map(c=>({...c}))])),
      paiements: appRow.paiements?.length ? appRow.paiements : DEFAULT_PAIEMENTS.map(p=>({...p})),
      vendeurs: appRow.vendeurs || [],
      active: key,
      mois: Object.keys(mois).length ? mois : { [key]: initMois() }
    };
    result = ensureMois(result, key);
    return result;
  }catch(err){ console.error("Supabase load error:", err); return null; }
}

// Sauvegarde app_data (config globale) — debounced côté appelant
async function saveAppDataToSupabase(data){
  try{
    await supabase.from("app_data").upsert({
      id: "main",
      labo_cats: data.laboCats,
      pdv_cats: data.pdvCats,
      paiements: data.paiements,
      vendeurs: data.vendeurs,
      active_mois: data.active,
      updated_at: new Date().toISOString()
    });
  }catch(err){ console.error("Supabase save app_data error:", err); }
}

// Sauvegarde un mois précis
async function saveMoisToSupabase(key, moisObj){
  try{
    await supabase.from("mois_data").upsert({
      mois_key: key,
      labo_ch: moisObj.laboCh,
      pdv: moisObj.pdv,
      updated_at: new Date().toISOString()
    });
  }catch(err){ console.error("Supabase save mois_data error:", err); }
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
    const [dateOp,dateVal,debit,credit,libelle] = parts;
    // Ignorer l'en-tête éventuel
    if(!/^\d{2}\/\d{2}\/\d{4}$/.test(dateOp)) continue;
    const montantDebit = debit ? Math.abs(n(debit.replace(",","."))) : 0;
    const montantCredit = credit ? Math.abs(n(credit.replace(",","."))) : 0;
    rows.push({
      id: uid(),
      dateOp, dateVal,
      libelle: (libelle||"").trim(),
      debit: montantDebit,
      credit: montantCredit,
    });
  }
  return rows;
}

// Extrait un mot-clé simplifié depuis le libellé + détecte le type de ligne
function extractKeyword(libelle){
  const isComCB = /^COMCB/i.test(libelle);
  const isRemCB = /^REMCB/i.test(libelle);
  const isPrlv = /^PRLV/i.test(libelle);
  const isPaiementCB = /PAIEMENT CB|PAIEMENT PSC/i.test(libelle);
  const isCheque = /^CHEQUE/i.test(libelle);
  const isVir = /^VIR /i.test(libelle);
  // Mot-clé "propre" : on retire les codes numériques, dates, références
  let clean = libelle
    .replace(/COMCB\d+|REMCB\d+|NB\d+|TPE\d+|CARTE\s?\d+|PSC\s?\d+|CB\s?\d{4}|FAC\sDU.*|RL-[\dA-Z-]+|SIRET\s?\d+|G\d{6,}/gi," ")
    .replace(/\s{2,}/g," ").trim();
  return { isComCB, isRemCB, isPrlv, isPaiementCB, isCheque, isVir, clean };
}

function findRuleMatch(clean, rules){
  const upper=clean.toUpperCase();
  // recherche du mot-clé le plus long contenu dans le libellé
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
// Vérifie quelles lignes (par leur hash) ont déjà été importées précédemment
async function checkDuplicateHashes(rows){
  try{
    const hashes = rows.map(hashRow);
    const dup = new Set();
    // Supabase .in() limite raisonnable : on découpe par lots de 200
    for(let i=0;i<hashes.length;i+=200){
      const batch = hashes.slice(i,i+200);
      const { data, error } = await supabase.from("imported_lines").select("hash").in("hash", batch);
      if(!error && data) data.forEach(d=>dup.add(d.hash));
    }
    return dup;
  }catch(err){ console.error("check duplicates error",err); return new Set(); }
}
// Enregistre les lignes de cet import comme "vues" pour détecter les futurs doublons
async function markRowsImported(rows){
  try{
    const records = rows.map(r=>({ hash: hashRow(r), applied_at: new Date().toISOString() }));
    for(let i=0;i<records.length;i+=200){
      await supabase.from("imported_lines").upsert(records.slice(i,i+200));
    }
  }catch(err){ console.error("mark imported error",err); }
}

// ─── AUTHENTIFICATION PATRONS ─────────────────────────────────────────────────
async function loginPatron(password){
  try{
    const { data, error } = await supabase.from("patrons").select("*").eq("password_hash", password);
    if(error || !data || data.length===0) return null;
    const patron = data[0];
    // Mise à jour du last_login
    await supabase.from("patrons").update({ last_login: new Date().toISOString() }).eq("id", patron.id);
    return patron;
  }catch(err){ console.error("login patron error",err); return null; }
}

async function updatePatronPassword(patronId, newPassword){
  try{
    await supabase.from("patrons").update({ password_hash: newPassword }).eq("id", patronId);
    return true;
  }catch(err){ console.error("update password error",err); return false; }
}

// ─── JOURNAL D'ACTIVITÉ ───────────────────────────────────────────────────────
async function logActivity(patron, action, detail={}){
  try{
    await supabase.from("activity_log").insert({
      id: uid(),
      patron_id: patron.id,
      patron_nom: patron.nom,
      action,
      detail,
      created_at: new Date().toISOString()
    });
  }catch(err){ console.error("log activity error",err); }
}

async function loadActivityLog(limit=100){
  try{
    const { data, error } = await supabase.from("activity_log")
      .select("*").order("created_at", {ascending:false}).limit(limit);
    if(error) return [];
    return data||[];
  }catch(err){ console.error("load activity log error",err); return []; }
}


// ─── CALCULS ──────────────────────────────────────────────────────────────────
const n = v => parseFloat(v)||0;
// Pour les charges fixes : montantFixe (récurrent) + vars[id] (dépenses ponctuelles supplémentaires)
// Pour les charges variables : vars[id] uniquement (saisi chaque mois)
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

// ─── STYLES ───────────────────────────────────────────────────────────────────
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
    const remote = await loadFromSupabase();
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
    onSave(newData);
    setSaving(false);
    setStep("confirm");
  };

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

// ─── IMPORT CSV ───────────────────────────────────────────────────────────────
function ImportCSV({data, md, onApplied}){
  const [text,setText]=useState("");
  const [rows,setRows]=useState(null); // résultat parsing
  const [duplicateHashes,setDuplicateHashes]=useState(new Set());
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
      // Encaissement CB : déjà compté dans le CA via les clôtures des vendeurs.
      auto = { type:"ignore", reason:"Encaissement CB — déjà couvert par les clôtures de caisse" };
    } else if(k.isComCB){
      // Commission CB : traitée à part, répartie au prorata du CB encaissé par point de vente.
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
        // Répartition multi-PDV : une op par point de vente avec son montant spécifique
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
    const moisCache = { [data.active]: md }; // on ne modifie que le mois actif + futurs si lissage
    const startKey = data.active;

    for(const op of ops){
      const nbMois = op.lissage==="trimestriel"?3 : op.lissage==="annuel"?12 : op.lissage==="personnalise"?(op.nbMois||1) : 1;
      const part = op.montant / nbMois;
      const keys = moisLissage(startKey, nbMois);
      for(const k of keys){
        if(!moisCache[k]){
          // mois futur pas encore en cache : on part d'un mois vide compatible
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
      // Mémoriser la règle apprise (pas pour les commissions CB, recalculées chaque fois)
      if(op._learnKeyword){
        await saveImportRule(op._learnKeyword, { type:op.type, pdvId:op.pdvId, catId:op.catId, label:op.label, lissage:op.lissage||"ponctuel", nbMois:op.nbMois });
      }
    }

    // 3. S'assurer que la catégorie "frais_cb" existe dans chaque pdvCats concerné
    let newPdvCats = {...data.pdvCats};
    const pdvIdsUsed = new Set(ops.filter(o=>o.type==="pdv"&&o.catId==="frais_cb").map(o=>o.pdvId));
    pdvIdsUsed.forEach(pid=>{
      const cats=newPdvCats[pid]||[];
      if(!cats.find(c=>c.id==="frais_cb")){
        newPdvCats[pid] = [...cats, {id:"frais_cb",label:"Frais bancaires CB",type:"variable",montantFixe:0}];
      }
    });

    // 4. Sauvegarder tous les mois touchés + pdvCats si modifiés
    for(const [key,moisObj] of Object.entries(moisCache)){
      await saveMoisToSupabase(key, moisObj);
    }
    const newData = {...data, pdvCats:newPdvCats};
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
                    // Initialise avec tous les PDV à 0
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
                {allCatsLabo.map(cat=><option key={cat.id} value={cat.id}>{cat.label}</option>)}
              </select>}

              {choix.type==="pdv" && <select value={choix.catId} onChange={e=>{const cats=data.pdvCats[choix.pdvId]||[];const cat=cats.find(c2=>c2.id===e.target.value);setPend(c.row.id,{...choix,catId:cat.id,label:cat.label});}}
                style={{...base,padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:12}}>
                {(data.pdvCats[choix.pdvId]||[]).map(cat=><option key={cat.id} value={cat.id}>{cat.label}</option>)}
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
                      {cats.map(cat=><option key={cat.id} value={cat.id}>{cat.label}</option>)}
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

  const catsDisponibles = form.scope==="labo" ? data.laboCats : (data.pdvCats[form.pdvId]||[]);

  const ajouter = ()=>{
    if(!n(form.montant)) return;
    const cat = catsDisponibles.find(c=>c.id===form.catId) || catsDisponibles[0];
    const mode = data.paiements.find(p=>p.id===form.modeId);
    const pdvInfo = PDV_LIST.find(p=>p.id===form.pdvId);
    const montant = n(form.montant);

    let laboCh = {...md.laboCh};
    let pdvObj = {...md.pdv};
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
    pdvObj = {...pdvObj, _depenses:[...(md.pdv._depenses||[]), log]};

    onUpdateMois({...md, laboCh, pdv:pdvObj});
    setForm({...form, montant:""});
  };

  const supprimer = (dep)=>{
    let laboCh = {...md.laboCh};
    let pdvObj = {...md.pdv};
    if(dep.scope==="labo"){
      laboCh[dep.catId] = Math.max(0, n(laboCh[dep.catId]) - dep.montant);
    } else {
      const pm = pdvObj[dep.pdvId];
      if(pm) pdvObj = {...pdvObj, [dep.pdvId]: {...pm, vars:{...pm.vars, [dep.catId]:Math.max(0,n(pm.vars?.[dep.catId])-dep.montant)}}};
    }
    pdvObj = {...pdvObj, _depenses:(md.pdv._depenses||[]).filter(d=>d.id!==dep.id)};
    onUpdateMois({...md, laboCh, pdv:pdvObj});
  };

  const toutesDepenses = [...(md.pdv._depenses||[])].reverse();
  const totalMois = toutesDepenses.reduce((s,d)=>s+n(d.montant),0);

  return <div>
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
            {catsDisponibles.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <button onClick={ajouter} disabled={!n(form.montant)}
          style={{...base,background:n(form.montant)?C.primary:"#ccc",color:"#fff",border:"none",borderRadius:10,padding:"12px",fontWeight:700,fontSize:14,cursor:n(form.montant)?"pointer":"not-allowed"}}>
          + Ajouter la dépense
        </button>
      </div>
    </Card>

    <SectionHead>Dépenses du mois ({toutesDepenses.length}) {totalMois>0&&`· ${totalMois.toLocaleString("fr-FR")} €`}</SectionHead>
    {toutesDepenses.length===0 && <Card pad={24} style={{textAlign:"center"}}><div style={{color:C.textLight,fontSize:13}}>Aucune dépense manuelle ce mois-ci</div></Card>}
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {toutesDepenses.map(dep=>(
        <Card key={dep.id} pad={14}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontWeight:600,fontSize:13}}>{dep.catLabel} {dep.scope==="labo"?"· 🏭 Labo":`· ${dep.pdvLabel}`}</div>
              <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>{dep.dateLabel} · {dep.vendeurNom} · {dep.modeLabel}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <strong style={{fontSize:15,color:C.accent}}>{n(dep.montant).toLocaleString("fr-FR")} €</strong>
              <button onClick={()=>supprimer(dep)} style={{...base,background:C.redLight,color:C.red,border:"none",borderRadius:7,padding:"6px 10px",cursor:"pointer",fontSize:12,fontWeight:600}}>Suppr.</button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  </div>;
}

// ─── HISTORIQUE DES CLÔTURES + RÉCAP MODES DE PAIEMENT ───────────────────────
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
  const sauvegarderEdition=()=>{
    const newTotal = editModes.reduce((s,m)=>s+n(m.montant),0);
    const updatedCloture = {...editing, modes:editModes, note:editNote, total:newTotal};
    const pdvId = editing.pdvId;
    const pdvMois = moisData.pdv[pdvId];
    const newClotures = (pdvMois.clotures||[]).map(c=>c.id===editing.id?updatedCloture:c);
    const newCa = caDepuisClotures(newClotures);
    const newPdv = {...moisData.pdv, [pdvId]:{...pdvMois, clotures:newClotures, ca:newCa}};
    onUpdateMois({...moisData, pdv:newPdv});
    setEditing(null);
  };

  // Supprimer une clôture
  const supprimerCloture=(c)=>{
    const pdvMois = moisData.pdv[c.pdvId];
    const newClotures = (pdvMois.clotures||[]).filter(x=>x.id!==c.id);
    const newCa = caDepuisClotures(newClotures);
    const newPdv = {...moisData.pdv, [c.pdvId]:{...pdvMois, clotures:newClotures, ca:newCa}};
    onUpdateMois({...moisData, pdv:newPdv});
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
    <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:8}}>
      {cats.map(cat=>{
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

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({data,moisData,onUpdateMois}){
  const [montantEvent,setMontantEvent]=useState("");
  const tL=totalLabo(data.laboCats,moisData.laboCh);
  const rep=repartition(moisData.pdv);
  const pdvs=PDV_LIST.map(p=>({...p,c:calcPDV(moisData.pdv[p.id],data.pdvCats[p.id],rep[p.id],tL)}));
  const caEvenementiel = n(moisData.pdv.evenementiel?.ca);
  const tCA=pdvs.reduce((a,p)=>a+p.c.ca,0) + caEvenementiel;
  const tNet=pdvs.reduce((a,p)=>a+p.c.res,0) + caEvenementiel;
  const catMat=data.laboCats.find(c=>c.id==="matieres");
  const totalMat=catMat?montantCat(catMat,moisData.laboCh):0;
  const tMB=tCA-totalMat;
  const pctMB=tCA>0?tMB/tCA*100:0;
  const sorted=[...pdvs].sort((a,b)=>b.c.res-a.c.res);
  const today=todayKey();
  const cloturesDuJour=PDV_LIST.flatMap(p=>(moisData.pdv[p.id]?.clotures||[]).filter(c=>c.date===today));

  const ajouterEvenementiel=()=>{
    if(!n(montantEvent)) return;
    const ev = moisData.pdv.evenementiel||{ca:0};
    onUpdateMois({...moisData, pdv:{...moisData.pdv, evenementiel:{ca:(n(ev.ca)+n(montantEvent))}}});
    setMontantEvent("");
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
    </div>
    <Card style={{background:C.fixeLight,marginBottom:20}} pad={16}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:caEvenementiel>0?12:0,flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:13,fontWeight:700,color:C.fixe}}>🎉 CA Événementiel ce mois</div>
        <div style={{fontSize:18,fontWeight:800,color:C.fixe}}>{caEvenementiel.toLocaleString("fr-FR")} €</div>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:140}}><MoneyInput value={montantEvent} onChange={setMontantEvent}/></div>
        <button onClick={ajouterEvenementiel} disabled={!n(montantEvent)}
          style={{...base,background:n(montantEvent)?C.fixe:"#ccc",color:"#fff",border:"none",borderRadius:8,padding:"9px 16px",fontWeight:600,fontSize:13,cursor:n(montantEvent)?"pointer":"not-allowed"}}>
          + Ajouter un encaissement événementiel
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
    await logActivity(patron,"mot_de_passe",{});
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

// ─── JOURNAL D'ACTIVITÉ ───────────────────────────────────────────────────────
function JournalActivite(){
  const [logs,setLogs]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    loadActivityLog(200).then(data=>{ setLogs(data); setLoading(false); });
  },[]);

  const actionLabel={
    connexion:"🔐 Connexion",
    deconnexion:"🚪 Déconnexion",
    import_csv:"📥 Import CSV",
    depense_ajout:"💸 Dépense ajoutée",
    depense_suppression:"🗑️ Dépense supprimée",
    cloture_modif:"✏️ Clôture modifiée",
    cloture_suppression:"🗑️ Clôture supprimée",
    vendeur_ajout:"🧑‍💼 Vendeur ajouté",
    vendeur_suppression:"🗑️ Vendeur supprimé",
    mot_de_passe:"🔑 Mot de passe changé",
  };

  if(loading) return <Card pad={24}><div style={{color:C.textMuted,fontSize:13}}>Chargement du journal…</div></Card>;
  if(logs.length===0) return <Card pad={24} style={{textAlign:"center"}}><div style={{color:C.textLight,fontSize:13}}>Aucune activité enregistrée</div></Card>;

  return <div>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {logs.map(log=>{
        const date=new Date(log.created_at);
        const dateStr=date.toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"});
        const heureStr=date.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
        return <Card key={log.id} pad={14}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:6}}>
            <div>
              <div style={{fontWeight:600,fontSize:13}}>{actionLabel[log.action]||log.action}</div>
              <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>par <strong>{log.patron_nom}</strong> · {dateStr} à {heureStr}</div>
              {Object.keys(log.detail||{}).length>0 && <div style={{marginTop:6,display:"flex",gap:6,flexWrap:"wrap"}}>
                {Object.entries(log.detail).map(([k,v])=>(
                  <span key={k} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"2px 8px",fontSize:11,color:C.textMuted}}>
                    {k} : {typeof v==="number"?v.toLocaleString("fr-FR")+" €":String(v)}
                  </span>
                ))}
              </div>}
            </div>
          </div>
        </Card>;
      })}
    </div>
  </div>;
}

function AppPatron({data,setData,patron,onLogout}){
  const [page,setPage]=useState("dashboard");
  const [menu,setMenu]=useState(false);
  const key=data.active;
  const [an,mi]=key.split("-").map(Number);
  const getMois=()=>fillPdvKeys(data.mois[key]||initMois());
  const md=getMois();
  const upd=nm=>setData(prev=>{
    const u={...prev,mois:{...prev.mois,[key]:nm}};
    saveCache(u); saveMoisToSupabase(key,nm);
    return u;
  });
  const updData=nd=>{ saveCache(nd); saveAppDataToSupabase(nd); setData(nd); };
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
    ...PDV_LIST.map(p=>({id:p.id,label:p.nom,icon:p.emoji})),
    {id:"vendeurs",label:"Vendeurs",icon:"🧑‍💼"},
    {id:"paiements",label:"Modes de paiement",icon:"💳"},
    {id:"journal",label:"Journal",icon:"📜"},
    {id:"compte",label:"Mon compte",icon:"🔑"},
  ];
  return <div style={{...base,minHeight:"100vh",background:C.bg}}>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
    <style>{`@media(min-width:768px){#sidebar{transform:translateX(0)!important;box-shadow:none!important;}#overlay{display:none!important;}#main{margin-left:224px!important;}}input[type=number]::-webkit-inner-spin-button{opacity:0}*{box-sizing:border-box;}`}</style>
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
          let dot=null;
          if(!["dashboard","depenses","clotures","import","labo","vendeurs","paiements","journal","compte"].includes(item.id)){
            const c=calcPDV(md.pdv[item.id],data.pdvCats[item.id],rep[item.id]||0,tL);
            if(c&&c.ca>0) dot=<span style={{width:7,height:7,borderRadius:"50%",background:c.res>=0?C.green:C.red,display:"inline-block"}}/>;
          }
          return <button key={item.id} onClick={()=>{setPage(item.id);setMenu(false);}}
            style={{...base,width:"100%",textAlign:"left",padding:"10px 12px",borderRadius:8,border:"none",background:active?C.primaryLight:"transparent",color:active?C.primary:C.textMuted,cursor:"pointer",fontWeight:active?600:400,display:"flex",alignItems:"center",gap:8,marginBottom:2,fontSize:13}}>
            <span style={{fontSize:15}}>{item.icon}</span><span style={{flex:1}}>{item.label}</span>{dot}
          </button>;
        })}
      </div>
      {menu&&<div id="overlay" onClick={()=>setMenu(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.3)",zIndex:80}}/>}
      <div id="main" style={{flex:1,padding:"20px 16px",marginLeft:0,overflowX:"hidden"}}>
        <div style={{marginBottom:18}}>
          <h1 style={{...base,fontSize:18,fontWeight:800,margin:0}}>
            {page==="dashboard"?"📊 Dashboard":page==="depenses"?"💸 Dépenses":page==="clotures"?"📋 Clôtures":page==="import"?"📥 Import CSV":page==="labo"?"🏭 Laboratoire":page==="vendeurs"?"🧑‍💼 Gestion vendeurs":page==="paiements"?"💳 Modes de paiement":page==="journal"?"📜 Journal d'activité":page==="compte"?"🔑 Mon compte":`${info?.emoji} ${info?.full}`}
          </h1>
          {info&&<div style={{fontSize:12,color:C.textMuted,marginTop:3}}>{info.jours}</div>}
        </div>
        {page==="dashboard"&&<Dashboard data={data} moisData={md} onUpdateMois={upd}/>}
        {page==="depenses"&&<PanneauDepenses data={data} md={md} onUpdateMois={upd}/>}
        {page==="clotures"&&<AllClotures moisData={md} onUpdateMois={upd}/>}
        {page==="labo"&&<PanneauLabo laboCats={data.laboCats} onLaboCatChange={c=>updData({...data,laboCats:c})} laboCh={md.laboCh} onLaboChChange={c=>upd({...md,laboCh:c})} moisPdv={md.pdv}/>}
        {info&&<PanneauPDV pdvMois={md.pdv[page]} onPdvChange={p=>upd({...md,pdv:{...md.pdv,[page]:p}})} pdvCats={data.pdvCats[page]} onPdvCatChange={c=>updData({...data,pdvCats:{...data.pdvCats,[page]:c}})} tLabo={tL} info={info} pct={rep[page]}/>}
        {page==="vendeurs"&&<GestionVendeurs vendeurs={data.vendeurs} onChange={v=>updData({...data,vendeurs:v})}/>}
        {page==="import"&&<ImportCSV data={data} md={md} onApplied={(newData,newMois)=>{ updData(newData); upd(newMois); }}/>}
        {page==="paiements"&&<GestionPaiements paiements={data.paiements} onChange={p=>updData({...data,paiements:p})}/>}
        {page==="journal"&&<JournalActivite/>}
        {page==="compte"&&<MonCompte patron={patron} onLogout={onLogout}/>}
      </div>
    </div>
  </div>;
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App(){
  const [data,setData]=useState(()=>loadCache()||initLocal());
  const [ready,setReady]=useState(false);
  const [syncError,setSyncError]=useState(false);
  // Toujours démarrer sur l'écran de connexion
  const [session,setSession]=useState(null); // null | {role:"patron"} | {role:"vendeur", vendeur:{}}

  useEffect(()=>{
    let mounted=true;
    loadFromSupabase().then(remote=>{
      if(!mounted) return;
      if(remote){
        const migrated = migrateLaboCats(remote);
        setData(migrated); saveCache(migrated);
        if(migrated!==remote) saveAppDataToSupabase(migrated);
      }
      else { setSyncError(true); }
      setReady(true);
    });
    return ()=>{ mounted=false; };
  },[]);

  // Sauvegarde déclenchée par la clôture d'un vendeur
  const handleVendeurSave=nd=>{
    saveCache(nd);
    setData(nd);
    const key=nd.active;
    saveMoisToSupabase(key, nd.mois[key]);
  };

  if(!ready) return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#2d6a4f,#1b4332)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14}}>
      <div style={{fontSize:44}}>🫒</div>
      <div style={{color:"#fff",fontWeight:700,fontFamily:"'Inter',sans-serif",fontSize:15}}>Chargement des données…</div>
    </div>
  );

  // Écran de connexion toujours affiché si pas de session active
  if(!session) return (
    <EcranConnexion
      onPatron={async(patron)=>{
        setSession({role:"patron", patron});
        await logActivity(patron, "connexion", {});
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
      setData={d=>{ saveCache(d); saveAppDataToSupabase(d); setData(d); }}
      patron={session.patron}
      onLogout={async()=>{ await logActivity(session.patron,"deconnexion",{}); setSession(null); }}
    />
  );
}

