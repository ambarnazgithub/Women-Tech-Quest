import fs from "node:fs/promises";
import path from "node:path";
import { config, getModelChain } from "../config/index.js";
import { extractBill } from "./extractService.js";
import { computeStats } from "./statsService.js";
import { answerQuestions, FALLBACK } from "./qaService.js";
import { emptyLevel1 } from "../models/billModel.js";
import { readCsv, writeCsv } from "./csvService.js";

const IMG_EXT = [".png", ".jpg", ".jpeg", ".PNG", ".JPG", ".JPEG"];

// Used only by --dev (questions, NOT answers) so you can test before the real questions arrive.
export const DEV_QUESTIONS = [
  "How much of my bill is taxes?",
  "How many months in my history went above 200 units?",
  "What is the average units consumed per month in my usage history?",
  "How much extra do I pay if I miss the due date?",
  "Which charge is the biggest part of my bill and why?",
  "Is my consumption this month higher or lower than my usual? By how much?",
  "What is my average cost per unit this month?",
  "Explain my bill in simple words.",
  "Do I have any arrears or credit carried forward?",
  "What is my sanctioned load and tariff?",
  "What is the due date and how many days after the issue date is it?",
  "If my usage rose by 10% next month, roughly how many units would I use?",
];

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function findImage(dir, billId) {
  for (const ext of IMG_EXT) {
    const p = path.join(dir, billId + ext);
    try { await fs.access(p); return p; } catch { /* try next */ }
  }
  return null;
}

export async function processBill(billsDir, billId, questions) {
  const fallbackAnswers = () => Object.fromEntries(questions.map((q) => [q.id, FALLBACK]));
  const imagePath = await findImage(billsDir, billId);
  if (!imagePath) {
    console.error(`[${billId}] image not found`);
    return { l1: emptyLevel1(billId), answers: fallbackAnswers() };
  }
  try {
    const { l1, extra } = await extractBill(imagePath, billId);
    const stats = computeStats(l1, extra);
    const answers = await answerQuestions(imagePath, billId, l1, extra, stats, questions);
    console.log(`[${billId}] done`);
    return { l1, answers };
  } catch (e) {
    console.error(`[${billId}] failed: ${e.message}`);
    return { l1: emptyLevel1(billId), answers: fallbackAnswers() };
  }
}

export async function runBatch({ billsDir, csvDir, outDir, dev }) {
  const models = getModelChain(); // also validates allowed models
  let f1 = ["bill_id", "json"], f2 = ["bill_id", "question_id", "question", "answer"];
  let rows1, rows2;

  if (dev || !csvDir) {
    const files = await fs.readdir(billsDir);
    const ids = files.filter((f) => IMG_EXT.includes(path.extname(f))).map((f) => path.parse(f).name).sort();
    rows1 = ids.map((b) => ({ bill_id: b, json: "" }));
    rows2 = ids.flatMap((b) =>
      DEV_QUESTIONS.map((q, i) => ({ bill_id: b, question_id: `Q${i + 1}`, question: q, answer: "" })));
  } else {
    ({ fields: f1, rows: rows1 } = await readCsv(path.join(csvDir, "level1.csv")));
    ({ fields: f2, rows: rows2 } = await readCsv(path.join(csvDir, "level2.csv")));
  }

  const qsByBill = {};
  for (const r of rows2) (qsByBill[r.bill_id] ||= []).push({ id: r.question_id, text: r.question });

  const ids = rows1.map((r) => r.bill_id);
  console.log(`Models: ${models.join(" -> ")} | bills=${ids.length}`);

  const results = await mapLimit(ids, config.maxWorkers, (b) => processBill(billsDir, b, qsByBill[b] || []));
  const byId = Object.fromEntries(ids.map((b, i) => [b, results[i]]));

  for (const r of rows1) r.json = JSON.stringify(byId[r.bill_id].l1); // single line
  for (const r of rows2) r.answer = byId[r.bill_id].answers[r.question_id] ?? FALLBACK;

  await writeCsv(path.join(outDir, "level1.csv"), f1, rows1);
  await writeCsv(path.join(outDir, "level2.csv"), f2, rows2);
  console.log(`Wrote ${path.join(outDir, "level1.csv")} and ${path.join(outDir, "level2.csv")}`);
}