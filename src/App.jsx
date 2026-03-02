import { useState, useEffect, useCallback, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

// ── Storage helpers ──
const STORAGE_KEY = "health-tracker-data";
function loadData() {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function saveData(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { console.error("Save failed:", e); }
}

// ── Date helpers ──
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function formatDateLabel(ds) { const [, m, d] = ds.split("-"); return `${parseInt(m)}/${parseInt(d)}`; }
function formatDateFull(ds) { const [y, m, d] = ds.split("-"); return `${parseInt(y)}年${parseInt(m)}月${parseInt(d)}日`; }
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function getMonthDays(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}

function makeDateStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const defaultState = () => ({ records: {}, medications: ["朝の薬", "昼の薬", "夜の薬"] });

// ══════════════════════════════════════
// ── BP Input (Scroll ▲▼ + Direct tap) ──
// ══════════════════════════════════════
function BPInput({ value, onChange, min, max, label, unit, accentColor, bgColor }) {
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState("");
  const inputRef = useRef(null);

  const clamp = (v) => Math.max(min, Math.min(max, v));

  const startChange = (delta) => {
    onChange(clamp(value + delta));
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        onChange((prev) => clamp(prev + delta));
      }, 80);
    }, 400);
  };
  const stopChange = () => { clearTimeout(timeoutRef.current); clearInterval(intervalRef.current); };

  const startEdit = () => {
    setEditVal(String(value));
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };
  const commitEdit = () => {
    const v = parseInt(editVal);
    if (!isNaN(v)) onChange(clamp(v));
    setEditing(false);
  };

  const btnStyle = {
    width: "100%", height: 54, borderRadius: 14, border: "none",
    background: bgColor || "#e8f5e9", fontSize: 30, fontWeight: 700,
    color: accentColor || "#2e7d32", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1, minWidth: 80, maxWidth: 110 }}>
      <span style={{ fontSize: 14, color: "#8a8a8a", fontWeight: 600 }}>{label}</span>
      <button onPointerDown={() => startChange(1)} onPointerUp={stopChange} onPointerLeave={stopChange} style={btnStyle}>▲</button>
      {editing ? (
        <input
          ref={inputRef} type="number" inputMode="numeric" pattern="[0-9]*"
          value={editVal} onChange={(e) => setEditVal(e.target.value)}
          onBlur={commitEdit} onKeyDown={(e) => e.key === "Enter" && commitEdit()}
          style={{
            width: "100%", fontSize: 38, fontWeight: 800, textAlign: "center",
            border: `3px solid ${accentColor || "#2e7d32"}`, borderRadius: 12,
            padding: "6px 2px", outline: "none", color: "#1a1a2e",
            fontFamily: "'Noto Sans JP', sans-serif", background: "#fff",
          }}
        />
      ) : (
        <div onClick={startEdit} style={{
          fontSize: 40, fontWeight: 800, color: "#1a1a2e", textAlign: "center",
          lineHeight: 1.2, cursor: "pointer", padding: "4px 0",
          fontFamily: "'Noto Sans JP', sans-serif",
          borderBottom: `2px dashed ${accentColor || "#ccc"}`,
          minWidth: 70,
        }}>{value}</div>
      )}
      <button onPointerDown={() => startChange(-1)} onPointerUp={stopChange} onPointerLeave={stopChange} style={btnStyle}>▼</button>
      <span style={{ fontSize: 13, color: "#aaa" }}>{unit}</span>
    </div>
  );
}

// ══════════════════════════════════════
// ── Calendar Component ──
// ══════════════════════════════════════
function Calendar({ records, onDateTap }) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const today = todayStr();
  const days = getMonthDays(viewYear, viewMonth);

  const prevMonth = () => { if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); } else setViewMonth(viewMonth - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); } else setViewMonth(viewMonth + 1); };

  return (
    <div style={{ background: "white", borderRadius: 24, padding: "20px 16px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 20 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#1a1a2e", marginBottom: 16 }}>📅 カレンダー</div>
      {/* Month nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button onClick={prevMonth} style={{ width: 48, height: 48, borderRadius: 14, border: "none", background: "#f0f0ec", fontSize: 22, fontWeight: 700, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>◀</button>
        <span style={{ fontSize: 24, fontWeight: 800, color: "#1a1a2e" }}>{viewYear}年 {viewMonth + 1}月</span>
        <button onClick={nextMonth} style={{ width: 48, height: 48, borderRadius: 14, border: "none", background: "#f0f0ec", fontSize: 22, fontWeight: 700, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>▶</button>
      </div>
      {/* Weekday headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {WEEKDAYS.map((w, i) => (
          <div key={w} style={{ textAlign: "center", fontSize: 15, fontWeight: 700, padding: "6px 0", color: i === 0 ? "#e53935" : i === 6 ? "#1e88e5" : "#888" }}>{w}</div>
        ))}
      </div>
      {/* Day cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
        {days.map((day, idx) => {
          if (day === null) return <div key={`e${idx}`} />;
          const ds = makeDateStr(viewYear, viewMonth, day);
          const hasData = !!records[ds];
          const hasBP = !!records[ds]?.bp;
          const hasMeds = records[ds]?.meds && Object.values(records[ds].meds).some(Boolean);
          const isToday = ds === today;
          const dow = idx % 7;
          return (
            <button key={ds} onClick={() => hasData && onDateTap(ds)} style={{
              aspectRatio: "1", borderRadius: 14, border: "none",
              background: isToday ? "#2e7d32" : hasData ? "#f1f8e9" : "#fafafa",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              cursor: hasData ? "pointer" : "default", position: "relative",
              WebkitTapHighlightColor: "transparent", transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 18, fontWeight: isToday ? 800 : 600, color: isToday ? "white" : dow === 0 ? "#e53935" : dow === 6 ? "#1e88e5" : "#444" }}>{day}</span>
              {hasData && (
                <div style={{ display: "flex", gap: 3, marginTop: 2 }}>
                  {hasBP && <div style={{ width: 7, height: 7, borderRadius: "50%", background: isToday ? "#81c784" : "#e53935" }} />}
                  {hasMeds && <div style={{ width: 7, height: 7, borderRadius: "50%", background: isToday ? "#a5d6a7" : "#1e88e5" }} />}
                </div>
              )}
            </button>
          );
        })}
      </div>
      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 12, justifyContent: "center", fontSize: 14, color: "#888" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: "#e53935" }} /> 血圧</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: "#1e88e5" }} /> お薬</span>
        <span style={{ fontSize: 13 }}>※ 日付タップで詳細</span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════
// ── Period Average Panel ──
// ══════════════════════════════════════
function PeriodAveragePanel({ data }) {
  const [period, setPeriod] = useState("week");
  const periods = { week: 7, twoweek: 14, month: 30, threemonth: 90 };
  const periodLabels = { week: "1週間", twoweek: "2週間", month: "1ヶ月", threemonth: "3ヶ月" };

  const now = new Date();
  const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - periods[period]);
  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;

  const entries = Object.entries(data.records || {}).filter(([d, r]) => d >= cutoffStr && r?.bp).map(([, r]) => r.bp);
  const count = entries.length;
  const avgSys = count ? Math.round(entries.reduce((s, e) => s + e.systolic, 0) / count) : null;
  const avgDia = count ? Math.round(entries.reduce((s, e) => s + e.diastolic, 0) / count) : null;
  const avgPulse = count ? Math.round(entries.reduce((s, e) => s + (e.pulse || 0), 0) / count) : null;

  const bpCat = (sys) => {
    if (!sys) return { text: "─", color: "#999", bg: "#f5f5f5" };
    if (sys < 120) return { text: "正常", color: "#4caf50", bg: "#e8f5e9" };
    if (sys < 130) return { text: "正常高値", color: "#8bc34a", bg: "#f1f8e9" };
    if (sys < 140) return { text: "高値", color: "#ff9800", bg: "#fff3e0" };
    return { text: "高血圧", color: "#f44336", bg: "#fce4ec" };
  };
  const cat = bpCat(avgSys);

  return (
    <div style={{ background: "white", borderRadius: 24, padding: "20px 18px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 20 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#1a1a2e", marginBottom: 14 }}>📊 期間別 平均血圧</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {Object.entries(periodLabels).map(([key, label]) => (
          <button key={key} onClick={() => setPeriod(key)} style={{
            flex: 1, padding: "10px 2px", borderRadius: 12, border: "2px solid", fontSize: 16, fontWeight: 700, cursor: "pointer",
            borderColor: period === key ? "#2e7d32" : "#e0e0e0",
            background: period === key ? "#e8f5e9" : "white",
            color: period === key ? "#2e7d32" : "#888",
            WebkitTapHighlightColor: "transparent",
          }}>{label}</button>
        ))}
      </div>
      {count === 0 ? (
        <div style={{ textAlign: "center", padding: "30px 0", color: "#bbb", fontSize: 18 }}>この期間のデータがありません</div>
      ) : (
        <>
          <div style={{ textAlign: "center", marginBottom: 16, padding: "12px", borderRadius: 16, background: cat.bg }}>
            <div style={{ fontSize: 16, color: "#888", marginBottom: 4 }}>平均レベル</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: cat.color }}>{cat.text}</div>
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            {[
              { label: "最高血圧", val: avgSys, color: "#e53935", bg: "#fce4ec", unit: "mmHg" },
              { label: "最低血圧", val: avgDia, color: "#1e88e5", bg: "#e3f2fd", unit: "mmHg" },
              { label: "脈拍", val: avgPulse, color: "#ff9800", bg: "#fff3e0", unit: "bpm" },
            ].map((item) => (
              <div key={item.label} style={{ flex: 1, background: item.bg, borderRadius: 16, padding: "16px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 13, color: "#999", marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 34, fontWeight: 800, color: item.color }}>{item.val}</div>
                <div style={{ fontSize: 13, color: "#999" }}>{item.unit}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", fontSize: 15, color: "#aaa" }}>計測回数: {count}回</div>
        </>
      )}
    </div>
  );
}

// ── Custom Tooltip ──
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "white", borderRadius: 12, padding: "12px 16px", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", fontSize: 16 }}>
      <p style={{ margin: 0, fontWeight: 700, marginBottom: 6 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ margin: "2px 0", color: p.color, fontWeight: 600 }}>{p.name}: {p.value} {p.name === "脈拍" ? "bpm" : "mmHg"}</p>
      ))}
    </div>
  );
}

// ══════════════════════════════════════
// ── Main App ──
// ══════════════════════════════════════
export default function HealthTracker() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [today] = useState(todayStr());
  const [systolic, setSystolic] = useState(130);
  const [diastolic, setDiastolic] = useState(80);
  const [pulse, setPulse] = useState(70);
  const [tab, setTab] = useState("today");
  const [saved, setSaved] = useState(false);
  const [chartRange, setChartRange] = useState(14);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    const loaded = loadData();
    const d = loaded || defaultState();
    setData(d);
    if (d.records[todayStr()]?.bp) {
      setSystolic(d.records[todayStr()].bp.systolic);
      setDiastolic(d.records[todayStr()].bp.diastolic);
      setPulse(d.records[todayStr()].bp.pulse || 70);
    }
    setLoading(false);
  }, []);

  const persist = useCallback((newData) => { setData(newData); saveData(newData); }, []);
  const todayRecord = data?.records[today] || {};

  const toggleMed = (medName) => {
    const newData = { ...data, records: { ...data.records } };
    const rec = { ...todayRecord }; const meds = { ...(rec.meds || {}) };
    meds[medName] = !meds[medName]; rec.meds = meds;
    newData.records[today] = rec; persist(newData);
  };

  const saveBP = () => {
    const newData = { ...data, records: { ...data.records } };
    const rec = { ...(newData.records[today] || {}) };
    rec.bp = { systolic, diastolic, pulse, time: new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) };
    newData.records[today] = rec; persist(newData);
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const chartData = (() => {
    if (!data) return [];
    return Object.keys(data.records).filter((d) => data.records[d]?.bp).sort().slice(-chartRange).map((d) => ({
      date: formatDateLabel(d), fullDate: d,
      最高: data.records[d].bp.systolic, 最低: data.records[d].bp.diastolic, 脈拍: data.records[d].bp.pulse,
    }));
  })();

  const bpLevel = (sys) => {
    if (sys < 120) return { text: "正常", color: "#4caf50", bg: "#e8f5e9" };
    if (sys < 130) return { text: "正常高値", color: "#8bc34a", bg: "#f1f8e9" };
    if (sys < 140) return { text: "高値", color: "#ff9800", bg: "#fff3e0" };
    return { text: "高血圧", color: "#f44336", bg: "#fce4ec" };
  };

  const handleCalendarTap = (ds) => { setSelectedDate(ds); setTab("history"); };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafaf7", fontFamily: "'Noto Sans JP', sans-serif" }}>
        <div style={{ fontSize: 24, color: "#888" }}>読み込み中...</div>
      </div>
    );
  }

  const level = bpLevel(systolic);
  const allMedsTaken = data.medications.every((m) => todayRecord.meds?.[m]);
  const historyDates = Object.keys(data.records).sort().reverse();
  const historyFiltered = selectedDate ? [selectedDate, ...historyDates.filter((d) => d !== selectedDate)] : historyDates;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #f0f7f0 0%, #fafaf7 30%)", fontFamily: "'Noto Sans JP', sans-serif", paddingBottom: 100 }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* ── Header ── */}
      <div style={{
        background: "linear-gradient(135deg, #2e7d32 0%, #43a047 100%)",
        padding: "28px 20px 24px", color: "white",
        borderRadius: "0 0 28px 28px", boxShadow: "0 4px 20px rgba(46,125,50,0.3)",
      }}>
        <div style={{ fontSize: 24, fontWeight: 700, opacity: 0.9, letterSpacing: 1 }}>💊 けんこう日記</div>
        <div style={{ fontSize: 34, fontWeight: 900, marginTop: 6, letterSpacing: 2 }}>{formatDateFull(today)}</div>
        <div style={{ fontSize: 20, marginTop: 4, opacity: 0.85, fontWeight: 600 }}>{WEEKDAYS[new Date().getDay()]}曜日</div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 0, margin: "20px 16px 0", background: "#e8e8e0", borderRadius: 16, padding: 4 }}>
        {[
          { id: "today", label: "📋 記録" },
          { id: "calendar", label: "📅 暦" },
          { id: "chart", label: "📊 グラフ" },
          { id: "history", label: "📜 履歴" },
        ].map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); if (t.id !== "history") setSelectedDate(null); }}
            style={{
              flex: 1, padding: "13px 4px", border: "none", borderRadius: 13,
              fontSize: 16, fontWeight: 700, cursor: "pointer",
              background: tab === t.id ? "white" : "transparent",
              color: tab === t.id ? "#2e7d32" : "#888",
              boxShadow: tab === t.id ? "0 2px 10px rgba(0,0,0,0.1)" : "none",
              transition: "all 0.2s", WebkitTapHighlightColor: "transparent",
            }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: "0 16px", marginTop: 20 }}>

        {/* ══════ TODAY ══════ */}
        {tab === "today" && (
          <>
            {/* Meds */}
            <div style={{ background: "white", borderRadius: 24, padding: "24px 20px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 20 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#1a1a2e", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                💊 お薬チェック
                {allMedsTaken && <span style={{ fontSize: 14, background: "#e8f5e9", color: "#2e7d32", padding: "4px 12px", borderRadius: 20, fontWeight: 700 }}>✓ 完了！</span>}
              </div>
              {data.medications.map((med) => {
                const checked = todayRecord.meds?.[med] || false;
                return (
                  <button key={med} onClick={() => toggleMed(med)} style={{
                    display: "flex", alignItems: "center", gap: 16, width: "100%", padding: "18px 20px", marginBottom: 10,
                    borderRadius: 16, border: "3px solid", borderColor: checked ? "#4caf50" : "#e0e0e0",
                    background: checked ? "#f1f8e9" : "#fafafa", cursor: "pointer", transition: "all 0.2s", WebkitTapHighlightColor: "transparent",
                  }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: checked ? "#4caf50" : "#e0e0e0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "white", flexShrink: 0 }}>{checked ? "✓" : ""}</div>
                    <span style={{ fontSize: 24, fontWeight: 700, color: checked ? "#2e7d32" : "#666", textDecoration: checked ? "line-through" : "none" }}>{med}</span>
                  </button>
                );
              })}
            </div>

            {/* BP Input */}
            <div style={{ background: "white", borderRadius: 24, padding: "24px 20px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 20 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#1a1a2e", marginBottom: 4 }}>🩺 血圧を記録</div>
              <div style={{ fontSize: 15, color: "#999", marginBottom: 16 }}>▲▼ボタン or 数値タップで直接入力</div>
              <div style={{ textAlign: "center", marginBottom: 18, padding: "10px 16px", borderRadius: 16, background: level.bg }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: level.color }}>{level.text}</span>
                <span style={{ fontSize: 15, color: level.color, marginLeft: 8, opacity: 0.8 }}>({systolic}/{diastolic} mmHg)</span>
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 24, alignItems: "flex-start" }}>
                <BPInput value={systolic} onChange={setSystolic} min={60} max={250} label="最高血圧" unit="mmHg" accentColor="#e53935" bgColor="#ffebee" />
                <div style={{ fontSize: 36, fontWeight: 300, color: "#ccc", paddingTop: 68 }}>/</div>
                <BPInput value={diastolic} onChange={setDiastolic} min={30} max={180} label="最低血圧" unit="mmHg" accentColor="#1e88e5" bgColor="#e3f2fd" />
                <BPInput value={pulse} onChange={setPulse} min={30} max={200} label="脈拍" unit="bpm" accentColor="#ff9800" bgColor="#fff3e0" />
              </div>
              <button onClick={saveBP} style={{
                width: "100%", padding: "20px", borderRadius: 18, border: "none", fontSize: 24, fontWeight: 800,
                background: saved ? "linear-gradient(135deg, #66bb6a, #81c784)" : "linear-gradient(135deg, #2e7d32, #43a047)",
                color: "white", cursor: "pointer", boxShadow: "0 4px 16px rgba(46,125,50,0.35)",
                transition: "all 0.3s", WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
              }}>{saved ? "✓ 保存しました！" : "💾 記録する"}</button>
              {todayRecord.bp && <div style={{ textAlign: "center", marginTop: 12, fontSize: 15, color: "#999" }}>最終記録: {todayRecord.bp.time}</div>}
            </div>
          </>
        )}

        {/* ══════ CALENDAR ══════ */}
        {tab === "calendar" && <Calendar records={data.records} onDateTap={handleCalendarTap} />}

        {/* ══════ CHART ══════ */}
        {tab === "chart" && (
          <>
            <PeriodAveragePanel data={data} />
            <div style={{ background: "white", borderRadius: 24, padding: "24px 16px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#1a1a2e", marginBottom: 4 }}>📈 血圧の推移</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 20, marginTop: 12 }}>
                {[{ days: 7, label: "1週間" }, { days: 14, label: "2週間" }, { days: 30, label: "1ヶ月" }, { days: 90, label: "3ヶ月" }].map((r) => (
                  <button key={r.days} onClick={() => setChartRange(r.days)} style={{
                    flex: 1, padding: "10px 4px", borderRadius: 12, border: "2px solid",
                    borderColor: chartRange === r.days ? "#2e7d32" : "#e0e0e0",
                    background: chartRange === r.days ? "#e8f5e9" : "white",
                    color: chartRange === r.days ? "#2e7d32" : "#888",
                    fontSize: 16, fontWeight: 700, cursor: "pointer", WebkitTapHighlightColor: "transparent",
                  }}>{r.label}</button>
                ))}
              </div>
              {chartData.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px", color: "#bbb", fontSize: 20 }}>📝 データがまだありません<br /><span style={{ fontSize: 16 }}>「記録」タブから血圧を記録してください</span></div>
              ) : (
                <>
                  <div style={{ width: "100%", height: 300 }}>
                    <ResponsiveContainer>
                      <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 14, fill: "#888" }} tickMargin={8} />
                        <YAxis domain={[40, 200]} tick={{ fontSize: 14, fill: "#888" }} tickMargin={4} />
                        <Tooltip content={<CustomTooltip />} />
                        <ReferenceLine y={140} stroke="#f44336" strokeDasharray="6 4" strokeWidth={2} label={{ value: "高血圧基準", fill: "#f44336", fontSize: 13, position: "right" }} />
                        <ReferenceLine y={90} stroke="#ff9800" strokeDasharray="6 4" strokeWidth={1.5} />
                        <Line type="monotone" dataKey="最高" stroke="#e53935" strokeWidth={3} dot={{ r: 5, fill: "#e53935" }} activeDot={{ r: 8 }} />
                        <Line type="monotone" dataKey="最低" stroke="#1e88e5" strokeWidth={3} dot={{ r: 5, fill: "#1e88e5" }} activeDot={{ r: 8 }} />
                        <Line type="monotone" dataKey="脈拍" stroke="#ff9800" strokeWidth={2} dot={{ r: 4, fill: "#ff9800" }} strokeDasharray="5 3" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 12, flexWrap: "wrap" }}>
                    {[{ label: "最高血圧", color: "#e53935" }, { label: "最低血圧", color: "#1e88e5" }, { label: "脈拍", color: "#ff9800" }].map((l) => (
                      <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 16, fontWeight: 600, color: l.color }}>
                        <div style={{ width: 14, height: 14, borderRadius: 7, background: l.color }} />{l.label}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* ══════ HISTORY ══════ */}
        {tab === "history" && (
          <div style={{ background: "white", borderRadius: 24, padding: "24px 20px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1a1a2e", marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>📜 記録の履歴</span>
              {selectedDate && (
                <button onClick={() => setSelectedDate(null)} style={{
                  fontSize: 14, padding: "6px 14px", borderRadius: 10, border: "2px solid #e0e0e0",
                  background: "white", color: "#666", cursor: "pointer", fontWeight: 600, WebkitTapHighlightColor: "transparent",
                }}>全件表示</button>
              )}
            </div>
            {selectedDate && <div style={{ fontSize: 17, color: "#2e7d32", fontWeight: 700, marginBottom: 12 }}>📅 {formatDateFull(selectedDate)} の記録</div>}

            {historyFiltered.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#bbb", fontSize: 18 }}>まだ記録がありません</div>
            ) : (
              historyFiltered.filter((d) => data.records[d]).map((date) => {
                const rec = data.records[date];
                const isHL = date === selectedDate;
                const isToday = date === today;
                return (
                  <div key={date} style={{
                    padding: "16px 18px", marginBottom: 10, borderRadius: 16,
                    background: isHL ? "#e8f5e9" : "#f8f9fa",
                    border: isHL ? "3px solid #4caf50" : isToday ? "2px solid #4caf50" : "2px solid transparent",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 20, fontWeight: 700, color: "#333" }}>
                        {formatDateFull(date)}
                        {isToday && <span style={{ fontSize: 13, background: "#e8f5e9", color: "#2e7d32", padding: "2px 10px", borderRadius: 10, marginLeft: 8, fontWeight: 700 }}>今日</span>}
                      </span>
                    </div>
                    {rec.bp && (
                      <div style={{ display: "flex", gap: 12, marginBottom: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                        <span style={{ fontSize: 15, color: "#888" }}>🩺</span>
                        <span style={{ fontSize: 28, fontWeight: 800, color: "#e53935" }}>{rec.bp.systolic}</span>
                        <span style={{ fontSize: 20, color: "#ccc" }}>/</span>
                        <span style={{ fontSize: 28, fontWeight: 800, color: "#1e88e5" }}>{rec.bp.diastolic}</span>
                        <span style={{ fontSize: 14, color: "#999" }}>mmHg</span>
                        {rec.bp.pulse && (<><span style={{ fontSize: 15, color: "#888", marginLeft: 8 }}>💓</span><span style={{ fontSize: 28, fontWeight: 800, color: "#ff9800" }}>{rec.bp.pulse}</span><span style={{ fontSize: 14, color: "#999" }}>bpm</span></>)}
                        {rec.bp.time && <span style={{ fontSize: 14, color: "#bbb" }}>({rec.bp.time})</span>}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: 16, color: "#666", fontWeight: 600 }}>💊</span>
                      {data.medications.map((m) => {
                        const taken = rec.meds?.[m];
                        return (
                          <span key={m} style={{
                            fontSize: 15, padding: "3px 10px", borderRadius: 8,
                            background: taken ? "#e8f5e9" : "#f5f5f5",
                            color: taken ? "#2e7d32" : "#ccc", fontWeight: 600,
                          }}>{taken ? "✓" : "✗"} {m}</span>
                        );
                      })}
                    </div>
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
