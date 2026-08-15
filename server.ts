import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Initialize Gemini Client safely
let ai: GoogleGenAI | null = null;
function getGeminiClient(userApiKey?: string): GoogleGenAI {
  const apiKey = userApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required or custom key must be supplied");
  }
  // If user passed a custom key, always instantiate a fresh client with their key.
  // Otherwise, use cached global client to save overhead.
  if (userApiKey) {
    return new GoogleGenAI({
      apiKey: userApiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build-custom",
        },
      },
    });
  }

  if (!ai) {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return ai;
}

// AI Parse HPLC endpoint
app.post("/api/parse-hplc", async (req, res) => {
  try {
    const { rawText, userApiKey } = req.body;
    if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
      return res.status(400).json({ error: "분석할 Raw Data 텍스트가 비어 있습니다." });
    }

    let client: GoogleGenAI | null = null;
    try {
      client = getGeminiClient(userApiKey);
    } catch (e: any) {
      console.warn("Gemini API Client initialization skipped, falling back to local HPLC parser:", e.message);
    }

    if (client) {
      try {
        const response = await client.models.generateContent({
          model: "gemini-3.6-flash",
          contents: `다음은 HPLC 시험 분석자가 제공한 크로마토그램 분석 결과 혹은 시험 관련 정보 텍스트입니다.
이 텍스트에서 제품명, 제형, 배치번호, 시험일자, 분석자, 사용장비, 이동상, 파장, 유량, 표준품순도, 표준품Lot, 희석배율 등의 메타데이터와, 각 피크(Peak)의 성분명, RT(분), Area(면적) 값을 추출해주십시오.

[Raw Data 텍스트]
${rawText}

[지침]
1. 성분명(name)은 대소문자나 띄어쓰기를 표준화하되, 유연물질이나 이성질체로 명시된 명칭은 그대로 분리하여 기록하십시오.
2. 주입 구분(type)은 해당 행이 표준용액(Standard) 계열인지, 시료(Sample) 계열인지 판단하여 "Std" 또는 "Sample"로 기록하십시오.
3. ID(id)는 "Std-1", "Std-2", "Sample-1", "Sample-2" 등으로 고유하게 기재하십시오. 텍스트상 순서나 기재된 기호를 기반으로 정합니다.
4. RT와 Area는 숫자 데이터로 파싱하십시오. 텍스트에서 RT나 Area를 해석할 수 없는 경우 0으로 처리하거나 추정 가능하면 수치로 변환하십시오.
5. Agilent, Waters Empower, Shimadzu, CSV/Excel 텍스트, 자유 양식 등 다양한 HPLC 리포트 양식을 지원하도록 정밀하게 파싱하십시오.
6. 만약 필수 항목인 성분명, RT, Area 정보가 전혀 없거나 해석이 불가능하다면, parseError 필드에 보완 요청 메시지를 한글로 작성해 반환하십시오.
`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                parseError: {
                  type: Type.STRING,
                  description: "필수 항목(성분명/RT/Area) 누락 또는 해석 불가 시 구체적인 보완 요구 메시지. 이상이 없다면 빈 문자열.",
                },
                metadata: {
                  type: Type.OBJECT,
                  properties: {
                    productName: { type: Type.STRING, description: "제품명" },
                    formulation: { type: Type.STRING, description: "제형 (정제, 캡슐 등)" },
                    batchNumber: { type: Type.STRING, description: "배치(Lot) 번호" },
                    testDate: { type: Type.STRING, description: "시험일자 (YYYY-MM-DD 등)" },
                    analyst: { type: Type.STRING, description: "분석자" },
                    instrument: { type: Type.STRING, description: "사용 장비 / 컬럼 정보" },
                    mobilePhase: { type: Type.STRING, description: "이동상 정보" },
                    wavelength: { type: Type.STRING, description: "측정 파장 (nm)" },
                    flowRate: { type: Type.STRING, description: "유량 (mL/min)" },
                    stdPurity: { type: Type.NUMBER, description: "표준품 순도 (역가, %)" },
                    stdLot: { type: Type.STRING, description: "표준품 Lot 번호" },
                    stdWeight: { type: Type.NUMBER, description: "표준품 칭량값 (mg)" },
                    sampleWeight: { type: Type.NUMBER, description: "시료 칭량값 (mg)" },
                    stdDilution: { type: Type.NUMBER, description: "표준품 희석배율 (예: 100)" },
                    sampleDilution: { type: Type.NUMBER, description: "시료 희석배율 (예: 100)" },
                  },
                },
                components: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING, description: "성분명" },
                      type: { type: Type.STRING, description: "Std 또는 Sample" },
                      id: { type: Type.STRING, description: "Std-1, Std-2, Sample-1, Sample-2 등 고유 식별자" },
                      rt: { type: Type.NUMBER, description: "RT (retention time, 분 단위 실수)" },
                      area: { type: Type.NUMBER, description: "Area (피크 면적 정수 또는 실수)" },
                    },
                    required: ["name", "type", "id", "rt", "area"],
                  },
                },
              },
            },
          },
        });

        let responseText = response.text || "{}";
        if (responseText.includes("```")) {
          responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
        }

        const parsedData = JSON.parse(responseText);
        if (parsedData && (parsedData.components?.length > 0 || parsedData.metadata)) {
          return res.json(parsedData);
        }
      } catch (geminiErr: any) {
        console.error("Gemini API call error, falling back to local parser:", geminiErr.message || geminiErr);
      }
    }

    // Fallback parser if Gemini API call fails or is not configured
    const fallbackResult = parseHPLCFallback(rawText);
    return res.json(fallbackResult);
  } catch (error: any) {
    console.error("Error parsing HPLC data:", error);
    // Use fallback parser even on catastrophic error
    try {
      const fallbackResult = parseHPLCFallback(req.body?.rawText || "");
      return res.json(fallbackResult);
    } catch {
      return res.status(500).json({ error: error.message || "서버에서 데이터를 처리하는 도중 오류가 발생했습니다." });
    }
  }
});

// Fallback rule-based HPLC parser
function parseHPLCFallback(rawText: string) {
  const metadata: Record<string, any> = {
    productName: "",
    formulation: "",
    batchNumber: "",
    testDate: "",
    analyst: "",
    instrument: "",
    mobilePhase: "",
    wavelength: "",
    flowRate: "",
    stdPurity: 100,
    stdLot: "",
    stdWeight: 0,
    sampleWeight: 0,
    stdDilution: 100,
    sampleDilution: 100,
  };

  const lines = rawText.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/Product|제품명|품명/i.test(trimmed)) {
      const match = trimmed.match(/(?:Product|제품명|품명)\s*[:=]\s*(.+)/i);
      if (match) metadata.productName = match[1].trim();
    }
    if (/Lot|Batch|배치번호|배치/i.test(trimmed)) {
      const match = trimmed.match(/(?:Lot|Batch|Lot No|배치번호|배치)\s*[:=]\s*(.+)/i);
      if (match) metadata.batchNumber = match[1].trim();
    }
    if (/Test Date|Date|시험일자|시험일/i.test(trimmed)) {
      const match = trimmed.match(/(?:Test Date|Date|시험일자|시험일)\s*[:=]\s*(.+)/i);
      if (match) metadata.testDate = match[1].trim();
    }
    if (/Analyst|분석자|시험자/i.test(trimmed)) {
      const match = trimmed.match(/(?:Analyst|분석자|시험자)\s*[:=]\s*(.+)/i);
      if (match) metadata.analyst = match[1].trim();
    }
    if (/Instrument|Column|사용장비|장비|컬럼/i.test(trimmed)) {
      const match = trimmed.match(/(?:Instrument|Column|사용장비|장비|컬럼)\s*[:=]\s*(.+)/i);
      if (match) metadata.instrument = match[1].trim();
    }
    if (/Mobile Phase|이동상/i.test(trimmed)) {
      const match = trimmed.match(/(?:Mobile Phase|이동상)\s*[:=]\s*(.+)/i);
      if (match) metadata.mobilePhase = match[1].trim();
    }
    if (/Wavelength|파장/i.test(trimmed)) {
      const match = trimmed.match(/(?:Wavelength|파장)\s*[:=]\s*(.+)/i);
      if (match) metadata.wavelength = match[1].trim();
    }
    if (/Flow|유량/i.test(trimmed)) {
      const match = trimmed.match(/(?:Flow|유량)\s*[:=]\s*(.+)/i);
      if (match) metadata.flowRate = match[1].trim();
    }
    if (/Purity|순도/i.test(trimmed)) {
      const match = trimmed.match(/(?:Purity|순도)\s*[:=]?\s*([\d.]+)/i);
      if (match) metadata.stdPurity = parseFloat(match[1]) || 100;
    }
    if (/Std Weight|표준품 칭량|Std Wt/i.test(trimmed)) {
      const match = trimmed.match(/(?:Std Weight|표준품 칭량|Std Wt)\s*[:=]?\s*([\d.]+)/i);
      if (match) metadata.stdWeight = parseFloat(match[1]) || 0;
    }
    if (/Sample Weight|시료 칭량|Sample Wt/i.test(trimmed)) {
      const match = trimmed.match(/(?:Sample Weight|시료 칭량|Sample Wt)\s*[:=]?\s*([\d.]+)/i);
      if (match) metadata.sampleWeight = parseFloat(match[1]) || 0;
    }
    if (/Std Dilution|표준품 희석/i.test(trimmed)) {
      const match = trimmed.match(/(?:Std Dilution|표준품 희석)\s*[:=]?\s*([\d.]+)/i);
      if (match) metadata.stdDilution = parseFloat(match[1]) || 100;
    }
    if (/Sample Dilution|시료 희석/i.test(trimmed)) {
      const match = trimmed.match(/(?:Sample Dilution|시료 희석)\s*[:=]?\s*([\d.]+)/i);
      if (match) metadata.sampleDilution = parseFloat(match[1]) || 100;
    }
  }

  const components: Array<{ name: string; type: string; id: string; rt: number; area: number }> = [];
  let currentType = "Sample";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/Standard|Std|표준/i.test(trimmed) && /Inj|Run|주입|표준용액/i.test(trimmed)) {
      currentType = "Std";
    } else if (/Sample|시료/i.test(trimmed) && /Inj|Run|주입/i.test(trimmed)) {
      currentType = "Sample";
    }

    // Pattern 1: Peak X: RT 4.512 min, Area 1254320, Component: 아세트아미노펜
    const match1 = trimmed.match(/Peak\s*\d+\s*:\s*RT\s*([\d.]+)[^,]*,\s*Area\s*([\d.]+)[^,]*,\s*(?:Component|성분명|성분)\s*:\s*(.+)/i);
    if (match1) {
      const rt = parseFloat(match1[1]) || 0;
      const area = parseFloat(patternToNumber(match1[2])) || 0;
      const name = match1[3].trim();
      const count = components.filter(c => c.type === currentType).length + 1;
      components.push({ name, type: currentType, id: `${currentType}-${count}`, rt, area });
      continue;
    }

    // Pattern 2: Tab/Comma/Space separated columns like "아세트아미노펜, Std-1, 4.512, 1254320" or "아세트아미노펜  4.512  1254320"
    const parts = trimmed.split(/[\t,;|]/).map(p => p.trim()).filter(Boolean);
    if (parts.length >= 3) {
      const nums = parts.map(p => parseFloat(patternToNumber(p))).filter(n => !isNaN(n));
      const textParts = parts.filter(p => isNaN(parseFloat(patternToNumber(p))));

      if (nums.length >= 2 && textParts.length >= 1) {
        const name = textParts[0];
        const rt = Math.min(...nums);
        const area = Math.max(...nums);
        if (rt >= 0 && rt < 300 && area > 0) {
          const type = /std|표준/i.test(trimmed) ? "Std" : currentType;
          const count = components.filter(c => c.type === type).length + 1;
          components.push({ name, type, id: `${type}-${count}`, rt, area });
        }
      }
    }
  }

  return {
    metadata,
    components,
    parseError: components.length === 0 ? "입력된 텍스트에서 HPLC 피크 수치를 자동으로 분계하지 못했습니다. 수동 입력을 진행하거나 예시 템플릿 형식을 참고해 주십시오." : "",
  };
}

function patternToNumber(str: string): string {
  return str.replace(/,/g, "").trim();
}

// Vite/Static asset serving setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
