/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Sparkles, Play, RefreshCw, AlertTriangle, Terminal, Copy, Trash2, Check, FileCode, Layers } from "lucide-react";

interface AIParsingBoxProps {
  rawText: string;
  setRawText: (text: string) => void;
  onParseSuccess: (data: any) => void;
  userApiKey?: string;
}

export default function AIParsingBox({ rawText, setRawText, onParseSuccess, userApiKey }: AIParsingBoxProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [parseError, setParseError] = useState("");
  const [copied, setCopied] = useState(false);

  const TEMPLATES = {
    agilent: `[HPLC Chromatogram Analysis Report - Agilent 1260]
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

Sample Inj-1 (TN202607A):
Peak 1: RT 4.510 min, Area 1261020, Component: 아세트아미노펜
Peak 2: RT 7.231 min, Area 844320, Component: 카페인

Sample Inj-2 (TN202607A):
Peak 1: RT 4.505 min, Area 1259850, Component: 아세트아미노펜
Peak 2: RT 7.225 min, Area 839950, Component: 카페인`,

    waters: `[Waters Empower HPLC Data Export - CSV Format]
제품명: 아스피린 복합정 100mg
배치번호: ASP-2026-09
시험일자: 2026-07-07
분석자: 김철수 책임연구원
장비: Waters Alliance e2695
이동상: Phosphate Buffer pH 3.0 : Methanol = 60 : 40
파장: 275 nm
유량: 1.2 mL/min
표준품 순도: 99.80%
Std Weight: 10.0 mg, Sample Weight: 10.2 mg

성분명, 주입구분, RT(min), Area(μV*s)
아스피린, Standard, 3.820, 2451000
살리실산(유연물질), Standard, 8.450, 48200
아스피린, Standard, 3.818, 2449500
살리실산(유연물질), Standard, 8.448, 48100
아스피린, Sample, 3.822, 2482100
살리실산(유연물질), Sample, 8.452, 51200
아스피린, Sample, 3.819, 2479800
살리실산(유연물질), Sample, 8.449, 50900`,

    shimadzu: `[Shimadzu LabSolutions Raw Text]
Product Name = 비타민C 주사제 500mg
Lot Number = VITC-8812
Date = 2026-07-05
Analyst = 이영희
Instrument = Shimadzu Prominence LC-20D
Mobile Phase = 0.1% Formic acid in Water : ACN
Wavelength = 254 nm
Flow = 0.8 mL/min
Std Purity = 100.0%

Standard 1 Peak Table:
Peak 1: RT 2.150 min, Area 3105000, Component: 아스코르브산

Sample 1 Peak Table:
Peak 1: RT 2.152 min, Area 3120400, Component: 아스코르브산

Sample 2 Peak Table:
Peak 1: RT 2.148 min, Area 3118900, Component: 아스코르브산`
  };

  const handleCopy = () => {
    if (!rawText) return;
    navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRawText(text);
        setParseError("");
      }
    } catch (e) {
      console.warn("Clipboard access not available:", e);
    }
  };

  const handleAIAnalysis = async () => {
    if (!rawText.trim()) {
      alert("분석할 크로마토그램 Raw Data를 마크다운 코드블록 입력란에 작성해 주십시오.");
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

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "서버와의 분석 통신에 실패하였습니다.");
      }
      
      if (data.parseError) {
        setParseError(data.parseError);
        setIsLoading(false);
        return;
      }

      onParseSuccess(data);
      alert("AI HPLC Raw Data 분석 및 자동 입력을 성공적으로 완료하였습니다!");
    } catch (err: any) {
      console.error(err);
      setParseError("서버 분석 처리 알림: " + (err.message || "HPLC 데이터를 파싱하는 도중 오류가 발생했습니다."));
    } finally {
      setIsLoading(false);
    }
  };

  const lineCount = rawText ? rawText.split("\n").length : 0;

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-md shadow-slate-100/50 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2 tracking-tight">
          <span className="p-1 bg-teal-50 rounded-lg text-teal-700 block">
            <Sparkles className="w-4 h-4" />
          </span>
          AI HPLC 크로마토그램 파서
        </h2>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-400 font-medium text-[11px]">템플릿 불러오기:</span>
          <button
            onClick={() => { setRawText(TEMPLATES.agilent); setParseError(""); }}
            className="px-2 py-1 bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-700 rounded-lg font-medium text-[11px] transition-colors cursor-pointer"
          >
            Agilent
          </button>
          <button
            onClick={() => { setRawText(TEMPLATES.waters); setParseError(""); }}
            className="px-2 py-1 bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-700 rounded-lg font-medium text-[11px] transition-colors cursor-pointer"
          >
            Waters CSV
          </button>
          <button
            onClick={() => { setRawText(TEMPLATES.shimadzu); setParseError(""); }}
            className="px-2 py-1 bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-700 rounded-lg font-medium text-[11px] transition-colors cursor-pointer"
          >
            Shimadzu
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500 leading-relaxed font-sans">
        복사한 데이터나 CSV 텍스트를 마크다운 코드블록 스타일로 입력란에 붙여넣거나 작성하십시오. AI가 함량 및 적합성을 자동 분석합니다.
      </p>

      {/* Code Block Styled Editor Window */}
      <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-50">
        {/* Terminal / Code Block Header */}
        <div className="bg-slate-100 px-4 py-2.5 flex items-center justify-between border-b border-slate-200 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-700 font-mono text-[11px] pl-1 border-l border-slate-300">
              <FileCode className="w-3.5 h-3.5 text-teal-700" />
              <span>```hplc_raw_data.txt</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-2xs">
              {lineCount} lines
            </span>

            {rawText && (
              <button
                onClick={handleCopy}
                title="복사하기"
                className="text-slate-500 hover:text-slate-900 p-1 rounded hover:bg-white transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}

            <button
              onClick={handlePasteClipboard}
              title="클립보드에서 붙여넣기"
              className="text-slate-600 hover:text-teal-800 px-2 py-0.5 rounded hover:bg-white transition-colors cursor-pointer text-[11px] flex items-center gap-1 font-mono border border-slate-200/60"
            >
              <Terminal className="w-3 h-3 text-teal-700" />
              붙여넣기
            </button>

            {rawText && (
              <button
                onClick={() => setRawText("")}
                title="비우기"
                className="text-slate-500 hover:text-rose-600 p-1 rounded hover:bg-white transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Code Input Area */}
        <div className="relative">
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={`[HPLC 크로마토그램 데이터 작성란]\n여기에 HPLC 인쇄 리포트나 텍스트 수치를 복사-붙여넣기 하십시오.\n\n예시:\nProduct: 타이레놀정 500mg\nPeak 1: RT 4.512 min, Area 1254320, Component: 아세트아미노펜`}
            className="w-full h-44 p-4 font-mono text-xs text-slate-800 bg-slate-50/80 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-600/30 transition-all resize-none leading-relaxed selection:bg-teal-100 selection:text-teal-900"
          />
        </div>

        {/* Footer Code Block Tag */}
        <div className="bg-slate-100/90 px-4 py-1.5 border-t border-slate-200 flex items-center justify-between text-[10px] font-mono text-slate-500">
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3 text-slate-500" />
            Markdown Codeblock Input Mode
          </span>
          <span>UTF-8 • Text Format</span>
        </div>
      </div>

      {parseError && (
        <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-100 text-xs text-rose-800 flex items-start gap-2.5 animate-fadeIn">
          <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-rose-600 mt-0.5" />
          <span className="leading-relaxed font-medium">{parseError}</span>
        </div>
      )}

      <button
        onClick={handleAIAnalysis}
        disabled={isLoading}
        className="w-full bg-[#004D4D] hover:bg-teal-800 active:bg-teal-900 text-white font-semibold py-3 rounded-xl text-xs transition-all disabled:bg-slate-200 disabled:text-slate-400 flex items-center justify-center gap-2 shadow-sm shadow-teal-950/10 cursor-pointer"
      >
        {isLoading ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin text-teal-400" />
            <span className="text-slate-200">HPLC 데이터 파싱 및 정밀 분석 중...</span>
          </>
        ) : (
          <>
            <Play className="w-4 h-4 fill-current text-teal-300" />
            AI HPLC Raw Data 파싱 시작
          </>
        )}
      </button>
    </div>
  );
}

