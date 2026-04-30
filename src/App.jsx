// App.jsx — 5타입 패턴 매칭 + 데이트레이딩 백테스트 (TP/SL 시뮬)
//
// 탭:
// 1. 🎯 당일 발굴 — 5타입 × TOP 5 종목, 싱크%순
// 2. 📊 백테스트 — 타입 선택 + TP/SL/매수금액 슬라이더, 결과 즉시
// 3. 📚 패턴 정의 — 5타입 설명 + 사용자 차트 예시

import React, { useState, useEffect, useMemo } from "react";
import signalsData from "./data/signals.json";

const SECTOR_API = "https://sector-api-pink.vercel.app/api";

// 5가지 타입 — 이전 6타입에서 A/D 통합 (둘 다 박스권 돌파라서)
const PATTERN_TYPES = [
  {
    id: 1,
    name: "박스권 돌파",
    short: "박스권",
    desc: "장기 횡보 후 거래대금 폭증 큰 양봉 — 가장 흔한 패턴",
    examples: "풍산, 케이엘넷, NAVER, 쿠콘, POSCO, 한화, 한전KPS, 고영, 나우IB, 넥스틸, 우리기술",
    criteria: { chMin:13, chMax:30, amtMin:300, amtMax:3000, h60:false, h120:false },
    color: "#10b981",
    icon: "📦",
  },
  {
    id: 2,
    name: "V자 반등",
    short: "V반등",
    desc: "1년+ 하락 후 추세 전환 (장기 바닥에서 첫 큰 양봉)",
    examples: "NHN KCP, 카카오, 안랩, 휴스틸, 탑코미디어, 웹케시, 대주산업",
    criteria: { chMin:13, chMax:27, amtMin:200, amtMax:2500, h60:false, h120:false },
    color: "#0ea5e9",
    icon: "🔄",
  },
  {
    id: 3,
    name: "시그널 재현",
    short: "재현",
    desc: "1차 시그널 후 횡보 → 우측에서 같은 시그널 재발생",
    examples: "하이트진로, DSC인베스트, 세명전기, GS글로벌, 에스피지, 유라테크, 대동기어",
    criteria: { chMin:9, chMax:30, amtMin:200, amtMax:2500, h60:false, h120:false, sigsMin:2 },
    color: "#fbbf24",
    icon: "🔁",
  },
  {
    id: 4,
    name: "매물대 돌파",
    short: "매물대",
    desc: "박스권 매물대 정확히 돌파 (저항선 깨짐)",
    examples: "명신산업 (대표 사례), 박스권 위 거래대금 폭증",
    criteria: { chMin:13, chMax:25, amtMin:300, amtMax:2500, h60:false, h120:false },
    color: "#ec4899",
    icon: "🚀",
  },
  {
    id: 5,
    name: "정배열 추세",
    short: "추세",
    desc: "이미 정배열 상승 중인 강한 추세주 + 단기 조정 후 재돌파",
    examples: "현대엘리베이터, 레인보우로보틱스, 한화오션, 삼성카드, 두산에너빌리티",
    criteria: { chMin:7, chMax:17, amtMin:500, amtMax:99999, h60:true },
    color: "#a855f7",
    icon: "📈",
  },
];

// 매칭 (boolean) — 검증된 데이터(verify) 우선
function matchType(s, c, typeId) {
  const ch = s.ch ?? s.change ?? 0;
  const amt = s.amt ?? s.amount ?? 0;
  if (ch < c.chMin || ch > c.chMax) return false;
  if (amt < c.amtMin || amt > c.amtMax) return false;

  // 검증 안 됐으면 (verify 없음) → null로 처리, 통과 (점진적 표시)
  // 검증됐으면 정확한 판정
  if (s.verify) {
    // 타입별 정확한 매칭
    if (typeId === 1) {
      // 박스권 돌파: 박스권이어야 함
      if (!s.isBox) return false;
    } else if (typeId === 2) {
      // V자 반등: 60일 평균 아래에서 반등
      if (!s.isVRev) return false;
    } else if (typeId === 4) {
      // 매물대 돌파: 박스 상단 돌파
      if (!s.isBreakout) return false;
    } else if (typeId === 5) {
      // 정배열 추세: h60=true 필수
      if (!s.isUptrend) return false;
    }
    // TYPE 3 (시그널 재현) — sigsMin 검증
    if (c.sigsMin != null && s.sigs < c.sigsMin) return false;
  }
  return true;
}

// 싱크% 상세 (0~100, 항목별 점수 반환)
function calcSyncDetail(s, c) {
  const ch = s.ch ?? s.change ?? 0;
  const amt = s.amt ?? s.amount ?? 0;
  const inv = s.iv ?? s.investor ?? "";
  const wick = s.wick;

  // 1. 등락률 (30점) — 중심값 가까울수록
  const chMid = (c.chMin + c.chMax) / 2;
  const chRange = (c.chMax - c.chMin) / 2;
  const chDist = Math.abs(ch - chMid);
  const chScore = Math.max(0, 30 * (1 - chDist / chRange));

  // 2. 거래대금 (25점) — log scale
  const amtMid = Math.sqrt(c.amtMin * Math.min(c.amtMax, 5000));
  const amtScore = amt > 0
    ? Math.min(25, Math.max(0, 25 * (1 - Math.abs(Math.log(amt/amtMid)) / 1.5)))
    : 0;

  // 3. 수급 (25점)
  let invScore = 0;
  if (inv === "기+외" || inv === "기관+외인") invScore = 25;
  else if (inv === "외인" || inv === "외만") invScore = 18;
  else if (inv === "기관" || inv === "기만") invScore = 10;

  // 4. 윗꼬리 (20점)
  let wickScore = 10;  // 모름 = 중립
  if (wick != null) {
    if (wick <= 1) wickScore = 20;
    else if (wick <= 3) wickScore = 15;
    else if (wick <= 5) wickScore = 10;
    else if (wick <= 10) wickScore = 5;
    else wickScore = 0;
  }

  return {
    ch: Math.round(chScore),
    amt: Math.round(amtScore),
    inv: invScore,
    wick: wickScore,
    total: Math.round((chScore + amtScore + invScore + wickScore)),
  };
}

// daily-price 호출 → 60일/120일 신고가 + 박스권 검증
async function fetchVerify(code) {
  try {
    // 130일 일봉 받기 (충분히 많이)
    const today = new Date();
    const from = new Date(today.getTime() - 200 * 24 * 60 * 60 * 1000);
    const fmt = d => d.getFullYear() + String(d.getMonth()+1).padStart(2,"0") + String(d.getDate()).padStart(2,"0");
    const url = `${SECTOR_API}/daily-price?code=${code}&from=${fmt(from)}&to=${fmt(today)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.ok || !data.output || data.output.length < 30) return null;

    // KIS 응답: 최신순 정렬 (output[0] = 가장 최근)
    const rows = data.output;
    const todayClose = rows[0].close;

    // 오늘 봉 제외한 과거 60/120일 최고가 (돌파 판정용)
    const past60 = rows.slice(1, 61);
    const past120 = rows.slice(1, 121);
    if (past60.length < 30) return null;

    const high60 = Math.max(...past60.map(r => r.high));
    const high120 = past120.length >= 60
      ? Math.max(...past120.map(r => r.high))
      : high60;
    const low60 = Math.min(...past60.map(r => r.low));

    // 60일 변동폭 (박스권 판정)
    const range60 = (high60 - low60) / low60;

    // h60/h120 (오늘 종가가 과거 신고가 근처인지)
    const h60 = todayClose >= high60 * 0.97;
    const h120 = todayClose >= high120 * 0.97;

    // 박스권 = 변동폭 작고 + 오늘 진입가가 박스 상단 돌파 ~ 박스 안
    const isBox = range60 < 0.45;

    // 매물대 돌파 = 박스권 + 진입가가 60일 최고가 근처~돌파
    const isBreakout = isBox && todayClose >= high60 * 0.93;

    // 정배열 = h60 신고가 + 진입가 > 60일 평균
    const avg60 = past60.reduce((s,r)=>s+r.close, 0) / past60.length;
    const isUptrend = h60 && todayClose > avg60 * 1.05;

    // V자 반등 = 60일 평균보다 낮은 곳 + 진입가가 60일 평균 미만에서 반등
    const isVRev = !h60 && !h120 && todayClose < avg60 * 0.95;

    // 시그널 빈도 (60일내 +10% 이상 양봉 횟수)
    const sigsCount = past60.filter(r => r.rate >= 10).length;

    return {
      h60, h120, isBox, isBreakout, isUptrend, isVRev,
      sigs: sigsCount,
      range60: +(range60 * 100).toFixed(1),
      high60, low60, avg60: Math.round(avg60),
      todayClose,
    };
  } catch (e) {
    return null;
  }
}

// sector-api → 매칭용 시그널 (박스권 검증 데이터 포함)
function toSig(s, verify) {
  return {
    name: s.name, code: s.code, market: s.market, grade: s.grade,
    ch: s.change ?? 0, amt: s.amount ?? 0,
    iv: s.investor === "기+외" ? "기+외" :
        s.investor === "외인" ? "외만" :
        s.investor === "기관" ? "기만" : "둘다-",
    investor: s.investor,
    // 검증된 데이터 (없으면 null)
    h60: verify ? verify.h60 : null,
    h120: verify ? verify.h120 : null,
    isBox: verify ? verify.isBox : null,
    isBreakout: verify ? verify.isBreakout : null,
    isUptrend: verify ? verify.isUptrend : null,
    isVRev: verify ? verify.isVRev : null,
    sigs: verify ? verify.sigs : 5,
    verify,  // 원본 보관
    wick: s.wick ?? 5,
  };
}

export default function App() {
  const [tab, setTab] = useState("today");
  const [selectedSig, setSelectedSig] = useState(null);  // 모달용

  // 당일 시그널
  const [todayAll, setTodayAll] = useState(null);
  const [verifyMap, setVerifyMap] = useState({});  // {code: {h60, h120, box, ...}}
  const [scanning, setScanning] = useState(false);
  const [verifying, setVerifying] = useState(0);   // 0~100 검증 진행률
  const [scanError, setScanError] = useState(null);
  const [scanTime, setScanTime] = useState(null);

  async function runScan() {
    setScanning(true);
    setScanError(null);
    setVerifyMap({});
    setVerifying(0);
    try {
      const res = await fetch(SECTOR_API + "/screening");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "API 에러");
      const all = data.all || [];
      setTodayAll(all);
      setScanTime(new Date());

      // 박스권 검증 (백그라운드, 점진적)
      // 시그널 점수 6+ 종목만 (불필요한 호출 방지)
      const targets = all.filter(s => (s.score || 0) >= 6);
      if (targets.length === 0) return;

      const results = {};
      let done = 0;
      // 병렬 호출 (5개씩 배치)
      const BATCH = 5;
      for (let i = 0; i < targets.length; i += BATCH) {
        const batch = targets.slice(i, i + BATCH);
        await Promise.all(batch.map(async s => {
          const v = await fetchVerify(s.code);
          if (v) results[s.code] = v;
          done++;
          setVerifying(Math.round(done / targets.length * 100));
        }));
        setVerifyMap({ ...results });
      }
    } catch (e) {
      setScanError(e.message);
    } finally {
      setScanning(false);
    }
  }

  useEffect(() => {
    runScan();
    const id = setInterval(() => {
      const now = new Date();
      const h = now.getHours(), m = now.getMinutes();
      if ((h === 14 && m >= 50) || (h === 15 && m <= 30)) runScan();
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      minHeight:"100vh", background:"#0f172a", color:"#e2e8f0",
      fontFamily:"-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', sans-serif",
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "12px 12px 80px" }}>
        {/* 헤더 */}
        <div style={{ marginBottom: 14 }}>
          <h1 style={{
            margin: 0, fontSize: "clamp(18px, 5vw, 24px)",
            fontWeight: 800, color: "#10b981",
          }}>
            🎯 차트 패턴 매칭 (데이트레이딩)
          </h1>
          <p style={{
            margin: "4px 0 0", fontSize: "clamp(11px, 3vw, 13px)",
            color: "#94a3b8",
          }}>
            44장 분석 → 5타입 · D.pkl {signalsData.length.toLocaleString()}건 백테스트
          </p>
        </div>

        {/* 탭 */}
        <div style={{
          display: "flex", gap: 4, marginBottom: 12,
          background: "#1e293b", borderRadius: 8, padding: 4,
        }}>
          <TabBtn active={tab==="today"} onClick={() => setTab("today")}>
            🎯 당일 발굴
          </TabBtn>
          <TabBtn active={tab==="bt"} onClick={() => setTab("bt")}>
            📊 백테스트
          </TabBtn>
          <TabBtn active={tab==="def"} onClick={() => setTab("def")}>
            📚 타입 정의
          </TabBtn>
        </div>

        {/* 탭 내용 */}
        {tab === "today" && (
          <TodayTab
            todayAll={todayAll} verifyMap={verifyMap}
            scanning={scanning} verifying={verifying}
            scanError={scanError}
            scanTime={scanTime} onScan={runScan}
            onClickSig={setSelectedSig} />
        )}
        {tab === "bt" && <BacktestTab />}
        {tab === "def" && <DefinitionsTab />}

        {/* 푸터 */}
        <div style={{
          textAlign:"center", color:"#475569", fontSize: 11,
          marginTop: 24,
        }}>
          D.pkl {signalsData.length.toLocaleString()}건 (2021.01~2026.04) ·
          KIS via sector-api-pink
        </div>
      </div>

      {/* 싱크 상세 모달 */}
      {selectedSig && (
        <SyncDetailModal sig={selectedSig} onClose={() => setSelectedSig(null)} />
      )}
    </div>
  );
}

// ───── 탭: 당일 발굴 ─────
function TodayTab({ todayAll, verifyMap, scanning, verifying, scanError, scanTime, onScan, onClickSig }) {
  const matched = useMemo(() => {
    if (!todayAll) return null;
    const out = {};
    for (const t of PATTERN_TYPES) {
      const list = todayAll
        .map(s => {
          const v = verifyMap[s.code];  // 검증된 데이터 (있으면)
          const sig = toSig(s, v);
          if (!matchType(sig, t.criteria, t.id)) return null;
          const sync = calcSyncDetail(sig, t.criteria);
          return { ...sig, raw: s, sync, type: t };
        })
        .filter(Boolean)
        .sort((a, b) => b.sync.total - a.sync.total)
        .slice(0, 5);
      out[t.id] = list;
    }
    return out;
  }, [todayAll, verifyMap]);

  const verifyCount = Object.keys(verifyMap).length;
  const targetCount = todayAll ? todayAll.filter(s => (s.score||0) >= 6).length : 0;

  return (
    <div>
      {/* 스캔 카드 */}
      <div style={{
        marginBottom: 12, padding: 12,
        background: "linear-gradient(to right, #064e3b, #134e4a)",
        border: "1px solid #10b981", borderRadius: 10,
        display: "flex", justifyContent: "space-between",
        alignItems: "center", gap: 10, flexWrap: "wrap",
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#10b981" }}>
            🔥 sector-api 당일 스캔
          </div>
          <div style={{ fontSize: 11, color: "#a7f3d0", marginTop: 2 }}>
            {scanTime ? scanTime.toLocaleString("ko-KR") : "스캔 전"} ·
            14:50~15:30 자동
          </div>
        </div>
        <button onClick={onScan} disabled={scanning}
          style={{
            background: scanning ? "#475569" : "#10b981",
            color: "#fff", border: "none", borderRadius: 8,
            padding: "10px 18px", fontSize: 14, fontWeight: 700,
            cursor: scanning ? "wait" : "pointer", whiteSpace: "nowrap",
          }}>
          {scanning ? "..." : "🔍 스캔"}
        </button>
      </div>

      {scanError && (
        <div style={{
          marginBottom: 12, padding: 12, background: "#7f1d1d",
          border: "1px solid #ef4444", borderRadius: 8,
          color: "#fecaca", fontSize: 13,
        }}>
          ⚠️ {scanError}
        </div>
      )}

      {/* 박스권 검증 진행률 */}
      {todayAll && targetCount > 0 && verifying < 100 && (
        <div style={{
          marginBottom: 12, padding: 10, background: "#1e293b",
          border: "1px solid #475569", borderRadius: 8,
        }}>
          <div style={{
            fontSize: 12, color: "#fbbf24", marginBottom: 6,
            display: "flex", justifyContent: "space-between",
          }}>
            <span>🔬 박스권 / 신고가 검증 중...</span>
            <span>{verifyCount}/{targetCount}</span>
          </div>
          <div style={{
            height: 6, background: "#0f172a", borderRadius: 3, overflow: "hidden",
          }}>
            <div style={{
              width: `${verifying}%`, height: "100%",
              background: "#fbbf24", transition: "width 0.3s",
            }} />
          </div>
        </div>
      )}

      {/* 5타입 카드 */}
      <div style={{ display: "grid", gap: 12 }}>
        {PATTERN_TYPES.map(t => (
          <TodayTypeCard key={t.id}
            type={t}
            matched={matched ? matched[t.id] : null}
            onClickSig={onClickSig} />
        ))}
      </div>
    </div>
  );
}

function TodayTypeCard({ type, matched, onClickSig }) {
  return (
    <div style={{
      padding: 12, background: "#1e293b",
      border: `2px solid ${type.color}`, borderRadius: 10,
    }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{
          fontSize: 16, fontWeight: 800, color: type.color,
        }}>
          {type.icon} TYPE {type.id} · {type.name}
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
          {type.desc}
        </div>
      </div>

      {matched == null ? (
        <div style={{ padding: 14, fontSize: 13, color: "#64748b" }}>
          스캔 대기 중...
        </div>
      ) : matched.length === 0 ? (
        <div style={{ padding: 14, fontSize: 13, color: "#64748b" }}>
          오늘 매칭 종목 없음
        </div>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {matched.map((s, i) => (
            <SigRow key={s.code} sig={s} rank={i+1} onClick={() => onClickSig(s)} />
          ))}
        </div>
      )}
    </div>
  );
}

function SigRow({ sig, rank, onClick }) {
  const sync = sig.sync.total;
  const syncColor = sync >= 80 ? "#10b981" : sync >= 65 ? "#fbbf24" : "#94a3b8";
  
  // 검증 뱃지
  const badges = [];
  if (sig.verify) {
    if (sig.isBox) badges.push({ text: "📦 박스권", color: "#10b981" });
    if (sig.isBreakout) badges.push({ text: "🚀 돌파", color: "#ec4899" });
    if (sig.isUptrend) badges.push({ text: "📈 정배열", color: "#a855f7" });
    if (sig.isVRev) badges.push({ text: "🔄 V반등", color: "#0ea5e9" });
    if (sig.h60 && !sig.isUptrend) badges.push({ text: "60일 고가", color: "#fbbf24" });
  } else {
    badges.push({ text: "⏳ 검증 중", color: "#64748b" });
  }
  
  return (
    <div onClick={onClick}
      style={{
        padding: "10px 12px", background: "#0f172a",
        border: "1px solid #334155", borderRadius: 8,
        cursor: "pointer",
        display: "flex", justifyContent: "space-between",
        alignItems: "center", gap: 8,
      }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 11, color: "#64748b" }}>#{rank}</span>
          <span style={{
            fontSize: 16, fontWeight: 800, color: "#fbbf24",
          }}>
            {sig.name}
          </span>
          <span style={{ fontSize: 11, color: "#64748b" }}>{sig.code}</span>
          <span style={{
            fontSize: 11, color: "#fff",
            background: sig.grade === "S" ? "#10b981" :
                        sig.grade === "A" ? "#fbbf24" :
                        sig.grade === "B" ? "#0ea5e9" : "#64748b",
            padding: "1px 6px", borderRadius: 4, fontWeight: 800,
          }}>
            {sig.grade}
          </span>
        </div>
        <div style={{
          fontSize: 12, color: "#94a3b8", marginTop: 4,
          display: "flex", gap: 10, flexWrap: "wrap",
        }}>
          <span style={{ color: "#10b981", fontWeight: 700 }}>
            +{sig.ch.toFixed(2)}%
          </span>
          <span>{sig.amt}억</span>
          <span style={{
            color: sig.iv === "기+외" ? "#10b981" :
                   sig.iv === "외만" ? "#0ea5e9" : "#94a3b8",
          }}>
            {sig.investor || sig.iv}
          </span>
          <span style={{ color: "#64748b" }}>윗꼬리 {sig.wick}%</span>
        </div>
        {/* 검증 뱃지 */}
        <div style={{
          display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap",
        }}>
          {badges.map((b, i) => (
            <span key={i} style={{
              fontSize: 10, color: b.color,
              border: `1px solid ${b.color}`, borderRadius: 3,
              padding: "1px 5px", fontWeight: 700,
            }}>
              {b.text}
            </span>
          ))}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{
          fontSize: 22, fontWeight: 800, color: syncColor,
        }}>
          {sync}%
        </div>
        <div style={{ fontSize: 9, color: "#64748b" }}>tap →</div>
      </div>
    </div>
  );
}

// ───── 탭: 백테스트 (TP/SL 시뮬) ─────
function BacktestTab() {
  const [typeId, setTypeId] = useState(1);
  const [tp, setTp] = useState(7);     // TP %
  const [sl, setSl] = useState(3);     // SL %
  const [budget, setBudget] = useState(300);  // 만원
  const [holdMax, setHoldMax] = useState(20); // 최대 보유일

  const type = PATTERN_TYPES.find(t => t.id === typeId);

  const result = useMemo(() => {
    // 매칭 시그널
    const matched = signalsData.filter(s => matchType(s, type.criteria));
    if (matched.length === 0) return null;

    // 각 시그널마다 TP/SL 시뮬
    let win = 0, loss = 0, timeout = 0;
    let totalGain = 0;          // % 합 (단순 산술 평균용)
    let totalDays = 0;
    const winDays = [];
    const lossDays = [];
    const allOutcomes = [];     // 최근 사례용

    for (const s of matched) {
      // TP/SL 도달 일수 — 보간 (3,5,7,10,15,20,30,50)
      const tpKey = `tp${tp}`;
      const slKey = `sl${sl}`;
      let tpDay = s[tpKey];      // 없으면 가장 가까운 값 보간
      if (tpDay === undefined) {
        const tpKeys = [3,5,7,10,15,20,30,50];
        const above = tpKeys.find(k => k >= tp);
        tpDay = above ? s[`tp${above}`] : -1;
      }
      let slDay = s[slKey];
      if (slDay === undefined) {
        const slKeys = [2,3,5,7,10,15];
        const above = slKeys.find(k => k >= sl);
        slDay = above ? s[`sl${above}`] : -1;
      }
      if (tpDay == null) tpDay = -1;
      if (slDay == null) slDay = -1;

      // 보유 기간 제한
      if (tpDay > holdMax) tpDay = -1;
      if (slDay > holdMax) slDay = -1;

      let outcome, gain, days;
      if (tpDay > 0 && (slDay < 0 || tpDay <= slDay)) {
        // TP 먼저 도달
        outcome = "TP";
        gain = tp;
        days = tpDay;
        win++;
        winDays.push(days);
      } else if (slDay > 0) {
        // SL 먼저 도달
        outcome = "SL";
        gain = -sl;
        days = slDay;
        loss++;
        lossDays.push(days);
      } else {
        // 타임아웃 — holdMax일째 종가
        outcome = "TO";
        const holdN = Math.min(holdMax, 20);
        const closeKey = holdN >= 20 ? "c20" : holdN >= 10 ? "c10" : holdN >= 5 ? "c5" : "c3";
        gain = s[closeKey] ?? 0;
        days = holdN;
        timeout++;
      }

      totalGain += gain;
      totalDays += days;
      allOutcomes.push({
        ...s, outcome, gain: +gain.toFixed(2), days
      });
    }

    const n = matched.length;
    const winRate = win/n*100;
    const avgGain = totalGain/n;
    const avgDays = totalDays/n;

    // 매수금액 기준 수익금
    const budgetWon = budget * 10000;  // 만원 → 원
    const profitPerTrade = budgetWon * avgGain / 100;
    const totalProfit = profitPerTrade * n;
    
    // 연도별 통계
    const byYr = {};
    for (const o of allOutcomes) {
      const yy = "20" + o.date.slice(0, 2);
      if (!byYr[yy]) byYr[yy] = { n:0, win:0, sumGain:0 };
      byYr[yy].n++;
      if (o.outcome === "TP") byYr[yy].win++;
      byYr[yy].sumGain += o.gain;
    }

    return {
      n, win, loss, timeout,
      winRate,
      lossRate: loss/n*100,
      toRate: timeout/n*100,
      avgGain, avgDays,
      avgWinDays: winDays.length ? winDays.reduce((a,b)=>a+b,0)/winDays.length : 0,
      avgLossDays: lossDays.length ? lossDays.reduce((a,b)=>a+b,0)/lossDays.length : 0,
      profitPerTrade, totalProfit,
      byYr,
      recent: allOutcomes
        .sort((a,b) => b.date.localeCompare(a.date))
        .slice(0, 10),
    };
  }, [typeId, tp, sl, holdMax]);

  return (
    <div>
      {/* 타입 선택 */}
      <div style={{
        background:"#1e293b", border:"1px solid #334155",
        borderRadius:10, padding:12, marginBottom:12,
      }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#fbbf24", marginBottom:8 }}>
          타입 선택
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {PATTERN_TYPES.map(t => (
            <button key={t.id} onClick={() => setTypeId(t.id)}
              style={{
                background: typeId===t.id ? t.color : "#0f172a",
                color: typeId===t.id ? "#fff" : "#cbd5e1",
                border: `1px solid ${typeId===t.id ? t.color : "#334155"}`,
                borderRadius: 6, padding: "8px 12px",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>
              {t.icon} {t.short}
            </button>
          ))}
        </div>
      </div>

      {/* 슬라이더 */}
      <div style={{
        background:"#1e293b", border:"1px solid #334155",
        borderRadius:10, padding:14, marginBottom:12,
      }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#fbbf24", marginBottom:10 }}>
          매매 조건 ({type.icon} {type.name})
        </div>
        <SliderRow label="🎯 TP (익절 %)" value={tp}
          options={[3, 5, 7, 10, 15, 20, 30]} onChange={setTp} unit="%" color="#10b981" />
        <SliderRow label="🛑 SL (손절 %)" value={sl}
          options={[2, 3, 5, 7, 10]} onChange={setSl} unit="%" color="#ef4444" />
        <SliderRow label="⏰ 최대 보유" value={holdMax}
          options={[3, 5, 10, 20, 60]} onChange={setHoldMax} unit="일" color="#0ea5e9" />
        <SliderRow label="💰 매수금액" value={budget}
          options={[100, 200, 300, 500, 1000]} onChange={setBudget} unit="만원" color="#fbbf24" />
      </div>

      {/* 결과 */}
      {result && (
        <BacktestResults result={result} type={type} tp={tp} sl={sl} budget={budget} />
      )}
    </div>
  );
}

function SliderRow({ label, value, options, onChange, unit, color }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        display:"flex", justifyContent:"space-between", marginBottom: 4,
        fontSize: 12, color: "#cbd5e1",
      }}>
        <span>{label}</span>
        <span style={{ color, fontWeight: 800, fontSize: 14 }}>
          {value}{unit}
        </span>
      </div>
      <div style={{
        display:"flex", gap: 6, flexWrap: "wrap",
      }}>
        {options.map(opt => (
          <button key={opt} onClick={() => onChange(opt)}
            style={{
              flex: 1, minWidth: 50,
              background: value===opt ? color : "#0f172a",
              color: value===opt ? "#fff" : "#94a3b8",
              border: `1px solid ${value===opt ? color : "#334155"}`,
              borderRadius: 6, padding: "8px 10px",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>
            {opt}{unit}
          </button>
        ))}
      </div>
    </div>
  );
}

function BacktestResults({ result, type, tp, sl, budget }) {
  const expVal = result.avgGain;
  const ev = expVal >= 0 ? "#10b981" : "#ef4444";
  
  return (
    <div style={{
      background:"#1e293b", border:`2px solid ${type.color}`,
      borderRadius:10, padding:14,
    }}>
      <div style={{ fontSize:14, fontWeight:800, color: type.color, marginBottom:10 }}>
        📊 백테스트 결과 — TP+{tp}% / SL-{sl}% / {budget}만원
      </div>

      {/* 핵심 KPI */}
      <div style={{
        display:"grid",
        gridTemplateColumns:"repeat(auto-fit, minmax(110px, 1fr))",
        gap: 8, marginBottom: 14,
      }}>
        <Kpi label="매칭 시그널" value={result.n.toLocaleString() + "건"} color="#fbbf24" />
        <Kpi label="승률 (TP)" value={result.winRate.toFixed(1) + "%"}
             sub={result.win.toLocaleString() + "건"} color="#10b981" />
        <Kpi label="패배 (SL)" value={result.lossRate.toFixed(1) + "%"}
             sub={result.loss.toLocaleString() + "건"} color="#ef4444" />
        <Kpi label="타임아웃" value={result.toRate.toFixed(1) + "%"}
             sub={result.timeout.toLocaleString() + "건"} color="#94a3b8" />
        <Kpi label="기댓값/거래" value={(expVal >= 0 ? "+" : "") + expVal.toFixed(2) + "%"} color={ev} />
        <Kpi label="평균 보유" value={result.avgDays.toFixed(1) + "일"} color="#0ea5e9" />
      </div>

      {/* 자금 시뮬 */}
      <div style={{
        padding: 12, background:"#0f172a", borderRadius: 8, marginBottom: 12,
      }}>
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>
          💰 {budget}만원 매수 기준
        </div>
        <div style={{ display: "grid", gridTemplateColumns:"1fr 1fr", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color:"#64748b" }}>거래당 기대수익</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: ev }}>
              {result.profitPerTrade >= 0 ? "+" : ""}
              {Math.round(result.profitPerTrade).toLocaleString()}원
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color:"#64748b" }}>{result.n}건 누적</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: ev }}>
              {result.totalProfit >= 0 ? "+" : ""}
              {Math.round(result.totalProfit/10000).toLocaleString()}만원
            </div>
          </div>
        </div>
      </div>

      {/* 보유기간 상세 */}
      <div style={{
        padding: 10, background:"#0f172a", borderRadius: 8, marginBottom: 12,
        fontSize: 12, color: "#94a3b8",
      }}>
        ⏰ TP 도달 평균 <b style={{color:"#10b981"}}>{result.avgWinDays.toFixed(1)}일</b> ·
        SL 도달 평균 <b style={{color:"#ef4444"}}>{result.avgLossDays.toFixed(1)}일</b>
      </div>

      {/* 연도별 */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>📅 연도별 승률</div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
          gap: 6,
        }}>
          {Object.keys(result.byYr).sort().map(y => {
            const b = result.byYr[y];
            return (
              <div key={y} style={{
                background:"#0f172a", border:"1px solid #334155",
                borderRadius: 6, padding: 8, fontSize: 11,
              }}>
                <div style={{ color:"#fbbf24", fontWeight: 700 }}>{y}</div>
                <div style={{ color:"#fff" }}>
                  {b.n}건 · 승률 {(b.win/b.n*100).toFixed(0)}%
                </div>
                <div style={{
                  color: b.sumGain/b.n >= 0 ? "#10b981" : "#ef4444",
                  fontSize: 10,
                }}>
                  EV {b.sumGain/b.n >= 0 ? "+" : ""}{(b.sumGain/b.n).toFixed(2)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 최근 매칭 사례 */}
      <details>
        <summary style={{
          fontSize:12, color:"#94a3b8", cursor:"pointer", fontWeight: 700,
        }}>
          📋 최근 매칭 시그널 10건 보기
        </summary>
        <div style={{ marginTop: 8, overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "#94a3b8" }}>
                <th style={th}>날짜</th>
                <th style={th}>종목</th>
                <th style={th}>등락</th>
                <th style={th}>거래대금</th>
                <th style={th}>결과</th>
                <th style={th}>수익</th>
                <th style={th}>일</th>
              </tr>
            </thead>
            <tbody>
              {result.recent.map((s, i) => (
                <tr key={i} style={{ background: i%2===0?"#0f172a":"transparent" }}>
                  <td style={td}>{s.date}</td>
                  <td style={Object.assign({},td,{color:"#fbbf24",fontWeight:700})}>{s.name}</td>
                  <td style={Object.assign({},td,{color:"#10b981"})}>+{s.ch}%</td>
                  <td style={td}>{s.amt}억</td>
                  <td style={Object.assign({},td,{
                    color: s.outcome==="TP" ? "#10b981" :
                           s.outcome==="SL" ? "#ef4444" : "#94a3b8",
                    fontWeight: 700,
                  })}>
                    {s.outcome}
                  </td>
                  <td style={Object.assign({},td,{
                    fontWeight: 700,
                    color: s.gain >= 0 ? "#10b981" : "#ef4444",
                  })}>
                    {s.gain >= 0 ? "+" : ""}{s.gain}%
                  </td>
                  <td style={td}>{s.days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

// ───── 탭: 타입 정의 ─────
// 차트 정보 → 5타입 매칭% + 사유 (사용자 입력 기반)
function matchAllTypes(input) {
  return PATTERN_TYPES.map(t => {
    const c = t.criteria;
    const reasons = [];
    let score = 0;

    // 1. 등락률 (30점)
    if (input.ch >= c.chMin && input.ch <= c.chMax) {
      score += 30;
      reasons.push({ ok: true, text: `등락률 +${input.ch}% (범위 +${c.chMin}~${c.chMax}%) ✓` });
    } else {
      const dist = Math.min(
        Math.abs(input.ch - c.chMin),
        Math.abs(input.ch - c.chMax)
      );
      const partial = Math.max(0, 30 * (1 - dist / 10));
      score += partial;
      reasons.push({
        ok: false,
        text: `등락률 +${input.ch}% (범위 +${c.chMin}~${c.chMax}% 벗어남) ✗`,
      });
    }

    // 2. 거래대금 (25점)
    if (input.amt >= c.amtMin && input.amt <= c.amtMax) {
      score += 25;
      reasons.push({ ok: true, text: `거래대금 ${input.amt}억 (범위 ${c.amtMin}~${c.amtMax === 99999 ? "무제한" : c.amtMax+"억"}) ✓` });
    } else if (input.amt > 0) {
      const ratio = input.amt < c.amtMin
        ? input.amt / c.amtMin
        : (c.amtMax === 99999 ? 1 : c.amtMax / input.amt);
      score += 25 * Math.max(0, ratio);
      reasons.push({
        ok: false,
        text: `거래대금 ${input.amt}억 (범위 ${c.amtMin}~${c.amtMax === 99999 ? "무제한" : c.amtMax+"억"} 벗어남) ✗`,
      });
    }

    // 3. 60일 신고가 (15점)
    if (c.h60 === true) {
      if (input.h60) {
        score += 15;
        reasons.push({ ok: true, text: `60일 신고가 갱신 (필수) ✓` });
      } else {
        reasons.push({ ok: false, text: `60일 신고가 미갱신 (필수인데) ✗` });
      }
    } else if (c.h60 === false) {
      if (!input.h60) {
        score += 15;
        reasons.push({ ok: true, text: `60일 신고가 X (박스권/하락) ✓` });
      } else {
        reasons.push({ ok: false, text: `60일 신고가 갱신 (박스권 X) ✗` });
      }
    } else {
      score += 7;  // 무관 (절반)
    }

    // 4. 120일 신고가 (10점)
    if (c.h120 === false && !input.h120) {
      score += 10;
      reasons.push({ ok: true, text: `120일 신고가 X (장기 횡보/하락) ✓` });
    } else if (c.h120 === false && input.h120) {
      reasons.push({ ok: false, text: `120일 신고가 갱신 (장기 추세) ✗` });
    } else {
      score += 5;
    }

    // 5. 시그널 빈도 (10점)
    if (c.sigsMin != null) {
      if (input.sigs >= c.sigsMin) {
        score += 10;
        reasons.push({ ok: true, text: `시그널 ${input.sigs}회 (${c.sigsMin}회+ 필수) ✓` });
      } else {
        reasons.push({ ok: false, text: `시그널 ${input.sigs}회 (${c.sigsMin}회+ 필요) ✗` });
      }
    } else {
      score += 5;
    }

    // 6. 수급 (10점)
    if (input.iv === "기+외") {
      score += 10;
      reasons.push({ ok: true, text: `수급 기+외 쌍매수 (최강) ✓` });
    } else if (input.iv === "외만") {
      score += 7;
      reasons.push({ ok: true, text: `수급 외인 매수 (양호)` });
    } else if (input.iv === "기만") {
      score += 4;
      reasons.push({ ok: false, text: `수급 기관만 (약함)` });
    } else {
      reasons.push({ ok: false, text: `수급 약함 ✗` });
    }

    return {
      typeId: t.id, type: t,
      match: Math.round(score),
      reasons,
    };
  }).sort((a, b) => b.match - a.match);
}

function DefinitionsTab() {
  // 사용자 추가 차트 (window.storage)
  const [userPatterns, setUserPatterns] = useState({});

  // 업로드 입력 상태
  const [imgB64, setImgB64] = useState("");
  const [imgFile, setImgFile] = useState(null);
  const [stockName, setStockName] = useState("");
  const [ch, setCh] = useState(15);
  const [amt, setAmt] = useState(800);
  const [h60, setH60] = useState(false);
  const [h120, setH120] = useState(false);
  const [sigs, setSigs] = useState(2);
  const [wick, setWick] = useState(2);
  const [iv, setIv] = useState("기+외");

  const [results, setResults] = useState(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);  // AI 분석 요약

  // window.storage 로드
  useEffect(() => {
    if (typeof window === "undefined" || !window.storage) return;
    (async () => {
      try {
        const list = await window.storage.list("upat:");
        if (!list || !list.keys) return;
        const out = {};
        for (const k of list.keys) {
          try {
            const r = await window.storage.get(k);
            if (r) {
              const p = JSON.parse(r.value);
              if (!out[p.typeId]) out[p.typeId] = [];
              out[p.typeId].push({ ...p, key: k });
            }
          } catch (e) {}
        }
        setUserPatterns(out);
      } catch (e) {}
    })();
  }, []);

  function onFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setImgFile(f);
    const r = new FileReader();
    r.onload = (ev) => setImgB64(ev.target.result);
    r.readAsDataURL(f);
  }

  // 🔥 AI 자동 분석 (analyze.js → Anthropic Vision)
  async function aiAnalyze() {
    if (!imgB64) {
      alert("먼저 차트 이미지를 업로드하세요");
      return;
    }
    setAiAnalyzing(true);
    setAiError(null);
    setAiSummary(null);
    setResults(null);

    try {
      // base64에서 헤더 분리
      const m = imgB64.match(/^data:(image\/[a-z]+);base64,(.+)$/);
      if (!m) throw new Error("이미지 형식 오류");
      const mediaType = m[1];
      const data = m[2];

      const prompt = `이 한국 주식 일봉 차트를 분석해서 JSON으로만 답하세요. 마크다운 없이 순수 JSON만.

차트는 일봉 차트입니다. 가장 우측의 큰 양봉(빨간 봉)이 시그널입니다.

다음 정보 추출:
- ch: 시그널 양봉의 등락률 % (예: 16.67)
- amt: 시그널 일자 거래대금 (억 단위, 화면 하단 거래대금 막대 보고 추정)
- h60: 시그널 직전 60일 동안 최고가를 갱신했는지 (true/false)
- h120: 시그널 직전 120일 동안 최고가를 갱신했는지 (true/false)
- box: 박스권 차트인지 (가격이 좁은 범위에서 횡보. true/false)
- box_months: 박스권 기간 (개월수, 박스권이 아니면 0)
- left_signal: 좌측에 비슷한 큰 양봉 시그널이 있는지 (true/false)
- left_signal_count: 좌측 시그널 횟수 (없으면 0)
- vrev: V자 반등인지 (1년+ 하락 후 반등)
- breakout: 박스권 매물대를 정확히 돌파했는지
- iv: 수급 추정 ("기+외", "외만", "기만", "둘다-" 중 하나, 차트만으론 모를 수 있으니 거래대금 폭증이면 "기+외"로 추정)
- wick: 윗꼬리 % (시그널 봉의 (고가-종가)/시가 * 100)
- description: 차트 한 줄 설명 (예: "11개월 박스권 후 거래대금 30배 폭증 양봉")

JSON 예:
{"ch":16.67,"amt":1108,"h60":false,"h120":false,"box":true,"box_months":11,"left_signal":false,"left_signal_count":0,"vrev":false,"breakout":true,"iv":"기+외","wick":2,"description":"11개월 박스권 후 거래대금 30배 폭증 양봉"}`;

      const res = await fetch(SECTOR_API + "/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data } },
              { type: "text", text: prompt },
            ],
          }],
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      // 응답에서 JSON 추출
      const text = (json.content || []).filter(c => c.type === "text")
        .map(c => c.text).join("");
      let parsed;
      try {
        // 마크다운 코드 펜스 제거
        const cleaned = text.replace(/```json|```/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch (e) {
        throw new Error("JSON 파싱 실패: " + text.slice(0, 200));
      }

      // 분석 결과를 폼에 자동 채우기 (사용자가 수정 가능)
      if (parsed.ch != null) setCh(parsed.ch);
      if (parsed.amt != null) setAmt(parsed.amt);
      if (parsed.h60 != null) setH60(!!parsed.h60);
      if (parsed.h120 != null) setH120(!!parsed.h120);
      if (parsed.iv) setIv(parsed.iv);
      if (parsed.wick != null) setWick(parsed.wick);
      // 시그널 빈도: 좌측 시그널 + 1 (현재 시그널 포함)
      if (parsed.left_signal_count != null) setSigs((parsed.left_signal_count || 0) + 1);

      // AI 요약 저장 (결과 카드에 표시)
      setAiSummary({
        ch: parsed.ch, amt: parsed.amt,
        h60: parsed.h60, h120: parsed.h120,
        box: parsed.box, box_months: parsed.box_months,
        left_signal: parsed.left_signal, left_signal_count: parsed.left_signal_count,
        vrev: parsed.vrev, breakout: parsed.breakout,
        iv: parsed.iv, wick: parsed.wick,
        description: parsed.description,
      });

      // 즉시 5타입 매칭 (분석 결과 기반)
      const input = {
        ch: parsed.ch ?? ch,
        amt: parsed.amt ?? amt,
        h60: !!parsed.h60,
        h120: !!parsed.h120,
        sigs: (parsed.left_signal_count || 0) + 1,
        wick: parsed.wick ?? wick,
        iv: parsed.iv || iv,
        // AI가 직접 판단한 패턴 신호 (가산점)
        aiBox: !!parsed.box,
        aiBreakout: !!parsed.breakout,
        aiVrev: !!parsed.vrev,
        aiLeftSignal: !!parsed.left_signal,
      };
      const ranked = matchAllTypes(input);
      setResults({ input, ranked });
    } catch (e) {
      setAiError(e.message);
    } finally {
      setAiAnalyzing(false);
    }
  }

  // 수동 분석 (슬라이더 입력만으로)
  function manualAnalyze() {
    const input = {
      ch: parseFloat(ch), amt: parseFloat(amt),
      h60, h120, sigs: parseInt(sigs) || 0,
      wick: parseFloat(wick), iv,
    };
    const ranked = matchAllTypes(input);
    setResults({ input, ranked });
    setAiSummary(null);
  }

  async function saveToType(typeId) {
    if (typeof window === "undefined" || !window.storage) {
      alert("저장 기능 사용 불가");
      return;
    }
    const id = "upat:" + typeId + "_" + Date.now();
    const pattern = {
      typeId, name: stockName || (aiSummary?.description?.slice(0, 30)) || "이름 없음",
      img: imgB64,
      ch: parseFloat(ch), amt: parseFloat(amt),
      h60, h120, sigs: parseInt(sigs) || 0,
      wick: parseFloat(wick), iv,
      aiSummary,
      addedAt: new Date().toISOString(),
    };
    try {
      await window.storage.set(id, JSON.stringify(pattern));
      setUserPatterns(prev => {
        const next = { ...prev };
        if (!next[typeId]) next[typeId] = [];
        next[typeId] = [...next[typeId], { ...pattern, key: id }];
        return next;
      });
      alert(`✅ TYPE ${typeId}에 추가됨`);
    } catch (e) {
      alert("저장 실패: " + e.message);
    }
  }

  async function deleteUserPattern(key, typeId) {
    if (!confirm("이 학습 데이터를 삭제하시겠습니까?")) return;
    if (typeof window !== "undefined" && window.storage) {
      try { await window.storage.delete(key); } catch (e) {}
    }
    setUserPatterns(prev => {
      const next = { ...prev };
      if (next[typeId]) {
        next[typeId] = next[typeId].filter(p => p.key !== key);
      }
      return next;
    });
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* 이미지 업로드 + AI 자동 분석 */}
      <div style={{
        padding: 14, background: "#1e293b",
        border: "2px solid #fbbf24", borderRadius: 10,
      }}>
        <div style={{
          fontSize: 16, fontWeight: 800, color: "#fbbf24", marginBottom: 4,
        }}>
          🤖 AI 차트 분석
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
          차트 업로드 → AI(Claude Vision)가 자동 분석 → 5타입 매칭 ·
          <b style={{color:"#10b981"}}> 95%+면 학습 데이터 추가</b>
        </div>

        {/* 이미지 업로드 */}
        <input type="file" accept="image/*" onChange={onFile}
          style={{
            width: "100%", padding: 10, fontSize: 13,
            background: "#0f172a", color: "#fff",
            border: "1px dashed #475569", borderRadius: 6,
            marginBottom: 10, boxSizing: "border-box",
          }} />
        {imgB64 && (
          <div style={{
            marginBottom: 10, padding: 8,
            background: "#0f172a", borderRadius: 6, textAlign: "center",
          }}>
            <img src={imgB64} alt="차트"
              style={{ maxWidth: "100%", maxHeight: 250, borderRadius: 4 }} />
          </div>
        )}

        {/* AI 분석 버튼 */}
        <button onClick={aiAnalyze} disabled={!imgB64 || aiAnalyzing}
          style={{
            width: "100%", padding: "14px",
            background: aiAnalyzing ? "#475569" :
                        !imgB64 ? "#334155" : "#fbbf24",
            color: !imgB64 ? "#64748b" : "#0f172a",
            border: "none", borderRadius: 8,
            fontSize: 15, fontWeight: 800,
            cursor: !imgB64 ? "not-allowed" : aiAnalyzing ? "wait" : "pointer",
            marginBottom: 8,
          }}>
          {aiAnalyzing ? "🤖 AI 분석 중... (10~20초)" :
           !imgB64 ? "이미지를 먼저 업로드" :
           "🤖 AI 자동 분석 → 5타입 매칭"}
        </button>

        {aiError && (
          <div style={{
            padding: 10, background: "#7f1d1d",
            border: "1px solid #ef4444", borderRadius: 6,
            color: "#fecaca", fontSize: 12, marginBottom: 8,
          }}>
            ⚠️ AI 분석 실패: {aiError}
          </div>
        )}

        {/* AI 분석 요약 */}
        {aiSummary && (
          <div style={{
            padding: 12, background: "#0f172a",
            border: "1px solid #fbbf24", borderRadius: 6,
            marginBottom: 10, fontSize: 12, color: "#cbd5e1",
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", marginBottom: 6 }}>
              🤖 AI 분석 결과
            </div>
            {aiSummary.description && (
              <div style={{ marginBottom: 6, fontStyle: "italic", color: "#fff" }}>
                "{aiSummary.description}"
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              <div>등락: <b style={{color:"#10b981"}}>+{aiSummary.ch}%</b></div>
              <div>거래대금: <b>{aiSummary.amt}억</b></div>
              <div>박스권: <b style={{color:aiSummary.box?"#10b981":"#94a3b8"}}>
                {aiSummary.box ? `O (${aiSummary.box_months}개월)` : "X"}
              </b></div>
              <div>매물대 돌파: <b style={{color:aiSummary.breakout?"#ec4899":"#94a3b8"}}>
                {aiSummary.breakout ? "O" : "X"}
              </b></div>
              <div>V자 반등: <b style={{color:aiSummary.vrev?"#0ea5e9":"#94a3b8"}}>
                {aiSummary.vrev ? "O" : "X"}
              </b></div>
              <div>좌측 시그널: <b style={{color:aiSummary.left_signal?"#fbbf24":"#94a3b8"}}>
                {aiSummary.left_signal ? `${aiSummary.left_signal_count}회` : "X"}
              </b></div>
              <div>60일 신고가: <b>{aiSummary.h60?"O":"X"}</b></div>
              <div>120일 신고가: <b>{aiSummary.h120?"O":"X"}</b></div>
              <div>수급: <b>{aiSummary.iv}</b></div>
              <div>윗꼬리: <b>{aiSummary.wick}%</b></div>
            </div>
          </div>
        )}

        {/* 수동 입력 (선택) */}
        <details style={{ marginBottom: 10 }}>
          <summary style={{
            fontSize: 12, color: "#94a3b8", cursor: "pointer",
            fontWeight: 700, padding: "6px 0",
          }}>
            ✏️ 수동 입력 (AI 결과 수정 또는 직접 입력)
          </summary>
          <div style={{ marginTop: 8 }}>
            <input type="text" value={stockName} onChange={e => setStockName(e.target.value)}
              placeholder="종목명 (선택)"
              style={{
                width: "100%", padding: 10, fontSize: 13,
                background: "#0f172a", color: "#fff",
                border: "1px solid #475569", borderRadius: 6,
                marginBottom: 10, boxSizing: "border-box",
              }} />
            <SliderRow label="등락률" value={ch}
              options={[5, 8, 10, 13, 15, 18, 22, 26, 29]}
              onChange={setCh} unit="%" color="#10b981" />
            <SliderRow label="거래대금" value={amt}
              options={[100, 300, 500, 800, 1500, 3000, 5000, 10000]}
              onChange={setAmt} unit="억" color="#fbbf24" />
            <SliderRow label="시그널 빈도" value={sigs}
              options={[1, 2, 3, 5, 10, 20]}
              onChange={setSigs} unit="회" color="#0ea5e9" />
            <SliderRow label="윗꼬리" value={wick}
              options={[1, 2, 3, 5, 10]}
              onChange={setWick} unit="%" color="#a855f7" />
            <div style={{
              display: "flex", gap: 12, padding: "10px 0",
              fontSize: 13, color: "#cbd5e1", flexWrap: "wrap",
            }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" checked={h60} onChange={e => setH60(e.target.checked)}
                  style={{ width: 18, height: 18 }} />
                60일 신고가
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" checked={h120} onChange={e => setH120(e.target.checked)}
                  style={{ width: 18, height: 18 }} />
                120일 신고가
              </label>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 6 }}>수급</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["기+외", "외만", "기만", "둘다-"].map(opt => (
                  <button key={opt} onClick={() => setIv(opt)}
                    style={{
                      flex: 1, minWidth: 70,
                      background: iv === opt ? "#10b981" : "#0f172a",
                      color: iv === opt ? "#fff" : "#94a3b8",
                      border: `1px solid ${iv === opt ? "#10b981" : "#334155"}`,
                      borderRadius: 6, padding: "8px 10px",
                      fontSize: 13, fontWeight: 700, cursor: "pointer",
                    }}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={manualAnalyze}
              style={{
                width: "100%", padding: "10px",
                background: "#0ea5e9", color: "#fff",
                border: "none", borderRadius: 6,
                fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>
              🎯 수동 입력으로 5타입 비교
            </button>
          </div>
        </details>
      </div>

      {/* 결과 */}
      {results && (
        <div style={{
          padding: 14, background: "#1e293b",
          border: "1px solid #334155", borderRadius: 10,
        }}>
          <div style={{
            fontSize: 14, fontWeight: 800, color: "#fbbf24", marginBottom: 10,
          }}>
            🎯 5타입 매칭 결과 (높은 순)
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {results.ranked.map(r => (
              <MatchResultCard key={r.typeId}
                result={r}
                canSave={r.match >= 95 && imgB64}
                onSave={() => saveToType(r.typeId)} />
            ))}
          </div>
        </div>
      )}

      {/* 5타입 정의 + 사용자 추가 차트 */}
      {PATTERN_TYPES.map(t => {
        const userList = userPatterns[t.id] || [];
        return (
          <div key={t.id} style={{
            padding: 14, background: "#1e293b",
            border: `2px solid ${t.color}`, borderRadius: 10,
          }}>
            <div style={{
              fontSize: 18, fontWeight: 800, color: t.color, marginBottom: 6,
            }}>
              {t.icon} TYPE {t.id} · {t.name}
              {userList.length > 0 && (
                <span style={{
                  fontSize: 11, color: "#10b981",
                  marginLeft: 8, fontWeight: 700,
                }}>
                  +{userList.length} 학습됨
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 8 }}>
              {t.desc}
            </div>
            <div style={{
              padding: 10, background: "#0f172a", borderRadius: 6,
              fontSize: 12, color: "#94a3b8", marginBottom: 8,
            }}>
              <div><b style={{color:"#fbbf24"}}>조건</b></div>
              <div>등락률: +{t.criteria.chMin}% ~ +{t.criteria.chMax}%</div>
              <div>거래대금: {t.criteria.amtMin}억 ~ {t.criteria.amtMax === 99999 ? "무제한" : t.criteria.amtMax + "억"}</div>
              <div>60일 신고가: {t.criteria.h60 === true ? "필수" : t.criteria.h60 === false ? "X" : "무관"}</div>
              <div>120일 신고가: {t.criteria.h120 === false ? "X" : "무관"}</div>
              {t.criteria.sigsMin && <div>시그널 빈도: {t.criteria.sigsMin}회 이상</div>}
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
              <b style={{color:"#fbbf24"}}>기본 예시 종목</b><br/>
              {t.examples}
            </div>

            {userList.length > 0 && (
              <div style={{
                marginTop: 10, padding: 10,
                background: "#0f172a", borderRadius: 6,
                border: "1px dashed #10b981",
              }}>
                <div style={{
                  fontSize: 12, color: "#10b981", fontWeight: 700, marginBottom: 8,
                }}>
                  🎓 학습된 사용자 차트 ({userList.length}개)
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {userList.map(u => (
                    <div key={u.key} style={{
                      padding: 8, background: "#1e293b",
                      borderRadius: 6, display: "flex",
                      gap: 10, alignItems: "center",
                    }}>
                      {u.img && (
                        <img src={u.img} alt={u.name}
                          style={{
                            width: 80, height: 50, objectFit: "cover",
                            borderRadius: 4, flexShrink: 0,
                          }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24" }}>
                          {u.name}
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>
                          +{u.ch}% · {u.amt}억 · {u.iv}
                        </div>
                      </div>
                      <button onClick={() => deleteUserPattern(u.key, t.id)}
                        style={{
                          background: "transparent", color: "#ef4444",
                          border: "1px solid #ef4444", borderRadius: 4,
                          padding: "4px 8px", fontSize: 11, cursor: "pointer",
                        }}>
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MatchResultCard({ result, canSave, onSave }) {
  const m = result.match;
  const color = m >= 95 ? "#10b981" :
                m >= 80 ? "#fbbf24" :
                m >= 60 ? "#0ea5e9" : "#94a3b8";
  const label = m >= 95 ? "🔥 거의 완벽" :
                m >= 80 ? "✨ 매우 비슷" :
                m >= 60 ? "✓ 비슷함" :
                m >= 40 ? "⚠️ 약함" : "🚫 매우 약함";

  return (
    <div style={{
      padding: 12, background: "#0f172a",
      border: `2px solid ${color}`, borderRadius: 8,
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 8, gap: 10,
      }}>
        <div>
          <div style={{
            fontSize: 14, fontWeight: 800, color: result.type.color,
          }}>
            {result.type.icon} TYPE {result.typeId} · {result.type.name}
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
            {label}
          </div>
        </div>
        <div style={{
          fontSize: 28, fontWeight: 800, color, lineHeight: 1,
        }}>
          {m}%
        </div>
      </div>

      {/* 점수 바 */}
      <div style={{
        height: 8, background: "#1e293b",
        borderRadius: 4, overflow: "hidden", marginBottom: 10,
      }}>
        <div style={{
          width: `${m}%`, height: "100%", background: color,
          transition: "width 0.3s",
        }} />
      </div>

      {/* 매칭 사유 */}
      <details style={{ marginBottom: 8 }}>
        <summary style={{
          fontSize: 12, color: "#94a3b8", cursor: "pointer", fontWeight: 700,
        }}>
          📋 매칭 사유 보기
        </summary>
        <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
          {result.reasons.map((r, i) => (
            <div key={i} style={{
              fontSize: 12,
              color: r.ok ? "#10b981" : "#94a3b8",
              padding: "4px 8px",
              background: r.ok ? "rgba(16,185,129,0.1)" : "rgba(100,116,139,0.1)",
              borderRadius: 4,
            }}>
              {r.text}
            </div>
          ))}
        </div>
      </details>

      {canSave && (
        <button onClick={onSave}
          style={{
            width: "100%", padding: "10px",
            background: "#10b981", color: "#fff",
            border: "none", borderRadius: 6,
            fontSize: 13, fontWeight: 800, cursor: "pointer",
          }}>
          ➕ 이 타입에 학습 데이터로 추가 (95%+)
        </button>
      )}
    </div>
  );
}

// ───── 모달: 싱크 상세 ─────
function SyncDetailModal({ sig, onClose }) {
  const c = sig.type.criteria;
  const items = [
    { name:"등락률", score: sig.sync.ch, max: 30,
      detail: `+${sig.ch.toFixed(2)}% (타입 범위 +${c.chMin}~${c.chMax}%, 중심 +${(c.chMin+c.chMax)/2}%)` },
    { name:"거래대금", score: sig.sync.amt, max: 25,
      detail: `${sig.amt}억 (타입 범위 ${c.amtMin}~${c.amtMax === 99999 ? "무제한" : c.amtMax + "억"})` },
    { name:"수급", score: sig.sync.inv, max: 25,
      detail: `${sig.investor || sig.iv} (기+외 25점, 외인 18, 기관 10)` },
    { name:"윗꼬리", score: sig.sync.wick, max: 20,
      detail: `${sig.wick}% (≤1% 20점, ≤3% 15, ≤5% 10, ≤10% 5)` },
  ];

  return (
    <div onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        zIndex: 1000, padding: 12,
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          background: "#1e293b", borderRadius: 16,
          padding: 18, maxWidth: 500, width: "100%",
          maxHeight: "85vh", overflowY: "auto",
          border: `2px solid ${sig.type.color}`,
        }}>
        {/* 종목 헤더 */}
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "flex-start", marginBottom: 14, gap: 10,
        }}>
          <div>
            <div style={{
              fontSize: 11, color: sig.type.color, fontWeight: 700,
            }}>
              {sig.type.icon} {sig.type.name}
            </div>
            <div style={{
              fontSize: 22, fontWeight: 800, color: "#fbbf24",
              marginTop: 2,
            }}>
              {sig.name}
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              {sig.code} · {sig.market}
            </div>
          </div>
          <button onClick={onClose}
            style={{
              background: "#334155", color: "#fff", border: "none",
              borderRadius: 6, padding: "6px 10px",
              fontSize: 14, cursor: "pointer", fontWeight: 700,
            }}>
            ✕
          </button>
        </div>

        {/* 싱크 점수 큰 표시 */}
        <div style={{
          textAlign: "center", padding: 14,
          background: "#0f172a", borderRadius: 10, marginBottom: 14,
        }}>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>패턴 싱크%</div>
          <div style={{
            fontSize: 48, fontWeight: 800,
            color: sig.sync.total >= 80 ? "#10b981" :
                   sig.sync.total >= 65 ? "#fbbf24" : "#94a3b8",
            lineHeight: 1.2,
          }}>
            {sig.sync.total}%
          </div>
          <div style={{ fontSize: 11, color: "#64748b" }}>
            {sig.sync.total >= 80 ? "🔥 패턴 매우 일치" :
             sig.sync.total >= 65 ? "✓ 패턴 양호" :
             sig.sync.total >= 50 ? "⚠️ 약한 매칭" : "🚫 매우 약함"}
          </div>
        </div>

        {/* 항목별 점수 */}
        <div style={{
          fontSize: 13, fontWeight: 700, color: "#fbbf24", marginBottom: 8,
        }}>
          📊 항목별 점수 분석
        </div>
        <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
          {items.map(it => (
            <div key={it.name} style={{
              padding: 10, background: "#0f172a",
              border: "1px solid #334155", borderRadius: 8,
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                marginBottom: 6,
              }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{it.name}</span>
                <span style={{
                  fontSize: 14, fontWeight: 800,
                  color: it.score / it.max >= 0.7 ? "#10b981" :
                         it.score / it.max >= 0.4 ? "#fbbf24" : "#ef4444",
                }}>
                  {it.score} / {it.max}
                </span>
              </div>
              {/* 점수 바 */}
              <div style={{
                height: 6, background: "#1e293b", borderRadius: 3,
                overflow: "hidden", marginBottom: 6,
              }}>
                <div style={{
                  width: `${it.score / it.max * 100}%`, height: "100%",
                  background: it.score / it.max >= 0.7 ? "#10b981" :
                              it.score / it.max >= 0.4 ? "#fbbf24" : "#ef4444",
                }}/>
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                {it.detail}
              </div>
            </div>
          ))}
        </div>

        {/* 종목 데이터 요약 */}
        <div style={{
          padding: 10, background: "#0f172a",
          border: "1px solid #334155", borderRadius: 8,
          fontSize: 12, color: "#cbd5e1",
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: "#fbbf24" }}>
            오늘 종목 데이터
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap: 4 }}>
            <div>등락: <b style={{color:"#10b981"}}>+{sig.ch.toFixed(2)}%</b></div>
            <div>거래대금: <b>{sig.amt}억</b></div>
            <div>NEO 등급: <b style={{
              color: sig.grade==="S" ? "#10b981" :
                     sig.grade==="A" ? "#fbbf24" : "#0ea5e9"
            }}>{sig.grade}</b></div>
            <div>시장: <b>{sig.market}</b></div>
            <div>윗꼬리: <b>{sig.wick}%</b></div>
            <div>수급: <b>{sig.investor || sig.iv}</b></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───── 공통 컴포넌트 ─────
function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      style={{
        flex: 1, padding: "10px 8px",
        background: active ? "#10b981" : "transparent",
        color: active ? "#fff" : "#94a3b8",
        border: "none", borderRadius: 6,
        fontSize: 13, fontWeight: 700, cursor: "pointer",
      }}>
      {children}
    </button>
  );
}

function Kpi({ label, value, sub, color }) {
  return (
    <div style={{
      background: "#0f172a", border: "1px solid #334155",
      borderRadius: 8, padding: 8,
    }}>
      <div style={{ fontSize: 10, color: "#94a3b8" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: "#64748b" }}>{sub}</div>}
    </div>
  );
}

const th = {
  textAlign: "center", padding: "5px 6px",
  fontSize: 11, fontWeight: 600,
  borderBottom: "1px solid #334155", whiteSpace: "nowrap",
};
const td = {
  textAlign: "center", padding: "5px 6px",
  borderBottom: "1px solid #1e293b", whiteSpace: "nowrap",
};
