import React, { useState } from "react";

export default function GuideModal() {
  const [open, setOpen] = useState(false);

  return (
    <React.Fragment>
      <button onClick={function () { setOpen(true); }}
              style={{
                background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d",
                borderRadius: 6, padding: "5px 12px", fontSize: 12,
                cursor: "pointer", fontWeight: 700,
              }}>
        ❓ 매매법 가이드
      </button>

      {open && (
        <div onClick={function () { setOpen(false); }}
             style={{
               position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
               zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
               padding: 16,
             }}>
          <div onClick={function (e) { e.stopPropagation(); }}
               style={{
                 background: "#fff", borderRadius: 12, padding: 24,
                 maxWidth: 760, width: "100%", maxHeight: "90vh", overflowY: "auto",
                 fontSize: 13, lineHeight: 1.6, color: "#1e293b",
               }}>
            <div style={{ display: "flex", justifyContent: "space-between",
                          alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 20, color: "#0f172a" }}>
                📖 진입 기준 매매법 (v3)
              </h2>
              <button onClick={function () { setOpen(false); }}
                      style={{ background: "transparent", border: "none",
                               fontSize: 22, cursor: "pointer", color: "#64748b" }}>×</button>
            </div>

            <Section title="🎯 전체 흐름">
              <div style={pre}>
{`[Step 1] 강한 기준봉 발생 (시그널일)
        ↓
[Step 2] 매집 기간 (5~15영업일 동안 -3% 이상 조정)
        ↓
[Step 3] 진입 패턴 발생 (그날이 "진입일")
        ↓
[Step 4] TP +30~70% / SL -10% / 최대 20일 보유`}
              </div>
            </Section>

            <Section title="📌 Step 1: 강한 기준봉 (시그널일)">
              <Rules items={[
                ["등락률", "≥ 15% (전일 대비)"],
                ["거래대금", "≥ 1,000억 원"],
                ["윗꼬리", "≤ 30% (= 종가가 캔들 상단 70% 이상)"],
                ["양봉", "마감 (종가 > 시가)"],
              ]} />
              <Hint text="이 4가지 모두 충족하면 '주도주 후보' 풀에 등록됨." />
            </Section>

            <Section title="📌 Step 2: 매집 기간 검증">
              <Rules items={[
                ["기간", "기준봉 후 5~15영업일 사이"],
                ["조정 폭", "기준봉 종가 대비 -3% 이상 빠진 적 있어야"],
              ]} />
              <Hint text="너무 빨리 진입하면 자연스러운 조정 안 끝남.
너무 늦게 진입하면 추세 죽었거나 상승 진행 중. 즉, 매집 후 회복 타이밍을 잡는 게 핵심." />
            </Section>

            <Section title="📌 Step 3: 진입 패턴 (그날이 '진입일')">
              <p style={{ margin: "8px 0", color: "#475569" }}>
                다음 3가지 중 <b>1개라도 발생</b>하면 진입:
              </p>

              <PatternCard
                emoji="⚡"
                color="#dc2626"
                bg="#fef2f2"
                name="P1. 5일선 돌파 (ma5_breakout)"
                desc="가장 강력한 신호. 매집을 끝내고 추세 재개."
                rules={[
                  "전일 종가 < 5일선 (어제까진 5일선 아래)",
                  "오늘 종가 > 5일선 (오늘 5일선 위로 돌파)",
                  "양봉 마감",
                ]}
                stats="전체 trades 540건 / EV -0.98% (단독) → 다른 필터 결합 시 +3.69%"
              />

              <PatternCard
                emoji="🛡️"
                color="#0891b2"
                bg="#ecfeff"
                name="P2. 5일선 지지 (ma5_support)"
                desc="이미 5일선 위에 있다가 닿고 반등."
                rules={[
                  "오늘 저가 ≤ 5일선 + 1.5% (5일선 근처까지 밀림)",
                  "오늘 종가 > 5일선 (다시 위로 회복)",
                  "양봉 마감",
                ]}
                stats="전체 trades 393건 / EV -2.27% (단독) → 5일선 돌파보다 약함"
              />

              <PatternCard
                emoji="🔄"
                color="#7c3aed"
                bg="#f5f3ff"
                name="P3. 20일선 반등 (ma20_rebound)"
                desc="더 깊은 매집 후 20일선에서 반등."
                rules={[
                  "오늘 저가 ≤ 20일선 + 1.5%",
                  "오늘 종가 > 20일선",
                  "양봉 마감",
                ]}
                stats="현재 데이터에는 0건 — 너무 깊은 눌림은 잘 안 들어오는 듯"
              />

              <Hint text="공통 필수 조건:
• 5일 이평선 우상향 (어제 ma5 < 오늘 ma5) — 추세 살아있음
• 진입가 ≥ 기준봉 시가 — 캔들의 절반 이상 회복했어야" />
            </Section>

            <Section title="🎁 실제 사례 1: 5일선 돌파 — 한화에어로 (성공 X, 보유만료)">
              <pre style={pre}>
{`시그널일: 26-03-03  +19.83% / 거래대금 1.8조 (👍 강한 기준봉)
                                         
D+1   26-03-04   ▼-7.6%  ←─┐
D+2   26-03-05   ▼-3.6%    │ 매집 기간
D+3   26-03-06   ▲+3.4%    │ -7.6%까지 조정
D+4   26-03-09   ▲+0.1%    │ (-3% 충족)
D+5   26-03-10   ▲+1.6%    │
D+6   26-03-11   ▼-1.5%  ←─┘
D+7   26-03-12   ▲+2.3%  ←─ 5일선 돌파! 진입가 +2.3% ⭐
D+8   26-03-13   ▲+3.9%
...   26-03-23   ▼-10.8% ←─ -10% SL 터짐 (안타깝게 실패)`}
              </pre>
            </Section>

            <Section title="🎁 실제 사례 2: 5일선 지지 — 대성산업 (TP 성공)">
              <pre style={pre}>
{`시그널일: 26-01-14  +16.6% / 거래대금 1,028억

D+1~11  매집 기간 (-7%~-18% 까지 깊게 빠짐)
D+12   26-01-30  저가 -10%, 종가 +1.66% ←─ 5일선 지지! 진입 ⭐
D+13   26-02-02  ▲+15.5%
D+14   26-02-03  ▲+19.6%
D+15   26-02-04  ▲+55.5% ←─ TP +30% 도달! ✅`}
              </pre>
            </Section>

            <Section title="📊 데이터 컬럼 의미">
              <Rules items={[
                ["시그널일 (refDate)", "강한 기준봉 발생 = '주도주 발생일'"],
                ["진입일 (entryDate)", "위 패턴 발생한 날 = 실제 매수일"],
                ["D후 (daysAfter)", "시그널 후 며칠째 진입했나"],
                ["진입가% (entryPct)", "진입가가 시그널 종가 대비 몇 %인지"],
                ["등락 (refCh)", "시그널일 등락률"],
                ["수급 (iv)", "기관/외인 매매 동향 (시그널일 당일)"],
                ["6년 (totalSignals)", "그 종목이 6년간 강한 기준봉 몇 번 발생했나"],
              ]} />
            </Section>

            <Section title="✅ 회피 룰 (Veto)">
              <ul style={{ margin: "8px 0", paddingLeft: 20, color: "#475569" }}>
                <li>6년 시그널 ≤ 10회 (단발성 종목 — EV -6%대)</li>
                <li>신고가 둘 다 X (60일/120일 모두 신고가 아님)</li>
                <li>6, 7월 진입 (계절성 EV -5%대)</li>
                <li>수급 둘다- (기관/외인 매도 동반)</li>
              </ul>
            </Section>
          </div>
        </div>
      )}
    </React.Fragment>
  );
}

function Section(props) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 15, color: "#0f172a",
                   borderBottom: "2px solid #f1f5f9", paddingBottom: 4 }}>
        {props.title}
      </h3>
      {props.children}
    </div>
  );
}

function Rules(props) {
  return (
    <div style={{ background: "#f8fafc", borderRadius: 6, padding: 10 }}>
      {props.items.map(function (item, i) {
        return (
          <div key={i} style={{ display: "flex", gap: 8, padding: "3px 0",
                                fontSize: 13 }}>
            <span style={{ minWidth: 110, color: "#64748b", fontWeight: 600 }}>
              {item[0]}
            </span>
            <span style={{ color: "#1e293b" }}>{item[1]}</span>
          </div>
        );
      })}
    </div>
  );
}

function PatternCard(props) {
  return (
    <div style={{
      background: props.bg, border: "1px solid " + props.color + "33",
      borderRadius: 8, padding: 12, marginBottom: 10,
    }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: props.color,
                    marginBottom: 4 }}>
        {props.emoji} {props.name}
      </div>
      <div style={{ fontSize: 12, color: "#475569", marginBottom: 8 }}>
        {props.desc}
      </div>
      <ul style={{ margin: "0 0 8px", paddingLeft: 18, fontSize: 12, color: "#1e293b" }}>
        {props.rules.map(function (r, i) {
          return <li key={i}>{r}</li>;
        })}
      </ul>
      <div style={{ fontSize: 10, color: "#94a3b8", fontStyle: "italic" }}>
        📊 {props.stats}
      </div>
    </div>
  );
}

function Hint(props) {
  return (
    <div style={{ background: "#fef9c3", border: "1px solid #fde047",
                  borderRadius: 6, padding: 10, marginTop: 8,
                  fontSize: 12, color: "#713f12", whiteSpace: "pre-line" }}>
      💡 {props.text}
    </div>
  );
}

const pre = {
  background: "#0f172a", color: "#e2e8f0", padding: 12, borderRadius: 6,
  fontSize: 11, lineHeight: 1.5, whiteSpace: "pre",
  fontFamily: "ui-monospace, monospace", overflow: "auto",
};
