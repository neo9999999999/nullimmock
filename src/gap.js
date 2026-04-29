// gap.js — 갭 분석 핵심 로직
//
// trades.json의 ohlc 데이터에서 일일 갭 추출:
// - 갭 % = (오늘 시가 - 어제 종가) / 어제 종가 (정규화)
// - 사전 조건 (어제 등락, 시그널 정보)
// - 갭 발생 후 그날 결과 (시초매도 vs 종가 보유)

// 모든 일일 캔들 (어제 → 오늘) 추출
export function extractAllDays(trades) {
  const days = [];
  for (const t of trades) {
    if (!t.ohlc || t.ohlc.length < 2) continue;
    for (let i = 1; i < t.ohlc.length; i++) {
      const prev = t.ohlc[i - 1];
      const curr = t.ohlc[i];
      const gap = (curr[1] - prev[4]) / (1 + prev[4] / 100);
      const prevPnl = i >= 2 ? (prev[4] - t.ohlc[i - 2][4]) : prev[4];
      const todayPnl = (curr[4] - prev[4]) / (1 + prev[4] / 100);

      days.push({
        stockName: t.name,
        market: t.market,
        signalCh: t.refCh,
        signalAmt: t.refAmt,
        totalSignals: t.totalSignals,
        pattern: t.pattern,
        iv: t.iv,
        h60: t.h60,
        h120: t.h120,

        refDate: t.refDate,
        prevDate: prev[0],
        gapDate: curr[0],
        dayIdx: i,

        prevClose: prev[4],
        prevOpen: prev[1],
        prevWasBull: prev[4] > prev[1],
        prevPnl,                      // 어제 일간 등락률 (% pt 근사)

        currOpen: curr[1],
        currHigh: curr[2],
        currLow: curr[3],
        currClose: curr[4],

        gap,                          // 어제 종가 → 오늘 시가 %
        todayPnl,                     // 어제 종가 → 오늘 종가 %
        gapHeld: curr[4] >= curr[1],  // 갭 유지 (양봉)
      });
    }
  }
  return days;
}

// YYYYMMDD → YY-MM-DD 변환
export function fmtDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length < 8) return yyyymmdd || "";
  return yyyymmdd.slice(2, 4) + "-" + yyyymmdd.slice(4, 6) + "-" + yyyymmdd.slice(6, 8);
}

// 갭 임계치 별 통계
export function gapStats(days, threshold) {
  const matched = days.filter(d => d.gap >= threshold);
  if (matched.length === 0) {
    return { n: 0, freq: 0, avgGap: 0, avgDayClose: 0, heldRate: 0,
             avgTodayPnl: 0 };
  }
  let sumGap = 0, sumClose = 0, held = 0, sumPnl = 0;
  for (const m of matched) {
    sumGap += m.gap;
    sumClose += m.currClose;
    if (m.gapHeld) held++;
    sumPnl += m.todayPnl;
  }
  return {
    n: matched.length,
    freq: matched.length / days.length * 100,
    avgGap: sumGap / matched.length,
    avgDayClose: sumClose / matched.length,
    heldRate: held / matched.length * 100,
    avgTodayPnl: sumPnl / matched.length,
  };
}

// 종목별 갭 발생 횟수 집계
export function byStock(days, threshold) {
  const matched = days.filter(d => d.gap >= threshold);
  const byName = {};
  for (const m of matched) {
    if (!byName[m.stockName]) {
      byName[m.stockName] = {
        name: m.stockName,
        market: m.market,
        totalSignals: m.totalSignals,
        count: 0, sumGap: 0,
      };
    }
    byName[m.stockName].count++;
    byName[m.stockName].sumGap += m.gap;
  }
  for (const s of Object.values(byName)) {
    s.avgGap = s.sumGap / s.count;
  }
  return Object.values(byName).sort((a, b) => b.count - a.count);
}

// 어제 등락률 분포 (조건부 확률)
export function prevPnlDistribution(days, threshold) {
  const buckets = [
    { label: "↑+10% 이상", min: 10, max: 999 },
    { label: "↑+5~10%", min: 5, max: 10 },
    { label: "↑+3~5%", min: 3, max: 5 },
    { label: "↑+1~3%", min: 1, max: 3 },
    { label: "보합 -1~+1%", min: -1, max: 1 },
    { label: "↓-3~-1%", min: -3, max: -1 },
    { label: "↓-5~-3%", min: -5, max: -3 },
    { label: "↓-10~-5%", min: -10, max: -5 },
    { label: "↓-10% 이하", min: -999, max: -10 },
  ];
  const result = [];
  for (const b of buckets) {
    const total = days.filter(d => d.prevPnl >= b.min && d.prevPnl < b.max).length;
    const hits = days.filter(d => d.prevPnl >= b.min && d.prevPnl < b.max && d.gap >= threshold).length;
    result.push({
      label: b.label,
      total,
      hits,
      rate: total === 0 ? 0 : hits / total * 100,
    });
  }
  return result;
}

// 시그널 빈도 별 갭 발생률
export function bySuperLevel(days, threshold) {
  const buckets = [
    { label: "21회+ 슈퍼", min: 21, max: 999 },
    { label: "11~20회",  min: 11, max: 21 },
    { label: "6~10회",   min: 6, max: 11 },
    { label: "3~5회",    min: 3, max: 6 },
    { label: "1~2회",    min: 1, max: 3 },
  ];
  const result = [];
  for (const b of buckets) {
    const total = days.filter(d => d.totalSignals >= b.min && d.totalSignals < b.max).length;
    const hits = days.filter(d => d.totalSignals >= b.min && d.totalSignals < b.max && d.gap >= threshold).length;
    result.push({
      label: b.label,
      total,
      hits,
      rate: total === 0 ? 0 : hits / total * 100,
    });
  }
  return result;
}

// 어제 종가 매수 시뮬 (갭 발생 시 시초매도 / SL / 종가 만료)
export function simBuyYesterday(days, conditionFn, gapTarget, slPct) {
  const matched = days.filter(conditionFn);
  if (matched.length === 0) {
    return { n: 0, ev: 0, win: 0, hits: 0, sls: 0, expires: 0 };
  }
  let n = 0, sumPnl = 0, wins = 0, hits = 0, sls = 0, expires = 0;
  for (const d of matched) {
    n++;
    if (d.gap >= gapTarget) {
      // 시초가 매도
      hits++;
      wins++;
      sumPnl += d.gap;
      continue;
    }
    // 그날 저가가 SL 도달?
    const dayLow = (d.currLow - d.prevClose) / (1 + d.prevClose / 100);
    if (slPct != null && dayLow <= slPct) {
      sls++;
      sumPnl += slPct;
      continue;
    }
    // 종가 만료
    expires++;
    sumPnl += d.todayPnl;
    if (d.todayPnl > 0) wins++;
  }
  return {
    n, ev: sumPnl / n, win: wins / n * 100,
    hits, sls, expires,
    hitRate: hits / n * 100,
    slRate: sls / n * 100,
    expRate: expires / n * 100,
  };
}
