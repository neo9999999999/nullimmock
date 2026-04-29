import React from "react";

function StatCard(props) {
  return (
    <div style={{
      background: props.bg || "#fff",
      border: "1px solid " + (props.border || "#e2e8f0"),
      borderRadius: 12,
      padding: "12px 14px",
      flex: 1,
      minWidth: 130,
    }}>
      <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginBottom: 4 }}>
        {props.label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 900,
                    color: props.color || "#1e293b" }}>
        {props.value}
      </div>
      {props.sub && (
        <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
          {props.sub}
        </div>
      )}
    </div>
  );
}

export default function StatsCards(props) {
  const s = props.stats;
  if (s.n === 0) {
    return (
      <div style={{ marginBottom: 16, padding: 16, background: "#fef2f2",
                    border: "1px solid #fecaca", borderRadius: 12,
                    color: "#991b1b", fontSize: 13, textAlign: "center" }}>
        필터 조건에 맞는 trade 없음.
      </div>
    );
  }

  const cumColor = s.cum > 0 ? "#dc2626" : "#2563eb";
  const evColor = s.avg > 0 ? "#dc2626" : "#2563eb";
  const winColor = s.win >= 30 ? "#059669" : (s.win >= 20 ? "#0891b2" : "#64748b");

  const invAmt = props.investAmt != null ? props.investAmt : 500000;
  const cumKrw = Math.round((invAmt * s.cum) / 100);
  const cumKrwStr = (cumKrw >= 0 ? "+" : "") + cumKrw.toLocaleString() + "원";
  const evKrw = Math.round((invAmt * s.avg) / 100);
  const evKrwStr = (evKrw >= 0 ? "+" : "") + evKrw.toLocaleString() + "원";
  const invStr = (invAmt / 10000).toFixed(0) + "만원";

  const tpDist = s.tpDist || [0, 0, 0, 0];
  const distLabels = ["1-3일", "4-7일", "8-14일", "15-20일"];
  const tpTotal = tpDist.reduce(function (a, b) { return a + b; }, 0);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        background: "#fffbeb", border: "1px solid #fde68a",
        borderRadius: 8, padding: "8px 12px", marginBottom: 8,
        fontSize: 11, color: "#78350f",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        gap: 12, flexWrap: "wrap",
      }}>
        <span>
          💡 매수: <b>진입일 15:20 시장가</b> (≈종가) ·
          매도: TP/SL 즉시 / 만료 시 종가
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <b>종목당 투자금:</b>
          <input type="number" value={invAmt}
                 step="100000"
                 onChange={function (e) {
                   const v = parseInt(e.target.value, 10);
                   if (props.setInvestAmt && !isNaN(v)) props.setInvestAmt(Math.max(0, v));
                 }}
                 style={{
                   width: 110, padding: "3px 6px", fontSize: 13,
                   border: "1px solid #fbbf24", borderRadius: 4,
                   textAlign: "right", fontWeight: 700,
                 }} />
          <span>원</span>
        </span>
      </div>

      <div style={{ display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                    gap: 8, marginBottom: 8 }}>
        <StatCard label="진입 건수" value={s.n + "건"}
                  color="#0f172a"
                  sub={"평균 보유 " + s.days.toFixed(1) + "일"} />

        <StatCard label="누적 수익률"
                  value={(s.cum >= 0 ? "+" : "") + s.cum.toFixed(1) + "%"}
                  color={cumColor}
                  sub={invStr + " × " + s.n + "건 → " + cumKrwStr}
                  bg={s.cum > 0 ? "#fef2f2" : "#eff6ff"}
                  border={s.cum > 0 ? "#fecaca" : "#bfdbfe"} />

        <StatCard label="평균 EV"
                  value={(s.avg >= 0 ? "+" : "") + s.avg.toFixed(2) + "%"}
                  color={evColor}
                  sub={"건당 기댓값 → " + evKrwStr} />

        <StatCard label="승률"
                  value={s.win.toFixed(1) + "%"}
                  color={winColor}
                  sub={"수익 발생률"} />

        <StatCard label="평균 익절일"
                  value={s.tp > 0 ? s.avgDaysTP.toFixed(1) + "일" : "-"}
                  color="#dc2626"
                  sub={"TP " + s.tp.toFixed(1) + "% 도달"} />

        <StatCard label="평균 손절일"
                  value={s.sl > 0 ? s.avgDaysSL.toFixed(1) + "일" : "-"}
                  color="#2563eb"
                  sub={"SL " + s.sl.toFixed(1) + "% 도달"} />

        <StatCard label="평균 MDD"
                  value={s.avgMdd.toFixed(1) + "%"}
                  color="#7c3aed"
                  sub={"평균 최대 하락"}
                  bg="#faf5ff"
                  border="#e9d5ff" />

        <StatCard label="최악 MDD"
                  value={s.mdd.toFixed(1) + "%"}
                  color="#9333ea"
                  sub={"가장 깊었던 하락"} />
      </div>

      {tpTotal > 0 && (
        <div style={{
          background: "#fff", border: "1px solid #e2e8f0",
          borderRadius: 8, padding: 10,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
            🎯 익절(TP) 도달 시간 분포 (총 {tpTotal}건 / 평균 {s.avgDaysTP.toFixed(1)}일)
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {tpDist.map(function (cnt, i) {
              const pct = tpTotal > 0 ? (cnt / tpTotal) * 100 : 0;
              const barColor = ["#10b981", "#0891b2", "#f59e0b", "#dc2626"][i];
              return (
                <div key={i} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{
                    background: barColor + "22",
                    borderTop: "3px solid " + barColor,
                    borderRadius: 4,
                    padding: "8px 4px",
                  }}>
                    <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 14 }}>
                      {cnt}
                    </div>
                    <div style={{ color: "#64748b", fontSize: 10 }}>
                      ({pct.toFixed(0)}%)
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>
                    {distLabels[i]}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6 }}>
            💡 빨강(15-20일) 비중이 크면 TP가 비현실적으로 높음 (대부분 만료)
          </div>
        </div>
      )}
    </div>
  );
}
