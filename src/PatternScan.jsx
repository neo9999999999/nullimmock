// PatternScan.jsx — sector-api-pink 활용 당일 패턴 스캔
//
// 데이터 소스 (이미 구축됨):
// 1. GET https://sector-api-pink.vercel.app/api/screening
//    → ok, signals: {S, A, B, X}, all: [{code, name, change, amount, score, grade, investor, wick, ...}]
// 2. https://raw.githubusercontent.com/neo9999999999/sector-api/main/data/signals.json
//    → 누적 신호 DB (signal_date, outcome 포함)

import React, { useState, useEffect } from "react";

const SECTOR_API = "https://sector-api-pink.vercel.app/api";
const SIGNALS_DB_URL = "https://raw.githubusercontent.com/neo9999999999/sector-api/main/data/signals.json";

// 빌트인 풍산형 패턴
const BUILTIN_PATTERNS = [
  {
    id: "builtin_box_breakout",
    name: "풍산형 (장기 박스권 → 거래대금 폭증 돌파)",
    desc: "1차 급등 → 11개월 박스권 → 큰 양봉 + 거래대금 30배 폭증",
    criteria: { pctMin: 13, pctMax: 22, amountMin: 800, amountMax: 2000 },
    builtin: true,
    stats: { n: 642, avg60d: 37.4, win30: 35, win50: 19 },
  },
];

export default function PatternScan() {
  const [patterns, setPatterns] = useState(BUILTIN_PATTERNS);
  const [selectedPattern, setSelectedPattern] = useState(BUILTIN_PATTERNS[0]);
  const [showAddForm, setShowAddForm] = useState(false);

  const [todaySignals, setTodaySignals] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [signalDB, setSignalDB] = useState(null);

  // 사용자 커스텀 패턴 로드
  useEffect(() => {
    if (typeof window === "undefined" || !window.storage) return;
    (async () => {
      try {
        const list = await window.storage.list("pattern:custom_");
        if (!list || !list.keys) return;
        const customs = [];
        for (const k of list.keys) {
          try {
            const r = await window.storage.get(k);
            if (r) customs.push(JSON.parse(r.value));
          } catch (e) {}
        }
        if (customs.length > 0) setPatterns([...BUILTIN_PATTERNS, ...customs]);
      } catch (e) {}
    })();
  }, []);

  // 누적 신호 DB 로드
  useEffect(() => {
    fetch(SIGNALS_DB_URL)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const arr = Array.isArray(data) ? data : (data.signals || []);
        setSignalDB(arr);
      })
      .catch(() => setSignalDB([]));
  }, []);

  async function runTodayScan() {
    setScanning(true);
    setScanError(null);
    setTodaySignals(null);
    try {
      const res = await fetch(SECTOR_API + "/screening");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "API 에러");
      // 패턴 점수 매기기
      const scored = (data.all || []).map(s => ({
        ...s,
        patternScore: scorePattern(s, selectedPattern.criteria),
      })).sort((a, b) => b.patternScore - a.patternScore);
      setTodaySignals({ ...data, all: scored });
    } catch (e) {
      setScanError(e.message);
    } finally {
      setScanning(false);
    }
  }

  // 선택 패턴 변경 시 점수 재계산
  useEffect(() => {
    if (!todaySignals || !todaySignals.all) return;
    const scored = todaySignals.all.map(s => ({
      ...s,
      patternScore: scorePattern(s, selectedPattern.criteria),
    })).sort((a, b) => b.patternScore - a.patternScore);
    setTodaySignals({ ...todaySignals, all: scored });
  }, [selectedPattern.id]);

  async function addPattern(newPattern) {
    if (typeof window === "undefined" || !window.storage) {
      alert("저장 불가"); return;
    }
    const id = "custom_" + Date.now();
    const pattern = { ...newPattern, id, builtin: false };
    try {
      await window.storage.set("pattern:" + id, JSON.stringify(pattern));
      setPatterns([...patterns, pattern]);
      setShowAddForm(false);
    } catch (e) { alert("저장 실패: " + e.message); }
  }

  async function deletePattern(id) {
    if (!confirm("이 패턴을 삭제하시겠습니까?")) return;
    if (typeof window !== "undefined" && window.storage) {
      try { await window.storage.delete("pattern:" + id); } catch (e) {}
    }
    setPatterns(patterns.filter(p => p.id !== id));
  }

  return (
    <div>
      {/* 안내 */}
      <div style={{
        marginBottom: 12, padding: 10,
        background: "#0c4a6e", border: "1px solid #0ea5e9",
        borderRadius: 6, fontSize: 12, color: "#bae6fd",
      }}>
        💡 데이터 소스: <b>sector-api-pink</b> (KIS 인프라) ·
        누적 시그널 DB: {signalDB == null ? "로드 중..." : `${signalDB.length}건`}
      </div>

      {/* 패턴 라이브러리 */}
      <div style={{
        marginBottom: 16, padding: 14,
        background: "#1e293b", border: "1px solid #334155", borderRadius: 8,
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 10,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fbbf24" }}>
            📚 패턴 라이브러리 ({patterns.length}개)
          </span>
          <button onClick={() => setShowAddForm(!showAddForm)}
            style={{
              background: "#10b981", color: "#fff", border: "none",
              borderRadius: 6, padding: "5px 12px", fontSize: 11,
              cursor: "pointer", fontWeight: 700,
            }}>
            + 패턴 추가
          </button>
        </div>

        {showAddForm && (
          <AddPatternForm onAdd={addPattern} onCancel={() => setShowAddForm(false)} />
        )}

        <div style={{ display: "grid", gap: 8 }}>
          {patterns.map(p => (
            <PatternCard key={p.id} pattern={p}
              selected={selectedPattern?.id === p.id}
              onClick={() => setSelectedPattern(p)}
              onDelete={p.builtin ? null : () => deletePattern(p.id)} />
          ))}
        </div>
      </div>

      {/* 스캔 */}
      <div style={{
        marginBottom: 16, padding: 14,
        background: "linear-gradient(to right, #064e3b, #134e4a)",
        border: "1px solid #10b981", borderRadius: 8,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#10b981", marginBottom: 8 }}>
          🔥 당일 시그널 스캔 → "{selectedPattern?.name}" 매칭
        </div>
        <div style={{ fontSize: 11, color: "#a7f3d0", marginBottom: 10 }}>
          sector-api/screening 호출 → 오늘 NEO 시그널 → 패턴 점수순 정렬
        </div>
        <button onClick={runTodayScan} disabled={scanning}
          style={{
            background: scanning ? "#475569" : "#10b981",
            color: "#fff", border: "none", borderRadius: 6,
            padding: "10px 20px", fontSize: 14, fontWeight: 700,
            cursor: scanning ? "wait" : "pointer",
          }}>
          {scanning ? "스캔 중..." : "🔍 당일 스캔 실행"}
        </button>
      </div>

      {scanError && (
        <div style={{
          marginBottom: 16, padding: 14, background: "#7f1d1d",
          border: "1px solid #ef4444", borderRadius: 8, color: "#fecaca",
        }}>
          ⚠️ 스캔 실패: {scanError}
        </div>
      )}

      {todaySignals && (
        <ScanResults data={todaySignals} pattern={selectedPattern} />
      )}

      {signalDB && signalDB.length > 0 && (
        <SignalDBSearch signals={signalDB} pattern={selectedPattern} />
      )}
    </div>
  );
}

// 패턴 매칭 점수 계산
function scorePattern(s, c) {
  let score = 0;
  const ch = s.change || 0;
  const amt = s.amount || 0;
  const inv = s.investor || "";
  const wick = s.wick;

  if (ch >= c.pctMin && ch <= c.pctMax) score += 40;
  else if (ch >= 10 && ch < 29) score += 20;

  if (c.amountMin != null && c.amountMax != null) {
    if (amt >= c.amountMin && amt <= c.amountMax) score += 25;
    else if (amt >= 500) score += 15;
  } else {
    if (amt >= 500) score += 15;
  }

  if (inv === "기+외") score += 20;
  else if (inv === "외인") score += 10;

  if (wick != null && wick <= 2) score += 15;
  else if (wick != null && wick <= 5) score += 5;

  return score;
}

function PatternCard({ pattern, selected, onClick, onDelete }) {
  return (
    <div onClick={onClick}
      style={{
        padding: 10, borderRadius: 6,
        background: selected ? "#0f172a" : "transparent",
        border: "1px solid " + (selected ? "#10b981" : "#334155"),
        cursor: "pointer",
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: selected ? "#10b981" : "#fff" }}>
          {pattern.builtin && "📌 "}{pattern.name}
        </div>
        {pattern.desc && (
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
            {pattern.desc}
          </div>
        )}
        {pattern.stats && (
          <div style={{ fontSize: 10, color: "#fbbf24", marginTop: 4 }}>
            과거 {pattern.stats.n}건 / 평균 +{pattern.stats.avg60d}% / +30% {pattern.stats.win30}%
          </div>
        )}
        {pattern.image_b64 && (
          <img src={pattern.image_b64} alt="chart"
               style={{ maxHeight: 80, marginTop: 6, borderRadius: 4 }} />
        )}
      </div>
      {onDelete && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{
            background: "transparent", color: "#ef4444",
            border: "1px solid #ef4444", borderRadius: 4,
            padding: "2px 6px", fontSize: 10, cursor: "pointer",
          }}>
          삭제
        </button>
      )}
    </div>
  );
}

function AddPatternForm({ onAdd, onCancel }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [imageB64, setImageB64] = useState("");
  const [pctMin, setPctMin] = useState(13);
  const [pctMax, setPctMax] = useState(22);
  const [amountMin, setAmountMin] = useState(800);
  const [amountMax, setAmountMax] = useState(2000);

  function onFileChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImageB64(ev.target.result);
    reader.readAsDataURL(f);
  }

  function submit() {
    if (!name) { alert("이름 입력"); return; }
    onAdd({
      name, desc, image_b64: imageB64,
      criteria: {
        pctMin: parseFloat(pctMin), pctMax: parseFloat(pctMax),
        amountMin: parseFloat(amountMin), amountMax: parseFloat(amountMax),
      },
    });
  }

  return (
    <div style={{
      padding: 12, marginBottom: 10,
      background: "#0f172a", border: "1px dashed #475569", borderRadius: 6,
    }}>
      <div style={{ fontSize: 12, color: "#fbbf24", marginBottom: 8, fontWeight: 700 }}>
        새 패턴 추가
      </div>
      <input type="text" value={name} onChange={e => setName(e.target.value)}
        placeholder="패턴 이름" style={inp} />
      <input type="text" value={desc} onChange={e => setDesc(e.target.value)}
        placeholder="설명" style={inp} />
      <input type="file" accept="image/*" onChange={onFileChange}
        style={{ ...inp, padding: 4 }} />
      {imageB64 && (
        <img src={imageB64} alt="preview" style={{ maxHeight: 100, marginBottom: 8, borderRadius: 4 }} />
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 8 }}>
        <label style={lbl}>등락률 min (%)
          <input type="number" value={pctMin} onChange={e => setPctMin(e.target.value)} style={numInp} />
        </label>
        <label style={lbl}>등락률 max (%)
          <input type="number" value={pctMax} onChange={e => setPctMax(e.target.value)} style={numInp} />
        </label>
        <label style={lbl}>거래대금 min (억)
          <input type="number" value={amountMin} onChange={e => setAmountMin(e.target.value)} style={numInp} />
        </label>
        <label style={lbl}>거래대금 max (억)
          <input type="number" value={amountMax} onChange={e => setAmountMax(e.target.value)} style={numInp} />
        </label>
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
        <button onClick={submit} style={{ ...btn, background: "#10b981" }}>저장</button>
        <button onClick={onCancel} style={{ ...btn, background: "#475569" }}>취소</button>
      </div>
    </div>
  );
}

function ScanResults({ data, pattern }) {
  const all = data.all || [];
  const top10 = all.slice(0, 10);
  return (
    <div style={{
      marginBottom: 16, padding: 14, background: "#1e293b",
      border: "1px solid #334155", borderRadius: 8,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#fbbf24", marginBottom: 8 }}>
        🥇 오늘 시그널 ({data.date} {data.time})
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10 }}>
        총 {data.summary?.total || 0}건 · S {data.summary?.S || 0} / A {data.summary?.A || 0} / B {data.summary?.B || 0} ·
        패턴: "{pattern.name}"
      </div>
      {top10.length === 0 ? (
        <div style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>
          오늘 시그널 없음
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ color: "#94a3b8" }}>
                <th style={th}>#</th>
                <th style={th}>패턴<br/>점수</th>
                <th style={th}>NEO<br/>등급</th>
                <th style={th}>종목</th>
                <th style={th}>코드</th>
                <th style={th}>등락</th>
                <th style={th}>거래대금</th>
                <th style={th}>윗꼬리</th>
                <th style={th}>수급</th>
                <th style={th}>시장</th>
              </tr>
            </thead>
            <tbody>
              {top10.map((s, i) => (
                <tr key={s.code} style={{ background: i % 2 === 0 ? "#0f172a" : "transparent" }}>
                  <td style={td}>{i + 1}</td>
                  <td style={Object.assign({}, td, {
                    fontWeight: 800,
                    color: s.patternScore >= 80 ? "#10b981" :
                           s.patternScore >= 60 ? "#fbbf24" : "#94a3b8"
                  })}>{s.patternScore}</td>
                  <td style={Object.assign({}, td, {
                    fontWeight: 800,
                    color: s.grade === "S" ? "#10b981" :
                           s.grade === "A" ? "#fbbf24" :
                           s.grade === "B" ? "#0ea5e9" : "#64748b"
                  })}>{s.grade}</td>
                  <td style={Object.assign({}, td, { fontWeight: 700, color: "#fbbf24" })}>{s.name}</td>
                  <td style={td}>{s.code}</td>
                  <td style={Object.assign({}, td, { color: "#10b981" })}>+{(s.change || 0).toFixed(2)}%</td>
                  <td style={td}>{s.amount}억</td>
                  <td style={td}>{s.wick != null ? s.wick + "%" : "-"}</td>
                  <td style={Object.assign({}, td, {
                    color: s.investor === "기+외" ? "#10b981" :
                           s.investor === "외인" ? "#0ea5e9" : "#94a3b8"
                  })}>{s.investor}</td>
                  <td style={td}>{s.market}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SignalDBSearch({ signals, pattern }) {
  const matched = signals
    .filter(s => s.grade !== "X")
    .map(s => ({
      ...s,
      patternScore: scorePattern({
        change: s.rate || 0,
        amount: s.vol || 0,
        investor: s.supply || "",
        wick: s.wick,
      }, pattern.criteria),
    }))
    .filter(s => s.patternScore >= 60)
    .sort((a, b) => b.patternScore - a.patternScore);
  const top30 = matched.slice(0, 30);

  return (
    <div style={{
      padding: 14, background: "#1e293b",
      border: "1px solid #334155", borderRadius: 8,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#fbbf24", marginBottom: 4 }}>
        📚 누적 시그널 DB — 같은 패턴 과거 사례
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10 }}>
        sector-api/data/signals.json · 점수 60+ 매칭 {matched.length}건
      </div>
      {top30.length > 0 ? (
        <div style={{ maxHeight: 400, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead style={{ position: "sticky", top: 0, background: "#1e293b" }}>
              <tr style={{ color: "#94a3b8" }}>
                <th style={th}>#</th>
                <th style={th}>점수</th>
                <th style={th}>등급</th>
                <th style={th}>종목</th>
                <th style={th}>날짜</th>
                <th style={th}>등락</th>
                <th style={th}>거래대금</th>
                <th style={th}>수급</th>
                <th style={th}>결과</th>
              </tr>
            </thead>
            <tbody>
              {top30.map((s, i) => (
                <tr key={s.id || i} style={{ background: i % 2 === 0 ? "#0f172a" : "transparent" }}>
                  <td style={td}>{i + 1}</td>
                  <td style={Object.assign({}, td, { fontWeight: 800, color: "#fbbf24" })}>{s.patternScore}</td>
                  <td style={Object.assign({}, td, {
                    color: s.grade === "S" ? "#10b981" :
                           s.grade === "A" ? "#fbbf24" : "#0ea5e9"
                  })}>{s.grade}</td>
                  <td style={Object.assign({}, td, { fontWeight: 700, color: "#fbbf24" })}>{s.name}</td>
                  <td style={td}>{s.signal_date}</td>
                  <td style={Object.assign({}, td, { color: "#10b981" })}>+{(s.rate || 0).toFixed(1)}%</td>
                  <td style={td}>{s.vol || 0}억</td>
                  <td style={td}>{s.supply}</td>
                  <td style={Object.assign({}, td, {
                    color: s.outcome === "TP1" || s.outcome === "TP2" ? "#10b981" :
                           s.outcome === "SL" ? "#ef4444" : "#94a3b8"
                  })}>
                    {s.outcome || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>
          매칭되는 과거 시그널 없음 (점수 60+)
        </div>
      )}
    </div>
  );
}

const inp = {
  width: "100%", padding: 8, fontSize: 12, marginBottom: 6,
  background: "#1e293b", color: "#fff",
  border: "1px solid #475569", borderRadius: 4, outline: "none",
  boxSizing: "border-box",
};
const numInp = { ...inp, width: "100%", marginBottom: 0 };
const lbl = { fontSize: 10, color: "#94a3b8", display: "flex", flexDirection: "column", gap: 2 };
const btn = {
  border: "none", color: "#fff", padding: "6px 14px",
  borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: "pointer",
};
const th = {
  textAlign: "center", padding: "6px 8px", fontSize: 11,
  fontWeight: 600, borderBottom: "1px solid #334155",
};
const td = {
  textAlign: "center", padding: "5px 8px",
  borderBottom: "1px solid #1e293b",
};
