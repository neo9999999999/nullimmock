// /api/health
// 환경 셋업 진단

import fs from "fs";
import path from "path";

export default function handler(req, res) {
  const hasKey = !!process.env.KIS_APP_KEY;
  const hasSecret = !!process.env.KIS_APP_SECRET;

  let poolSize = 0;
  let withCode = 0;
  try {
    const filePath = path.join(process.cwd(), "src/data/super_stocks.json");
    const pool = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    poolSize = pool.length;
    withCode = pool.filter((s) => s.code && s.code.length === 6).length;
  } catch (_) {}

  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: {
      KIS_APP_KEY: hasKey ? "✓ set" : "✗ missing",
      KIS_APP_SECRET: hasSecret ? "✓ set" : "✗ missing",
    },
    super_stocks_pool: {
      total: poolSize,
      with_code: withCode,
      hint: withCode === 0
        ? "super_stocks.json의 'code' 필드를 채워야 합니다"
        : "준비됨",
    },
  });
}
