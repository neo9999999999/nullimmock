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

// 🥇 검증된 D+1 단타 골든 룰 (6년 백테스트, 모든 연도 EV+, 익절률 76.9%)
// 필터: 21회+ × 120일 신고가 × 5일선 돌파 × 거래대금 5000억+
// 룰: 진입일 종가 매수 → 다음날 +5% 터치 시 즉시 익절, 안되면 종가 청산 (SL 없음)
// 표본 39건, TP 도달 67%, EV +2.36%, 평균 익절일 1일
const OPTIMAL_FILTERS = Object.assign({}, DEFAULT_FILTERS, {
  signalsRange: "21+",
  high: "h120",
  pattern: "ma5_breakout",
  amountRange: "5000+",
});

const DEFAULT_RULE = {
  mode: "d1",        // ⭐ D+1 단타 모드
  tp: 5,             // +5% 익절
  sl: 0,             // SL 없음 (다음날 종가까지)
  maxDays: 1,
  tp1: 30, tp2: 100, fsl: 1,
};

export default function App() {
  const [filters, setFilters] = useState(OPTIMAL_FILTERS);
  const [rule, setRule] = useState(DEFAULT_RULE);
  const [sort, setSort] = useState({ key: "refDate", dir: "desc" });
  const [page, setPage] = useState(0);
  const [openIdx, setOpenIdx] = useState(null);
  const [investAmt, setInvestAmt] = useState(500000);  // 투자금 (디폴트 50만원)

  // 기간 제외하고 필터 적용한 trades (자동 최적화용 — 룰을 시간 무관 고정)
  const tradesForGrid = useMemo(function () {
    const f = Object.assign({}, filters, {
      yearRange: "all", fromDate: "", toDate: "",
    });
    return applyFilters(tradesData, f);
  }, [filters]);

  // 필터링된 트레이드 (기간 포함 — 통계 표시용)
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
              🎯 주도주 D+1 단타 백테스트
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8" }}>
              🥇 <b style={{color:"#fbbf24"}}>D+1 단타 골든 룰</b>: 21회+ × 120일↑ × 5일선돌파 × 5000억+ / TP+5%/SL없음 ·
              <b style={{color:"#10b981"}}> 익절률 67% · EV+2.36% · 보유 1일</b>
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
        <TPSLPanel rule={rule} onChange={handleRuleChange}
                   trades={filtered}
                   tradesForGrid={tradesForGrid}
                   investAmt={investAmt} setInvestAmt={setInvestAmt} />

        {/* 통계 카드 */}
        <StatsCards stats={stats} rule={rule}
                    investAmt={investAmt} />

        {/* 연도/월별 분석 */}
        <YearMonthBreakdown trades={filtered} rule={rule} investAmt={investAmt} />

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
