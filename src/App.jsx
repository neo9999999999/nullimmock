import React, { useMemo, useState } from "react";
import tradesData from "./data/trades.json";
import FilterBar from "./components/FilterBar.jsx";
import TPSLPanel from "./components/TPSLPanel.jsx";
import StatsCards from "./components/StatsCards.jsx";
import TradesTable from "./components/TradesTable.jsx";
import YearMonthBreakdown from "./components/YearMonthBreakdown.jsx";
import { DEFAULT_FILTERS, applyFilters, sortTrades } from "./lib/filters.js";
import { aggregateStats, simulate } from "./lib/simulator.js";

// 디폴트 매매 룰 (1차 백테스트 결과)
const DEFAULT_RULE = {
  mode: "single",   // "single" | "split"
  tp: 70,
  sl: -10,
  tp1: 30,
  tp2: 70,
  fsl: 1,           // 본전 보장 ON
  maxDays: 20,
};

export default function App() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [rule, setRule] = useState(DEFAULT_RULE);
  const [sort, setSort] = useState({ key: "refDate", dir: "desc" });
  const [page, setPage] = useState(0);
  const [openIdx, setOpenIdx] = useState(null);

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
    setFilters(DEFAULT_FILTERS);
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
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
            🎯 주도주 눌림매매 백테스트
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8" }}>
            6년치 데이터 (2021~2026.04) · {tradesData.length}개 진입 trades · 필터/TP·SL 슬라이더로 실시간 시뮬
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 16 }}>
        {/* 필터 바 */}
        <FilterBar filters={filters} onChange={function (f) { setFilters(f); setPage(0); }}
                   onReset={handleFilterReset} totalCount={tradesData.length}
                   filteredCount={filtered.length} />

        {/* TP/SL 패널 */}
        <TPSLPanel rule={rule} onChange={handleRuleChange} trades={filtered} />

        {/* 통계 카드 */}
        <StatsCards stats={stats} rule={rule} />

        {/* 연도/월별 분석 */}
        <YearMonthBreakdown trades={filtered} rule={rule} />

        {/* 트레이드 테이블 */}
        <TradesTable trades={sorted} sort={sort} onSort={handleSort}
                     page={page} setPage={setPage}
                     openIdx={openIdx} setOpenIdx={setOpenIdx}
                     rule={rule} />

        {/* 푸터 */}
        <div style={{ textAlign: "center", padding: "24px 0",
                      fontSize: 11, color: "#94a3b8" }}>
          judojoo-screener · 매매법 마스터 v3 · TP{rule.tp} SL{rule.sl} 기준
        </div>
      </div>
    </div>
  );
}
