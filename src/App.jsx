import React, { useMemo, useState } from "react";
import tradesData from "./data/trades.json";
import {
  extractAllDays, fmtDate, gapStats, byStock,
  prevPnlDistribution, bySuperLevel, simBuyYesterday,
} from "./gap.js";

export default function App() {
  // 필터 상태
  const [threshold, setThreshold] = useState(3);
  const [prevBullOnly, setPrevBullOnly] = useState(true);  // 어제 양봉만
  const [ivFilter, setIvFilter] = useState("foreign");     // all / foreign / instOnly / foreignOnly / both / negative
  const [superOnly, setSuperOnly] = useState(false);       // 21회+만

  const allDays = useMemo(() => extractAllDays(tradesData), []);

  // 필터 적용 (베이스 = 임계치 X, 다른 조건만)
  const baseDays = useMemo(() => {
    return allDays.filter(d => {
      if (prevBullOnly && !d.prevWasBull) return false;
      if (superOnly && d.totalSignals < 21) return false;
      if (ivFilter === "foreign" && !(d.iv === "기+외" || d.iv === "외만")) return false;
      if (ivFilter === "both" && d.iv !== "기+외") return false;
      if (ivFilter === "foreignOnly" && d.iv !== "외만") return false;
      if (ivFilter === "instOnly" && d.iv !== "기만") return false;
      if (ivFilter === "negative" && d.iv !== "둘다-") return false;
      return true;
    });
  }, [allDays, prevBullOnly, ivFilter, superOnly]);

  // 임계치 적용된 케이스
  const stats = useMemo(() => {
    const matched = baseDays.filter(d => d.gap >= threshold);
    if (matched.length === 0) {
      return { n: 0, freq: 0, avgGap: 0, avgDayClose: 0, heldRate: 0, avgTodayPnl: 0, baseN: baseDays.length };
    }
    let sumGap = 0, sumClose = 0, held = 0, sumPnl = 0, gainCnt = 0;
    for (const m of matched) {
      sumGap += m.gap;
      sumClose += m.currClose;
      sumPnl += m.todayPnl;
      if (m.gapHeld) held++;
      if (m.todayPnl > 0) gainCnt++;
    }
    return {
      n: matched.length,
      baseN: baseDays.length,
      freq: matched.length / baseDays.length * 100,
      avgGap: sumGap / matched.length,
      avgDayClose: sumClose / matched.length,
      heldRate: held / matched.length * 100,
      avgTodayPnl: sumPnl / matched.length,
      gainRate: gainCnt / matched.length * 100,
    };
  }, [baseDays, threshold]);

  const topStocks = useMemo(() => {
    const matched = baseDays.filter(d => d.gap >= threshold);
    const byName = {};
    for (const m of matched) {
      if (!byName[m.stockName]) {
        byName[m.stockName] = {
          name: m.stockName, market: m.market,
          totalSignals: m.totalSignals, count: 0, sumGap: 0,
        };
      }
      byName[m.stockName].count++;
      byName[m.stockName].sumGap += m.gap;
    }
    for (const s of Object.values(byName)) s.avgGap = s.sumGap / s.count;
    return Object.values(byName).sort((a, b) => b.count - a.count).slice(0, 20);
  }, [baseDays, threshold]);

  const allCases = useMemo(() => {
    return baseDays
      .filter(d => d.gap >= threshold)
      .sort((a, b) => b.gapDate.localeCompare(a.gapDate));
  }, [baseDays, threshold]);

  // 매매 룰 EV (베이스 필터 적용된 종목으로)
  const sim = useMemo(() => {
    if (baseDays.length === 0) return { n: 0, ev: 0, win: 0 };
    let n = 0, sumPnl = 0, wins = 0, hits = 0, sls = 0, expires = 0;
    for (const d of baseDays) {
      n++;
      if (d.gap >= 3) {
        hits++; wins++; sumPnl += d.gap; continue;
      }
      const dayLow = (d.currLow - d.prevClose) / (1 + d.prevClose / 100);
      if (dayLow <= -10) {
        sls++; sumPnl -= 10; continue;
      }
      expires++; sumPnl += d.todayPnl;
      if (d.todayPnl > 0) wins++;
    }
    return {
      n, ev: sumPnl / n, win: wins / n * 100,
      hits, sls, expires,
      hitRate: hits / n * 100,
      slRate: sls / n * 100,
      expRate: expires / n * 100,
    };
  }, [baseDays]);

  return (
    <div style={{
      minHeight: "100vh", background: "#0f172a", color: "#e2e8f0",
      fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
      padding: 16,
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* 헤더 */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#10b981" }}>
            🎯 갭상승 종목 발굴
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#94a3b8" }}>
            전일 종가 매수 → 다음날 시초/종가 매도 백테스트 ·
            <b style={{color:"#fbbf24"}}> 6년 데이터 (일봉 {allDays.length.toLocaleString()}건)</b>
          </p>
        </div>

        {/* 필터 박스 */}
        <div style={{
          marginBottom: 16, padding: 14,
          background: "#1e293b", border: "1px solid #334155", borderRadius: 8,
        }}>
          {/* 어제 양봉 + 슈퍼주도주 */}
          <div style={{ display: "flex", alignItems: "center", gap: 16,
                        flexWrap: "wrap", marginBottom: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6,
                            fontSize: 13, cursor: "pointer", userSelect: "none" }}>
              <input type="checkbox" checked={prevBullOnly}
                     onChange={(e) => setPrevBullOnly(e.target.checked)}
                     style={{ width: 16, height: 16, cursor: "pointer" }} />
              <span style={{ color: prevBullOnly ? "#10b981" : "#94a3b8",
                             fontWeight: prevBullOnly ? 700 : 400 }}>
                🟢 어제 양봉만
              </span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6,
                            fontSize: 13, cursor: "pointer", userSelect: "none" }}>
              <input type="checkbox" checked={superOnly}
                     onChange={(e) => setSuperOnly(e.target.checked)}
                     style={{ width: 16, height: 16, cursor: "pointer" }} />
              <span style={{ color: superOnly ? "#10b981" : "#94a3b8",
                             fontWeight: superOnly ? 700 : 400 }}>
                🏆 21회+ 슈퍼주도주만
              </span>
            </label>
          </div>

          {/* 수급 필터 */}
          <div style={{ display: "flex", alignItems: "center", gap: 6,
                        flexWrap: "wrap", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "#fbbf24", fontWeight: 700,
                           minWidth: 50 }}>수급</span>
            {[
              { key: "all", label: "전체" },
              { key: "foreign", label: "외국인 포함 (기+외 OR 외만)" },
              { key: "both", label: "기+외만" },
              { key: "foreignOnly", label: "외만" },
              { key: "instOnly", label: "기관만" },
              { key: "negative", label: "둘다-" },
            ].map(opt => (
              <button key={opt.key} onClick={() => setIvFilter(opt.key)}
                      style={{
                        background: ivFilter === opt.key ? "#10b981" : "transparent",
                        color: ivFilter === opt.key ? "#fff" : "#94a3b8",
                        border: "1px solid " + (ivFilter === opt.key ? "#10b981" : "#475569"),
                        borderRadius: 6, padding: "5px 10px", fontSize: 11,
                        cursor: "pointer", fontWeight: 700,
                      }}>
                {opt.label}
              </button>
            ))}
          </div>

          {/* 갭 임계치 */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "#fbbf24", fontWeight: 700,
                           minWidth: 50 }}>갭</span>
            {[3, 5, 7, 10, 15].map(v => (
              <button key={v} onClick={() => setThreshold(v)}
                      style={{
                        background: threshold === v ? "#10b981" : "transparent",
                        color: threshold === v ? "#fff" : "#94a3b8",
                        border: "1px solid " + (threshold === v ? "#10b981" : "#475569"),
                        borderRadius: 6, padding: "5px 12px", fontSize: 12,
                        cursor: "pointer", fontWeight: 700,
                      }}>
                ≥ +{v}%
              </button>
            ))}
          </div>
        </div>

        {/* 요약 */}
        <div style={{
          marginBottom: 16, padding: 14,
          background: "linear-gradient(to right, #064e3b, #134e4a)",
          border: "1px solid #10b981", borderRadius: 8, color: "#a7f3d0",
          fontSize: 13, lineHeight: 1.7,
        }}>
          <b style={{ fontSize: 15, color: "#10b981" }}>📊 결과:</b>
          {" "}현재 필터로 베이스 <b style={{color:"#fff"}}>{stats.baseN.toLocaleString()}건</b> 중
          갭 +{threshold}% 이상 <b style={{color:"#fbbf24"}}>{stats.n.toLocaleString()}건</b> 발생
          <b style={{color:"#fff"}}> ({stats.freq.toFixed(2)}%)</b>
          {stats.n > 0 && (
            <span> · 평균 갭 <b style={{color:"#10b981"}}>+{stats.avgGap.toFixed(2)}%</b>
            · 평균 익일 손익 <b style={{color:"#10b981"}}>{stats.avgTodayPnl >= 0 ? "+" : ""}{stats.avgTodayPnl.toFixed(2)}%</b>
            · 익일 수익률 <b style={{color:"#10b981"}}>{stats.gainRate.toFixed(0)}%</b></span>
          )}
        </div>

        {/* KPI 4 카드 */}
        {stats.n > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10, marginBottom: 16,
          }}>
            <KpiCard label={`갭 ≥ +${threshold}% 발생`}
                     value={stats.n.toLocaleString() + "건"}
                     sub={`베이스 ${stats.baseN.toLocaleString()}건의 ${stats.freq.toFixed(2)}%`}
                     color="#10b981" />
            <KpiCard label="평균 갭 (시초매도)"
                     value={"+" + stats.avgGap.toFixed(2) + "%"}
                     sub="시초가 매도 시 평균 수익"
                     color="#fbbf24" />
            <KpiCard label="평균 익일 손익 (종가)"
                     value={(stats.avgTodayPnl >= 0 ? "+" : "") + stats.avgTodayPnl.toFixed(2) + "%"}
                     sub={`어제 종가 → 오늘 종가 (승률 ${stats.gainRate.toFixed(0)}%)`}
                     color={stats.avgTodayPnl > 0 ? "#10b981" : "#ef4444"} />
            <KpiCard label="갭 보존 (양봉)"
                     value={stats.heldRate.toFixed(0) + "%"}
                     sub={stats.heldRate >= 50
                       ? "→ 종가까지 홀딩 권장"
                       : "→ 시초가 매도 권장"}
                     color="#0ea5e9" />
          </div>
        )}

        {/* 매매 룰 시뮬 (필터된 베이스 전체에 적용) */}
        {sim.n > 0 && (
          <Section title="📊 매매 룰 시뮬: 어제 종가 매수 → 갭+3% 시초매도 / SL-10% / 종가 만료">
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 10,
            }}>
              <SimMetric label="EV (1건당)"
                         value={(sim.ev >= 0 ? "+" : "") + sim.ev.toFixed(2) + "%"}
                         color={sim.ev > 0 ? "#10b981" : "#ef4444"} />
              <SimMetric label="승률"
                         value={sim.win.toFixed(0) + "%"} color="#0ea5e9" />
              <SimMetric label="갭 히트"
                         value={sim.hitRate.toFixed(0) + "%"} color="#10b981" />
              <SimMetric label="SL"
                         value={sim.slRate.toFixed(0) + "%"} color="#ef4444" />
              <SimMetric label="만료"
                         value={sim.expRate.toFixed(0) + "%"} color="#94a3b8" />
              <SimMetric label="표본"
                         value={sim.n.toLocaleString() + "건"} color="#fbbf24"
                         sub={`연 약 ${Math.round(sim.n / 6)}건`} />
            </div>
          </Section>
        )}

        {/* TOP 20 종목 */}
        {topStocks.length > 0 && (
          <Section title={`🥇 TOP 20 종목 (가장 자주 갭 +${threshold}% 발생)`}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#0f172a", color: "#94a3b8" }}>
                    <th style={th}>#</th>
                    <th style={th}>종목명</th>
                    <th style={th}>시장</th>
                    <th style={th}>발생</th>
                    <th style={th}>평균 갭</th>
                    <th style={th}>시그널</th>
                  </tr>
                </thead>
                <tbody>
                  {topStocks.map((s, i) => (
                    <tr key={s.name} style={{
                      background: i % 2 === 0 ? "#0f172a" : "transparent",
                    }}>
                      <td style={td}>{i + 1}</td>
                      <td style={Object.assign({}, td, {fontWeight: 700, color: "#fbbf24"})}>
                        {s.name}
                      </td>
                      <td style={td}>{s.market}</td>
                      <td style={Object.assign({}, td, {fontWeight: 700, color: "#10b981"})}>
                        {s.count}회
                      </td>
                      <td style={Object.assign({}, td, {color: "#10b981"})}>
                        +{s.avgGap.toFixed(2)}%
                      </td>
                      <td style={Object.assign({}, td, {color: "#94a3b8"})}>
                        {s.totalSignals}회
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* 전체 케이스 리스트 */}
        {allCases.length > 0 && (
          <Section title={`📋 전체 ${allCases.length.toLocaleString()}건 (최신순)`}>
            <div style={{ overflowX: "auto", maxHeight: 600, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead style={{ position: "sticky", top: 0,
                                background: "#1e293b", zIndex: 1 }}>
                  <tr style={{ color: "#94a3b8" }}>
                    <th style={th}>#</th>
                    <th style={th}>발생일</th>
                    <th style={th}>종목명</th>
                    <th style={th}>갭</th>
                    <th style={th}>익일 손익</th>
                    <th style={th}>그날 종가</th>
                    <th style={th}>어제 등락</th>
                    <th style={th}>수급</th>
                    <th style={th}>시그널</th>
                    <th style={th}>D+</th>
                    <th style={th}>슈퍼</th>
                  </tr>
                </thead>
                <tbody>
                  {allCases.map((c, i) => (
                    <tr key={i} style={{
                      background: i % 2 === 0 ? "#0f172a" : "transparent",
                      color: "#cbd5e1",
                    }}>
                      <td style={td}>{i + 1}</td>
                      <td style={td}>{fmtDate(c.gapDate)}</td>
                      <td style={Object.assign({}, td, {fontWeight: 700, color: "#fbbf24"})}>
                        {c.stockName}
                      </td>
                      <td style={Object.assign({}, td, {fontWeight: 700, color: "#10b981"})}>
                        +{c.gap.toFixed(2)}%
                      </td>
                      <td style={Object.assign({}, td, {
                        fontWeight: 700,
                        color: c.todayPnl >= 0 ? "#10b981" : "#ef4444",
                      })}>
                        {(c.todayPnl >= 0 ? "+" : "") + c.todayPnl.toFixed(2)}%
                      </td>
                      <td style={Object.assign({}, td, {
                        color: c.currClose > c.currOpen ? "#10b981" : "#ef4444",
                      })}>
                        {(c.currClose >= 0 ? "+" : "") + c.currClose.toFixed(1)}%
                      </td>
                      <td style={Object.assign({}, td, {
                        color: c.prevPnl >= 0 ? "#10b981" : "#ef4444",
                      })}>
                        {(c.prevPnl >= 0 ? "+" : "") + c.prevPnl.toFixed(1)}%
                      </td>
                      <td style={Object.assign({}, td, {color: "#fbbf24"})}>
                        {c.iv}
                      </td>
                      <td style={td}>{fmtDate(c.refDate)} ({c.signalCh}%)</td>
                      <td style={td}>{c.dayIdx}d</td>
                      <td style={Object.assign({}, td, {color: "#94a3b8"})}>
                        {c.totalSignals}회
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {allCases.length === 0 && (
          <div style={{
            padding: 40, textAlign: "center", color: "#94a3b8",
            background: "#1e293b", borderRadius: 8,
          }}>
            현재 필터로 매칭되는 케이스가 없습니다.
          </div>
        )}

        <div style={{ textAlign: "center", color: "#475569", fontSize: 11,
                      marginTop: 20, paddingBottom: 20 }}>
          데이터: {tradesData.length}건 trade × 평균 보유 = 일봉 {allDays.length.toLocaleString()}건 ·
          기간: 2021.01 ~ 2026.04
        </div>
      </div>
    </div>
  );
}

function SimMetric(props) {
  return (
    <div style={{
      background: "#0f172a", border: "1px solid #334155",
      borderRadius: 6, padding: 8,
    }}>
      <div style={{ fontSize: 10, color: "#94a3b8" }}>{props.label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: props.color }}>
        {props.value}
      </div>
      {props.sub && (
        <div style={{ fontSize: 9, color: "#64748b" }}>{props.sub}</div>
      )}
    </div>
  );
}

function KpiCard(props) {
  return (
    <div style={{
      background: "#1e293b", border: "1px solid #334155",
      borderRadius: 8, padding: 12,
    }}>
      <div style={{ fontSize: 11, color: "#94a3b8" }}>{props.label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: props.color || "#fff",
                    marginTop: 4 }}>
        {props.value}
      </div>
      <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
        {props.sub}
      </div>
    </div>
  );
}

function Section(props) {
  return (
    <div style={{
      marginBottom: 16, padding: 14,
      background: "#1e293b", border: "1px solid #334155",
      borderRadius: 8,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#fbbf24",
                    marginBottom: 10 }}>
        {props.title}
      </div>
      {props.children}
    </div>
  );
}

function SimCard(props) {
  const ev = props.sim.ev;
  const evDisplay = (ev >= 0 ? "+" : "") + ev.toFixed(2) + "%";
  return (
    <div style={{
      background: "#0f172a", border: "1px solid #334155",
      borderRadius: 8, padding: 12,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
        {props.title}
      </div>
      <div style={{ fontSize: 10, color: "#64748b", marginBottom: 6 }}>
        {props.desc}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800,
                    color: ev > 0 ? "#10b981" : "#ef4444" }}>
        EV {evDisplay}
      </div>
      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>
        표본 {props.sim.n.toLocaleString()}건 · 승률 {props.sim.win.toFixed(0)}% ·
        <br />
        갭히트 {props.sim.hitRate.toFixed(0)}% / SL {props.sim.slRate.toFixed(0)}% /
        만료 {props.sim.expRate.toFixed(0)}%
      </div>
    </div>
  );
}

function BarRow(props) {
  const isHigh = props.rate > props.baseRate;
  const w = Math.min(100, props.rate / 10 * 100);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "4px 0", fontSize: 11,
    }}>
      <span style={{ minWidth: 130, color: "#94a3b8" }}>{props.label}</span>
      <span style={{ minWidth: 80, color: "#fff" }}>
        {props.hits.toLocaleString()} / {props.total.toLocaleString()}
      </span>
      <span style={{
        flex: 1, height: 14, background: "#0f172a", borderRadius: 3,
        position: "relative",
      }}>
        <span style={{
          position: "absolute", top: 0, left: 0, height: "100%",
          width: w + "%", borderRadius: 3,
          background: isHigh ? "#10b981" : "#475569",
          transition: "width 0.3s",
        }} />
      </span>
      <span style={{
        minWidth: 50, textAlign: "right", fontWeight: 700,
        color: isHigh ? "#10b981" : "#94a3b8",
      }}>
        {props.rate.toFixed(2)}%
      </span>
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
