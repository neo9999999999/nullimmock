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
// criteria 풀세트 — 모든 필터 (사용자 편집 가능)
// box/breakout/uptrend/vrev/h60/h120: "req"=필수 / "no"=금지 / "any"=무관
const DEFAULT_CRITERIA = {
  1: {
    chMin: 13, chMax: 30,
    amtMin: 300, amtMax: 3000,
    h60: "no", h120: "no",
    isBox: "req", isBreakout: "any", isUptrend: "no", isVRev: "any",
    range60Min: 0, range60Max: 50,
    sigsMin: 0, sigsMax: 99,
    wickMax: 10,
    ivAllowed: ["기+외", "외만", "기만", "둘다-"],
  },
  2: {
    chMin: 13, chMax: 27,
    amtMin: 200, amtMax: 2500,
    h60: "no", h120: "no",
    isBox: "any", isBreakout: "any", isUptrend: "no", isVRev: "req",
    range60Min: 0, range60Max: 99,
    sigsMin: 0, sigsMax: 99,
    wickMax: 10,
    ivAllowed: ["기+외", "외만", "기만", "둘다-"],
  },
  3: {
    chMin: 9, chMax: 30,
    amtMin: 200, amtMax: 2500,
    h60: "any", h120: "any",
    isBox: "any", isBreakout: "any", isUptrend: "any", isVRev: "any",
    range60Min: 0, range60Max: 99,
    sigsMin: 2, sigsMax: 99,
    wickMax: 10,
    ivAllowed: ["기+외", "외만", "기만", "둘다-"],
  },
  4: {
    chMin: 13, chMax: 25,
    amtMin: 300, amtMax: 2500,
    h60: "any", h120: "no",
    isBox: "req", isBreakout: "req", isUptrend: "any", isVRev: "any",
    range60Min: 0, range60Max: 50,
    sigsMin: 0, sigsMax: 99,
    wickMax: 10,
    ivAllowed: ["기+외", "외만", "기만", "둘다-"],
  },
  5: {
    chMin: 7, chMax: 17,
    amtMin: 500, amtMax: 99999,
    h60: "req", h120: "any",
    isBox: "any", isBreakout: "any", isUptrend: "req", isVRev: "no",
    range60Min: 0, range60Max: 99,
    sigsMin: 0, sigsMax: 99,
    wickMax: 10,
    ivAllowed: ["기+외", "외만", "기만", "둘다-"],
  },
};

const PATTERN_TYPES = [
  {
    id: 1,
    name: "박스권 돌파",
    short: "박스권",
    desc: "장기 횡보 후 거래대금 폭증 큰 양봉 — 가장 흔한 패턴",
    examples: "풍산, 케이엘넷, NAVER, 쿠콘, POSCO, 한화, 한전KPS, 고영, 나우IB, 넥스틸, 우리기술",
    color: "#10b981",
    icon: "📦",
  },
  {
    id: 2,
    name: "V자 반등",
    short: "V반등",
    desc: "1년+ 하락 후 추세 전환 (장기 바닥에서 첫 큰 양봉)",
    examples: "NHN KCP, 카카오, 안랩, 휴스틸, 탑코미디어, 웹케시, 대주산업",
    color: "#0ea5e9",
    icon: "🔄",
  },
  {
    id: 3,
    name: "시그널 재현",
    short: "재현",
    desc: "1차 시그널 후 횡보 → 우측에서 같은 시그널 재발생",
    examples: "하이트진로, DSC인베스트, 세명전기, GS글로벌, 에스피지, 유라테크, 대동기어",
    color: "#fbbf24",
    icon: "🔁",
  },
  {
    id: 4,
    name: "매물대 돌파",
    short: "매물대",
    desc: "박스권 매물대 정확히 돌파 (저항선 깨짐)",
    examples: "명신산업 (대표 사례), 박스권 위 거래대금 폭증",
    color: "#ec4899",
    icon: "🚀",
  },
  {
    id: 5,
    name: "정배열 추세",
    short: "추세",
    desc: "이미 정배열 상승 중인 강한 추세주 + 단기 조정 후 재돌파",
    examples: "현대엘리베이터, 레인보우로보틱스, 한화오션, 삼성카드, 두산에너빌리티",
    color: "#a855f7",
    icon: "📈",
  },
];

// 매칭 (boolean) — 풀세트 criteria 적용
function matchType(s, c, typeId) {
  const ch = s.ch ?? s.change ?? 0;
  const amt = s.amt ?? s.amount ?? 0;

  // 1. 등락률
  if (ch < c.chMin || ch > c.chMax) return false;
  // 2. 거래대금
  if (amt < c.amtMin || amt > c.amtMax) return false;
  // 3. 윗꼬리
  if ((s.wick ?? 0) > (c.wickMax ?? 10)) return false;
  // 4. 수급
  if (c.ivAllowed && !c.ivAllowed.includes(s.iv)) return false;

  // 5. 검증 데이터 기반 (verify 있을 때만)
  if (s.verify) {
    const v = s.verify;
    // 박스권/돌파/추세/V반등
    const checkBool = (rule, value) => {
      if (rule === "req" && !value) return false;
      if (rule === "no" && value) return false;
      return true;
    };
    if (!checkBool(c.isBox, v.isBox)) return false;
    if (!checkBool(c.isBreakout, v.isBreakout)) return false;
    if (!checkBool(c.isUptrend, v.isUptrend)) return false;
    if (!checkBool(c.isVRev, v.isVRev)) return false;
    if (!checkBool(c.h60, v.h60)) return false;
    if (!checkBool(c.h120, v.h120)) return false;
    // 60일 변동폭
    if (v.range60 != null) {
      if (v.range60 < (c.range60Min ?? 0)) return false;
      if (v.range60 > (c.range60Max ?? 99)) return false;
    }
    // 시그널 빈도
    if (v.sigs != null) {
      if (v.sigs < (c.sigsMin ?? 0)) return false;
      if (v.sigs > (c.sigsMax ?? 99)) return false;
    }
  } else {
    // verify 없으면: ch/amt 통과만 확인 (점진적 표시)
    if (c.sigsMin != null && c.sigsMin > 0 && (s.sigs ?? 0) < c.sigsMin) return false;
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
    const today = new Date();
    const from = new Date(today.getTime() - 200 * 24 * 60 * 60 * 1000);
    const fmt = d => d.getFullYear() + String(d.getMonth()+1).padStart(2,"0") + String(d.getDate()).padStart(2,"0");
    const url = `${SECTOR_API}/daily-price?code=${code}&from=${fmt(from)}&to=${fmt(today)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.ok || !data.output || data.output.length < 30) return null;

    const rows = data.output;
    const todayClose = rows[0].close;

    // 과거 60/120일 (오늘 봉 제외)
    const past60 = rows.slice(1, 61);
    const past120 = rows.slice(1, 121);
    if (past60.length < 30) return null;

    const high60 = Math.max(...past60.map(r => r.high));
    const high120 = past120.length >= 60
      ? Math.max(...past120.map(r => r.high))
      : high60;
    const low60 = Math.min(...past60.map(r => r.low));
    const avg60 = past60.reduce((s,r)=>s+r.close, 0) / past60.length;
    const avg120 = past120.length >= 60
      ? past120.reduce((s,r)=>s+r.close, 0) / past120.length
      : avg60;

    // 비율 계산
    const range60 = (high60 - low60) / low60;             // 60일 변동폭 (low60 기준)
    const closeVsHigh = todayClose / high60;              // 진입가 / 60일 최고가
    const closeVsAvg = todayClose / avg60;                // 진입가 / 60일 평균
    const closeVsLow = todayClose / low60;                // 진입가 / 60일 최저가

    // h60/h120: 60/120일 신고가 근처
    const h60 = todayClose >= high60 * 0.97;
    const h120 = todayClose >= high120 * 0.97;

    // 정배열 추세: 신고가 갱신 OR 강한 상승 (변동폭 큼 + 평균 위)
    const isUptrend = h60 || (range60 > 0.30 && closeVsAvg > 1.10);

    // 박스권: 변동폭 작음 + 신고가 X + 평균 대비 안정
    // - range60 < 30% (좁은 변동)
    // - 진입가가 평균 ±15% 안 (안정적 횡보)
    // - 신고가 갱신 X
    const isBox = range60 < 0.30 && !h60 && closeVsAvg < 1.15 && closeVsAvg > 0.85;

    // 박스권 돌파: 박스권 + 진입가가 박스 상단 (60일 최고가의 90%+)
    const isBreakout = isBox && closeVsHigh >= 0.90;

    // V자 반등: 60일/120일 평균 대비 낮음 + 신고가 X
    const isVRev = !h60 && !h120 && (todayClose < avg60 * 0.92 || todayClose < avg120 * 0.85);

    // 시그널 빈도 (60일내 +10% 이상 양봉)
    const sigsCount = past60.filter(r => r.rate >= 10).length;

    // 디버그 정보 (사용자에게 표시)
    return {
      h60, h120, isBox, isBreakout, isUptrend, isVRev,
      sigs: sigsCount,
      range60: +(range60 * 100).toFixed(1),
      closeVsHigh: +(closeVsHigh * 100).toFixed(1),
      closeVsAvg: +(closeVsAvg * 100).toFixed(1),
      closeVsLow: +(closeVsLow * 100).toFixed(1),
      high60: Math.round(high60),
      low60: Math.round(low60),
      avg60: Math.round(avg60),
      avg120: Math.round(avg120),
      todayClose,
      // 판정 근거 (사용자가 보면 이해 가능)
      reason: buildReason({h60, h120, isBox, isBreakout, isUptrend, isVRev, range60, closeVsHigh, closeVsAvg}),
    };
  } catch (e) {
    return null;
  }
}

// 판정 근거 한 줄 설명
function buildReason({ h60, h120, isBox, isBreakout, isUptrend, isVRev, range60, closeVsHigh, closeVsAvg }) {
  const r60 = (range60 * 100).toFixed(0);
  const cvh = (closeVsHigh * 100).toFixed(0);
  const cva = (closeVsAvg * 100).toFixed(0);
  if (isUptrend) {
    if (h60) return `정배열: 60일 신고가 갱신 (변동폭 ${r60}%)`;
    return `정배열: 60일 평균 대비 +${cva-100}% (변동폭 ${r60}%)`;
  }
  if (isBox) {
    if (isBreakout) return `박스권 돌파: 변동폭 ${r60}% + 박스 상단 ${cvh}%`;
    return `박스권 안: 변동폭 ${r60}% + 평균 ${cva}%`;
  }
  if (isVRev) return `V자 반등: 평균 대비 ${cva}% (저점에서 반등)`;
  // 어디에도 안 속함
  if (range60 >= 0.30) return `상승 추세 (변동폭 ${r60}% > 30%)`;
  if (closeVsAvg > 1.15) return `평균 대비 +${cva-100}% (박스권 X)`;
  if (closeVsAvg < 0.85) return `평균 대비 ${cva}% (하락 중)`;
  return `중립: 변동폭 ${r60}% / 평균 ${cva}% / 신고가대비 ${cvh}%`;
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
  const [zoomImg, setZoomImg] = useState(null);  // 이미지 확대 모달

  // 사용자 수정한 criteria (window.storage)
  const [customCriteria, setCustomCriteria] = useState(DEFAULT_CRITERIA);

  // 사용자 학습 차트 (window.storage)
  const [userPatterns, setUserPatterns] = useState({});

  // 당일 시그널
  const [todayAll, setTodayAll] = useState(null);
  const [verifyMap, setVerifyMap] = useState({});
  const [scanning, setScanning] = useState(false);
  const [verifying, setVerifying] = useState(0);
  const [scanError, setScanError] = useState(null);
  const [scanTime, setScanTime] = useState(null);

  // 초기 로드: customCriteria + userPatterns
  useEffect(() => {
    if (typeof window === "undefined" || !window.storage) return;
    (async () => {
      // criteria 로드
      try {
        const list = await window.storage.list("ucrit:");
        if (list && list.keys) {
          const merged = JSON.parse(JSON.stringify(DEFAULT_CRITERIA));
          for (const k of list.keys) {
            try {
              const r = await window.storage.get(k);
              if (r) {
                const typeId = parseInt(k.replace("ucrit:", ""));
                if (merged[typeId]) {
                  merged[typeId] = { ...merged[typeId], ...JSON.parse(r.value) };
                }
              }
            } catch (e) {}
          }
          setCustomCriteria(merged);
        }
      } catch (e) {}

      // userPatterns 로드
      try {
        const list = await window.storage.list("upat:");
        if (list && list.keys) {
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
        }
      } catch (e) {}
    })();
  }, []);

  // criteria 저장
  async function saveCriteria(typeId, newCrit) {
    setCustomCriteria(prev => ({ ...prev, [typeId]: newCrit }));
    if (typeof window !== "undefined" && window.storage) {
      try {
        await window.storage.set("ucrit:" + typeId, JSON.stringify(newCrit));
      } catch (e) {}
    }
  }

  // criteria 기본값 복원
  async function resetCriteria(typeId) {
    setCustomCriteria(prev => ({ ...prev, [typeId]: DEFAULT_CRITERIA[typeId] }));
    if (typeof window !== "undefined" && window.storage) {
      try {
        await window.storage.delete("ucrit:" + typeId);
      } catch (e) {}
    }
  }

  // 학습 차트로 자동 조정 (학습 차트들의 평균/범위 기반)
  async function autoAdjustFromUserPatterns(typeId) {
    const list = userPatterns[typeId] || [];
    if (list.length < 2) {
      alert("학습 차트가 2개 이상이어야 자동 조정이 가능합니다");
      return;
    }
    const cur = customCriteria[typeId];
    const chs = list.map(p => p.ch).filter(v => !isNaN(v));
    const amts = list.map(p => p.amt).filter(v => !isNaN(v));
    const wicks = list.map(p => p.wick || 0);
    
    const next = {
      ...cur,
      chMin: Math.max(0, Math.floor(Math.min(...chs) - 2)),
      chMax: Math.ceil(Math.max(...chs) + 2),
      amtMin: Math.max(0, Math.floor(Math.min(...amts) * 0.7)),
      amtMax: Math.ceil(Math.max(...amts) * 1.5),
      wickMax: Math.max(5, Math.ceil(Math.max(...wicks) + 2)),
    };
    // h60/h120: 모두 같은 값이면 적용
    const h60s = list.map(p => !!p.h60);
    const h120s = list.map(p => !!p.h120);
    if (h60s.every(v => v)) next.h60 = "req";
    else if (h60s.every(v => !v)) next.h60 = "no";
    if (h120s.every(v => v)) next.h120 = "req";
    else if (h120s.every(v => !v)) next.h120 = "no";
    
    await saveCriteria(typeId, next);
    alert(`✅ TYPE ${typeId} 기준이 학습 차트 ${list.length}개 기반으로 조정됨`);
  }

  async function saveUserPattern(pattern) {
    const id = "upat:" + pattern.typeId + "_" + Date.now();
    pattern.key = id;
    if (typeof window !== "undefined" && window.storage) {
      try {
        await window.storage.set(id, JSON.stringify(pattern));
      } catch (e) {}
    }
    setUserPatterns(prev => {
      const next = { ...prev };
      if (!next[pattern.typeId]) next[pattern.typeId] = [];
      next[pattern.typeId] = [...next[pattern.typeId], pattern];
      return next;
    });
  }

  async function deleteUserPattern(key, typeId) {
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
            customCriteria={customCriteria}
            onClickSig={setSelectedSig} />
        )}
        {tab === "bt" && <BacktestTab />}
        {tab === "def" && (
          <DefinitionsTab
            customCriteria={customCriteria}
            userPatterns={userPatterns}
            onSaveCriteria={saveCriteria}
            onResetCriteria={resetCriteria}
            onAutoAdjust={autoAdjustFromUserPatterns}
            onSaveUserPattern={saveUserPattern}
            onDeleteUserPattern={deleteUserPattern}
            onZoomImg={setZoomImg} />
        )}

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

      {/* 이미지 확대 모달 */}
      {zoomImg && (
        <div onClick={() => setZoomImg(null)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.92)", zIndex: 1000,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: 20, cursor: "zoom-out",
          }}>
          <div style={{ marginBottom: 12, color: "#fff", fontSize: 14, fontWeight: 700 }}>
            {zoomImg.name || "차트"} {zoomImg.ch != null && `· +${zoomImg.ch}% · ${zoomImg.amt}억 · ${zoomImg.iv || ""}`}
          </div>
          <img src={zoomImg.img} alt="확대"
            style={{
              maxWidth: "95vw", maxHeight: "85vh",
              borderRadius: 8, objectFit: "contain",
            }} />
          <div style={{ marginTop: 12, color: "#94a3b8", fontSize: 11 }}>
            탭하여 닫기
          </div>
        </div>
      )}
    </div>
  );
}

// ───── 탭: 당일 발굴 ─────
function TodayTab({ todayAll, verifyMap, scanning, verifying, scanError, scanTime, onScan, onClickSig, customCriteria }) {
  const matched = useMemo(() => {
    if (!todayAll) return null;
    const out = {};
    for (const t of PATTERN_TYPES) {
      const c = customCriteria[t.id] || DEFAULT_CRITERIA[t.id];
      const list = todayAll
        .map(s => {
          const v = verifyMap[s.code];
          const sig = toSig(s, v);
          if (!matchType(sig, c, t.id)) return null;
          const sync = calcSyncDetail(sig, c);
          return { ...sig, raw: s, sync, type: t, criteria: c };
        })
        .filter(Boolean)
        .sort((a, b) => b.sync.total - a.sync.total)
        .slice(0, 5);
      out[t.id] = list;
    }
    return out;
  }, [todayAll, verifyMap, customCriteria]);

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
        {/* 검증 디버그 한 줄 */}
        {sig.verify && sig.verify.reason && (
          <div style={{
            fontSize: 10, color: "#64748b", marginTop: 4,
            fontStyle: "italic",
          }}>
            🔬 {sig.verify.reason}
          </div>
        )}
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

// ───── 백테스트 시뮬 (1개 조합 평가) ─────
function simulateBacktest(matched, tp, sl, holdMax) {
  let win = 0, loss = 0, timeout = 0;
  let totalGain = 0;
  let totalDays = 0;
  const gains = [];

  for (const s of matched) {
    const tpKey = `tp${tp}`;
    const slKey = `sl${sl}`;
    let tpDay = s[tpKey];
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
    if (tpDay > holdMax) tpDay = -1;
    if (slDay > holdMax) slDay = -1;

    let gain, days;
    if (tpDay > 0 && (slDay < 0 || tpDay <= slDay)) {
      gain = tp; days = tpDay; win++;
    } else if (slDay > 0) {
      gain = -sl; days = slDay; loss++;
    } else {
      const holdN = Math.min(holdMax, 20);
      const closeKey = holdN >= 20 ? "c20" : holdN >= 10 ? "c10" : holdN >= 5 ? "c5" : "c3";
      gain = s[closeKey] ?? 0;
      days = holdN; timeout++;
    }
    totalGain += gain;
    totalDays += days;
    gains.push(gain);
  }

  const n = matched.length;
  const avgGain = totalGain / n;
  const avgDays = totalDays / n;
  const winRate = win / n * 100;
  // 표준편차 (안정성 지표)
  const variance = gains.reduce((s,g) => s + (g - avgGain)**2, 0) / n;
  const stdDev = Math.sqrt(variance);

  return {
    n, win, loss, timeout,
    winRate, avgGain, avgDays, stdDev,
    gainPerDay: avgDays > 0 ? avgGain / avgDays : 0,
    sharpe: stdDev > 0 ? avgGain / stdDev : 0,
  };
}

// ───── 그리드 서치 (TP × SL × 보유기간 최적 탐색) ─────
function gridSearchOptimize(matched, mode, minWinRate) {
  // 데이터 컬럼에 있는 값들만 시도 (속도 + 보간 정확)
  const tps = [5, 7, 10, 15, 20, 25, 30];
  const sls = [2, 3, 5, 7, 10];
  const holds = [5, 10, 15, 20, 25, 30];
  const candidates = [];

  for (const tp of tps) {
    for (const sl of sls) {
      for (const hold of holds) {
        if (tp <= sl) continue;  // TP는 SL보다 커야 함
        const r = simulateBacktest(matched, tp, sl, hold);
        if (minWinRate > 0 && r.winRate < minWinRate) continue;
        candidates.push({ tp, sl, hold, ...r });
      }
    }
  }
  if (candidates.length === 0) return null;

  // 모드별 정렬
  let sorted;
  if (mode === "max-return") {
    // 가장 높은 수익률
    sorted = candidates.sort((a, b) => b.avgGain - a.avgGain);
  } else if (mode === "short-hold") {
    // 단기 (수익/일 가중치)
    sorted = candidates.sort((a, b) => b.gainPerDay - a.gainPerDay);
  } else if (mode === "stable") {
    // 안정 (Sharpe + 승률)
    sorted = candidates.sort((a, b) => {
      const sa = a.sharpe * (a.winRate / 100);
      const sb = b.sharpe * (b.winRate / 100);
      return sb - sa;
    });
  } else {
    sorted = candidates.sort((a, b) => b.avgGain - a.avgGain);
  }

  return {
    best: sorted[0],
    top5: sorted.slice(0, 5),
    totalCandidates: candidates.length,
  };
}

// ───── 탭: 백테스트 (TP/SL 시뮬) ─────
function BacktestTab() {
  const [typeId, setTypeId] = useState(1);
  const [tp, setTp] = useState(7);
  const [sl, setSl] = useState(3);
  const [budget, setBudget] = useState(300);
  const [holdMax, setHoldMax] = useState(20);

  // 최적화 옵션
  const [optMode, setOptMode] = useState(null);  // null/"max-return"/"short-hold"/"stable"
  const [minWinRate, setMinWinRate] = useState(0);
  const [optResult, setOptResult] = useState(null);
  const [optimizing, setOptimizing] = useState(false);

  const type = PATTERN_TYPES.find(t => t.id === typeId);

  // 매칭 시그널 캐싱
  const matched = useMemo(() => {
    return signalsData.filter(s => matchType(s, DEFAULT_CRITERIA[typeId], typeId));
  }, [typeId]);

  // 자동 최적화 실행
  function runOptimize(mode) {
    if (matched.length === 0) return;
    setOptimizing(true);
    setOptMode(mode);
    setTimeout(() => {
      const opt = gridSearchOptimize(matched, mode, minWinRate);
      setOptResult(opt);
      if (opt && opt.best) {
        setTp(opt.best.tp);
        setSl(opt.best.sl);
        setHoldMax(opt.best.hold);
      }
      setOptimizing(false);
    }, 50);
  }

  const result = useMemo(() => {
    if (matched.length === 0) return null;

    // 각 시그널마다 TP/SL 시뮬
    let win = 0, loss = 0, timeout = 0;
    let totalGain = 0;
    let totalDays = 0;
    const winDays = [];
    const lossDays = [];
    const allOutcomes = [];

    for (const s of matched) {
      const tpKey = `tp${tp}`;
      const slKey = `sl${sl}`;
      let tpDay = s[tpKey];
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

      if (tpDay > holdMax) tpDay = -1;
      if (slDay > holdMax) slDay = -1;

      let outcome, gain, days;
      if (tpDay > 0 && (slDay < 0 || tpDay <= slDay)) {
        outcome = "TP"; gain = tp; days = tpDay; win++;
        winDays.push(days);
      } else if (slDay > 0) {
        outcome = "SL"; gain = -sl; days = slDay; loss++;
        lossDays.push(days);
      } else {
        outcome = "TO";
        const holdN = Math.min(holdMax, 20);
        const closeKey = holdN >= 20 ? "c20" : holdN >= 10 ? "c10" : holdN >= 5 ? "c5" : "c3";
        gain = s[closeKey] ?? 0;
        days = holdN;
        timeout++;
      }

      totalGain += gain;
      totalDays += days;
      allOutcomes.push({ ...s, outcome, gain: +gain.toFixed(2), days });
    }

    const n = matched.length;
    const winRate = win/n*100;
    const avgGain = totalGain/n;
    const avgDays = totalDays/n;

    const budgetWon = budget * 10000;
    const profitPerTrade = budgetWon * avgGain / 100;
    const totalProfit = profitPerTrade * n;
    
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
      winRate, lossRate: loss/n*100, toRate: timeout/n*100,
      avgGain, avgDays,
      avgWinDays: winDays.length ? winDays.reduce((a,b)=>a+b,0)/winDays.length : 0,
      avgLossDays: lossDays.length ? lossDays.reduce((a,b)=>a+b,0)/lossDays.length : 0,
      profitPerTrade, totalProfit,
      byYr,
      recent: allOutcomes.sort((a,b) => b.date.localeCompare(a.date)).slice(0, 10),
    };
  }, [matched, tp, sl, holdMax, budget]);

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

      {/* 🎯 자동 최적화 */}
      <div style={{
        background:"#1e293b", border:"2px solid #fbbf24",
        borderRadius:10, padding:14, marginBottom:12,
      }}>
        <div style={{ fontSize:14, fontWeight:800, color:"#fbbf24", marginBottom:6 }}>
          🎯 자동 최적화 ({matched.length}건 매칭)
        </div>
        <div style={{ fontSize:11, color:"#94a3b8", marginBottom:10 }}>
          TP × SL × 보유 약 200~300조합 그리드 서치 → 최적 자동 추천
        </div>

        {/* 승률 필터 */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize:12, color:"#cbd5e1", marginBottom: 4 }}>
            최소 승률 필터
          </div>
          <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            {[0, 30, 40, 50, 60, 70].map(v => (
              <button key={v} onClick={() => setMinWinRate(v)}
                style={{
                  flex: 1, minWidth: 50,
                  background: minWinRate === v ? "#0ea5e9" : "#0f172a",
                  color: minWinRate === v ? "#fff" : "#94a3b8",
                  border: "1px solid " + (minWinRate === v ? "#0ea5e9" : "#334155"),
                  borderRadius: 4, padding: "6px 8px",
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}>
                {v === 0 ? "무관" : v + "%↑"}
              </button>
            ))}
          </div>
        </div>

        {/* 모드 버튼 */}
        <div style={{ display:"grid", gridTemplateColumns: "1fr 1fr 1fr", gap:6 }}>
          <button onClick={() => runOptimize("max-return")} disabled={optimizing}
            style={{
              padding:"10px 8px", fontSize:12, fontWeight:800,
              background: optMode === "max-return" ? "#10b981" : "#0f172a",
              color: optMode === "max-return" ? "#fff" : "#10b981",
              border: "1px solid #10b981", borderRadius: 6, cursor: optimizing?"wait":"pointer",
            }}>
            💰<br/>최고 수익률
          </button>
          <button onClick={() => runOptimize("short-hold")} disabled={optimizing}
            style={{
              padding:"10px 8px", fontSize:12, fontWeight:800,
              background: optMode === "short-hold" ? "#fbbf24" : "#0f172a",
              color: optMode === "short-hold" ? "#0f172a" : "#fbbf24",
              border: "1px solid #fbbf24", borderRadius: 6, cursor: optimizing?"wait":"pointer",
            }}>
            ⚡<br/>단기 (수익/일)
          </button>
          <button onClick={() => runOptimize("stable")} disabled={optimizing}
            style={{
              padding:"10px 8px", fontSize:12, fontWeight:800,
              background: optMode === "stable" ? "#0ea5e9" : "#0f172a",
              color: optMode === "stable" ? "#fff" : "#0ea5e9",
              border: "1px solid #0ea5e9", borderRadius: 6, cursor: optimizing?"wait":"pointer",
            }}>
            🛡️<br/>안정 수익
          </button>
        </div>

        {optimizing && (
          <div style={{ marginTop: 10, fontSize: 12, color: "#fbbf24", textAlign: "center" }}>
            🔄 그리드 서치 중...
          </div>
        )}

        {optResult && optResult.best && !optimizing && (
          <div style={{
            marginTop: 12, padding: 12,
            background: "#0f172a",
            border: "1px solid " + (optMode === "max-return" ? "#10b981" : optMode === "short-hold" ? "#fbbf24" : "#0ea5e9"),
            borderRadius: 8,
          }}>
            <div style={{
              fontSize: 12, fontWeight: 800,
              color: optMode === "max-return" ? "#10b981" : optMode === "short-hold" ? "#fbbf24" : "#0ea5e9",
              marginBottom: 8,
            }}>
              ✅ 최적 조합 발견 ({optMode === "max-return" ? "최고 수익" : optMode === "short-hold" ? "단기" : "안정"})
            </div>
            <div style={{
              display:"grid", gridTemplateColumns:"1fr 1fr 1fr",
              gap:8, marginBottom: 10,
            }}>
              <div style={{ textAlign:"center", padding:8, background:"#1e293b", borderRadius:6 }}>
                <div style={{ fontSize:10, color:"#94a3b8" }}>TP</div>
                <div style={{ fontSize:20, fontWeight:800, color:"#10b981" }}>+{optResult.best.tp}%</div>
              </div>
              <div style={{ textAlign:"center", padding:8, background:"#1e293b", borderRadius:6 }}>
                <div style={{ fontSize:10, color:"#94a3b8" }}>SL</div>
                <div style={{ fontSize:20, fontWeight:800, color:"#ef4444" }}>-{optResult.best.sl}%</div>
              </div>
              <div style={{ textAlign:"center", padding:8, background:"#1e293b", borderRadius:6 }}>
                <div style={{ fontSize:10, color:"#94a3b8" }}>최대 보유</div>
                <div style={{ fontSize:20, fontWeight:800, color:"#0ea5e9" }}>{optResult.best.hold}일</div>
              </div>
            </div>
            <div style={{
              display:"grid", gridTemplateColumns:"1fr 1fr",
              gap:6, fontSize: 12, color: "#cbd5e1",
            }}>
              <div>평균 수익: <b style={{color:"#10b981"}}>+{optResult.best.avgGain.toFixed(2)}%</b></div>
              <div>승률: <b style={{color:"#fbbf24"}}>{optResult.best.winRate.toFixed(1)}%</b></div>
              <div>평균 보유: <b>{optResult.best.avgDays.toFixed(1)}일</b></div>
              <div>일당 수익: <b style={{color:"#10b981"}}>+{optResult.best.gainPerDay.toFixed(3)}%/일</b></div>
              <div>표준편차: <b>{optResult.best.stdDev.toFixed(2)}%</b></div>
              <div>샤프지수: <b>{optResult.best.sharpe.toFixed(3)}</b></div>
            </div>

            {/* 상위 5개 */}
            <details style={{ marginTop: 10 }}>
              <summary style={{ fontSize:11, color:"#94a3b8", cursor:"pointer", fontWeight:700 }}>
                📊 상위 5개 조합 (총 {optResult.totalCandidates}개 후보 중)
              </summary>
              <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
                {optResult.top5.map((r, i) => (
                  <div key={i} onClick={() => { setTp(r.tp); setSl(r.sl); setHoldMax(r.hold); }}
                    style={{
                      padding: "6px 8px", background: i === 0 ? "#1e293b" : "#0f172a",
                      borderRadius: 4, fontSize: 11, color: "#cbd5e1",
                      cursor: "pointer",
                      border: i === 0 ? "1px solid #fbbf24" : "1px solid #334155",
                    }}>
                    #{i+1} TP+{r.tp}% / SL-{r.sl}% / {r.hold}일 →
                    <b style={{color:"#10b981", marginLeft:4}}>+{r.avgGain.toFixed(2)}%</b>
                    <span style={{color:"#fbbf24", marginLeft:4}}>승률 {r.winRate.toFixed(0)}%</span>
                    <span style={{color:"#94a3b8", marginLeft:4}}>{r.avgDays.toFixed(1)}일</span>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}

        {optResult === null && optMode && !optimizing && (
          <div style={{
            marginTop: 10, padding: 10,
            background: "#7f1d1d", borderRadius: 6,
            fontSize: 12, color: "#fecaca",
          }}>
            ⚠️ 조건에 맞는 조합 없음. 승률 필터 낮춰보세요.
          </div>
        )}
      </div>

      {/* 슬라이더 */}
      <div style={{
        background:"#1e293b", border:"1px solid #334155",
        borderRadius:10, padding:14, marginBottom:12,
      }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#fbbf24", marginBottom:10 }}>
          📊 매매 조건 수동 조정 ({type.icon} {type.name})
        </div>
        <SliderRow label="🎯 TP (익절 %)" value={tp}
          options={[3, 5, 7, 10, 15, 20, 30]} onChange={setTp} unit="%" color="#10b981" />
        <SliderRow label="🛑 SL (손절 %)" value={sl}
          options={[2, 3, 5, 7, 10]} onChange={setSl} unit="%" color="#ef4444" />
        <SliderRow label="⏰ 최대 보유" value={holdMax}
          options={[3, 5, 10, 15, 20, 25, 30]} onChange={setHoldMax} unit="일" color="#0ea5e9" />
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
function matchAllTypes(input, customCriteria) {
  return PATTERN_TYPES.map(t => {
    const c = (customCriteria && customCriteria[t.id]) || DEFAULT_CRITERIA[t.id];
    const reasons = [];
    let score = 0;
    const total = 100;

    // 1. 등락률 (20점)
    if (input.ch >= c.chMin && input.ch <= c.chMax) {
      score += 20;
      reasons.push({ ok: true, text: `등락률 +${input.ch}% (범위 +${c.chMin}~${c.chMax}%) ✓` });
    } else {
      const dist = Math.min(Math.abs(input.ch - c.chMin), Math.abs(input.ch - c.chMax));
      score += Math.max(0, 20 * (1 - dist / 10));
      reasons.push({ ok: false, text: `등락률 +${input.ch}% (범위 +${c.chMin}~${c.chMax}% 벗어남) ✗` });
    }

    // 2. 거래대금 (15점)
    if (input.amt >= c.amtMin && input.amt <= c.amtMax) {
      score += 15;
      reasons.push({ ok: true, text: `거래대금 ${input.amt}억 (범위 ${c.amtMin}~${c.amtMax === 99999 ? "무제한" : c.amtMax+"억"}) ✓` });
    } else if (input.amt > 0) {
      const ratio = input.amt < c.amtMin ? input.amt / c.amtMin : (c.amtMax === 99999 ? 1 : c.amtMax / input.amt);
      score += 15 * Math.max(0, ratio);
      reasons.push({ ok: false, text: `거래대금 ${input.amt}억 (범위 벗어남) ✗` });
    }

    // 3. 60일 신고가 (10점)
    if (c.h60 === "req") {
      if (input.h60) { score += 10; reasons.push({ ok: true, text: `60일 신고가 갱신 (필수) ✓` }); }
      else reasons.push({ ok: false, text: `60일 신고가 미갱신 (필수인데) ✗` });
    } else if (c.h60 === "no") {
      if (!input.h60) { score += 10; reasons.push({ ok: true, text: `60일 신고가 X (박스권) ✓` }); }
      else reasons.push({ ok: false, text: `60일 신고가 갱신 (박스권 X) ✗` });
    } else { score += 5; reasons.push({ ok: true, text: `60일 신고가: 무관` }); }

    // 4. 120일 신고가 (8점)
    if (c.h120 === "req") {
      if (input.h120) { score += 8; reasons.push({ ok: true, text: `120일 신고가 갱신 ✓` }); }
      else reasons.push({ ok: false, text: `120일 신고가 미갱신 ✗` });
    } else if (c.h120 === "no") {
      if (!input.h120) { score += 8; reasons.push({ ok: true, text: `120일 신고가 X ✓` }); }
      else reasons.push({ ok: false, text: `120일 신고가 갱신 ✗` });
    } else { score += 4; }

    // 5. 박스권 (10점)
    if (c.isBox === "req") {
      if (input.aiBox || input.isBox) { score += 10; reasons.push({ ok: true, text: `박스권 ✓` }); }
      else reasons.push({ ok: false, text: `박스권 아님 (필수인데) ✗` });
    } else if (c.isBox === "no") {
      if (!input.aiBox && !input.isBox) { score += 10; reasons.push({ ok: true, text: `박스권 X ✓` }); }
      else reasons.push({ ok: false, text: `박스권 (필수 X) ✗` });
    } else { score += 5; }

    // 6. 매물대 돌파 (8점)
    if (c.isBreakout === "req") {
      if (input.aiBreakout || input.isBreakout) { score += 8; reasons.push({ ok: true, text: `매물대 돌파 ✓` }); }
      else reasons.push({ ok: false, text: `매물대 돌파 X (필수) ✗` });
    } else if (c.isBreakout === "no") {
      if (!input.aiBreakout && !input.isBreakout) score += 8;
    } else { score += 4; }

    // 7. 정배열 (8점)
    if (c.isUptrend === "req") {
      if (input.isUptrend) { score += 8; reasons.push({ ok: true, text: `정배열 ✓` }); }
      else reasons.push({ ok: false, text: `정배열 X (필수) ✗` });
    } else if (c.isUptrend === "no") {
      if (!input.isUptrend) score += 8;
    } else { score += 4; }

    // 8. V자 반등 (6점)
    if (c.isVRev === "req") {
      if (input.aiVrev || input.isVRev) { score += 6; reasons.push({ ok: true, text: `V자 반등 ✓` }); }
      else reasons.push({ ok: false, text: `V자 반등 X (필수) ✗` });
    } else if (c.isVRev === "no") {
      if (!input.aiVrev && !input.isVRev) score += 6;
    } else { score += 3; }

    // 9. 시그널 빈도 (6점)
    const sigs = input.sigs || 0;
    if (sigs >= c.sigsMin && sigs <= (c.sigsMax || 99)) {
      score += 6;
      if (c.sigsMin > 0) reasons.push({ ok: true, text: `시그널 ${sigs}회 (${c.sigsMin}회+) ✓` });
    } else {
      reasons.push({ ok: false, text: `시그널 ${sigs}회 (요건 ${c.sigsMin}~${c.sigsMax}회) ✗` });
    }

    // 10. 윗꼬리 (4점)
    if ((input.wick || 0) <= (c.wickMax || 10)) {
      score += 4;
    } else {
      reasons.push({ ok: false, text: `윗꼬리 ${input.wick}% (max ${c.wickMax}%) ✗` });
    }

    // 11. 수급 (5점)
    if (c.ivAllowed && c.ivAllowed.includes(input.iv)) {
      const ivScore = input.iv === "기+외" ? 5 : input.iv === "외만" ? 4 : input.iv === "기만" ? 2 : 1;
      score += ivScore;
      reasons.push({ ok: true, text: `수급 ${input.iv} ✓` });
    } else {
      reasons.push({ ok: false, text: `수급 ${input.iv} (허용 X) ✗` });
    }

    return { typeId: t.id, type: t, match: Math.round(score), reasons };
  }).sort((a, b) => b.match - a.match);
}

function DefinitionsTab({
  customCriteria, userPatterns,
  onSaveCriteria, onResetCriteria, onAutoAdjust,
  onSaveUserPattern, onDeleteUserPattern, onZoomImg,
}) {
  const [imgB64, setImgB64] = useState("");
  const [stockName, setStockName] = useState("");
  const [ch, setCh] = useState(15);
  const [amt, setAmt] = useState(800);
  const [h60, setH60] = useState(false);
  const [h120, setH120] = useState(false);
  const [sigs, setSigs] = useState(2);
  const [wick, setWick] = useState(2);
  const [iv, setIv] = useState("기+외");
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [results, setResults] = useState(null);

  // 어떤 타입의 기준 편집 영역이 펼쳐져 있는지
  const [editingType, setEditingType] = useState(null);

  function onFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => setImgB64(ev.target.result);
    r.readAsDataURL(f);
  }

  async function aiAnalyze() {
    if (!imgB64) { alert("먼저 차트 이미지를 업로드하세요"); return; }
    setAiAnalyzing(true);
    setAiError(null);
    setAiSummary(null);
    setResults(null);
    try {
      const m = imgB64.match(/^data:(image\/[a-z]+);base64,(.+)$/);
      if (!m) throw new Error("이미지 형식 오류");
      const mediaType = m[1];
      const data = m[2];

      const prompt = `당신은 한국 주식 차트 분석 전문가입니다. 첨부된 일봉 차트 이미지를 매우 정밀하게 분석하세요.

⚠️ 중요한 규칙:
1. 추측하지 마세요. 차트에 명시되지 않은 값은 null로 반환하세요.
2. 한국 차트 특성: 빨간색=상승, 파란색=하락 (서구와 반대)
3. 가장 우측의 가장 큰 빨간 양봉이 시그널입니다.
4. 등락률은 차트 상단/하단의 텍스트 또는 봉 옆 라벨에 표시됩니다. 텍스트가 보이지 않으면 null.
5. 거래대금은 차트 하단 거래량 막대 아래의 숫자/Y축 라벨을 정확히 읽으세요.
   - 한국 차트는 보통 "백만원" 또는 "원" 단위. "억" 단위 환산:
     · 거래량(주식수) × 가격 / 100,000,000 = 거래대금(억원)
     · 또는 거래대금 표시가 직접 있으면 단위를 정확히 환산하세요.
   - 예: "70,000,000,000원" = 700억원, "7,000,000,000,000원" = 7000억원 = 7조
   - 거래대금 라벨이 없으면 null. 절대 추측하지 마세요.

추출할 정보:
- ch (number|null): 시그널 양봉의 정확한 등락률 % (소수점 둘째자리까지). 차트에 명시된 값만. 모르면 null.
- amt (number|null): 시그널 일자 거래대금을 "억원" 단위로. 차트에 명시된 거래대금/거래량 라벨에서 정확히 추출. 환산 못하면 null.
- price (number|null): 시그널 봉의 종가 (원). 라벨에 보이는 값.
- h60 (boolean): 시그널 직전 60일(약 3개월) 최고가를 갱신했는지
- h120 (boolean): 시그널 직전 120일(약 6개월) 최고가를 갱신했는지
- box (boolean): 박스권 차트인지
- box_months (number): 박스권 기간 (개월수, 0이면 박스권 아님)
- left_signal (boolean): 좌측에 비슷한 큰 양봉이 있는지
- left_signal_count (number): 좌측 시그널 횟수 (없으면 0)
- vrev (boolean): 1년+ 하락 후 V자 반등인지
- breakout (boolean): 박스권 매물대를 위로 돌파했는지
- iv (string): 수급 추정. 차트만 보고는 모름. "차트만으로 추정 어려움"이면 null. 거래대금이 폭증한 시그널이면 "기+외" 추정 가능.
- wick (number|null): 시그널 봉의 윗꼬리 % = (고가-종가)/시가 × 100. 봉 모양 보고 추정. 모르면 null.
- description (string): 차트 한 줄 설명
- confidence (number): 분석 자신감 0~100. 차트가 흐릿하거나 라벨이 안 보이면 50 미만.
- notes (string): 분석 시 어려웠던 부분 또는 추정 근거

JSON만 반환:
{"ch":16.67,"amt":1108,"price":12500,"h60":false,"h120":false,"box":true,"box_months":11,"left_signal":false,"left_signal_count":0,"vrev":false,"breakout":true,"iv":"기+외","wick":2,"description":"11개월 박스권 후 거래대금 30배 폭증 양봉","confidence":85,"notes":"등락률 라벨 명확, 거래대금 막대로 추정"}`;

      const res = await fetch(SECTOR_API + "/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000,
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
      const text = (json.content || []).filter(c => c.type === "text").map(c => c.text).join("");
      let parsed;
      try {
        const cleaned = text.replace(/```json|```/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch (e) {
        throw new Error("JSON 파싱 실패: " + text.slice(0, 200));
      }

      // null이 아닌 값만 폼에 채우기 (사용자가 채운 값 보존)
      if (parsed.ch != null) setCh(parsed.ch);
      if (parsed.amt != null) setAmt(parsed.amt);
      if (parsed.h60 != null) setH60(!!parsed.h60);
      if (parsed.h120 != null) setH120(!!parsed.h120);
      if (parsed.iv) setIv(parsed.iv);
      if (parsed.wick != null) setWick(parsed.wick);
      if (parsed.left_signal_count != null) setSigs((parsed.left_signal_count || 0) + 1);

      setAiSummary(parsed);

      const input = {
        ch: parsed.ch ?? ch, amt: parsed.amt ?? amt,
        h60: !!parsed.h60, h120: !!parsed.h120,
        sigs: (parsed.left_signal_count || 0) + 1,
        wick: parsed.wick ?? wick, iv: parsed.iv || iv,
        aiBox: !!parsed.box, aiBreakout: !!parsed.breakout, aiVrev: !!parsed.vrev,
        aiLeftSignal: !!parsed.left_signal,
      };
      const ranked = matchAllTypes(input, customCriteria);
      setResults({ input, ranked });
    } catch (e) {
      setAiError(e.message);
    } finally {
      setAiAnalyzing(false);
    }
  }

  function manualAnalyze() {
    const input = {
      ch: parseFloat(ch), amt: parseFloat(amt),
      h60, h120, sigs: parseInt(sigs) || 0,
      wick: parseFloat(wick), iv,
    };
    const ranked = matchAllTypes(input, customCriteria);
    setResults({ input, ranked });
    setAiSummary(null);
  }

  async function saveToType(typeId) {
    const pattern = {
      typeId,
      name: stockName || (aiSummary && aiSummary.description ? aiSummary.description.slice(0, 30) : "이름 없음"),
      img: imgB64,
      ch: parseFloat(ch), amt: parseFloat(amt),
      h60, h120, sigs: parseInt(sigs) || 0,
      wick: parseFloat(wick), iv,
      aiSummary,
      addedAt: new Date().toISOString(),
    };
    await onSaveUserPattern(pattern);
    alert("✅ TYPE " + typeId + "에 추가됨");
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* AI 자동 분석 */}
      <div style={{
        padding: 14, background: "#1e293b",
        border: "2px solid #fbbf24", borderRadius: 10,
      }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#fbbf24", marginBottom: 4 }}>
          🤖 AI 차트 분석
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
          차트 업로드 → AI가 자동 분석 → 5타입 매칭 ·
          <b style={{color:"#10b981"}}> 95%+면 학습 데이터 추가</b>
        </div>

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
              onClick={() => onZoomImg({ img: imgB64, name: stockName || "업로드한 차트" })}
              style={{ maxWidth: "100%", maxHeight: 250, borderRadius: 4, cursor: "zoom-in" }} />
          </div>
        )}

        <button onClick={aiAnalyze} disabled={!imgB64 || aiAnalyzing}
          style={{
            width: "100%", padding: "14px",
            background: aiAnalyzing ? "#475569" : !imgB64 ? "#334155" : "#fbbf24",
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

        {aiSummary && (
          <div style={{
            padding: 12, background: "#0f172a",
            border: "1px solid #fbbf24", borderRadius: 6,
            marginBottom: 10, fontSize: 12, color: "#cbd5e1",
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 6,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24" }}>
                🤖 AI 분석 결과
              </div>
              {aiSummary.confidence != null && (
                <div style={{
                  fontSize: 11, fontWeight: 700,
                  color: aiSummary.confidence >= 80 ? "#10b981" :
                         aiSummary.confidence >= 50 ? "#fbbf24" : "#ef4444",
                  border: "1px solid",
                  borderColor: aiSummary.confidence >= 80 ? "#10b981" :
                               aiSummary.confidence >= 50 ? "#fbbf24" : "#ef4444",
                  padding: "2px 6px", borderRadius: 3,
                }}>
                  자신감 {aiSummary.confidence}%
                </div>
              )}
            </div>
            {aiSummary.description && (
              <div style={{ marginBottom: 6, fontStyle: "italic", color: "#fff" }}>
                "{aiSummary.description}"
              </div>
            )}
            {aiSummary.confidence != null && aiSummary.confidence < 70 && (
              <div style={{
                padding: 6, background: "#7f1d1d",
                borderRadius: 4, fontSize: 11, color: "#fecaca",
                marginBottom: 6,
              }}>
                ⚠️ AI 자신감이 낮습니다. 아래 폼에서 직접 수정하세요.
              </div>
            )}
            {aiSummary.notes && (
              <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 6 }}>
                📝 {aiSummary.notes}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              <div>등락: <b style={{color:aiSummary.ch!=null?"#10b981":"#ef4444"}}>
                {aiSummary.ch != null ? "+" + aiSummary.ch + "%" : "❌ 인식 실패"}
              </b></div>
              <div>거래대금: <b style={{color:aiSummary.amt!=null?"#10b981":"#ef4444"}}>
                {aiSummary.amt != null ? aiSummary.amt + "억" : "❌ 인식 실패"}
              </b></div>
              <div>박스권: <b style={{color:aiSummary.box?"#10b981":"#94a3b8"}}>
                {aiSummary.box ? "O (" + aiSummary.box_months + "개월)" : "X"}
              </b></div>
              <div>매물대 돌파: <b style={{color:aiSummary.breakout?"#ec4899":"#94a3b8"}}>
                {aiSummary.breakout ? "O" : "X"}
              </b></div>
              <div>V자 반등: <b style={{color:aiSummary.vrev?"#0ea5e9":"#94a3b8"}}>
                {aiSummary.vrev ? "O" : "X"}
              </b></div>
              <div>좌측 시그널: <b style={{color:aiSummary.left_signal?"#fbbf24":"#94a3b8"}}>
                {aiSummary.left_signal ? aiSummary.left_signal_count + "회" : "X"}
              </b></div>
              <div>60일 신고가: <b>{aiSummary.h60?"O":"X"}</b></div>
              <div>120일 신고가: <b>{aiSummary.h120?"O":"X"}</b></div>
              <div>수급: <b>{aiSummary.iv || "❓ 불명"}</b></div>
              <div>윗꼬리: <b>{aiSummary.wick != null ? aiSummary.wick + "%" : "❓"}</b></div>
            </div>
          </div>
        )}

        {/* 종목명 입력 */}
        <input type="text" value={stockName} onChange={e => setStockName(e.target.value)}
          placeholder="종목명 (학습 추가 시 사용)"
          style={{
            width: "100%", padding: 10, fontSize: 13,
            background: "#0f172a", color: "#fff",
            border: "1px solid #475569", borderRadius: 6,
            marginBottom: 10, boxSizing: "border-box",
          }} />

        {/* 사용자 수정 폼 — 항상 펼쳐짐 (AI 결과 수정 우선순위 높음) */}
        <div style={{
          padding: 12, background: "#0f172a",
          border: "1px solid #10b981", borderRadius: 6,
          marginTop: 8,
        }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: "#10b981", marginBottom: 8,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span>✏️ 데이터 수정 ({aiSummary ? "AI 결과를 직접 수정하세요" : "직접 입력"})</span>
          </div>

          {/* 등락률 — 직접 숫자 입력 */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: "#cbd5e1", marginBottom: 4 }}>
              등락률 (%) — 차트의 정확한 값
            </div>
            <input type="number" value={ch} step="0.01"
              onChange={e => setCh(parseFloat(e.target.value) || 0)}
              style={{
                width: "100%", padding: 8, fontSize: 14, fontWeight: 700,
                background: "#1e293b", color: "#10b981",
                border: "1px solid #334155", borderRadius: 4, boxSizing: "border-box",
              }} />
          </div>

          {/* 거래대금 — 직접 숫자 입력 */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: "#cbd5e1", marginBottom: 4 }}>
              거래대금 (억원) — 7000억이면 7000 입력
            </div>
            <input type="number" value={amt}
              onChange={e => setAmt(parseFloat(e.target.value) || 0)}
              style={{
                width: "100%", padding: 8, fontSize: 14, fontWeight: 700,
                background: "#1e293b", color: "#fbbf24",
                border: "1px solid #334155", borderRadius: 4, boxSizing: "border-box",
              }} />
          </div>

          {/* 윗꼬리 — 직접 숫자 입력 */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: "#cbd5e1", marginBottom: 4 }}>
              윗꼬리 (%)
            </div>
            <input type="number" value={wick} step="0.1"
              onChange={e => setWick(parseFloat(e.target.value) || 0)}
              style={{
                width: "100%", padding: 8, fontSize: 14, fontWeight: 700,
                background: "#1e293b", color: "#a855f7",
                border: "1px solid #334155", borderRadius: 4, boxSizing: "border-box",
              }} />
          </div>

          {/* 시그널 빈도 */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: "#cbd5e1", marginBottom: 4 }}>
              시그널 빈도 (회) — 좌측 시그널 + 1
            </div>
            <input type="number" value={sigs}
              onChange={e => setSigs(parseInt(e.target.value) || 0)}
              style={{
                width: "100%", padding: 8, fontSize: 14, fontWeight: 700,
                background: "#1e293b", color: "#0ea5e9",
                border: "1px solid #334155", borderRadius: 4, boxSizing: "border-box",
              }} />
          </div>

          {/* 체크박스 */}
          <div style={{ display: "flex", gap: 12, padding: "10px 0", fontSize: 13, color: "#cbd5e1", flexWrap: "wrap" }}>
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

          {/* 수급 */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 6 }}>수급</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["기+외", "외만", "기만", "둘다-"].map(opt => (
                <button key={opt} onClick={() => setIv(opt)}
                  style={{
                    flex: 1, minWidth: 70,
                    background: iv === opt ? "#10b981" : "#1e293b",
                    color: iv === opt ? "#fff" : "#94a3b8",
                    border: "1px solid " + (iv === opt ? "#10b981" : "#334155"),
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
              width: "100%", padding: "12px",
              background: "#0ea5e9", color: "#fff",
              border: "none", borderRadius: 6,
              fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>
            🎯 수정한 데이터로 5타입 비교 (재계산)
          </button>
        </div>
      </div>

      {/* 결과 */}
      {results && (
        <div style={{
          padding: 14, background: "#1e293b",
          border: "1px solid #334155", borderRadius: 10,
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#fbbf24", marginBottom: 10 }}>
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

      {/* 5타입 정의 + 편집 + 학습 차트 그리드 */}
      {PATTERN_TYPES.map(t => {
        const c = customCriteria[t.id] || DEFAULT_CRITERIA[t.id];
        const userList = userPatterns[t.id] || [];
        const isCustomized = JSON.stringify(c) !== JSON.stringify(DEFAULT_CRITERIA[t.id]);
        const editing = editingType === t.id;

        return (
          <div key={t.id} style={{
            padding: 14, background: "#1e293b",
            border: "2px solid " + t.color, borderRadius: 10,
          }}>
            <div style={{
              fontSize: 18, fontWeight: 800, color: t.color, marginBottom: 6,
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6,
            }}>
              <div>
                {t.icon} TYPE {t.id} · {t.name}
                {userList.length > 0 && (
                  <span style={{
                    fontSize: 11, color: "#10b981",
                    marginLeft: 8, fontWeight: 700,
                  }}>
                    +{userList.length} 학습됨
                  </span>
                )}
                {isCustomized && (
                  <span style={{
                    fontSize: 10, color: "#fbbf24",
                    marginLeft: 6, fontWeight: 700,
                    border: "1px solid #fbbf24", padding: "1px 5px", borderRadius: 3,
                  }}>
                    수정됨
                  </span>
                )}
              </div>
            </div>

            <div style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 8 }}>
              {t.desc}
            </div>

            {/* 기준 표시 */}
            <div style={{
              padding: 10, background: "#0f172a", borderRadius: 6,
              fontSize: 12, color: "#94a3b8", marginBottom: 8,
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: 6,
              }}>
                <b style={{color:"#fbbf24"}}>📋 매칭 기준</b>
                <button onClick={() => setEditingType(editing ? null : t.id)}
                  style={{
                    background: editing ? "#ef4444" : "#fbbf24",
                    color: editing ? "#fff" : "#0f172a",
                    border: "none", borderRadius: 4,
                    padding: "4px 10px", fontSize: 11, fontWeight: 700,
                    cursor: "pointer",
                  }}>
                  {editing ? "✗ 닫기" : "✏️ 기준 수정"}
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 12px" }}>
                <div>등락률: +{c.chMin}~{c.chMax}%</div>
                <div>거래대금: {c.amtMin}~{c.amtMax === 99999 ? "∞" : c.amtMax}억</div>
                <div>60일 신고가: {labelRule(c.h60)}</div>
                <div>120일 신고가: {labelRule(c.h120)}</div>
                <div>박스권: {labelRule(c.isBox)}</div>
                <div>매물대 돌파: {labelRule(c.isBreakout)}</div>
                <div>정배열: {labelRule(c.isUptrend)}</div>
                <div>V자 반등: {labelRule(c.isVRev)}</div>
                <div>60일 변동폭: {c.range60Min}~{c.range60Max}%</div>
                <div>시그널 빈도: {c.sigsMin}~{c.sigsMax === 99 ? "∞" : c.sigsMax}회</div>
                <div>윗꼬리 max: {c.wickMax}%</div>
                <div>수급: {c.ivAllowed.length === 4 ? "모두 허용" : c.ivAllowed.join(",")}</div>
              </div>
            </div>

            {/* 기준 편집 영역 */}
            {editing && (
              <CriteriaEditor
                typeId={t.id} criteria={c}
                userPatternCount={userList.length}
                onSave={(newC) => { onSaveCriteria(t.id, newC); setEditingType(null); }}
                onReset={() => { onResetCriteria(t.id); setEditingType(null); }}
                onAutoAdjust={() => onAutoAdjust(t.id)}
              />
            )}

            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
              <b style={{color:"#fbbf24"}}>기본 예시 종목</b><br/>
              {t.examples}
            </div>

            {/* 학습된 사용자 차트 그리드 (큰 이미지) */}
            {userList.length > 0 && (
              <div style={{
                marginTop: 10, padding: 10,
                background: "#0f172a", borderRadius: 6,
                border: "1px dashed #10b981",
              }}>
                <div style={{ fontSize: 12, color: "#10b981", fontWeight: 700, marginBottom: 8 }}>
                  🎓 내가 학습시킨 차트 ({userList.length}개) · 탭하여 확대
                </div>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                  gap: 8,
                }}>
                  {userList.map(u => (
                    <div key={u.key} style={{
                      background: "#1e293b", borderRadius: 6,
                      overflow: "hidden", position: "relative",
                    }}>
                      {u.img && (
                        <img src={u.img} alt={u.name}
                          onClick={() => onZoomImg(u)}
                          style={{
                            width: "100%", height: 90, objectFit: "cover",
                            cursor: "zoom-in", display: "block",
                          }} />
                      )}
                      <div style={{ padding: "6px 8px" }}>
                        <div style={{
                          fontSize: 11, fontWeight: 700, color: "#fbbf24",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {u.name}
                        </div>
                        <div style={{ fontSize: 10, color: "#94a3b8" }}>
                          +{u.ch}% · {u.amt}억 · {u.iv}
                        </div>
                      </div>
                      <button onClick={() => {
                        if (confirm("삭제하시겠습니까?")) onDeleteUserPattern(u.key, t.id);
                      }}
                        style={{
                          position: "absolute", top: 4, right: 4,
                          background: "rgba(239,68,68,0.9)", color: "#fff",
                          border: "none", borderRadius: 4,
                          width: 22, height: 22, fontSize: 11,
                          cursor: "pointer", fontWeight: 700,
                        }}>
                        ×
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

function labelRule(r) {
  if (r === "req") return "필수";
  if (r === "no") return "X (금지)";
  return "무관";
}

// 풀세트 필터 편집 UI
function CriteriaEditor({ typeId, criteria, userPatternCount, onSave, onReset, onAutoAdjust }) {
  const [c, setC] = useState(JSON.parse(JSON.stringify(criteria)));

  function set(k, v) { setC(prev => ({ ...prev, [k]: v })); }
  function toggleIv(opt) {
    const has = c.ivAllowed.includes(opt);
    set("ivAllowed", has ? c.ivAllowed.filter(x => x !== opt) : [...c.ivAllowed, opt]);
  }

  const ruleOptions = [
    { v: "req", label: "필수", color: "#10b981" },
    { v: "no", label: "금지", color: "#ef4444" },
    { v: "any", label: "무관", color: "#64748b" },
  ];

  function RuleSelector({ label, value, onChange }) {
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 4 }}>{label}</div>
        <div style={{ display: "flex", gap: 4 }}>
          {ruleOptions.map(o => (
            <button key={o.v} onClick={() => onChange(o.v)}
              style={{
                flex: 1, padding: "6px 8px", fontSize: 12, fontWeight: 700,
                background: value === o.v ? o.color : "#1e293b",
                color: value === o.v ? "#fff" : "#94a3b8",
                border: "1px solid " + (value === o.v ? o.color : "#334155"),
                borderRadius: 4, cursor: "pointer",
              }}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  function NumRow({ label, k1, k2, unit, max }) {
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 4 }}>{label}</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="number" value={c[k1]} onChange={e => set(k1, parseFloat(e.target.value) || 0)}
            style={{
              flex: 1, padding: 8, fontSize: 13,
              background: "#1e293b", color: "#fff",
              border: "1px solid #334155", borderRadius: 4, boxSizing: "border-box",
            }} />
          <span style={{ color: "#64748b", fontSize: 12 }}>~</span>
          <input type="number" value={c[k2]} onChange={e => set(k2, parseFloat(e.target.value) || 0)}
            style={{
              flex: 1, padding: 8, fontSize: 13,
              background: "#1e293b", color: "#fff",
              border: "1px solid #334155", borderRadius: 4, boxSizing: "border-box",
            }} />
          <span style={{ color: "#94a3b8", fontSize: 11, minWidth: 28 }}>{unit}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: 12, background: "#1e293b",
      border: "1px solid #fbbf24", borderRadius: 6,
      marginBottom: 10,
    }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#fbbf24", marginBottom: 10 }}>
        ✏️ 풀세트 필터 — TYPE {typeId} 매칭 기준 수정
      </div>

      <NumRow label="등락률 (%)" k1="chMin" k2="chMax" unit="%" />
      <NumRow label="거래대금 (억)" k1="amtMin" k2="amtMax" unit="억" />
      <NumRow label="60일 변동폭 (%)" k1="range60Min" k2="range60Max" unit="%" />
      <NumRow label="시그널 빈도 (회)" k1="sigsMin" k2="sigsMax" unit="회" />

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 4 }}>윗꼬리 max (%)</div>
        <input type="number" value={c.wickMax} onChange={e => set("wickMax", parseFloat(e.target.value) || 0)}
          style={{
            width: "100%", padding: 8, fontSize: 13,
            background: "#1e293b", color: "#fff",
            border: "1px solid #334155", borderRadius: 4, boxSizing: "border-box",
          }} />
      </div>

      <RuleSelector label="60일 신고가" value={c.h60} onChange={v => set("h60", v)} />
      <RuleSelector label="120일 신고가" value={c.h120} onChange={v => set("h120", v)} />
      <RuleSelector label="박스권 (60일 변동폭 작음)" value={c.isBox} onChange={v => set("isBox", v)} />
      <RuleSelector label="매물대 돌파 (박스권 위 돌파)" value={c.isBreakout} onChange={v => set("isBreakout", v)} />
      <RuleSelector label="정배열 추세 (60일 신고가+상승)" value={c.isUptrend} onChange={v => set("isUptrend", v)} />
      <RuleSelector label="V자 반등 (60일 평균 미만 반등)" value={c.isVRev} onChange={v => set("isVRev", v)} />

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 4 }}>수급 허용 (다중 선택)</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {["기+외", "외만", "기만", "둘다-"].map(opt => {
            const sel = c.ivAllowed.includes(opt);
            return (
              <button key={opt} onClick={() => toggleIv(opt)}
                style={{
                  flex: 1, minWidth: 70,
                  padding: "6px 8px", fontSize: 12, fontWeight: 700,
                  background: sel ? "#10b981" : "#0f172a",
                  color: sel ? "#fff" : "#94a3b8",
                  border: "1px solid " + (sel ? "#10b981" : "#334155"),
                  borderRadius: 4, cursor: "pointer",
                }}>
                {sel ? "✓ " : ""}{opt}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 12 }}>
        <button onClick={() => onSave(c)}
          style={{
            padding: "10px", background: "#10b981", color: "#fff",
            border: "none", borderRadius: 6, fontSize: 13, fontWeight: 800, cursor: "pointer",
          }}>
          💾 기준 저장
        </button>
        <button onClick={onReset}
          style={{
            padding: "10px", background: "#475569", color: "#fff",
            border: "none", borderRadius: 6, fontSize: 13, fontWeight: 800, cursor: "pointer",
          }}>
          🔄 기본값 복원
        </button>
      </div>

      {userPatternCount >= 2 && (
        <button onClick={onAutoAdjust}
          style={{
            width: "100%", marginTop: 8, padding: "10px",
            background: "#fbbf24", color: "#0f172a",
            border: "none", borderRadius: 6, fontSize: 13, fontWeight: 800, cursor: "pointer",
          }}>
          🎓 내 학습 차트 {userPatternCount}개로 자동 조정
        </button>
      )}
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
  const c = sig.criteria || sig.type.criteria || DEFAULT_CRITERIA[sig.type.id];
  const v = sig.verify;
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

        {/* 박스권 / 추세 검증 디버그 */}
        {v && (
          <div style={{
            padding: 12, background: "#0f172a",
            border: "1px solid #fbbf24", borderRadius: 8,
            marginBottom: 14,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24", marginBottom: 8 }}>
              🔬 박스권 / 추세 검증 (60일 일봉 기준)
            </div>
            <div style={{
              fontSize: 12, color: "#10b981", fontWeight: 700,
              padding: "6px 10px", background: "#1e293b",
              borderRadius: 4, marginBottom: 8,
            }}>
              💡 {v.reason}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", fontSize: 11, color: "#cbd5e1" }}>
              <div>오늘 종가: <b>{v.todayClose.toLocaleString()}원</b></div>
              <div>60일 평균: <b>{v.avg60.toLocaleString()}원</b></div>
              <div>60일 최고가: <b style={{color:"#10b981"}}>{v.high60.toLocaleString()}</b></div>
              <div>60일 최저가: <b style={{color:"#ef4444"}}>{v.low60.toLocaleString()}</b></div>
              <div>60일 변동폭: <b style={{color:v.range60>30?"#a855f7":"#10b981"}}>{v.range60}%</b></div>
              <div>평균 대비: <b style={{color:v.closeVsAvg>115?"#a855f7":v.closeVsAvg<85?"#ef4444":"#10b981"}}>
                {v.closeVsAvg > 100 ? "+" : ""}{(v.closeVsAvg - 100).toFixed(1)}%
              </b></div>
              <div>고가 대비: <b>{v.closeVsHigh}%</b></div>
              <div>저가 대비: <b>+{(v.closeVsLow - 100).toFixed(0)}%</b></div>
              <div>60일 신고가: <b style={{color:v.h60?"#a855f7":"#94a3b8"}}>{v.h60?"O (갱신 근처)":"X"}</b></div>
              <div>120일 신고가: <b style={{color:v.h120?"#a855f7":"#94a3b8"}}>{v.h120?"O":"X"}</b></div>
              <div>📦 박스권: <b style={{color:v.isBox?"#10b981":"#94a3b8"}}>{v.isBox?"YES":"NO"}</b></div>
              <div>🚀 박스 돌파: <b style={{color:v.isBreakout?"#ec4899":"#94a3b8"}}>{v.isBreakout?"YES":"NO"}</b></div>
              <div>📈 정배열: <b style={{color:v.isUptrend?"#a855f7":"#94a3b8"}}>{v.isUptrend?"YES":"NO"}</b></div>
              <div>🔄 V자 반등: <b style={{color:v.isVRev?"#0ea5e9":"#94a3b8"}}>{v.isVRev?"YES":"NO"}</b></div>
              <div>시그널 빈도: <b>{v.sigs}회 (60일)</b></div>
            </div>
            <div style={{
              marginTop: 8, padding: "6px 10px",
              background: "#1e293b", borderRadius: 4,
              fontSize: 10, color: "#64748b",
            }}>
              📦 박스권 = 변동폭 &lt; 30% + 신고가 X + 평균 ±15% 안<br/>
              📈 정배열 = 60일 신고가 OR (변동폭 30%+ AND 평균 +10%↑)<br/>
              🔄 V자 반등 = 평균 92% 미만 + 신고가 X
            </div>
          </div>
        )}

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
