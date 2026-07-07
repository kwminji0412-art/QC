/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HPLCMetadata, PeakEntry, SpecRange, SystemSuitabilityResult, AssayResultRow } from "../types";

// 4. 반올림 규칙: 사사오입 (round-half-up) 정밀 구현
export function roundHalfUp(num: number, decimals: number): number {
  if (isNaN(num) || !isFinite(num)) return 0;
  const factor = Math.pow(10, decimals);
  // 부동 소수점 왜곡 방지를 위해 Number.EPSILON 보정 추가
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

// n-1 표본표준편차
export function calculateStdDev(values: number[], meanVal?: number): number {
  const n = values.length;
  if (n <= 1) return 0;
  const m = meanVal !== undefined ? meanVal : calculateMean(values);
  const sumSqDiff = values.reduce((acc, v) => acc + Math.pow(v - m, 2), 0);
  return Math.sqrt(sumSqDiff / (n - 1));
}

// RSD (%)
export function calculateRSD(values: number[]): number {
  if (values.length <= 1) return 0;
  const meanVal = calculateMean(values);
  if (meanVal === 0) return 0;
  const sd = calculateStdDev(values, meanVal);
  return (sd / meanVal) * 100;
}

// 1. 시스템 적합성 검증 (RT 및 Area RSD)
export function verifySystemSuitability(peaks: PeakEntry[]): SystemSuitabilityResult[] {
  // 성분별로 표준용액(Std) 그룹화
  const stdMap = new Map<string, PeakEntry[]>();
  peaks.forEach((peak) => {
    if (peak.type === "Std") {
      const nameKey = peak.name.trim().toLowerCase();
      const existing = stdMap.get(nameKey) || [];
      existing.push(peak);
      stdMap.set(nameKey, existing);
    }
  });

  const results: SystemSuitabilityResult[] = [];

  stdMap.forEach((stdPeaks, lowercaseName) => {
    // 실제 성분명 찾기 (가장 흔하게 쓰인 대소문자 매칭)
    const displayName = stdPeaks[0]?.name || lowercaseName;
    const rts = stdPeaks.map((p) => p.rt);
    const areas = stdPeaks.map((p) => p.area);

    const rtMean = calculateMean(rts);
    const rtSD = calculateStdDev(rts, rtMean);
    const rtRSD = rts.length > 1 ? (rtSD / rtMean) * 100 : 0;

    const areaMean = calculateMean(areas);
    const areaSD = calculateStdDev(areas, areaMean);
    const areaRSD = areas.length > 1 ? (areaSD / areaMean) * 100 : 0;

    // 검증 기준 판정 (RT RSD <= 1.0%, Area RSD <= 2.0%)
    let rtStatus: "적합" | "부적합" | "확인불가" = "적합";
    let areaStatus: "적합" | "부적합" | "확인불가" = "적합";
    let overallStatus: "적합" | "부적합" | "반복주입 부족" = "적합";
    const notes: string[] = [];

    // 오적분/이상치 검출: 개별 Area가 평균 대비 ±15% 이상 크게 이탈하는 경우
    stdPeaks.forEach((p) => {
      if (areaMean > 0 && Math.abs(p.area - areaMean) / areaMean > 0.15) {
        notes.push(`${p.id}의 Area 값이 표준 평균 대비 현저히 이탈하여 이상값으로 의심됩니다. (수동 확인 요망)`);
      }
    });

    if (stdPeaks.length <= 1) {
      rtStatus = "확인불가";
      areaStatus = "확인불가";
      overallStatus = "반복주입 부족";
      notes.push("반복주입 부족 (RSD 계산 불가, 최소 2회 필요)");
    } else {
      if (rtRSD > 1.0) {
        rtStatus = "부적합";
        notes.push(`RT 재현성 이상 (RT RSD ${roundHalfUp(rtRSD, 2)}% > 1.0%)`);
      }
      if (areaRSD > 2.0) {
        areaStatus = "부적합";
        notes.push(`Area 재현성 이상 (Area RSD ${roundHalfUp(areaRSD, 2)}% > 2.0%)`);
      }

      if (rtStatus === "부적합" || areaStatus === "부적합") {
        overallStatus = "부적합";
      }
    }

    results.push({
      componentName: displayName,
      rtMean,
      rtSD,
      rtRSD,
      areaMean,
      areaSD,
      areaRSD,
      rtStatus,
      areaStatus,
      overallStatus,
      notes,
    });
  });

  return results;
}

// 2. 함량 계산 및 3. 판정
export function calculateAssay(
  peaks: PeakEntry[],
  metadata: HPLCMetadata,
  specs: SpecRange[],
  suitabilityList: SystemSuitabilityResult[]
): AssayResultRow[] {
  // 성분별로 표준용액 Area 평균 맵 생성
  const stdAverageMap = new Map<string, number>();
  suitabilityList.forEach((suit) => {
    stdAverageMap.set(suit.componentName.trim().toLowerCase(), suit.areaMean);
  });

  // 보정계수 계산
  // 관련 수치(칭량값, 희석배율)가 유효하게 존재하면 보정계수에 희석배율 보정비 반영
  let dilutionRatio = 1;
  const hasWeights = metadata.stdWeight > 0 && metadata.sampleWeight > 0;
  const hasDilutions = metadata.stdDilution > 0 && metadata.sampleDilution > 0;

  if (hasWeights && hasDilutions) {
    // 희석배율 보정비 = (표준품 칭량 / 시료 칭량) * (시료 희석배율 / 표준품 희석배율)
    dilutionRatio = (metadata.stdWeight / metadata.sampleWeight) * (metadata.sampleDilution / metadata.stdDilution);
  }
  
  // 보정계수 = (표준품 순도(%) ÷ 100) × 희석배율 보정비 (없으면 1)
  // 단, 순도가 기본값 100이고 희석배율이 없는 경우 보정계수는 1이 된다.
  const hasPurity = metadata.stdPurity !== undefined && metadata.stdPurity > 0;
  const purityFactor = hasPurity ? metadata.stdPurity / 100 : 1;
  const correctionFactor = purityFactor * dilutionRatio;

  // 시료(Sample) 추출
  const samples = peaks.filter((p) => p.type === "Sample");
  const results: AssayResultRow[] = [];

  // 성분별 매칭 및 계산
  samples.forEach((sample) => {
    const componentNameClean = sample.name.trim();
    const componentKey = componentNameClean.toLowerCase();
    
    // 이 성분의 표준 Area 평균 가져오기
    const stdAreaMean = stdAverageMap.get(componentKey) || 0;
    
    // 스펙 검토
    const spec = specs.find((s) => s.componentName.trim().toLowerCase() === componentKey);

    const notes: string[] = [];
    
    // 예외 처리: Area가 0 이하인 경우 데이터 오류 표시
    if (sample.area <= 0) {
      results.push({
        componentName: componentNameClean,
        sampleId: sample.id,
        rt: sample.rt,
        area: sample.area,
        stdAreaMean,
        correctionFactor,
        rawAssay: 0,
        roundedAssay: 0,
        status: "부적합",
        deviationDirection: "N/A",
        deviationMargin: 0,
        notes: ["데이터 오류 (Area가 0 이하입니다. 확인 요청)"],
      });
      return;
    }

    // 표준액에 존재하지 않는 성분 피크인 경우
    if (stdAreaMean === 0) {
      results.push({
        componentName: componentNameClean,
        sampleId: sample.id,
        rt: sample.rt,
        area: sample.area,
        stdAreaMean: 0,
        correctionFactor,
        rawAssay: 0,
        roundedAssay: 0,
        status: "미등록",
        deviationDirection: "N/A",
        deviationMargin: 0,
        notes: ["표준액에 등록되지 않은 임의의 피크입니다."],
      });
      return;
    }

    // 함량 계산
    // 함량(%) = (시료 Area ÷ 표준 Area 평균) × 100 × 보정계수
    const rawAssay = (sample.area / stdAreaMean) * 100 * correctionFactor;
    // 반올림: 소수 둘째 자리 (사사오입)
    const roundedAssay = roundHalfUp(rawAssay, 2);

    let status: "적합" | "부적합" | "미등록" | "시료 미검출" = "적합";
    let deviationDirection: "초과" | "미달" | "정상" | "N/A" = "정상";
    let deviationMargin = 0;

    if (!spec) {
      status = "미등록";
      notes.push("스펙(Spec) 미등록 성분");
    } else {
      const minLimit = spec.min;
      const maxLimit = spec.max;

      if (roundedAssay < minLimit) {
        status = "부적합";
        deviationDirection = "미달";
        deviationMargin = roundHalfUp(minLimit - roundedAssay, 2);
        notes.push(`규격 미달 (기준: ${minLimit}% ~ ${maxLimit}%, 미달폭: ${deviationMargin}%)`);
      } else if (roundedAssay > maxLimit) {
        status = "부적합";
        deviationDirection = "초과";
        deviationMargin = roundHalfUp(roundedAssay - maxLimit, 2);
        notes.push(`규격 초과 (기준: ${minLimit}% ~ ${maxLimit}%, 초과폭: ${deviationMargin}%)`);
      }
    }

    results.push({
      componentName: componentNameClean,
      sampleId: sample.id,
      rt: sample.rt,
      area: sample.area,
      stdAreaMean,
      correctionFactor,
      rawAssay,
      roundedAssay,
      status,
      deviationDirection,
      deviationMargin,
      notes,
    });
  });

  // 만약 표준(Std)에는 존재하지만 시료(Sample)에 전혀 매칭되는 성분이 검출되지 않은 경우
  stdAverageMap.forEach((stdMean, stdKey) => {
    const hasSampleForStd = samples.some((s) => s.name.trim().toLowerCase() === stdKey);
    if (!hasSampleForStd) {
      // 해당 표준 성분의 실제 표기명 찾기
      const displayStdName = suitabilityList.find((s) => s.componentName.trim().toLowerCase() === stdKey)?.componentName || stdKey;
      
      results.push({
        componentName: displayStdName,
        sampleId: "N/A",
        rt: 0,
        area: 0,
        stdAreaMean: stdMean,
        correctionFactor,
        rawAssay: 0,
        roundedAssay: 0,
        status: "시료 미검출",
        deviationDirection: "N/A",
        deviationMargin: 0,
        notes: ["표준액 성분이나 시료에서 해당 피크가 검출되지 않았습니다. (시료 미검출)"],
      });
    }
  });

  return results;
}
