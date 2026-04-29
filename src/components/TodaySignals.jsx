import React, { useMemo } from "react";
import { simulate } from "../lib/simulator.js";

// 오늘 날짜 (실제 환경에서는 동적 계산)
function getTodayYY() {
  const d = new Date();
  return String(d.getFullYear() - 2000).padStart(2, "0");
}
function getTodayMonth() {
  return new Date().getMonth() + 1;
}
function getTodayStr() {
  const d = new Date();
  return String(d.getFullYear() - 2000).padStart(2, "0") + "-" +
         String(d.getMonth() + 1).padStart(2, "0") + "-" +
         String(d.getDate()).padStart(2, "0");
}

// YY-MM-DD 두 문자열 영업일수 차이 (대략)
function daysBetween(a, b) {
  if (!a || !b) return 0;
  const aP = a.split("-").map(Number);
  const bP = b.split("-").map(Number);
  const aD = new Date(2000 + aP[0], aP[1] - 1, aP[2]);
  const bD = new Date(2000 + bP[0], bP[1] - 1, bP[2]);
  return Math.round((bD - aD) / 86400000);
}

function fmtKrw(amt) {
  if (amt === 0) return "0원";
  const sign = amt < 0 ? "-" : "+";
  const abs = Math.abs(amt);
  if (abs >= 10000000) return sign + (abs / 10000000).toFixed(1) + "천만원";
  if (abs >= 10000) return sign + Math.round(abs / 10000).toLocaleString() + "만원";
  return sign + abs.toLocaleString() + "원";
}

export default function TodaySignals(props) {
  const allTrades = props.allTrades;
  const rule = props.rule;
  const investAmt = props.investAmt || 100000;

  const todayMonth = getTodayMonth();
  const todayStr = getTodayStr();
  const isOffSeason = [4, 5, 6, 7].indexOf(todayMonth) >= 0;

  // 데이터 신선도
  const dataInfo = useMemo(function () {
    let maxEntry = "";
    let maxRef = "";
    for (const t of allTrades) {
      if (t.entryDate && t.entryDate > maxEntry) maxEntry = t.entryDate;
      if (t.refDate > maxRef) maxRef = t.refDate;
    }
    const stale = daysBetween(maxEntry, todayStr);
    return { maxEntry, maxRef, stale };
  }, [allTrades, todayStr]);

  // 골든 룰 통과 + 최근 60일 진입
  const recentSignals = useMemo(function () {
    const golden = allTrades.filter(function (t) {
      if (t.totalSignals < 21) return false;
      if (t.pattern !== "ma5_breakout") return false;
      const refMonth = parseInt(t.refDate.split("-")[1], 10);
      if ([4, 5, 6, 7].indexOf(refMonth) >= 0) return false;
      return true;
    });

    // 진입일 최신순 정렬
    golden.sort(function (a, b) {
      return (b.entryDate || "").localeCompare(a.entryDate || "");
    });

    // 시뮬 결과 추가
    return golden.slice(0, 10).map(function (t) {
      const r = simulate(t, rule);
      return Object.assign({}, t, {
        pnl: r.pnl, result: r.result, days: r.days,
        krw: Math.round(investAmt * r.pnl / 100),
        daysAgo: daysBetween(t.entryDate, todayStr),
      });
    });
  }, [allTrades, rule, investAmt, todayStr]);

  // 합계
  const summary = useMemo(function () {
    let totalKrw = 0;
    let wins = 0;
    let tps = 0;
    let sls = 0;
    for (const t of recentSignals) {
      totalKrw += t.krw;
      if (t.pnl > 0) wins++;
      if (t.result === "TP" || t.result === "TP12") tps++;
      if (t.result === "SL") sls++;
    }
    return {
      n: recentSignals.length,
      totalKrw: totalKrw,
      wins: wins,
      tps: tps,
      sls: sls,
    };
  }, [recentSignals]);

  return (
    <div style={{
      marginBottom: 16, padding: 16,
      background: "linear-gradient(135deg, #064e3b 0%, #0f172a 100%)",
      border: "2px solid #10b981", borderRadius: 12, color: "#fff",
    }}>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between",
                    alignItems: "center", flexWrap: "wrap", gap: 12,
                    marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#10b981" }}>
            🎯 골든 룰 — 최근 진입 신호 (TOP 10)
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
            21회+ × 5일선 돌파 × 4-7월 제외 / TP+100/SL-10/20일
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "right" }}>
          데이터 마지막 진입일: <b style={{color:"#fbbf24"}}>{dataInfo.maxEntry || "-"}</b>
          <br />
          신선도: {dataInfo.stale > 0 ? "🟡 " + dataInfo.stale + "일 지남" : "🟢 최신"}
        </div>
      </div>

      {/* 시즌 안내 */}
      {isOffSeason && (
        <div style={{
          background: "#7f1d1d", border: "1px solid #dc2626",
          borderRadius: 6, padding: "8px 12px", marginBottom: 12,
          fontSize: 12, color: "#fecaca",
        }}>
          ⚠️ 오늘은 <b>{todayMonth}월</b> — <b>골든 룰 회피 시즌 (4~7월)</b> ·
          신규 진입 X · 매집 중 종목만 모니터링
        </div>
      )}

      {!isOffSeason && (
        <div style={{
          background: "#064e3b", border: "1px solid #10b981",
          borderRadius: 6, padding: "8px 12px", marginBottom: 12,
          fontSize: 12, color: "#a7f3d0",
        }}>
          ✅ 오늘은 <b>{todayMonth}월</b> — <b>매매 가능 시즌</b> · 매일 신호 발굴 권장
        </div>
      )}

      {/* 합계 */}
      {summary.n > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 8, marginBottom: 12,
        }}>
          <SummaryCard label="진입 건수" value={summary.n + "건"} />
          <SummaryCard label="합계 손익" 
                       value={fmtKrw(summary.totalKrw)}
                       color={summary.totalKrw > 0 ? "#10b981" : "#ef4444"} />
          <SummaryCard label="익절 (TP)" value={summary.tps + "건"}
                       color="#10b981" />
          <SummaryCard label="손절 (SL)" value={summary.sls + "건"}
                       color="#ef4444" />
          <SummaryCard label="만료/기타"
                       value={(summary.n - summary.tps - summary.sls) + "건"}
                       color="#94a3b8" />
        </div>
      )}

      {/* 최근 진입 카드 */}
      {recentSignals.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "#94a3b8",
                      fontSize: 13 }}>
          골든 룰 통과 진입 데이터가 없습니다.
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 8,
        }}>
          {recentSignals.map(function (t, i) {
            const pnlColor = t.pnl > 0 ? "#10b981" : (t.pnl < 0 ? "#ef4444" : "#94a3b8");
            const resultBg = t.result === "TP" ? "#064e3b" :
                             t.result === "SL" ? "#7f1d1d" :
                             "#1e293b";
            const resultIcon = t.result === "TP" ? "✅" :
                               t.result === "SL" ? "❌" :
                               "⏰";
            return (
              <div key={i} style={{
                background: resultBg,
                border: "1px solid #334155",
                borderRadius: 8, padding: 10,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between",
                              alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                    {t.name}
                  </span>
                  <span style={{ fontSize: 16 }}>{resultIcon}</span>
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 6 }}>
                  진입 <b style={{color:"#fbbf24"}}>{t.entryDate}</b>
                  {t.daysAgo > 0 && (
                    <span style={{ marginLeft: 4 }}>
                      ({t.daysAgo}일 전)
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between",
                              alignItems: "baseline", marginBottom: 2 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: pnlColor }}>
                    {(t.pnl >= 0 ? "+" : "") + t.pnl.toFixed(1)}%
                  </span>
                  <span style={{ fontSize: 11, color: pnlColor, fontWeight: 600 }}>
                    {fmtKrw(t.krw)}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>
                  {t.result} · {t.days}일 보유 ·
                  시그널 {t.refDate} (+{t.refCh.toFixed(1)}%)
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 안내 */}
      <div style={{
        marginTop: 12, fontSize: 11, color: "#64748b",
        borderTop: "1px solid #334155", paddingTop: 8,
      }}>
        💡 매일 갱신: KIS API 자동 스캔 (셋업 예정) · 현재는 백테스트 데이터 기반 예시
      </div>
    </div>
  );
}

function SummaryCard(props) {
  return (
    <div style={{
      background: "#1e293b", border: "1px solid #334155",
      borderRadius: 6, padding: "8px 10px",
    }}>
      <div style={{ fontSize: 10, color: "#94a3b8" }}>{props.label}</div>
      <div style={{ fontSize: 16, fontWeight: 800,
                    color: props.color || "#fff", marginTop: 2 }}>
        {props.value}
      </div>
    </div>
  );
}
