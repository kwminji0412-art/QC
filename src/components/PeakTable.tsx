/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PeakEntry } from "../types";

interface PeakTableProps {
  peaks: PeakEntry[];
  onAddPeak: (peak: Omit<PeakEntry, "id">) => void;
  onDeletePeak: (id: string) => void;
  onUpdatePeakField: (id: string, field: keyof PeakEntry, value: any) => void;
}

export default function PeakTable({ peaks, onAddPeak, onDeletePeak, onUpdatePeakField }: PeakTableProps) {
  const [newPeak, setNewPeak] = useState<Omit<PeakEntry, "id">>({
    name: "아세트아미노펜",
    type: "Sample",
    rt: 4.5,
    area: 1200000,
  });

  const handleAdd = () => {
    if (!newPeak.name.trim()) return;
    onAddPeak(newPeak);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="font-bold text-slate-900 text-base tracking-tight">HPLC Injection Peak Entry Spreadsheet</h3>
          <p className="text-xs text-slate-500 leading-relaxed font-sans mt-0.5">
            각 성분별 주입순서에 매칭되는 RT와 Area 값을 실시간으로 관리하십시오. 각 셀은 그리드 상에서 직접 즉시 수정할 수 있습니다.
          </p>
        </div>
      </div>

      <div className="overflow-hidden border border-slate-200 rounded-xl shadow-sm bg-white">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold tracking-tight">
              <th className="p-3.5 pl-4 text-xs font-bold text-slate-500 uppercase tracking-wider">주입 ID</th>
              <th className="p-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">성분명</th>
              <th className="p-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">구분 (Std/Sample)</th>
              <th className="p-3.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Retention Time (min)</th>
              <th className="p-3.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Integrator Area</th>
              <th className="p-3.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {peaks.map((p) => {
              const isInvalidArea = p.area <= 0;
              const isInvalidRT = p.rt <= 0;
              const isStd = p.type === "Std";
              return (
                <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3.5 pl-4 font-mono font-bold text-indigo-950 text-xs sm:text-sm">
                    {p.id}
                  </td>
                  <td className="p-3.5">
                    <input
                      type="text"
                      value={p.name}
                      onChange={(e) => onUpdatePeakField(p.id, "name", e.target.value)}
                      className="w-full bg-transparent font-semibold text-slate-900 border border-transparent hover:border-slate-300/80 focus:border-teal-500 focus:bg-white rounded-md transition-all px-2.5 py-1.5 focus:outline-none text-xs sm:text-sm"
                    />
                  </td>
                  <td className="p-3.5">
                    <span className="relative inline-block w-36">
                      <select
                        value={p.type}
                        onChange={(e) => onUpdatePeakField(p.id, "type", e.target.value)}
                        className={`w-full appearance-none border rounded-lg pl-3 pr-8 py-1.5 text-xs font-semibold cursor-pointer focus:outline-none focus:ring-1 focus:ring-teal-500 transition-colors ${
                          isStd
                            ? "bg-violet-50/50 text-violet-700 border-violet-200 hover:bg-violet-50"
                            : "bg-teal-50/50 text-teal-700 border-teal-200 hover:bg-teal-50"
                        }`}
                      >
                        <option value="Std">표준용액 (Std)</option>
                        <option value="Sample">시료용액 (Sample)</option>
                      </select>
                      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-500">
                        ▼
                      </span>
                    </span>
                  </td>
                  <td className={`p-3.5 text-right font-mono ${isInvalidRT ? "bg-rose-50/40" : ""}`}>
                    <div className="inline-flex flex-col items-end">
                      <input
                        type="number"
                        step="0.001"
                        value={p.rt}
                        onChange={(e) => onUpdatePeakField(p.id, "rt", e.target.value)}
                        className="w-24 text-right bg-transparent font-bold text-slate-800 border border-transparent hover:border-slate-300/80 focus:border-teal-500 focus:bg-white rounded-md transition-all px-2.5 py-1.5 focus:outline-none font-mono text-xs sm:text-sm"
                      />
                      {isInvalidRT && (
                        <span className="text-[10px] text-rose-600 font-semibold mt-1 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                          검출 시간 오류의심
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={`p-3.5 text-right font-mono ${isInvalidArea ? "bg-rose-50/40" : ""}`}>
                    <div className="inline-flex flex-col items-end">
                      <input
                        type="number"
                        value={p.area}
                        onChange={(e) => onUpdatePeakField(p.id, "area", e.target.value)}
                        className="w-32 text-right bg-transparent font-bold text-slate-800 border border-transparent hover:border-slate-300/80 focus:border-teal-500 focus:bg-white rounded-md transition-all px-2.5 py-1.5 focus:outline-none font-mono text-xs sm:text-sm"
                      />
                      {isInvalidArea && (
                        <span className="text-[10px] text-rose-600 font-semibold mt-1 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                          피크면적(Area) 누락
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3.5 text-center">
                    <button
                      onClick={() => onDeletePeak(p.id)}
                      className="text-slate-400 hover:text-rose-600 p-2 rounded-lg hover:bg-rose-50 hover:border-rose-100 border border-transparent transition-all cursor-pointer"
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 신규 피크 수동 등록 바 */}
      <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs">
        <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
          <span className="p-1 bg-teal-50 rounded-lg text-teal-700 block">
            <Plus className="w-4.5 h-4.5" />
          </span>
          수동 분석 피크행 (Peak Row) 추가
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-slate-500 font-semibold">성분명</label>
            <input
              type="text"
              value={newPeak.name}
              onChange={(e) => setNewPeak({ ...newPeak, name: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-medium text-slate-800 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-slate-500 font-semibold">구분</label>
            <div className="relative">
              <select
                value={newPeak.type}
                onChange={(e) => setNewPeak({ ...newPeak, type: e.target.value as "Std" | "Sample" })}
                className="w-full appearance-none px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-semibold text-slate-700 text-xs"
              >
                <option value="Std">표준용액 (Std)</option>
                <option value="Sample">시료용액 (Sample)</option>
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500">
                ▼
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-slate-500 font-semibold">RT (min)</label>
            <input
              type="number"
              step="0.001"
              value={newPeak.rt}
              onChange={(e) => setNewPeak({ ...newPeak, rt: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-slate-500 font-semibold">Integrator Area</label>
            <input
              type="number"
              value={newPeak.area}
              onChange={(e) => setNewPeak({ ...newPeak, area: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-xs"
            />
          </div>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center justify-center gap-1.5 w-full bg-slate-900 hover:bg-slate-800 active:bg-black text-white font-semibold py-3 rounded-lg transition-all mt-2 text-xs shadow-sm cursor-pointer"
        >
          <Plus className="w-4.5 h-4.5" />
          새 피크 항목 테이블에 주입
        </button>
      </div>
    </div>
  );
}
