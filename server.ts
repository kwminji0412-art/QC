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
      return res.status(400).json({ error: "분석할 원시 텍스트가 비어 있습니다." });
    }

    let client;
    try {
      client = getGeminiClient(userApiKey);
    } catch (e: any) {
      return res.status(400).json({ 
        error: "Gemini API Key가 구성되지 않았습니다. 랜딩페이지 혹은 API 설정 패널에서 API Key를 입력해주시거나 환경변수(GEMINI_API_KEY)를 설정해주십시오." 
      });
    }

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `다음은 HPLC 시험 분석자가 제공한 크로마토그램 분석 결과 혹은 시험 관련 정보 텍스트입니다.
이 텍스트에서 제품명, 제형, 배치번호, 시험일자, 분석자, 사용장비, 이동상, 파장, 유량, 표준품순도, 표준품Lot, 희석배율 등의 메타데이터와, 각 피크(Peak)의 성분명, RT(분), Area(면적) 값을 추출해주십시오.

[원시 데이터 텍스트]
${rawText}

[지침]
1. 성분명(name)은 대소문자나 띄어쓰기를 표준화하되, 유연물질이나 이성질체로 명시된 명칭은 그대로 분리하여 기록하십시오.
2. 주입 구분(type)은 해당 행이 표준용액(Standard) 계열인지, 시료(Sample) 계열인지 판단하여 "Std" 또는 "Sample"로 기록하십시오.
3. ID(id)는 "Std-1", "Std-2", "Sample-1", "Sample-2" 등으로 고유하게 기재하십시오. 텍스트상 순서나 기재된 기호를 기반으로 정합니다.
4. RT와 Area는 숫자 데이터로 파싱하십시오. 텍스트에서 RT나 Area를 해석할 수 없는 경우, 해당 항목을 제외하지 말고 구체적으로 되묻거나 경고를 주기 위해 누락 없이 구조화해 주십시오. (만약 0이거나 누락인 경우 0으로 두거나 null로 비우고, components에 포함하십시오.)
5. 만약 필수 항목인 성분명, RT, Area 정보가 전혀 없거나 해석이 불가능하다면, JSON의 "parseError" 필드에 무엇이 왜 부족한지 한글로 구체적으로 상세 질문을 작성해 반환하십시오. 예: "Sample-2의 성분 B Area 값이 비어 있습니다. 확인 부탁드립니다."
6. 수치가 제공되지 않은 메타데이터 필드는 빈 문자열("") 혹은 기본값(순도는 100, 희석배율은 1, 칭량값은 0)으로 채우십시오.`,
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

    const parsedData = JSON.parse(response.text || "{}");
    return res.json(parsedData);
  } catch (error: any) {
    console.error("Error parsing HPLC data:", error);
    return res.status(500).json({ error: error.message || "서버에서 데이터를 처리하는 도중 오류가 발생했습니다." });
  }
});

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
