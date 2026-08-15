/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface HPLCMetadata {
  productName: string;      // 제품명
  formulation: string;      // 제형 (정제, 캡슐 등)
  batchNumber: string;      // 배치(Lot) 번호
  testDate: string;         // 시험일자
  analyst: string;          // 분석자
  instrument: string;       // 사용 장비 / 컬럼
  mobilePhase: string;      // 이동상
  wavelength: string;       // 파장 (nm)
  flowRate: string;         // 유량 (mL/min)
  stdPurity: number;        // 표준품 순도 (%)
  stdLot: string;           // 표준품 Lot 번호
  stdWeight: number;        // 표준품 칭량값 (mg)
  sampleWeight: number;     // 시료 칭량값 (mg)
  stdDilution: number;      // 표준품 희석배율
  sampleDilution: number;   // 시료 희석배율
}

export interface PeakEntry {
  id: string;               // 고유 ID (예: Std-1, Sample-1)
  name: string;             // 성분명
  type: "Std" | "Sample";   // 주입 구분
  rt: number;               // RT (min)
  area: number;             // Area
}

export interface SpecRange {
  componentName: string;
  min: number;
  max: number;
}

export interface SystemSuitabilityResult {
  componentName: string;
  rtMean: number;
  rtSD: number;
  rtRSD: number;
  areaMean: number;
  areaSD: number;
  areaRSD: number;
  rtStatus: "적합" | "부적합" | "확인불가";
  areaStatus: "적합" | "부적합" | "확인불가";
  overallStatus: "적합" | "부적합" | "반복주입 부족";
  notes: string[];
  rtRSDFormula?: string;
  areaRSDFormula?: string;
}

export interface AssayResultRow {
  componentName: string;
  sampleId: string;
  rt: number;
  area: number;
  stdAreaMean: number;
  correctionFactor: number;
  correctionFactorFormula?: string;
  formulaExpression?: string;
  rawAssay: number;         // 반올림 전 Raw Value
  roundedAssay: number;     // 반올림된 함량 (%)
  status: "적합" | "부적합" | "미등록" | "시료 미검출";
  deviationDirection: "초과" | "미달" | "정상" | "N/A";
  deviationMargin: number;  // 이탈폭 (%)
  notes: string[];
}

export interface ValidationIssue {
  type: "error" | "warning";
  field: string;
  message: string;
}
