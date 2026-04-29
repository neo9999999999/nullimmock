// lib/filters.js
// 필터 조건들

export const DEFAULT_FILTERS = {
  yearRange: "all",      // "all" | "21" | "22" | ... | "26"
  fromDate: "",          // "yy-mm-dd"
  toDate: "",
  iv: "all",             // "all" | "기+외" | "외만" | "기만" | "둘다-"
  high: "all",           // "all" | "h120" | "h60only" | "none"
  pattern: "all",        // "all" | "ma5_breakout" | "ma5_support" | "ma20_rebound"
  market: "all",         // "all" | "코스닥" | "코스피"
  signalsRange: "all",   // "all" | "21+" | "11-20" | "6-10" | "3-5" | "1-2"
  changeRange: "all",    // "all" | "13-16" | "16-20" | "20-25" | "25+"
  amountRange: "all",    // "all" | "5000+" | "2000-5000" | "1000-2000"
  monthExcluded: [],     // [6, 7] 등
};

export function applyFilters(trades, f) {
  return trades.filter(function (t) {
    // 연도/기간
    if (f.yearRange !== "all" && t.refDate.slice(0, 2) !== f.yearRange) return false;
    if (f.fromDate && t.refDate < f.fromDate) return false;
    if (f.toDate && t.refDate > f.toDate) return false;

    // 수급
    if (f.iv !== "all" && t.iv !== f.iv) return false;

    // 신고가
    if (f.high === "h120" && !t.h120) return false;
    if (f.high === "h60only" && !(t.h60 && !t.h120)) return false;
    if (f.high === "none" && (t.h60 || t.h120)) return false;

    // 패턴
    if (f.pattern !== "all" && t.pattern !== f.pattern) return false;

    // 시장
    if (f.market !== "all" && t.market !== f.market) return false;

    // 시그널 빈도
    if (f.signalsRange === "21+" && t.totalSignals < 21) return false;
    if (f.signalsRange === "11-20" && (t.totalSignals < 11 || t.totalSignals > 20)) return false;
    if (f.signalsRange === "6-10" && (t.totalSignals < 6 || t.totalSignals > 10)) return false;
    if (f.signalsRange === "3-5" && (t.totalSignals < 3 || t.totalSignals > 5)) return false;
    if (f.signalsRange === "1-2" && t.totalSignals > 2) return false;

    // 등락률
    if (f.changeRange === "13-16" && (t.refCh < 13 || t.refCh >= 16)) return false;
    if (f.changeRange === "16-20" && (t.refCh < 16 || t.refCh >= 20)) return false;
    if (f.changeRange === "20-25" && (t.refCh < 20 || t.refCh >= 25)) return false;
    if (f.changeRange === "25+" && t.refCh < 25) return false;

    // 거래대금
    if (f.amountRange === "5000+" && t.refAmt < 5000) return false;
    if (f.amountRange === "2000-5000" && (t.refAmt < 2000 || t.refAmt >= 5000)) return false;
    if (f.amountRange === "1000-2000" && (t.refAmt < 1000 || t.refAmt >= 2000)) return false;

    // 월 제외
    if (f.monthExcluded && f.monthExcluded.length > 0) {
      const m = parseInt(t.refDate.split("-")[1], 10);
      if (f.monthExcluded.indexOf(m) >= 0) return false;
    }

    return true;
  });
}

// 정렬
export function sortTrades(trades, sortKey, dir) {
  const sorted = trades.slice();
  sorted.sort(function (a, b) {
    let av = a[sortKey];
    let bv = b[sortKey];
    if (av == null) av = "";
    if (bv == null) bv = "";
    if (typeof av === "boolean") {
      av = av ? 1 : 0;
      bv = bv ? 1 : 0;
    }
    if (av < bv) return dir === "asc" ? -1 : 1;
    if (av > bv) return dir === "asc" ? 1 : -1;
    return 0;
  });
  return sorted;
}

// 그룹별 통계 (연도/월/종목)
export function groupBy(trades, keyFn) {
  const groups = {};
  for (const t of trades) {
    const k = keyFn(t);
    if (!groups[k]) groups[k] = [];
    groups[k].push(t);
  }
  return groups;
}
