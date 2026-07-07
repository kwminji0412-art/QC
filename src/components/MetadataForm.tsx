/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Settings } from "lucide-react";
import { HPLCMetadata } from "../types";

interface MetadataFormProps {
  metadata: HPLCMetadata;
  onChange: (metadata: HPLCMetadata) => void;
}

export default function MetadataForm({ metadata, onChange }: MetadataFormProps) {
  const updateField = (field: keyof HPLCMetadata, value: any) => {
    onChange({
      ...metadata,
      [field]: value,
    });
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-md shadow-slate-100/50 space-y-5">
      <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3.5 tracking-tight">
        <span className="p-1 bg-slate-50 rounded-lg text-slate-600 block">
          <Settings className="w-4 h-4" />
        </span>
        HPLC 분석 메타데이터 관리
      </h2>
      
      <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-xs">
        <div className="space-y-1.5col-span-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-500 font-semibold">제품명</label>
              <input
                type="text"
                value={metadata.productName}
                onChange={(e) => updateField("productName", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-slate-50/50 focus:bg-white transition-all font-medium text-slate-800 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-500 font-semibold">제형</label>
              <input
                type="text"
                value={metadata.formulation}
                onChange={(e) => updateField("formulation", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-slate-50/50 focus:bg-white transition-all font-medium text-slate-800 text-xs"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-slate-500 font-semibold">배치(Lot) 번호</label>
          <input
            type="text"
            value={metadata.batchNumber}
            onChange={(e) => updateField("batchNumber", e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-slate-50/50 focus:bg-white transition-all font-semibold font-mono text-slate-800 text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-slate-500 font-semibold">시험일자</label>
          <input
            type="date"
            value={metadata.testDate}
            onChange={(e) => updateField("testDate", e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-slate-50/50 focus:bg-white transition-all font-mono text-slate-800 text-xs"
          />
        </div>
        <div className="col-span-2 space-y-1">
          <label className="text-slate-500 font-semibold">분석 장비 / 컬럼 정보</label>
          <input
            type="text"
            value={metadata.instrument}
            onChange={(e) => updateField("instrument", e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-slate-50/50 focus:bg-white transition-all text-slate-700 text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-slate-500 font-semibold">분석 담당자</label>
          <input
            type="text"
            value={metadata.analyst}
            onChange={(e) => updateField("analyst", e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-slate-50/50 focus:bg-white transition-all font-medium text-slate-800 text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-slate-500 font-semibold">측정 파장 (nm)</label>
          <input
            type="text"
            value={metadata.wavelength}
            onChange={(e) => updateField("wavelength", e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-slate-50/50 focus:bg-white transition-all font-mono font-semibold text-slate-800 text-xs"
          />
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4 space-y-3">
        <h3 className="font-bold text-slate-800 text-xs tracking-tight flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-teal-600 rounded-full"></span>
          표준품 순도 및 칭량 보정
        </h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
          <div className="space-y-1">
            <label className="text-slate-500 font-semibold">표준품 순도 (%)</label>
            <input
              type="number"
              step="0.01"
              value={metadata.stdPurity}
              onChange={(e) => updateField("stdPurity", parseFloat(e.target.value) || 100)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-slate-50/50 focus:bg-white transition-all font-mono font-semibold text-slate-800 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-slate-500 font-semibold">표준품 Lot</label>
            <input
              type="text"
              value={metadata.stdLot}
              onChange={(e) => updateField("stdLot", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-slate-50/50 focus:bg-white transition-all text-slate-800 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-slate-500 font-semibold">Std 칭량 (mg)</label>
            <input
              type="number"
              step="0.1"
              value={metadata.stdWeight}
              onChange={(e) => updateField("stdWeight", parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-slate-50/50 focus:bg-white transition-all font-mono text-slate-800 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-slate-500 font-semibold">시료 칭량 (mg)</label>
            <input
              type="number"
              step="0.1"
              value={metadata.sampleWeight}
              onChange={(e) => updateField("sampleWeight", parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-slate-50/50 focus:bg-white transition-all font-mono text-slate-800 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-slate-500 font-semibold">Std 희석배율</label>
            <input
              type="number"
              value={metadata.stdDilution}
              onChange={(e) => updateField("stdDilution", parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-slate-50/50 focus:bg-white transition-all font-mono text-slate-800 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-slate-500 font-semibold">시료 희석배율</label>
            <input
              type="number"
              value={metadata.sampleDilution}
              onChange={(e) => updateField("sampleDilution", parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-slate-50/50 focus:bg-white transition-all font-mono text-slate-800 text-xs"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
