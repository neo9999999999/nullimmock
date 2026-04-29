import React from "react";

function StatCard(props) {
  return (
    <div style={{
      background: props.bg || "#fff",
      border: "1px solid " + (props.border || "#e2e8f0"),
      borderRadius: 12,
      padding: "14px 16px",
      flex: 1,
      minWidth: 130,
    }}>
      <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginBottom: 4 }}>
        {props.label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 900,
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

  // 투자금 가정 (예: 50만원)
  const invAmt = 500000;
  const cumKrw = Math.round((invAmt * s.cum) / 100);
  const cumKrwStr = (cumKrw >= 0 ? "+" : "") + cumKrw.toLocaleString() + "원";

  return (
    <div style={{ marginBottom: 16, display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                  gap: 8 }}>
      <StatCard label="진입 건수" value={s.n + "건"}
                color="#0f172a" sub={"평균 보유 " + s.days.toFixed(1) + "일"} />

      <StatCard label="누적 수익률"
                value={(s.cum >= 0 ? "+" : "") + s.cum.toFixed(1) + "%"}
                color={cumColor}
                sub={"50만원 가정 → " + cumKrwStr}
                bg={s.cum > 0 ? "#fef2f2" : "#eff6ff"}
                border={s.cum > 0 ? "#fecaca" : "#bfdbfe"} />

      <StatCard label="평균 EV"
                value={(s.avg >= 0 ? "+" : "") + s.avg.toFixed(2) + "%"}
                color={evColor}
                sub={"건당 기댓값"} />

      <StatCard label="승률"
                value={s.win.toFixed(1) + "%"}
                color={winColor}
                sub={"수익 발생률"} />

      <StatCard label="TP 도달"
                value={s.tp.toFixed(1) + "%"}
                color="#dc2626"
                sub={"익절"} />

      <StatCard label="SL 손절"
                value={s.sl.toFixed(1) + "%"}
                color="#2563eb"
                sub={"손절"} />

      <StatCard label="만료 청산"
                value={s.to.toFixed(1) + "%"}
                color="#64748b"
                sub={"보유 만료"} />
    </div>
  );
}
