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

  const [scanning, setScanning] = React.useState(false);
  const [scanResult, setScanResult] = React.useState(null);
  const [scanError, setScanError] = React.useState(null);

  async function handleScan() {
    setScanning(true);
    setScanError(null);
    setScanResult(null);
    try {
      const res = await fetch("/api/scan-signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),  // 자체 풀 사용
      });
      const data = await res.json();
      if (!res.ok) {
        setScanError(data.error || "스캔 실패: " + res.status);
      } else {
        setScanResult(data);
      }
    } catch (e) {
      setScanError(String(e));
    } finally {
      setScanning(false);
    }
  }

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
        <div style={{ display: "flex", flexDirection: "column",
                      alignItems: "flex-end", gap: 8 }}>
          <button onClick={handleScan} disabled={scanning}
                  style={{
                    background: scanning ? "#475569" : "#10b981",
                    color: "#fff", border: "none", borderRadius: 6,
                    padding: "8px 16px", fontSize: 12, fontWeight: 700,
                    cursor: scanning ? "wait" : "pointer",
                  }}>
            {scanning ? "⏳ KIS 스캔 중..." : "🔄 KIS 스캔 (오늘 신호 발굴)"}
          </button>
          <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "right" }}>
            데이터 마지막 진입일: <b style={{color:"#fbbf24"}}>{dataInfo.maxEntry || "-"}</b>
            <br />
            신선도: {dataInfo.stale > 0 ? "🟡 " + dataInfo.stale + "일 지남" : "🟢 최신"}
          </div>
        </div>
      </div>

      {/* 스캔 결과 */}
      {scanError && (
        <div style={{
          background: "#7f1d1d", border: "1px solid #dc2626",
          borderRadius: 6, padding: "10px 14px", marginBottom: 12,
          fontSize: 12, color: "#fecaca",
        }}>
          ❌ <b>스캔 실패:</b> {scanError}
        </div>
      )}

      {scanResult && (
        <ScanResult data={scanResult} />
      )}

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

function ScanResult(props) {
  const d = props.data;
  const r = d.results || {};
  return (
    <div style={{
      background: "#0f172a", border: "1px solid #10b981",
      borderRadius: 8, padding: 12, marginBottom: 12,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#10b981",
                    marginBottom: 8 }}>
        🔄 KIS 스캔 결과
        <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: 8, fontWeight: 400 }}>
          {d.scanned_at && d.scanned_at.replace("T", " ").slice(0, 19)} ·
          {d.processed} 종목 처리 · {d.summary && d.summary.errors > 0 ? d.summary.errors + " 에러" : "에러 없음"}
        </span>
      </div>

      {/* Section: 진입 패턴 발생 (가장 중요) */}
      {r.entries && r.entries.length > 0 && (
        <ScanSection
          title="🟢 오늘 진입 패턴 발생 (최우선)"
          items={r.entries}
          color="#10b981"
          render={(e) => (
            <span>
              <b>{e.name}</b> ({e.code}) · 시그널 {e.ref_date} +{e.ref_change}% / {e.ref_amount_billion}억
              · D+{e.days_after}일째 5일선 돌파 진입가 {e.entry_close.toLocaleString()}원
              ({e.entry_pct >= 0 ? "+" : ""}{e.entry_pct.toFixed(1)}%) · 최저점 {e.min_dip.toFixed(1)}%
            </span>
          )}
        />
      )}

      {/* Section: 매집 중 */}
      {r.accumulating && r.accumulating.length > 0 && (
        <ScanSection
          title="🟡 매집 중 (시그널 후 5~15일, 진입 임박)"
          items={r.accumulating}
          color="#f59e0b"
          render={(e) => (
            <span>
              <b>{e.name}</b> ({e.code}) · 시그널 {e.ref_date} +{e.ref_change}%
              · D+{e.days_since}일 / 최저 {e.min_dip.toFixed(1)}% / 현재 {e.current_pct >= 0 ? "+" : ""}{e.current_pct.toFixed(1)}%
            </span>
          )}
        />
      )}

      {/* Section: 새 강한 기준봉 */}
      {r.new_signals && r.new_signals.length > 0 && (
        <ScanSection
          title="✨ 오늘/어제 새 강한 기준봉 (매집 풀에 추가)"
          items={r.new_signals}
          color="#0891b2"
          render={(e) => (
            <span>
              <b>{e.name}</b> ({e.code}) · {e.ref_date} +{e.change}% / {e.amount_billion}억
            </span>
          )}
        />
      )}

      {(!r.entries || r.entries.length === 0) &&
       (!r.accumulating || r.accumulating.length === 0) &&
       (!r.new_signals || r.new_signals.length === 0) && (
        <div style={{ padding: 16, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
          신호 없음. 매집/진입 후보 0건.
        </div>
      )}

      {/* 에러 (있으면) */}
      {r.errors && r.errors.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ fontSize: 11, color: "#ef4444", cursor: "pointer" }}>
            ⚠️ {r.errors.length} 에러 보기
          </summary>
          <div style={{ fontSize: 10, color: "#fca5a5", marginTop: 4,
                        maxHeight: 100, overflow: "auto" }}>
            {r.errors.map((e, i) => (
              <div key={i}>{e.name} ({e.code}): {e.error}</div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function ScanSection(props) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        fontSize: 12, fontWeight: 700, color: props.color,
        marginBottom: 4,
      }}>
        {props.title} ({props.items.length}건)
      </div>
      <div style={{
        background: "#1e293b", borderRadius: 6, padding: 8,
        fontSize: 11, color: "#cbd5e1",
        maxHeight: 200, overflowY: "auto",
      }}>
        {props.items.map((item, i) => (
          <div key={i} style={{
            padding: "3px 0",
            borderBottom: i < props.items.length - 1 ? "1px solid #334155" : "none",
          }}>
            {props.render(item)}
          </div>
        ))}
      </div>
    </div>
  );
}
