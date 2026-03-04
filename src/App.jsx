import { useState, useEffect, useCallback, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from "recharts";
import * as _XLSX from "sheetjs";
const XLSX = _XLSX;

const STORAGE_KEY = "health-tracker-data";
function loadData() { try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }
function saveData(d) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch (e) { console.error(e); } }
function todayStr() { const d = new Date(); return ds(d.getFullYear(), d.getMonth(), d.getDate()); }
function ds(y, m, d) { return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }
function fmtLabel(s) { const [, m, d] = s.split("-"); return `${parseInt(m)}/${parseInt(d)}`; }
function fmtFull(s) { const [y, m, d] = s.split("-"); return `${parseInt(y)}年${parseInt(m)}月${parseInt(d)}日`; }
function fmtCompact(s) { const [, m, d] = s.split("-"); return `${parseInt(m)}月${parseInt(d)}日`; }
function getDow(s) { return "日月火水木金土"[new Date(s + "T00:00:00").getDay()]; }
function getMonthDays(y, mo) { const f = new Date(y, mo, 1).getDay(); const c = new Date(y, mo + 1, 0).getDate(); const d = []; for (let i = 0; i < f; i++) d.push(null); for (let i = 1; i <= c; i++) d.push(i); return d; }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return ds(d.getFullYear(), d.getMonth(), d.getDate()); }
function nowTime() { return new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }); }
const defState = () => ({ records: {}, medications: ["朝の薬", "昼の薬", "夜の薬"] });
const WD = ["日","月","火","水","木","金","土"];

const TH = {
  am: { hBg: "linear-gradient(135deg,#2e7d32,#43a047)", hSh: "rgba(46,125,50,0.3)", pBg: "linear-gradient(180deg,#f0f7f0,#fafaf7 30%)", ac: "#2e7d32", cBg: "white", cTx: "#1a1a2e", tBg: "#e8e8e0", tAc: "white", tAcT: "#2e7d32", tT: "#888", bG: "linear-gradient(135deg,#2e7d32,#43a047)", bSG: "linear-gradient(135deg,#66bb6a,#81c784)", mL: "☀️ 朝", mLF: "朝の測定", iBg: "#fafafa", bC: "#e0e0e0", sT: "#999", mT: "#bbb" },
  pm: { hBg: "linear-gradient(135deg,#1a237e,#283593)", hSh: "rgba(26,35,126,0.3)", pBg: "linear-gradient(180deg,#e8eaf6,#f5f5f6 30%)", ac: "#1a237e", cBg: "#f5f5ff", cTx: "#1a1a2e", tBg: "#d8d8e8", tAc: "#f5f5ff", tAcT: "#1a237e", tT: "#888", bG: "linear-gradient(135deg,#1a237e,#3949ab)", bSG: "linear-gradient(135deg,#5c6bc0,#7986cb)", mL: "🌙 夜", mLF: "夜の測定", iBg: "#f0f0fa", bC: "#c5cae9", sT: "#7986cb", mT: "#9fa8da" },
};

function parseDate(val) {
  if (val == null) return null;
  if (typeof val === "number" && val > 30000 && val < 100000) { const d = new Date(Date.UTC(1899, 11, 30 + val)); return ds(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); }
  const s = String(val).trim();
  let m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) return ds(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (m) return ds(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})月(\d{1,2})日$/);
  if (m) return ds(new Date().getFullYear(), +m[1] - 1, +m[2]);
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (m) return ds(new Date().getFullYear(), +m[1] - 1, +m[2]);
  return null;
}
function parseSlot(v) { if (!v) return null; const s = String(v).trim(); if (/^(朝|朝方)$/.test(s)) return "am"; if (/^(夕|夕方|夜)$/.test(s)) return "pm"; return null; }
function parseText(text) {
  const lines = text.trim().split(/\r?\n/), res = [];
  for (const line of lines) {
    const tk = line.split(/[\t,\s\u3000]+/).filter(Boolean);
    if (!tk.length) continue;
    if (tk.some(t => /^(高|低|脈拍|最高|最低|日付|date)/i.test(t)) && !tk.some(t => parseDate(t))) continue;
    const date = parseDate(tk[0]); if (!date) continue;
    let amN = [], pmN = [], tgt = amN;
    for (const t of tk.slice(1)) { const sl = parseSlot(t); if (sl) { tgt = sl === "am" ? amN : pmN; continue; } const n = parseFloat(t); if (!isNaN(n) && n > 0) tgt.push(Math.round(n)); }
    if (amN.length > 0) res.push({ date, slot: "am", sys: amN[0]||null, dia: amN[1]||null, pls: amN[2]||null });
    if (pmN.length > 0) res.push({ date, slot: "pm", sys: pmN[0]||null, dia: pmN[1]||null, pls: pmN[2]||null });
  }
  return res;
}
function parseXLSX(data) {
  try { const wb = XLSX.read(data, { type: "array" }); const ws = wb.Sheets[wb.SheetNames[0]]; const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }); return parseText(rows.map(r => (r||[]).map(c => c == null ? "" : String(c)).join("\t")).join("\n")); } catch (e) { console.error(e); return []; }
}

function MiniCal({ value, onChange, onClose, records }) {
  const d = value ? new Date(value + "T00:00:00") : new Date();
  const [vy, sVy] = useState(d.getFullYear()), [vm, sVm] = useState(d.getMonth());
  const days = getMonthDays(vy, vm), td = todayStr();
  const pv = () => { if (vm === 0) { sVy(vy-1); sVm(11); } else sVm(vm-1); };
  const nx = () => { if (vm === 11) { sVy(vy+1); sVm(0); } else sVm(vm+1); };
  const nb = { width: 44, height: 44, borderRadius: 12, border: "none", background: "#f0f0ec", fontSize: 20, fontWeight: 700, cursor: "pointer" };
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }} onClick={onClose}>
      <div style={{ background:"white",borderRadius:24,padding:"20px 16px",width:"100%",maxWidth:380,boxShadow:"0 8px 40px rgba(0,0,0,0.2)" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12 }}>
          <button onClick={pv} style={nb}>◀</button>
          <span style={{ fontSize:22,fontWeight:800 }}>{vy}年 {vm+1}月</span>
          <button onClick={nx} style={nb}>▶</button>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4 }}>
          {WD.map((w,i) => <div key={w} style={{ textAlign:"center",fontSize:14,fontWeight:700,padding:"4px 0",color:i===0?"#e53935":i===6?"#1e88e5":"#888" }}>{w}</div>)}
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3 }}>
          {days.map((day,idx) => {
            if (!day) return <div key={`e${idx}`}/>;
            const dt = ds(vy,vm,day), sel = dt===value, isT = dt===td, has = !!records?.[dt], dw = idx%7;
            return <button key={dt} onClick={()=>{onChange(dt);onClose();}} style={{ aspectRatio:"1",borderRadius:12,border:sel?"3px solid #2e7d32":"none",background:sel?"#e8f5e9":isT?"#2e7d32":has?"#f1f8e9":"#fafafa",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",WebkitTapHighlightColor:"transparent" }}>
              <span style={{ fontSize:16,fontWeight:sel||isT?800:600,color:isT&&!sel?"white":dw===0?"#e53935":dw===6?"#1e88e5":"#444" }}>{day}</span>
              {has && <div style={{ width:5,height:5,borderRadius:"50%",background:isT&&!sel?"#81c784":"#e53935",marginTop:1 }}/>}
            </button>;
          })}
        </div>
        <button onClick={onClose} style={{ width:"100%",marginTop:14,padding:14,borderRadius:14,border:"none",background:"#f0f0ec",fontSize:18,fontWeight:700,cursor:"pointer" }}>閉じる</button>
      </div>
    </div>
  );
}

function RangeCal({ startDate, endDate, onS, onE, onClose }) {
  const [pk, sPk] = useState("start");
  const d = pk==="start"&&startDate ? new Date(startDate+"T00:00:00") : pk==="end"&&endDate ? new Date(endDate+"T00:00:00") : new Date();
  const [vy, sVy] = useState(d.getFullYear()), [vm, sVm] = useState(d.getMonth());
  const days = getMonthDays(vy, vm);
  const pv = () => { if (vm===0){sVy(vy-1);sVm(11);}else sVm(vm-1); };
  const nx = () => { if (vm===11){sVy(vy+1);sVm(0);}else sVm(vm+1); };
  const pick = dt => { if (pk==="start"){onS(dt);if(endDate&&dt>endDate)onE(dt);sPk("end");}else{if(dt<startDate){onS(dt);onE(startDate);}else onE(dt);} };
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }} onClick={onClose}>
      <div style={{ background:"white",borderRadius:24,padding:"20px 16px",width:"100%",maxWidth:380,boxShadow:"0 8px 40px rgba(0,0,0,0.2)" }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontSize:18,fontWeight:700,color:"#1a1a2e",marginBottom:8,textAlign:"center" }}>期間を選択</div>
        <div style={{ display:"flex",gap:8,marginBottom:12 }}>
          {[{id:"start",l:"開始日"},{id:"end",l:"終了日"}].map(t=><button key={t.id} onClick={()=>sPk(t.id)} style={{ flex:1,padding:"10px",borderRadius:12,border:"2px solid",borderColor:pk===t.id?"#2e7d32":"#e0e0e0",background:pk===t.id?"#e8f5e9":"white",fontSize:16,fontWeight:700,cursor:"pointer",color:pk===t.id?"#2e7d32":"#888" }}>{t.l}<br/><span style={{fontSize:14,fontWeight:600}}>{t.id==="start"?(startDate?fmtCompact(startDate):"未選択"):(endDate?fmtCompact(endDate):"未選択")}</span></button>)}
        </div>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
          <button onClick={pv} style={{ width:40,height:40,borderRadius:10,border:"none",background:"#f0f0ec",fontSize:18,fontWeight:700,cursor:"pointer" }}>◀</button>
          <span style={{ fontSize:20,fontWeight:800 }}>{vy}年 {vm+1}月</span>
          <button onClick={nx} style={{ width:40,height:40,borderRadius:10,border:"none",background:"#f0f0ec",fontSize:18,fontWeight:700,cursor:"pointer" }}>▶</button>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4 }}>
          {WD.map((w,i)=><div key={w} style={{ textAlign:"center",fontSize:13,fontWeight:700,padding:"3px 0",color:i===0?"#e53935":i===6?"#1e88e5":"#888" }}>{w}</div>)}
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3 }}>
          {days.map((day,idx)=>{
            if (!day) return <div key={`e${idx}`}/>;
            const dt=ds(vy,vm,day), inR=startDate&&endDate&&dt>=startDate&&dt<=endDate, isS=dt===startDate, isE=dt===endDate, dw=idx%7;
            return <button key={dt} onClick={()=>pick(dt)} style={{ aspectRatio:"1",borderRadius:10,border:(isS||isE)?"3px solid #2e7d32":"none",background:(isS||isE)?"#2e7d32":inR?"#c8e6c9":"#fafafa",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",WebkitTapHighlightColor:"transparent" }}><span style={{ fontSize:15,fontWeight:(isS||isE)?800:600,color:(isS||isE)?"white":dw===0?"#e53935":dw===6?"#1e88e5":"#444" }}>{day}</span></button>;
          })}
        </div>
        <button onClick={onClose} style={{ width:"100%",marginTop:14,padding:14,borderRadius:14,border:"none",background:"linear-gradient(135deg,#2e7d32,#43a047)",color:"white",fontSize:18,fontWeight:700,cursor:"pointer" }}>決定</button>
      </div>
    </div>
  );
}

function BPInput({ value, onChange, min, max, label, unit, accentColor, bgColor }) {
  const iR=useRef(null),tR=useRef(null),[ed,sEd]=useState(false),[ev,sEv]=useState(""),inR=useRef(null);
  const cl=v=>Math.max(min,Math.min(max,v));
  const st=d=>{onChange(cl(value+d));tR.current=setTimeout(()=>{iR.current=setInterval(()=>{onChange(p=>cl(p+d));},80);},400);};
  const sp=()=>{clearTimeout(tR.current);clearInterval(iR.current);};
  const se=()=>{sEv("");sEd(true);setTimeout(()=>inR.current?.focus(),50);};
  const cm=()=>{const v=parseInt(ev);if(!isNaN(v)&&ev!=="")onChange(cl(v));sEd(false);};
  const bs={width:"100%",height:54,borderRadius:14,border:"none",background:bgColor,fontSize:30,fontWeight:700,color:accentColor,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px rgba(0,0,0,0.06)",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"};
  return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:4,flex:1,minWidth:80,maxWidth:110 }}>
      <span style={{ fontSize:14,color:"#8a8a8a",fontWeight:600 }}>{label}</span>
      <button onPointerDown={()=>st(1)} onPointerUp={sp} onPointerLeave={sp} style={bs}>▲</button>
      {ed ? <input ref={inR} type="number" inputMode="numeric" pattern="[0-9]*" value={ev} placeholder={String(value)} onChange={e=>sEv(e.target.value)} onBlur={cm} onKeyDown={e=>e.key==="Enter"&&cm()} style={{ width:"100%",fontSize:38,fontWeight:800,textAlign:"center",border:`3px solid ${accentColor}`,borderRadius:12,padding:"6px 2px",outline:"none",color:"#1a1a2e",fontFamily:"'Noto Sans JP',sans-serif",background:"#fff" }}/> : <div onClick={se} style={{ fontSize:40,fontWeight:800,color:"#1a1a2e",textAlign:"center",lineHeight:1.2,cursor:"pointer",padding:"4px 0",fontFamily:"'Noto Sans JP',sans-serif",borderBottom:`2px dashed ${accentColor}`,minWidth:70 }}>{value}</div>}
      <button onPointerDown={()=>st(-1)} onPointerUp={sp} onPointerLeave={sp} style={bs}>▼</button>
      <span style={{ fontSize:13,color:"#aaa" }}>{unit}</span>
    </div>
  );
}

function CalView({ records, onTap }) {
  const now=new Date(),[vy,sVy]=useState(now.getFullYear()),[vm,sVm]=useState(now.getMonth());
  const td=todayStr(),days=getMonthDays(vy,vm);
  const pv=()=>{if(vm===0){sVy(vy-1);sVm(11);}else sVm(vm-1);};
  const nx=()=>{if(vm===11){sVy(vy+1);sVm(0);}else sVm(vm+1);};
  return (
    <div style={{ background:"white",borderRadius:24,padding:"20px 16px",boxShadow:"0 2px 16px rgba(0,0,0,0.06)",marginBottom:20 }}>
      <div style={{ fontSize:22,fontWeight:800,color:"#1a1a2e",marginBottom:16 }}>📅 カレンダー</div>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12 }}>
        <button onClick={pv} style={{ width:48,height:48,borderRadius:14,border:"none",background:"#f0f0ec",fontSize:22,fontWeight:700,cursor:"pointer" }}>◀</button>
        <span style={{ fontSize:24,fontWeight:800 }}>{vy}年 {vm+1}月</span>
        <button onClick={nx} style={{ width:48,height:48,borderRadius:14,border:"none",background:"#f0f0ec",fontSize:22,fontWeight:700,cursor:"pointer" }}>▶</button>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4 }}>
        {WD.map((w,i)=><div key={w} style={{ textAlign:"center",fontSize:15,fontWeight:700,padding:"6px 0",color:i===0?"#e53935":i===6?"#1e88e5":"#888" }}>{w}</div>)}
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3 }}>
        {days.map((day,idx)=>{
          if(!day) return <div key={`e${idx}`}/>;
          const d=ds(vy,vm,day),rc=records[d],hA=!!rc?.am,hP=!!rc?.pm,hM=rc?.meds&&Object.values(rc.meds).some(Boolean),has=hA||hP||hM,isT=d===td,dw=idx%7;
          return <button key={d} onClick={()=>onTap(d)} style={{ aspectRatio:"1",borderRadius:14,border:"none",background:isT?"#2e7d32":has?"#f1f8e9":"#fafafa",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",WebkitTapHighlightColor:"transparent" }}>
            <span style={{ fontSize:18,fontWeight:isT?800:600,color:isT?"white":dw===0?"#e53935":dw===6?"#1e88e5":"#444" }}>{day}</span>
            {has&&<div style={{ display:"flex",gap:2,marginTop:2 }}>{hA&&<div style={{ width:6,height:6,borderRadius:"50%",background:isT?"#81c784":"#ff9800" }}/>}{hP&&<div style={{ width:6,height:6,borderRadius:"50%",background:isT?"#a5d6a7":"#3949ab" }}/>}{hM&&<div style={{ width:6,height:6,borderRadius:"50%",background:isT?"#c8e6c9":"#1e88e5" }}/>}</div>}
          </button>;
        })}
      </div>
      <div style={{ display:"flex",gap:12,marginTop:12,justifyContent:"center",fontSize:14,color:"#888",flexWrap:"wrap" }}>
        <span style={{ display:"flex",alignItems:"center",gap:4 }}><div style={{ width:8,height:8,borderRadius:"50%",background:"#ff9800" }}/> 朝</span>
        <span style={{ display:"flex",alignItems:"center",gap:4 }}><div style={{ width:8,height:8,borderRadius:"50%",background:"#3949ab" }}/> 夜</span>
        <span style={{ display:"flex",alignItems:"center",gap:4 }}><div style={{ width:8,height:8,borderRadius:"50%",background:"#1e88e5" }}/> 薬</span>
      </div>
    </div>
  );
}

function CTooltip({ active, payload, label }) {
  if (!active||!payload?.length) return null;
  const dl = typeof label==="number"?(()=>{const d=new Date(label);return `${d.getMonth()+1}月${d.getDate()}日`;})():label;
  return <div style={{ background:"white",borderRadius:12,padding:"12px 16px",boxShadow:"0 4px 20px rgba(0,0,0,0.15)",fontSize:15 }}>
    <p style={{ margin:0,fontWeight:700,marginBottom:6 }}>{dl}</p>
    {payload.filter(p=>p.value!==null).map((p,i)=><p key={i} style={{ margin:"2px 0",color:p.color,fontWeight:600 }}>{p.name}: {p.value} {p.name.includes("脈拍")?"bpm":"mmHg"}</p>)}
  </div>;
}

function bpLv(sys) { if(!sys||sys===0) return {text:"—",color:"#888",bg:"#f5f5f5"}; if(sys<120) return {text:"正常",color:"#4caf50",bg:"#e8f5e9"}; if(sys<130) return {text:"正常高値",color:"#8bc34a",bg:"#f1f8e9"}; if(sys<140) return {text:"高値",color:"#ff9800",bg:"#fff3e0"}; return {text:"高血圧",color:"#f44336",bg:"#fce4ec"}; }

function ChartS({ data: cd, n }) {
  if (n===0) return <div style={{ textAlign:"center",padding:"50px 20px",color:"#bbb",fontSize:18 }}>📝 データなし</div>;
  return <>
    <div style={{ width:"100%",height:280 }}><ResponsiveContainer><LineChart data={cd} margin={{ top:10,right:10,left:-10,bottom:5 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
      <XAxis dataKey="timestamp" type="number" scale="time" domain={["dataMin","dataMax"]} tickFormatter={ts=>{const d=new Date(ts);return `${d.getMonth()+1}/${d.getDate()}`;}} tick={{ fontSize:13,fill:"#888" }} tickMargin={8}/>
      <YAxis domain={[40,200]} tick={{ fontSize:14,fill:"#888" }} tickMargin={4}/>
      <Tooltip content={<CTooltip/>}/>
      <ReferenceArea y1={140} y2={200} fill="#f44336" fillOpacity={0.06}/>
      <ReferenceArea y1={90} y2={200} fill="#ff9800" fillOpacity={0.04}/>
      <Line type="monotone" dataKey="最高" stroke="#e53935" strokeWidth={3} dot={{ r:5,fill:"#e53935" }} activeDot={{ r:8 }} connectNulls/>
      <Line type="monotone" dataKey="最低" stroke="#1e88e5" strokeWidth={3} dot={{ r:5,fill:"#1e88e5" }} activeDot={{ r:8 }} connectNulls/>
      <Line type="monotone" dataKey="脈拍" stroke="#009688" strokeWidth={2} dot={{ r:4,fill:"#009688" }} strokeDasharray="5 3" connectNulls/>
    </LineChart></ResponsiveContainer></div>
    <div style={{ display:"flex",justifyContent:"center",gap:16,marginTop:10,flexWrap:"wrap" }}>
      {[{l:"最高",c:"#e53935"},{l:"最低",c:"#1e88e5"},{l:"脈拍",c:"#009688"}].map(i=><div key={i.l} style={{ display:"flex",alignItems:"center",gap:6,fontSize:14,fontWeight:600,color:i.c }}><div style={{ width:12,height:12,borderRadius:6,background:i.c }}/>{i.l}</div>)}
    </div>
  </>;
}

function ChartB({ data: cd, n }) {
  if (n===0) return <div style={{ textAlign:"center",padding:"50px 20px",color:"#bbb",fontSize:18 }}>📝 データなし</div>;
  return <>
    <div style={{ width:"100%",height:320 }}><ResponsiveContainer><LineChart data={cd} margin={{ top:10,right:10,left:-10,bottom:5 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
      <XAxis dataKey="timestamp" type="number" scale="time" domain={["dataMin","dataMax"]} tickFormatter={ts=>{const d=new Date(ts);return `${d.getMonth()+1}/${d.getDate()}`;}} tick={{ fontSize:13,fill:"#888" }} tickMargin={8}/>
      <YAxis domain={[40,200]} tick={{ fontSize:14,fill:"#888" }} tickMargin={4}/>
      <Tooltip content={<CTooltip/>}/>
      <ReferenceArea y1={140} y2={200} fill="#f44336" fillOpacity={0.06}/>
      <ReferenceArea y1={90} y2={200} fill="#ff9800" fillOpacity={0.04}/>
      <Line type="monotone" dataKey="朝最高" stroke="#e53935" strokeWidth={2.5} dot={{ r:4,fill:"#e53935" }} connectNulls/>
      <Line type="monotone" dataKey="朝最低" stroke="#1e88e5" strokeWidth={2.5} dot={{ r:4,fill:"#1e88e5" }} connectNulls/>
      <Line type="monotone" dataKey="朝脈拍" stroke="#009688" strokeWidth={2} dot={{ r:3,fill:"#009688" }} connectNulls/>
      <Line type="monotone" dataKey="夜最高" stroke="#e53935" strokeWidth={2.5} dot={{ r:4,fill:"#e53935",strokeWidth:2,stroke:"#fff" }} strokeDasharray="6 3" connectNulls/>
      <Line type="monotone" dataKey="夜最低" stroke="#1e88e5" strokeWidth={2.5} dot={{ r:4,fill:"#1e88e5",strokeWidth:2,stroke:"#fff" }} strokeDasharray="6 3" connectNulls/>
      <Line type="monotone" dataKey="夜脈拍" stroke="#009688" strokeWidth={2} dot={{ r:3,fill:"#009688",strokeWidth:2,stroke:"#fff" }} strokeDasharray="6 3" connectNulls/>
    </LineChart></ResponsiveContainer></div>
    <div style={{ display:"flex",justifyContent:"center",gap:10,marginTop:10,flexWrap:"wrap",fontSize:13 }}>
      <span style={{ fontWeight:700,color:"#888" }}>☀️朝＝実線</span>
      <span style={{ fontWeight:700,color:"#888" }}>🌙夜＝破線</span>
      {[{l:"最高",c:"#e53935"},{l:"最低",c:"#1e88e5"},{l:"脈拍",c:"#009688"}].map(i=><div key={i.l} style={{ display:"flex",alignItems:"center",gap:4,fontWeight:600,color:i.c }}><div style={{ width:10,height:10,borderRadius:5,background:i.c }}/>{i.l}</div>)}
    </div>
  </>;
}

function ImportDlg({ onClose, onImport }) {
  const [mode, sMode] = useState("text"), [text, sText] = useState(""), [prev, sPrev] = useState(null), [ow, sOw] = useState(true), fRef = useRef(null);
  const doParse = () => sPrev(parseText(text));
  const doFile = e => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    if (/\.(csv|tsv|txt)$/i.test(f.name)) { r.onload = ev => sPrev(parseText(ev.target.result)); r.readAsText(f); }
    else { r.onload = ev => sPrev(parseXLSX(new Uint8Array(ev.target.result))); r.readAsArrayBuffer(f); }
  };
  const doConfirm = () => { if (prev?.length) { onImport(prev, ow); onClose(); } };
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:12 }} onClick={onClose}>
      <div style={{ background:"white",borderRadius:24,padding:"24px 20px",width:"100%",maxWidth:440,maxHeight:"85vh",overflow:"auto",boxShadow:"0 8px 40px rgba(0,0,0,0.25)" }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontSize:22,fontWeight:800,color:"#1a1a2e",marginBottom:16 }}>📥 データ取り込み</div>
        <div style={{ display:"flex",gap:6,marginBottom:16 }}>
          {[{id:"text",l:"📋 テキスト"},{id:"file",l:"📁 ファイル"}].map(m=><button key={m.id} onClick={()=>{sMode(m.id);sPrev(null);}} style={{ flex:1,padding:"10px 4px",borderRadius:12,border:"2px solid",fontSize:15,fontWeight:700,cursor:"pointer",borderColor:mode===m.id?"#2e7d32":"#e0e0e0",background:mode===m.id?"#e8f5e9":"white",color:mode===m.id?"#2e7d32":"#888" }}>{m.l}</button>)}
        </div>
        {mode==="text"&&!prev&&<>
          <div style={{ fontSize:14,color:"#888",marginBottom:8,lineHeight:1.6 }}>1行1日。例: <code style={{ background:"#f5f5f5",padding:"2px 6px",borderRadius:4 }}>2/21 朝 130 80 78 夕 120 70 66</code></div>
          <textarea value={text} onChange={e=>sText(e.target.value)} rows={8} placeholder="ここにデータを貼り付け..." style={{ width:"100%",fontSize:15,padding:"12px",borderRadius:14,border:"2px solid #e0e0e0",outline:"none",resize:"vertical",fontFamily:"monospace",lineHeight:1.5,background:"#fafafa" }}/>
          <button onClick={doParse} disabled={!text.trim()} style={{ width:"100%",marginTop:12,padding:14,borderRadius:14,border:"none",fontSize:18,fontWeight:700,background:text.trim()?"linear-gradient(135deg,#2e7d32,#43a047)":"#e0e0e0",color:"white",cursor:text.trim()?"pointer":"default" }}>解析する</button>
        </>}
        {mode==="file"&&!prev&&<>
          <div style={{ fontSize:14,color:"#888",marginBottom:12 }}>CSV・TSV・XLSX に対応</div>
          <input ref={fRef} type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" onChange={doFile} style={{ display:"none" }}/>
          <button onClick={()=>fRef.current?.click()} style={{ width:"100%",padding:"20px",borderRadius:16,border:"3px dashed #c8e6c9",background:"#f1f8e9",fontSize:18,fontWeight:700,color:"#2e7d32",cursor:"pointer",textAlign:"center" }}>📁 ファイルを選択</button>
        </>}
        {prev&&<>
          <div style={{ fontSize:18,fontWeight:700,color:"#1a1a2e",marginBottom:8 }}>📋 プレビュー（{prev.length}件）</div>
          {prev.length===0?<div style={{ padding:20,textAlign:"center",color:"#e53935",fontSize:16,fontWeight:600 }}>データが見つかりません</div>:<>
            <div style={{ overflowX:"auto",marginBottom:12 }}>
              <table style={{ width:"100%",borderCollapse:"collapse",fontSize:14 }}>
                <thead><tr style={{ background:"#f5f5f5" }}>{["日付","朝/夜","最高","最低","脈拍"].map(h=><th key={h} style={{ padding:"8px 6px",textAlign:"center",fontWeight:700,borderBottom:"2px solid #e0e0e0" }}>{h}</th>)}</tr></thead>
                <tbody>{prev.slice(0,20).map((r,i)=><tr key={i} style={{ background:i%2?"#fafafa":"white" }}>
                  <td style={{ padding:"6px",textAlign:"center",fontWeight:600 }}>{fmtCompact(r.date)}</td>
                  <td style={{ padding:"6px",textAlign:"center" }}>{r.slot==="am"?"☀️朝":"🌙夜"}</td>
                  <td style={{ padding:"6px",textAlign:"center",color:"#e53935",fontWeight:700 }}>{r.sys||"—"}</td>
                  <td style={{ padding:"6px",textAlign:"center",color:"#1e88e5",fontWeight:700 }}>{r.dia||"—"}</td>
                  <td style={{ padding:"6px",textAlign:"center",color:"#009688",fontWeight:700 }}>{r.pls||"—"}</td>
                </tr>)}</tbody>
              </table>
              {prev.length>20&&<div style={{ fontSize:13,color:"#999",textAlign:"center",marginTop:4 }}>...他 {prev.length-20} 件</div>}
            </div>
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:12 }}>
              <button onClick={()=>sOw(!ow)} style={{ width:32,height:32,borderRadius:8,border:"2px solid #2e7d32",background:ow?"#2e7d32":"white",color:"white",fontSize:18,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}>{ow?"✓":""}</button>
              <span style={{ fontSize:15,color:"#555" }}>既存データを上書き</span>
            </div>
            <div style={{ display:"flex",gap:8 }}>
              <button onClick={()=>sPrev(null)} style={{ flex:1,padding:14,borderRadius:14,border:"2px solid #e0e0e0",background:"white",fontSize:16,fontWeight:700,color:"#888",cursor:"pointer" }}>戻る</button>
              <button onClick={doConfirm} style={{ flex:2,padding:14,borderRadius:14,border:"none",background:"linear-gradient(135deg,#2e7d32,#43a047)",color:"white",fontSize:18,fontWeight:700,cursor:"pointer" }}>✓ {prev.length}件を取込</button>
            </div>
          </>}
        </>}
        {!prev&&<button onClick={onClose} style={{ width:"100%",marginTop:12,padding:14,borderRadius:14,border:"none",background:"#f0f0ec",fontSize:16,fontWeight:700,cursor:"pointer",color:"#888" }}>閉じる</button>}
      </div>
    </div>
  );
}

export default function HealthTracker() {
  const [data,setData]=useState(null),[loading,setLoading]=useState(true),[today]=useState(todayStr());
  const [editDate,setEditDate]=useState(todayStr()),[slot,setSlot]=useState("am");
  const [sys,sSys]=useState(130),[dia,sDia]=useState(80),[pls,sPls]=useState(70),[mTime,sMTime]=useState(nowTime());
  const [memo,sMemo]=useState(""),[tab,sTab]=useState("today"),[saved,sSaved]=useState(false);
  const [showDP,sShowDP]=useState(false),[showImp,sShowImp]=useState(false);
  const [pp,sPP]=useState("twoweek"),[cS,sCS]=useState(daysAgo(14)),[cE,sCE]=useState(todayStr()),[showRP,sShowRP]=useState(false);
  const [cf,sCF]=useState("both"),[hv,sHV]=useState("card");
  const presets={week:7,twoweek:14,month:30,threemonth:90};
  const pLabels={week:"1週間",twoweek:"2週間",month:"1ヶ月",threemonth:"3ヶ月",custom:"期間指定"};
  const rS=pp==="custom"?cS:daysAgo(presets[pp]), rE=pp==="custom"?cE:todayStr();
  const T=TH[slot];

  useEffect(()=>{
    const ld=loadData(); const d=ld||defState(); let mg=false;
    Object.keys(d.records).forEach(dt=>{const r=d.records[dt];if(r.bp&&!r.am&&!r.pm){r.am={...r.bp};delete r.bp;mg=true;}});
    setData(d); if(mg) saveData(d); const autoSlot = (() => { const h = new Date().getHours(); return (h >= 4 && h < 16) ? "am" : "pm"; })(); setSlot(autoSlot); ldRec(d, todayStr(), autoSlot); setLoading(false);
  },[]);

  const ldRec=(d,dt,sl)=>{const r=d.records[dt],bp=r?.[sl]; if(bp){sSys(bp.systolic);sDia(bp.diastolic);sPls(bp.pulse||70);sMTime(bp.time||nowTime());}else{sSys(130);sDia(80);sPls(70);sMTime(nowTime());} sMemo(r?.memo||"");};
  const swDate=dt=>{setEditDate(dt);if(data)ldRec(data,dt,slot);};
  const swSlot=sl=>{setSlot(sl);if(data)ldRec(data,editDate,sl);};
  const persist=useCallback(nd=>{setData(nd);saveData(nd);},[]);
  const eRec=data?.records[editDate]||{};

  const togMed=mn=>{const nd={...data,records:{...data.records}};const r={...(nd.records[editDate]||{})};const ms={...(r.meds||{})};ms[mn]=!ms[mn];r.meds=ms;nd.records[editDate]=r;persist(nd);};
  const saveBP=()=>{const nd={...data,records:{...data.records}};const r={...(nd.records[editDate]||{})};r[slot]={systolic:sys,diastolic:dia,pulse:pls,time:mTime};r.memo=memo;nd.records[editDate]=r;persist(nd);sSaved(true);setTimeout(()=>sSaved(false),2000);};
  const saveMemo=()=>{const nd={...data,records:{...data.records}};const r={...(nd.records[editDate]||{})};r.memo=memo;nd.records[editDate]=r;persist(nd);};

  const doImport=(entries,overwrite)=>{const nd={...data,records:{...data.records}};for(const e of entries){if(!e.date||!e.sys)continue;const r={...(nd.records[e.date]||{})};if(!overwrite&&r[e.slot])continue;r[e.slot]={systolic:e.sys,diastolic:e.dia||0,pulse:e.pls||0,time:""};nd.records[e.date]=r;}persist(nd);};

  const bldS=sl=>{if(!data)return[];const r=[];const s=new Date(rS+"T00:00:00"),e=new Date(rE+"T00:00:00");for(let d=new Date(s);d<=e;d.setDate(d.getDate()+1)){const k=ds(d.getFullYear(),d.getMonth(),d.getDate()),rc=data.records[k]?.[sl];r.push({timestamp:new Date(k+"T00:00:00").getTime(),最高:rc?rc.systolic:null,最低:rc?rc.diastolic:null,脈拍:rc?(rc.pulse||null):null});}return r;};
  const bldB=()=>{if(!data)return[];const r=[];const s=new Date(rS+"T00:00:00"),e=new Date(rE+"T00:00:00");for(let d=new Date(s);d<=e;d.setDate(d.getDate()+1)){const k=ds(d.getFullYear(),d.getMonth(),d.getDate()),am=data.records[k]?.am,pm=data.records[k]?.pm;r.push({timestamp:new Date(k+"T00:00:00").getTime(),朝最高:am?am.systolic:null,朝最低:am?am.diastolic:null,朝脈拍:am?(am.pulse||null):null,夜最高:pm?pm.systolic:null,夜最低:pm?pm.diastolic:null,夜脈拍:pm?(pm.pulse||null):null});}return r;};

  const cdS=cf!=="both"?bldS(cf):[], cdB=cf==="both"?bldB():[];
  const seN=cdS.filter(d=>d["最高"]!==null), beA=cdB.filter(d=>d["朝最高"]!==null), beP=cdB.filter(d=>d["夜最高"]!==null);
  const avg=(arr,ks,kd,kp)=>{const n=arr.length;if(!n)return{n:0};return{n,s:Math.round(arr.reduce((a,e)=>a+(e[ks]||0),0)/n),d:Math.round(arr.reduce((a,e)=>a+(e[kd]||0),0)/n),p:Math.round(arr.reduce((a,e)=>a+(e[kp]||0),0)/n)};};
  const aS=cf!=="both"?avg(seN,"最高","最低","脈拍"):{n:0};
  const aA=cf==="both"?avg(beA,"朝最高","朝最低","朝脈拍"):{n:0};
  const aP=cf==="both"?avg(beP,"夜最高","夜最低","夜脈拍"):{n:0};

  if(loading) return <div style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#fafaf7",fontFamily:"'Noto Sans JP',sans-serif" }}><div style={{ fontSize:24,color:"#888" }}>読み込み中...</div></div>;

  const lv=bpLv(sys), allMed=data.medications.every(m=>eRec.meds?.[m]), isT=editDate===today;
  const hDates=Object.keys(data.records).sort().reverse(), curSD=eRec[slot];

  const AvgC=({a,label})=>{
    if(a.n===0) return <div style={{ textAlign:"center",padding:"12px 0",color:"#bbb",fontSize:15 }}>{label||""}データなし</div>;
    const c=bpLv(a.s);
    return <div style={{ marginBottom:10 }}>
      {label&&<div style={{ fontSize:15,fontWeight:700,color:"#666",marginBottom:6 }}>{label}</div>}
      <div style={{ display:"flex",gap:6 }}>
        {[{l:"最高",v:a.s,c:"#e53935",bg:"#fce4ec"},{l:"最低",v:a.d,c:"#1e88e5",bg:"#e3f2fd"},{l:"脈拍",v:a.p,c:"#009688",bg:"#e0f2f1"},{l:"判定",v:c.text,c:c.color,bg:c.bg}].map(i=><div key={i.l} style={{ flex:1,background:i.bg,borderRadius:12,padding:"10px 4px",textAlign:"center" }}><div style={{ fontSize:11,color:"#999" }}>{i.l}</div><div style={{ fontSize:typeof i.v==="number"?24:16,fontWeight:800,color:i.c }}>{i.v}</div></div>)}
      </div>
      <div style={{ fontSize:13,color:"#aaa",marginTop:4 }}>計測: {a.n}回</div>
    </div>;
  };

  return (
    <div style={{ minHeight:"100vh",background:T.pBg,fontFamily:"'Noto Sans JP',sans-serif",paddingBottom:100,transition:"background 0.4s" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
      {showDP&&<MiniCal value={editDate} onChange={d=>{swDate(d);sTab("today");}} onClose={()=>sShowDP(false)} records={data.records}/>}
      {showRP&&<RangeCal startDate={cS} endDate={cE} onS={sCS} onE={sCE} onClose={()=>sShowRP(false)}/>}
      {showImp&&<ImportDlg onClose={()=>sShowImp(false)} onImport={doImport}/>}

      <div style={{ background:T.hBg,padding:"24px 20px 20px",color:"white",borderRadius:"0 0 28px 28px",boxShadow:`0 4px 20px ${T.hSh}`,transition:"background 0.4s" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div style={{ fontSize:22,fontWeight:700,opacity:0.9,letterSpacing:1 }}>💊 けんこう日記</div>
          <button onClick={()=>sShowImp(true)} style={{ background:"rgba(255,255,255,0.2)",border:"none",borderRadius:10,padding:"6px 12px",color:"white",fontSize:14,fontWeight:700,cursor:"pointer" }}>📥 取込</button>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:8,marginTop:8 }}>
          <button onClick={()=>sShowDP(true)} style={{ background:"rgba(255,255,255,0.15)",border:"2px solid rgba(255,255,255,0.3)",borderRadius:14,padding:"8px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:6,WebkitTapHighlightColor:"transparent",flex:1 }}>
            <span style={{ fontSize:20,fontWeight:900,color:"white",letterSpacing:1 }}>{fmtFull(editDate)}</span>
            <span style={{ fontSize:14,color:"rgba(255,255,255,0.7)" }}>▼</span>
          </button>
          <div style={{ display:"flex",borderRadius:12,overflow:"hidden",border:"2px solid rgba(255,255,255,0.3)" }}>
            {[{id:"am",l:"☀️朝"},{id:"pm",l:"🌙夜"}].map(s=><button key={s.id} onClick={()=>swSlot(s.id)} style={{ padding:"8px 14px",border:"none",fontSize:16,fontWeight:800,cursor:"pointer",background:slot===s.id?"rgba(255,255,255,0.3)":"transparent",color:"white",WebkitTapHighlightColor:"transparent" }}>{s.l}</button>)}
          </div>
        </div>
        <div style={{ fontSize:16,marginTop:6,opacity:0.85,fontWeight:600,display:"flex",alignItems:"center",gap:8 }}>
          {getDow(editDate)}曜日 — {T.mLF}
          {!isT&&<span style={{ fontSize:12,background:"rgba(255,255,255,0.2)",padding:"2px 8px",borderRadius:8 }}>過去の日付</span>}
        </div>
      </div>

      <div style={{ display:"flex",gap:0,margin:"14px 16px 0",background:T.tBg,borderRadius:16,padding:4,transition:"background 0.4s" }}>
        {[{id:"today",l:"📋 記録"},{id:"calendar",l:"📅 暦"},{id:"chart",l:"📊 統計"},{id:"history",l:"📜 履歴"}].map(t=><button key={t.id} onClick={()=>sTab(t.id)} style={{ flex:1,padding:"12px 4px",border:"none",borderRadius:13,fontSize:15,fontWeight:700,cursor:"pointer",background:tab===t.id?T.tAc:"transparent",color:tab===t.id?T.tAcT:T.tT,boxShadow:tab===t.id?"0 2px 10px rgba(0,0,0,0.1)":"none",WebkitTapHighlightColor:"transparent",transition:"all 0.3s" }}>{t.l}</button>)}
      </div>

      <div style={{ padding:"0 16px",marginTop:14 }}>
        {tab==="today"&&<>
          {!isT&&<div style={{ background:"#fff3e0",borderRadius:16,padding:"10px 16px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <span style={{ fontSize:15,fontWeight:700,color:"#e65100" }}>📝 {fmtFull(editDate)} を編集中</span>
            <button onClick={()=>swDate(today)} style={{ fontSize:13,padding:"5px 10px",borderRadius:10,border:"none",background:T.ac,color:"white",fontWeight:700,cursor:"pointer" }}>今日に戻る</button>
          </div>}

          <div style={{ background:T.cBg,borderRadius:24,padding:"22px 18px",boxShadow:"0 2px 16px rgba(0,0,0,0.06)",marginBottom:16,transition:"background 0.4s" }}>
            <div style={{ fontSize:22,fontWeight:800,color:T.cTx,marginBottom:4 }}>🩺 血圧を記録 <span style={{ fontSize:17 }}>{T.mL}</span></div>
            <div style={{ fontSize:13,color:T.sT,marginBottom:10 }}>▲▼ or 数値タップで入力（タップ時クリア）</div>
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:12 }}>
              <span style={{ fontSize:15,fontWeight:600,color:T.sT }}>⏰ 測定時刻</span>
              <input type="time" value={mTime} onChange={e=>sMTime(e.target.value)} onBlur={e=>{
                const v=e.target.value; if(!v)return;
                const h=parseInt(v.split(":")[0]);
                const shouldBe=(h>=4&&h<16)?"am":"pm";
                if(shouldBe!==slot){
                  const msg=shouldBe==="am"?"朝モードに切り替えますか？":"夜モードに切り替えますか？";
                  if(window.confirm(`⏰ 時刻が${v}です。${msg}`)) swSlot(shouldBe);
              } }} style value={mTime} onChange={e=>sMTime(e.target.value)} style={{ fontSize:18,fontWeight:700,padding:"5px 10px",borderRadius:10,border:`2px solid ${T.bC}`,outline:"none",background:T.iBg,fontFamily:"'Noto Sans JP',sans-serif",color:T.cTx }}/>
            </div>
            <div style={{ textAlign:"center",marginBottom:12,padding:"7px 12px",borderRadius:12,background:lv.bg }}>
              <span style={{ fontSize:17,fontWeight:800,color:lv.color }}>{lv.text}</span>
              <span style={{ fontSize:13,color:lv.color,marginLeft:6,opacity:0.8 }}>({sys}/{dia})</span>
            </div>
            <div style={{ display:"flex",justifyContent:"center",gap:8,marginBottom:18,alignItems:"flex-start" }}>
              <BPInput value={sys} onChange={sSys} min={60} max={250} label="最高血圧" unit="mmHg" accentColor="#e53935" bgColor="#ffebee"/>
              <div style={{ fontSize:36,fontWeight:300,color:"#ccc",paddingTop:68 }}>/</div>
              <BPInput value={dia} onChange={sDia} min={30} max={180} label="最低血圧" unit="mmHg" accentColor="#1e88e5" bgColor="#e3f2fd"/>
              <BPInput value={pls} onChange={sPls} min={30} max={200} label="脈拍" unit="bpm" accentColor="#009688" bgColor="#e0f2f1"/>
            </div>
            <button onClick={saveBP} style={{ width:"100%",padding:"16px",borderRadius:16,border:"none",fontSize:20,fontWeight:800,background:saved?T.bSG:T.bG,color:"white",cursor:"pointer",boxShadow:`0 4px 16px ${T.hSh}`,transition:"all 0.3s",WebkitTapHighlightColor:"transparent" }}>{saved?"✓ 保存しました！":`💾 ${T.mLF}を記録`}</button>
            {curSD&&<div style={{ textAlign:"center",marginTop:8,fontSize:13,color:T.sT }}>記録済: {curSD.time} — {curSD.systolic}/{curSD.diastolic}</div>}
            {eRec[slot==="am"?"pm":"am"]&&<div style={{ textAlign:"center",marginTop:4,fontSize:12,color:T.mT }}>{slot==="am"?"🌙夜":"☀️朝"}: {eRec[slot==="am"?"pm":"am"].systolic}/{eRec[slot==="am"?"pm":"am"].diastolic}</div>}
          </div>

          <div style={{ background:T.cBg,borderRadius:24,padding:"22px 18px",boxShadow:"0 2px 16px rgba(0,0,0,0.06)",marginBottom:16,transition:"background 0.4s" }}>
            <div style={{ fontSize:22,fontWeight:800,color:T.cTx,marginBottom:12,display:"flex",alignItems:"center",gap:10 }}>
              💊 お薬チェック
              {allMed&&<span style={{ fontSize:13,background:"#e8f5e9",color:"#2e7d32",padding:"3px 10px",borderRadius:20,fontWeight:700 }}>✓ 完了</span>}
            </div>
            {data.medications.map(med=>{
              const ck=eRec.meds?.[med]||false;
              return <button key={med} onClick={()=>togMed(med)} style={{ display:"flex",alignItems:"center",gap:14,width:"100%",padding:"14px 16px",marginBottom:8,borderRadius:14,border:"3px solid",borderColor:ck?"#4caf50":T.bC,background:ck?"#f1f8e9":T.iBg,cursor:"pointer",WebkitTapHighlightColor:"transparent" }}>
                <div style={{ width:36,height:36,borderRadius:10,background:ck?"#4caf50":"#e0e0e0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,color:"white",flexShrink:0 }}>{ck?"✓":""}</div>
                <span style={{ fontSize:20,fontWeight:700,color:ck?"#2e7d32":"#666",textDecoration:ck?"line-through":"none" }}>{med}</span>
              </button>;
            })}
          </div>

          <div style={{ background:T.cBg,borderRadius:24,padding:"22px 18px",boxShadow:"0 2px 16px rgba(0,0,0,0.06)",marginBottom:16,transition:"background 0.4s" }}>
            <div style={{ fontSize:22,fontWeight:800,color:T.cTx,marginBottom:10 }}>📝 メモ</div>
            <textarea value={memo} onChange={e=>sMemo(e.target.value)} onBlur={saveMemo} placeholder="体調やメモを自由に入力..." rows={3} style={{ width:"100%",fontSize:17,padding:"12px 14px",borderRadius:14,border:`2px solid ${T.bC}`,outline:"none",resize:"vertical",fontFamily:"'Noto Sans JP',sans-serif",lineHeight:1.6,background:T.iBg }}/>
          </div>
        </>}

        {tab==="calendar"&&<CalView records={data.records} onTap={d=>{swDate(d);sTab("today");}}/>}

        {tab==="chart"&&<>
          <div style={{ background:"white",borderRadius:24,padding:"16px 14px",boxShadow:"0 2px 16px rgba(0,0,0,0.06)",marginBottom:14 }}>
            <div style={{ fontSize:18,fontWeight:800,color:"#1a1a2e",marginBottom:8 }}>📆 表示期間</div>
            <div style={{ display:"flex",gap:5,flexWrap:"wrap" }}>
              {Object.entries(pLabels).map(([k,l])=><button key={k} onClick={()=>{sPP(k);if(k==="custom")sShowRP(true);}} style={{ flex:k==="custom"?"1 1 100%":1,padding:"8px 2px",borderRadius:10,border:"2px solid",fontSize:14,fontWeight:700,cursor:"pointer",borderColor:pp===k?"#2e7d32":"#e0e0e0",background:pp===k?"#e8f5e9":"white",color:pp===k?"#2e7d32":"#888",WebkitTapHighlightColor:"transparent" }}>{l}</button>)}
            </div>
            {pp==="custom"&&<button onClick={()=>sShowRP(true)} style={{ marginTop:6,width:"100%",padding:"8px",borderRadius:10,border:"2px solid #2e7d32",background:"#f1f8e9",fontSize:14,fontWeight:600,color:"#2e7d32",cursor:"pointer" }}>📅 {fmtCompact(cS)} 〜 {fmtCompact(cE)}</button>}
          </div>

          <div style={{ display:"flex",gap:5,marginBottom:14 }}>
            {[{id:"am",l:"☀️ 朝"},{id:"pm",l:"🌙 夜"},{id:"both",l:"📊 両方"}].map(f=><button key={f.id} onClick={()=>sCF(f.id)} style={{ flex:1,padding:"9px 4px",borderRadius:10,border:"2px solid",fontSize:14,fontWeight:700,cursor:"pointer",borderColor:cf===f.id?"#2e7d32":"#e0e0e0",background:cf===f.id?"#e8f5e9":"white",color:cf===f.id?"#2e7d32":"#888",WebkitTapHighlightColor:"transparent" }}>{f.l}</button>)}
          </div>

          <div style={{ background:"white",borderRadius:24,padding:"16px 14px",boxShadow:"0 2px 16px rgba(0,0,0,0.06)",marginBottom:14 }}>
            <div style={{ fontSize:18,fontWeight:800,color:"#1a1a2e",marginBottom:10 }}>📊 期間平均</div>
            {cf!=="both"?<AvgC a={aS} label={null}/>:<><AvgC a={aA} label="☀️ 朝"/><AvgC a={aP} label="🌙 夜"/></>}
          </div>

          <div style={{ background:"white",borderRadius:24,padding:"18px 12px",boxShadow:"0 2px 16px rgba(0,0,0,0.06)",marginBottom:14 }}>
            <div style={{ fontSize:18,fontWeight:800,color:"#1a1a2e",marginBottom:12 }}>📈 血圧の推移</div>
            {cf!=="both"?<ChartS data={cdS} n={seN.length}/>:<ChartB data={cdB} n={beA.length+beP.length}/>}
            <div style={{ marginTop:10,padding:"8px 10px",background:"#f8f9fa",borderRadius:10,fontSize:13,lineHeight:1.6 }}>
              <div style={{ display:"flex",alignItems:"center",gap:6 }}><div style={{ width:16,height:10,borderRadius:3,background:"rgba(244,67,54,0.15)",flexShrink:0 }}/><span style={{ color:"#666" }}><strong style={{ color:"#f44336" }}>赤</strong>：最高140以上</span></div>
              <div style={{ display:"flex",alignItems:"center",gap:6,marginTop:2 }}><div style={{ width:16,height:10,borderRadius:3,background:"rgba(255,152,0,0.12)",flexShrink:0 }}/><span style={{ color:"#666" }}><strong style={{ color:"#ff9800" }}>黄</strong>：最低90以上</span></div>
            </div>
          </div>
        </>}

        {tab==="history"&&<div style={{ background:"white",borderRadius:24,padding:"18px 14px",boxShadow:"0 2px 16px rgba(0,0,0,0.06)" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
            <div style={{ fontSize:22,fontWeight:800,color:"#1a1a2e" }}>📜 履歴</div>
            <div style={{ display:"flex",borderRadius:10,overflow:"hidden",border:"2px solid #e0e0e0" }}>
              {[{id:"card",l:"📋"},{id:"table",l:"📊"}].map(v=><button key={v.id} onClick={()=>sHV(v.id)} style={{ padding:"6px 14px",border:"none",fontSize:16,cursor:"pointer",background:hv===v.id?"#e8f5e9":"white",color:hv===v.id?"#2e7d32":"#888",fontWeight:700,WebkitTapHighlightColor:"transparent" }}>{v.l}</button>)}
            </div>
          </div>
          {hDates.length===0?<div style={{ textAlign:"center",padding:40,color:"#bbb",fontSize:18 }}>まだ記録がありません</div>:hv==="card"?hDates.map(date=>{
            const rec=data.records[date],isD=date===today;
            const BR=({sl,label,icon})=>{const bp=rec[sl];if(!bp)return null;return <div style={{ display:"flex",gap:6,marginBottom:4,flexWrap:"wrap",alignItems:"baseline" }}><span style={{ fontSize:13,color:"#888" }}>{icon}</span><span style={{ fontSize:13,color:"#999",fontWeight:600 }}>{label} {bp.time}</span><span style={{ fontSize:22,fontWeight:800,color:"#e53935" }}>{bp.systolic}</span><span style={{ fontSize:14,color:"#ccc" }}>/</span><span style={{ fontSize:22,fontWeight:800,color:"#1e88e5" }}>{bp.diastolic}</span><span style={{ fontSize:12,color:"#999" }}>mmHg</span>{bp.pulse>0&&<><span style={{ fontSize:13,color:"#888",marginLeft:2 }}>💓</span><span style={{ fontSize:22,fontWeight:800,color:"#009688" }}>{bp.pulse}</span></>}</div>;};
            return <div key={date} style={{ padding:"12px 14px",marginBottom:8,borderRadius:14,background:"#f8f9fa",border:isD?"2px solid #4caf50":"2px solid transparent" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 }}>
                <span style={{ fontSize:17,fontWeight:700,color:"#333" }}>{fmtFull(date)}{isD&&<span style={{ fontSize:11,background:"#e8f5e9",color:"#2e7d32",padding:"2px 6px",borderRadius:6,marginLeft:6,fontWeight:700 }}>今日</span>}</span>
                <button onClick={()=>{swDate(date);sTab("today");}} style={{ fontSize:12,padding:"4px 10px",borderRadius:8,border:"2px solid #2e7d32",background:"white",color:"#2e7d32",cursor:"pointer",fontWeight:700 }}>✏️</button>
              </div>
              <BR sl="am" label="朝" icon="☀️"/><BR sl="pm" label="夜" icon="🌙"/>
              <div style={{ display:"flex",gap:4,flexWrap:"wrap",alignItems:"center",marginBottom:rec.memo?4:0 }}>
                <span style={{ fontSize:14,color:"#666" }}>💊</span>
                {data.medications.map(m=>{const tk=rec.meds?.[m];return <span key={m} style={{ fontSize:13,padding:"1px 6px",borderRadius:6,background:tk?"#e8f5e9":"#f5f5f5",color:tk?"#2e7d32":"#ccc",fontWeight:600 }}>{tk?"✓":"✗"} {m}</span>;})}
              </div>
              {rec.memo&&<div style={{ background:"#fffde7",borderRadius:10,padding:"6px 10px",fontSize:14,color:"#666",lineHeight:1.4,marginTop:2 }}>📝 {rec.memo}</div>}
            </div>;
          }):<div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%",borderCollapse:"collapse",fontSize:14,minWidth:480 }}>
              <thead><tr style={{ background:"#f5f5f5" }}>{["日付","☀️朝","🌙夜","💊","📝"].map(h=><th key={h} style={{ padding:"8px 4px",textAlign:"center",fontWeight:700,borderBottom:"2px solid #e0e0e0",whiteSpace:"nowrap",fontSize:13 }}>{h}</th>)}</tr></thead>
              <tbody>{hDates.map((date,i)=>{
                const rec=data.records[date],am=rec.am,pm=rec.pm;
                const mc=data.medications.filter(m=>rec.meds?.[m]).length,mt=data.medications.length;
                return <tr key={date} onClick={()=>{swDate(date);sTab("today");}} style={{ background:i%2?"#fafafa":"white",cursor:"pointer" }}>
                  <td style={{ padding:"7px 4px",textAlign:"center",fontWeight:600,whiteSpace:"nowrap" }}>{fmtCompact(date)}</td>
                  <td style={{ padding:"7px 4px",textAlign:"center",fontWeight:700 }}>{am?<><span style={{color:"#e53935"}}>{am.systolic}</span>/<span style={{color:"#1e88e5"}}>{am.diastolic}</span>{am.pulse>0&&<>/<span style={{color:"#009688"}}>{am.pulse}</span></>}</>:<span style={{color:"#ddd"}}>—</span>}</td>
                  <td style={{ padding:"7px 4px",textAlign:"center",fontWeight:700 }}>{pm?<><span style={{color:"#e53935"}}>{pm.systolic}</span>/<span style={{color:"#1e88e5"}}>{pm.diastolic}</span>{pm.pulse>0&&<>/<span style={{color:"#009688"}}>{pm.pulse}</span></>}</>:<span style={{color:"#ddd"}}>—</span>}</td>
                  <td style={{ padding:"7px 4px",textAlign:"center",color:mc===mt?"#4caf50":"#ff9800",fontWeight:700 }}>{mc}/{mt}</td>
                  <td style={{ padding:"7px 4px",textAlign:"center",maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"#888",fontSize:12 }}>{rec.memo||"—"}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>}
        </div>}
      </div>
    </div>
  );
}
