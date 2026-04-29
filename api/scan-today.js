// api/scan-today.js
//
// 당일 풍산 패턴 후보 종목 발굴:
// 1. 271 슈퍼주도주 풀에서 오늘 큰 양봉 + 거래대금 폭증 종목 찾기
// 2. 각 종목의 시그널 직전 100일 박스권 분석
// 3. 패턴 매칭 점수 + 통계
//
// Query params:
//   ?date=YYYYMMDD  (default: 가장 최근 영업일)
//   ?max=10         (default: 10, 최대 30)
//   ?pool=topN      (default: top80, 시그널 빈도 상위 N개부터 스캔)

import { readFileSync } from "fs";
import { join } from "path";
import { getToken, getLongDailyChart, detectSignal, analyzeBox } from "./_lib/kis.js";

export default async function handler(req, res) {
  // 환경 체크
  if (!process.env.KIS_APP_KEY || !process.env.KIS_APP_SECRET) {
    return res.status(400).json({
      error: "KIS_APP_KEY / KIS_APP_SECRET 환경변수 누락",
    });
  }

  const targetDate = req.query.date || todayStr();
  const maxResults = Math.min(parseInt(req.query.max || "10", 10), 30);
  const topN = parseInt(req.query.pool || "80", 10);

  // 풀 로드
  const poolPath = join(process.cwd(), "src/data/super_stocks.json");
  const pool = JSON.parse(readFileSync(poolPath, "utf-8"));
  const targets = pool
    .filter(s => s.code && s.code.length === 6)
    .slice(0, topN);

  // 토큰 미리 발급
  try {
    await getToken();
  } catch (e) {
    return res.status(500).json({ error: "KIS 토큰 발급 실패: " + e.message });
  }

  // 각 종목 스캔
  const results = [];
  const errors = [];
  for (let i = 0; i < targets.length; i++) {
    const s = targets[i];
    try {
      // 시그널 + 박스권 분석은 200일 데이터 필요
      const daily = await getLongDailyChart(s.code, s.market, 150);
      if (daily.length < 30) continue;

      const sig = detectSignal(daily, targetDate);
      if (!sig) continue;

      const box = analyzeBox(daily, 100);
      results.push({
        rank: results.length + 1,
        code: s.code,
        name: s.name,
        market: s.market,
        signals_6y: s.signals_6y,
        signal: sig,
        box: box,
        score: scorePattern(sig, box),
      });
      // 결과 충분하면 중단
      if (results.length >= maxResults) break;
    } catch (e) {
      errors.push({ code: s.code, name: s.name, error: e.message });
    }
    // 호출 간격
    await new Promise(r => setTimeout(r, 100));
  }

  // 점수순 정렬
  results.sort((a, b) => b.score - a.score);
  results.forEach((r, i) => r.rank = i + 1);

  res.status(200).json({
    target_date: targetDate,
    scanned: targets.length,
    matches: results.length,
    errors: errors.length,
    results,
  });
}

// 풍산 패턴 점수 (0~100)
function scorePattern(sig, box) {
  let score = 0;
  // 등락률 +13~22% 가중
  if (sig.pct >= 13 && sig.pct <= 22) score += 30;
  else if (sig.pct >= 10) score += 15;
  // 거래대금 폭증 비율 (5배+ 만점)
  if (sig.amountRatio >= 10) score += 30;
  else if (sig.amountRatio >= 5) score += 20;
  else if (sig.amountRatio >= 3) score += 10;
  // 박스권 (변동계수 < 10%)
  if (box && box.isBox) score += 30;
  else if (box && box.cv < 15) score += 15;
  // 박스권 상단 근처 (0.95~1.05)
  if (box && box.breakoutFromBox >= 0.95 && box.breakoutFromBox <= 1.05) score += 10;
  return score;
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0");
}
