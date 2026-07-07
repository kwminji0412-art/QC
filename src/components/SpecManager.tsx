/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Layers, Trash2 } from "lucide-react";
import { SpecRange } from "../types";

interface SpecManagerProps {
  specs: SpecRange[];
  onAddSpec: (spec: SpecRange) => void;
  onDeleteSpec: (compName: string) => void;
}

export default function SpecManager({ specs, onAddSpec, onDeleteSpec }: SpecManagerProps) {
  const [newSpec, setNewSpec] = useState<SpecRange>({
    componentName: "신규성분",
    min: 95.0,
    max: 105.0,
  });

  const handleAdd = () => {
    if (!newSpec.componentName.trim()) return;
    onAddSpec(newSpec);
    setNewSpec({
      componentName: "",
      min: 98.0,
      max: 102.0,
    });
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-md shadow-slate-100/50 space-y-5">
      <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3.5 tracking-tight">
        <span className="p-1 bg-teal-50 rounded-lg text-teal-700 block">
          <Layers className="w-4 h-4" />
        </span>
        성분 규격 기준 (Spec Range) 관리
      </h2>
      
      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {specs.map((s, i) => (
          <div key={i} className="flex items-center justify-between bg-slate-50/70 p-3 rounded-xl border border-slate-200/50 text-xs hover:border-slate-300 transition-colors">
            <div className="space-y-0.5">
              <span className="font-bold text-slate-800 text-xs block">{s.componentName}</span>
              <span className="text-slate-500 font-medium font-mono text-[11px] block">
                Spec 범위: {s.min.toFixed(2)}% ~ {s.max.toFixed(2)}%
              </span>
            </div>
            <button
              onClick={() => onDeleteSpec(s.componentName)}
              className="text-slate-400 hover:text-rose-600 p-2 rounded-lg hover:bg-rose-50 hover:border-rose-100 border border-transparent transition-all cursor-pointer"
            >
              <Trash2 className="w-4.5 h-4.5" />
            </button>
          </div>
        ))}
      </div>
      
      {/* 스펙 추가 폼 */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3.5 text-xs">
        <h3 className="font-bold text-slate-700 tracking-tight text-xs flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-teal-600 rounded-full"></span>
          규격 신규 등록
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <label className="text-slate-500 font-semibold">성분명</label>
            <input
              type="text"
              value={newSpec.componentName}
              onChange={(e) => setNewSpec({ ...newSpec, componentName: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium text-slate-800 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-slate-500 font-semibold">하한 (%)</label>
            <input
              type="number"
              step="0.01"
              value={newSpec.min}
              onChange={(e) => setNewSpec({ ...newSpec, min: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-slate-500 font-semibold">상한 (%)</label>
            <input
              type="number"
              step="0.01"
              value={newSpec.max}
              onChange={(e) => setNewSpec({ ...newSpec, max: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-xs"
            />
          </div>
        </div>
        <button
          onClick={handleAdd}
          className="w-full bg-slate-900 hover:bg-slate-800 active:bg-black text-white font-semibold py-2.5 rounded-lg transition-all text-xs shadow-sm cursor-pointer"
        >
          규격 기준 등록 및 갱신
        </button>
      </div>
    </div>
  );
}
