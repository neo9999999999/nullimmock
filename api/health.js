// api/health.js — 환경변수 + 데이터 검증
import { readFileSync } from "fs";
import { join } from "path";

export default function handler(req, res) {
  // 슈퍼주도주 풀 데이터 (271개)
  let pool = [];
  try {
    const data = readFileSync(join(process.cwd(), "src/data/super_stocks.json"), "utf-8");
    pool = JSON.parse(data);
  } catch (e) {
    pool = [];
  }
  const withCode = pool.filter(s => s.code && s.code.length === 6);

  res.status(200).json({
    status: "ok",
    env: {
      KIS_APP_KEY: process.env.KIS_APP_KEY ? "✓ set" : "✗ missing",
      KIS_APP_SECRET: process.env.KIS_APP_SECRET ? "✓ set" : "✗ missing",
    },
    super_stocks_pool: {
      total: pool.length,
      with_code: withCode.length,
      sample_first_5: pool.slice(0, 5).map(s => ({
        code: s.code, name: s.name, market: s.market, signals: s.signals_6y,
      })),
    },
    hint: process.env.KIS_APP_KEY && process.env.KIS_APP_SECRET
      ? "준비 완료 — /api/scan-today 호출 가능"
      : "Vercel ENV에 KIS_APP_KEY / KIS_APP_SECRET 등록 필요",
  });
}
