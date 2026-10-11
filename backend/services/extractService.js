import { EXTRACT_SYSTEM, EXTRACT_USER, HISTORY_USER } from "../config/prompts.js";
import { normalizeLevel1, sanityWarnings } from "../models/billModel.js";
import { generateAIResponse } from "./gemini.service.js";

export function parseJson(text) {
  const t = (text || "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a === -1 || b === -1) throw new Error("no JSON object found");
  return JSON.parse(t.slice(a, b + 1));
}

const validate = (t) => {
  const d = parseJson(t);
  if (!d.level1 || typeof d.level1 !== "object") throw new Error("missing 'level1' object");
};

const sumMismatches = (l1) =>
  sanityWarnings(l1).filter((w) => w.startsWith("charges sum") || w.startsWith("taxes sum"));

// ---- date / current_bill sanity checks ----
const dateAndBillIssues = (l1) => {
    const w = [];
    const t = (s) => (s ? Date.parse(s) : NaN);
    if (t(l1.issue_date) > t(l1.due_date)) w.push("issue_date is after due_date (re-read the dates)");
    if (t(l1.reading_date) > t(l1.issue_date)) w.push("reading_date is after issue_date (re-read the dates)");
    if (l1.current_bill != null && l1.current_bill === l1.total_taxes)
      w.push("current_bill equals total_taxes (current_bill is the 'Current Bill' row, not the taxes row)");
    if (l1.provider === "KE") {
      if (l1.units_consumed != null && !Number.isInteger(l1.units_consumed))
        w.push("units_consumed is not a whole number: use the 'Current Month N units' total, not a single Off-Peak/Peak row");
      if (l1.payable_within_due_date > 0 && l1.payable_after_due_date / l1.payable_within_due_date < 1.06)
        w.push("payable_within_due_date looks like the 5% LPS amount: use the 'Amount Payable within Due Date' figure");
    }
  
    // IESCO: current_bill must roughly equal payable_within_due_date - arrears
    // (the small gap is FPA, so allow up to 1000). If not, Taxes/Current Bill digits were misread.
    if (
      l1.provider === "IESCO" &&
      l1.current_bill != null &&
      l1.payable_within_due_date != null &&
      l1.arrears != null &&
      l1.arrears > 0 &&
      Math.abs(l1.current_bill - (l1.payable_within_due_date - l1.arrears)) > 1000
    ) {
      w.push("current_bill does not fit payable_within_due_date minus arrears: re-read the Taxes and Current Bill digits");
    }
  
    return w;
  };

const problems = (l1) => [...sumMismatches(l1), ...dateAndBillIssues(l1)];

// ---- label -> type mapping (deterministic fix for model type mistakes) ----
const CHARGE_MAP = [
  [/fuel price|\bfpa\b|\bfca\b/i, "fpa"],
  [/\brent\b/i, "meter_rent"],
  [/surcharge/i, "surcharge"],
  [/quarterly|\bqta\b/i, "quarterly_adjustment"],
  [/fixed/i, "fixed"],
  [/subsid|relief/i, "subsidy"],
];
const TAX_MAP = [
  [/gst|sales tax/i, "gst"],
  [/\bed\b|electricity duty/i, "electricity_duty"],
  [/income tax/i, "income_tax"],
  [/muct|kmc|municipal/i, "municipal_tax"],
];
const retype = (arr, map) =>
  (Array.isArray(arr) ? arr : []).map(({ label, ...rest }) => {
    const hit = label && map.find(([re]) => re.test(String(label)));
    return hit ? { ...rest, type: hit[1] } : rest;
  });

// ---- deterministic post-fix (safety net if the model slips) ----
const near = (a, b) => Math.abs(a - b) <= 1;
const r2n = (x) => Math.round(x * 100) / 100;

function postFix(l1) {
  l1.charges = Array.isArray(l1.charges) ? l1.charges : [];
  l1.taxes = Array.isArray(l1.taxes) ? l1.taxes : [];
  const isIesco = l1.provider === "IESCO";

  // 1. IESCO: "Total FPA" is a memo line, not a charge line
  if (isIesco) {
    l1.charges = l1.charges.filter((c) => c.type !== "fpa");
    if (l1.charges.length) l1.total_charges = r2n(l1.charges.reduce((a, c) => a + c.amount, 0));
  }

  // 2. IESCO: net charges + taxes = current bill; fix taxes if mismatch
  if (isIesco && l1.total_charges != null && l1.current_bill != null && l1.total_taxes != null &&
      !near(l1.total_charges + l1.total_taxes, l1.current_bill)) {
    l1.total_taxes = r2n(l1.current_bill - l1.total_charges);
  }
  // IESCO: current_bill = total_charges + total_taxes. If the model's current_bill disagrees
// with payable and arrears, trust payable-based value only when it is close.
if (isIesco && l1.total_charges != null && l1.total_taxes != null && l1.current_bill != null &&
    !near(l1.total_charges + l1.total_taxes, l1.current_bill)) {
  l1.current_bill = r2n(l1.total_charges + l1.total_taxes);
}

  // 3. Only one combined tax printed (IESCO/LESCO summary bills) -> taxes = []
  if (l1.provider !== "KE" && l1.taxes.length === 1 && l1.total_taxes != null &&
      near(l1.taxes[0].amount, l1.total_taxes)) {
    l1.taxes = [];
  }
  return l1;
}

async function runExtract(imagePath, billId, userPrompt) {
  const { text } = await generateAIResponse({
    system: EXTRACT_SYSTEM,
    user: userPrompt,
    imagePaths: [imagePath],
    jsonMode: true,
    validate,
  });
  const data = parseJson(text);

  // fix types from printed labels BEFORE normalizing (label is dropped here)
  data.level1.charges = retype(data.level1.charges, CHARGE_MAP);
  data.level1.taxes = retype(data.level1.taxes, TAX_MAP);

  return {
    l1: normalizeLevel1(data.level1, billId),
    extra: data.extra && typeof data.extra === "object" ? data.extra : {},
    raw: data,
  };
}

async function extractHistory(imagePath, billId) {
  try {
    const { text } = await generateAIResponse({
      system: EXTRACT_SYSTEM,
      user: HISTORY_USER,
      imagePaths: [imagePath],
      jsonMode: true,
      validate: (t) => {
        const d = parseJson(t);
        if (!Array.isArray(d.usage_history)) throw new Error("usage_history missing");
        // negatives are allowed (net metering / export credit)
        if (d.usage_history.some((h) => !Number.isFinite(Number(h.units)))) throw new Error("invalid units");
      },
    });
    return parseJson(text).usage_history;
  } catch (e) {
    console.warn(`[${billId}] history extraction failed: ${e.message}`);
    return [];
  }
}

/** Returns { l1, extra } */
export async function extractBill(imagePath, billId) {
  let res = await runExtract(imagePath, billId, EXTRACT_USER);
  res.l1 = postFix(res.l1);
  const issues = problems(res.l1);

  if (issues.length) {
    console.warn(`[${billId}] ${issues.join("; ")} -> re-checking`);
    const hint =
      EXTRACT_USER +
      `\n\nYour previous answer was:\n${JSON.stringify(res.raw.level1)}\n` +
      `Problem: ${issues.join("; ")}.\n` +
      `Look at the image again. Check whether any entry is a memo/informational line, a subtotal, ` +
      `or belongs to a different section, or whether a real line was missed. ` +
      `Keep printed values as they are. Return the corrected full JSON.`;
    try {
      const retry = await runExtract(imagePath, billId, hint);
      retry.l1 = postFix(retry.l1);
      if (problems(retry.l1).length <= issues.length) res = retry;
    } catch (e) {
      console.warn(`[${billId}] re-check failed: ${e.message}`);
    }
  }

  for (const w of sanityWarnings(res.l1)) console.warn(`[${billId}] ${w}`);

  // usage history: separate, focused call
  const history = await extractHistory(imagePath, billId);
  const extra = { ...res.extra, usage_history: history };

  return { l1: res.l1, extra };
}