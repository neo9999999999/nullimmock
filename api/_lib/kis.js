// api/_lib/kis.js — KIS API 호출 헬퍼
// 토큰 캐싱 + 일봉 차트 조회 + 시그널 발견

const KIS_HOST = "https://openapi.koreainvestment.com:9443";

// 인메모리 토큰 캐시 (Vercel serverless는 인스턴스마다 별도)
let cachedToken = null;
let cachedExpiry = 0;

// 토큰 발급 (24시간 유효)
export async function getToken() {
  const now = Date.now();
  if (cachedToken && cachedExpiry > now + 60000) {
    return cachedToken;
  }
  const res = await fetch(KIS_HOST + "/oauth2/tokenP", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: process.env.KIS_APP_KEY,
      appsecret: process.env.KIS_APP_SECRET,
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error("KIS token failed: " + JSON.stringify(data));
  }
  cachedToken = data.access_token;
  cachedExpiry = now + (data.expires_in || 86400) * 1000;
  return cachedToken;
}

// 일봉 차트 조회 (최대 100건씩, period가 길면 여러 번 호출)
// market: "KS" or "KO"
// code: 6자리 종목코드
// startDate, endDate: "YYYYMMDD"
export async function getDailyChart(code, market, startDate, endDate) {
  const token = await getToken();
  const params = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: "J",
    FID_INPUT_ISCD: code,
    FID_INPUT_DATE_1: startDate,
    FID_INPUT_DATE_2: endDate,
    FID_PERIOD_DIV_CODE: "D",
    FID_ORG_ADJ_PRC: "0",
  });
  const url = KIS_HOST + "/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice?" + params.toString();
  const res = await fetch(url, {
    headers: {
      "authorization": "Bearer " + token,
      "appkey": process.env.KIS_APP_KEY,
      "appsecret": process.env.KIS_APP_SECRET,
      "tr_id": "FHKST03010100",
    },
  });
  const data = await res.json();
  if (data.rt_cd !== "0") {
    throw new Error("KIS daily chart failed: " + JSON.stringify(data));
  }
  // output2 = 일봉 배열 (최신부터 과거)
  const rows = (data.output2 || []).map(r => ({
    date: r.stck_bsop_date,            // YYYYMMDD
    open: parseFloat(r.stck_oprc),
    high: parseFloat(r.stck_hgpr),
    low: parseFloat(r.stck_lwpr),
    close: parseFloat(r.stck_clpr),
    volume: parseInt(r.acml_vol, 10),
    amount: parseInt(r.acml_tr_pbmn, 10),  // 거래대금 (원)
  }));
  return rows.reverse();  // 과거 → 최신
}

// 200일 이상 받으려면 여러 번 호출
export async function getLongDailyChart(code, market, days = 200) {
  const today = new Date();
  const fmt = (d) => d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0");
  const all = [];
  let endD = new Date(today);
  let remaining = days;
  while (remaining > 0) {
    const startD = new Date(endD);
    startD.setDate(startD.getDate() - 99);
    const rows = await getDailyChart(code, market, fmt(startD), fmt(endD));
    if (rows.length === 0) break;
    all.unshift(...rows);
    remaining -= rows.length;
    endD = new Date(startD);
    endD.setDate(endD.getDate() - 1);
    if (remaining > 0) {
      await new Promise(r => setTimeout(r, 200));  // KIS 호출 제한
    }
  }
  // 중복 제거 + 최근 N개
  const seen = new Set();
  const dedup = [];
  for (const r of all) {
    if (seen.has(r.date)) continue;
    seen.add(r.date);
    dedup.push(r);
  }
  return dedup.slice(-days);
}

// 시그널 발견: 오늘 큰 양봉 + 거래대금 폭증
// returns true if today is a "signal day"
export function detectSignal(daily, today) {
  if (daily.length < 30) return null;
  const last = daily[daily.length - 1];
  if (last.date !== today) return null;
  const prev = daily[daily.length - 2];
  if (!prev) return null;
  // 등락률
  const pct = (last.close - prev.close) / prev.close * 100;
  if (pct < 13) return null;  // 큰 양봉만
  // 거래대금 평균 (이전 20일)
  const prev20 = daily.slice(-22, -2);
  const avgAmt = prev20.reduce((s, r) => s + r.amount, 0) / prev20.length;
  if (last.amount < avgAmt * 3) return null;  // 거래대금 3배 폭증
  return {
    date: last.date,
    pct: pct,
    amount: last.amount,
    avgAmt20: avgAmt,
    amountRatio: last.amount / avgAmt,
  };
}

// 박스권 분석 (시그널 직전 N일)
export function analyzeBox(daily, beforeDays = 100) {
  if (daily.length < beforeDays + 1) return null;
  const box = daily.slice(-beforeDays - 1, -1);  // 시그널 제외
  const closes = box.map(r => r.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const avg = closes.reduce((s, c) => s + c, 0) / closes.length;
  const range = (max - min) / avg * 100;
  const std = Math.sqrt(closes.reduce((s, c) => s + (c - avg) ** 2, 0) / closes.length);
  const cv = std / avg * 100;  // 변동계수
  return {
    days: beforeDays,
    min, max, avg,
    rangePct: range,        // 박스권 폭 (%)
    cv: cv,                  // 변동계수
    isBox: range < 30 && cv < 10,  // 박스권 판정
    breakoutFromBox: closes[closes.length - 1] / max,  // 박스권 상단 대비
  };
}
