import { useState, useEffect, useCallback, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from "recharts";

// ── Storage ──
const STORAGE_KEY = "health-tracker-data";
function loadData() { try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }
function saveData(d) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch (e) { console.error(e); } }

// ── Date helpers ──
function todayStr() { const d = new Date(); return ds(d.getFullYear(), d.getMonth(), d.getDate()); }
function ds(y, m, d) { return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }
function formatDateLabel(s) { const [, m, d] = s.split("-"); return `${parseInt(m)}/${parseInt(d)}`; }
function formatDateFull(s) { const [y, m, d] = s.split("-"); return `${parseInt(y)}年${parseInt(m)}月${parseInt(d)}日`; }
function formatDateCompact(s) { const [, m, d] = s.split("-"); return `${parseInt(m)}月${parseInt(d)}日`; }
function getDow(s) { return WEEKDAYS[new Date(s + "T00:00:00").getDay()]; }
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function getMonthDays(year, month) {
  const first = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let i = 0; i < first; i++) days.push(null);
  for (let d = 1; d <= count; d++) days.push(d);
  return days;
}

function daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return ds(d.getFullYear(), d.getMonth(), d.getDate());
}

function nowTimeStr() { return new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }); }

const defaultState = () => ({ records: {}, medications: ["朝の薬", "昼の薬", "夜の薬"] });

// ── Theme colors ──
const THEMES = {
  am: {
    headerBg: "linear-gradient(135deg, #2e7d32 0%, #43a047 100%)",
    headerShadow: "rgba(46,125,50,0.3)",
    pageBg: "linear-gradient(180deg, #f0f7f0 0%, #fafaf7 30%)",
    accent: "#2e7d32", accentLight: "#43a047",
    cardBg: "white", cardText: "#1a1a2e",
    tabBg: "#e8e8e0", tabActive: "white", tabActiveText: "#2e7d32", tabText: "#888",
    btnGrad: "linear-gradient(135deg, #2e7d32, #43a047)",
    btnSavedGrad: "linear-gradient(135deg, #66bb6a, #81c784)",
    modeLabel: "☀️ 朝", modeLabelFull: "朝の測定",
    inputBg: "#fafafa", borderColor: "#e0e0e0",
    subText: "#999", mutedText: "#bbb",
  },
  pm: {
    headerBg: "linear-gradient(135deg, #1a237e 0%, #283593 100%)",
    headerShadow: "rgba(26,35,126,0.3)",
    pageBg: "linear-gradient(180deg, #e8eaf6 0%, #f5f5f6 30%)",
    accent: "#1a237e", accentLight: "#3949ab",
    cardBg: "#f5f5ff", cardText: "#1a1a2e",
    tabBg: "#d8d8e8", tabActive: "#f5f5ff", tabActiveText: "#1a237e", tabText: "#888",
    btnGrad: "linear-gradient(135deg, #1a237e, #3949ab)",
    btnSavedGrad: "linear-gradient(135deg, #5c6bc0, #7986cb)",
    modeLabel: "🌙 夜", modeLabelFull: "夜の測定",
    inputBg: "#f0f0fa", borderColor: "#c5cae9",
    subText: "#7986cb", mutedText: "#9fa8da",
  },
};

// ══════════════════════════════════════
// ── Mini Calendar Picker ──
// ══════════════════════════════════════
function MiniCalendar({ value, onChange, onClose, records }) {
  const d = value ? new Date(value + "T00:00:00") : new Date();
  const [vy, setVy] = useState(d.getFullYear());
  const [vm, setVm] = useState(d.getMonth());
  const days = getMonthDays(vy, vm);
  const today = todayStr();
  const prev = () => { if (vm === 0) { setVy(vy - 1); setVm(11); } else setVm(vm - 1); };
  const next = () => { if (vm === 11) { setVy(vy + 1); setVm(0); } else setVm(vm + 1); };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "white", borderRadius: 24, padding: "20px 16px", width: "100%", maxWidth: 380, boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button onClick={prev} style={{ width: 44, height: 44, borderRadius: 12, border: "none", background: "#f0f0ec", fontSize: 20, fontWeight: 700, cursor: "pointer" }}>◀</button>
          <span style={{ fontSize: 22, fontWeight: 800 }}>{vy}年 {vm + 1}月</span>
          <button onClick={next} style={{ width: 44, height: 44, borderRadius: 12, border: "none", background: "#f0f0ec", fontSize: 20, fontWeight: 700, cursor: "pointer" }}>▶</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
          {WEEKDAYS.map((w, i) => (<div key={w} style={{ textAlign: "center", fontSize: 14, fontWeight: 700, padding: "4px 0", color: i === 0 ? "#e53935" : i === 6 ? "#1e88e5" : "#888" }}>{w}</div>))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
          {days.map((day, idx) => {
            if (!day) return <div key={`e${idx}`} />;
            const dateStr = ds(vy, vm, day);
            const sel = dateStr === value;
            const isToday = dateStr === today;
            const hasData = !!records?.[dateStr];
            const dow = idx % 7;
            return (
              <button key={dateStr} onClick={() => { onChange(dateStr); onClose(); }} style={{
                aspectRatio: "1", borderRadius: 12, border: sel ? "3px solid #2e7d32" : "none",
                background: sel ? "#e8f5e9" : isToday ? "#2e7d32" : hasData ? "#f1f8e9" : "#fafafa",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                cursor: "pointer", WebkitTapHighlightColor: "transparent",
              }}>
                <span style={{ fontSize: 16, fontWeight: sel || isToday ? 800 : 600, color: isToday && !sel ? "white" : dow === 0 ? "#e53935" : dow === 6 ? "#1e88e5" : "#444" }}>{day}</span>
                {hasData && <div style={{ width: 5, height: 5, borderRadius: "50%", background: isToday && !sel ? "#81c784" : "#e53935", marginTop: 1 }} />}
              </button>
            );
          })}
        </div>
        <button onClick={onClose} style={{ width: "100%", marginTop: 14, padding: 14, borderRadius: 14, border: "none", background: "#f0f0ec", fontSize: 18, fontWeight: 700, cursor: "pointer" }}>閉じる</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════
// ── Range Calendar Picker ──
// ══════════════════════════════════════
function RangeCalendarPicker({ startDate, endDate, onChangeStart, onChangeEnd, onClose }) {
  const [picking, setPicking] = useState("start");
  const d = picking === "start" && startDate ? new Date(startDate + "T00:00:00") : picking === "end" && endDate ? new Date(endDate + "T00:00:00") : new Date();
  const [vy, setVy] = useState(d.getFullYear());
  const [vm, setVm] = useState(d.getMonth());
  const days = getMonthDays(vy, vm);
  const prev = () => { if (vm === 0) { setVy(vy - 1); setVm(11); } else setVm(vm - 1); };
  const next = () => { if (vm === 11) { setVy(vy + 1); setVm(0); } else setVm(vm + 1); };
  const handlePick = (dateStr) => {
    if (picking === "start") { onChangeStart(dateStr); if (endDate && dateStr > endDate) onChangeEnd(dateStr); setPicking("end"); }
    else { if (dateStr < startDate) { onChangeStart(dateStr); onChangeEnd(startDate); } else onChangeEnd(dateStr); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "white", borderRadius: 24, padding: "20px 16px", width: "100%", maxWidth: 380, boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginBottom: 8, textAlign: "center" }}>期間を選択</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {[{ id: "start", label: "開始日" }, { id: "end", label: "終了日" }].map((t) => (
            <button key={t.id} onClick={() => setPicking(t.id)} style={{
              flex: 1, padding: "10px", borderRadius: 12, border: "2px solid",
              borderColor: picking === t.id ? "#2e7d32" : "#e0e0e0", background: picking === t.id ? "#e8f5e9" : "white",
              fontSize: 16, fontWeight: 700, cursor: "pointer", color: picking === t.id ? "#2e7d32" : "#888",
            }}>{t.label}<br /><span style={{ fontSize: 14, fontWeight: 600 }}>{t.id === "start" ? (startDate ? formatDateCompact(startDate) : "未選択") : (endDate ? formatDateCompact(endDate) : "未選択")}</span></button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button onClick={prev} style={{ width: 40, height: 40, borderRadius: 10, border: "none", background: "#f0f0ec", fontSize: 18, fontWeight: 700, cursor: "pointer" }}>◀</button>
          <span style={{ fontSize: 20, fontWeight: 800 }}>{vy}年 {vm + 1}月</span>
          <button onClick={next} style={{ width: 40, height: 40, borderRadius: 10, border: "none", background: "#f0f0ec", fontSize: 18, fontWeight: 700, cursor: "pointer" }}>▶</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
          {WEEKDAYS.map((w, i) => (<div key={w} style={{ textAlign: "center", fontSize: 13, fontWeight: 700, padding: "3px 0", color: i === 0 ? "#e53935" : i === 6 ? "#1e88e5" : "#888" }}>{w}</div>))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
          {days.map((day, idx) => {
            if (!day) return <div key={`e${idx}`} />;
            const dateStr = ds(vy, vm, day);
            const inRange = startDate && endDate && dateStr >= startDate && dateStr <= endDate;
            const isStart = dateStr === startDate; const isEnd = dateStr === endDate; const dow = idx % 7;
            return (
              <button key={dateStr} onClick={() => handlePick(dateStr)} style={{
                aspectRatio: "1", borderRadius: 10, border: (isStart || isEnd) ? "3px solid #2e7d32" : "none",
                background: (isStart || isEnd) ? "#2e7d32" : inRange ? "#c8e6c9" : "#fafafa",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", WebkitTapHighlightColor: "transparent",
              }}><span style={{ fontSize: 15, fontWeight: (isStart || isEnd) ? 800 : 600, color: (isStart || isEnd) ? "white" : dow === 0 ? "#e53935" : dow === 6 ? "#1e88e5" : "#444" }}>{day}</span></button>
            );
          })}
        </div>
        <button onClick={onClose} style={{ width: "100%", marginTop: 14, padding: 14, borderRadius: 14, border: "none", background: "linear-gradient(135deg, #2e7d32, #43a047)", color: "white", fontSize: 18, fontWeight: 700, cursor: "pointer" }}>決定</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════
// ── BP Input (clears on tap) ──
// ══════════════════════════════════════
function BPInput({ value, onChange, min, max, label, unit, accentColor, bgColor }) {
  const intRef = useRef(null); const toRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState("");
  const inputRef = useRef(null);
  const clamp = (v) => Math.max(min, Math.min(max, v));
  const start = (delta) => { onChange(clamp(value + delta)); toRef.current = setTimeout(() => { intRef.current = setInterval(() => { onChange((p) => clamp(p + delta)); }, 80); }, 400); };
  const stop = () => { clearTimeout(toRef.current); clearInterval(intRef.current); };
  const startEdit = () => { setEditVal(""); setEditing(true); setTimeout(() => inputRef.current?.focus(), 50); };
  const commit = () => { const v = parseInt(editVal); if (!isNaN(v) && editVal !== "") onChange(clamp(v)); setEditing(false); };
  const btn = { width: "100%", height: 54, borderRadius: 14, border: "none", background: bgColor, fontSize: 30, fontWeight: 700, color: accentColor, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1, minWidth: 80, maxWidth: 110 }}>
      <span style={{ fontSize: 14, color: "#8a8a8a", fontWeight: 600 }}>{label}</span>
      <button onPointerDown={() => start(1)} onPointerUp={stop} onPointerLeave={stop} style={btn}>▲</button>
      {editing ? (
        <input ref={inputRef} type="number" inputMode="numeric" pattern="[0-9]*" value={editVal}
          placeholder={String(value)}
          onChange={(e) => setEditVal(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()}
          style={{ width: "100%", fontSize: 38, fontWeight: 800, textAlign: "center", border: `3px solid ${accentColor}`, borderRadius: 12, padding: "6px 2px", outline: "none", color: "#1a1a2e", fontFamily: "'Noto Sans JP', sans-serif", background: "#fff" }} />
      ) : (
        <div onClick={startEdit} style={{ fontSize: 40, fontWeight: 800, color: "#1a1a2e", textAlign: "center", lineHeight: 1.2, cursor: "pointer", padding: "4px 0", fontFamily: "'Noto Sans JP', sans-serif", borderBottom: `2px dashed ${accentColor}`, minWidth: 70 }}>{value}</div>
      )}
      <button onPointerDown={() => start(-1)} onPointerUp={stop} onPointerLeave={stop} style={btn}>▼</button>
      <span style={{ fontSize: 13, color: "#aaa" }}>{unit}</span>
    </div>
  );
}

// ── Calendar (main tab) ──
function CalendarView({ records, onDateTap }) {
  const now = new Date();
  const [vy, setVy] = useState(now.getFullYear());
  const [vm, setVm] = useState(now.getMonth());
  const today = todayStr();
  const days = getMonthDays(vy, vm);
  const prev = () => { if (vm === 0) { setVy(vy - 1); setVm(11); } else setVm(vm - 1); };
  const next = () => { if (vm === 11) { setVy(vy + 1); setVm(0); } else setVm(vm + 1); };

  return (
    <div style={{ background: "white", borderRadius: 24, padding: "20px 16px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 20 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#1a1a2e", marginBottom: 16 }}>📅 カレンダー</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button onClick={prev} style={{ width: 48, height: 48, borderRadius: 14, border: "none", background: "#f0f0ec", fontSize: 22, fontWeight: 700, cursor: "pointer" }}>◀</button>
        <span style={{ fontSize: 24, fontWeight: 800 }}>{vy}年 {vm + 1}月</span>
        <button onClick={next} style={{ width: 48, height: 48, borderRadius: 14, border: "none", background: "#f0f0ec", fontSize: 22, fontWeight: 700, cursor: "pointer" }}>▶</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {WEEKDAYS.map((w, i) => (<div key={w} style={{ textAlign: "center", fontSize: 15, fontWeight: 700, padding: "6px 0", color: i === 0 ? "#e53935" : i === 6 ? "#1e88e5" : "#888" }}>{w}</div>))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
        {days.map((day, idx) => {
          if (!day) return <div key={`e${idx}`} />;
          const d = ds(vy, vm, day);
          const rec = records[d];
          const hasAM = !!rec?.am; const hasPM = !!rec?.pm;
          const hasMeds = rec?.meds && Object.values(rec.meds).some(Boolean);
          const has = hasAM || hasPM || hasMeds;
          const isT = d === today; const dow = idx % 7;
          return (
            <button key={d} onClick={() => onDateTap(d)} style={{
              aspectRatio: "1", borderRadius: 14, border: "none",
              background: isT ? "#2e7d32" : has ? "#f1f8e9" : "#fafafa",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              cursor: "pointer", WebkitTapHighlightColor: "transparent",
            }}>
              <span style={{ fontSize: 18, fontWeight: isT ? 800 : 600, color: isT ? "white" : dow === 0 ? "#e53935" : dow === 6 ? "#1e88e5" : "#444" }}>{day}</span>
              {has && (
                <div style={{ display: "flex", gap: 2, marginTop: 2 }}>
                  {hasAM && <div style={{ width: 6, height: 6, borderRadius: "50%", background: isT ? "#81c784" : "#ff9800" }} />}
                  {hasPM && <div style={{ width: 6, height: 6, borderRadius: "50%", background: isT ? "#a5d6a7" : "#3949ab" }} />}
                  {hasMeds && <div style={{ width: 6, height: 6, borderRadius: "50%", background: isT ? "#c8e6c9" : "#1e88e5" }} />}
                </div>
              )}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 12, justifyContent: "center", fontSize: 14, color: "#888", flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff9800" }} /> 朝</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3949ab" }} /> 夜</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: "#1e88e5" }} /> 薬</span>
      </div>
    </div>
  );
}

// ── Tooltip ──
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const dateLabel = typeof label === "number" ? (() => { const d = new Date(label); return `${d.getMonth() + 1}月${d.getDate()}日`; })() : label;
  return (
    <div style={{ background: "white", borderRadius: 12, padding: "12px 16px", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", fontSize: 16 }}>
      <p style={{ margin: 0, fontWeight: 700, marginBottom: 6 }}>{dateLabel}</p>
      {payload.filter((p) => p.value !== null).map((p, i) => (<p key={i} style={{ margin: "2px 0", color: p.color, fontWeight: 600 }}>{p.name}: {p.value} {p.name === "脈拍" ? "bpm" : "mmHg"}</p>))}
    </div>
  );
}

// ── BP Level ──
function bpLevel(sys) {
  if (sys < 120) return { text: "正常", color: "#4caf50", bg: "#e8f5e9" };
  if (sys < 130) return { text: "正常高値", color: "#8bc34a", bg: "#f1f8e9" };
  if (sys < 140) return { text: "高値", color: "#ff9800", bg: "#fff3e0" };
  return { text: "高血圧", color: "#f44336", bg: "#fce4ec" };
}

// ── Chart component ──
function BPChart({ chartData, dataCount }) {
  if (dataCount === 0) return (<div style={{ textAlign: "center", padding: "60px 20px", color: "#bbb", fontSize: 20 }}>📝 この期間のデータがありません</div>);
  return (
    <>
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="timestamp" type="number" scale="time" domain={["dataMin", "dataMax"]}
              tickFormatter={(ts) => { const d = new Date(ts); return `${d.getMonth() + 1}/${d.getDate()}`; }}
              tick={{ fontSize: 13, fill: "#888" }} tickMargin={8} />
            <YAxis domain={[40, 200]} tick={{ fontSize: 14, fill: "#888" }} tickMargin={4} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceArea y1={140} y2={200} fill="#f44336" fillOpacity={0.06} />
            <ReferenceArea y1={90} y2={200} fill="#ff9800" fillOpacity={0.04} />
            <Line type="monotone" dataKey="最高" stroke="#e53935" strokeWidth={3} dot={{ r: 5, fill: "#e53935" }} activeDot={{ r: 8 }} connectNulls={true} />
            <Line type="monotone" dataKey="最低" stroke="#1e88e5" strokeWidth={3} dot={{ r: 5, fill: "#1e88e5" }} activeDot={{ r: 8 }} connectNulls={true} />
            <Line type="monotone" dataKey="脈拍" stroke="#009688" strokeWidth={2} dot={{ r: 4, fill: "#009688" }} strokeDasharray="5 3" connectNulls={true} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
        {[{ l: "最高血圧", c: "#e53935" }, { l: "最低血圧", c: "#1e88e5" }, { l: "脈拍", c: "#009688" }].map((i) => (
          <div key={i.l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 15, fontWeight: 600, color: i.c }}>
            <div style={{ width: 12, height: 12, borderRadius: 6, background: i.c }} />{i.l}
          </div>
        ))}
      </div>
    </>
  );
}

// ══════════════════════════════════════
// ── Main App ──
// ══════════════════════════════════════
export default function HealthTracker() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [today] = useState(todayStr());
  const [editDate, setEditDate] = useState(todayStr());
  const [timeSlot, setTimeSlot] = useState("am");
  const [systolic, setSystolic] = useState(130);
  const [diastolic, setDiastolic] = useState(80);
  const [pulse, setPulse] = useState(70);
  const [measureTime, setMeasureTime] = useState(nowTimeStr());
  const [memo, setMemo] = useState("");
  const [tab, setTab] = useState("today");
  const [saved, setSaved] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [periodPreset, setPeriodPreset] = useState("twoweek");
  const [customStart, setCustomStart] = useState(daysAgo(14));
  const [customEnd, setCustomEnd] = useState(todayStr());
  const [showRangePicker, setShowRangePicker] = useState(false);
  const [chartFilter, setChartFilter] = useState("both");

  const presets = { week: 7, twoweek: 14, month: 30, threemonth: 90 };
  const presetLabels = { week: "1週間", twoweek: "2週間", month: "1ヶ月", threemonth: "3ヶ月", custom: "期間指定" };
  const rangeStart = periodPreset === "custom" ? customStart : daysAgo(presets[periodPreset]);
  const rangeEnd = periodPreset === "custom" ? customEnd : todayStr();

  const T = THEMES[timeSlot];

  useEffect(() => {
    const loaded = loadData();
    const d = loaded || defaultState();
    let migrated = false;
    Object.keys(d.records).forEach((date) => {
      const rec = d.records[date];
      if (rec.bp && !rec.am && !rec.pm) {
        rec.am = { ...rec.bp };
        delete rec.bp;
        migrated = true;
      }
    });
    setData(d);
    if (migrated) saveData(d);
    loadDateRecord(d, todayStr(), "am");
    setLoading(false);
  }, []);

  const loadDateRecord = (d, date, slot) => {
    const rec = d.records[date];
    const bp = rec?.[slot];
    if (bp) {
      setSystolic(bp.systolic); setDiastolic(bp.diastolic); setPulse(bp.pulse || 70);
      setMeasureTime(bp.time || nowTimeStr());
    } else {
      setSystolic(130); setDiastolic(80); setPulse(70); setMeasureTime(nowTimeStr());
    }
    setMemo(rec?.memo || "");
  };

  const switchDate = (date) => { setEditDate(date); if (data) loadDateRecord(data, date, timeSlot); };
  const switchSlot = (slot) => { setTimeSlot(slot); if (data) loadDateRecord(data, editDate, slot); };

  const persist = useCallback((newData) => { setData(newData); saveData(newData); }, []);
  const editRecord = data?.records[editDate] || {};

  const toggleMed = (medName) => {
    const newData = { ...data, records: { ...data.records } };
    const rec = { ...(newData.records[editDate] || {}) };
    const meds = { ...(rec.meds || {}) }; meds[medName] = !meds[medName]; rec.meds = meds;
    newData.records[editDate] = rec; persist(newData);
  };

  const saveBP = () => {
    const newData = { ...data, records: { ...data.records } };
    const rec = { ...(newData.records[editDate] || {}) };
    rec[timeSlot] = { systolic, diastolic, pulse, time: measureTime };
    rec.memo = memo;
    newData.records[editDate] = rec; persist(newData);
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const saveMemo = () => {
    const newData = { ...data, records: { ...data.records } };
    const rec = { ...(newData.records[editDate] || {}) };
    rec.memo = memo; newData.records[editDate] = rec; persist(newData);
  };

  const buildChartData = (slot) => {
    if (!data) return [];
    const result = [];
    const start = new Date(rangeStart + "T00:00:00");
    const end = new Date(rangeEnd + "T00:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = ds(d.getFullYear(), d.getMonth(), d.getDate());
      const rec = data.records[key]?.[slot];
      result.push({
        timestamp: new Date(key + "T00:00:00").getTime(), date: formatDateLabel(key), fullDate: key,
        最高: rec ? rec.systolic : null, 最低: rec ? rec.diastolic : null, 脈拍: rec ? rec.pulse : null,
      });
    }
    return result;
  };

  const chartDataAM = buildChartData("am");
  const chartDataPM = buildChartData("pm");
  const chartDataBoth = (() => {
    if (!data) return [];
    const result = [];
    const start = new Date(rangeStart + "T00:00:00");
    const end = new Date(rangeEnd + "T00:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = ds(d.getFullYear(), d.getMonth(), d.getDate());
      const am = data.records[key]?.am; const pm = data.records[key]?.pm;
      const bp = am || pm;
      result.push({
        timestamp: new Date(key + "T00:00:00").getTime(), date: formatDateLabel(key), fullDate: key,
        最高: bp ? bp.systolic : null, 最低: bp ? bp.diastolic : null, 脈拍: bp ? bp.pulse : null,
      });
    }
    return result;
  })();

  const currentChartData = chartFilter === "am" ? chartDataAM : chartFilter === "pm" ? chartDataPM : chartDataBoth;
  const dataEntries = currentChartData.filter((d) => d["最高"] !== null);
  const avgCount = dataEntries.length;
  const avgSys = avgCount ? Math.round(dataEntries.reduce((s, e) => s + e["最高"], 0) / avgCount) : null;
  const avgDia = avgCount ? Math.round(dataEntries.reduce((s, e) => s + e["最低"], 0) / avgCount) : null;
  const avgPulse = avgCount ? Math.round(dataEntries.reduce((s, e) => s + (e["脈拍"] || 0), 0) / avgCount) : null;
  const avgCat = bpLevel(avgSys || 0);

  if (loading) return (<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafaf7", fontFamily: "'Noto Sans JP', sans-serif" }}><div style={{ fontSize: 24, color: "#888" }}>読み込み中...</div></div>);

  const level = bpLevel(systolic);
  const allMedsTaken = data.medications.every((m) => editRecord.meds?.[m]);
  const isToday = editDate === today;
  const historyDates = Object.keys(data.records).sort().reverse();
  const currentSlotData = editRecord[timeSlot];

  return (
    <div style={{ minHeight: "100vh", background: T.pageBg, fontFamily: "'Noto Sans JP', sans-serif", paddingBottom: 100, transition: "background 0.4s" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {showDatePicker && <MiniCalendar value={editDate} onChange={(d) => { switchDate(d); setTab("today"); }} onClose={() => setShowDatePicker(false)} records={data.records} />}
      {showRangePicker && <RangeCalendarPicker startDate={customStart} endDate={customEnd} onChangeStart={setCustomStart} onChangeEnd={setCustomEnd} onClose={() => setShowRangePicker(false)} />}

      {/* ── Header ── */}
      <div style={{ background: T.headerBg, padding: "24px 20px 20px", color: "white", borderRadius: "0 0 28px 28px", boxShadow: `0 4px 20px ${T.headerShadow}`, transition: "background 0.4s" }}>
        <div style={{ fontSize: 22, fontWeight: 700, opacity: 0.9, letterSpacing: 1 }}>💊 けんこう日記</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <button onClick={() => setShowDatePicker(true)} style={{
            background: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.3)",
            borderRadius: 16, padding: "8px 16px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8, WebkitTapHighlightColor: "transparent", flex: 1,
          }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: "white", letterSpacing: 2 }}>{formatDateFull(editDate)}</span>
            <span style={{ fontSize: 16, color: "rgba(255,255,255,0.7)" }}>▼</span>
          </button>
          <div style={{ display: "flex", borderRadius: 14, overflow: "hidden", border: "2px solid rgba(255,255,255,0.3)" }}>
            {[{ id: "am", label: "☀️朝" }, { id: "pm", label: "🌙夜" }].map((s) => (
              <button key={s.id} onClick={() => switchSlot(s.id)} style={{
                padding: "10px 16px", border: "none", fontSize: 18, fontWeight: 800, cursor: "pointer",
                background: timeSlot === s.id ? "rgba(255,255,255,0.3)" : "transparent",
                color: "white", WebkitTapHighlightColor: "transparent",
              }}>{s.label}</button>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 18, marginTop: 6, opacity: 0.85, fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}>
          {getDow(editDate)}曜日 — {T.modeLabelFull}
          {!isToday && <span style={{ fontSize: 13, background: "rgba(255,255,255,0.2)", padding: "2px 10px", borderRadius: 8 }}>過去の日付</span>}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 0, margin: "16px 16px 0", background: T.tabBg, borderRadius: 16, padding: 4, transition: "background 0.4s" }}>
        {[{ id: "today", label: "📋 記録" }, { id: "calendar", label: "📅 暦" }, { id: "chart", label: "📊 統計" }, { id: "history", label: "📜 履歴" }].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: "13px 4px", border: "none", borderRadius: 13,
            fontSize: 16, fontWeight: 700, cursor: "pointer",
            background: tab === t.id ? T.tabActive : "transparent",
            color: tab === t.id ? T.tabActiveText : T.tabText,
            boxShadow: tab === t.id ? "0 2px 10px rgba(0,0,0,0.1)" : "none",
            WebkitTapHighlightColor: "transparent", transition: "all 0.3s",
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: "0 16px", marginTop: 16 }}>

        {/* ══════ RECORD TAB ══════ */}
        {tab === "today" && (
          <>
            {!isToday && (
              <div style={{ background: "#fff3e0", borderRadius: 16, padding: "12px 18px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#e65100" }}>📝 {formatDateFull(editDate)} を編集中</span>
                <button onClick={() => switchDate(today)} style={{ fontSize: 14, padding: "6px 12px", borderRadius: 10, border: "none", background: T.accent, color: "white", fontWeight: 700, cursor: "pointer" }}>今日に戻る</button>
              </div>
            )}

            {/* BP FIRST */}
            <div style={{ background: T.cardBg, borderRadius: 24, padding: "24px 20px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 18, transition: "background 0.4s" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.cardText, marginBottom: 4 }}>🩺 血圧を記録 <span style={{ fontSize: 18 }}>{T.modeLabel}</span></div>
              <div style={{ fontSize: 14, color: T.subText, marginBottom: 12 }}>▲▼ or 数値タップで入力（タップ時クリアされます）</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: T.subText }}>⏰ 測定時刻</span>
                <input type="time" value={measureTime} onChange={(e) => setMeasureTime(e.target.value)}
                  style={{ fontSize: 20, fontWeight: 700, padding: "6px 12px", borderRadius: 12, border: `2px solid ${T.borderColor}`, outline: "none", background: T.inputBg, fontFamily: "'Noto Sans JP', sans-serif", color: T.cardText }} />
              </div>
              <div style={{ textAlign: "center", marginBottom: 14, padding: "8px 14px", borderRadius: 14, background: level.bg }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: level.color }}>{level.text}</span>
                <span style={{ fontSize: 14, color: level.color, marginLeft: 6, opacity: 0.8 }}>({systolic}/{diastolic} mmHg)</span>
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 20, alignItems: "flex-start" }}>
                <BPInput value={systolic} onChange={setSystolic} min={60} max={250} label="最高血圧" unit="mmHg" accentColor="#e53935" bgColor="#ffebee" />
                <div style={{ fontSize: 36, fontWeight: 300, color: "#ccc", paddingTop: 68 }}>/</div>
                <BPInput value={diastolic} onChange={setDiastolic} min={30} max={180} label="最低血圧" unit="mmHg" accentColor="#1e88e5" bgColor="#e3f2fd" />
                <BPInput value={pulse} onChange={setPulse} min={30} max={200} label="脈拍" unit="bpm" accentColor="#009688" bgColor="#e0f2f1" />
              </div>
              <button onClick={saveBP} style={{
                width: "100%", padding: "18px", borderRadius: 18, border: "none", fontSize: 22, fontWeight: 800,
                background: saved ? T.btnSavedGrad : T.btnGrad,
                color: "white", cursor: "pointer", boxShadow: `0 4px 16px ${T.headerShadow}`,
                transition: "all 0.3s", WebkitTapHighlightColor: "transparent",
              }}>{saved ? "✓ 保存しました！" : `💾 ${T.modeLabelFull}を記録`}</button>
              {currentSlotData && <div style={{ textAlign: "center", marginTop: 10, fontSize: 14, color: T.subText }}>記録済み: {currentSlotData.time} — {currentSlotData.systolic}/{currentSlotData.diastolic} mmHg</div>}
              {editRecord[timeSlot === "am" ? "pm" : "am"] && (
                <div style={{ textAlign: "center", marginTop: 6, fontSize: 13, color: T.mutedText }}>
                  {timeSlot === "am" ? "🌙 夜" : "☀️ 朝"}の記録: {editRecord[timeSlot === "am" ? "pm" : "am"].time} — {editRecord[timeSlot === "am" ? "pm" : "am"].systolic}/{editRecord[timeSlot === "am" ? "pm" : "am"].diastolic} mmHg
                </div>
              )}
            </div>

            {/* Meds */}
            <div style={{ background: T.cardBg, borderRadius: 24, padding: "24px 20px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 18, transition: "background 0.4s" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.cardText, marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
                💊 お薬チェック
                {allMedsTaken && <span style={{ fontSize: 14, background: "#e8f5e9", color: "#2e7d32", padding: "4px 12px", borderRadius: 20, fontWeight: 700 }}>✓ 完了！</span>}
              </div>
              {data.medications.map((med) => {
                const checked = editRecord.meds?.[med] || false;
                return (
                  <button key={med} onClick={() => toggleMed(med)} style={{
                    display: "flex", alignItems: "center", gap: 16, width: "100%", padding: "16px 18px", marginBottom: 8,
                    borderRadius: 16, border: "3px solid", borderColor: checked ? "#4caf50" : T.borderColor,
                    background: checked ? "#f1f8e9" : T.inputBg, cursor: "pointer", WebkitTapHighlightColor: "transparent",
                  }}>
                    <div style={{ width: 38, height: 38, borderRadius: 12, background: checked ? "#4caf50" : "#e0e0e0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "white", flexShrink: 0 }}>{checked ? "✓" : ""}</div>
                    <span style={{ fontSize: 22, fontWeight: 700, color: checked ? "#2e7d32" : "#666", textDecoration: checked ? "line-through" : "none" }}>{med}</span>
                  </button>
                );
              })}
            </div>

            {/* Memo */}
            <div style={{ background: T.cardBg, borderRadius: 24, padding: "24px 20px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 18, transition: "background 0.4s" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.cardText, marginBottom: 12 }}>📝 メモ</div>
              <textarea value={memo} onChange={(e) => setMemo(e.target.value)} onBlur={saveMemo}
                placeholder="体調やメモを自由に入力..."
                rows={3}
                style={{ width: "100%", fontSize: 18, padding: "14px 16px", borderRadius: 16, border: `2px solid ${T.borderColor}`, outline: "none", resize: "vertical", fontFamily: "'Noto Sans JP', sans-serif", lineHeight: 1.6, background: T.inputBg }} />
              <div style={{ fontSize: 13, color: T.mutedText, marginTop: 4 }}>※ 入力欄の外をタップで自動保存</div>
            </div>
          </>
        )}

        {/* ══════ CALENDAR ══════ */}
        {tab === "calendar" && (
          <CalendarView records={data.records} onDateTap={(d) => { switchDate(d); setTab("today"); }} />
        )}

        {/* ══════ CHART / STATS ══════ */}
        {tab === "chart" && (
          <>
            <div style={{ background: "white", borderRadius: 24, padding: "18px 16px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 16 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#1a1a2e", marginBottom: 10 }}>📆 表示期間</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Object.entries(presetLabels).map(([key, label]) => (
                  <button key={key} onClick={() => { setPeriodPreset(key); if (key === "custom") setShowRangePicker(true); }}
                    style={{ flex: key === "custom" ? "1 1 100%" : 1, padding: "9px 2px", borderRadius: 12, border: "2px solid",
                      fontSize: 15, fontWeight: 700, cursor: "pointer",
                      borderColor: periodPreset === key ? "#2e7d32" : "#e0e0e0",
                      background: periodPreset === key ? "#e8f5e9" : "white",
                      color: periodPreset === key ? "#2e7d32" : "#888", WebkitTapHighlightColor: "transparent",
                    }}>{label}</button>
                ))}
              </div>
              {periodPreset === "custom" && (
                <button onClick={() => setShowRangePicker(true)} style={{ marginTop: 8, width: "100%", padding: "9px", borderRadius: 12, border: "2px solid #2e7d32", background: "#f1f8e9", fontSize: 15, fontWeight: 600, color: "#2e7d32", cursor: "pointer" }}>
                  📅 {formatDateCompact(customStart)} 〜 {formatDateCompact(customEnd)}（タップで変更）
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              {[{ id: "am", label: "☀️ 朝のみ" }, { id: "pm", label: "🌙 夜のみ" }, { id: "both", label: "📊 両方" }].map((f) => (
                <button key={f.id} onClick={() => setChartFilter(f.id)} style={{
                  flex: 1, padding: "10px 4px", borderRadius: 12, border: "2px solid",
                  fontSize: 15, fontWeight: 700, cursor: "pointer",
                  borderColor: chartFilter === f.id ? "#2e7d32" : "#e0e0e0",
                  background: chartFilter === f.id ? "#e8f5e9" : "white",
                  color: chartFilter === f.id ? "#2e7d32" : "#888", WebkitTapHighlightColor: "transparent",
                }}>{f.label}</button>
              ))}
            </div>

            <div style={{ background: "white", borderRadius: 24, padding: "18px 16px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 16 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#1a1a2e", marginBottom: 12 }}>📊 期間平均 {chartFilter === "am" ? "（朝）" : chartFilter === "pm" ? "（夜）" : ""}</div>
              {avgCount === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0", color: "#bbb", fontSize: 17 }}>この期間のデータがありません</div>
              ) : (
                <>
                  <div style={{ textAlign: "center", marginBottom: 14, padding: "10px", borderRadius: 14, background: avgCat.bg }}>
                    <div style={{ fontSize: 15, color: "#888", marginBottom: 2 }}>平均レベル</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: avgCat.color }}>{avgCat.text}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    {[{ l: "最高血圧", v: avgSys, c: "#e53935", bg: "#fce4ec", u: "mmHg" }, { l: "最低血圧", v: avgDia, c: "#1e88e5", bg: "#e3f2fd", u: "mmHg" }, { l: "脈拍", v: avgPulse, c: "#009688", bg: "#e0f2f1", u: "bpm" }].map((i) => (
                      <div key={i.l} style={{ flex: 1, background: i.bg, borderRadius: 14, padding: "14px 6px", textAlign: "center" }}>
                        <div style={{ fontSize: 12, color: "#999", marginBottom: 2 }}>{i.l}</div>
                        <div style={{ fontSize: 30, fontWeight: 800, color: i.c }}>{i.v}</div>
                        <div style={{ fontSize: 12, color: "#999" }}>{i.u}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ textAlign: "center", fontSize: 14, color: "#aaa" }}>計測回数: {avgCount}回</div>
                </>
              )}
            </div>

            <div style={{ background: "white", borderRadius: 24, padding: "20px 14px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 16 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#1a1a2e", marginBottom: 14 }}>📈 血圧の推移 {chartFilter === "am" ? "（朝）" : chartFilter === "pm" ? "（夜）" : ""}</div>
              <BPChart chartData={currentChartData} dataCount={avgCount} />
              <div style={{ marginTop: 12, padding: "10px 12px", background: "#f8f9fa", borderRadius: 12, fontSize: 14, lineHeight: 1.7 }}>
                <div style={{ fontWeight: 700, color: "#555", marginBottom: 2 }}>📋 色付き領域</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 18, height: 12, borderRadius: 3, background: "rgba(244,67,54,0.15)", flexShrink: 0 }} />
                  <span style={{ color: "#666" }}><strong style={{ color: "#f44336" }}>赤</strong>：最高 140以上</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <div style={{ width: 18, height: 12, borderRadius: 3, background: "rgba(255,152,0,0.12)", flexShrink: 0 }} />
                  <span style={{ color: "#666" }}><strong style={{ color: "#ff9800" }}>黄</strong>：最低 90以上</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ══════ HISTORY ══════ */}
        {tab === "history" && (
          <div style={{ background: "white", borderRadius: 24, padding: "20px 16px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1a1a2e", marginBottom: 12 }}>📜 記録の履歴</div>
            {historyDates.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#bbb", fontSize: 18 }}>まだ記録がありません</div>
            ) : (
              historyDates.map((date) => {
                const rec = data.records[date];
                const isT = date === today;
                const BPRow = ({ slot, label, icon }) => {
                  const bp = rec[slot];
                  if (!bp) return null;
                  return (
                    <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap", alignItems: "baseline" }}>
                      <span style={{ fontSize: 14, color: "#888" }}>{icon}</span>
                      <span style={{ fontSize: 14, color: "#999", fontWeight: 600 }}>{label} {bp.time}</span>
                      <span style={{ fontSize: 24, fontWeight: 800, color: "#e53935" }}>{bp.systolic}</span>
                      <span style={{ fontSize: 16, color: "#ccc" }}>/</span>
                      <span style={{ fontSize: 24, fontWeight: 800, color: "#1e88e5" }}>{bp.diastolic}</span>
                      <span style={{ fontSize: 13, color: "#999" }}>mmHg</span>
                      {bp.pulse && (<><span style={{ fontSize: 14, color: "#888", marginLeft: 4 }}>💓</span><span style={{ fontSize: 24, fontWeight: 800, color: "#009688" }}>{bp.pulse}</span><span style={{ fontSize: 13, color: "#999" }}>bpm</span></>)}
                    </div>
                  );
                };
                return (
                  <div key={date} style={{ padding: "14px 16px", marginBottom: 10, borderRadius: 16, background: "#f8f9fa", border: isT ? "2px solid #4caf50" : "2px solid transparent" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 18, fontWeight: 700, color: "#333" }}>
                        {formatDateFull(date)}
                        {isT && <span style={{ fontSize: 12, background: "#e8f5e9", color: "#2e7d32", padding: "2px 8px", borderRadius: 8, marginLeft: 6, fontWeight: 700 }}>今日</span>}
                      </span>
                      <button onClick={() => { switchDate(date); setTab("today"); }} style={{
                        fontSize: 13, padding: "5px 12px", borderRadius: 10, border: "2px solid #2e7d32",
                        background: "white", color: "#2e7d32", cursor: "pointer", fontWeight: 700, WebkitTapHighlightColor: "transparent",
                      }}>✏️ 編集</button>
                    </div>
                    <BPRow slot="am" label="朝" icon="☀️" />
                    <BPRow slot="pm" label="夜" icon="🌙" />
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: rec.memo ? 6 : 0 }}>
                      <span style={{ fontSize: 15, color: "#666", fontWeight: 600 }}>💊</span>
                      {data.medications.map((m) => {
                        const taken = rec.meds?.[m];
                        return (<span key={m} style={{ fontSize: 14, padding: "2px 8px", borderRadius: 8, background: taken ? "#e8f5e9" : "#f5f5f5", color: taken ? "#2e7d32" : "#ccc", fontWeight: 600 }}>{taken ? "✓" : "✗"} {m}</span>);
                      })}
                    </div>
                    {rec.memo && (
                      <div style={{ background: "#fffde7", borderRadius: 12, padding: "8px 12px", fontSize: 15, color: "#666", lineHeight: 1.4, marginTop: 4 }}>📝 {rec.memo}</div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
