import React, { useState, useMemo } from "react";
import { aggregateStats } from "../lib/simulator.js";
import { groupBy } from "../lib/filters.js";

export default function YearMonthBreakdown(props) {
  const [view, setView] = useState("year"); // "year" | "month" | "stock"

  // 연도별/월별 통계
  const breakdown = useMemo(function () {
    let groups;
    if (view === "year") {
      groups = groupBy(props.trades, function (t) { return "20" + t.refDate.slice(0, 2); });
    } else if (view === "month") {
      groups = groupBy(props.trades, function (t) {
        const parts = t.refDate.split("-");
        return "20" + parts[0] + "-" + parts[1];
      });
    } else {
      groups = groupBy(props.trades, function (t) { return t.name; });
    }

    const rows = Object.keys(groups).map(function (k) {
      const stats = aggregateStats(groups[k], props.rule);
      return Object.assign({ key: k }, stats);
    });

    // 정렬
    if (view === "stock") {
      rows.sort(function (a, b) { return b.cum - a.cum; });
    } else {
      rows.sort(function (a, b) {
        if (a.key < b.key) return -1;
        if (a.key > b.key) return 1;
        return 0;
      });
    }
    return rows;
  }, [props.trades, props.rule, view]);

  return (
    <div style={{
      marginBottom: 16, padding: 14, background: "#fff",
      border: "1px solid #e2e8f0", borderRadius: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8,
                    marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
          📈 분석 차원
        </span>
        {[["year", "연도별"], ["month", "월별"], ["stock", "종목별 TOP30"]].map(function (opt) {
          return (
            <button key={opt[0]} onClick={function () { setView(opt[0]); }}
                    style={{
                      background: view === opt[0] ? "#3b82f6" : "#f1f5f9",
                      color: view === opt[0] ? "#fff" : "#475569",
                      border: "none", borderRadius: 6, padding: "4px 12px",
                      fontSize: 12, cursor: "pointer", fontWeight: 700,
                    }}>
              {opt[1]}
            </button>
          );
        })}
      </div>

      {breakdown.length === 0 ? (
        <div style={{ color: "#94a3b8", fontSize: 12 }}>데이터 없음</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={th}>{view === "year" ? "연도" : view === "month" ? "월" : "종목"}</th>
                <th style={th}>n</th>
                <th style={th}>EV</th>
                <th style={th}>승률</th>
                <th style={th}>누적</th>
                <th style={th}>TP%</th>
                <th style={th}>SL%</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.slice(0, view === "stock" ? 30 : 20).map(function (r) {
                const cumColor = r.cum > 0 ? "#dc2626" : "#2563eb";
                const evColor = r.avg > 0 ? "#dc2626" : "#2563eb";
                return (
                  <tr key={r.key} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={Object.assign({}, td, { fontWeight: 700, textAlign: "left" })}>
                      {r.key}
                    </td>
                    <td style={td}>{r.n}</td>
                    <td style={Object.assign({}, td, { color: evColor, fontWeight: 700 })}>
                      {(r.avg >= 0 ? "+" : "") + r.avg.toFixed(2) + "%"}
                    </td>
                    <td style={td}>{r.win.toFixed(0) + "%"}</td>
                    <td style={Object.assign({}, td, { color: cumColor, fontWeight: 700 })}>
                      {(r.cum >= 0 ? "+" : "") + r.cum.toFixed(0) + "%"}
                    </td>
                    <td style={Object.assign({}, td, { color: "#dc2626" })}>{r.tp.toFixed(0) + "%"}</td>
                    <td style={Object.assign({}, td, { color: "#2563eb" })}>{r.sl.toFixed(0) + "%"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const th = {
  padding: "8px 6px", fontWeight: 700, color: "#475569",
  fontSize: 11, textAlign: "center", borderBottom: "2px solid #e2e8f0",
};
const td = {
  padding: "6px 6px", textAlign: "center", color: "#1e293b",
};
