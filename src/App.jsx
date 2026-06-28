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
  { id:"boulogne",   nom:"Boulogne",       full:"Marché Boulogne",       emoji:"🏪", j:5, jours:"Mar · Mer · Ven · Sam · Dim" },
  { id:"clamart",    nom:"Clamart",        full:"Marché Clamart",        emoji:"🏪", j:2, jours:"Sam · Dim" },
  { id:"vavin",      nom:"Vavin",          full:"Boutique Vavin",        emoji:"🏬", j:7, jours:"7j/7 · 10h–21h" },
  { id:"alesia",     nom:"Alésia",         full:"Boutique Alésia",       emoji:"🏬", j:7, jours:"7j/7 · 10h–21h" },
];
const TOTAL_J = PDV_LIST.reduce((s,p)=>s+p.j,0);
const MOIS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const JOURS_SEMAINE = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];

const DEFAULT_LABO_CATS = [
  { id:"matieres", label:"Achats matières premières", type:"variable", montantFixe:0 },
  { id:"loyer",    label:"Loyer",                     type:"fixe",     montantFixe:0 },
  { id:"elec",     label:"Électricité",               type:"variable", montantFixe:0 },
  { id:"gaz",      label:"Gaz",                       type:"variable", montantFixe:0 },
  { id:"eau",      label:"Eau",                       type:"variable", montantFixe:0 },
  { id:"sal",      label:"Salaires bruts",            type:"fixe",     montantFixe:0 },
  { id:"cs",       label:"Charges sociales",          type:"fixe",     montantFixe:0 },
  { id:"fourni",   label:"Fournitures",               type:"variable", montantFixe:0 },
  { id:"autre",    label:"Autres",                    type:"variable", montantFixe:0 },
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
const PATRON_PASSWORD = "patron2026";

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
  if(data.mois[key]) return data;
  return {...data, mois:{...data.mois,[key]:initMois()}};
}

// Charge toutes les données depuis Supabase (app_data + tous les mois_data)
async function loadFromSupabase(){
  try{
    const { data: appRow, error: e1 } = await supabase.from("app_data").select("*").eq("id","main").maybeSingle();
    if(e1 || !appRow) return null;
    const { data: moisRows, error: e2 } = await supabase.from("mois_data").select("*");
    if(e2) return null;
    const mois = {};
    (moisRows||[]).forEach(r=>{ mois[r.mois_key] = { laboCh: r.labo_ch||{}, pdv: r.pdv||{} }; });
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


// ─── CALCULS ──────────────────────────────────────────────────────────────────
const n = v => parseFloat(v)||0;
function montantCat(cat, vars){ return cat.type==="fixe" ? n(cat.montantFixe) : n(vars?.[cat.id]); }
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
  const [mode,setMode]=useState(null); // null | "patron" | "vendeur"
  const [pin,setPin]=useState("");
  const [pwd,setPwd]=useState("");
  const [err,setErr]=useState("");

  const loginPatron=()=>{
    if(pwd===PATRON_PASSWORD){ onPatron(); }
    else{ setErr("Mot de passe incorrect"); setPwd(""); }
  };
  const loginVendeur=()=>{
    const v=vendeurs.find(v=>v.pin===pin);
    if(v){ onVendeur(v); }
    else{ setErr("PIN incorrect"); setPin(""); }
  };
  const addPin=(d)=>{
    if(mode==="vendeur"&&pin.length<6) setPin(p=>p+d);
    if(mode==="patron"&&pwd.length<20) setPwd(p=>p+d);
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
            <input type="password" value={pwd} onChange={e=>setPwd(e.target.value)} placeholder="Mot de passe" onKeyDown={e=>e.key==="Enter"&&loginPatron()}
              style={{...base,width:"100%",padding:"12px 14px",borderRadius:8,border:`1.5px solid ${C.border}`,outline:"none",fontSize:15,textAlign:"center"}}/>
          </div>
        }
        {err&&<div style={{textAlign:"center",color:C.red,fontSize:13,marginBottom:12,fontWeight:500}}>{err}</div>}
        <button onClick={mode==="vendeur"?loginVendeur:loginPatron}
          style={{...base,width:"100%",background:C.primary,color:"#fff",border:"none",borderRadius:10,padding:"14px",fontWeight:700,fontSize:15,cursor:"pointer"}}>
          Connexion
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

  const pdvInfo=PDV_LIST.find(p=>p.id===pdvId);
  const total=modes.reduce((s,m)=>s+n(m.montant),0);

  const startSaisie=(id)=>{
    setPdvId(id);
    setModes(data.paiements.map(p=>({...p,montant:0})));
    setStep("saisie");
  };

  const valider=()=>{
    const key=moisKey();
    const d=ensureMois(data,key);
    const cloture={
      id:uid(), vendeurId:vendeur.id, vendeurNom:vendeur.nom,
      pdvId, date:todayKey(), dateLabel:new Date().toLocaleDateString("fr-FR"),
      modes:modes.map(m=>({...m})), total, note
    };
    const old=d.mois[key].pdv[pdvId];
    const clotures=[...(old.clotures||[]),cloture];
    const ca=caDepuisClotures(clotures);
    const newData={...d,mois:{...d.mois,[key]:{...d.mois[key],pdv:{...d.mois[key].pdv,[pdvId]:{...old,ca,clotures}}}}};
    onSave(newData);
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

        {/* Total */}
        <Card style={{background:total>0?C.primary:C.bg,marginBottom:20}} pad={16}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:13,fontWeight:600,color:total>0?"rgba(255,255,255,0.7)":C.textMuted}}>TOTAL CAISSE</div>
            <div style={{fontSize:28,fontWeight:800,color:total>0?"#fff":C.textLight}}>{total.toLocaleString("fr-FR")} €</div>
          </div>
        </Card>

        <button onClick={valider} disabled={total===0}
          style={{...base,width:"100%",background:total>0?C.primary:"#ccc",color:"#fff",border:"none",borderRadius:12,padding:"16px",fontWeight:700,fontSize:16,cursor:total>0?"pointer":"not-allowed",transition:"background 0.15s"}}>
          Valider la clôture
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

// ─── CLÔTURES DU JOUR (vue patron) ───────────────────────────────────────────
function CloturesToday({moisData}){
  const today=todayKey();
  const entries=[];
  PDV_LIST.forEach(p=>{
    (moisData.pdv[p.id]?.clotures||[]).filter(c=>c.date===today).forEach(c=>entries.push({...c,pdvFull:p.full,pdvEmoji:p.emoji}));
  });
  if(entries.length===0) return <Card pad={24} style={{textAlign:"center"}}><div style={{color:C.textLight,fontSize:13}}>Aucune clôture saisie aujourd'hui</div></Card>;
  return <div style={{display:"flex",flexDirection:"column",gap:8}}>
    {entries.map(c=>(
      <Card key={c.id} pad={14}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
          <div>
            <div style={{fontWeight:600,fontSize:14}}>{c.pdvEmoji} {c.pdvFull}</div>
            <div style={{fontSize:12,color:C.textMuted}}>par {c.vendeurNom} · {c.dateLabel}</div>
          </div>
          <div style={{fontWeight:700,fontSize:18,color:C.primary}}>{n(c.total).toLocaleString("fr-FR")} €</div>
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
function Dashboard({data,moisData}){
  const tL=totalLabo(data.laboCats,moisData.laboCh);
  const rep=repartition(moisData.pdv);
  const pdvs=PDV_LIST.map(p=>({...p,c:calcPDV(moisData.pdv[p.id],data.pdvCats[p.id],rep[p.id],tL)}));
  const tCA=pdvs.reduce((a,p)=>a+p.c.ca,0);
  const tNet=pdvs.reduce((a,p)=>a+p.c.res,0);
  const catMat=data.laboCats.find(c=>c.id==="matieres");
  const totalMat=catMat?montantCat(catMat,moisData.laboCh):0;
  const tMB=tCA-totalMat;
  const pctMB=tCA>0?tMB/tCA*100:0;
  const sorted=[...pdvs].sort((a,b)=>b.c.res-a.c.res);
  const today=todayKey();
  const cloturesDuJour=PDV_LIST.flatMap(p=>(moisData.pdv[p.id]?.clotures||[]).filter(c=>c.date===today));

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
function AppPatron({data,setData,onLogout}){
  const [page,setPage]=useState("dashboard");
  const [menu,setMenu]=useState(false);
  const key=data.active;
  const [an,mi]=key.split("-").map(Number);
  const getMois=()=>data.mois[key]||initMois();
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
    {id:"clotures",label:"Clôtures du jour",icon:"📋"},
    {id:"labo",label:"Laboratoire",icon:"🏭"},
    ...PDV_LIST.map(p=>({id:p.id,label:p.nom,icon:p.emoji})),
    {id:"vendeurs",label:"Vendeurs",icon:"🧑‍💼"},
    {id:"paiements",label:"Modes de paiement",icon:"💳"},
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
          if(!["dashboard","clotures","labo","vendeurs","paiements"].includes(item.id)){
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
            {page==="dashboard"?"📊 Dashboard":page==="clotures"?"📋 Clôtures du jour":page==="labo"?"🏭 Laboratoire":page==="vendeurs"?"🧑‍💼 Gestion vendeurs":page==="paiements"?"💳 Modes de paiement":`${info?.emoji} ${info?.full}`}
          </h1>
          {info&&<div style={{fontSize:12,color:C.textMuted,marginTop:3}}>{info.jours}</div>}
        </div>
        {page==="dashboard"&&<Dashboard data={data} moisData={md}/>}
        {page==="clotures"&&<CloturesToday moisData={md}/>}
        {page==="labo"&&<PanneauLabo laboCats={data.laboCats} onLaboCatChange={c=>updData({...data,laboCats:c})} laboCh={md.laboCh} onLaboChChange={c=>upd({...md,laboCh:c})} moisPdv={md.pdv}/>}
        {info&&<PanneauPDV pdvMois={md.pdv[page]} onPdvChange={p=>upd({...md,pdv:{...md.pdv,[page]:p}})} pdvCats={data.pdvCats[page]} onPdvCatChange={c=>updData({...data,pdvCats:{...data.pdvCats,[page]:c}})} tLabo={tL} info={info} pct={rep[page]}/>}
        {page==="vendeurs"&&<GestionVendeurs vendeurs={data.vendeurs} onChange={v=>updData({...data,vendeurs:v})}/>}
        {page==="paiements"&&<GestionPaiements paiements={data.paiements} onChange={p=>updData({...data,paiements:p})}/>}
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
      if(remote){ setData(remote); saveCache(remote); }
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
      onPatron={()=>setSession({role:"patron"})}
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
      onLogout={()=>setSession(null)}
    />
  );
}

