// lib/simulator.js — 시뮬레이션 + 그리드 서치 (보유일 포함)
// 진입 시점: 진입일 당일 15:20 시장가 매수 (≈종가)

export function simSingle(trade, tp, sl, maxDays) {
  const arr = trade.ohlc;
  const entry = trade.entryPct;
  if (!arr || arr.length === 0) return r0();
  const end = Math.min(maxDays, arr.length);
  let mdd = 0, mddDay = 0;
  for (let i = 0; i < end; i++) {
    const rh = arr[i][2] - entry;
    const rl = arr[i][3] - entry;
    if (rl < mdd) { mdd = rl; mddDay = i + 1; }
    if (rl <= sl) return { pnl: sl, result: "SL", days: i + 1, mdd, mddDay };
    if (rh >= tp) return { pnl: tp, result: "TP", days: i + 1, mdd, mddDay };
  }
  if (end > 0) return { pnl: arr[end - 1][4] - entry, result: "TIMEOUT", days: end, mdd, mddDay };
  return r0();
}

export function simSplit(trade, tp1, tp2, sl, fsl, maxDays) {
  const arr = trade.ohlc;
  const entry = trade.entryPct;
  if (!arr || arr.length === 0) return r0();
  const end = Math.min(maxDays, arr.length);
  let tp1Hit = false, curSl = sl, mdd = 0, mddDay = 0;
  for (let i = 0; i < end; i++) {
    const rh = arr[i][2] - entry;
    const rl = arr[i][3] - entry;
    if (rl < mdd) { mdd = rl; mddDay = i + 1; }
    if (!tp1Hit && rl <= curSl) return { pnl: curSl, result: "SL", days: i + 1, mdd, mddDay };
    if (!tp1Hit && rh >= tp1) {
      tp1Hit = true;
      if (fsl > 0) curSl = 0;
    }
    if (tp1Hit && rh >= tp2) return { pnl: (tp1 + tp2) / 2, result: "TP12", days: i + 1, mdd, mddDay };
    if (tp1Hit && rl <= curSl) return { pnl: (tp1 + curSl) / 2, result: "TP1_BE", days: i + 1, mdd, mddDay };
  }
  if (end > 0) {
    const lastC = arr[end - 1][4] - entry;
    if (tp1Hit) return { pnl: (tp1 + lastC) / 2, result: "TP1_TO", days: end, mdd, mddDay };
    return { pnl: lastC, result: "TIMEOUT", days: end, mdd, mddDay };
  }
  return r0();
}

function r0() { return { pnl: 0, result: "NO_DATA", days: 0, mdd: 0, mddDay: 0 }; }

export function simulate(trade, rule) {
  if (rule.mode === "split") return simSplit(trade, rule.tp1, rule.tp2, rule.sl, rule.fsl || 0, rule.maxDays);
  return simSingle(trade, rule.tp, rule.sl, rule.maxDays);
}

// 통계 (TPSLPanel + StatsCards 양쪽 호환)
export function aggregateStats(trades, rule) {
  if (!trades || trades.length === 0) {
    return emptyStats();
  }
  let cum = 0, wins = 0, tpCnt = 0, slCnt = 0, toCnt = 0;
  let tpDaysSum = 0, slDaysSum = 0, toDaysSum = 0;
  let totalDays = 0, mddSum = 0, worstMdd = 0;
  const tpDist = [0, 0, 0, 0]; // [1-3d, 4-7d, 8-14d, 15-20d]

  for (const t of trades) {
    const r = simulate(t, rule);
    cum += r.pnl;
    totalDays += r.days;
    mddSum += r.mdd;
    if (r.mdd < worstMdd) worstMdd = r.mdd;
    if (r.pnl > 0) wins++;
    if (r.result === "TP" || r.result === "TP12") {
      tpCnt++; tpDaysSum += r.days;
      if (r.days <= 3) tpDist[0]++;
      else if (r.days <= 7) tpDist[1]++;
      else if (r.days <= 14) tpDist[2]++;
      else tpDist[3]++;
    } else if (r.result === "SL") { slCnt++; slDaysSum += r.days; }
    else if (r.result === "TIMEOUT" || r.result === "TP1_TO" || r.result === "TP1_BE") {
      toCnt++; toDaysSum += r.days;
    }
  }
  const n = trades.length;
  const avg = cum / n;
  const days = totalDays / n;
  const avgDaysTP = tpCnt > 0 ? tpDaysSum / tpCnt : 0;
  const avgDaysSL = slCnt > 0 ? slDaysSum / slCnt : 0;
  const avgDaysTO = toCnt > 0 ? toDaysSum / toCnt : 0;

  return {
    n, avg, cum, days,
    win: (wins / n) * 100,
    tp: (tpCnt / n) * 100,
    sl: (slCnt / n) * 100,
    to: (toCnt / n) * 100,
    // 새 이름 (TPSLPanel)
    avgDaysTP, avgDaysSL, avgDaysTO,
    mdd: worstMdd,        // worst MDD (TPSLPanel에서 mdd라 부름)
    avgMdd: mddSum / n,
    // alias (이전 코드 호환)
    avgTpDays: avgDaysTP,
    avgSlDays: avgDaysSL,
    avgToDays: avgDaysTO,
    worstMdd,
    tpDist,
  };
}

function emptyStats() {
  return {
    n: 0, avg: 0, cum: 0, days: 0,
    win: 0, tp: 0, sl: 0, to: 0,
    avgDaysTP: 0, avgDaysSL: 0, avgDaysTO: 0,
    mdd: 0, avgMdd: 0,
    avgTpDays: 0, avgSlDays: 0, avgToDays: 0, worstMdd: 0,
    tpDist: [0, 0, 0, 0],
  };
}

// objective: cum / efficiency / ev / winrate / safety
function metricFor(r, objective) {
  if (objective === "cum") return r.cum;
  if (objective === "efficiency") {
    // 일당 EV. 평균 보유일 1보다 작으면 페널티
    return r.days > 0 ? r.avg / Math.max(0.5, r.days / 5) : 0;
  }
  if (objective === "ev") return r.avg;
  if (objective === "winrate") return r.win;
  if (objective === "safety") {
    // 안전점수 = (승률 - SL률). 단 EV 양수일 때만 의미 있음
    if (r.avg <= 0) return -9999;
    return r.win - r.sl;
  }
  return r.cum;
}

export function gridSearchSingle(trades, opts) {
  const tps = opts.tps || [10, 15, 20, 25, 30, 40, 50, 70, 100];
  const sls = opts.sls || [-3, -5, -7, -10, -15, -20];
  const maxDaysList = opts.maxDaysList || [5, 10, 15, 20];
  const objective = opts.objective || "cum";
  const minN = opts.minN || 30;

  const results = [];
  for (const tp of tps) {
    for (const sl of sls) {
      for (const md of maxDaysList) {
        const r = aggregateStats(trades, { mode: "single", tp, sl, maxDays: md });
        if (r.n < minN) continue;
        const m = metricFor(r, objective);
        // 명시적 덮어쓰기 (r.tp/r.sl 비율 충돌 방지)
        const row = Object.assign({}, r);
        row.tp = tp;        // 임계치
        row.sl = sl;        // 임계치
        row.maxDays = md;
        row._metric = m;
        row.tpRate = (r.tp || 0);  // 비율 별도 보관
        row.slRate = (r.sl || 0);
        results.push(row);
      }
    }
  }
  results.sort(function (a, b) { return b._metric - a._metric; });
  return {
    best: results[0] || null,
    top5: results.slice(0, 5),
    all: results,
    objective,
  };
}

export function gridSearchSplit(trades, opts) {
  const tp1s = opts.tp1s || [10, 15, 20, 25, 30];
  const tp2s = opts.tp2s || [30, 50, 70, 100];
  const sls = opts.sls || [-3, -5, -7, -10];
  const fsls = opts.fsls || [0, 1];
  const maxDaysList = opts.maxDaysList || [10, 15, 20];
  const objective = opts.objective || "cum";
  const minN = opts.minN || 30;

  const results = [];
  for (const tp1 of tp1s) {
    for (const tp2 of tp2s) {
      if (tp2 <= tp1) continue;
      for (const sl of sls) {
        for (const fsl of fsls) {
          for (const md of maxDaysList) {
            const r = aggregateStats(trades, { mode: "split", tp1, tp2, sl, fsl, maxDays: md });
            if (r.n < minN) continue;
            const m = metricFor(r, objective);
            const row = Object.assign({}, r);
            row.tp1 = tp1;
            row.tp2 = tp2;
            row.sl = sl;     // 임계치 (r.sl 비율 덮어씀)
            row.fsl = fsl;
            row.maxDays = md;
            row._metric = m;
            row.slRate = (r.sl || 0);
            results.push(row);
          }
        }
      }
    }
  }
  results.sort(function (a, b) { return b._metric - a._metric; });
  return {
    best: results[0] || null,
    top5: results.slice(0, 5),
    all: results,
    objective,
  };
}
