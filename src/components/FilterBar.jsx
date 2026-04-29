import React from "react";

const COLORS = {
  bg: "#0f1420",
  border: "#2a3040",
  text: "#d1d5db",
  active: "#60a5fa",
};

function ButtonGroup(props) {
  return (
    <div style={{
      marginBottom: 8,
      padding: 10,
      background: COLORS.bg,
      border: "1px solid " + COLORS.border,
      borderRadius: 8,
      display: "flex",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
    }}>
      <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 700, minWidth: 60 }}>
        {props.label}
      </span>
      {props.options.map(function (opt) {
        const isActive = props.value === opt[0];
        return (
          <button key={opt[0]}
                  onClick={function () { props.onChange(opt[0]); }}
                  style={{
                    background: isActive ? props.activeColor || COLORS.active : "#1f2937",
                    color: isActive ? "#000" : COLORS.text,
                    border: "1px solid #374151",
                    borderRadius: 6,
                    padding: "4px 10px",
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: isActive ? 700 : 400,
                  }}>
            {opt[1]}
          </button>
        );
      })}
      {props.children}
    </div>
  );
}

function MultiToggle(props) {
  return (
    <div style={{
      marginBottom: 8,
      padding: 10,
      background: COLORS.bg,
      border: "1px solid " + COLORS.border,
      borderRadius: 8,
      display: "flex",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
    }}>
      <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 700, minWidth: 60 }}>
        {props.label}
      </span>
      {props.options.map(function (opt) {
        const isActive = props.values.indexOf(opt[0]) >= 0;
        return (
          <button key={opt[0]}
                  onClick={function () {
                    const next = isActive
                      ? props.values.filter(function (v) { return v !== opt[0]; })
                      : props.values.concat([opt[0]]);
                    props.onChange(next);
                  }}
                  style={{
                    background: isActive ? "#dc2626" : "#1f2937",
                    color: isActive ? "#fff" : COLORS.text,
                    border: "1px solid #374151",
                    borderRadius: 6,
                    padding: "4px 10px",
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: isActive ? 700 : 400,
                  }}>
            {opt[1]}
          </button>
        );
      })}
      <span style={{ color: "#9ca3af", fontSize: 11, marginLeft: "auto" }}>
        체크된 월은 제외됨
      </span>
    </div>
  );
}

export default function FilterBar(props) {
  function update(field, value) {
    const next = Object.assign({}, props.filters);
    next[field] = value;
    props.onChange(next);
  }

  return (
    <div style={{ marginBottom: 16 }}>
      {/* 기간 */}
      <ButtonGroup
        label="기간"
        value={props.filters.yearRange}
        onChange={function (v) { update("yearRange", v); }}
        options={[
          ["all", "전체"], ["26", "26년"], ["25", "25년"], ["24", "24년"],
          ["23", "23년"], ["22", "22년"], ["21", "21년"],
        ]}>
        <span style={{ color: "#4b5563" }}>|</span>
        <input type="date" value={props.filters.fromDate}
               onChange={function (e) { update("fromDate", e.target.value); }}
               style={{ background: "#1f2937", color: "#fff", border: "1px solid #374151",
                        borderRadius: 6, padding: "3px 6px", fontSize: 11 }} />
        <span style={{ color: "#6b7280", fontSize: 11 }}>~</span>
        <input type="date" value={props.filters.toDate}
               onChange={function (e) { update("toDate", e.target.value); }}
               style={{ background: "#1f2937", color: "#fff", border: "1px solid #374151",
                        borderRadius: 6, padding: "3px 6px", fontSize: 11 }} />
        <button onClick={props.onReset}
                style={{ background: "#374151", color: "#fff", border: "none",
                         borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}>
          초기화
        </button>
        <span style={{ color: "#4b5563" }}>|</span>
        <span style={{ color: "#9ca3af", fontSize: 12 }}>
          매칭 <b style={{ color: "#fff" }}>{props.filteredCount}</b> /
          전체 <b style={{ color: "#fff" }}>{props.totalCount}</b>건
        </span>
      </ButtonGroup>

      {/* 시그널 빈도 (주도주성) */}
      <ButtonGroup
        label="주도주성"
        value={props.filters.signalsRange}
        onChange={function (v) { update("signalsRange", v); }}
        activeColor="#10b981"
        options={[
          ["all", "전체"],
          ["21+", "21회+ (슈퍼)"],
          ["11-20", "11-20회"],
          ["6-10", "6-10회"],
          ["3-5", "3-5회"],
          ["1-2", "1-2회"],
        ]}
      />

      {/* 수급 */}
      <ButtonGroup
        label="수급"
        value={props.filters.iv}
        onChange={function (v) { update("iv", v); }}
        activeColor="#f59e0b"
        options={[
          ["all", "전체"],
          ["기+외", "기+외"],
          ["외만", "외만"],
          ["기만", "기만"],
          ["둘다-", "둘다-"],
        ]}
      />

      {/* 신고가 */}
      <ButtonGroup
        label="신고가"
        value={props.filters.high}
        onChange={function (v) { update("high", v); }}
        activeColor="#f59e0b"
        options={[
          ["all", "전체"],
          ["h120", "120일↑"],
          ["h60only", "60일만"],
          ["none", "없음"],
        ]}
      />

      {/* 진입 패턴 */}
      <ButtonGroup
        label="패턴"
        value={props.filters.pattern}
        onChange={function (v) { update("pattern", v); }}
        activeColor="#8b5cf6"
        options={[
          ["all", "전체"],
          ["ma5_breakout", "5일선 돌파"],
          ["ma5_support", "5일선 지지"],
          ["ma20_rebound", "20일선 반등"],
        ]}
      />

      {/* 등락률 */}
      <ButtonGroup
        label="등락률"
        value={props.filters.changeRange}
        onChange={function (v) { update("changeRange", v); }}
        activeColor="#ec4899"
        options={[
          ["all", "전체"],
          ["13-16", "13~16% (골든존)"],
          ["16-20", "16~20%"],
          ["20-25", "20~25%"],
          ["25+", "25%+"],
        ]}
      />

      {/* 거래대금 */}
      <ButtonGroup
        label="거래대금"
        value={props.filters.amountRange}
        onChange={function (v) { update("amountRange", v); }}
        activeColor="#06b6d4"
        options={[
          ["all", "전체"],
          ["5000+", "5000억+"],
          ["2000-5000", "2000~5000억"],
          ["1000-2000", "1000~2000억"],
        ]}
      />

      {/* 시장 */}
      <ButtonGroup
        label="시장"
        value={props.filters.market}
        onChange={function (v) { update("market", v); }}
        options={[
          ["all", "전체"],
          ["코스닥", "KOSDAQ"],
          ["코스피", "KOSPI"],
        ]}
      />

      {/* 월 제외 */}
      <MultiToggle
        label="월 제외"
        values={props.filters.monthExcluded}
        onChange={function (v) { update("monthExcluded", v); }}
        options={[
          [1, "1"], [2, "2"], [3, "3"], [4, "4"], [5, "5"], [6, "6"],
          [7, "7"], [8, "8"], [9, "9"], [10, "10"], [11, "11"], [12, "12"],
        ]}
      />
    </div>
  );
}
