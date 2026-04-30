// App.jsx — 패턴 매칭 단일 페이지
//
// 목적:
// 1. 패턴 라이브러리 (이미지 + 조건) 추가/관리
// 2. 21~26년 데이터(24,355건)에서 패턴 매칭 → 백테스트 (성공률/평균수익)
// 3. 오늘 sector-api 시그널 → 같은 패턴 매칭 → 매수 후보 TOP

import React, { useState, useEffect, useMemo } from "react";
import signalsData from "./data/signals.json";

const SECTOR_API = "https://sector-api-pink.vercel.app/api";

// 빌트인 풍산형 패턴
const BUILTIN_PATTERNS = [
  {
    id: "builtin_box_breakout",
    name: "풍산형 (장기 박스권 → 거래대금 폭증 돌파)",
    desc: "1차 급등 → 11개월 박스권 → 큰 양봉 + 거래대금 30배 폭증",
    criteria: {
      pctMin: 13, pctMax: 22,
      amtMin: 800, amtMax: 2000,
      iv: ["기+외"],          // 외인+기관 쌍매수
      requireBox: true,        // 박스권 (h60/h120 둘 다 false)
      sigsMin: 11,             // 시그널 11회+
    },
    builtin: true,
  },
];

export default function App() {
  // 패턴 라이브러리
  const [patterns, setPatterns] = useState(BUILTIN_PATTERNS);
  const [selected, setSelected] = useState(BUILTIN_PATTERNS[0]);
  const [showAddForm, setShowAddForm] = useState(false);

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

  // 백테스트: 21~26년 매칭
  const backtest = useMemo(() => {
    const matched = signalsData.filter(s => matchesCriteria(s, selected.criteria));
    const withFuture = matched.filter(s => s.mg60 != null);
    if (withFuture.length === 0) {
      return { n: matched.length, withFuture: 0, avgGain: 0,
               win30: 0, win50: 0, win100: 0, neg: 0, byYear: {} };
    }
    const sumGain = withFuture.reduce((s, c) => s + c.mg60, 0);
    const win30 = withFuture.filter(s => s.mg60 >= 30).length;
    const win50 = withFuture.filter(s => s.mg60 >= 50).length;
    const win100 = withFuture.filter(s => s.mg60 >= 100).length;
    const neg = withFuture.filter(s => s.mg60 < 0).length;
    const byYear = {};
    for (const s of withFuture) {
      const yy = "20" + s.date.slice(0, 2);
      if (!byYear[yy]) byYear[yy] = { n: 0, sumGain: 0, win30: 0 };
      byYear[yy].n++;
      byYear[yy].sumGain += s.mg60;
      if (s.mg60 >= 30) byYear[yy].win30++;
    }
    return {
      n: matched.length, withFuture: withFuture.length,
      avgGain: sumGain / withFuture.length,
      win30, win30Rate: win30 / withFuture.length * 100,
      win50, win50Rate: win50 / withFuture.length * 100,
      win100, win100Rate: win100 / withFuture.length * 100,
      neg, negRate: neg / withFuture.length * 100,
      byYear, matched,
    };
  }, [selected.id]);

  // 당일 스캔
  const [todaySignals, setTodaySignals] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);

  async function scanToday() {
    setScanning(true);
    setScanError(null);
    setTodaySignals(null);
    try {
      const res = await fetch(SECTOR_API + "/screening");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "API 에러");
      // 패턴 매칭 점수
      const all = (data.all || []).map(s => ({
        ...s,
        match: matchesCriteria({
          ch: s.change || 0,
          amt: s.amount || 0,
          iv: s.investor === "기+외" ? "기+외" :
              s.investor === "외인" ? "외만" :
              s.investor === "기관" ? "기만" : "둘다-",
          h60: false, h120: false,  // 모름 (시그널일 정보 없음)
          sigs: 30,                  // 모름 (가정 통과)
          wick: s.wick || 0,
        }, selected.criteria),
      }));
      // 매칭만 추출
      const matched = all.filter(s => s.match);
      matched.sort((a, b) => (b.score || 0) - (a.score || 0));
      setTodaySignals({ ...data, matched, all });
    } catch (e) {
      setScanError(e.message);
    } finally {
      setScanning(false);
    }
  }

  // 선택 패턴 변경 시 당일 결과 재매칭
  useEffect(() => {
    if (!todaySignals) return;
    const all = (todaySignals.all || []).map(s => ({
      ...s,
      match: matchesCriteria({
        ch: s.change || 0,
        amt: s.amount || 0,
        iv: s.investor === "기+외" ? "기+외" :
            s.investor === "외인" ? "외만" :
            s.investor === "기관" ? "기만" : "둘다-",
        h60: false, h120: false,
        sigs: 30,
        wick: s.wick || 0,
      }, selected.criteria),
    }));
    const matched = all.filter(s => s.match);
    matched.sort((a, b) => (b.score || 0) - (a.score || 0));
    setTodaySignals({ ...todaySignals, matched, all });
  }, [selected.id]);

  async function addPattern(p) {
    if (typeof window === "undefined" || !window.storage) {
      alert("저장 불가"); return;
    }
    const id = "custom_" + Date.now();
    const pattern = { ...p, id, builtin: false };
    try {
      await window.storage.set("pattern:" + id, JSON.stringify(pattern));
      setPatterns([...patterns, pattern]);
      setShowAddForm(false);
    } catch (e) { alert("저장 실패: " + e.message); }
  }

  async function deletePattern(id) {
    if (!confirm("삭제하시겠습니까?")) return;
    if (typeof window !== "undefined" && window.storage) {
      try { await window.storage.delete("pattern:" + id); } catch (e) {}
    }
    setPatterns(patterns.filter(p => p.id !== id));
    if (selected.id === id) setSelected(BUILTIN_PATTERNS[0]);
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#0f172a", color: "#e2e8f0",
      fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
      padding: 16,
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* 헤더 */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#10b981" }}>
            🎯 차트 패턴 매칭 — 오늘 매수 후보 발굴
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#94a3b8" }}>
            과거 6년 ({signalsData.length.toLocaleString()}건) 백테스트 →
            <b style={{color:"#fbbf24"}}> 오늘 같은 패턴 종목 발굴</b>
          </p>
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
              {showAddForm ? "취소" : "+ 패턴 추가 (이미지)"}
            </button>
          </div>

          {showAddForm && (
            <AddPatternForm onAdd={addPattern} onCancel={() => setShowAddForm(false)} />
          )}

          <div style={{ display: "grid", gap: 8 }}>
            {patterns.map(p => (
              <PatternCard key={p.id} pattern={p}
                selected={selected.id === p.id}
                onClick={() => setSelected(p)}
                onDelete={p.builtin ? null : () => deletePattern(p.id)} />
            ))}
          </div>
        </div>

        {/* 백테스트 결과 */}
        <BacktestResults backtest={backtest} pattern={selected} />

        {/* 당일 스캔 */}
        <div style={{
          marginBottom: 16, padding: 14,
          background: "linear-gradient(to right, #064e3b, #134e4a)",
          border: "1px solid #10b981", borderRadius: 8,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#10b981", marginBottom: 8 }}>
            🔥 오늘 같은 패턴 매수 후보
          </div>
          <div style={{ fontSize: 11, color: "#a7f3d0", marginBottom: 10 }}>
            sector-api 호출 → 오늘 시그널 종목 → "{selected.name}" 패턴 매칭
          </div>
          <button onClick={scanToday} disabled={scanning}
            style={{
              background: scanning ? "#475569" : "#10b981",
              color: "#fff", border: "none", borderRadius: 6,
              padding: "10px 20px", fontSize: 14, fontWeight: 700,
              cursor: scanning ? "wait" : "pointer",
            }}>
            {scanning ? "스캔 중..." : "🔍 당일 스캔"}
          </button>
        </div>

        {scanError && (
          <div style={{
            marginBottom: 16, padding: 14, background: "#7f1d1d",
            border: "1px solid #ef4444", borderRadius: 8, color: "#fecaca",
          }}>
            ⚠️ {scanError}
          </div>
        )}

        {todaySignals && <TodayResults data={todaySignals} pattern={selected} />}

        <div style={{ textAlign: "center", color: "#475569", fontSize: 11,
                      marginTop: 20, paddingBottom: 20 }}>
          데이터: D.pkl {signalsData.length.toLocaleString()}건 시그널 (2021.01 ~ 2026.04)
        </div>
      </div>
    </div>
  );
}

// 패턴 매칭 (true/false)
function matchesCriteria(s, c) {
  if (c.pctMin != null && s.ch < c.pctMin) return false;
  if (c.pctMax != null && s.ch > c.pctMax) return false;
  if (c.amtMin != null && s.amt < c.amtMin) return false;
  if (c.amtMax != null && s.amt > c.amtMax) return false;
  if (c.iv && c.iv.length > 0 && !c.iv.includes(s.iv)) return false;
  if (c.requireBox && (s.h60 || s.h120)) return false;
  if (c.requireH60 && !s.h60) return false;
  if (c.sigsMin != null && s.sigs < c.sigsMin) return false;
  if (c.wickMax != null && s.wick != null && s.wick > c.wickMax) return false;
  return true;
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
        <div style={{ fontSize: 10, color: "#fbbf24", marginTop: 4 }}>
          {summarizeCriteria(pattern.criteria)}
        </div>
        {pattern.image_b64 && (
          <img src={pattern.image_b64} alt=""
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

function summarizeCriteria(c) {
  if (!c) return "";
  const parts = [];
  if (c.pctMin != null && c.pctMax != null) parts.push(`+${c.pctMin}~${c.pctMax}%`);
  else if (c.pctMin != null) parts.push(`+${c.pctMin}%+`);
  if (c.amtMin != null && c.amtMax != null) parts.push(`${c.amtMin}~${c.amtMax}억`);
  else if (c.amtMin != null) parts.push(`${c.amtMin}억+`);
  if (c.iv && c.iv.length > 0) parts.push("수급:" + c.iv.join("/"));
  if (c.requireBox) parts.push("박스권");
  if (c.requireH60) parts.push("60일 신고가");
  if (c.sigsMin != null) parts.push(`시그널 ${c.sigsMin}+`);
  return parts.join(" · ");
}

function AddPatternForm({ onAdd, onCancel }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [imageB64, setImageB64] = useState("");
  const [pctMin, setPctMin] = useState(13);
  const [pctMax, setPctMax] = useState(22);
  const [amtMin, setAmtMin] = useState(800);
  const [amtMax, setAmtMax] = useState(2000);
  const [iv, setIv] = useState("기+외");
  const [requireBox, setRequireBox] = useState(true);
  const [requireH60, setRequireH60] = useState(false);
  const [sigsMin, setSigsMin] = useState(11);

  function onFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => setImageB64(ev.target.result);
    r.readAsDataURL(f);
  }

  function submit() {
    if (!name) { alert("이름 입력"); return; }
    onAdd({
      name, desc, image_b64: imageB64,
      criteria: {
        pctMin: parseFloat(pctMin), pctMax: parseFloat(pctMax),
        amtMin: parseFloat(amtMin), amtMax: parseFloat(amtMax),
        iv: iv === "전체" ? [] : iv.split("/"),
        requireBox, requireH60,
        sigsMin: parseInt(sigsMin) || 0,
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
        placeholder="패턴 이름 (예: 풍산형)" style={inp} />
      <input type="text" value={desc} onChange={e => setDesc(e.target.value)}
        placeholder="설명" style={inp} />
      <input type="file" accept="image/*" onChange={onFile}
        style={{ ...inp, padding: 4 }} />
      {imageB64 && (
        <img src={imageB64} alt="preview"
             style={{ maxHeight: 100, marginBottom: 8, borderRadius: 4 }} />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 8 }}>
        <label style={lbl}>등락률 min (%)
          <input type="number" value={pctMin} onChange={e => setPctMin(e.target.value)} style={numInp} />
        </label>
        <label style={lbl}>등락률 max (%)
          <input type="number" value={pctMax} onChange={e => setPctMax(e.target.value)} style={numInp} />
        </label>
        <label style={lbl}>거래대금 min (억)
          <input type="number" value={amtMin} onChange={e => setAmtMin(e.target.value)} style={numInp} />
        </label>
        <label style={lbl}>거래대금 max (억)
          <input type="number" value={amtMax} onChange={e => setAmtMax(e.target.value)} style={numInp} />
        </label>
        <label style={lbl}>수급 (기+외/외만/기만/둘다-/전체)
          <select value={iv} onChange={e => setIv(e.target.value)}
            style={{ ...numInp, padding: 6 }}>
            <option>전체</option>
            <option>기+외</option>
            <option>기+외/외만</option>
            <option>외만</option>
            <option>기만</option>
            <option>둘다-</option>
          </select>
        </label>
        <label style={lbl}>시그널 빈도 min (회+)
          <input type="number" value={sigsMin} onChange={e => setSigsMin(e.target.value)} style={numInp} />
        </label>
      </div>

      <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#94a3b8" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input type="checkbox" checked={requireBox} onChange={e => setRequireBox(e.target.checked)} />
          박스권 (60일/120일 신고가 X)
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input type="checkbox" checked={requireH60} onChange={e => setRequireH60(e.target.checked)} />
          60일 신고가 갱신
        </label>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
        <button onClick={submit} style={{ ...btn, background: "#10b981" }}>저장</button>
        <button onClick={onCancel} style={{ ...btn, background: "#475569" }}>취소</button>
      </div>
    </div>
  );
}

function BacktestResults({ backtest, pattern }) {
  if (backtest.n === 0) {
    return (
      <div style={{
        marginBottom: 16, padding: 30, textAlign: "center",
        background: "#1e293b", border: "1px solid #334155", borderRadius: 8,
        color: "#94a3b8",
      }}>
        조건 매칭 시그널 없음. 패턴 조건 완화 필요.
      </div>
    );
  }
  const years = Object.keys(backtest.byYear).sort();
  const recent20 = backtest.matched
    .filter(s => s.mg60 != null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20);

  return (
    <div style={{
      marginBottom: 16, padding: 14,
      background: "#1e293b", border: "1px solid #334155", borderRadius: 8,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#fbbf24", marginBottom: 8 }}>
        📊 백테스트 (21~26년) — "{pattern.name}"
      </div>

      {/* KPI */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 8, marginBottom: 14,
      }}>
        <Kpi label="매칭 시그널" value={backtest.n.toLocaleString() + "건"} color="#fbbf24" />
        <Kpi label="평균 60일 최고" value={"+" + backtest.avgGain.toFixed(1) + "%"} color="#10b981" />
        <Kpi label="+30% 도달률" value={backtest.win30Rate.toFixed(0) + "%"}
             sub={backtest.win30 + "건"} color="#10b981" />
        <Kpi label="+50% 도달률" value={backtest.win50Rate.toFixed(0) + "%"}
             sub={backtest.win50 + "건"} color="#10b981" />
        <Kpi label="+100% 대박" value={backtest.win100Rate.toFixed(0) + "%"}
             sub={backtest.win100 + "건"} color="#10b981" />
        <Kpi label="음수 마감" value={backtest.negRate.toFixed(0) + "%"}
             sub={backtest.neg + "건"} color="#ef4444" />
      </div>

      {/* 연도별 */}
      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>연도별 발생 + 평균 60일 최고:</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 6, marginBottom: 14 }}>
        {years.map(y => {
          const b = backtest.byYear[y];
          return (
            <div key={y} style={{
              background: "#0f172a", border: "1px solid #334155",
              borderRadius: 4, padding: 6, fontSize: 11,
            }}>
              <div style={{ color: "#fbbf24", fontWeight: 700 }}>{y}</div>
              <div style={{ color: "#fff" }}>{b.n}건 · 평균 +{(b.sumGain/b.n).toFixed(1)}%</div>
              <div style={{ color: "#10b981", fontSize: 10 }}>+30% 도달 {b.win30}건 ({(b.win30/b.n*100).toFixed(0)}%)</div>
            </div>
          );
        })}
      </div>

      {/* 최근 20건 */}
      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>최근 매칭 시그널 20건:</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ color: "#94a3b8" }}>
              <th style={th}>#</th>
              <th style={th}>날짜</th>
              <th style={th}>종목</th>
              <th style={th}>시장</th>
              <th style={th}>등락</th>
              <th style={th}>거래대금</th>
              <th style={th}>수급</th>
              <th style={th}>시그널</th>
              <th style={th}>60일 최고</th>
              <th style={th}>도달일</th>
            </tr>
          </thead>
          <tbody>
            {recent20.map((s, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "#0f172a" : "transparent" }}>
                <td style={td}>{i+1}</td>
                <td style={td}>{s.date}</td>
                <td style={Object.assign({}, td, { fontWeight: 700, color: "#fbbf24" })}>{s.name}</td>
                <td style={td}>{s.mkt}</td>
                <td style={Object.assign({}, td, { color: "#10b981" })}>+{s.ch}%</td>
                <td style={td}>{s.amt}억</td>
                <td style={td}>{s.iv}</td>
                <td style={Object.assign({}, td, { color: "#94a3b8" })}>{s.sigs}회</td>
                <td style={Object.assign({}, td, {
                  fontWeight: 700,
                  color: s.mg60 >= 30 ? "#10b981" : s.mg60 >= 0 ? "#fbbf24" : "#ef4444",
                })}>
                  {s.mg60 >= 0 ? "+" : ""}{s.mg60.toFixed(1)}%
                </td>
                <td style={td}>{s.d2m}일</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TodayResults({ data, pattern }) {
  const matched = data.matched || [];
  return (
    <div style={{
      marginBottom: 16, padding: 14, background: "#1e293b",
      border: "1px solid #334155", borderRadius: 8,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#fbbf24", marginBottom: 8 }}>
        🥇 오늘 매수 후보 ({data.date} {data.time})
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10 }}>
        오늘 시그널 {data.summary?.total || 0}건 중 "{pattern.name}" 매칭 <b style={{color:"#10b981"}}>{matched.length}건</b>
      </div>
      {matched.length === 0 ? (
        <div style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>
          오늘은 이 패턴 매칭 종목 없음. 다른 패턴 시도하거나 내일 다시.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ color: "#94a3b8" }}>
                <th style={th}>#</th>
                <th style={th}>NEO 등급</th>
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
              {matched.map((s, i) => (
                <tr key={s.code} style={{ background: i % 2 === 0 ? "#0f172a" : "transparent" }}>
                  <td style={td}>{i+1}</td>
                  <td style={Object.assign({}, td, {
                    fontWeight: 800,
                    color: s.grade === "S" ? "#10b981" :
                           s.grade === "A" ? "#fbbf24" :
                           s.grade === "B" ? "#0ea5e9" : "#64748b",
                  })}>{s.grade}</td>
                  <td style={Object.assign({}, td, { fontWeight: 700, color: "#fbbf24" })}>{s.name}</td>
                  <td style={td}>{s.code}</td>
                  <td style={Object.assign({}, td, { color: "#10b981" })}>+{(s.change || 0).toFixed(2)}%</td>
                  <td style={td}>{s.amount}억</td>
                  <td style={td}>{s.wick != null ? s.wick + "%" : "-"}</td>
                  <td style={Object.assign({}, td, {
                    color: s.investor === "기+외" ? "#10b981" :
                           s.investor === "외인" ? "#0ea5e9" : "#94a3b8",
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

function Kpi({ label, value, sub, color }) {
  return (
    <div style={{
      background: "#0f172a", border: "1px solid #334155",
      borderRadius: 6, padding: 8,
    }}>
      <div style={{ fontSize: 10, color: "#94a3b8" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: "#64748b" }}>{sub}</div>}
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
