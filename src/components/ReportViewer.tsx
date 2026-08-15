/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { HPLCMetadata, SystemSuitabilityResult, AssayResultRow, SpecRange } from "../types";
import { roundHalfUp } from "../utils/calc";
import { Printer, Copy, Check, FileText } from "lucide-react";

interface ReportViewerProps {
  metadata: HPLCMetadata;
  suitabilityList: SystemSuitabilityResult[];
  assayResults: AssayResultRow[];
  specs: SpecRange[];
}

export default function ReportViewer({ metadata, suitabilityList, assayResults, specs }: ReportViewerProps) {
  const [copied, setCopied] = useState(false);

  // 값 헬퍼 (비어 있으면 "기재 필요")
  const val = (v: string | number | undefined, placeholder = "기재 필요") => {
    if (v === undefined || v === null || String(v).trim() === "" || Number(v) === 0) {
      return `<span class="text-red-500 font-medium">${placeholder}</span>`;
    }
    return String(v);
  };

  // 종합 결론 판단
  const hasFailure = assayResults.some((r) => r.status === "부적합");
  const hasUnregistered = assayResults.some((r) => r.status === "미등록");
  const hasMissingSample = assayResults.some((r) => r.status === "시료 미검출");
  const hasRSDError = suitabilityList.some((s) => s.overallStatus === "부적합");

  let finalConclusion = "모든 분석 성분이 설정된 기준(Spec) 및 시스템 적합성 요건에 적합합니다.";
  if (hasFailure) {
    const failedComponents = assayResults
      .filter((r) => r.status === "부적합")
      .map((r) => `${r.componentName}(${r.sampleId}: ${r.roundedAssay}%)`)
      .join(", ");
    finalConclusion = `함량 시험 부적합 판정이 발생하였습니다. [대상 성분: ${failedComponents}]`;
  } else if (hasMissingSample) {
    finalConclusion = "표준품에 기재된 일부 성분이 시료에서 검출되지 않아 완벽한 판정이 보류되었습니다. (시료 미검출)";
  } else if (hasRSDError) {
    finalConclusion = "함량 수치는 기준 범위 내이나, 표준용액 주입의 시스템 적합성(RSD)이 불합격하여 재시험 및 분석 원인 규명이 권장됩니다.";
  }

  // 텍스트/마크다운 형식 보고서 생성 (복사용)
  const generateMarkdownReport = () => {
    const sysTable = suitabilityList
      .map(
        (s) =>
          `| ${s.componentName} | ${s.rtMean.toFixed(3)} (${roundHalfUp(s.rtRSD, 2)}%) | ${s.areaMean.toFixed(0)} (${roundHalfUp(s.areaRSD, 2)}%) | ${s.overallStatus} |`
      )
      .join("\n");

    const assayTable = assayResults
      .map(
        (r) =>
          `| ${r.componentName} | ${r.sampleId} | ${r.rt.toFixed(3)} | ${r.roundedAssay.toFixed(2)}% | ${r.status} | ${r.notes.join("; ") || "-"} |`
      )
      .join("\n");

    const assayFormulas = assayResults
      .map((r) => `- ${r.componentName} (${r.sampleId}): ${r.formulaExpression || `(${r.area} / ${r.stdAreaMean}) * 100 * ${r.correctionFactor} = ${r.roundedAssay}%`}`)
      .join("\n");

    const specText = specs.map((s) => `- ${s.componentName}: ${s.min.toFixed(2)} ~ ${s.max.toFixed(2)} %`).join("\n");

    return `[완제의약품 함량시험 성적서 (초안)]

■ 문서 정보
- 문서번호: (기재 필요)
- 제품명 / 제형: ${metadata.productName || "기재 필요"} / ${metadata.formulation || "기재 필요"}
- 배치(Lot)번호: ${metadata.batchNumber || "기재 필요"}
- 시험일자: ${metadata.testDate || "기재 필요"}
- 분석자: ${metadata.analyst || "기재 필요"}
- 검토자 / 승인자: (서명란 - 공란)

■ 시험 방법 요약
- 사용 장비 / 컬럼: ${metadata.instrument || "기재 필요"}
- 이동상 / 파장(nm) / 유량: ${metadata.mobilePhase || "기재 필요"} / ${metadata.wavelength ? metadata.wavelength + " nm" : "기재 필요"} / ${metadata.flowRate ? metadata.flowRate + " mL/min" : "기재 필요"}
- 표준품 Lot / 순도(%): ${metadata.stdLot || "기재 필요"} / ${metadata.stdPurity ? metadata.stdPurity + "%" : "기재 필요"}

■ 1. 시스템 적합성 결과
| 성분명 | RT 평균 (RSD%) | Area 평균 (RSD%) | 판정 |
|---|---|---|---|
${sysTable}

■ 2. 함량 시험 결과
| 성분명 | 시료ID | RT(min) | 함량(%) | 판정 | 비고 |
|---|---|---|---|---|---|
${assayTable}

■ 3. 함량 계산식 및 산출 근거
- 산식: 함량(%) = (시료 Peak Area ÷ 표준 Peak Area 평균) × 100 × 보정계수
- 보정계수 산식: (표준 순도% / 100) × (표준 칭량 / 시료 칭량) × (시료 희석배율 / 표준 희석배율)
${assayFormulas}

■ 4. 종합 결론
- ${finalConclusion}

■ 5. 특이사항 / 비고
${suitabilityList.flatMap((s) => s.notes).map((n) => `- [적합성] ${n}`).join("\n")}
${assayResults.flatMap((r) => r.notes).map((n) => `- [함량] ${n}`).join("\n")}
- 설정된 스펙 기준:
${specText}

■ 6. 서명
- 시험자: ______________  날짜: ______
- 검토자: ______________  날짜: ______
- 승인자: ______________  날짜: ______

※ 본 문서는 AI 보조 도구로 산출된 초안이며, 정식 GMP 문서로 사용하기 전 QC 책임자의 검토·승인 및 원본 Raw Data 대사가 필요합니다.`;
  };

  const handleCopy = () => {
    const reportText = generateMarkdownReport();
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* 액션 바 */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 text-white p-4.5 rounded-2xl shadow-sm border border-slate-850">
        <div className="flex items-center gap-2.5">
          <span className="p-1.5 bg-teal-500/10 rounded-lg text-teal-400 block border border-teal-500/20">
            <FileText className="w-5 h-5" />
          </span>
          <div>
            <span className="font-bold text-slate-100 text-sm block tracking-tight">GMP 완제의약품 시험성적서 초안</span>
            <span className="text-[10px] text-slate-400 font-medium">GMP Validation Draft Output</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 active:bg-slate-750 rounded-lg border border-slate-700/80 shadow-inner transition-all cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
            {copied ? "클립보드 복사 완료" : "성적서 본문 복사 (MD)"}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#004D4D] hover:bg-teal-800 active:bg-teal-900 text-white rounded-lg shadow-md shadow-teal-950/10 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 fill-current" />
            성적서 즉시 출력
          </button>
        </div>
      </div>

      {/* 인쇄 가능 A4 스타일지 */}
      <div id="print-area" className="bg-white p-10 sm:p-14 md:p-16 rounded-2xl border border-slate-200/80 shadow-md font-sans text-slate-900 leading-relaxed max-w-4xl mx-auto print:border-none print:shadow-none print:p-0">
        {/* 상단 타이틀 */}
        <div className="text-center pb-8 border-b-2 border-slate-900 space-y-2.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">[완제의약품 함량시험 성적서 (초안)]</h1>
          <p className="text-[10px] font-bold text-slate-500 tracking-widest font-mono">LABORATORY HPLC ASSAY CHROMATOGRAM QC REPORT</p>
        </div>

        {/* 문서 정보 & 서명 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-8 border-b border-slate-200">
          <div className="space-y-4 text-xs sm:text-sm">
            <h2 className="font-bold text-slate-900 border-l-4 border-teal-700 pl-2.5 mb-2.5 tracking-tight text-sm">■ 문서 정보</h2>
            <div className="grid grid-cols-3 gap-y-3 gap-x-2 border border-slate-100 p-4 rounded-xl bg-slate-50/50">
              <span className="text-slate-500 font-semibold">- 문서번호:</span>
              <span className="col-span-2 text-slate-800 font-medium" dangerouslySetInnerHTML={{ __html: val("", "기재 필요 (자동부여 예정)") }} />

              <span className="text-slate-500 font-semibold">- 제품명 / 제형:</span>
              <span className="col-span-2 text-slate-900 font-bold" dangerouslySetInnerHTML={{ __html: `${val(metadata.productName)} / ${val(metadata.formulation)}` }} />

              <span className="text-slate-500 font-semibold">- 배치(Lot)번호:</span>
              <span className="col-span-2 text-slate-800 font-bold font-mono" dangerouslySetInnerHTML={{ __html: val(metadata.batchNumber) }} />

              <span className="text-slate-500 font-semibold">- 시험일자:</span>
              <span className="col-span-2 text-slate-800 font-mono" dangerouslySetInnerHTML={{ __html: val(metadata.testDate) }} />

              <span className="text-slate-500 font-semibold">- 분석자:</span>
              <span className="col-span-2 text-slate-800 font-medium" dangerouslySetInnerHTML={{ __html: val(metadata.analyst) }} />
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="font-bold text-slate-900 border-l-4 border-teal-700 pl-2.5 mb-2.5 tracking-tight text-sm">■ 검토 및 승인 서명</h2>
            <div className="border border-slate-300 rounded-xl text-xs overflow-hidden bg-white shadow-sm">
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-300">
                    <th className="py-2.5 border-r border-slate-300 font-bold text-slate-700 w-1/3">작성 / 시험자</th>
                    <th className="py-2.5 border-r border-slate-300 font-bold text-slate-700 w-1/3">검토자</th>
                    <th className="py-2.5 font-bold text-slate-700 w-1/3">승인자</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="h-16">
                    <td className="border-r border-b border-slate-300 align-bottom p-2.5 text-slate-400">
                      <div className="text-[10px] text-slate-800 font-semibold mb-1.5">{metadata.analyst || "서명 대기"}</div>
                      <div className="text-slate-300 text-[10px]">_________________</div>
                    </td>
                    <td className="border-r border-b border-slate-300 align-bottom p-2.5 text-slate-400">
                      <span className="text-[10px] block mb-1.5 text-slate-400 font-medium">(서명란)</span>
                      <div className="text-slate-300 text-[10px]">_________________</div>
                    </td>
                    <td className="border-b border-slate-300 align-bottom p-2.5 text-slate-400">
                      <span className="text-[10px] block mb-1.5 text-slate-400 font-medium">(서명란)</span>
                      <div className="text-slate-300 text-[10px]">_________________</div>
                    </td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="py-1.5 border-r border-slate-300 text-[10px] font-mono text-slate-600">날짜: {metadata.testDate || "      "}</td>
                    <td className="py-1.5 border-r border-slate-300 text-[10px] font-mono text-slate-600">날짜:          </td>
                    <td className="py-1.5 text-[10px] font-mono text-slate-600">날짜:          </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 시험 방법 요약 */}
        <div className="py-6 border-b border-slate-200 space-y-4 text-xs sm:text-sm">
          <h2 className="font-bold text-slate-900 border-l-4 border-teal-700 pl-2.5 mb-2.5 tracking-tight text-sm">■ 시험 방법 요약</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/70 p-4.5 rounded-xl border border-slate-200/80">
            <div className="grid grid-cols-3 gap-y-2 text-xs">
              <span className="text-slate-500 font-semibold">사용 장비:</span>
              <span className="col-span-2 text-slate-800 font-medium" dangerouslySetInnerHTML={{ __html: val(metadata.instrument) }} />
              
              <span className="text-slate-500 font-semibold">이동상 조건:</span>
              <span className="col-span-2 text-slate-800 font-medium" dangerouslySetInnerHTML={{ __html: val(metadata.mobilePhase) }} />
            </div>
            <div className="grid grid-cols-3 gap-y-2 text-xs">
              <span className="text-slate-500 font-semibold">파장 / 유량:</span>
              <span className="col-span-2 text-slate-800 font-medium">
                {metadata.wavelength ? `${metadata.wavelength} nm` : "기재 필요"} / {metadata.flowRate ? `${metadata.flowRate} mL/min` : "기재 필요"}
              </span>

              <span className="text-slate-500 font-semibold">표준품 Lot / 순도:</span>
              <span className="col-span-2 text-slate-800 font-semibold">
                {metadata.stdLot ? `${metadata.stdLot}` : "기재 필요"} / {metadata.stdPurity ? `${metadata.stdPurity}%` : "기재 필요"}
              </span>
            </div>
          </div>
        </div>

        {/* 1. 시스템 적합성 결과 */}
        <div className="py-6 border-b border-slate-200 space-y-4 text-xs sm:text-sm">
          <h2 className="font-bold text-slate-900 border-l-4 border-teal-700 pl-2.5 mb-2.5 tracking-tight text-sm">■ 1. 시스템 적합성 결과</h2>
          <div className="overflow-hidden border border-slate-200 rounded-xl bg-white shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                  <th className="p-3 font-bold">성분명</th>
                  <th className="p-3 font-bold text-right">RT 평균 (RSD%)</th>
                  <th className="p-3 font-bold text-right">Area 평균 (RSD%)</th>
                  <th className="p-3 font-bold text-center w-28">판정</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suitabilityList.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-400">적합성 검사 대상 표준액 데이터가 없습니다.</td>
                  </tr>
                ) : (
                  suitabilityList.map((s, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 font-bold text-slate-900">{s.componentName}</td>
                      <td className="p-3 text-right font-mono text-slate-800 font-medium">
                        {s.rtMean.toFixed(3)} 분 <span className="text-[11px] text-slate-500 font-semibold">({s.rtRSD.toFixed(2)}%)</span>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-800 font-medium">
                        {s.areaMean.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-[11px] text-slate-500 font-semibold">({s.areaRSD.toFixed(2)}%)</span>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            s.overallStatus === "적합"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-150"
                              : s.overallStatus === "부적합"
                              ? "bg-rose-50 text-rose-700 border border-rose-155"
                              : "bg-amber-50 text-amber-700 border border-amber-155"
                          }`}
                        >
                          {s.overallStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 2. 함량 시험 결과 */}
        <div className="py-6 border-b border-slate-200 space-y-4 text-xs sm:text-sm">
          <h2 className="font-bold text-slate-900 border-l-4 border-teal-700 pl-2.5 mb-2.5 tracking-tight text-sm">■ 2. 함량 시험 결과</h2>
          <div className="overflow-hidden border border-slate-200 rounded-xl bg-white shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                  <th className="p-3 font-bold">성분명</th>
                  <th className="p-3 font-bold">시료 ID</th>
                  <th className="p-3 font-bold text-right">측정 RT (min)</th>
                  <th className="p-3 font-bold text-right">최종 함량 (%)</th>
                  <th className="p-3 font-bold text-center w-28">판정</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assayResults.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-400">함량 계산 데이터가 존재하지 않습니다.</td>
                  </tr>
                ) : (
                  assayResults.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 font-bold text-slate-900">{r.componentName}</td>
                      <td className="p-3 font-mono text-slate-600 font-semibold">{r.sampleId}</td>
                      <td className="p-3 text-right font-mono text-slate-800">{r.rt > 0 ? `${r.rt.toFixed(3)} 분` : "-"}</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-800 text-xs sm:text-sm">
                        {r.roundedAssay > 0 ? `${r.roundedAssay.toFixed(2)} %` : "-"}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            r.status === "적합"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-150"
                              : r.status === "부적합"
                              ? "bg-rose-50 text-rose-700 border border-rose-155"
                              : r.status === "시료 미검출"
                              ? "bg-slate-100 text-slate-600 border"
                              : "bg-amber-50 text-amber-700 border border-amber-155"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. 함량 계산식 및 산출 근거 */}
        <div className="py-6 border-b border-slate-200 space-y-4 text-xs sm:text-sm">
          <h2 className="font-bold text-slate-900 border-l-4 border-teal-700 pl-2.5 mb-2.5 tracking-tight text-sm">
            ■ 3. 함량 계산식 및 산출 근거 (Calculation Formula Details)
          </h2>
          <div className="bg-slate-50/80 p-4.5 rounded-xl border border-slate-200 space-y-3 font-mono text-xs text-slate-800">
            <div className="bg-white p-3.5 rounded-lg border border-slate-200/80 space-y-1">
              <p className="font-bold text-teal-800 font-sans">[기본 함량 산출식]</p>
              <p className="text-slate-800 font-semibold">
                Assay (%) = (시료 Peak Area ÷ 표준 Peak Area 평균) × 100 × 보정계수
              </p>
              <p className="text-slate-500 text-[11px] mt-0.5 font-sans">
                ※ 보정계수(Correction Factor) = (표준품 순도 ÷ 100) × (표준품 칭량 ÷ 시료 칭량) × (시료 희석배율 ÷ 표준품 희석배율)
              </p>
            </div>
            
            <div className="space-y-2 pt-1 font-sans">
              <p className="font-bold text-slate-900 text-xs">■ 성분 및 시료별 수치 대입 연산식:</p>
              {assayResults.map((r, idx) => (
                <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 space-y-1 font-mono text-xs">
                  <div className="flex items-center justify-between font-bold text-slate-900 font-sans">
                    <span>• {r.componentName} ({r.sampleId})</span>
                    <span className="text-teal-800 font-mono text-xs">최종 보고 함량: {r.roundedAssay > 0 ? `${r.roundedAssay.toFixed(2)} %` : "N/A"}</span>
                  </div>
                  <p className="text-slate-800 text-[11px] font-semibold leading-relaxed">
                    대입 연산: {r.formulaExpression || `(${r.area.toLocaleString()} ÷ ${r.stdAreaMean.toLocaleString()}) × 100 × ${r.correctionFactor.toFixed(6)} = ${r.roundedAssay.toFixed(2)}%`}
                  </p>
                  {r.correctionFactorFormula && (
                    <p className="text-slate-500 text-[10px]">
                      보정계수 상세: {r.correctionFactorFormula}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4. 종합 결론 */}
        <div className="py-6 border-b border-slate-200 space-y-4 text-xs sm:text-sm">
          <h2 className="font-bold text-slate-900 border-l-4 border-teal-700 pl-2.5 mb-2.5 tracking-tight text-sm">■ 4. 종합 결론</h2>
          <div className={`p-5 rounded-xl border ${hasFailure ? "bg-rose-50 border-rose-200 text-rose-950 shadow-inner" : "bg-emerald-50/80 border-emerald-200 text-emerald-950 shadow-inner"}`}>
            <p className="font-bold text-xs sm:text-sm leading-relaxed">{finalConclusion}</p>
          </div>
        </div>

        {/* 5. 특이사항 / 비고 */}
        <div className="py-6 border-b border-slate-200 space-y-4 text-xs sm:text-sm">
          <h2 className="font-bold text-slate-900 border-l-4 border-teal-700 pl-2.5 mb-2.5 tracking-tight text-sm">■ 5. 특이사항 및 비고</h2>
          <ul className="list-disc pl-5 space-y-2.5 text-xs text-slate-700 font-medium">
            {suitabilityList.flatMap((s) => s.notes).map((n, i) => (
              <li key={`suit-${i}`} className="text-amber-800">시스템 적합성: {n}</li>
            ))}
            {assayResults.flatMap((r) => r.notes).map((n, i) => (
              <li key={`assay-${i}`} className={n.includes("부적합") || n.includes("오류") ? "text-rose-700 font-bold" : "text-slate-700"}>함량 계산: {n}</li>
            ))}
            <li>설정된 규격 기준(Spec): {specs.map((s) => `${s.componentName} (${s.min.toFixed(2)} ~ ${s.max.toFixed(2)}%)`).join(", ")}</li>
            {metadata.stdPurity && metadata.stdPurity !== 100 ? (
              <li>표준품 순도 보정이 적용되었습니다. (순도: {metadata.stdPurity}%)</li>
            ) : null}
            {metadata.stdWeight > 0 && metadata.sampleWeight > 0 ? (
              <li>칭량값 및 희석배율 기반 보정계수가 자동 적용되었습니다. (보정계수: {assayResults[0]?.correctionFactor?.toFixed(6) || "N/A"})</li>
            ) : (
              <li className="text-amber-700 font-semibold">칭량 정보가 제공되지 않아 기본 보정계수(1.000000)가 사용되었습니다.</li>
            )}
          </ul>
        </div>

        {/* 계산 상세 (추적 무결성 - ALCOA+) */}
        <div className="py-5 space-y-3 text-xs text-slate-500 bg-slate-50 p-5 rounded-xl border border-slate-200 mt-6 font-mono leading-relaxed shadow-inner">
          <h3 className="font-bold text-slate-800 mb-1">■ [Raw Data 추적성 정보 (ALCOA+)]</h3>
          <p className="text-[11px] text-slate-600">
            - 반올림 전 원값 상세 기록:<br />
            {assayResults.map((r, i) => (
              <span key={i} className="block pl-3 font-semibold text-slate-700 mt-1">
                • {r.componentName} ({r.sampleId}): 계산치={r.rawAssay.toFixed(8)}% → 최종보고={r.roundedAssay.toFixed(2)}% (소수점 이하 2자리 반올림 적용)
              </span>
            ))}
          </p>
          <p className="border-t border-slate-200 pt-2.5 text-[10px] text-slate-400">
            본 문서는 시스템 적합성 검증 및 규정된 표준 반올림 계산 규칙에 따라 작성된 컴퓨터 생성 보고서입니다.
            GMP 가이드라인에 따라 문서 무결성을 위해 계산 상세가 원본 그대로 추적되며, 수동 위변조를 금지합니다.
          </p>
        </div>

        {/* 바닥글 */}
        <div className="text-center pt-10 text-[10px] text-slate-400 border-t border-slate-200 space-y-1.5 font-sans">
          <p className="font-bold text-slate-500">※ 본 문서는 AI 보조 도구로 산출된 초안이며, 정식 GMP 문서로 사용하기 전 QC 책임자의 검토·승인 및 원본 Raw Data 대사가 필요합니다.</p>
          <p className="font-mono">HPLC Assay Report draft generated securely on {new Date().toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
