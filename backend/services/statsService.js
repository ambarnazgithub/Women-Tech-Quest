// Deterministic calculations done in code (not by the LLM).
import { toNum } from "../models/billModel.js";

const r2 = (x) => Math.round(x * 100) / 100;
const pct = (a, b) => (a !== null && a !== undefined && b ? r2((a / b) * 100) : null);
const dayDiff = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const avgOf = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

function block(rows) {
  if (!rows.length) return null;
  const vals = rows.map((r) => r.units);
  const avg = avgOf(vals);
  const pos = vals.filter((v) => v > 0);
  const hasNeg = vals.some((v) => v < 0);
  return {
    count: vals.length,
    average: r2(avg),
    ...(hasNeg && {
      note: "History has negative values (net metering / export credit). 'average' includes negatives; 'average_positive_months_only' excludes them.",
      negative_months: vals.filter((v) => v < 0).length,
      positive_months: pos.length,
      average_positive_months_only: pos.length ? r2(avgOf(pos)) : null,
    }),
    max: rows.reduce((a, b) => (b.units > a.units ? b : a)),
    min: rows.reduce((a, b) => (b.units < a.units ? b : a)),
    months_above_100: vals.filter((v) => v > 100).length,
    months_above_200: vals.filter((v) => v > 200).length,
    months_above_300: vals.filter((v) => v > 300).length,
    months_above_average: vals.filter((v) => v > avg).length,
  };
}

export function computeStats(l1, extra) {
  const s = {};
  const cb = l1.current_bill, u = l1.units_consumed;
  s.taxes_pct_of_current_bill = pct(l1.total_taxes, cb);
  s.charges_pct_of_current_bill = pct(l1.total_charges, cb);
  s.current_bill_divided_by_units = cb !== null && u ? r2(cb / u) : null;

  // General stats based on BILLED units
  if (cb !== null && u) s.cost_per_billed_unit = r2(cb / u);
  if (u !== null) s.units_if_usage_rises_10pct = r2(u * 1.1);

  const pw = l1.payable_within_due_date, pa = l1.payable_after_due_date;
  if (pw !== null && pa !== null) {
    s.late_payment_extra_amount = r2(pa - pw);
    s.late_payment_extra_pct = pct(pa - pw, pw);
  }

  if (l1.charges.length) {
    s.sum_of_charge_lines = r2(l1.charges.reduce((a, c) => a + c.amount, 0));

    // gross / subsidy / net
    const gross = l1.charges.filter((c) => c.amount > 0).reduce((a, c) => a + c.amount, 0);
    const deductions = l1.charges.filter((c) => c.amount < 0).reduce((a, c) => a + c.amount, 0);
    s.gross_charges_before_subsidy = r2(gross);
    s.subsidy_and_deductions = r2(deductions);
    s.net_charges_after_subsidy = r2(gross + deductions);

    const big = l1.charges.reduce((a, c) => (c.amount > a.amount ? c : a));
    s.largest_charge_line = big;
    s.largest_charge_pct_of_current_bill = pct(big.amount, cb);
  }
  if (l1.taxes.length) {
    s.sum_of_tax_lines = r2(l1.taxes.reduce((a, t) => a + t.amount, 0));
    s.tax_lines_pct_of_current_bill = Object.fromEntries(
      l1.taxes.map((t, i) => [`${t.type}#${i}`, pct(t.amount, cb)]));
  }

  // Usage history (negative values allowed: net metering)
  const hist = (Array.isArray(extra?.usage_history) ? extra.usage_history : [])
    .filter((h) => h && toNum(h.units) !== null)
    .map((h) => ({ month: h.month, units: toNum(h.units) }));

  if (hist.length) {
    s.usage_history_all_printed_entries = block(hist);
    const prior = hist.filter((r) => r.month !== l1.bill_month);
    const ex = block(prior);
    s.usage_history_excluding_current_month = ex;

    if (ex && u !== null && ex.average) {
      s.current_units_vs_prior_average_pct_diff = r2(((u - ex.average) / ex.average) * 100);
      s.current_vs_prior_average_direction =
        u > ex.average ? "HIGHER" : u < ex.average ? "LOWER" : "SAME";
    }

    if (prior.length && u !== null) {
      const prev = prior[prior.length - 1]; // assumes history is oldest -> newest
      const d = r2(u - prev.units);
      s.previous_month = prev;
      s.current_units_vs_previous_month_diff = d;
      s.current_vs_previous_month_direction = d > 0 ? "HIGHER" : d < 0 ? "LOWER" : "SAME";
    }
  }

  const bh = (Array.isArray(extra?.billing_history) ? extra.billing_history : [])
    .map((b) => toNum(b?.billed_amount)).filter((x) => x !== null);
  if (bh.length) {
    const avg = avgOf(bh);
    s.billing_history_average_amount = r2(avg);
    if (cb !== null) s.current_bill_vs_billing_history_avg_pct_diff = pct(cb - avg, avg);
  }

  if (l1.issue_date && l1.due_date) s.days_from_issue_to_due_date = dayDiff(l1.issue_date, l1.due_date);
  if (l1.reading_date && l1.due_date) s.days_from_reading_to_due_date = dayDiff(l1.reading_date, l1.due_date);
  return s;
}