import React, { useState, useMemo } from "react";
import patternsData from "./data/patterns.json";
import { findSimilar } from "./match.js";

export default function SimilarSearch() {
  // 검색 쿼리: 종목명 + 시그널일 (D.pkl 안에서 선택)
  const [query, setQuery] = useState("");
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [minScore, setMinScore] = useState(0.7);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // 검색어 자동완성 (종목명 시작)
  const suggestions = useMemo(() => {
    if (!query || query.length < 1) return [];
    const q = query.toLowerCase();
    const seen = new Set();
    const out = [];
    for (const p of patternsData) {
      const key = p.name + "|" + p.date;
      if (seen.has(key)) continue;
      if (!p.name.toLowerCase().includes(q)) continue;
      seen.add(key);
      out.push(p);
      if (out.length >= 20) break;
    }
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [query]);

  function runSearch(target) {
    setSelectedTarget(target);
    setSearching(true);
    setResults([]);

    // setTimeout으로 UI 업데이트 후 무거운 계산
    setTimeout(() => {
      const out = findSimilar(target.closes, patternsData, {
        minScore: minScore,
        maxResults: 100,
        filterFn: (p) => !(p.name === target.name && p.date === target.date),
      });
      setResults(out);
      setSearching(false);
    }, 50);
  }

  // 통계 (결과 기반)
  const stats = useMemo(() => {
    if (results.length === 0) return null;
    const withFuture = results.filter(r => r.max_gain_60d != null);
    if (withFuture.length === 0) return null;
    const sumGain = withFuture.reduce((s, r) => s + r.max_gain_60d, 0);
    const win30 = withFuture.filter(r => r.max_gain_60d >= 30).length;
    const win50 = withFuture.filter(r => r.max_gain_60d >= 50).length;
    const winNeg = withFuture.filter(r => r.max_gain_60d < 0).length;
    return {
      total: results.length,
      withFuture: withFuture.length,
      avgGain: sumGain / withFuture.length,
      win30: win30, win30Rate: win30 / withFuture.length * 100,
      win50: win50, win50Rate: win50 / withFuture.length * 100,
      neg: winNeg,  negRate: winNeg / withFuture.length * 100,
    };
  }, [results]);

  return (
    <div>
      {/* 검색 입력 */}
      <div style={{
        marginBottom: 16, padding: 14,
        background: "#1e293b", border: "1px solid #334155", borderRadius: 8,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24", marginBottom: 8 }}>
          🔍 타겟 패턴 선택 (종목명 + 시그널일)
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="종목명 입력 (예: 삼성전자, 휴림로봇, 펩트론)"
          style={{
            width: "100%", padding: 10, fontSize: 14,
            background: "#0f172a", color: "#fff",
            border: "1px solid #475569", borderRadius: 6, outline: "none",
            boxSizing: "border-box",
          }}
        />

        {/* 자동완성 */}
        {suggestions.length > 0 && (
          <div style={{
            marginTop: 8, maxHeight: 200, overflowY: "auto",
            background: "#0f172a", border: "1px solid #334155", borderRadius: 6,
          }}>
            {suggestions.map((s, i) => (
              <div key={i} onClick={() => { setQuery(""); runSearch(s); }}
                   style={{
                     padding: "6px 10px", fontSize: 12, cursor: "pointer",
                     borderBottom: "1px solid #1e293b",
                     display: "flex", justifyContent: "space-between",
                   }}
                   onMouseOver={(e) => e.currentTarget.style.background = "#1e293b"}
                   onMouseOut={(e) => e.currentTarget.style.background = "transparent"}>
                <span>
                  <span style={{ color: "#fbbf24", fontWeight: 700 }}>{s.name}</span>
                  <span style={{ color: "#64748b", marginLeft: 8 }}>({s.mkt}, 시그널 {s.sigs}회)</span>
                </span>
                <span style={{ color: "#94a3b8" }}>{s.date}</span>
              </div>
            ))}
          </div>
        )}

        {/* 유사도 임계치 */}
        <div style={{
          marginTop: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>최소 유사도</span>
          {[0.5, 0.6, 0.7, 0.8, 0.9].map(v => (
            <button key={v} onClick={() => {
                setMinScore(v);
                if (selectedTarget) runSearch(selectedTarget);
              }}
              style={{
                background: minScore === v ? "#10b981" : "transparent",
                color: minScore === v ? "#fff" : "#94a3b8",
                border: "1px solid " + (minScore === v ? "#10b981" : "#475569"),
                borderRadius: 6, padding: "4px 10px", fontSize: 11,
                cursor: "pointer", fontWeight: 700,
              }}>
              {Math.round(v * 100)}%+
            </button>
          ))}
        </div>
      </div>

      {/* 타겟 패턴 */}
      {selectedTarget && (
        <div style={{
          marginBottom: 16, padding: 14,
          background: "linear-gradient(to right, #134e4a, #064e3b)",
          border: "1px solid #10b981", borderRadius: 8,
        }}>
          <div style={{ fontSize: 13, color: "#a7f3d0", marginBottom: 4 }}>
            🎯 타겟 패턴
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>
            {selectedTarget.name}
            <span style={{ fontSize: 13, color: "#a7f3d0", marginLeft: 10 }}>
              {selectedTarget.mkt} · 시그널일 {selectedTarget.date} · {selectedTarget.sigs}회 슈퍼주도주 · {selectedTarget.iv}
            </span>
          </div>
          <ChartLine closes={selectedTarget.closes} color="#10b981" />
        </div>
      )}

      {/* 통계 */}
      {stats && (
        <div style={{
          marginBottom: 16, padding: 12,
          background: "#1e293b", border: "1px solid #334155", borderRadius: 8,
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
        }}>
          <Mini label="유사 종목" value={stats.total + "건"} color="#fbbf24" />
          <Mini label="평균 60일 최고" value={"+" + stats.avgGain.toFixed(1) + "%"} color="#10b981" />
          <Mini label="+30% 도달" value={stats.win30Rate.toFixed(0) + "%"}
                color="#10b981" sub={stats.win30 + "건"} />
          <Mini label="+50% 도달" value={stats.win50Rate.toFixed(0) + "%"}
                color="#10b981" sub={stats.win50 + "건"} />
          <Mini label="음수 마감" value={stats.negRate.toFixed(0) + "%"}
                color="#ef4444" sub={stats.neg + "건"} />
        </div>
      )}

      {/* 검색 중 */}
      {searching && (
        <div style={{
          padding: 30, textAlign: "center",
          background: "#1e293b", borderRadius: 8, color: "#94a3b8",
        }}>
          🔍 매칭 중... (20,702개 시그널과 비교)
        </div>
      )}

      {/* 결과 리스트 */}
      {results.length > 0 && (
        <div style={{
          marginBottom: 16, padding: 14,
          background: "#1e293b", border: "1px solid #334155", borderRadius: 8,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24", marginBottom: 10 }}>
            🥇 유사 종목 (유사도 {Math.round(minScore * 100)}%+ · {results.length}건)
          </div>
          <div style={{ overflowX: "auto", maxHeight: 600, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead style={{ position: "sticky", top: 0, background: "#1e293b", zIndex: 1 }}>
                <tr style={{ color: "#94a3b8" }}>
                  <th style={th}>#</th>
                  <th style={th}>유사도</th>
                  <th style={th}>종목명</th>
                  <th style={th}>시장</th>
                  <th style={th}>시그널일</th>
                  <th style={th}>슈퍼</th>
                  <th style={th}>수급</th>
                  <th style={th}>📊 차트 모양</th>
                  <th style={th}>60일 최고 ↑</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} style={{
                    background: i % 2 === 0 ? "#0f172a" : "transparent",
                    color: "#cbd5e1",
                  }}>
                    <td style={td}>{i + 1}</td>
                    <td style={Object.assign({}, td, {
                      fontWeight: 800,
                      color: r.score >= 0.85 ? "#10b981" :
                             r.score >= 0.75 ? "#fbbf24" : "#94a3b8",
                    })}>
                      {(r.score * 100).toFixed(1)}%
                    </td>
                    <td style={Object.assign({}, td, { fontWeight: 700, color: "#fbbf24" })}>
                      {r.name}
                    </td>
                    <td style={td}>{r.mkt}</td>
                    <td style={td}>{r.date}</td>
                    <td style={Object.assign({}, td, { color: "#94a3b8" })}>
                      {r.sigs}회
                    </td>
                    <td style={Object.assign({}, td, {
                      color: r.iv === "기+외" ? "#10b981" :
                             r.iv === "외만" ? "#0ea5e9" :
                             r.iv === "둘다-" ? "#ef4444" : "#94a3b8",
                    })}>
                      {r.iv}
                    </td>
                    <td style={Object.assign({}, td, { padding: 0 })}>
                      <ChartLine closes={r.closes} color={r.score >= 0.85 ? "#10b981" : "#0ea5e9"} small />
                    </td>
                    <td style={Object.assign({}, td, {
                      fontWeight: 700,
                      color: r.max_gain_60d == null ? "#64748b" :
                             r.max_gain_60d >= 30 ? "#10b981" :
                             r.max_gain_60d >= 0 ? "#fbbf24" : "#ef4444",
                    })}>
                      {r.max_gain_60d == null ? "-" :
                       (r.max_gain_60d >= 0 ? "+" : "") + r.max_gain_60d.toFixed(1) + "%"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedTarget && results.length === 0 && !searching && (
        <div style={{
          padding: 30, textAlign: "center",
          background: "#1e293b", borderRadius: 8, color: "#94a3b8",
        }}>
          유사도 {Math.round(minScore * 100)}%+ 종목 없음. 임계치를 낮춰보세요.
        </div>
      )}
    </div>
  );
}

// 미니 차트 (SVG 라인)
function ChartLine({ closes, color, small }) {
  if (!closes || closes.length === 0) return null;
  const W = small ? 100 : 600, H = small ? 30 : 80;
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const points = closes.map((c, i) => {
    const x = (i / (closes.length - 1)) * W;
    const y = H - ((c - min) / range) * H;
    return x.toFixed(1) + "," + y.toFixed(1);
  }).join(" ");
  return (
    <svg width={W} height={H} style={{ display: "block" }}>
      <polyline fill="none" stroke={color} strokeWidth={small ? 1 : 2}
                points={points} />
    </svg>
  );
}

function Mini({ label, value, color, sub }) {
  return (
    <div style={{
      background: "#0f172a", border: "1px solid #334155",
      borderRadius: 6, padding: 8,
    }}>
      <div style={{ fontSize: 10, color: "#94a3b8" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: "#64748b" }}>{sub}</div>}
    </div>
  );
}

const th = {
  textAlign: "center", padding: "6px 8px",
  fontSize: 11, fontWeight: 600,
  borderBottom: "1px solid #334155",
};

const td = {
  textAlign: "center", padding: "5px 8px",
  borderBottom: "1px solid #1e293b",
};
