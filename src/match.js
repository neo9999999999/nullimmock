// match.js — 차트 패턴 유사도 매칭
//
// patterns.json: 20,702개 시그널 × 30일 종가 시퀀스
// 유사도 = 0.6 × 피어슨(종가 모양) + 0.4 × 코사인(등락률 시퀀스)

// 등락률 시퀀스 계산 (전일 대비 %)
function calcPnlSeq(closes) {
  const seq = [];
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      seq.push(closes[0]);
    } else {
      const prev = closes[i - 1];
      seq.push((closes[i] - prev) / (1 + prev / 100));
    }
  }
  return seq;
}

// 피어슨 상관계수
function pearson(a, b) {
  if (a.length !== b.length) return 0;
  const n = a.length;
  let sumA = 0, sumB = 0;
  for (let i = 0; i < n; i++) { sumA += a[i]; sumB += b[i]; }
  const meanA = sumA / n, meanB = sumB / n;
  let num = 0, denomA = 0, denomB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA, db = b[i] - meanB;
    num += da * db;
    denomA += da * da;
    denomB += db * db;
  }
  if (denomA === 0 || denomB === 0) return 0;
  return num / Math.sqrt(denomA * denomB);
}

// 코사인 유사도
function cosine(a, b) {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / Math.sqrt(normA * normB);
}

// 단일 매칭
export function matchSimilarity(targetCloses, candidateCloses) {
  const tPnl = calcPnlSeq(targetCloses);
  const cPnl = calcPnlSeq(candidateCloses);
  const p = pearson(targetCloses, candidateCloses);
  const c = cosine(tPnl, cPnl);
  return 0.6 * p + 0.4 * c;
}

// 전체 매칭 (TOP N)
export function findSimilar(targetCloses, patterns, opts = {}) {
  const minScore = opts.minScore != null ? opts.minScore : 0;
  const maxResults = opts.maxResults || 100;
  const filterFn = opts.filterFn || (() => true);

  const tPnl = calcPnlSeq(targetCloses);

  const results = [];
  for (let i = 0; i < patterns.length; i++) {
    const p = patterns[i];
    if (!filterFn(p)) continue;
    const cPnl = calcPnlSeq(p.closes);
    const score = 0.6 * pearson(targetCloses, p.closes) + 0.4 * cosine(tPnl, cPnl);
    if (score < minScore) continue;
    results.push({ ...p, score });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, maxResults);
}
