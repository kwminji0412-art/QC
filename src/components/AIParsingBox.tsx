/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Sparkles, Play, RefreshCw, AlertTriangle } from "lucide-react";

interface AIParsingBoxProps {
  rawText: string;
  setRawText: (text: string) => void;
  onParseSuccess: (data: any) => void;
  userApiKey?: string;
}

export default function AIParsingBox({ rawText, setRawText, onParseSuccess, userApiKey }: AIParsingBoxProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [parseError, setParseError] = useState("");

  const RAW_HPLC_SAMPLE_TEXT = `[HPLC Chromatogram Analysis Report]
Product: TN-Tablet (타이레놀정 500mg)
Lot No: TN202607A
Test Date: 2026-07-06
Analyst: 홍길동 연구원
Instrument: Agilent 1260 HPLC System
Column: C18 역상 컬럼 (4.6 x 250 mm, 5 um)
Mobile Phase: Water : Acetonitrile = 70 : 30
Wavelength: 243 nm  Flow: 1.0 mL/min
Ref Std Lot: RS-Acetaminophen-2026X, Purity: 99.50%
Std Weight: 50.2 mg, Sample Weight: 50.5 mg
Std Dilution: 100, Sample Dilution: 100

-- Run Sequence & Integration Peak Table --
Standard Inj-1:
Peak 1: RT 4.512 min, Area 1254320, Component: 아세트아미노펜
Peak 2: RT 7.234 min, Area 843210, Component: 카페인

Standard Inj-2:
Peak 1: RT 4.508 min, Area 1251980, Component: 아세트아미노펜
Peak 2: RT 7.228 min, Area 841980, Component: 카페인

Standard Inj-3:
Peak 1: RT 4.515 min, Area 1257410, Component: 아세트아미노펜
Peak 2: RT 7.240 min, Area 846120, Component: 카페인

Sample Inj-1 (TN202607A):
Peak 1: RT 4.510 min, Area 1261020, Component: 아세트아미노펜
Peak 2: RT 7.231 min, Area 844320, Component: 카페인

Sample Inj-2 (TN202607A):
Peak 1: RT 4.505 min, Area 1259850, Component: 아세트아미노펜
Peak 2: RT 7.225 min, Area 839950, Component: 카페인
`;

  const handleAIAnalysis = async () => {
    if (!rawText.trim()) {
      alert("분석할 크로마토그램 원시 데이터를 텍스트 상자에 입력해 주십시오.");
      return;
    }

    setIsLoading(true);
    setParseError("");
    try {
      const response = await fetch("/api/parse-hplc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, userApiKey }),
      });

      if (!response.ok) {
        throw new Error("서버와의 분석 통신에 실패하였습니다.");
      }

      const data = await response.json();
      
      if (data.parseError) {
        setParseError(data.parseError);
        setIsLoading(false);
        return;
      }

      onParseSuccess(data);
      alert("AI HPLC 원시 데이터 분석 및 자동 입력을 완료하였습니다!");
    } catch (err: any) {
      console.error(err);
      setParseError("서버 오류: " + (err.message || "HPLC 데이터를 파싱하는 도중 에러가 발생했습니다. 수동 입력을 권장합니다."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-md shadow-slate-100/50 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2 tracking-tight">
          <span className="p-1 bg-teal-50 rounded-lg text-teal-700 block">
            <Sparkles className="w-4 h-4" />
          </span>
          AI HPLC 크로마토그램 파서
        </h2>
        <button
          onClick={() => setRawText(RAW_HPLC_SAMPLE_TEXT)}
          className="text-[11px] text-teal-700 font-semibold bg-teal-50/50 hover:bg-teal-50 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
        >
          예시 템플릿 로드
        </button>
      </div>
      <p className="text-xs text-slate-500 leading-relaxed font-sans">
        인쇄된 리포트의 피크 테이블 텍스트를 붙여넣으십시오. AI가 메타데이터와 용액 주입 데이터를 실시간으로 자동 분석하여 파싱합니다.
      </p>
      <div className="space-y-2">
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="크로마토그램 텍스트를 이곳에 복사-붙여넣기 하십시오..."
          className="w-full h-36 p-3.5 text-xs font-mono bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:bg-white transition-all resize-none shadow-inner text-slate-700"
        />
        {parseError && (
          <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-100 text-xs text-rose-800 flex items-start gap-2.5 animate-fadeIn">
            <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-rose-600 mt-0.5" />
            <span className="leading-relaxed font-medium">{parseError}</span>
          </div>
        )}
      </div>
      <button
        onClick={handleAIAnalysis}
        disabled={isLoading}
        className="w-full bg-[#004D4D] hover:bg-teal-800 active:bg-teal-900 text-white font-semibold py-3 rounded-xl text-xs transition-all disabled:bg-slate-200 disabled:text-slate-400 flex items-center justify-center gap-2 shadow-sm shadow-teal-950/10 cursor-pointer"
      >
        {isLoading ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin text-teal-500" />
            <span className="text-slate-500">HPLC 데이터 분석 및 분석표 추출 중...</span>
          </>
        ) : (
          <>
            <Play className="w-4 h-4 fill-current" />
            AI HPLC 분석 데이터 파싱 시작
          </>
        )}
      </button>
    </div>
  );
}
