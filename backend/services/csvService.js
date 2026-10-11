import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

export async function readCsv(file) {
  const text = await fs.readFile(file, "utf8");
  const rows = parse(text, { columns: true, bom: true, skip_empty_lines: true });
  const fields = text.replace(/^\uFEFF/, "").split(/\r?\n/)[0].split(",").map((s) => s.trim());
  return { fields, rows };
}

export async function writeCsv(file, fields, rows) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  // csv-stringify quotes cells with commas/quotes/newlines and doubles quotes
  await fs.writeFile(file, stringify(rows, { header: true, columns: fields }), "utf8");
}