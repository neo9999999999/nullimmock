// lib/simulator.js
// TP/SL 시뮬레이션 + 자동 최적화

// 단일 TP/SL 시뮬레이션
// trade: {entryPct, ohlc: [[date, o, h, l, c], ...]}
// 반환: {pnl, result, days}
export function simSingle(trade, tp, sl, maxDays) {
  const arr = trade.ohlc;
  const entry = trade.entryPct;
  if (!arr || arr.length === 0) return { pnl: 0, result: "NO_DATA", days: 0 };
  const end = Math.min(maxDays, arr.length);
  for (let i = 0; i < end; i++) {
    const rh = arr[i][2] - entry;
    const rl = arr[i][3] - entry;
    if (rl <= sl) return { pnl: sl, result: "SL", days: i + 1 };
    if (rh >= tp) return { pnl: tp, result: "TP", days: i + 1 };
  }
  if (end > 0) {
    return { pnl: arr[end - 1][4] - entry, result: "TIMEOUT", days: end };
  }
  return { pnl: 0, result: "NO_DATA", days: 0 };
}

// 분할 TP1+TP2 시뮬레이션 (NEO-SCORE 스타일)
// tp1 도달 → 절반 익절, tp2 도달 → 잔량 익절
// fsl > 0: tp1 도달 후 본전 보장 (잔량 sl 조정)
export function simSplit(trade, tp1, tp2, sl, fsl, maxDays) {
  const arr = trade.ohlc;
  const entry = trade.entryPct;
  if (!arr || arr.length === 0) return { pnl: 0, result: "NO_DATA", days: 0 };
  const end = Math.min(maxDays, arr.length);
  let tp1Hit = false;
  let curSl = sl;

  for (let i = 0; i < end; i++) {
    const rh = arr[i][2] - entry;
    const rl = arr[i][3] - entry;

    // SL (TP1 미도달 또는 미본전 후)
    if (!tp1Hit && rl <= curSl) {
      return { pnl: curSl, result: "SL", days: i + 1 };
    }
    // TP1
    if (!tp1Hit && rh >= tp1) {
      tp1Hit = true;
      // fsl 양수면 본전 보장 (잔량 sl을 0으로)
      if (fsl > 0) curSl = 0;
    }
    // TP2 (TP1 후)
    if (tp1Hit && rh >= tp2) {
      return { pnl: (tp1 + tp2) / 2, result: "TP12", days: i + 1 };
    }
    // TP1 후 본전/SL 도달
    if (tp1Hit && rl <= curSl) {
      return { pnl: (tp1 + curSl) / 2, result: "TP1_BE", days: i + 1 };
    }
  }

  // 만료
  if (end > 0) {
    const lastC = arr[end - 1][4] - entry;
    if (tp1Hit) {
      return { pnl: (tp1 + lastC) / 2, result: "TP1_TO", days: end };
    }
    return { pnl: lastC, result: "TIMEOUT", days: end };
  }
  return { pnl: 0, result: "NO_DATA", days: 0 };
}

// 시뮬레이션 모드 통합 진입점
export function simulate(trade, rule) {
  if (rule.mode === "split") {
    return simSplit(trade, rule.tp1, rule.tp2, rule.sl, rule.fsl || 0, rule.maxDays);
  }
  return simSingle(trade, rule.tp, rule.sl, rule.maxDays);
}

// 그리드 서치: 단일 TP 모드
export function gridSearchSingle(trades, opts) {
  const tps = opts.tps || [10, 15, 20, 25, 30, 40, 50, 70, 100];
  const sls = opts.sls || [-3, -5, -7, -10, -15, -20];
  const maxDays = opts.maxDays || 20;

  let best = null;
  const grid = [];

  for (const tp of tps) {
    for (const sl of sls) {
      const r = aggregateStats(trades, { mode: "single", tp, sl, maxDays });
      grid.push({ tp, sl, ...r });
      if (!best || r.cum > best.cum) {
        best = { tp, sl, ...r };
      }
    }
  }

  return { best, grid };
}

// 그리드 서치: 분할 TP1+TP2 모드
export function gridSearchSplit(trades, opts) {
  const tp1s = opts.tp1s || [10, 15, 20, 25, 30];
  const tp2s = opts.tp2s || [30, 50, 80, 100];
  const sls = opts.sls || [-3, -5, -7, -10];
  const fsls = opts.fsls || [0, 1];
  const maxDays = opts.maxDays || 20;

  let best = null;
  for (const tp1 of tp1s) {
    for (const tp2 of tp2s) {
      if (tp2 <= tp1) continue;
      for (const sl of sls) {
        for (const fsl of fsls) {
          const r = aggregateStats(trades, { mode: "split", tp1, tp2, sl, fsl, maxDays });
          if (!best || r.cum > best.cum) {
            best = { tp1, tp2, sl, fsl, ...r };
          }
        }
      }
    }
  }
  return { best };
}

// 통계 집계
export function aggregateStats(trades, rule) {
  if (!trades || trades.length === 0) {
    return { n: 0, avg: 0, win: 0, tp: 0, sl: 0, to: 0, cum: 0, days: 0 };
  }
  let cum = 0;
  let wins = 0;
  let tpCnt = 0;
  let slCnt = 0;
  let toCnt = 0;
  let totalDays = 0;
  for (const t of trades) {
    const r = simulate(t, rule);
    cum += r.pnl;
    totalDays += r.days;
    if (r.pnl > 0) wins++;
    if (r.result === "TP" || r.result === "TP12") tpCnt++;
    else if (r.result === "SL") slCnt++;
    else if (r.result === "TIMEOUT" || r.result === "TP1_TO") toCnt++;
  }
  const n = trades.length;
  return {
    n,
    avg: cum / n,
    win: (wins / n) * 100,
    tp: (tpCnt / n) * 100,
    sl: (slCnt / n) * 100,
    to: (toCnt / n) * 100,
    cum,
    days: totalDays / n,
  };
}
