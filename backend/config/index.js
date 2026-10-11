import "dotenv/config";
import path from "node:path";

// Only these models are allowed by the competition rules.
export const ALLOWED_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];

export const config = {
  apiKey: (process.env.GEMINI_API_KEY || "").trim(),
  primaryModel: (process.env.GEMINI_MODEL || "gemini-3.5-flash-lite").trim(),
  fallbackModels: (process.env.GEMINI_FALLBACK_MODELS || "")
    .split(",").map((m) => m.trim()).filter(Boolean),
  maxWorkers: Number(process.env.MAX_WORKERS || 3),
  cacheDir: path.resolve(process.env.CACHE_DIR || ".cache"),
};

/** Primary model first, then fallbacks (deduplicated). Throws if a model is not allowed. */
export function getModelChain() {
  const chain = [...new Set([config.primaryModel, ...config.fallbackModels])];
  const bad = chain.filter((m) => !ALLOWED_MODELS.includes(m));
  if (bad.length) {
    throw new Error(`Model not allowed by competition rules: ${bad.join(", ")}. Allowed: ${ALLOWED_MODELS.join(", ")}`);
  }
  return chain;
}