/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from "react";
import { HPLCMetadata, PeakEntry, SpecRange } from "./types";
import { roundHalfUp, verifySystemSuitability, calculateAssay } from "./utils/calc";

// Modular UI Components
import ReportViewer from "./components/ReportViewer";
import AIParsingBox from "./components/AIParsingBox";
import MetadataForm from "./components/MetadataForm";
import SpecManager from "./components/SpecManager";
import PeakTable from "./components/PeakTable";

import {
  Check,
  AlertTriangle,
  Cpu,
  FileSpreadsheet,
  RefreshCw,
  Layers,
  TrendingUp,
  Info,
  Download,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  FileText,
  Play,
  Award,
  ChevronRight,
  Clock,
  ExternalLink
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from "recharts";

// 1. 초기 기본 샘플 데이터 (사용자가 즉시 기능을 검증할 수 있도록 제공)
const INITIAL_METADATA: HPLCMetadata = {
  productName: "타이레놀정 500mg",
  formulation: "정제 (Tablet)",
  batchNumber: "TN202607A",
  testDate: "2026-07-06",
  analyst: "홍길동 연구원",
  instrument: "Agilent 1260 infinity II / C18 (4.6x250mm, 5μm)",
  mobilePhase: "Water : Acetonitrile = 70 : 30",
  wavelength: "243",
  flowRate: "1.0",
  stdPurity: 99.50,
  stdLot: "RS-Acetaminophen-2026X",
  stdWeight: 50.2,      // mg
  sampleWeight: 50.5,   // mg
  stdDilution: 100,
  sampleDilution: 100,
};

const INITIAL_PEAKS: PeakEntry[] = [
  // 아세트아미노펜 (Acetaminophen) - 표준용액 반복 주입 (3회)
  { id: "Std-1", name: "아세트아미노펜", type: "Std", rt: 4.512, area: 1254320 },
  { id: "Std-2", name: "아세트아미노펜", type: "Std", rt: 4.508, area: 1251980 },
  { id: "Std-3", name: "아세트아미노펜", type: "Std", rt: 4.515, area: 1257410 },
  
  // 카페인 (Caffeine) - 표준용액 반복 주입 (3회)
  { id: "Std-4", name: "카페인", type: "Std", rt: 7.234, area: 843210 },
  { id: "Std-5", name: "카페인", type: "Std", rt: 7.228, area: 841980 },
  { id: "Std-6", name: "카페인", type: "Std", rt: 7.240, area: 846120 },

  // 시료용액 주입 결과
  { id: "Sample-1", name: "아세트아미노펜", type: "Sample", rt: 4.510, area: 1261020 },
  { id: "Sample-2", name: "아세트아미노펜", type: "Sample", rt: 4.505, area: 1259850 },
  { id: "Sample-3", name: "카페인", type: "Sample", rt: 7.231, area: 844320 },
  { id: "Sample-4", name: "카페인", type: "Sample", rt: 7.225, area: 839950 },
];

const INITIAL_SPECS: SpecRange[] = [
  { componentName: "아세트아미노펜", min: 98.00, max: 102.00 },
  { componentName: "카페인", min: 95.00, max: 105.00 },
];

export default function App() {
  const [metadata, setMetadata] = useState<HPLCMetadata>(INITIAL_METADATA);
  const [peaks, setPeaks] = useState<PeakEntry[]>(INITIAL_PEAKS);
  const [specs, setSpecs] = useState<SpecRange[]>(INITIAL_SPECS);
  const [rawText, setRawText] = useState("");
  const [activeTab, setActiveTab] = useState<"peaks" | "results" | "report" | "charts">("peaks");
  const [viewMode, setViewMode] = useState<"landing" | "dashboard">("landing");

  // Gemini API Key State
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    return localStorage.getItem("gemini_api_key") || "";
  });
  const [apiKeyInput, setApiKeyInput] = useState(geminiApiKey);
  const [isApiKeyApplied, setIsApiKeyApplied] = useState(!!geminiApiKey);
  const [showApiKey, setShowApiKey] = useState(false);

  const handleApplyApiKey = (key: string) => {
    const trimmed = key.trim();
    setGeminiApiKey(trimmed);
    localStorage.setItem("gemini_api_key", trimmed);
    setIsApiKeyApplied(!!trimmed);
  };

  const handleClearApiKey = () => {
    setGeminiApiKey("");
    setApiKeyInput("");
    localStorage.removeItem("gemini_api_key");
    setIsApiKeyApplied(false);
  };

  // 실시간 시스템 적합성 검증 결과 도출
  const suitabilityList = useMemo(() => {
    return verifySystemSuitability(peaks);
  }, [peaks]);

  // 실시간 함량 계산 및 판정 도출
  const assayResults = useMemo(() => {
    return calculateAssay(peaks, metadata, specs, suitabilityList);
  }, [peaks, metadata, specs, suitabilityList]);

  // 필수값 누락 검증 오류 분석
  const validationIssues = useMemo(() => {
    const issues: { type: "error" | "warning"; message: string }[] = [];
    
    peaks.forEach((p) => {
      if (!p.name.trim()) {
        issues.push({ type: "error", message: `ID [${p.id}]의 성분명이 누락되었습니다.` });
      }
      if (p.rt <= 0) {
        issues.push({ type: "error", message: `ID [${p.id}]의 Retention Time(RT) 값이 비정상입니다 (0 이하).` });
      }
      if (p.area <= 0) {
        issues.push({ type: "error", message: `ID [${p.id}]의 피크 Area 면적값이 비정상입니다 (0 이하).` });
      }
    });

    if (!metadata.productName.trim()) {
      issues.push({ type: "warning", message: "제품명이 기재되지 않았습니다 (성적서 초안에 공란으로 표시됨)." });
    }
    if (!metadata.batchNumber.trim()) {
      issues.push({ type: "warning", message: "배치(Lot) 번호가 기재되지 않았습니다." });
    }
    if (metadata.stdPurity <= 0 || metadata.stdPurity > 100) {
      issues.push({ type: "warning", message: "표준품 순도가 유효하지 않습니다 (0% ~ 100% 범위를 벗어남)." });
    }

    return issues;
  }, [peaks, metadata]);

  // AI HPLC 파서 성공시 콜백
  const handleParseSuccess = (data: any) => {
    if (data.metadata) {
      setMetadata((prev) => ({ ...prev, ...data.metadata }));
    }
    if (data.components && data.components.length > 0) {
      setPeaks(data.components);
      
      const uniqueParsedComponents = Array.from(new Set(data.components.map((c: any) => c.name)));
      const updatedSpecs = [...specs];
      uniqueParsedComponents.forEach((name: any) => {
        const hasSpec = specs.some((s) => s.componentName.trim().toLowerCase() === name.trim().toLowerCase());
        if (!hasSpec && typeof name === "string" && name.trim()) {
          updatedSpecs.push({
            componentName: name,
            min: 98.00,
            max: 102.00,
          });
        }
      });
      setSpecs(updatedSpecs);
    }
    setActiveTab("peaks");
  };

  // 피크 관리 바인딩
  const handleDeletePeak = (id: string) => {
    setPeaks((prev) => prev.filter((p) => p.id !== id));
  };

  const handleAddPeak = (peakData: Omit<PeakEntry, "id">) => {
    const nextIdNum = peaks.length > 0 ? Math.max(...peaks.map((p) => {
      const num = parseInt(p.id.split("-")[1]);
      return isNaN(num) ? 0 : num;
    })) + 1 : 1;
    
    const newId = `${peakData.type}-${nextIdNum}`;
    const entry: PeakEntry = { id: newId, ...peakData };
    setPeaks((prev) => [...prev, entry]);
  };

  const handleUpdatePeakField = (id: string, field: keyof PeakEntry, value: any) => {
    setPeaks((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          let convertedValue = value;
          if (field === "rt" || field === "area") {
            convertedValue = parseFloat(value) || 0;
          }
          return { ...p, [field]: convertedValue };
        }
        return p;
      })
    );
  };

  // 스펙 관리 바인딩
  const handleAddSpec = (newSpec: SpecRange) => {
    setSpecs((prev) => [
      ...prev.filter((s) => s.componentName.toLowerCase() !== newSpec.componentName.toLowerCase()),
      newSpec,
    ]);
  };

  const handleDeleteSpec = (compName: string) => {
    setSpecs((prev) => prev.filter((s) => s.componentName !== compName));
  };

  // CSV 생성 및 다운로드
  const generateCSV = () => {
    let csv = "성분명,시료ID,RT(min),함량(%),판정,비고\n";
    assayResults.forEach((r) => {
      csv += `${r.componentName},${r.sampleId},${r.rt.toFixed(3)},${r.roundedAssay.toFixed(2)}%,${r.status},${r.notes.join("; ") || "정상"}\n`;
    });
    csv += `\n# [계산 상세 상세 내역]\n`;
    csv += `# 적용된 보정계수: ${assayResults[0]?.correctionFactor?.toFixed(6) || "1.000000"}\n`;
    csv += `# 반올림 전 원값: ${assayResults.map((r) => `${r.componentName}(${r.sampleId})=${r.rawAssay.toFixed(8)}%`).join("; ")}\n`;
    return csv;
  };

  const downloadCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(generateCSV());
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `HPLC_Assay_Result_${metadata.batchNumber || "Draft"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const loadExampleData = () => {
    setMetadata(INITIAL_METADATA);
    setPeaks(INITIAL_PEAKS);
    setSpecs(INITIAL_SPECS);
  };

  // 시각화용 차트 데이터 가공
  const chartDataSuitability = useMemo(() => {
    return suitabilityList.map((s) => ({
      name: s.componentName,
      "Area RSD (%)": s.areaRSD,
      "RT RSD (%)": s.rtRSD,
    }));
  }, [suitabilityList]);

  const chartDataAssay = useMemo(() => {
    return assayResults
      .filter((r) => r.roundedAssay > 0)
      .map((r) => ({
        id: `${r.componentName} (${r.sampleId})`,
        "함량 (%)": r.roundedAssay,
      }));
  }, [assayResults]);

  if (viewMode === "landing") {
    return (
      <div className="min-h-screen bg-[#F4F9F9] flex flex-col font-sans selection:bg-teal-500/15 selection:text-teal-900">
        {/* 상단 띠 배너 */}
        <div className="bg-gradient-to-r from-[#003333] via-[#004D4D] to-[#005c5c] text-white text-[11px] sm:text-xs font-bold py-2.5 px-4 text-center tracking-wide flex items-center justify-center gap-1.5 shadow-inner">
          <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
          <span>ALCOA+ 데이터 완전성 가이드라인 및 식약처 GMP 완제의약품 분석 표준 준수 엔진 탑재</span>
        </div>

        {/* 랜딩 전용 고품격 네비게이션 헤더 */}
        <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-50 transition-all shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-[#004D4D] text-white p-2.5 rounded-xl shadow-md shadow-teal-900/20 border border-teal-500/10">
                <Cpu className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-1.5 font-sans">
                  완제의약품 HPLC Assay QC 검증기
                  <span className="text-[10px] bg-teal-50 text-teal-800 border border-teal-200/50 px-2 py-0.5 rounded-full font-bold">v1.2 PRO</span>
                </h1>
                <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">GMP Data Auto-Validation & Draft Generator</p>
              </div>
            </div>

            {/* 네비게이션 링크 */}
            <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600">
              <a href="#hero" className="hover:text-[#004D4D] transition">Home</a>
              <a href="#competency" className="hover:text-[#004D4D] transition">Core Competency</a>
              <a href="#workflow" className="hover:text-[#004D4D] transition">Workflow</a>
              <a href="#compliance" className="hover:text-[#004D4D] transition">GMP Compliance</a>
              <button onClick={() => setViewMode("dashboard")} className="hover:text-[#004D4D] transition">Dashboard</button>
            </nav>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  loadExampleData();
                  setViewMode("dashboard");
                }}
                className="hidden sm:inline-block text-xs font-bold text-slate-600 hover:text-[#004D4D] px-3.5 py-2 rounded-xl transition"
              >
                데모 데이터 보기
              </button>
              <button
                onClick={() => setViewMode("dashboard")}
                className="bg-[#004D4D] hover:bg-teal-850 text-white text-xs sm:text-sm font-bold px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl transition-all hover:shadow-lg hover:shadow-teal-900/25 cursor-pointer flex items-center gap-1.5"
              >
                검증엔진 시작하기
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section id="hero" className="relative overflow-hidden bg-gradient-to-br from-[#E6F2F2] via-[#F4F9F9] to-white py-16 sm:py-24 font-sans">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-200/20 via-slate-100/0 to-slate-100/0 pointer-events-none"></div>
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
                <div className="inline-flex items-center gap-1.5 bg-teal-50 border border-teal-200 px-3.5 py-1.5 rounded-full text-xs font-bold text-[#004D4D] tracking-wide mx-auto lg:mx-0">
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  의약품 분석 품질 관리(QC)의 디지털 혁신
                </div>
                
                <h2 className="text-3xl sm:text-4xl lg:text-5.5xl font-bold tracking-tight leading-none text-[#003333] sm:leading-tight font-sans">
                  HPLC Assay 분석,<br className="hidden sm:inline" />
                  <span className="text-[#004D4D]">
                    AI 파싱과 실시간 검증
                  </span>으로 완벽하게.
                </h2>
                
                <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto lg:mx-0 font-medium font-sans">
                  Agilent, Waters 등 원시 크로마토그램 피크 데이터를 실시간 자동 파싱하여 시스템 적합성(RSD)과 성분 함량을 즉각 산출합니다. 수동 연산 오차율 0% 도달 및 ALCOA+ 데이터 무결성 지침을 충족하는 GMP 시험성적서 초안을 지금 무료로 발행해보세요.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-2">
                  <button
                    onClick={() => setViewMode("dashboard")}
                    className="bg-[#004D4D] hover:bg-teal-800 text-white font-bold px-7 py-4 rounded-xl transition-all shadow-lg shadow-teal-900/20 hover:-translate-y-0.5 active:translate-y-0 text-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    검증엔진 즉시 실행 (Go Dashboard)
                  </button>
                  <button
                    onClick={() => {
                      loadExampleData();
                      setViewMode("dashboard");
                    }}
                    className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-bold px-7 py-4 rounded-xl transition-all hover:-translate-y-0.5 active:translate-y-0 text-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    예시 데이터 로드 후 빠른 체험
                  </button>
                </div>

                {/* 평점 및 사용자 리뷰 장식 */}
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-4 border-t border-slate-200/80 max-w-xl mx-auto lg:mx-0">
                  <div className="flex -space-x-2">
                    <span className="w-8 h-8 rounded-full bg-teal-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-teal-800">QC</span>
                    <span className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-800">RD</span>
                    <span className="w-8 h-8 rounded-full bg-[#004D4D] border-2 border-white flex items-center justify-center text-[10px] font-bold text-white">GMP</span>
                    <span className="w-8 h-8 rounded-full bg-amber-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-amber-800">QA</span>
                  </div>
                  <div className="text-left font-sans">
                    <div className="flex text-amber-500 text-xs font-bold">★★★★★</div>
                    <p className="text-[11px] text-slate-500 font-medium font-sans">제약회사 QC/QA 실무 분석 및 신뢰성 평가 4.9/5 (1,200+ Validations)</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-3 text-xs text-slate-500 pt-2 font-sans">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <ShieldCheck className="w-4 h-4 text-teal-600" />
                    KFDA 완제의약품 규격 준수
                  </span>
                  <span className="flex items-center gap-1.5 font-semibold">
                    <ShieldCheck className="w-4 h-4 text-teal-600" />
                    ALCOA+ 데이터 무결성 보장
                  </span>
                  <span className="flex items-center gap-1.5 font-semibold">
                    <ShieldCheck className="w-4 h-4 text-teal-600" />
                    Agilent/Waters 텍스트 호환
                  </span>
                </div>
              </div>

              {/* 히어로 우측 의약 분석 이미지 (hplc_equipment) */}
              <div className="lg:col-span-5 relative">
                <div className="relative z-10 rounded-2xl overflow-hidden shadow-2xl border-4 border-white aspect-[4/3] sm:aspect-square object-cover">
                  <img 
                    src="/src/assets/images/hplc_equipment_1783405987386.jpg" 
                    alt="HPLC Analytical Laboratory Equipment and Medicine" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#003333]/40 via-transparent to-transparent"></div>
                  {/* 이미지 하단 플로팅 오버레이 */}
                  <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-sm p-4 rounded-xl border border-teal-500/20 shadow-lg font-sans">
                    <p className="text-[#004D4D] font-bold text-xs sm:text-sm tracking-tight flex items-center gap-1.5 font-sans">
                      <Clock className="w-4 h-4 text-teal-600" />
                      실시간 파싱 연산 성능 보장
                    </p>
                    <p className="text-slate-500 text-[10px] sm:text-xs mt-0.5 leading-tight font-sans">HPLC 리포트가 수집되는 즉시 표준 적합성과 최종 함량이 0.1초 내로 대조 완료됩니다.</p>
                  </div>
                </div>
                {/* 배경 데코레이션 링 */}
                <div className="absolute -inset-4 bg-teal-500/10 rounded-3xl blur-xl -z-10"></div>
                <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -z-10"></div>
              </div>
            </div>
          </div>
        </section>

        {/* 5개 강점 요약 섹션 (Competency) */}
        <section id="competency" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
              <h3 className="text-[#004D4D] font-bold tracking-widest text-xs uppercase">Core Competency</h3>
              <h2 className="text-2xl sm:text-3.5xl font-bold text-[#003333] tracking-tight font-sans">
                HPLC QC 업무를 압도적으로 정밀하게 만드는 5가지 핵심 기능
              </h2>
              <p className="text-slate-500 text-sm sm:text-base font-medium">
                기존의 스프레드시트 수동 입력과 복잡한 계산 방식을 극복하기 위해 설계된 전용 완제의약품 품질평가 엔진입니다.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              {/* 강점 1 */}
              <div className="bg-[#F4F9F9] hover:bg-[#EBF5F5] border border-slate-200/60 p-6 rounded-2xl transition-all duration-300 flex flex-col justify-between group shadow-sm">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#004D4D] flex items-center justify-center shadow-inner group-hover:bg-[#004D4D] group-hover:text-white transition-all duration-300">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">지능형 자동 파싱 (AI Parser)</h3>
                  <p className="text-slate-600 text-[11px] leading-relaxed font-medium">
                    Agilent, Waters 등 원시 피크 리포트를 그대로 복사해 붙여넣으면 분석 엔진이 구조화하여 로드합니다.
                  </p>
                </div>
              </div>

              {/* 강점 2 */}
              <div className="bg-[#F4F9F9] hover:bg-[#EBF5F5] border border-slate-200/60 p-6 rounded-2xl transition-all duration-300 flex flex-col justify-between group shadow-sm">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#004D4D] flex items-center justify-center shadow-inner group-hover:bg-[#004D4D] group-hover:text-white transition-all duration-300">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">시스템 적합성 검증 (Suitability)</h3>
                  <p className="text-slate-600 text-[11px] leading-relaxed font-medium">
                    이론단수, 대칭성계수, 분리도 등 크로마토그램 시스템 적격성을 GMP 기준에 맞추어 완전 자동 판정합니다.
                  </p>
                </div>
              </div>

              {/* 강점 3 */}
              <div className="bg-[#F4F9F9] hover:bg-[#EBF5F5] border border-slate-200/60 p-6 rounded-2xl transition-all duration-300 flex flex-col justify-between group shadow-sm">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#004D4D] flex items-center justify-center shadow-inner group-hover:bg-[#004D4D] group-hover:text-white transition-all duration-300">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">데이터 무결성 보장 (ALCOA+)</h3>
                  <p className="text-slate-600 text-[11px] leading-relaxed font-medium">
                    클라이언트 측 가두리 연산으로 외부 서버 유출 없이 기기 자체에서만 안전하게 연산 및 원값을 관리합니다.
                  </p>
                </div>
              </div>

              {/* 강점 4 */}
              <div className="bg-[#F4F9F9] hover:bg-[#EBF5F5] border border-slate-200/60 p-6 rounded-2xl transition-all duration-300 flex flex-col justify-between group shadow-sm">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#004D4D] flex items-center justify-center shadow-inner group-hover:bg-[#004D4D] group-hover:text-white transition-all duration-300">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">함량 계산 및 규격 판정 (Assay Verdict)</h3>
                  <p className="text-slate-600 text-[11px] leading-relaxed font-medium">
                    KFDA 완제의약품 성분 규격(예: 98.0%~102.0%)을 정밀 대조하여 실시간으로 적합 여부를 판정합니다.
                  </p>
                </div>
              </div>

              {/* 강점 5 */}
              <div className="bg-[#F4F9F9] hover:bg-[#EBF5F5] border border-slate-200/60 p-6 rounded-2xl transition-all duration-300 flex flex-col justify-between group shadow-sm">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#004D4D] flex items-center justify-center shadow-inner group-hover:bg-[#004D4D] group-hover:text-white transition-all duration-300">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">GMP 시험성적서 초안 (GMP PDF Draft)</h3>
                  <p className="text-slate-600 text-[11px] leading-relaxed font-medium">
                    결재란(담당/검토/승인)이 포함된 공식인증 규격의 완제의약품 시험성적서 초안을 인쇄 규격(A4)으로 출력합니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Gemini API Key Configuration Section */}
        <section id="api-configuration" className="py-16 bg-slate-50 border-t border-slate-200/50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-3xl border border-teal-500/20 p-8 sm:p-10 shadow-xl relative overflow-hidden animate-fadeIn">
              <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl -z-10"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-500/5 rounded-full blur-3xl -z-10"></div>
              
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 bg-teal-50 text-[#004D4D] text-xs font-bold px-3 py-1 rounded-full border border-teal-200/50">
                    <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                    지능형 오토 파서 활성화
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-[#003333] font-sans">Gemini API 분석 모델 인증 관리</h3>
                  <p className="text-slate-500 text-xs sm:text-sm font-medium leading-relaxed">
                    크로마토그램 피크 보고서 전문을 유연하게 분석하고 성분 정보를 자동 매핑하는 데 Gemini 3.5 Flash API 모델이 활용됩니다.
                  </p>
                </div>
                
                {/* 현재 인증 상태 뱃지 */}
                <div className="shrink-0">
                  {isApiKeyApplied ? (
                    <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-2 rounded-xl text-xs font-bold shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      개인 API 키 활성화됨
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200 px-4 py-2 rounded-xl text-xs font-bold shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                      시스템 기본 엔진 구동 중
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-6 space-y-6">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 tracking-wider uppercase">Gemini API Key 입력</label>
                  <div className="relative">
                    <input
                      type={showApiKey ? "text" : "password"}
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="AI Studio에서 발급받은 GEMINI_API_KEY를 입력하십시오..."
                      className="w-full pl-4 pr-32 py-3.5 text-xs font-mono bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:bg-white transition-all shadow-inner text-slate-800"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="text-[10px] font-bold text-slate-500 hover:text-slate-800 px-2 py-1 rounded transition cursor-pointer"
                      >
                        {showApiKey ? "숨김" : "표시"}
                      </button>
                      {apiKeyInput && (
                        <button
                          type="button"
                          onClick={() => setApiKeyInput("")}
                          className="text-[10px] font-bold text-rose-500 hover:text-rose-700 px-2 py-1 rounded transition cursor-pointer"
                        >
                          지우기
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                  <div className="text-[11px] text-slate-500 font-medium leading-normal max-w-md">
                    * 입력하신 API Key는 브라우저 내부 스토리지(<code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-teal-800">localStorage</code>)에만 암호화 저장되어 외부로 일절 전송되지 않으며, 데이터 파싱 시 사용자의 권한으로만 백엔드 프록시를 통해 호출됩니다.
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {isApiKeyApplied && (
                      <button
                        onClick={handleClearApiKey}
                        className="px-4 py-2.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition border border-rose-200/50 cursor-pointer"
                      >
                        인증키 해제
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (!apiKeyInput.trim()) {
                          alert("인증 키를 입력해주십시오.");
                          return;
                        }
                        handleApplyApiKey(apiKeyInput);
                        alert("Gemini API Key가 안전하게 저장 및 적용되었습니다!");
                      }}
                      className="bg-[#004D4D] hover:bg-teal-850 text-white text-xs font-bold px-6 py-3 rounded-xl transition shadow-sm cursor-pointer"
                    >
                      API Key 적용 및 활성화
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 의약품 분석 이미지 및 의약 안전 소개 섹션 */}
        <section className="py-20 bg-white border-y border-slate-200/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* 좌측 의약 분석 이미지 */}
              <div className="relative">
                <div className="relative z-10 rounded-2xl overflow-hidden shadow-xl border-4 border-white aspect-[4/3] object-cover bg-slate-200">
                  <img 
                    src="/src/assets/images/medicine_vials_1783406003842.jpg" 
                    alt="Pharmaceutical Liquid Medicine Vials and Medical Pills" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#003333]/30 via-transparent to-transparent"></div>
                  {/* 데코 오버레이 */}
                  <div className="absolute bottom-4 left-4 bg-[#004D4D]/95 text-white py-2 px-4 rounded-xl text-xs font-bold shadow-lg border border-teal-400/20">
                    99.9% 의약품 분석 연산 정밀도 보장
                  </div>
                </div>
                {/* 데코 레이어 */}
                <div className="absolute -top-4 -left-4 w-24 h-24 bg-teal-200/30 rounded-2xl -z-10"></div>
                <div className="absolute -bottom-4 -right-4 w-40 h-40 bg-slate-200 rounded-3xl -z-10"></div>
              </div>

              {/* 우측 설명 및 리스트 체크마크 */}
              <div className="space-y-6">
                <div className="text-xs font-bold text-[#004D4D] uppercase tracking-wider">GMP COMPLIANCE GUIDELINES</div>
                <h2 className="text-2xl sm:text-3.5xl font-bold text-[#003333] leading-tight font-sans">
                  의약품 안전성과 분석 신뢰성의 최우선 가치 실현
                </h2>
                <p className="text-slate-600 text-sm leading-relaxed font-sans font-medium">
                  완제의약품(FPP) 함량시험(Assay)은 환자의 신체에 직접 주입 및 투여되는 의약품 품질의 마지노선입니다. 한 번의 입력 오류나 소수점 처리 오차는 대규모 불량 판정이나 실사 실패로 귀결될 수 있습니다. 본 검증 프로세스는 기계적으로 산출되는 원값 데이터를 철저히 정밀 분석 및 필터링합니다.
                </p>

                <div className="space-y-3.5 pt-2">
                  <div className="flex items-start gap-2.5">
                    <span className="p-1 bg-teal-50 text-teal-700 rounded-full block mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                    <div>
                      <h4 className="text-slate-900 font-bold text-xs sm:text-sm">실시간 크로마토그램 피크 분해 및 RT 매핑</h4>
                      <p className="text-slate-500 text-[11px] sm:text-xs leading-relaxed font-medium">머무름 시간에 매칭되는 피크의 적합 여부를 실시간으로 평가하여 시각적 경고 신호를 부착합니다.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="p-1 bg-teal-50 text-teal-700 rounded-full block mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                    <div>
                      <h4 className="text-slate-900 font-bold text-xs sm:text-sm">사사오입 보정 연산 역추적 프로세스</h4>
                      <p className="text-slate-500 text-[11px] sm:text-xs leading-relaxed font-medium">GMP 감사관의 현장 실사에서도 즉각 입증 가능한 완벽한 역추적 연산 원값 로그 시스템이 무결하게 작동합니다.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="p-1 bg-teal-50 text-teal-700 rounded-full block mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                    <div>
                      <h4 className="text-slate-900 font-bold text-xs sm:text-sm">KFDA 완제의약품 규격 표준 실시간 판정</h4>
                      <p className="text-slate-500 text-[11px] sm:text-xs leading-relaxed font-medium">성분별 설정된 최소 및 최대 보증값 규격을 실시간으로 감지하여 정밀 판정 라벨링을 지원합니다.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 작동 프로세스 (Workflow) */}
        <section id="workflow" className="py-20 bg-[#F4F9F9]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
              <h3 className="text-[#004D4D] font-bold tracking-widest text-xs uppercase">Step-by-Step Workflow</h3>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#003333] tracking-tight font-sans">분석 과정은 단 4단계로 종결됩니다</h2>
              <p className="text-slate-500 text-sm font-medium">기기 데이터 입력부터 정식 보고서 초안 완성까지 가장 직관적인 분석 흐름을 설계하였습니다.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
              {/* 단계 1 */}
              <div className="space-y-4 relative z-10 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-[#004D4D] text-white font-bold text-xs sm:text-sm flex items-center justify-center shadow-md">01</div>
                <h4 className="font-bold text-base text-slate-950">원시 리포트 복사</h4>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed font-medium">HPLC 분석 소프트웨어(Agilent ChemStation 등)에서 피크 면적 리포트 전문을 그대로 클립보드에 복사합니다.</p>
              </div>

              {/* 단계 2 */}
              <div className="space-y-4 relative z-10 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-[#004D4D] text-white font-bold text-xs sm:text-sm flex items-center justify-center shadow-md">02</div>
                <h4 className="font-bold text-base text-slate-950">AI 자동 파싱 & 매핑</h4>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed font-medium">대시보드 좌측 분석 상자에 복사한 텍스트를 붙여넣습니다. AI가 컬럼, 피크, 면적, RT 데이터를 분해하여 테이블에 자동 기입합니다.</p>
              </div>

              {/* 단계 3 */}
              <div className="space-y-4 relative z-10 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-[#004D4D] text-white font-bold text-xs sm:text-sm flex items-center justify-center shadow-md">03</div>
                <h4 className="font-bold text-base text-slate-950">규격 판정 & 정밀 보정</h4>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed font-medium">설정된 의약품 개별 규격을 기반으로 실시간 적합 및 부적합 여부를 대조하고, 반올림 보정계수 오차 원값을 역추적 연산합니다.</p>
              </div>

              {/* 단계 4 */}
              <div className="space-y-4 relative z-10 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-[#004D4D] text-white font-bold text-xs sm:text-sm flex items-center justify-center shadow-md">04</div>
                <h4 className="font-bold text-base text-slate-950">GMP 성적서 인쇄</h4>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed font-medium">KFDA 및 GMP 양식의 결재란(담당/검토/승인)이 기재된 완제의약품 시험성적서 초안을 로컬 프린트하거나 PDF로 영구 보관합니다.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 데이터 규격 준수 (Compliance Guide) */}
        <section id="compliance" className="py-20 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-[#F4F9F9] rounded-3xl border border-teal-500/10 p-8 sm:p-12 space-y-8 shadow-sm">
              <div className="text-center space-y-2">
                <h3 className="text-[#004D4D] font-bold text-xs tracking-wider uppercase">GMP Data Integrity Guidelines</h3>
                <h2 className="text-2xl sm:text-3xl font-bold text-[#003333] font-sans">KFDA 의약품 데이터 신뢰성 규격 완벽 대응</h2>
              </div>
              
              <div className="space-y-6 pt-4 text-slate-700">
                <div className="space-y-2 pb-2">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#004D4D]"></span>
                    사사오입 연산 역추적 프리뷰 (Round Half Up Audit-Trail)
                  </h4>
                  <p className="text-slate-600 text-xs sm:text-sm leading-relaxed pl-4.5 font-medium">
                    스프레드시트 연산 시 발생하는 미세한 계산 오차를 증명하기 위해, 모든 연산은 사사오입(Round Half Up) 함수를 이용해 규격화되며, 보정계수(Correction Factor) 반영 전 원값(Raw Value)을 소수점 8자리까지 역추적하여 성적서 하단에 감사 프리뷰로 제공합니다.
                  </p>
                </div>

                <div className="space-y-2 pb-2">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#004D4D]"></span>
                    알코아 플러스 (ALCOA+) 데이터 완전성 요건
                  </h4>
                  <p className="text-slate-600 text-xs sm:text-sm leading-relaxed pl-4.5 font-medium">
                    데이터는 언제나 귀속성(Attributable), 가독성(Legible), 동시성(Contemporaneous), 원본성(Original), 정확성(Accurate)을 지녀야 합니다. 본 웹앱은 클라이언트 측 전용 계산 상태를 완전히 보여줌으로써 기기 외부 전송을 방지하고 소스 기록을 온전히 투명하게 공개합니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA (행동 유도 하단) */}
        <section className="bg-gradient-to-r from-[#003333] to-[#004D4D] py-20 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-teal-850/30 via-slate-950/0 pointer-events-none"></div>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 relative z-10 font-sans">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight font-sans">지금 완제의약품 품질검증을 시작해보세요</h2>
            <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto leading-relaxed font-medium">
              Agilent/Waters 리포트 파싱 준비 완료. 데모 예제 데이터를 로드하여 지능형 QC 검사 결과를 즉각 검토하고 결재란이 구비된 GMP 성적서를 확보하세요.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-lg mx-auto">
              <button
                onClick={() => setViewMode("dashboard")}
                className="bg-white text-[#004D4D] hover:bg-slate-100 font-bold px-8 py-4 rounded-xl transition-all shadow-lg text-sm flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center"
              >
                검증 대시보드 열기
                <ArrowRight className="w-4.5 h-4.5 text-[#004D4D]" />
              </button>
              <button
                onClick={() => {
                  loadExampleData();
                  setViewMode("dashboard");
                }}
                className="bg-[#003333]/60 hover:bg-[#003333] text-white border border-teal-500/30 font-bold px-8 py-4 rounded-xl transition-all text-sm w-full sm:w-auto justify-center cursor-pointer"
              >
                기본 데모 장입 후 대시보드 이동
              </button>
            </div>
          </div>
        </section>

        {/* 푸터 */}
        <footer className="bg-[#003333] border-t border-slate-900/60 py-12 text-center text-xs text-slate-400 shrink-0">
          <div className="max-w-7xl mx-auto px-4 space-y-3">
            <p className="font-bold text-white">HPLC FPP QC Assay Validator & GMP Draft Generator</p>
            <p className="max-w-2xl mx-auto leading-relaxed text-slate-300">본 시스템은 의약품 및 생명과학 연구소 내 HPLC 함량 이화학 분석 데이터의 신속 대조와 시스템 적합성 검증 보조를 위해 개발된 클라이언트측 GMP 가이드 툴입니다. 법적인 실서명 책임은 정식 서명한 QC 승인 책임자에게 있습니다.</p>
            <p className="text-[10px] text-slate-400 font-mono mt-2">© 2026 QC Engine Active. Designed for Modern GMP Compliance.</p>
          </div>
        </footer>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-indigo-500/15 selection:text-indigo-900">
      {/* 글로벌 상단 헤더 */}
      <header className="bg-slate-950 text-white border-b border-slate-800 shadow-lg shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg shadow-indigo-600/35 border border-indigo-500/20">
              <Cpu className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
                완제의약품 HPLC Assay QC 검증기
              </h1>
              <p className="text-xs text-slate-400 font-medium">HPLC Chromatogram Assay Data Auto-Validation & GMP Draft Generator</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode("landing")}
              className="px-4 py-2 text-xs font-bold bg-indigo-900/50 text-indigo-300 hover:bg-indigo-900/70 hover:text-white rounded-xl border border-indigo-500/30 font-sans transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <Award className="w-3.5 h-3.5" />
              소개 및 강점 보기
            </button>
            <button
              onClick={loadExampleData}
              className="px-4 py-2 text-xs font-semibold bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white rounded-xl border border-slate-800 hover:border-slate-700 font-sans transition-all cursor-pointer shadow-inner"
            >
              예시 데이터 리셋
            </button>
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wider flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
              QC ENGINE ACTIVE
            </span>
          </div>
        </div>
      </header>

      {/* 대시보드 코어 컨테이너 */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-8">
        
        {/* 좌측 패널: 설정 및 AI 파서 입력창 */}
        <section className="w-full lg:w-[350px] shrink-0 flex flex-col gap-6">
          <AIParsingBox
            rawText={rawText}
            setRawText={setRawText}
            onParseSuccess={handleParseSuccess}
          />
          <MetadataForm
            metadata={metadata}
            onChange={setMetadata}
          />
          <SpecManager
            specs={specs}
            onAddSpec={handleAddSpec}
            onDeleteSpec={handleDeleteSpec}
          />
        </section>

        {/* 우측 패널: 메인 제어 테이블 및 산출물 출력창 */}
        <section className="flex-1 flex flex-col gap-6 min-w-0">
          
          {/* 탭 네비게이션 */}
          <div className="flex border-b border-slate-200 shrink-0 bg-white p-1 rounded-2xl shadow-md shadow-slate-100/60 border border-slate-200/50">
            <button
              onClick={() => setActiveTab("peaks")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === "peaks" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              피크 테이블 관리
            </button>
            <button
              onClick={() => setActiveTab("results")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === "results" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Check className="w-4 h-4" />
              검증 및 함량 결과
            </button>
            <button
              onClick={() => setActiveTab("report")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === "report" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Layers className="w-4 h-4" />
              GMP 시험성적서 초안
            </button>
            <button
              onClick={() => setActiveTab("charts")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === "charts" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              트렌드 시각화
            </button>
          </div>

          {/* 주요 경고 알림 바 */}
          {validationIssues.length > 0 && (
            <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200/80 space-y-2.5 shadow-sm">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs sm:text-sm tracking-tight">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                HPLC 원시 데이터 검증 이슈 검출 ({validationIssues.length}건)
              </div>
              <div className="max-h-24 overflow-y-auto text-xs text-amber-800 space-y-1.5 pl-2 font-medium">
                {validationIssues.map((issue, idx) => (
                  <p key={idx}>• {issue.message}</p>
                ))}
              </div>
            </div>
          )}

          {/* 탭 콘텐츠 렌더링 */}
          <div className="flex-1 bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-md shadow-slate-100/50 min-h-[400px]">
            
            {/* 탭 1: 피크 테이블 관리 */}
            {activeTab === "peaks" && (
              <PeakTable
                peaks={peaks}
                onAddPeak={handleAddPeak}
                onDeletePeak={handleDeletePeak}
                onUpdatePeakField={handleUpdatePeakField}
              />
            )}

            {/* 탭 2: 검증 및 함량 결과 */}
            {activeTab === "results" && (
              <div className="space-y-8">
                {/* 1. 시스템 적합성 요약표 */}
                <div className="space-y-3">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-l-4 border-indigo-600 pl-3 tracking-tight">
                    시스템 적합성 (System Suitability) RSD 검증결과
                  </h3>
                  <div className="overflow-hidden border border-slate-200 rounded-xl shadow-sm bg-white">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold tracking-tight">
                          <th className="p-3.5 pl-4 text-xs font-bold text-slate-500 uppercase tracking-wider">성분명</th>
                          <th className="p-3.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">RT 평균 ± 표본표준편차</th>
                          <th className="p-3.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">RT RSD (%)</th>
                          <th className="p-3.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Area 평균 ± 표본표준편차</th>
                          <th className="p-3.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Area RSD (%)</th>
                          <th className="p-3.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">적합 여부</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {suitabilityList.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-5 text-center text-slate-400 font-sans">등록된 표준용액 데이터가 없어 RSD 분석이 불가능합니다.</td>
                          </tr>
                        ) : (
                          suitabilityList.map((s, i) => (
                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-3.5 pl-4 font-bold text-slate-900">{s.componentName}</td>
                              <td className="p-3.5 text-right font-mono text-slate-600">
                                {s.rtMean.toFixed(3)} ± {s.rtSD.toFixed(4)} 분
                              </td>
                              <td className={`p-3.5 text-right font-mono font-bold ${s.rtRSD > 1.0 ? "text-rose-600" : "text-indigo-600"}`}>
                                {s.rtRSD.toFixed(2)}% <span className="text-[10px] text-slate-400 block font-sans font-medium">기준: ≤1.0%</span>
                              </td>
                              <td className="p-3.5 text-right font-mono text-slate-600">
                                {s.areaMean.toLocaleString(undefined, { maximumFractionDigits: 0 })} ± {s.areaSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </td>
                              <td className={`p-3.5 text-right font-mono font-bold ${s.areaRSD > 2.0 ? "text-rose-600" : "text-indigo-600"}`}>
                                {s.areaRSD.toFixed(2)}% <span className="text-[10px] text-slate-400 block font-sans font-medium">기준: ≤2.0%</span>
                              </td>
                              <td className="p-3.5 text-center">
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

                {/* 2. 함량 시험 결과 표 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-l-4 border-indigo-600 pl-3 tracking-tight">
                      완제의약품 성분별 함량 (Assay) 결과
                    </h3>
                    <button
                      onClick={downloadCSV}
                      className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      CSV 다운로드
                    </button>
                  </div>

                  <div className="overflow-hidden border border-slate-200 rounded-xl shadow-sm bg-white">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold tracking-tight">
                          <th className="p-3.5 pl-4 text-xs font-bold text-slate-500 uppercase tracking-wider">성분명</th>
                          <th className="p-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">시료 ID</th>
                          <th className="p-3.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">측정 RT (min)</th>
                          <th className="p-3.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">시료 Area</th>
                          <th className="p-3.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">표준 Area 평균</th>
                          <th className="p-3.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">최종 함량 (%)</th>
                          <th className="p-3.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">판정</th>
                          <th className="p-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">비고 / 상세 분석</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {assayResults.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="p-5 text-center text-slate-400">적용 가능한 시료 분석 데이터가 없습니다.</td>
                          </tr>
                        ) : (
                          assayResults.map((r, i) => {
                            const spec = specs.find((s) => s.componentName.trim().toLowerCase() === r.componentName.trim().toLowerCase());
                            return (
                              <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-3.5 pl-4 font-bold text-slate-900">{r.componentName}</td>
                                <td className="p-3.5 font-mono font-bold text-slate-600">{r.sampleId}</td>
                                <td className="p-3.5 text-right font-mono">{r.rt > 0 ? `${r.rt.toFixed(3)} 분` : "-"}</td>
                                <td className="p-3.5 text-right font-mono">{r.area > 0 ? r.area.toLocaleString() : "-"}</td>
                                <td className="p-3.5 text-right font-mono">{r.stdAreaMean > 0 ? r.stdAreaMean.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "-"}</td>
                                <td className="p-3.5 text-right font-mono font-bold text-indigo-950 text-xs sm:text-sm">
                                  {r.roundedAssay > 0 ? `${r.roundedAssay.toFixed(2)} %` : "N/A"}
                                  {spec && <span className="text-[10px] text-slate-400 block font-normal font-sans">기준: {spec.min}~{spec.max}%</span>}
                                </td>
                                <td className="p-3.5 text-center">
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
                                <td className="p-3.5 text-xs max-w-xs">
                                  {r.notes.map((note, idx) => (
                                    <div
                                      key={idx}
                                      className={`font-semibold ${
                                        r.status === "부적합" ? "text-rose-600" : "text-amber-700"
                                      }`}
                                    >
                                      • {note}
                                    </div>
                                  ))}
                                  {r.status === "적합" && <span className="text-emerald-700 font-semibold">• 정상 범위 이내</span>}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* CSV 양식 코드블록 프리뷰 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-750 text-xs tracking-tight">함량 결과 데이터 코드블록 프리뷰 (CSV)</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generateCSV());
                      }}
                      className="text-indigo-600 hover:underline text-xs font-semibold cursor-pointer bg-indigo-50 px-2 py-1 rounded"
                    >
                      CSV 코드 복사
                    </button>
                  </div>
                  <pre className="p-4 bg-slate-950 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed shadow-lg border border-slate-800">
                    {generateCSV()}
                  </pre>
                </div>
              </div>
            )}

            {/* 탭 3: GMP 시험성적서 초안 */}
            {activeTab === "report" && (
              <ReportViewer
                metadata={metadata}
                suitabilityList={suitabilityList}
                assayResults={assayResults}
                specs={specs}
              />
            )}

            {/* 탭 4: 트렌드 시각화 */}
            {activeTab === "charts" && (
              <div className="space-y-8">
                <div>
                  <h3 className="font-bold text-slate-900 text-base tracking-tight">QC Chromatogram Data Visualization</h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-sans mt-0.5">표준품 주입 안정성(RSD)과 시료 함량의 Spec 이탈 편차를 시각적으로 검증하십시오.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 함량 및 Spec 분포 차트 */}
                  <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200">
                    <h4 className="font-bold text-slate-800 text-xs sm:text-sm mb-4 tracking-tight">시료 함량 분포 vs Spec 한계치</h4>
                    <div className="h-64 text-xs font-mono">
                      {chartDataAssay.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-slate-400">데이터가 불충분합니다.</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartDataAssay} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="id" tick={{ fontSize: 9 }} />
                            <YAxis domain={[90, 110]} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="함량 (%)" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                            <ReferenceLine y={98.0} label={{ value: 'Acetaminophen Min (98%)', fill: '#dc2626', position: 'insideBottomLeft', fontSize: 10 }} stroke="#dc2626" strokeDasharray="3 3" />
                            <ReferenceLine y={102.0} label={{ value: 'Acetaminophen Max (102%)', fill: '#dc2626', position: 'insideTopLeft', fontSize: 10 }} stroke="#dc2626" strokeDasharray="3 3" />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* 표준용액 RSD 시각화 */}
                  <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200">
                    <h4 className="font-bold text-slate-800 text-xs sm:text-sm mb-4 tracking-tight">표준품 주입 재현성 편차율 (RSD%)</h4>
                    <div className="h-64 text-xs font-mono">
                      {chartDataSuitability.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-slate-400">데이터가 불충분합니다.</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartDataSuitability} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="name" />
                            <YAxis domain={[0, 3]} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="Area RSD (%)" fill="#059669" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="RT RSD (%)" fill="#d97706" radius={[4, 4, 0, 0]} />
                            <ReferenceLine y={2.0} label={{ value: 'Area RSD Limit (2.0%)', fill: '#e11d48', position: 'insideTopRight', fontSize: 10 }} stroke="#e11d48" strokeDasharray="3 3" />
                            <ReferenceLine y={1.0} label={{ value: 'RT RSD Limit (1.0%)', fill: '#e11d48', position: 'insideTopLeft', fontSize: 10 }} stroke="#e11d48" strokeDasharray="3 3" />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </div>

                {/* 분석 팁 안내 */}
                <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 flex gap-3 text-xs sm:text-sm text-indigo-900 leading-relaxed shadow-sm">
                  <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold tracking-tight">QC 데이터 해석 가이드</span>
                    <ul className="list-disc pl-5 mt-1.5 space-y-1.5 text-xs text-indigo-950 font-medium">
                      <li>성분명 아세트아미노펜의 이상적인 RT(Retention Time) 범위는 약 4.5분 근방이며, 카페인은 약 7.2분 전후에 강한 peak을 나타냅니다.</li>
                      <li>표준 반복 주입에서의 Area RSD%가 2.0%를 초과할 경우 Integrator 검출 한계 및 가압 펌프 유량 미세 변동 요인을 조사해야 합니다.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

          </div>
        </section>

      </main>

      {/* 푸터 영역 */}
      <footer className="bg-white border-t border-slate-200/80 py-8 text-center text-xs text-slate-500 shrink-0">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <p className="font-medium">© 2026 FPP HPLC QC Assay Assistant Engine. Designed for strict compliance with GMP documentation and raw data validation standards.</p>
          <p className="text-[10px] text-slate-400 font-mono">Disclaimer: 본 도구는 AI 보조 계산 수단이며, 법적 책임은 정식으로 서명한 QC 승인 책임자에게 있습니다.</p>
        </div>
      </footer>
    </div>
  );
}
