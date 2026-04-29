import React, { useState } from "react";
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
  ["efficiency", "⚡ 일당효율", "보유일당 EV 최대"],
  ["cum", "💰 전체 누적", "모든 maxDays 그리드 중 누적 최대"],
  ["cum5", "5일 max", "보유 5일 고정에서 누적 최대"],
  ["cum10", "10일 max", "보유 10일 고정에서 누적 최대"],
  ["cum15", "15일 max", "보유 15일 고정에서 누적 최대"],
  ["cum20", "20일 max", "보유 20일 고정에서 누적 최대"],
  ["cum25", "25일 max", "보유 25일 고정에서 누적 최대"],
  ["cum30", "30일 max", "보유 30일 고정에서 누적 최대"],
  ["cum60", "60일 max", "보유 60일 고정에서 누적 최대"],
];

function fmtKrw(amt) {
  if (amt === 0) return "0원";
  const sign = amt < 0 ? "-" : "+";
  const abs = Math.abs(amt);
  if (abs >= 10000000) return sign + (abs / 10000000).toFixed(2) + "천만원";
  if (abs >= 10000) return sign + Math.round(abs / 10000).toLocaleString() + "만원";
  return sign + abs.toLocaleString() + "원";
}

export default function TPSLPanel(props) {
  const [bestInfo, setBestInfo] = useState(null);
  const [activeObj, setActiveObj] = useState(null);

  function update(field, value) {
    const next = Object.assign({}, props.rule);
    next[field] = value;
    props.onChange(next);
  }

  function applyObjective(objKey) {
    setActiveObj(objKey);

    let realObj = "cum";
    let maxDaysList = [3, 5, 7, 10, 15, 20, 25, 30, 60];
    if (objKey === "cum5") { maxDaysList = [5]; }
    else if (objKey === "cum10") { maxDaysList = [10]; }
    else if (objKey === "cum15") { maxDaysList = [15]; }
    else if (objKey === "cum20") { maxDaysList = [20]; }
    else if (objKey === "cum25") { maxDaysList = [25]; }
    else if (objKey === "cum30") { maxDaysList = [30]; }
    else if (objKey === "cum60") { maxDaysList = [60]; }
    else if (objKey === "efficiency") { realObj = "efficiency"; }

    const target = props.tradesForGrid || props.trades;
    const tps = [10, 15, 20, 25, 30, 50, 70, 100, 150];
    const sls = [-3, -5, -7, -10, -15];

    let result;
    if (props.rule.mode === "single") {
      result = gridSearchSingle(target, {
        tps: tps, sls: sls, maxDaysList: maxDaysList, objective: realObj,
      });
      const b = result.best;
      console.log("[applyObjective]", objKey, "→ best:", b ? {tp: b.tp, sl: b.sl, maxDays: b.maxDays, cum: b.cum} : null);
      if (b) {
        // 명시적으로 새 룰 객체 (props.rule spread 후 덮어쓰기)
        const newRule = {
          mode: "single",
          tp: b.tp,
          sl: b.sl,
          maxDays: b.maxDays,
          tp1: props.rule.tp1,
          tp2: props.rule.tp2,
          fsl: props.rule.fsl,
        };
        console.log("[applyObjective] onChange call:", newRule);
        props.onChange(newRule);
      }
    } else {
      result = gridSearchSplit(target, {
        tp1s: [10, 15, 20, 25, 30, 50],
        tp2s: [30, 50, 70, 100, 150],
        sls: sls, fsls: [0, 1],
        maxDaysList: maxDaysList,
        objective: realObj,
      });
      const b = result.best;
      console.log("[applyObjective split]", objKey, "→ best:", b ? {tp1: b.tp1, tp2: b.tp2, sl: b.sl, fsl: b.fsl, maxDays: b.maxDays, cum: b.cum} : null);
      if (b) {
        const newRule = {
          mode: "split",
          tp: props.rule.tp,
          sl: b.sl,
          maxDays: b.maxDays,
          tp1: b.tp1,
          tp2: b.tp2,
          fsl: b.fsl,
        };
        props.onChange(newRule);
      }
    }
    setBestInfo({ result: result, objective: objKey });
  }

  function applyPreset() {
    props.onChange(Object.assign({}, props.rule, {
      mode: "single", tp: 100, sl: -10, maxDays: 10,
    }));
    setBestInfo(null);
    setActiveObj(null);
  }

  const investAmt = props.investAmt != null ? props.investAmt : 500000;

  return (
    <div style={{
      marginBottom: 16, padding: 14, background: "#fff",
      border: "1px solid #e2e8f0", borderRadius: 12,
    }}>
      {/* 룰 입력 행 */}
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
      </div>

      {/* 자동 최적화 */}
      <div style={{
        background: "#f8fafc", borderRadius: 8, padding: 10,
        display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
        marginBottom: bestInfo ? 8 : 0,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>
          🔍 자동 최적화 (시간 무관 고정 룰):
        </span>
        {OBJECTIVES.map(function (o) {
          const active = activeObj === o[0];
          return (
            <button key={o[0]} onClick={function () { applyObjective(o[0]); }}
                    title={o[2]}
                    style={{
                      background: active ? "#1e293b" : "#fff",
                      color: active ? "#fff" : "#475569",
                      border: "1px solid " + (active ? "#1e293b" : "#cbd5e1"),
                      borderRadius: 6, padding: "6px 14px", fontSize: 12,
                      cursor: "pointer", fontWeight: 700,
                    }}>
              {o[1]}
            </button>
          );
        })}
      </div>

      {/* 투자금 입력 */}
      <div style={{
        background: "#fef3c7", border: "1px solid #fde047",
        borderRadius: 8, padding: "8px 12px",
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        marginTop: 8, marginBottom: bestInfo ? 8 : 0,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#78350f" }}>
          💵 종목당 투자금:
        </span>
        <input type="number" value={investAmt} step="100000" min="0"
               onChange={function (e) {
                 const v = parseInt(e.target.value, 10);
                 if (props.setInvestAmt && !isNaN(v)) props.setInvestAmt(Math.max(0, v));
               }}
               style={{
                 width: 130, padding: "4px 8px", fontSize: 14,
                 border: "1px solid #fbbf24", borderRadius: 4,
                 textAlign: "right", fontWeight: 700,
               }} />
        <span style={{ fontSize: 12, color: "#78350f" }}>원</span>

        <span style={{ color: "#fbbf24", margin: "0 4px" }}>·</span>

        {/* 룰 기반 종목당 익절/손절금 */}
        <span style={{ fontSize: 11, color: "#78350f" }}>
          익절시 <b style={{color:"#dc2626"}}>{fmtKrw(Math.round(investAmt * (props.rule.tp || 0) / 100))}</b>
          {" / "}
          손절시 <b style={{color:"#2563eb"}}>{fmtKrw(Math.round(investAmt * (props.rule.sl || 0) / 100))}</b>
        </span>
      </div>

      {bestInfo && bestInfo.result && bestInfo.result.best && (
        <BestResult bestInfo={bestInfo} mode={props.rule.mode}
                    rule={props.rule}
                    investAmt={investAmt} />
      )}

      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 8 }}>
        매수: 진입일 종가 (15:20 KST 시장가) · 매도: <b>TP/SL % 도달 즉시</b> · 만료 시 종가
        {props.rule.mode === "split" && " · 분할: TP1 절반 → TP2 잔량, fSL ON이면 TP1 후 본전 보장"}
      </div>
    </div>
  );
}

function BestResult(props) {
  const b = props.bestInfo.result.best;
  const top5 = props.bestInfo.result.top5;
  const obj = props.bestInfo.objective;
  const mode = props.mode;
  const inv = props.investAmt;

  const cumColor = b.cum > 0 ? "#dc2626" : "#2563eb";
  const evColor = b.avg > 0 ? "#dc2626" : "#2563eb";

  // 룰 직접 사용 (b.tp/sl은 통계 비율과 충돌 가능)
  const ruleTP = mode === "single" ? props.rule.tp : (props.rule.tp1 + props.rule.tp2) / 2;
  const ruleSL = props.rule.sl;
  const ruleMaxDays = props.rule.maxDays;

  // 룰 기반 종목당 금액
  const tpKrw = Math.round(inv * ruleTP / 100);
  const slKrw = Math.round(inv * ruleSL / 100);
  const evKrw = Math.round(inv * b.avg / 100);
  const cumKrw = Math.round(inv * b.cum / 100);

  return (
    <div style={{
      background: b.cum > 0 ? "#eff6ff" : "#fef2f2",
      border: "1px solid " + (b.cum > 0 ? "#bfdbfe" : "#fecaca"),
      borderRadius: 8, padding: 12, marginBottom: 8,
    }}>
      <div style={{ fontSize: 12, color: b.cum > 0 ? "#1e40af" : "#991b1b",
                    fontWeight: 700, marginBottom: 8 }}>
        ✓ 적용됨: {mode === "single"
          ? "TP+" + props.rule.tp + " / SL" + props.rule.sl + " / 보유 " + ruleMaxDays + "일"
          : "TP1+" + props.rule.tp1 + " / TP2+" + props.rule.tp2 + " / SL" + props.rule.sl
            + " / fSL " + (props.rule.fsl ? "ON" : "OFF") + " / 보유 " + ruleMaxDays + "일"}
        <span style={{ marginLeft: 8, color: "#64748b", fontSize: 11, fontWeight: 400 }}>
          (전체 {b.n}건 기준 · 시간 무관 고정)
        </span>
      </div>

      {/* 1행: % 통계 */}
      <div style={{ display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                    gap: 6, marginBottom: 6 }}>
        <Stat label="누적 수익률" value={(b.cum >= 0 ? "+" : "") + b.cum.toFixed(0) + "%"}
              color={cumColor} sub={fmtKrw(cumKrw)} />
        <Stat label="평균 EV" value={(b.avg >= 0 ? "+" : "") + b.avg.toFixed(2) + "%"}
              color={evColor} sub={"건당 " + fmtKrw(evKrw)} />
        <Stat label="승률" value={b.win.toFixed(1) + "%"} color="#0891b2" />
        <Stat label="평균 익절일" value={b.avgDaysTP > 0 ? b.avgDaysTP.toFixed(1) + "일" : "-"}
              color="#dc2626" />
        <Stat label="평균 손절일" value={b.avgDaysSL > 0 ? b.avgDaysSL.toFixed(1) + "일" : "-"}
              color="#2563eb" />
        <Stat label="평균 보유" value={b.days.toFixed(1) + "일"} color="#475569" />
      </div>

      {/* 2행: 종목당 금액 */}
      <div style={{
        background: "#fff", borderRadius: 6, padding: "8px 10px",
        fontSize: 12, color: "#475569",
        display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 8,
      }}>
        <span>📊 종목당 ({fmtKrw(inv).slice(1)}):</span>
        <span>익절시 <b style={{color:"#dc2626", fontSize: 13}}>{fmtKrw(tpKrw)}</b></span>
        <span>손절시 <b style={{color:"#2563eb", fontSize: 13}}>{fmtKrw(slKrw)}</b></span>
        <span>총 <b style={{color: b.n > 0 ? "#dc2626" : "#475569", fontSize: 13}}>{b.n}건</b> {b.cum > 0 ? "→ " + fmtKrw(cumKrw) : ""}</span>
      </div>

      <details style={{ marginTop: 6 }}>
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
                <span style={{ fontWeight: i === 0 ? 700 : 400, minWidth: 140 }}>
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
      <div style={{ fontSize: 14, fontWeight: 800, color: props.color }}>
        {props.value}
      </div>
      {props.sub && (
        <div style={{ fontSize: 9, color: "#64748b", marginTop: 1 }}>
          {props.sub}
        </div>
      )}
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
