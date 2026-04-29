import React from "react";

const PAGE_SIZE = 20;

const ivColor = function (iv) {
  if (iv === "기+외") return "#7c3aed";
  if (iv === "외만") return "#2563eb";
  if (iv === "기만") return "#059669";
  if (iv === "둘다-") return "#dc2626";
  return "#94a3b8";
};

const patternLabel = function (p) {
  if (p === "ma5_breakout") return "5일선 돌파";
  if (p === "ma5_support") return "5일선 지지";
  if (p === "ma20_rebound") return "20일선 반등";
  return p;
};

const resultColor = function (r) {
  if (r === "TP" || r === "TP12") return "#dc2626";
  if (r === "SL") return "#2563eb";
  if (r === "TP1_BE" || r === "TP1_TO") return "#f59e0b";
  return "#64748b";
};

export default function TradesTable(props) {
  const trades = props.trades;
  const total = trades.length;
  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  const start = props.page * PAGE_SIZE;
  const visible = trades.slice(start, start + PAGE_SIZE);

  function header(key, label, width) {
    const isActive = props.sort.key === key;
    const arrow = isActive ? (props.sort.dir === "asc" ? " ↑" : " ↓") : "";
    return (
      <th key={key}
          onClick={function () { props.onSort(key); }}
          style={{
            padding: "10px 6px", fontWeight: 700, color: "#475569",
            fontSize: 11, textAlign: "center", cursor: "pointer",
            borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap",
            userSelect: "none", width: width,
            background: isActive ? "#eff6ff" : "transparent",
          }}>
        {label}{arrow}
      </th>
    );
  }

  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0",
      borderRadius: 12, overflow: "hidden", marginBottom: 16,
    }}>
      <div style={{
        padding: "10px 14px", background: "#f8fafc",
        borderBottom: "1px solid #e2e8f0",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
          📋 진입 내역 ({total}건)
        </span>
        <span style={{ fontSize: 11, color: "#64748b" }}>
          행을 클릭하면 진입 후 OHLC 추이가 표시됩니다
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 920, borderCollapse: "collapse",
                        fontSize: 13 }}>
          <thead>
            <tr>
              {header("refDate", "시그널일")}
              {header("name", "종목")}
              {header("market", "시장", 60)}
              {header("totalSignals", "6년", 50)}
              {header("refCh", "등락", 60)}
              {header("refAmt", "거래대금", 80)}
              {header("iv", "수급", 60)}
              {header("h120", "h120", 50)}
              {header("pattern", "패턴", 90)}
              {header("daysAfter", "D후", 50)}
              {header("entryPct", "진입가%", 70)}
              {header("pnl", "결과", 80)}
            </tr>
          </thead>
          <tbody>
            {visible.map(function (t, i) {
              const idx = start + i;
              const isOpen = props.openIdx === idx;
              const pnlColor = t.pnl > 0 ? "#dc2626" : "#2563eb";
              return (
                <React.Fragment key={idx}>
                  <tr onClick={function () { props.setOpenIdx(isOpen ? null : idx); }}
                      style={{
                        cursor: "pointer",
                        borderBottom: "1px solid #f1f5f9",
                        background: isOpen ? "#fffbeb" : "#fff",
                      }}>
                    <td style={cell()}>{t.refDate}</td>
                    <td style={Object.assign({}, cell(), { fontWeight: 700,
                                                            textAlign: "left",
                                                            paddingLeft: 8 })}>
                      {t.name}
                    </td>
                    <td style={cell()}>
                      <span style={{ fontSize: 10,
                                     color: t.market === "코스닥" ? "#059669" : "#0891b2" }}>
                        {t.market === "코스닥" ? "KQ" : "KS"}
                      </span>
                    </td>
                    <td style={Object.assign({}, cell(), { color: "#475569" })}>
                      {t.totalSignals}
                    </td>
                    <td style={Object.assign({}, cell(), { color: "#dc2626", fontWeight: 600 })}>
                      +{t.refCh.toFixed(1)}%
                    </td>
                    <td style={Object.assign({}, cell(), { color: "#475569" })}>
                      {t.refAmt.toLocaleString()}억
                    </td>
                    <td style={Object.assign({}, cell(), { color: ivColor(t.iv),
                                                            fontWeight: 600 })}>
                      {t.iv}
                    </td>
                    <td style={cell()}>
                      {t.h120 ? "✓" : (t.h60 ? "60" : "-")}
                    </td>
                    <td style={Object.assign({}, cell(), { fontSize: 11 })}>
                      {patternLabel(t.pattern)}
                    </td>
                    <td style={cell()}>{t.daysAfter}</td>
                    <td style={Object.assign({}, cell(), { color: "#475569" })}>
                      {t.entryPct >= 0 ? "+" : ""}{t.entryPct.toFixed(1)}%
                    </td>
                    <td style={Object.assign({}, cell(), {
                      color: pnlColor, fontWeight: 800, fontSize: 13,
                    })}>
                      {(t.pnl >= 0 ? "+" : "") + t.pnl.toFixed(1)}%
                      <div style={{ fontSize: 9, fontWeight: 600,
                                    color: resultColor(t.result), marginTop: 1 }}>
                        {t.result} ({t.days}d)
                      </div>
                    </td>
                  </tr>

                  {isOpen && <DetailRow trade={t} rule={props.rule} />}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      <div style={{
        padding: "10px 14px", display: "flex", justifyContent: "space-between",
        alignItems: "center", borderTop: "1px solid #e2e8f0",
      }}>
        <span style={{ fontSize: 12, color: "#64748b" }}>
          {total === 0 ? "데이터 없음" :
           total + "건 중 " + (start + 1) + "~" + Math.min(start + PAGE_SIZE, total)}
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={function () { props.setPage(Math.max(0, props.page - 1)); }}
                  disabled={props.page === 0}
                  style={pageBtn(props.page === 0)}>←</button>
          <input type="number" value={props.page + 1}
                 min={1} max={maxPage + 1}
                 onChange={function (e) {
                   const v = parseInt(e.target.value, 10) - 1;
                   if (!isNaN(v) && v >= 0 && v <= maxPage) props.setPage(v);
                 }}
                 style={{
                   width: 50, padding: "5px 4px", fontSize: 13,
                   color: "#64748b", textAlign: "center",
                   border: "1px solid #e2e8f0", borderRadius: 6,
                 }} />
          <span style={{ padding: "5px 6px", fontSize: 13, color: "#94a3b8" }}>
            / {maxPage + 1}
          </span>
          <button onClick={function () { props.setPage(Math.min(maxPage, props.page + 1)); }}
                  disabled={props.page >= maxPage}
                  style={pageBtn(props.page >= maxPage)}>→</button>
        </div>
      </div>
    </div>
  );
}

function DetailRow(props) {
  const t = props.trade;
  const arr = t.ohlc || [];
  const first10 = arr.slice(0, 10);
  return (
    <tr>
      <td colSpan={12} style={{ padding: 0 }}>
        <div style={{ padding: 14, background: "#fffbeb",
                      borderBottom: "2px solid #fcd34d" }}>
          <div style={{ display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                        gap: 8, marginBottom: 12 }}>
            <Info label="시그널일" value={t.refDate} />
            <Info label="등락률" value={"+" + t.refCh.toFixed(2) + "%"} color="#dc2626" />
            <Info label="거래대금" value={t.refAmt.toLocaleString() + "억"} />
            <Info label="윗꼬리" value={t.refWick.toFixed(1) + "%"} />
            <Info label="6년 시그널" value={t.totalSignals + "회"} />
            <Info label="진입 패턴" value={patternLabel(t.pattern)} />
            <Info label="기준봉 후" value={t.daysAfter + "일"} />
            <Info label="진입가" value={(t.entryPct >= 0 ? "+" : "") + t.entryPct.toFixed(2) + "%"} />
          </div>

          <div style={{ background: "#fff", borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#475569",
                          marginBottom: 6 }}>
              진입 후 OHLC 추이 (시그널 종가 기준 % / 처음 10일)
            </div>
            <div style={{ display: "grid",
                          gridTemplateColumns: "70px repeat(4, 1fr)",
                          gap: 4, fontSize: 11 }}>
              <Cell strong>날짜</Cell>
              <Cell strong>시</Cell>
              <Cell strong>고</Cell>
              <Cell strong>저</Cell>
              <Cell strong>종</Cell>
              {first10.map(function (row, i) {
                const date = row[0];
                return (
                  <React.Fragment key={i}>
                    <Cell>{date.slice(4, 6) + "-" + date.slice(6, 8)}</Cell>
                    <Cell color={row[1] >= 0 ? "#dc2626" : "#2563eb"}>{row[1].toFixed(1)}%</Cell>
                    <Cell color="#dc2626">{row[2].toFixed(1)}%</Cell>
                    <Cell color="#2563eb">{row[3].toFixed(1)}%</Cell>
                    <Cell color={row[4] >= 0 ? "#dc2626" : "#2563eb"} strong>
                      {row[4].toFixed(1)}%
                    </Cell>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

function Info(props) {
  return (
    <div style={{ background: "#fff", borderRadius: 6, padding: "6px 10px" }}>
      <div style={{ fontSize: 9, color: "#94a3b8" }}>{props.label}</div>
      <div style={{ fontSize: 13, fontWeight: 700,
                    color: props.color || "#1e293b" }}>
        {props.value}
      </div>
    </div>
  );
}

function Cell(props) {
  return (
    <div style={{
      textAlign: "center",
      fontWeight: props.strong ? 700 : 400,
      color: props.color || "#475569",
      padding: "2px 4px",
      background: props.strong && props.color ? "transparent" : "transparent",
    }}>
      {props.children}
    </div>
  );
}

function cell() {
  return { padding: "8px 4px", textAlign: "center", color: "#1e293b",
           fontSize: 12, whiteSpace: "nowrap" };
}

function pageBtn(disabled) {
  return {
    padding: "5px 12px", borderRadius: 8,
    border: "1px solid #e2e8f0", background: "#fff", fontSize: 13,
    fontWeight: 700, cursor: disabled ? "default" : "pointer",
    color: disabled ? "#e2e8f0" : "#1e293b",
  };
}
