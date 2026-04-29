// /api/scan-signals
// 271 슈퍼주도주 풀에서 매일 신호 스캔
// - 새 강한 기준봉 (오늘/어제 +15% 1000억+)
// - 매집 중 (시그널 후 5~15일, -3% 이상 빠짐)
// - 진입 패턴 발생 (5일선 돌파 + 양봉)

import { fetchDailyChart } from "./kis/_lib.js";

// 슈퍼주도주 풀 임포트 (런타임에 fs로 읽기)
import fs from "fs";
import path from "path";

function loadSuperStocks() {
  const filePath = path.join(process.cwd(), "src/data/super_stocks.json");
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (e) {
    return [];
  }
}

// 5일/20일 이평
function ma(arr, days) {
  if (arr.length < days) return null;
  let sum = 0;
  for (let i = arr.length - days; i < arr.length; i++) sum += arr[i].close;
  return sum / days;
}

// 강한 기준봉 검사 (등락률+15%, 거래대금 1000억+, 윗꼬리≤30%, 양봉)
function isStrongRefBar(c) {
  if (!c || c.close <= c.open) return false;            // 양봉
  if (c.change < 15) return false;                       // +15% 이상
  if (c.amount < 100_000_000_000) return false;          // 1,000억 원
  const range = c.high - c.low;
  if (range <= 0) return false;
  const upperWick = (c.high - c.close) / range * 100;
  if (upperWick > 30) return false;                      // 윗꼬리 30% 이내
  return true;
}

// 5일선 돌파 패턴 (어제: ma5 아래, 오늘: ma5 위, 양봉, ma5 우상향, 시가 ≥ 기준봉 시가)
function isMa5Breakout(candles, idx, refOpen) {
  if (idx < 5) return false;
  const today = candles[idx];
  const yesterday = candles[idx - 1];
  if (today.close <= today.open) return false;          // 양봉
  if (today.close < refOpen) return false;              // 진입가 ≥ 기준봉 시가

  const ma5Today = ma(candles.slice(0, idx + 1), 5);
  const ma5Yesterday = ma(candles.slice(0, idx), 5);
  if (ma5Today == null || ma5Yesterday == null) return false;
  if (ma5Today <= ma5Yesterday) return false;            // 우상향
  if (yesterday.close >= ma5Yesterday) return false;     // 어제는 5일선 아래
  if (today.close <= ma5Today) return false;             // 오늘은 5일선 위
  return true;
}

export default async function handler(req, res) {
  // 환경변수 검증
  if (!process.env.KIS_APP_KEY || !process.env.KIS_APP_SECRET) {
    return res.status(500).json({
      error: "KIS_APP_KEY / KIS_APP_SECRET 환경변수가 설정되지 않았습니다",
      hint: "Vercel 대시보드 → Settings → Environment Variables 에 추가",
    });
  }

  // 종목 코드 명시적 받기 (POST body) 또는 자체 풀에서
  let stocks = [];
  if (req.method === "POST") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (body && Array.isArray(body.stocks)) {
        stocks = body.stocks;
      }
    } catch (_) {}
  }

  if (stocks.length === 0) {
    // 자체 풀 사용 (TOP 50만)
    const pool = loadSuperStocks();
    const withCode = pool.filter((s) => s.code && s.code.length === 6);
    stocks = withCode.slice(0, 50);
  }

  if (stocks.length === 0) {
    return res.status(400).json({
      error: "스캔할 종목이 없습니다",
      hint: "src/data/super_stocks.json 파일에 종목 코드(code) 채우거나, POST body로 [{name, code, market}] 전달",
      pool_size: loadSuperStocks().length,
    });
  }

  const results = {
    new_signals: [],     // 오늘/어제 강한 기준봉 발생
    accumulating: [],    // 매집 중 (시그널 후 5~15일, -3% 이상 빠짐)
    entries: [],         // 진입 패턴 발생 (5일선 돌파 + 양봉)
    errors: [],
  };

  let processed = 0;
  for (const stock of stocks.slice(0, 50)) {
    processed++;
    try {
      const candles = await fetchDailyChart(stock.code, 30);
      if (candles.length < 6) continue;

      // 정렬 (오래된 순)
      candles.sort((a, b) => a.date.localeCompare(b.date));
      const last = candles[candles.length - 1];
      const lastDate = last.date.slice(2, 4) + "-" + last.date.slice(4, 6) + "-" + last.date.slice(6);

      // 1. 오늘/어제 강한 기준봉
      for (let i = candles.length - 2; i < candles.length; i++) {
        if (i < 0) continue;
        if (isStrongRefBar(candles[i])) {
          results.new_signals.push({
            name: stock.name,
            code: stock.code,
            market: stock.market,
            ref_date: candles[i].date.slice(2, 4) + "-" + candles[i].date.slice(4, 6) + "-" + candles[i].date.slice(6),
            change: candles[i].change,
            amount_billion: Math.round(candles[i].amount / 100_000_000),
            close: candles[i].close,
          });
        }
      }

      // 2. 최근 15일 내 강한 기준봉 → 매집 검증 / 진입 패턴
      for (let i = Math.max(0, candles.length - 16); i < candles.length - 5; i++) {
        if (!isStrongRefBar(candles[i])) continue;
        const refClose = candles[i].close;
        const refOpen = candles[i].open;
        const refDate = candles[i].date.slice(2, 4) + "-" + candles[i].date.slice(4, 6) + "-" + candles[i].date.slice(6);

        // 매집 검증: 이후 -3% 이상 빠진 적 있는가
        let dippedBelowMinus3 = false;
        let minDip = 0;
        for (let j = i + 1; j < candles.length; j++) {
          const dip = (candles[j].low / refClose - 1) * 100;
          if (dip < minDip) minDip = dip;
          if (dip <= -3) dippedBelowMinus3 = true;
        }
        if (!dippedBelowMinus3) continue;

        // 매집 중인지 (오늘이 시그널 후 5~15일 사이 + 진입 패턴 X)
        const daysAfter = candles.length - 1 - i;
        if (daysAfter >= 5 && daysAfter <= 15) {
          // 마지막 봉이 진입 패턴인가?
          if (isMa5Breakout(candles, candles.length - 1, refOpen)) {
            results.entries.push({
              name: stock.name,
              code: stock.code,
              market: stock.market,
              ref_date: refDate,
              entry_date: lastDate,
              days_after: daysAfter,
              ref_change: candles[i].change,
              ref_amount_billion: Math.round(candles[i].amount / 100_000_000),
              entry_close: candles[candles.length - 1].close,
              entry_pct: (candles[candles.length - 1].close / refClose - 1) * 100,
              min_dip: minDip,
            });
          } else {
            results.accumulating.push({
              name: stock.name,
              code: stock.code,
              market: stock.market,
              ref_date: refDate,
              days_since: daysAfter,
              ref_change: candles[i].change,
              ref_amount_billion: Math.round(candles[i].amount / 100_000_000),
              min_dip: minDip,
              current_pct: (candles[candles.length - 1].close / refClose - 1) * 100,
            });
          }
        }
      }
    } catch (e) {
      results.errors.push({ name: stock.name, code: stock.code, error: String(e).slice(0, 200) });
    }
  }

  return res.status(200).json({
    scanned_at: new Date().toISOString(),
    processed: processed,
    pool_size: stocks.length,
    summary: {
      new_signals: results.new_signals.length,
      accumulating: results.accumulating.length,
      entries: results.entries.length,
      errors: results.errors.length,
    },
    results: results,
  });
}
