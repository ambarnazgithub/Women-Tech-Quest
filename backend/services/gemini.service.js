import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { config, getModelChain } from "../config/index.js";
import { loadImage } from "./imageService.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let client;
const getAIClient = () => {
  if (!config.apiKey) throw new Error("GEMINI_API_KEY is missing in .env");
  return (client ||= new GoogleGenAI({ apiKey: config.apiKey }));
};

const getErrorCode = (error) => {
  const message = String(error?.message || "");
  const status = Number(error?.status || error?.code || 0);
  if ([400, 401, 403, 404, 408, 429, 500, 502, 503, 504].includes(status)) return status;
  if (/RESOURCE_EXHAUSTED|quota/i.test(message)) return 429;
  if (/UNAVAILABLE/i.test(message)) return 503;
  const match = message.match(/\b(400|401|403|404|408|429|500|502|503|504)\b/);
  return match ? Number(match[1]) : status;
};

/**
 * Calls Gemini (primary model, then fallbacks) with optional images.
 * - validate(text) may throw (e.g. bad JSON) -> counts as a failed attempt and is retried.
 * - Only validated responses are cached, so reruns return identical answers.
 * Returns { model, text }.
 */
export async function generateAIResponse({
  system,
  user,
  imagePaths = [],
  jsonMode = false,
  validate = null,
}) {
  const ai = getAIClient();
  const models = getModelChain();
  const images = await Promise.all(imagePaths.map(loadImage));

  // cache key
  const h = crypto.createHash("sha256");
  for (const p of [models[0], system, user]) h.update(p);
  for (const im of images) h.update(im.data);
  await fs.mkdir(config.cacheDir, { recursive: true });
  const cacheFile = path.join(config.cacheDir, `${h.digest("hex")}.json`);
  try {
    const cached = JSON.parse(await fs.readFile(cacheFile, "utf8"));
    return { model: `${cached.model} (cache)`, text: cached.text };
  } catch { /* cache miss */ }

  const contents = [{
    role: "user",
    parts: [
      ...images.map((im) => ({ inlineData: { mimeType: im.mime, data: im.data.toString("base64") } })),
      { text: user },
    ],
  }];

  let lastError;

  for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
    const model = models[modelIndex];
    const maxAttempts = modelIndex === 0 ? 3 : 2; // primary gets more retries

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`Trying Gemini model: ${model}, attempt ${attempt}/${maxAttempts}`);

        const result = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: system,
            temperature: 0,
            ...(jsonMode ? { responseMimeType: "application/json" } : {}),
          },
        });

        const text = result.text;
        if (!text) throw new Error("Gemini returned an empty response");
        if (validate) validate(text); // throws on bad output

        await fs.writeFile(cacheFile, JSON.stringify({ model, text }), "utf8");
        console.log(`Gemini success with model: ${model}`);
        return { model, text };
      } catch (error) {
        lastError = error;
        const code = getErrorCode(error);
        console.error(`Gemini model ${model} failed with code ${code}:`, error.message);

        const hardFail = [400, 401, 403, 404].includes(code);
        if (!hardFail && attempt < maxAttempts) {
          const delay = (code === 429 ? 5000 : code === 503 ? 1500 : 1000) * attempt;
          console.log(`Retrying ${model} after ${delay}ms...`);
          await sleep(delay);
          continue;
        }
        break; // move to next model
      }
    }

    if (modelIndex < models.length - 1) {
      console.log(`Switching to fallback model: ${models[modelIndex + 1]}`);
    }
  }

  throw new Error(`All configured Gemini models failed. Last error: ${lastError?.message || "Unknown error"}`);
}