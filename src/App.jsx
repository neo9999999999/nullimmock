import React, { useMemo, useState } from "react";
import tradesData from "./data/trades.json";
import FilterBar from "./components/FilterBar.jsx";
import TPSLPanel from "./components/TPSLPanel.jsx";
import StatsCards from "./components/StatsCards.jsx";
import TradesTable from "./components/TradesTable.jsx";
import YearMonthBreakdown from "./components/YearMonthBreakdown.jsx";
import GuideModal from "./components/GuideModal.jsx";
import { DEFAULT_FILTERS, applyFilters, sortTrades } from "./lib/filters.js";
import { aggregateStats, simulate } from "./lib/simulator.js";

// 디폴트 필터 — 1차 백테스트 최강 콤보 (n=203, 누적+1247%, 승률 33%)
const OPTIMAL_FILTERS = Object.assign({}, DEFAULT_FILTERS, {
  signalsRange: "21+",      // 슈퍼주도주만 (6년 21회+)
  pattern: "ma5_breakout",  // 5일선 돌파만 (가장 강력)
  monthExcluded: [6, 7],    // 6, 7월 제외 (계절성)
});

// 디폴트 매매 룰 — 같은 셋의 최적 TP/SL/maxDays
const DEFAULT_RULE = {
  mode: "single",
  tp: 100,
  sl: -10,
  tp1: 30,
  tp2: 70,
  fsl: 1,
  maxDays: 10,
};

export default function App() {
  const [filters, setFilters] = useState(OPTIMAL_FILTERS);
  const [rule, setRule] = useState(DEFAULT_RULE);
  const [sort, setSort] = useState({ key: "refDate", dir: "desc" });
  const [page, setPage] = useState(0);
  const [openIdx, setOpenIdx] = useState(null);
  const [investAmt, setInvestAmt] = useState(500000);  // 투자금 (디폴트 50만원)

  // 필터링된 트레이드
  const filtered = useMemo(function () {
    return applyFilters(tradesData, filters);
  }, [filters]);

  // 시뮬레이션 결과 추가
  const simulated = useMemo(function () {
    return filtered.map(function (t) {
      const r = simulate(t, rule);
      return Object.assign({}, t, {
        pnl: r.pnl,
        result: r.result,
        days: r.days,
      });
    });
  }, [filtered, rule]);

  // 정렬
  const sorted = useMemo(function () {
    return sortTrades(simulated, sort.key, sort.dir);
  }, [simulated, sort]);

  // 통계
  const stats = useMemo(function () {
    return aggregateStats(filtered, rule);
  }, [filtered, rule]);

  function handleFilterReset() {
    setFilters(OPTIMAL_FILTERS);
    setPage(0);
  }

  function handleRuleChange(newRule) {
    setRule(newRule);
  }

  function handleSort(key) {
    setSort(function (prev) {
      if (prev.key === key) {
        return { key: key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key: key, dir: "desc" };
    });
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      {/* 헤더 */}
      <div style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        color: "#fff",
        padding: "20px 24px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto",
                      display: "flex", justifyContent: "space-between",
                      alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
              🎯 주도주 눌림매매 백테스트
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8" }}>
              디폴트: <b style={{color:"#fbbf24"}}>21회+ × 5일선돌파 × 6/7월 제외 × TP100/SL-10/10일</b>
              {" "}→ 누적 +1247% · 승률 33% · 평균 익절 6.3일 (n=203)
            </p>
          </div>
          <GuideModal />
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 16 }}>
        {/* 필터 바 */}
        <FilterBar filters={filters} onChange={function (f) { setFilters(f); setPage(0); }}
                   onReset={handleFilterReset} totalCount={tradesData.length}
                   filteredCount={filtered.length} />

        {/* TP/SL 패널 */}
        <TPSLPanel rule={rule} onChange={handleRuleChange} trades={filtered}
                   allTrades={tradesData}
                   filters={filters}
                   onFiltersChange={function (f) { setFilters(f); setPage(0); }} />

        {/* 통계 카드 */}
        <StatsCards stats={stats} rule={rule}
                    investAmt={investAmt} setInvestAmt={setInvestAmt} />

        {/* 연도/월별 분석 */}
        <YearMonthBreakdown trades={filtered} rule={rule} />

        {/* 트레이드 테이블 */}
        <TradesTable trades={sorted} sort={sort} onSort={handleSort}
                     page={page} setPage={setPage}
                     openIdx={openIdx} setOpenIdx={setOpenIdx}
                     rule={rule}
                     investAmt={investAmt} />

        {/* 푸터 */}
        <div style={{ textAlign: "center", padding: "24px 0",
                      fontSize: 11, color: "#94a3b8" }}>
          judojoo-screener · 매매법 마스터 v3 · TP{rule.tp} SL{rule.sl} 기준
        </div>
      </div>
    </div>
  );
}
