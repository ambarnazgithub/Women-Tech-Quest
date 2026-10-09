
import { GoogleGenAI } from "@google/genai";

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const getAIClient = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing in .env");
  }

  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
};

const getErrorCode = (error) => {
  const message = String(error?.message || "");

  const status = Number(error?.status || error?.code || 0);

  if ([400, 401, 403, 404, 408, 429, 500, 502, 503, 504].includes(status)) {
    return status;
  }

  if (/RESOURCE_EXHAUSTED|quota/i.test(message)) {
    return 429;
  }

  if (/UNAVAILABLE/i.test(message)) {
    return 503;
  }

  const match = message.match(/\b(400|401|403|404|408|429|500|502|503|504)\b/);

  return match ? Number(match[1]) : status;
};

export async function generateAIResponse(prompt) {
  const ai = getAIClient();

  const primaryModel =
    process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

  const fallbackModels = (
    process.env.GEMINI_FALLBACK_MODELS || ""
  )
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);

  const models = [
    ...new Set([primaryModel, ...fallbackModels]),
  ];

  let lastError;

  for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
    const model = models[modelIndex];
    const isPrimary = modelIndex === 0;

    // Primary model gets one retry.
    // Each fallback model is tried once.
    const maxAttempts = isPrimary ? 2 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(
          `Trying Gemini model: ${model}, attempt ${attempt}/${maxAttempts}`
        );

        const result = await ai.models.generateContent({
          model,
          contents: prompt,
        });

        if (!result.text) {
          throw new Error("Gemini returned an empty response");
        }

        console.log(`Gemini success with model: ${model}`);

        return {
          model,
          text: result.text,
        };
      } catch (error) {
        lastError = error;

        const code = getErrorCode(error);

        console.error(
          `Gemini model ${model} failed with code ${code}:`,
          error.message
        );

        const retryable = [408, 429, 500, 502, 503, 504].includes(code);

        if (retryable && attempt < maxAttempts) {
          const delay = code === 503 ? 1000 : 2000;

          console.log(`Retrying ${model} after ${delay}ms...`);
          await sleep(delay);
          continue;
        }

        // Any failed model moves to the next configured model.
        break;
      }
    }

    if (modelIndex < models.length - 1) {
      console.log(
        `Switching to fallback model: ${models[modelIndex + 1]}`
      );
    }
  }

  throw new Error(
    `All configured Gemini models failed. Last error: ${
      lastError?.message || "Unknown error"
    }`
  );
}