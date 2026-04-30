// App.jsx — 6가지 타입 패턴 매칭 + 당일 종목 발굴
//
// 목적:
// 1. 사용자 차트 44장 분석 → 6가지 패턴 타입 (A~F) 그룹화
// 2. D.pkl 24,355건으로 즉시 백테스트 (각 타입별)
// 3. 15:00+ sector-api/screening 호출 → 당일 시그널을 6타입에 매칭
// 4. 싱크% (패턴 합치도) 순으로 각 타입별 4~5개 종목 표시

import React, { useState, useEffect, useMemo } from "react";
import signalsData from "./data/signals.json";

const SECTOR_API = "https://sector-api-pink.vercel.app/api";

// 6가지 타입 — 사용자가 업로드한 44장 차트의 공통 패턴 분류
const PATTERN_TYPES = [
  {
    id: "A",
    name: "풍산형 (박스권 돌파)",
    desc: "장기 박스권 → 큰 양봉 + 거래대금 폭증",
    examples: "풍산, 케이엘넷, NAVER, 쿠콘, POSCO홀딩스, 한화, 한전KPS",
    criteria: { chMin:13, chMax:24, amtMin:500, amtMax:3000, h60:false, h120:false },
    color: "#10b981",
  },
  {
    id: "B",
    name: "V자 반등 (장기하락 후)",
    desc: "1년+ 하락 후 첫 거래대금 폭증 양봉 (추세전환)",
    examples: "NHN KCP, 카카오, 안랩, 휴스틸, 탑코미디어, 웹케시, 대주산업",
    criteria: { chMin:13, chMax:27, amtMin:200, amtMax:2500, h60:false, h120:false },
    color: "#0ea5e9",
  },
  {
    id: "C",
    name: "좌측 시그널 재현형",
    desc: "1차 시그널 후 횡보 → 우측에서 같은 시그널 재현",
    examples: "하이트진로, DSC인베스트, 세명전기, GS글로벌, 에스피지, 유라테크",
    criteria: { chMin:9, chMax:30, amtMin:200, amtMax:2500, h60:false, h120:false, sigsMin:2 },
    color: "#fbbf24",
  },
  {
    id: "D",
    name: "박스권 폭등형",
    desc: "박스권 후 +20%+ 폭등 (거래대금 50배 이상)",
    examples: "고영, 아가방컴퍼니, 나우IB, 넥스틸, 우리기술",
    criteria: { chMin:20, chMax:30, amtMin:300, amtMax:3000, h60:false, h120:false },
    color: "#ef4444",
  },
  {
    id: "E",
    name: "추세 추격형",
    desc: "정배열 + 추세 강한 종목 + 단기 조정 후 재돌파",
    examples: "현대엘리베이터, 레인보우로보틱스, 한화오션, 삼성카드, 두산에너빌리티",
    criteria: { chMin:7, chMax:17, amtMin:500, amtMax:99999, h60:true },
    color: "#a855f7",
  },
  {
    id: "F",
    name: "매물대 돌파형",
    desc: "박스권 매물대 정확히 돌파 (저항선 깨짐)",
    examples: "명신산업 (대표), 박스권 + 거래대금 폭증",
    criteria: { chMin:13, chMax:25, amtMin:300, amtMax:2500, h60:false, h120:false },
    color: "#ec4899",
  },
];

// 매칭 (boolean)
function matchType(s, c) {
  const ch = s.ch ?? s.change ?? 0;
  const amt = s.amt ?? s.amount ?? 0;
  const h60 = s.h60;
  const h120 = s.h120;
  const sigs = s.sigs ?? 0;

  if (ch < c.chMin || ch > c.chMax) return false;
  if (amt < c.amtMin || amt > c.amtMax) return false;
  if (c.h60 === true && !h60) return false;
  if (c.h60 === false && h60) return false;
  if (c.h120 === true && !h120) return false;
  if (c.h120 === false && h120) return false;
  if (c.sigsMin != null && sigs < c.sigsMin) return false;
  return true;
}

// 싱크% 계산 (0~100) — 패턴 중심 조건과 얼마나 일치하는지
function calcSync(s, c) {
  const ch = s.ch ?? s.change ?? 0;
  const amt = s.amt ?? s.amount ?? 0;
  const inv = s.iv ?? s.investor ?? "";
  const wick = s.wick;

  let score = 0;
  let max = 0;

  // 1. 등락률 — 중심값 가까울수록 점수
  const chMid = (c.chMin + c.chMax) / 2;
  const chRange = (c.chMax - c.chMin) / 2;
  const chDist = Math.abs(ch - chMid);
  score += Math.max(0, 30 * (1 - chDist / chRange));
  max += 30;

  // 2. 거래대금 — 중심값 가까울수록 점수 (log scale)
  const amtMid = Math.sqrt(c.amtMin * Math.min(c.amtMax, 5000));
  const amtScore = amt > 0 ? Math.max(0, 25 * (1 - Math.abs(Math.log(amt/amtMid)) / 1.5)) : 0;
  score += Math.min(25, amtScore);
  max += 25;

  // 3. 수급 — 기+외 또는 외인 우대
  if (inv === "기+외" || inv === "기관+외인") score += 25;
  else if (inv === "외인" || inv === "외만") score += 18;
  else if (inv === "기관" || inv === "기만") score += 10;
  max += 25;

  // 4. 윗꼬리 — 작을수록 강한 종가
  if (wick != null) {
    if (wick <= 1) score += 20;
    else if (wick <= 3) score += 15;
    else if (wick <= 5) score += 10;
    else if (wick <= 10) score += 5;
  } else {
    score += 10;  // 모름 = 중립
  }
  max += 20;

  return Math.round(score / max * 100);
}

// 당일 sector-api 시그널을 D.pkl 형식으로 변환
function toSignalFormat(s) {
  return {
    name: s.name,
    code: s.code,
    ch: s.change ?? 0,
    amt: s.amount ?? 0,
    iv: s.investor === "기+외" ? "기+외" :
        s.investor === "외인" ? "외만" :
        s.investor === "기관" ? "기만" : "둘다-",
    h60: false,  // 모름 — 보수적으로 false
    h120: false,
    sigs: 5,     // 모름 — 통과 가정
    wick: s.wick ?? 5,
    grade: s.grade,
    market: s.market,
  };
}

export default function App() {
  // 백테스트 (전체 타입)
  const backtest = useMemo(() => {
    const out = {};
    for (const t of PATTERN_TYPES) {
      const matched = signalsData.filter(s => matchType(s, t.criteria) && s.mg60 != null);
      if (matched.length === 0) {
        out[t.id] = { n:0 };
        continue;
      }
      const sumGain = matched.reduce((s,c)=>s+c.mg60, 0);
      const win30 = matched.filter(s=>s.mg60>=30).length;
      const win50 = matched.filter(s=>s.mg60>=50).length;
      const win100 = matched.filter(s=>s.mg60>=100).length;
      const neg = matched.filter(s=>s.mg60<0).length;
      out[t.id] = {
        n: matched.length,
        avg: sumGain / matched.length,
        win30: win30/matched.length*100,
        win50: win50/matched.length*100,
        win100: win100/matched.length*100,
        neg: neg/matched.length*100,
        recent: [...matched].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5),
      };
    }
    return out;
  }, []);

  // 당일 스캔
  const [todayAll, setTodayAll] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanTime, setScanTime] = useState(null);

  async function runTodayScan() {
    setScanning(true);
    setScanError(null);
    try {
      const res = await fetch(SECTOR_API + "/screening");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "API 에러");
      setTodayAll(data.all || []);
      setScanTime(new Date());
    } catch (e) {
      setScanError(e.message);
    } finally {
      setScanning(false);
    }
  }

  // 자동 스캔 (페이지 로드 시 1회 + 5분마다)
  useEffect(() => {
    runTodayScan();
    const t = setInterval(() => {
      const now = new Date();
      const hh = now.getHours();
      const mm = now.getMinutes();
      // 14:50~15:30 사이 자동 새로고침
      if ((hh === 14 && mm >= 50) || (hh === 15 && mm <= 30)) {
        runTodayScan();
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // 타입별 매칭 결과 (당일)
  const todayMatched = useMemo(() => {
    if (!todayAll) return null;
    const out = {};
    for (const t of PATTERN_TYPES) {
      const matched = todayAll
        .map(s => {
          const sig = toSignalFormat(s);
          if (!matchType(sig, t.criteria)) return null;
          const sync = calcSync(sig, t.criteria);
          return { ...s, sync };
        })
        .filter(Boolean)
        .sort((a, b) => b.sync - a.sync)
        .slice(0, 5);  // 타입별 TOP 5
      out[t.id] = matched;
    }
    return out;
  }, [todayAll]);

  return (
    <div style={{
      minHeight: "100vh", background: "#0f172a", color: "#e2e8f0",
      fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
      padding: 16,
    }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {/* 헤더 */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#10b981" }}>
            🎯 6타입 차트 패턴 매칭 — 당일 종목 발굴
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#94a3b8" }}>
            44장 차트 → 6타입 그룹화 · D.pkl {signalsData.length.toLocaleString()}건 백테스트 ·
            <b style={{color:"#fbbf24"}}> 당일 싱크%순 TOP 5 발굴</b>
          </p>
        </div>

        {/* 스캔 컨트롤 */}
        <div style={{
          marginBottom: 16, padding: 14,
          background: "linear-gradient(to right, #064e3b, #134e4a)",
          border: "1px solid #10b981", borderRadius: 8,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap", gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#10b981" }}>
              🔥 당일 sector-api 스캔
            </div>
            <div style={{ fontSize: 11, color: "#a7f3d0", marginTop: 4 }}>
              {scanTime
                ? `최근 스캔: ${scanTime.toLocaleString("ko-KR")}`
                : "아직 스캔 전"}
              {" · "}
              14:50~15:30 자동 새로고침
            </div>
          </div>
          <button onClick={runTodayScan} disabled={scanning}
            style={{
              background: scanning ? "#475569" : "#10b981",
              color: "#fff", border: "none", borderRadius: 6,
              padding: "10px 20px", fontSize: 14, fontWeight: 700,
              cursor: scanning ? "wait" : "pointer",
            }}>
            {scanning ? "스캔 중..." : "🔍 지금 스캔"}
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

        {/* 6타입 카드 */}
        <div style={{ display: "grid", gap: 16 }}>
          {PATTERN_TYPES.map(t => (
            <TypeCard key={t.id}
              type={t}
              backtest={backtest[t.id]}
              today={todayMatched ? todayMatched[t.id] : null} />
          ))}
        </div>

        <div style={{
          textAlign: "center", color: "#475569", fontSize: 11,
          marginTop: 30, paddingBottom: 20,
        }}>
          데이터: D.pkl {signalsData.length.toLocaleString()}건 (2021.01~2026.04) ·
          오늘: sector-api-pink (KIS API)
        </div>
      </div>
    </div>
  );
}

function TypeCard({ type, backtest, today }) {
  return (
    <div style={{
      padding: 14, background: "#1e293b",
      border: `1px solid ${type.color}`, borderRadius: 8,
    }}>
      {/* 타입 헤더 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{
          display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap",
        }}>
          <span style={{
            fontSize: 18, fontWeight: 800, color: type.color,
          }}>
            TYPE {type.id} · {type.name}
          </span>
          {backtest && backtest.n > 0 && (
            <span style={{ fontSize: 11, color: "#94a3b8" }}>
              백테스트 {backtest.n.toLocaleString()}건 ·
              평균 +{backtest.avg.toFixed(1)}% ·
              +30%={backtest.win30.toFixed(0)}% ·
              +50%={backtest.win50.toFixed(0)}% ·
              음수={backtest.neg.toFixed(0)}%
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
          {type.desc}
        </div>
        <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
          예시: {type.examples}
        </div>
      </div>

      {/* 당일 매칭 종목 */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", marginBottom: 6 }}>
          🎯 오늘 TOP 5 (싱크%순)
        </div>
        {today == null ? (
          <div style={{ fontSize: 11, color: "#64748b", padding: 10 }}>
            스캔 대기 중...
          </div>
        ) : today.length === 0 ? (
          <div style={{ fontSize: 11, color: "#64748b", padding: 10 }}>
            오늘 이 타입 매칭 종목 없음
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ color: "#94a3b8" }}>
                  <th style={th}>#</th>
                  <th style={th}>싱크%</th>
                  <th style={th}>NEO</th>
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
                {today.map((s, i) => (
                  <tr key={s.code} style={{ background: i%2===0 ? "#0f172a" : "transparent" }}>
                    <td style={td}>{i+1}</td>
                    <td style={Object.assign({}, td, {
                      fontWeight: 800,
                      color: s.sync >= 80 ? "#10b981" :
                             s.sync >= 65 ? "#fbbf24" : "#94a3b8",
                    })}>{s.sync}%</td>
                    <td style={Object.assign({}, td, {
                      fontWeight: 700,
                      color: s.grade === "S" ? "#10b981" :
                             s.grade === "A" ? "#fbbf24" :
                             s.grade === "B" ? "#0ea5e9" : "#64748b",
                    })}>{s.grade}</td>
                    <td style={Object.assign({}, td, { fontWeight: 700, color: "#fbbf24" })}>
                      {s.name}
                    </td>
                    <td style={td}>{s.code}</td>
                    <td style={Object.assign({}, td, { color: "#10b981" })}>
                      +{(s.change ?? 0).toFixed(2)}%
                    </td>
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

      {/* 백테스트 최근 사례 (접을 수 있게) */}
      {backtest && backtest.recent && backtest.recent.length > 0 && (
        <details style={{ marginTop: 10 }}>
          <summary style={{
            cursor: "pointer", fontSize: 11, color: "#94a3b8", fontWeight: 700,
          }}>
            📊 과거 매칭 최근 5건 (백테스트 검증)
          </summary>
          <div style={{ marginTop: 6, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ color: "#94a3b8" }}>
                  <th style={th}>날짜</th>
                  <th style={th}>종목</th>
                  <th style={th}>등락</th>
                  <th style={th}>거래대금</th>
                  <th style={th}>수급</th>
                  <th style={th}>60일 최고</th>
                  <th style={th}>도달일</th>
                </tr>
              </thead>
              <tbody>
                {backtest.recent.map((s, i) => (
                  <tr key={i} style={{ background: i%2===0 ? "#0f172a" : "transparent" }}>
                    <td style={td}>{s.date}</td>
                    <td style={Object.assign({}, td, { color: "#fbbf24" })}>{s.name}</td>
                    <td style={Object.assign({}, td, { color: "#10b981" })}>+{s.ch}%</td>
                    <td style={td}>{s.amt}억</td>
                    <td style={td}>{s.iv}</td>
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
        </details>
      )}
    </div>
  );
}

const th = {
  textAlign: "center", padding: "5px 8px", fontSize: 10,
  fontWeight: 600, borderBottom: "1px solid #334155",
};
const td = {
  textAlign: "center", padding: "5px 8px",
  borderBottom: "1px solid #1e293b",
};
