// PatternScan.jsx — 패턴 라이브러리 + 당일 스캔
//
// 기능:
// 1. 빌트인 패턴 (풍산형 = 박스권 돌파)
// 2. 사용자 커스텀 패턴 추가 (이미지 업로드 + 정보 입력)
// 3. 당일 스캔 → 매칭 점수순 TOP 결과
//
// 데이터 저장: window.storage (artifact 영구 저장)
//   - keys: "pattern:custom_<id>" → { id, name, image_b64, criteria, addedAt }

import React, { useState, useEffect } from "react";

// 빌트인 패턴: 풍산형 박스권 돌파
const BUILTIN_PATTERNS = [
  {
    id: "builtin_box_breakout",
    name: "풍산형 (장기 박스권 → 거래대금 폭증 돌파)",
    desc: "1차 급등 → 11개월 박스권 → 큰 양봉 + 거래대금 30배 폭증으로 박스권 상단 돌파",
    criteria: {
      pctMin: 13, pctMax: 22,
      amountRatioMin: 5,         // 거래대금 폭증 5배+
      requireBox: true,           // 박스권 필수
      breakoutMin: 0.95, breakoutMax: 1.10,
    },
    builtin: true,
    stats: {
      n: 642,
      avg60d: 37.4,
      win30: 35,
      win50: 19,
    },
  },
];

export default function PatternScan() {
  const [patterns, setPatterns] = useState(BUILTIN_PATTERNS);
  const [selectedPattern, setSelectedPattern] = useState(BUILTIN_PATTERNS[0]);
  const [scanResults, setScanResults] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // 환경 체크
  const [envStatus, setEnvStatus] = useState(null);
  useEffect(() => {
    fetch("/api/health")
      .then(r => r.json())
      .then(setEnvStatus)
      .catch(e => setEnvStatus({ error: e.message }));
  }, []);

  // 사용자 커스텀 패턴 로드 (window.storage)
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
        if (customs.length > 0) {
          setPatterns([...BUILTIN_PATTERNS, ...customs]);
        }
      } catch (e) {}
    })();
  }, []);

  async function runScan() {
    setScanning(true);
    setScanResults(null);
    setScanProgress("KIS 토큰 발급 + 스캔 시작...");
    try {
      const res = await fetch("/api/scan-today?max=10&pool=80");
      const data = await res.json();
      if (data.error) {
        setScanResults({ error: data.error });
      } else {
        setScanResults(data);
      }
    } catch (e) {
      setScanResults({ error: e.message });
    } finally {
      setScanning(false);
      setScanProgress("");
    }
  }

  async function addPattern(newPattern) {
    if (typeof window === "undefined" || !window.storage) {
      alert("저장 불가 - browser storage 없음");
      return;
    }
    const id = "custom_" + Date.now();
    const pattern = { ...newPattern, id, builtin: false, addedAt: new Date().toISOString() };
    try {
      await window.storage.set("pattern:" + id, JSON.stringify(pattern));
      setPatterns([...patterns, pattern]);
      setShowAddForm(false);
    } catch (e) {
      alert("저장 실패: " + e.message);
    }
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
      {/* 환경 상태 */}
      {envStatus && (
        <div style={{
          marginBottom: 12, padding: 10,
          background: envStatus.env?.KIS_APP_KEY === "✓ set" ? "#064e3b" : "#7f1d1d",
          border: "1px solid " + (envStatus.env?.KIS_APP_KEY === "✓ set" ? "#10b981" : "#ef4444"),
          borderRadius: 6, fontSize: 12,
        }}>
          <b>{envStatus.env?.KIS_APP_KEY === "✓ set" ? "✓ KIS API 준비" : "⚠️ Vercel ENV 등록 필요"}</b>
          {" · "}{envStatus.hint}
          {envStatus.super_stocks_pool && (
            <span> · 슈퍼주도주 풀 {envStatus.super_stocks_pool.with_code}/{envStatus.super_stocks_pool.total}</span>
          )}
        </div>
      )}

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
              onDelete={p.builtin ? null : () => deletePattern(p.id)}
            />
          ))}
        </div>
      </div>

      {/* 스캔 버튼 */}
      <div style={{
        marginBottom: 16, padding: 14,
        background: "linear-gradient(to right, #064e3b, #134e4a)",
        border: "1px solid #10b981", borderRadius: 8,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#10b981", marginBottom: 8 }}>
          🔥 당일 패턴 스캔 ({selectedPattern?.name})
        </div>
        <div style={{ fontSize: 11, color: "#a7f3d0", marginBottom: 10 }}>
          오늘 시그널 발생 종목 → 박스권 돌파 패턴 분석 → 점수순 정렬
          (슈퍼주도주 풀 80개 스캔, 약 30~60초 소요)
        </div>
        <button onClick={runScan} disabled={scanning || envStatus?.env?.KIS_APP_KEY !== "✓ set"}
          style={{
            background: scanning ? "#475569" : "#10b981",
            color: "#fff", border: "none", borderRadius: 6,
            padding: "10px 20px", fontSize: 14, fontWeight: 700,
            cursor: scanning ? "wait" : "pointer",
            opacity: envStatus?.env?.KIS_APP_KEY !== "✓ set" ? 0.5 : 1,
          }}>
          {scanning ? "스캔 중..." : "🔍 당일 스캔 실행"}
        </button>
        {scanProgress && (
          <div style={{ fontSize: 11, color: "#a7f3d0", marginTop: 8 }}>
            {scanProgress}
          </div>
        )}
      </div>

      {/* 스캔 결과 */}
      {scanResults && (
        <ScanResults results={scanResults} />
      )}
    </div>
  );
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
            과거 {pattern.stats.n}건 / 평균 +{pattern.stats.avg60d}% / +30% 도달 {pattern.stats.win30}%
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
  const [amountRatioMin, setAmountRatioMin] = useState(5);
  const [requireBox, setRequireBox] = useState(true);

  function onFileChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImageB64(ev.target.result);
    reader.readAsDataURL(f);
  }

  function submit() {
    if (!name) { alert("패턴 이름 입력"); return; }
    onAdd({
      name, desc,
      image_b64: imageB64,
      criteria: {
        pctMin: parseFloat(pctMin), pctMax: parseFloat(pctMax),
        amountRatioMin: parseFloat(amountRatioMin),
        requireBox,
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
        placeholder="패턴 이름 (예: 풍산형)"
        style={inp} />
      <input type="text" value={desc} onChange={e => setDesc(e.target.value)}
        placeholder="설명 (예: 11개월 박스권 후 거래대금 폭증 돌파)"
        style={inp} />
      <input type="file" accept="image/*" onChange={onFileChange}
        style={{ ...inp, padding: 4 }} />
      {imageB64 && (
        <img src={imageB64} alt="preview" style={{ maxHeight: 100, marginBottom: 8, borderRadius: 4 }} />
      )}
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <label style={lbl}>등락률 min
          <input type="number" value={pctMin} onChange={e => setPctMin(e.target.value)} style={numInp} />
        </label>
        <label style={lbl}>등락률 max
          <input type="number" value={pctMax} onChange={e => setPctMax(e.target.value)} style={numInp} />
        </label>
        <label style={lbl}>거래대금 폭증 비율 (배)
          <input type="number" value={amountRatioMin} onChange={e => setAmountRatioMin(e.target.value)} style={numInp} />
        </label>
      </div>
      <label style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
        <input type="checkbox" checked={requireBox} onChange={e => setRequireBox(e.target.checked)} />
        박스권 필수
      </label>
      <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
        <button onClick={submit} style={{ ...btn, background: "#10b981" }}>저장</button>
        <button onClick={onCancel} style={{ ...btn, background: "#475569" }}>취소</button>
      </div>
    </div>
  );
}

function ScanResults({ results }) {
  if (results.error) {
    return (
      <div style={{
        padding: 16, background: "#7f1d1d",
        border: "1px solid #ef4444", borderRadius: 8, color: "#fecaca",
      }}>
        ⚠️ {results.error}
      </div>
    );
  }
  return (
    <div style={{
      padding: 14, background: "#1e293b",
      border: "1px solid #334155", borderRadius: 8,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#fbbf24", marginBottom: 8 }}>
        🥇 스캔 결과 ({results.target_date})
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10 }}>
        스캔 {results.scanned}개 · 매칭 {results.matches}개 · 에러 {results.errors}개
      </div>
      {results.results.length === 0 ? (
        <div style={{ padding: 30, textAlign: "center", color: "#94a3b8" }}>
          오늘 패턴 매칭 종목 없음
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ color: "#94a3b8" }}>
                <th style={th}>#</th>
                <th style={th}>점수</th>
                <th style={th}>종목</th>
                <th style={th}>코드</th>
                <th style={th}>등락</th>
                <th style={th}>거래대금</th>
                <th style={th}>폭증</th>
                <th style={th}>박스권</th>
                <th style={th}>시그널</th>
              </tr>
            </thead>
            <tbody>
              {results.results.map((r, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#0f172a" : "transparent" }}>
                  <td style={td}>{r.rank}</td>
                  <td style={Object.assign({}, td, { fontWeight: 800,
                       color: r.score >= 80 ? "#10b981" : r.score >= 60 ? "#fbbf24" : "#94a3b8" })}>
                    {r.score}
                  </td>
                  <td style={Object.assign({}, td, { fontWeight: 700, color: "#fbbf24" })}>
                    {r.name}
                  </td>
                  <td style={td}>{r.code}</td>
                  <td style={Object.assign({}, td, { color: "#10b981" })}>
                    +{r.signal.pct.toFixed(2)}%
                  </td>
                  <td style={td}>
                    {(r.signal.amount / 1e8).toFixed(0)}억
                  </td>
                  <td style={Object.assign({}, td, { color: "#10b981" })}>
                    {r.signal.amountRatio.toFixed(1)}x
                  </td>
                  <td style={td}>
                    {r.box?.isBox ? "✓ " + r.box.rangePct.toFixed(0) + "%" : "X"}
                  </td>
                  <td style={Object.assign({}, td, { color: "#94a3b8" })}>
                    {r.signals_6y}회
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
const numInp = { ...inp, width: 80, marginBottom: 0 };
const lbl = { fontSize: 10, color: "#94a3b8", display: "flex", flexDirection: "column", gap: 2 };
const btn = {
  border: "none", color: "#fff", padding: "6px 14px",
  borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: "pointer",
};
const th = { textAlign: "center", padding: "6px 8px", fontSize: 11,
             fontWeight: 600, borderBottom: "1px solid #334155" };
const td = { textAlign: "center", padding: "5px 8px",
             borderBottom: "1px solid #1e293b" };
