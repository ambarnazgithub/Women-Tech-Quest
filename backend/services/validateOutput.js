// node scripts/validateOutput.js ../output [expectedBills=10] [expectedQuestions=12]
import path from "node:path";
import { readCsv } from "../services/csvService.js";
import { L1_KEYS } from "../models/billModel.js";

const dir = path.resolve(process.argv[2] || "../output");
const nb = Number(process.argv[3] || 10);
const nq = Number(process.argv[4] || 12);
const errors = [];

const { rows: r1 } = await readCsv(path.join(dir, "level1.csv"));
if (r1.length !== nb) errors.push(`level1 rows=${r1.length} expected ${nb}`);
for (const r of r1) {
  try {
    const d = JSON.parse(r.json);
    const missing = L1_KEYS.filter((k) => !(k in d));
    if (missing.length) errors.push(`${r.bill_id}: missing keys ${missing}`);
    if (d.current_bill === null && d.units_consumed === null) errors.push(`${r.bill_id}: looks empty (extraction failed?)`);
  } catch (e) {
    errors.push(`${r.bill_id}: bad JSON (${e.message})`);
  }
}

const { rows: r2 } = await readCsv(path.join(dir, "level2.csv"));
if (r2.length !== nb * nq) errors.push(`level2 rows=${r2.length} expected ${nb * nq}`);
for (const r of r2) if (!String(r.answer || "").trim()) errors.push(`${r.bill_id} ${r.question_id}: empty answer`);

console.log(errors.length ? errors.join("\n") : "OK, all checks passed");
process.exit(errors.length ? 1 : 0);