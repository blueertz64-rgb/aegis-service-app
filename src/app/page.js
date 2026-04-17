'use client';
import { useState, useEffect, useCallback } from 'react';
import { INIT_CLIENTS, INIT_PRESTATAIRES, INIT_CHARGES, SERVICE_TYPES, STATUS_OPTIONS, CURRENCY_OPTIONS, PAYMENT_STATUS, PRIORITY_OPTIONS, DEMANDE_STATUS } from '@/lib/data';
import { scheduleLocalReminder, restoreReminders } from '@/lib/firebase';

const uid = () => Math.random().toString(36).slice(2, 10);
const fmt = (n, c) => c === 'FCFA' ? Math.round(n).toLocaleString('fr-FR') + ' FCFA' : n.toLocaleString('fr-FR', { minimumFractionDigits: 0 }) + '\u20AC';
const getTotals = (c) => { const f = c.services.reduce((s, v) => s + (v.montantFacture || 0), 0); const p = c.services.reduce((s, v) => s + (v.montantPaye || 0), 0); return { facture: f, paye: p, impayes: f - p }; };

const statusBadge = (s) => { if (s === 'Actif') return 'badge badge-actif'; if (s?.includes('Part')) return 'badge badge-part'; if (s === 'Inactif') return 'badge badge-inactif'; return 'badge'; };
const priorityBadge = (p) => { if (p === 'Urgente') return 'badge badge-urgente'; if (p === 'Forte') return 'badge badge-forte'; if (p === 'Moyenne') return 'badge badge-moyenne'; return 'badge badge-faible'; };
const demandeBadge = (s) => { if (s === 'En cours') return 'badge badge-encours'; if (s === 'Termin\u00E9e') return 'badge badge-terminee'; if (s === 'Annul\u00E9e') return 'badge badge-annulee'; return 'badge badge-part'; };
const paiementColor = (s) => { if (s === 'Pay\u00E9') return 'var(--green)'; if (s === 'En attente') return 'var(--yellow)'; if (s === 'Offert') return 'var(--purple)'; return '#666'; };

const loadStore = () => { if (typeof window === 'undefined') return null; try { const raw = localStorage.getItem('aegis_store'); if (raw) return JSON.parse(raw); } catch {} return null; };
const saveStore = (data) => { if (typeof window === 'undefined') return; try { localStorage.setItem('aegis_store', JSON.stringify(data)); } catch {} };

function Field({ label, value, onChange, type = 'text', opts, placeholder }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {opts ? (
        <select className="form-select" value={value || ''} onChange={e => onChange(e.target.value)}>
          <option value="">— Choisir —</option>
          {opts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea className="form-textarea" value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <input className="form-input" type={type} value={value || ''} onChange={e => onChange(type === 'number' ? Number(e.target.value) : e.target.value)} placeholder={placeholder} />
      )}
    </div>
  );
}

export default function AegisApp() {
  const [data, setData] = useState(null);
  const [view, setView] = useState('dashboard');
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [toast, setToast] = useState(null);
  const [notifEnabled, setNotifEnabled] = useState(false);

  useEffect(() => {
    const stored = loadStore();
    if (stored) { stored.clients = stored.clients.map(c => ({ ...c, demandes: c.demandes || [] })); setData(stored); }
    else { const init = { clients: INIT_CLIENTS.map(c => ({ ...c, demandes: [] })), prestataires: INIT_PRESTATAIRES, charges: INIT_CHARGES }; setData(init); saveStore(init); }
    restoreReminders();
    if (typeof window !== 'undefined' && 'Notification' in window) setNotifEnabled(Notification.permission === 'granted');
  }, []);

  const save = useCallback((d) => { setData(d); saveStore(d); setToast('Sauvegard\u00E9'); setTimeout(() => setToast(null), 1800); }, []);

  const enableNotifications = async () => {
    if (!('Notification' in window)) { setToast('Notifications non support\u00E9es'); setTimeout(() => setToast(null), 2000); return; }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') { setNotifEnabled(true); setToast('Notifications activ\u00E9es !'); }
    else { setToast('Notifications refus\u00E9es'); }
    setTimeout(() => setToast(null), 2000);
  };

  if (!data) return <div style={{ background: '#060606', color: 'var(--gold)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 24 }}>Chargement AEGIS...</div>;

  const { clients, prestataires, charges } = data;
  const allPrestaNames = [...new Set([...prestataires.map(p => p.name), 'Perso', 'Aegis S\u00E9curit\u00E9', 'Kanon Jean-Marc'])].sort();
  const openModal = (type, formData = {}) => { setForm(formData); setModal(type); };
  const closeModal = () => setModal(null);
  const f = (k, v) => setForm({ ...form, [k]: v });

  const addClient = () => { if (!form.name) return; save({ ...data, clients: [...clients, { id: uid(), ...form, services: [], demandes: [] }] }); closeModal(); };
  const editClient = () => { save({ ...data, clients: clients.map(c => c.id === form.id ? { ...c, ...form } : c) }); closeModal(); };
  const removeClient = (id) => { if (!confirm('Supprimer ce client ?')) return; save({ ...data, clients: clients.filter(c => c.id !== id) }); setSelected(null); };

  const addService = () => { save({ ...data, clients: clients.map(c => c.id === form.clientId ? { ...c, services: [...c.services, { id: uid(), date: form.date, type: form.type, desc: form.desc, prestataire: form.prestataire, montantFacture: form.montantFacture, montantPaye: form.montantPaye, statutPaiement: form.statutPaiement }] } : c) }); closeModal(); };
  const editService = () => { save({ ...data, clients: clients.map(c => c.id === form.clientId ? { ...c, services: c.services.map(s => s.id === form.id ? { ...form } : s) } : c) }); closeModal(); };
  const removeService = (clientId, svId) => { if (!confirm('Supprimer ?')) return; save({ ...data, clients: clients.map(c => c.id === clientId ? { ...c, services: c.services.filter(s => s.id !== svId) } : c) }); };

  const addDemande = () => {
    const demande = { id: uid(), date: form.date, demande: form.demande, client: form.clientName, priorite: form.priorite, echeance: form.echeance, statut: form.statut || 'En cours', notes: form.notes, rappel: form.rappel };
    if (form.rappel && notifEnabled) scheduleLocalReminder('AEGIS - ' + form.clientName, 'Rappel: ' + form.demande, form.rappel);
    save({ ...data, clients: clients.map(c => c.id === form.clientId ? { ...c, demandes: [...(c.demandes || []), demande] } : c) }); closeModal();
  };
  const editDemande = () => {
    if (form.rappel && notifEnabled) scheduleLocalReminder('AEGIS - ' + (form.clientName || form.client), 'Rappel: ' + form.demande, form.rappel);
    save({ ...data, clients: clients.map(c => c.id === form.clientId ? { ...c, demandes: (c.demandes || []).map(d => d.id === form.id ? { ...form } : d) } : c) }); closeModal();
  };
  const removeDemande = (clientId, dId) => { if (!confirm('Supprimer ?')) return; save({ ...data, clients: clients.map(c => c.id === clientId ? { ...c, demandes: (c.demandes || []).filter(d => d.id !== dId) } : c) }); };

  const addPrestataire = () => { if (!form.name) return; save({ ...data, prestataires: [...prestataires, { id: uid(), ...form }] }); closeModal(); };
  const editPrestataire = () => { save({ ...data, prestataires: prestataires.map(p => p.id === form.id ? { ...form } : p) }); closeModal(); };
  const removePrestataire = (id) => { if (!confirm('Supprimer ?')) return; save({ ...data, prestataires: prestataires.filter(p => p.id !== id) }); setSelected(null); };

  const addCharge = () => { if (!form.name) return; save({ ...data, charges: [...charges, { id: uid(), ...form }] }); closeModal(); };
  const editCharge = () => { save({ ...data, charges: charges.map(c => c.id === form.id ? { ...form } : c) }); closeModal(); };
  const removeCharge = (id) => { if (!confirm('Supprimer ?')) return; save({ ...data, charges: charges.filter(c => c.id !== id) }); };

  const totalEUR = { f: 0, p: 0 }, totalFCFA = { f: 0, p: 0 };
  clients.forEach(c => { const t = getTotals(c); if (c.currency === 'EUR') { totalEUR.f += t.facture; totalEUR.p += t.paye; } else { totalFCFA.f += t.facture; totalFCFA.p += t.paye; } });
  const allDemandes = clients.flatMap(c => (c.demandes || []).map(d => ({ ...d, clientId: c.id, clientName: c.name }))).filter(d => d.statut !== 'Termin\u00E9e' && d.statut !== 'Annul\u00E9e');
  const getPrestatairePrestations = (pName) => { const res = []; clients.forEach(c => c.services.forEach(s => { if (s.prestataire === pName) res.push({ ...s, clientName: c.name, currency: c.currency }); })); return res; };
  // === RENDERS ===
  const renderDashboard = () => (
    <div className="fade-in">
      {!notifEnabled && <div className="notif-banner"><p>Active les notifications pour recevoir tes rappels</p><button className="btn btn-sm" onClick={enableNotifications}>Activer</button></div>}
      <div className="kpi-row">
        <div className="kpi"><div className="kpi-label">Clients</div><div className="kpi-value">{clients.length}</div><div className="kpi-sub">{clients.filter(c=>c.status==='Actif').length} actifs</div></div>
        <div className="kpi"><div className="kpi-label">CA Total</div><div className="kpi-value">{fmt(totalEUR.f,'EUR')}</div><div className="kpi-sub">{fmt(totalFCFA.f,'FCFA')}</div></div>
        <div className="kpi"><div className="kpi-label">Impay&eacute;s</div><div className="kpi-value" style={{color:(totalEUR.f-totalEUR.p+totalFCFA.f-totalFCFA.p)>0?'var(--red)':'var(--green)'}}>{fmt(totalEUR.f-totalEUR.p,'EUR')}</div><div className="kpi-sub">{fmt(totalFCFA.f-totalFCFA.p,'FCFA')}</div></div>
        <div className="kpi"><div className="kpi-label">Demandes</div><div className="kpi-value">{allDemandes.length}</div><div className="kpi-sub">{allDemandes.filter(d=>d.priorite==='Urgente'||d.priorite==='Forte').length} urgentes</div></div>
      </div>
      {allDemandes.length > 0 && <div className="card"><div className="section-title">Demandes en cours<button className="btn btn-sm" onClick={()=>setView('demandes')}>Voir tout</button></div>
        {allDemandes.sort((a,b)=>{const pr={Urgente:0,Forte:1,Moyenne:2,Faible:3};return(pr[a.priorite]||3)-(pr[b.priorite]||3);}).slice(0,5).map(d=>(
          <div key={d.id} className={'demande-card '+(d.priorite||'').toLowerCase()} style={{marginBottom:10}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}><span style={{fontWeight:600,fontSize:14}}>{d.demande}</span><span className={priorityBadge(d.priorite)}>{d.priorite}</span></div>
            <div style={{color:'var(--text-muted)',fontSize:12,marginTop:3}}>{d.clientName} {d.echeance && '· '+d.echeance}</div>
          </div>))}
      </div>}
      <div className="card"><div className="section-title">Tous les clients<button className="btn btn-sm" onClick={()=>openModal('addClient',{name:'',phone:'',email:'',status:'Actif',currency:'EUR',interests:'',preferences:'',dateEntree:''})}>+ Client</button></div>
        <div style={{overflowX:'auto'}}><table><thead><tr>{['Client','Statut','Factur\u00E9','Pay\u00E9','Impay\u00E9s'].map(h=><th key={h}>{h}</th>)}</tr></thead>
        <tbody>{clients.map(c=>{const t=getTotals(c);return(<tr key={c.id} className="clickable" onClick={()=>{setView('clients');setSelected(c.id);}}>
          <td style={{fontWeight:600}}>{c.name}</td><td><span className={statusBadge(c.status)}>{c.status}</span></td>
          <td>{fmt(t.facture,c.currency)}</td><td>{fmt(t.paye,c.currency)}</td>
          <td style={{color:t.impayes>0?'var(--red)':'var(--green)',fontWeight:600}}>{fmt(t.impayes,c.currency)}</td></tr>);})}</tbody></table></div>
      </div>
    </div>
  );

  const renderClients = () => {
    if (selected) {
      const c = clients.find(x=>x.id===selected);
      if (!c) return null;
      const t = getTotals(c);
      return (<div className="fade-in">
        <button className="back-btn" onClick={()=>setSelected(null)}>← Retour</button>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:10,marginBottom:18}}>
          <div><h2 style={{fontFamily:'var(--font-display)',color:'var(--gold)',fontSize:26,marginBottom:4}}>{c.name}</h2><span className={statusBadge(c.status)}>{c.status}</span>{c.phone&&<span style={{color:'var(--text-muted)',fontSize:13,marginLeft:10}}>{c.phone}</span>}</div>
          <div style={{display:'flex',gap:8}}><button className="btn btn-outline btn-sm" onClick={()=>openModal('editClient',{...c})}>Modifier</button><button className="btn btn-danger btn-sm" onClick={()=>removeClient(c.id)}>Supprimer</button></div>
        </div>
        {(c.interests||c.preferences)&&<div className="card" style={{marginBottom:14}}>
          {c.dateEntree&&<div style={{fontSize:13,color:'var(--text-muted)',marginBottom:3}}>Client depuis le {c.dateEntree}</div>}
          {c.interests&&<div style={{fontSize:13,marginBottom:3}}><span style={{color:'var(--gold)'}}>Int&eacute;r&ecirc;ts :</span> {c.interests}</div>}
          {c.preferences&&<div style={{fontSize:13}}><span style={{color:'var(--gold)'}}>Pr&eacute;f&eacute;rences :</span> {c.preferences}</div>}
          {c.notes&&<div style={{fontSize:13,marginTop:4,color:'var(--red)'}}>{c.notes}</div>}
        </div>}
        <div className="kpi-row">
          <div className="kpi"><div className="kpi-label">Factur&eacute;</div><div className="kpi-value">{fmt(t.facture,c.currency)}</div></div>
          <div className="kpi"><div className="kpi-label">Pay&eacute;</div><div className="kpi-value">{fmt(t.paye,c.currency)}</div></div>
          <div className="kpi"><div className="kpi-label">Impay&eacute;s</div><div className="kpi-value" style={{color:t.impayes>0?'var(--red)':'var(--green)'}}>{fmt(t.impayes,c.currency)}</div></div>
        </div>
        <div className="card"><div className="section-title">Demandes ({(c.demandes||[]).filter(d=>d.statut!=='Termin\u00E9e'&&d.statut!=='Annul\u00E9e').length})<button className="btn btn-sm" onClick={()=>openModal('addDemande',{clientId:c.id,clientName:c.name,date:new Date().toLocaleDateString('fr-FR'),demande:'',priorite:'Moyenne',echeance:'',statut:'En cours',notes:'',rappel:''})}>+ Demande</button></div>
          {(c.demandes||[]).length===0?<div style={{color:'var(--text-dim)',fontStyle:'italic',textAlign:'center',padding:10,fontSize:13}}>Aucune demande</div>:
          (c.demandes||[]).map(d=>(<div key={d.id} className={'demande-card '+(d.priorite||'').toLowerCase()} style={{marginBottom:12,paddingBottom:10,borderBottom:'1px solid #1a1a1a'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}><span style={{fontWeight:600,fontSize:14}}>{d.demande}</span><div style={{display:'flex',gap:6}}><span className={priorityBadge(d.priorite)}>{d.priorite}</span><span className={demandeBadge(d.statut)}>{d.statut}</span></div></div>
            <div style={{color:'var(--text-muted)',fontSize:12,marginTop:4}}>{d.date&&d.date} {d.echeance&&'· '+d.echeance}{d.rappel&&<span style={{color:'var(--purple)',marginLeft:8}}>&#128276; {new Date(d.rappel).toLocaleString('fr-FR')}</span>}</div>
            {d.notes&&<div style={{color:'var(--text-dim)',fontSize:12,marginTop:3,fontStyle:'italic'}}>{d.notes}</div>}
            <div style={{display:'flex',gap:8,marginTop:6}}>
              <button className="btn btn-outline btn-sm" style={{padding:'3px 8px',fontSize:10}} onClick={()=>openModal('editDemande',{clientId:c.id,...d})}>Modifier</button>
              {d.statut!=='Termin\u00E9e'&&<button className="btn btn-sm" style={{padding:'3px 8px',fontSize:10,background:'var(--green-bg)',color:'var(--green)',border:'1px solid var(--green-border)'}} onClick={()=>{save({...data,clients:clients.map(x=>x.id===c.id?{...x,demandes:x.demandes.map(dd=>dd.id===d.id?{...dd,statut:'Termin\u00E9e'}:dd)}:x)})}}>Terminer</button>}
              <button className="btn btn-danger btn-sm" style={{padding:'3px 8px',fontSize:10}} onClick={()=>removeDemande(c.id,d.id)}>&#10005;</button>
            </div>
          </div>))}
        </div>
        <div className="card"><div className="section-title">Prestations ({c.services.length})<button className="btn btn-sm" onClick={()=>openModal('addService',{clientId:c.id,date:'',type:'',desc:'',prestataire:'',montantFacture:0,montantPaye:0,statutPaiement:'Pay\u00E9'})}>+ Prestation</button></div>
          <div style={{overflowX:'auto'}}><table><thead><tr>{['Date','Type','Description','Prestataire','Factur\u00E9','Pay\u00E9','Statut',''].map(h=><th key={h}>{h}</th>)}</tr></thead>
          <tbody>{c.services.map(sv=>(<tr key={sv.id}>
            <td style={{color:'var(--text-muted)'}}>{sv.date}</td><td>{sv.type}</td><td style={{color:'#bbb'}}>{sv.desc}</td><td style={{color:'var(--gold)'}}>{sv.prestataire}</td>
            <td style={{fontWeight:600}}>{sv.montantFacture>0?fmt(sv.montantFacture,c.currency):'—'}</td><td>{sv.montantPaye>0?fmt(sv.montantPaye,c.currency):'—'}</td>
            <td style={{color:paiementColor(sv.statutPaiement),fontWeight:600,fontSize:12}}>{sv.statutPaiement}</td>
            <td><button onClick={()=>openModal('editService',{clientId:c.id,...sv})} style={{background:'none',border:'none',color:'var(--gold)',cursor:'pointer',fontSize:12}}>&#9998;</button><button onClick={()=>removeService(c.id,sv.id)} style={{background:'none',border:'none',color:'var(--red)',cursor:'pointer',fontSize:12,marginLeft:4}}>&#10005;</button></td>
          </tr>))}</tbody></table></div>
        </div>
      </div>);
    }
    return (<div className="fade-in">
      <div className="section-title">Clients ({clients.length})<button className="btn" onClick={()=>openModal('addClient',{name:'',phone:'',email:'',status:'Actif',currency:'EUR',interests:'',preferences:'',dateEntree:''})}>+ Nouveau client</button></div>
      <div className="grid">{clients.map(c=>{const t=getTotals(c);return(<div key={c.id} className="card clickable" onClick={()=>setSelected(c.id)}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}><span style={{fontWeight:700,fontSize:16,fontFamily:'var(--font-display)'}}>{c.name}</span><span className={statusBadge(c.status)}>{c.status}</span></div>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}><div><div style={{color:'var(--text-dim)',fontSize:9,textTransform:'uppercase',marginBottom:2}}>Factur&eacute;</div><div style={{fontWeight:600}}>{fmt(t.facture,c.currency)}</div></div><div style={{textAlign:'right'}}><div style={{color:'var(--text-dim)',fontSize:9,textTransform:'uppercase',marginBottom:2}}>Impay&eacute;s</div><div style={{fontWeight:600,color:t.impayes>0?'var(--red)':'var(--green)'}}>{fmt(t.impayes,c.currency)}</div></div></div>
        {(c.demandes||[]).filter(d=>d.statut==='En cours').length>0&&<div style={{color:'var(--yellow)',fontSize:11,marginTop:6}}>&#128203; {(c.demandes||[]).filter(d=>d.statut==='En cours').length} demande(s)</div>}
        <div style={{color:'var(--text-dim)',fontSize:11,marginTop:4}}>{c.services.length} prestation{c.services.length>1?'s':''}</div>
      </div>);})}</div>
    </div>);
  };

  const renderDemandes = () => {
    const toutes = clients.flatMap(c => (c.demandes||[]).map(d => ({...d, clientId: c.id, clientName: c.name})));
    const actives = toutes.filter(d => d.statut !== 'Termin\u00E9e' && d.statut !== 'Annul\u00E9e');
    return (<div className="fade-in">
      <div className="section-title">Demandes en cours ({actives.length})</div>
      {!notifEnabled&&<div className="notif-banner" style={{marginBottom:14}}><p>&#128276; Active les notifications pour les rappels</p><button className="btn btn-sm" onClick={enableNotifications}>Activer</button></div>}
      {actives.length===0?<div className="card" style={{textAlign:'center',color:'var(--text-dim)',padding:30}}>Aucune demande en cours</div>:
      actives.sort((a,b)=>{const pr={Urgente:0,Forte:1,Moyenne:2,Faible:3};return(pr[a.priorite]||3)-(pr[b.priorite]||3);}).map(d=>(<div key={d.id} className="card" style={{marginBottom:10}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:6}}><span style={{fontWeight:700,fontSize:15}}>{d.demande}</span><div style={{display:'flex',gap:6}}><span className={priorityBadge(d.priorite)}>{d.priorite}</span><span className={demandeBadge(d.statut)}>{d.statut}</span></div></div>
        <div style={{color:'var(--text-muted)',fontSize:12}}><span style={{color:'var(--gold)'}}>{d.clientName}</span>{d.echeance&&' · '+d.echeance}{d.rappel&&<span style={{color:'var(--purple)',marginLeft:8}}>&#128276; {new Date(d.rappel).toLocaleString('fr-FR')}</span>}</div>
        {d.notes&&<div style={{color:'var(--text-dim)',fontSize:12,marginTop:3,fontStyle:'italic'}}>{d.notes}</div>}
        <div style={{display:'flex',gap:6,marginTop:8}}>
          <button className="btn btn-outline btn-sm" style={{fontSize:10}} onClick={()=>openModal('editDemande',{clientId:d.clientId,...d})}>Modifier</button>
          <button className="btn btn-sm" style={{fontSize:10,background:'var(--green-bg)',color:'var(--green)',border:'1px solid var(--green-border)'}} onClick={()=>{save({...data,clients:clients.map(c=>c.id===d.clientId?{...c,demandes:c.demandes.map(dd=>dd.id===d.id?{...dd,statut:'Termin\u00E9e'}:dd)}:c)})}}>Terminer</button>
        </div>
      </div>))}
    </div>);
  };

  const renderPrestataires = () => {
    if (selected) {
      const p = prestataires.find(x=>x.id===selected); if (!p) return null;
      const prestations = getPrestatairePrestations(p.name);
      const totEUR = prestations.filter(x=>x.currency==='EUR').reduce((s,x)=>s+x.montantPaye,0);
      const totFCFA = prestations.filter(x=>x.currency==='FCFA').reduce((s,x)=>s+x.montantPaye,0);
      return (<div className="fade-in">
        <button className="back-btn" onClick={()=>setSelected(null)}>← Retour</button>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:10,marginBottom:18}}>
          <div><h2 style={{fontFamily:'var(--font-display)',color:'var(--gold)',fontSize:26,marginBottom:4}}>{p.name}</h2><div style={{color:'var(--text-muted)',fontSize:13}}>{p.type}</div></div>
          <div style={{display:'flex',gap:8}}><button className="btn btn-outline btn-sm" onClick={()=>openModal('editPrestataire',{...p})}>Modifier</button><button className="btn btn-danger btn-sm" onClick={()=>removePrestataire(p.id)}>Supprimer</button></div>
        </div>
        <div className="kpi-row">
          <div className="kpi"><div className="kpi-label">Pay&eacute; (&euro;)</div><div className="kpi-value">{fmt(totEUR,'EUR')}</div></div>
          <div className="kpi"><div className="kpi-label">Pay&eacute; (FCFA)</div><div className="kpi-value">{fmt(totFCFA,'FCFA')}</div></div>
          <div className="kpi"><div className="kpi-label">Prestations</div><div className="kpi-value">{prestations.length}</div></div>
        </div>
        <div className="card"><div className="section-title">Historique</div>
          {prestations.length===0?<div style={{color:'var(--text-dim)',fontStyle:'italic',textAlign:'center',padding:20}}>Aucune prestation</div>:
          <div style={{overflowX:'auto'}}><table><thead><tr>{['Date','Client','Service','Montant','Statut'].map(h=><th key={h}>{h}</th>)}</tr></thead>
          <tbody>{prestations.map((pr,i)=>(<tr key={i}><td style={{color:'var(--text-muted)'}}>{pr.date}</td><td>{pr.clientName}</td><td style={{color:'#bbb'}}>{pr.desc}</td><td style={{fontWeight:600}}>{pr.montantFacture>0?fmt(pr.montantFacture,pr.currency):'—'}</td><td style={{color:paiementColor(pr.statutPaiement),fontWeight:600,fontSize:12}}>{pr.statutPaiement}</td></tr>))}</tbody></table></div>}
        </div>
      </div>);
    }
    return (<div className="fade-in">
      <div className="section-title">Prestataires ({prestataires.length})<button className="btn" onClick={()=>openModal('addPrestataire',{name:'',type:'',phone:'',email:'',notes:''})}>+ Nouveau</button></div>
      <div className="grid">{prestataires.map(p=>{const pr=getPrestatairePrestations(p.name);const cNames=[...new Set(pr.map(x=>x.clientName))];return(<div key={p.id} className="card clickable" onClick={()=>setSelected(p.id)}>
        <div style={{fontWeight:700,fontSize:16,fontFamily:'var(--font-display)',color:'var(--gold)',marginBottom:4}}>{p.name}</div>
        <div style={{color:'var(--text-muted)',fontSize:12,marginBottom:10}}>{p.type}</div>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}><div><div style={{color:'var(--text-dim)',fontSize:9,textTransform:'uppercase'}}>Prestations</div><div style={{fontWeight:600}}>{pr.length}</div></div><div style={{textAlign:'right'}}><div style={{color:'var(--text-dim)',fontSize:9,textTransform:'uppercase'}}>Clients</div><div style={{fontWeight:600}}>{cNames.length}</div></div></div>
        {cNames.length>0&&<div style={{color:'var(--text-dim)',fontSize:11,marginTop:6}}>{cNames.join(', ')}</div>}
      </div>);})}</div>
    </div>);
  };

  const renderCharges = () => (<div className="fade-in">
    <div className="section-title">Charges fixes mensuelles<button className="btn" onClick={()=>openModal('addCharge',{name:'',montant:0,currency:'EUR'})}>+ Nouvelle</button></div>
    <div className="card">
      {charges.map(ch=>(<div key={ch.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 0',borderBottom:'1px solid #1a1a1a'}}>
        <span style={{fontSize:15}}>{ch.name}</span>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{color:'var(--gold)',fontWeight:700}}>{ch.currency==='FCFA'?Math.round(ch.montant).toLocaleString('fr-FR')+' FCFA':ch.montant+'\u20AC'}</span>
          <button className="btn btn-outline btn-sm" style={{fontSize:10}} onClick={()=>openModal('editCharge',{...ch})}>Modifier</button>
          <button className="btn btn-danger btn-sm" style={{fontSize:10}} onClick={()=>removeCharge(ch.id)}>&#10005;</button>
        </div>
      </div>))}
      <div style={{display:'flex',justifyContent:'space-between',paddingTop:14,marginTop:10,borderTop:'2px solid var(--gold)'}}>
        <span style={{fontWeight:700,fontSize:12,textTransform:'uppercase',letterSpacing:1}}>Total mensuel</span>
        <span style={{fontWeight:700,color:'var(--gold)'}}>{fmt(charges.filter(c=>c.currency==='FCFA').reduce((s,c)=>s+c.montant,0),'FCFA')} + {fmt(charges.filter(c=>c.currency==='EUR').reduce((s,c)=>s+c.montant,0),'EUR')}</span>
      </div>
    </div>
  </div>);

  const clientFields = () => (<>
    <Field label="Nom complet" value={form.name} onChange={v=>f('name',v)} placeholder="Nom du client"/>
    <div className="form-row form-row-2"><Field label="Statut" value={form.status} onChange={v=>f('status',v)} opts={STATUS_OPTIONS}/><Field label="Devise" value={form.currency} onChange={v=>f('currency',v)} opts={CURRENCY_OPTIONS}/></div>
    <div className="form-row form-row-2"><Field label="T&eacute;l&eacute;phone" value={form.phone} onChange={v=>f('phone',v)} placeholder="+33..."/><Field label="Email" value={form.email} onChange={v=>f('email',v)}/></div>
    <Field label="Date d'entr&eacute;e" value={form.dateEntree} onChange={v=>f('dateEntree',v)} placeholder="JJ/MM/AAAA"/>
    <Field label="Int&eacute;r&ecirc;ts" value={form.interests} onChange={v=>f('interests',v)}/><Field label="Pr&eacute;f&eacute;rences" value={form.preferences} onChange={v=>f('preferences',v)}/>
  </>);
  const serviceFields = () => (<>
    <div className="form-row form-row-2"><Field label="Date" value={form.date} onChange={v=>f('date',v)} placeholder="JJ/MM/AA"/><Field label="Type" value={form.type} onChange={v=>f('type',v)} opts={SERVICE_TYPES}/></div>
    <Field label="Description" value={form.desc} onChange={v=>f('desc',v)}/><Field label="Prestataire" value={form.prestataire} onChange={v=>f('prestataire',v)} opts={allPrestaNames}/>
    <div className="form-row form-row-3"><Field label="Factur&eacute;" value={form.montantFacture} onChange={v=>f('montantFacture',v)} type="number"/><Field label="Pay&eacute;" value={form.montantPaye} onChange={v=>f('montantPaye',v)} type="number"/><Field label="Statut" value={form.statutPaiement} onChange={v=>f('statutPaiement',v)} opts={PAYMENT_STATUS}/></div>
  </>);
  const demandeFields = () => (<>
    <Field label="Demande" value={form.demande} onChange={v=>f('demande',v)} placeholder="Description de la demande"/>
    <div className="form-row form-row-2"><Field label="Priorit&eacute;" value={form.priorite} onChange={v=>f('priorite',v)} opts={PRIORITY_OPTIONS}/><Field label="Statut" value={form.statut} onChange={v=>f('statut',v)} opts={DEMANDE_STATUS}/></div>
    <div className="form-row form-row-2"><Field label="Date" value={form.date} onChange={v=>f('date',v)} placeholder="JJ/MM/AA"/><Field label="&Eacute;ch&eacute;ance" value={form.echeance} onChange={v=>f('echeance',v)} placeholder="JJ/MM/AA"/></div>
    <Field label="Notes" value={form.notes} onChange={v=>f('notes',v)} type="textarea" placeholder="Notes..."/>
    <div className="form-group"><label className="form-label">&#128276; Rappel (notification)</label><input type="datetime-local" className="form-input" value={form.rappel||''} onChange={e=>f('rappel',e.target.value)}/>{!notifEnabled&&<div style={{color:'var(--yellow)',fontSize:11,marginTop:4}}>Active les notifications pour le rappel</div>}</div>
  </>);
  const prestataireFields = () => (<>
    <Field label="Nom" value={form.name} onChange={v=>f('name',v)} placeholder="Nom du prestataire"/><Field label="Type" value={form.type} onChange={v=>f('type',v)} placeholder="ex: Location v&eacute;hicule"/>
    <div className="form-row form-row-2"><Field label="T&eacute;l&eacute;phone" value={form.phone} onChange={v=>f('phone',v)}/><Field label="Email" value={form.email} onChange={v=>f('email',v)}/></div>
    <Field label="Notes" value={form.notes} onChange={v=>f('notes',v)} type="textarea"/>
  </>);
  const chargeFields = () => (<>
    <Field label="Nom" value={form.name} onChange={v=>f('name',v)} placeholder="ex: Orange WiFi"/>
    <div className="form-row form-row-2"><Field label="Montant" value={form.montant} onChange={v=>f('montant',v)} type="number"/><Field label="Devise" value={form.currency} onChange={v=>f('currency',v)} opts={CURRENCY_OPTIONS}/></div>
  </>);

  const modalConfig = {
    addClient:{title:'Nouveau client',fields:clientFields,save:addClient},editClient:{title:'Modifier client',fields:clientFields,save:editClient},
    addService:{title:'Nouvelle prestation',fields:serviceFields,save:addService},editService:{title:'Modifier prestation',fields:serviceFields,save:editService},
    addDemande:{title:'Nouvelle demande',fields:demandeFields,save:addDemande},editDemande:{title:'Modifier demande',fields:demandeFields,save:editDemande},
    addPrestataire:{title:'Nouveau prestataire',fields:prestataireFields,save:addPrestataire},editPrestataire:{title:'Modifier prestataire',fields:prestataireFields,save:editPrestataire},
    addCharge:{title:'Nouvelle charge',fields:chargeFields,save:addCharge},editCharge:{title:'Modifier charge',fields:chargeFields,save:editCharge},
  };

  const tabs = [{id:'dashboard',label:'Dashboard'},{id:'clients',label:'Clients'},{id:'demandes',label:'Demandes'},{id:'prestataires',label:'Prestataires'},{id:'charges',label:'Charges'}];

  return (<>
    <div className="header">
      <div className="brand"><div className="logo">&AElig;</div><div><h1>AEGIS SERVICE</h1><p>Application de gestion</p></div></div>
      <div className="tabs">{tabs.map(tab=>(<button key={tab.id} className={view===tab.id?'active':''} onClick={()=>{setView(tab.id);setSelected(null);}}>
        {tab.id==='demandes'&&allDemandes.length>0&&<span style={{background:'var(--red)',color:'#fff',borderRadius:10,padding:'1px 6px',fontSize:9,marginRight:4}}>{allDemandes.length}</span>}{tab.label}
      </button>))}</div>
    </div>
    <div className="body">
      {view==='dashboard'&&renderDashboard()}
      {view==='clients'&&renderClients()}
      {view==='demandes'&&renderDemandes()}
      {view==='prestataires'&&renderPrestataires()}
      {view==='charges'&&renderCharges()}
    </div>
    {modal&&modalConfig[modal]&&<div className="overlay" onClick={closeModal}><div className="modal" onClick={e=>e.stopPropagation()}>
      <h3>{modalConfig[modal].title}</h3>{modalConfig[modal].fields()}
      <div className="modal-actions"><button className="btn btn-outline" onClick={closeModal}>Annuler</button><button className="btn" onClick={modalConfig[modal].save}>Enregistrer</button></div>
    </div></div>}
    {toast&&<div className="toast">{toast}</div>}
  </>);
}
