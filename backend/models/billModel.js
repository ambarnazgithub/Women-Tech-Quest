// Level 1 schema: normalisation and sanity checks.
export const L1_KEYS = [
    "provider", "tariff", "sanctioned_load_kw", "bill_month", "reading_date",
    "issue_date", "due_date", "previous_reading", "current_reading", "units_consumed",
    "charges", "total_charges", "taxes", "total_taxes", "current_bill", "arrears",
    "payable_within_due_date", "payable_after_due_date",
  ];
  const NUMERIC = [
    "sanctioned_load_kw", "previous_reading", "current_reading", "units_consumed",
    "total_charges", "total_taxes", "current_bill", "arrears",
    "payable_within_due_date", "payable_after_due_date",
  ];
  const CHARGE_TYPES = new Set(["energy", "fixed", "fpa", "quarterly_adjustment", "surcharge", "meter_rent", "subsidy", "other"]);
  const TAX_TYPES = new Set(["gst", "electricity_duty", "income_tax", "municipal_tax", "other_tax"]);
  const PROVIDER_MAP = {
    KE: "KE", KESC: "KE", "K-ELECTRIC": "KE", KELECTRIC: "KE", "K ELECTRIC": "KE",
    LESCO: "LESCO", IESCO: "IESCO",
  };
  const FILE_PREFIX = { KESC: "KE", KE: "KE", LESCO: "LESCO", IESCO: "IESCO" };
  
  export function toNum(v) {
    if (v === null || v === undefined || typeof v === "boolean") return null;
    let n;
    if (typeof v === "number") {
      if (!Number.isFinite(v)) return null;
      n = v;
    } else {
      let s = String(v).trim();
      if (!s || ["null", "none", "n/a", "na", "-"].includes(s.toLowerCase())) return null;
      const neg = /cr$/i.test(s) || s.startsWith("-") || (s.startsWith("(") && s.endsWith(")"));
      s = s.replace(/[^0-9.]/g, "");
      if (!s || s === ".") return null;
      n = parseFloat(s);
      if (Number.isNaN(n)) return null;
      if (neg) n = -n;
    }
    return Number.isInteger(n) ? n : Math.round(n * 100) / 100;
  }
  
  const RE_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
  const RE_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  const checkDate = (v, re) => (typeof v === "string" && re.test(v.trim()) ? v.trim() : null);
  
  function normLines(items, allowed, defaultType) {
    const out = [];
    for (const it of Array.isArray(items) ? items : []) {
      if (!it || typeof it !== "object") continue;
      let amt = toNum(it.amount);
      if (amt === null || amt === 0) continue;
      let t = String(it.type ?? "").trim().toLowerCase();
      if (!allowed.has(t)) t = defaultType;
      if (t === "subsidy" && amt > 0) amt = -amt;
      out.push({ type: t, amount: amt });
    }
    return out;
  }
  
  export function normalizeLevel1(raw, billId = "") {
    raw = raw && typeof raw === "object" ? raw : {};
    const d = {};
    let prov = PROVIDER_MAP[String(raw.provider ?? "").trim().toUpperCase()];
    if (!prov) prov = FILE_PREFIX[billId.split("_")[0].toUpperCase()] ?? null; // KESC_0008 -> KE
    d.provider = prov;
    d.tariff = raw.tariff !== null && raw.tariff !== undefined && String(raw.tariff).trim() !== ""
      ? String(raw.tariff).trim() : null;
    for (const k of NUMERIC) d[k] = toNum(raw[k]);
    d.bill_month = checkDate(raw.bill_month, RE_MONTH);
    for (const k of ["reading_date", "issue_date", "due_date"]) d[k] = checkDate(raw[k], RE_DATE);
    d.charges = normLines(raw.charges, CHARGE_TYPES, "other");
    d.taxes = normLines(raw.taxes, TAX_TYPES, "other_tax");
    return Object.fromEntries(L1_KEYS.map((k) => [k, d[k]]));
  }
  
  export const emptyLevel1 = (billId = "") => normalizeLevel1({}, billId);
  
  /** Non-destructive checks: only warn, never "correct" printed values. */
  export function sanityWarnings(d) {
    const w = [];
    const sum = (a) => a.reduce((s, x) => s + x.amount, 0);
    if (d.total_charges !== null && d.charges.length && Math.abs(sum(d.charges) - d.total_charges) > 2)
      w.push(`charges sum ${sum(d.charges).toFixed(2)} != total_charges ${d.total_charges}`);
    if (d.total_taxes !== null && d.taxes.length && Math.abs(sum(d.taxes) - d.total_taxes) > 2)
      w.push(`taxes sum ${sum(d.taxes).toFixed(2)} != total_taxes ${d.total_taxes}`);
    if ([d.previous_reading, d.current_reading, d.units_consumed].every((x) => x !== null) &&
        Math.abs(d.current_reading - d.previous_reading - d.units_consumed) > 1)
      w.push("readings difference != units_consumed (may be multiplier/printed value)");
    return w;
  }