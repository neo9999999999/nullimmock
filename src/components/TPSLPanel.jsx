import React, { useState, useEffect } from "react";
import { gridSearchSingle, gridSearchSplit } from "../lib/simulator.js";

function NumberInput(props) {
  return (
    <label style={{ fontSize: 11, color: "#475569", display: "flex",
                    alignItems: "center", gap: 4 }}>
      <span>{props.label}</span>
      <input type="number" value={props.value}
             onChange={function (e) { props.onChange(parseFloat(e.target.value) || 0); }}
             style={{ width: 56, padding: "3px 6px", border: "1px solid #cbd5e1",
                      borderRadius: 4, fontSize: 12 }} />
      {props.suffix && <span>{props.suffix}</span>}
    </label>
  );
}

const OBJECTIVES = [
  ["cum", "💰 누적 max", "전체 maxDays 그리드 중 누적 최대"],
  ["cum10", "🔟 10일 max", "보유 10일 고정에서 누적 최대"],
  ["cum20", "🕐 20일 max", "보유 20일 고정에서 누적 최대"],
  ["efficiency", "⚡ 일당효율", "보유일당 EV 최대"],
  ["ev", "📈 평균EV", "건당 기댓값 최대"],
];

export default function TPSLPanel(props) {
  const [searching, setSearching] = useState(false);
  const [bestInfo, setBestInfo] = useState(null);
  const [activeObj, setActiveObj] = useState(null);

  function update(field, value) {
    const next = Object.assign({}, props.rule);
    next[field] = value;
    props.onChange(next);
  }

  // 정렬 기준 클릭 = 즉시 그리드 + 적용
  function applyObjective(objKey) {
    setActiveObj(objKey);
    setSearching(true);
    setTimeout(function () {
      // cum10/cum20는 maxDays 고정 + 누적 최대
      let realObj = objKey;
      let maxDaysList = [3, 5, 7, 10, 15, 20];
      if (objKey === "cum10") { realObj = "cum"; maxDaysList = [10]; }
      else if (objKey === "cum20") { realObj = "cum"; maxDaysList = [20]; }

      let result;
      if (props.rule.mode === "single") {
        result = gridSearchSingle(props.trades, {
          // 더 공격적 TP/SL 그리드
          tps: [30, 50, 70, 100, 150, 200, 300, 500],
          sls: [-5, -7, -10, -15, -20, -25],
          maxDaysList: maxDaysList,
          objective: realObj,
        });
        const b = result.best;
        if (b) {
          props.onChange(Object.assign({}, props.rule, {
            tp: b.tp, sl: b.sl, maxDays: b.maxDays,
          }));
        }
      } else {
        result = gridSearchSplit(props.trades, {
          tp1s: [20, 30, 50, 70],
          tp2s: [50, 100, 150, 200, 300, 500],
          sls: [-5, -7, -10, -15, -20],
          fsls: [0, 1],
          maxDaysList: maxDaysList,
          objective: realObj,
        });
        const b = result.best;
        if (b) {
          props.onChange(Object.assign({}, props.rule, {
            tp1: b.tp1, tp2: b.tp2, sl: b.sl, fsl: b.fsl, maxDays: b.maxDays,
          }));
        }
      }
      setBestInfo({ result, objective: objKey });
      setSearching(false);
    }, 30);
  }

  function applyPreset() {
    // 1차 백테스트 최강 디폴트 (필터 OPTIMAL과 매칭)
    props.onChange(Object.assign({}, props.rule, {
      mode: "single", tp: 100, sl: -10, maxDays: 10,
    }));
    setBestInfo(null);
    setActiveObj(null);
  }

  return (
    <div style={{
      marginBottom: 16, padding: 14, background: "#fff",
      border: "1px solid #e2e8f0", borderRadius: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12,
                    flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
          📊 매매 룰
        </span>

        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={function () { update("mode", "single"); }}
                  style={modeBtn(props.rule.mode === "single")}>
            단일 TP
          </button>
          <button onClick={function () { update("mode", "split"); }}
                  style={modeBtn(props.rule.mode === "split")}>
            분할 TP1+TP2
          </button>
        </div>

        <span style={{ color: "#cbd5e1" }}>|</span>

        {props.rule.mode === "single" && (
          <React.Fragment>
            <NumberInput label="TP" value={props.rule.tp}
                         onChange={function (v) { update("tp", v); }} suffix="%" />
            <NumberInput label="SL" value={props.rule.sl}
                         onChange={function (v) { update("sl", v); }} suffix="%" />
          </React.Fragment>
        )}

        {props.rule.mode === "split" && (
          <React.Fragment>
            <NumberInput label="TP1" value={props.rule.tp1}
                         onChange={function (v) { update("tp1", v); }} suffix="%" />
            <NumberInput label="TP2" value={props.rule.tp2}
                         onChange={function (v) { update("tp2", v); }} suffix="%" />
            <NumberInput label="SL" value={props.rule.sl}
                         onChange={function (v) { update("sl", v); }} suffix="%" />
            <label style={{ fontSize: 11, color: "#475569", display: "flex",
                            alignItems: "center", gap: 4 }}>
              <input type="checkbox" checked={!!props.rule.fsl}
                     onChange={function (e) { update("fsl", e.target.checked ? 1 : 0); }} />
              <span>본전보장</span>
            </label>
          </React.Fragment>
        )}

        <NumberInput label="최대" value={props.rule.maxDays}
                     onChange={function (v) { update("maxDays", v); }} suffix="일" />

        <span style={{ marginLeft: "auto" }} />

        <button onClick={applyPreset}
                style={{
                  background: "#fce7f3", color: "#9f1239", border: "none",
                  borderRadius: 6, padding: "5px 14px", fontSize: 12,
                  cursor: "pointer", fontWeight: 700,
                }}>
          ⭐ 최강 디폴트 (TP100/SL-10/10일)
        </button>
      </div>

      {/* 자동 최적화 — 클릭 즉시 적용 */}
      <div style={{
        background: "#f8fafc", borderRadius: 8, padding: 10,
        display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
        marginBottom: bestInfo ? 8 : 0,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>
          🔍 자동 최적화 (클릭 즉시 적용):
        </span>
        {OBJECTIVES.map(function (o) {
          const active = activeObj === o[0];
          return (
            <button key={o[0]} onClick={function () { applyObjective(o[0]); }}
                    title={o[2]} disabled={searching}
                    style={{
                      background: active ? "#1e293b" : "#fff",
                      color: active ? "#fff" : "#475569",
                      border: "1px solid " + (active ? "#1e293b" : "#cbd5e1"),
                      borderRadius: 6, padding: "6px 14px", fontSize: 12,
                      cursor: searching ? "wait" : "pointer", fontWeight: 700,
                    }}>
              {searching && active ? "⏳ ..." : o[1]}
            </button>
          );
        })}
      </div>

      {bestInfo && bestInfo.result && bestInfo.result.best && (
        <BestResult bestInfo={bestInfo} mode={props.rule.mode} />
      )}

      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>
        진입: 그날 종가 (15:20 KST 시장가) /{" "}
        {props.rule.mode === "single"
          ? "TP 또는 SL 도달 시 즉시 청산. 만료 시 종가 청산."
          : "TP1 절반 → TP2 잔량. fSL ON이면 TP1 후 본전 보장."}
      </div>
    </div>
  );
}

function BestResult(props) {
  const b = props.bestInfo.result.best;
  const top5 = props.bestInfo.result.top5;
  const obj = props.bestInfo.objective;
  const mode = props.mode;

  const evColor = b.avg > 0 ? "#dc2626" : "#2563eb";
  const cumColor = b.cum > 0 ? "#dc2626" : "#2563eb";

  return (
    <div style={{
      background: b.cum > 0 ? "#eff6ff" : "#fef2f2",
      border: "1px solid " + (b.cum > 0 ? "#bfdbfe" : "#fecaca"),
      borderRadius: 8, padding: 12, marginBottom: 8,
    }}>
      <div style={{ fontSize: 12, color: b.cum > 0 ? "#1e40af" : "#991b1b",
                    fontWeight: 700, marginBottom: 8 }}>
        ✓ 적용됨: {mode === "single"
          ? "TP+" + b.tp + " / SL" + b.sl + " / 보유 " + b.maxDays + "일"
          : "TP1+" + b.tp1 + " / TP2+" + b.tp2 + " / SL" + b.sl
            + " / fSL " + (b.fsl ? "ON" : "OFF") + " / 보유 " + b.maxDays + "일"}
      </div>

      <div style={{ display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(95px, 1fr))",
                    gap: 6, marginBottom: 8 }}>
        <Stat label="누적" value={(b.cum >= 0 ? "+" : "") + b.cum.toFixed(0) + "%"}
              color={cumColor} />
        <Stat label="EV" value={(b.avg >= 0 ? "+" : "") + b.avg.toFixed(2) + "%"}
              color={evColor} />
        <Stat label="승률" value={b.win.toFixed(1) + "%"} color="#0891b2" />
        <Stat label="평균익절" value={b.avgDaysTP > 0 ? b.avgDaysTP.toFixed(1) + "일" : "-"}
              color="#dc2626" />
        <Stat label="평균손절" value={b.avgDaysSL > 0 ? b.avgDaysSL.toFixed(1) + "일" : "-"}
              color="#2563eb" />
        <Stat label="평균보유" value={b.days.toFixed(1) + "일"} color="#475569" />
        <Stat label="일당EV" value={b.efficiency != null
          ? (b.efficiency >= 0 ? "+" : "") + b.efficiency.toFixed(2) + "%/d"
          : "-"} color={(b.efficiency || 0) > 0 ? "#dc2626" : "#2563eb"} />
      </div>

      <details>
        <summary style={{ fontSize: 11, color: "#475569", cursor: "pointer",
                          userSelect: "none", fontWeight: 600 }}>
          🏆 TOP 5 후보 보기
        </summary>
        <div style={{ marginTop: 6, fontSize: 11 }}>
          {top5.map(function (r, i) {
            const cfg = mode === "single"
              ? "TP" + r.tp + " SL" + r.sl + " " + r.maxDays + "일"
              : "TP1=" + r.tp1 + " TP2=" + r.tp2 + " SL" + r.sl + " " + r.maxDays + "일";
            return (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between",
                padding: "3px 6px", background: i === 0 ? "#fef3c7" : "transparent",
                borderRadius: 4, gap: 8,
              }}>
                <span style={{ fontWeight: i === 0 ? 700 : 400, minWidth: 130 }}>
                  {i + 1}. {cfg}
                </span>
                <span style={{ color: r.cum > 0 ? "#dc2626" : "#2563eb",
                               fontWeight: 600, fontSize: 10 }}>
                  누적{r.cum >= 0 ? "+" : ""}{r.cum.toFixed(0)}% ·
                  EV{r.avg >= 0 ? "+" : ""}{r.avg.toFixed(2)}% ·
                  승률{r.win.toFixed(0)}% ·
                  익절{r.avgDaysTP > 0 ? r.avgDaysTP.toFixed(1) + "d" : "-"}
                </span>
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}

function Stat(props) {
  return (
    <div style={{ background: "#fff", borderRadius: 6, padding: "5px 8px",
                  border: "1px solid #e2e8f0" }}>
      <div style={{ fontSize: 9, color: "#94a3b8" }}>{props.label}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: props.color }}>
        {props.value}
      </div>
    </div>
  );
}

function modeBtn(active) {
  return {
    background: active ? "#3b82f6" : "#f1f5f9",
    color: active ? "#fff" : "#475569",
    border: "1px solid " + (active ? "#3b82f6" : "#cbd5e1"),
    borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer",
    fontWeight: 700,
  };
}
