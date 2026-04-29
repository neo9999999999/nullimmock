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

export default function TPSLPanel(props) {
  const [searching, setSearching] = useState(false);
  const [bestInfo, setBestInfo] = useState(null);

  function update(field, value) {
    const next = Object.assign({}, props.rule);
    next[field] = value;
    props.onChange(next);
  }

  function handleAutoMaxSingle() {
    setSearching(true);
    setTimeout(function () {
      const result = gridSearchSingle(props.trades, {
        tps: [10, 15, 20, 25, 30, 40, 50, 70, 100],
        sls: [-3, -5, -7, -10, -15, -20],
        maxDays: props.rule.maxDays,
      });
      const b = result.best;
      setBestInfo({
        mode: "single",
        msg: "최적: TP " + b.tp + " / SL " + b.sl + " → 누적 " +
             (b.cum >= 0 ? "+" : "") + b.cum.toFixed(1) + "% / EV " +
             (b.avg >= 0 ? "+" : "") + b.avg.toFixed(2) + "% / 승률 " + b.win.toFixed(1) + "%",
      });
      props.onChange(Object.assign({}, props.rule, {
        mode: "single", tp: b.tp, sl: b.sl,
      }));
      setSearching(false);
    }, 50);
  }

  function handleAutoMaxSplit() {
    setSearching(true);
    setTimeout(function () {
      const result = gridSearchSplit(props.trades, {
        tp1s: [10, 15, 20, 25, 30],
        tp2s: [30, 50, 70, 100],
        sls: [-3, -5, -7, -10, -15],
        fsls: [0, 1],
        maxDays: props.rule.maxDays,
      });
      const b = result.best;
      setBestInfo({
        mode: "split",
        msg: "최적 (분할): TP1=" + b.tp1 + " / TP2=" + b.tp2 + " / SL=" + b.sl +
             " / fSL=" + (b.fsl ? "ON" : "OFF") + " → 누적 " +
             (b.cum >= 0 ? "+" : "") + b.cum.toFixed(1) + "% / EV " +
             (b.avg >= 0 ? "+" : "") + b.avg.toFixed(2) + "%",
      });
      props.onChange(Object.assign({}, props.rule, {
        mode: "split", tp1: b.tp1, tp2: b.tp2, sl: b.sl, fsl: b.fsl,
      }));
      setSearching(false);
    }, 50);
  }

  function handleApplyOptimal() {
    // 1차 백테스트 결과 디폴트
    props.onChange(Object.assign({}, props.rule, {
      mode: "single", tp: 70, sl: -10, maxDays: 20,
    }));
    setBestInfo({
      mode: "preset",
      msg: "1차 백테스트 권장: TP +70 / SL -10 (베이스셋 EV +2.32%)",
    });
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

        {/* 모드 토글 */}
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={function () { update("mode", "single"); }}
                  style={{
                    background: props.rule.mode === "single" ? "#3b82f6" : "#f1f5f9",
                    color: props.rule.mode === "single" ? "#fff" : "#475569",
                    border: "1px solid " + (props.rule.mode === "single" ? "#3b82f6" : "#cbd5e1"),
                    borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer",
                    fontWeight: 700,
                  }}>
            단일 TP
          </button>
          <button onClick={function () { update("mode", "split"); }}
                  style={{
                    background: props.rule.mode === "split" ? "#3b82f6" : "#f1f5f9",
                    color: props.rule.mode === "split" ? "#fff" : "#475569",
                    border: "1px solid " + (props.rule.mode === "split" ? "#3b82f6" : "#cbd5e1"),
                    borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer",
                    fontWeight: 700,
                  }}>
            분할 TP1+TP2
          </button>
        </div>

        <span style={{ color: "#cbd5e1" }}>|</span>

        {/* 단일 모드 입력 */}
        {props.rule.mode === "single" && (
          <React.Fragment>
            <NumberInput label="TP" value={props.rule.tp}
                         onChange={function (v) { update("tp", v); }} suffix="%" />
            <NumberInput label="SL" value={props.rule.sl}
                         onChange={function (v) { update("sl", v); }} suffix="%" />
          </React.Fragment>
        )}

        {/* 분할 모드 입력 */}
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
              <span>본전보장(fSL)</span>
            </label>
          </React.Fragment>
        )}

        <NumberInput label="최대" value={props.rule.maxDays}
                     onChange={function (v) { update("maxDays", v); }} suffix="일" />

        <span style={{ marginLeft: "auto" }} />

        {/* 자동 최적화 */}
        <button onClick={props.rule.mode === "single" ? handleAutoMaxSingle : handleAutoMaxSplit}
                disabled={searching}
                style={{
                  background: "#dbeafe", color: "#1e40af", border: "none",
                  borderRadius: 6, padding: "5px 14px", fontSize: 12,
                  cursor: searching ? "wait" : "pointer", fontWeight: 700,
                }}>
          {searching ? "탐색 중..." : "🔍 수익MAX 자동"}
        </button>

        <button onClick={handleApplyOptimal}
                style={{
                  background: "#fce7f3", color: "#9f1239", border: "none",
                  borderRadius: 6, padding: "5px 14px", fontSize: 12,
                  cursor: "pointer", fontWeight: 700,
                }}>
          ⭐ 권장값 (TP70/SL-10)
        </button>
      </div>

      {/* 자동 최적화 결과 메시지 */}
      {bestInfo && (
        <div style={{
          fontSize: 11, color: "#1e40af", padding: "6px 10px",
          background: "#eff6ff", borderRadius: 6,
        }}>
          ✓ {bestInfo.msg}
        </div>
      )}

      {/* 모드 설명 */}
      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>
        {props.rule.mode === "single"
          ? "단일 TP: TP 도달 시 전량 청산. SL 또는 만료(20일) 시 종가 청산."
          : "분할 TP: TP1 절반 익절 → TP2 잔량 익절. fSL ON이면 TP1 후 본전 보장."}
      </div>
    </div>
  );
}
