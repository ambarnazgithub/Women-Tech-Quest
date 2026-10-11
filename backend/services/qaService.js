import { QA_SYSTEM } from "../config/prompts.js";
import { parseJson } from "./extractService.js";
import { generateAIResponse } from "./gemini.service.js";

export const FALLBACK = "The bill does not provide enough readable information to answer this question reliably.";

function buildUser(l1, extra, stats, questions) {
  const qids = questions.map((q) => q.id);
  return (
    "BILL DATA (extracted from the bill):\n" + JSON.stringify(l1) +
    "\n\nOTHER PRINTED DATA:\n" + JSON.stringify(extra) +
    "\n\nSTATS (computed by code, reliable):\n" + JSON.stringify(stats) +
    "\n\nQUESTIONS:\n" + JSON.stringify(questions.map((q) => ({ question_id: q.id, question: q.text }))) +
    `\n\nReturn JSON with one key for every question_id (${qids.join(", ")}), each value being the answer string.`
  );
}

const makeValidate = (ids) => (text) => {
  const d = parseJson(text);
  const missing = ids.filter((q) => !String(d[q] ?? "").trim());
  if (missing.length) throw new Error(`missing answers: ${missing}`);
};

/** questions: [{id, text}] -> { [id]: answer } */
export async function answerQuestions(imagePath, billId, l1, extra, stats, questions) {
  const qids = questions.map((q) => q.id);

  try {
    const { text } = await generateAIResponse({
      system: QA_SYSTEM,
      user: buildUser(l1, extra, stats, questions),
      imagePaths: [],
      jsonMode: true,
      validate: makeValidate(qids),
    });
    const d = parseJson(text);
    return Object.fromEntries(qids.map((q) => [q, String(d[q]).trim()]));
  } catch (e) {
    console.error(`[${billId}] batch QA failed (${e.message}); trying one by one`);
  }

  const answers = {};
  for (const q of questions) {
    try {
      const { text } = await generateAIResponse({
        system: QA_SYSTEM,
        user: buildUser(l1, extra, stats, [q]),
        imagePaths: [],
        jsonMode: true,
        validate: makeValidate([q.id]),
      });
      answers[q.id] = String(parseJson(text)[q.id]).trim();
    } catch (e2) {
      console.error(`[${billId}] ${q.id} failed: ${e2.message}`);
      answers[q.id] = FALLBACK;
    }
  }
  return answers;
}