// /api/kis/_lib.js
// KIS API 공통 — 토큰 관리 + GET 헬퍼

const KIS_BASE_URL = "https://openapi.koreainvestment.com:9443";

// 메모리 캐시 (Vercel 함수 인스턴스 내)
let _cachedToken = null;
let _cachedAt = 0;

export async function getAccessToken() {
  const appKey = process.env.KIS_APP_KEY;
  const appSecret = process.env.KIS_APP_SECRET;
  if (!appKey || !appSecret) {
    throw new Error("KIS_APP_KEY / KIS_APP_SECRET 환경변수가 설정되지 않았습니다");
  }

  // 메모리 캐시 (23시간 이내 재사용)
  if (_cachedToken && (Date.now() - _cachedAt) < 23 * 3600 * 1000) {
    return _cachedToken;
  }

  const res = await fetch(`${KIS_BASE_URL}/oauth2/tokenP`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: appKey,
      appsecret: appSecret,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KIS 토큰 발급 실패 (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`KIS 토큰 응답에 access_token 없음: ${JSON.stringify(data)}`);
  }

  _cachedToken = data.access_token;
  _cachedAt = Date.now();
  return _cachedToken;
}

// KIS GET 호출 (Rate limit 포함)
let _lastCall = 0;
const MIN_INTERVAL_MS = 70; // ~14 calls/sec (안전 마진)

export async function kisGet(path, query, trId) {
  const now = Date.now();
  const wait = MIN_INTERVAL_MS - (now - _lastCall);
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  _lastCall = Date.now();

  const token = await getAccessToken();
  const url = new URL(KIS_BASE_URL + path);
  for (const [k, v] of Object.entries(query || {})) {
    url.searchParams.append(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: {
      "Authorization": `Bearer ${token}`,
      "appkey": process.env.KIS_APP_KEY,
      "appsecret": process.env.KIS_APP_SECRET,
      "tr_id": trId,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.rt_cd !== "0") {
    throw new Error(
      `KIS API ${path} 실패 (${res.status}): ${data.msg1 || JSON.stringify(data).slice(0, 200)}`
    );
  }
  return data;
}

// 단일 종목 일봉 N일치 (KIS 한도 100일)
export async function fetchDailyChart(stockCode, days = 60) {
  const today = new Date();
  const endDate = today.toISOString().slice(0, 10).replaceAll("-", "");
  const startDt = new Date(today.getTime() - days * 86400000);
  const startDate = startDt.toISOString().slice(0, 10).replaceAll("-", "");

  const data = await kisGet(
    "/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice",
    {
      FID_COND_MRKT_DIV_CODE: "J",
      FID_INPUT_ISCD: stockCode,
      FID_INPUT_DATE_1: startDate,
      FID_INPUT_DATE_2: endDate,
      FID_PERIOD_DIV_CODE: "D",
      FID_ORG_ADJ_PRC: "0",
    },
    "FHKST03010100"
  );

  // output2가 일봉 데이터
  return (data.output2 || []).filter((r) => r.stck_bsop_date && r.stck_clpr).map((r) => ({
    date: r.stck_bsop_date,
    open: parseFloat(r.stck_oprc) || 0,
    high: parseFloat(r.stck_hgpr) || 0,
    low: parseFloat(r.stck_lwpr) || 0,
    close: parseFloat(r.stck_clpr) || 0,
    volume: parseInt(r.acml_vol) || 0,
    amount: parseFloat(r.acml_tr_pbmn) || 0,
    change: parseFloat(r.prdy_ctrt) || 0,
  }));
}

// 종목명 → 코드 검색 (KIS 종목 검색)
export async function searchStockCode(name) {
  // KIS API에는 종목명 검색 endpoint가 명확치 않아, 임시로 빈 문자열 반환
  // 실전에서는 KRX 데이터셋 또는 KIS의 다른 endpoint 사용 필요
  return null;
}
