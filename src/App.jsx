import React, { useMemo, useState } from "react";
import tradesData from "./data/trades.json";
import {
  extractAllDays, fmtDate, gapStats, byStock,
  prevPnlDistribution, bySuperLevel, simBuyYesterday,
} from "./gap.js";

export default function App() {
  // 갭 임계치 (사용자 조정)
  const [threshold, setThreshold] = useState(7);

  const allDays = useMemo(() => extractAllDays(tradesData), []);

  const stats = useMemo(() => gapStats(allDays, threshold), [allDays, threshold]);

  const topStocks = useMemo(
    () => byStock(allDays, threshold).slice(0, 20),
    [allDays, threshold]
  );

  const allCases = useMemo(() => {
    return allDays
      .filter(d => d.gap >= threshold)
      .sort((a, b) => b.gapDate.localeCompare(a.gapDate));
  }, [allDays, threshold]);

  const prevDist = useMemo(
    () => prevPnlDistribution(allDays, threshold),
    [allDays, threshold]
  );

  const superDist = useMemo(
    () => bySuperLevel(allDays, threshold),
    [allDays, threshold]
  );

  // 시뮬: 어제 종가 매수 → 갭 시초매도 / SL -10% / 종가 만료
  const simAll = useMemo(
    () => simBuyYesterday(allDays, () => true, 3, -10),
    [allDays]
  );
  const simSuper = useMemo(
    () => simBuyYesterday(allDays, d => d.totalSignals >= 21, 3, -10),
    [allDays]
  );
  const simExtreme = useMemo(
    () => simBuyYesterday(
      allDays,
      d => d.totalSignals >= 21 && Math.abs(d.prevPnl) >= 10,
      3, -10
    ),
    [allDays]
  );

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
            전일 종가 대비 익일 시가 +X% 이상 갭상승한 모든 케이스 ·
            <b style={{color:"#fbbf24"}}> 6년 백테스트 ({tradesData.length}건 기반, 일일 캔들 {allDays.length.toLocaleString()}건)</b>
          </p>
        </div>

        {/* 임계치 슬라이더 */}
        <div style={{
          marginBottom: 16, padding: 12,
          background: "#1e293b", border: "1px solid #334155", borderRadius: 8,
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24" }}>
            갭 임계치
          </span>
          {[3, 5, 7, 10, 15].map(v => (
            <button key={v} onClick={() => setThreshold(v)}
                    style={{
                      background: threshold === v ? "#10b981" : "transparent",
                      color: threshold === v ? "#fff" : "#94a3b8",
                      border: "1px solid " + (threshold === v ? "#10b981" : "#475569"),
                      borderRadius: 6, padding: "6px 14px", fontSize: 13,
                      cursor: "pointer", fontWeight: 700,
                    }}>
              ≥ +{v}%
            </button>
          ))}
        </div>

        {/* 핵심 통계 4 카드 */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10, marginBottom: 16,
        }}>
          <KpiCard label={`갭 ≥ +${threshold}% 발생`}
                   value={stats.n.toLocaleString() + "건"}
                   sub={`전체 일봉의 ${stats.freq.toFixed(2)}%`}
                   color="#10b981" />
          <KpiCard label="평균 갭"
                   value={(stats.avgGap >= 0 ? "+" : "") + stats.avgGap.toFixed(2) + "%"}
                   sub="시초가 매도 시 수익"
                   color="#fbbf24" />
          <KpiCard label="평균 그날 종가"
                   value={(stats.avgDayClose >= 0 ? "+" : "") + stats.avgDayClose.toFixed(2) + "%"}
                   sub={`매수가 대비 (어제 종가 → 오늘 종가 = ${(stats.avgTodayPnl >= 0 ? "+" : "") + stats.avgTodayPnl.toFixed(2)}%)`}
                   color={stats.avgDayClose > stats.avgGap ? "#10b981" : "#ef4444"} />
          <KpiCard label="갭 보존 (양봉)"
                   value={stats.heldRate.toFixed(0) + "%"}
                   sub={stats.heldRate >= 50
                     ? "→ 종가까지 홀딩 권장"
                     : "→ 시초가 매도 권장"}
                   color="#0ea5e9" />
        </div>

        {/* 어제 종가 매수 → 다음날 시뮬 */}
        <Section title="📊 매매 룰 시뮬: 어제 종가 매수 → 갭+3% 시초매도 / SL-10% / 종가 만료">
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 10,
          }}>
            <SimCard
              title="A. 모든 종목"
              desc="조건 없이 매일 매수"
              sim={simAll}
              evColor="#94a3b8"
            />
            <SimCard
              title="B. 21회+ 슈퍼주도주만"
              desc="시그널 빈도 ≥21회 종목"
              sim={simSuper}
              evColor="#fbbf24"
            />
            <SimCard
              title="C. 21+ × 어제 ±10% 등락"
              desc="양극단 변동 후 매수 (가장 강한 신호)"
              sim={simExtreme}
              evColor="#10b981"
            />
          </div>
        </Section>

        {/* 어제 등락률 분포 */}
        <Section title={`📅 어제(D-1) 등락률 별 갭 ≥ +${threshold}% 발생률`}>
          <div style={{ fontSize: 12 }}>
            <div style={{ color: "#94a3b8", marginBottom: 8 }}>
              베이스 레이트 (전체): {stats.freq.toFixed(2)}% — 이보다 높은 조건 = 강한 신호
            </div>
            {prevDist.map((b, i) => (
              <BarRow key={i} label={b.label} hits={b.hits} total={b.total}
                      rate={b.rate} baseRate={stats.freq} />
            ))}
          </div>
        </Section>

        {/* 시그널 빈도 별 */}
        <Section title={`🏆 슈퍼주도주성 별 갭 ≥ +${threshold}% 발생률`}>
          {superDist.map((b, i) => (
            <BarRow key={i} label={b.label} hits={b.hits} total={b.total}
                    rate={b.rate} baseRate={stats.freq} />
          ))}
        </Section>

        {/* TOP 20 종목 */}
        <Section title={`🥇 갭 ≥ +${threshold}% 가장 자주 받는 TOP 20 종목`}>
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

        {/* 전체 케이스 리스트 */}
        <Section title={`📋 갭 ≥ +${threshold}% 발생 전체 ${allCases.length}건 (최신순)`}>
          <div style={{ overflowX: "auto", maxHeight: 600, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead style={{ position: "sticky", top: 0,
                              background: "#1e293b", zIndex: 1 }}>
                <tr style={{ color: "#94a3b8" }}>
                  <th style={th}>#</th>
                  <th style={th}>발생일</th>
                  <th style={th}>종목명</th>
                  <th style={th}>갭</th>
                  <th style={th}>그날 종가</th>
                  <th style={th}>어제 등락</th>
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
                      color: c.currClose > c.currOpen ? "#10b981" : "#ef4444",
                    })}>
                      {(c.currClose >= 0 ? "+" : "") + c.currClose.toFixed(1)}%
                    </td>
                    <td style={Object.assign({}, td, {
                      color: c.prevPnl >= 0 ? "#10b981" : "#ef4444",
                    })}>
                      {(c.prevPnl >= 0 ? "+" : "") + c.prevPnl.toFixed(1)}%
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

        {/* 결론 */}
        <Section title="💡 핵심 인사이트">
          <ul style={{ fontSize: 13, lineHeight: 1.8, color: "#cbd5e1",
                       paddingLeft: 20, margin: 0 }}>
            <li>
              갭 ≥ +{threshold}% 발생 후 평균 그날 종가 <b style={{color:"#10b981"}}>
                +{stats.avgDayClose.toFixed(2)}%</b>
              {stats.avgDayClose > stats.avgGap
                ? " (시초가 매도 +" + stats.avgGap.toFixed(2) + "% 보다 높음 → 종가까지 홀딩이 정답)"
                : " (시초가 매도 +" + stats.avgGap.toFixed(2) + "% 보다 낮음 → 시초가 매도가 정답)"
              }
            </li>
            <li>
              어제 캔들로 다음날 갭 예측 어려움 — 양극단 (±10% 이상)이 가장 강한 신호 (베이스의 약 4배)
            </li>
            <li>
              "어제 종가 매수 → 다음날 갭+3% 시초매도" 룰 EV: <b style={{color:"#10b981"}}>
                +{simExtreme.ev.toFixed(2)}%</b>
              {" (조건: 21+ 슈퍼주도주 + 어제 ±10% 등락, 표본 "}
              {simExtreme.n}{"건)"}
            </li>
            <li>
              슬리피지 -0.3% 감안 시 실제 EV: 약 +{Math.max(0, simExtreme.ev - 0.3).toFixed(2)}%
            </li>
            <li>
              매매 빈도: 6년 {simExtreme.n}건 → 연 약 {Math.round(simExtreme.n / 6)}건 (매일 평균 {(simExtreme.n / 6 / 250).toFixed(1)}건)
            </li>
          </ul>
        </Section>

        <div style={{ textAlign: "center", color: "#475569", fontSize: 11,
                      marginTop: 20, paddingBottom: 20 }}>
          데이터: {tradesData.length}건의 trade × 평균 보유 N일 = 일봉 {allDays.length.toLocaleString()}건 ·
          기간: 2021.01 ~ 2026.04
        </div>
      </div>
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
