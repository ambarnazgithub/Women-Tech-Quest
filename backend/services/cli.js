import { parseArgs } from "node:util";
import path from "node:path";
import { runBatch } from "../services/pipelineService.js";

const { values } = parseArgs({
  options: {
    bills: { type: "string" },
    csv: { type: "string" },
    out: { type: "string" },
    dev: { type: "boolean", default: false },
  },
});

if (!values.bills || !values.out) {
  console.error("Usage: node scripts/cli.js --bills <dir> [--csv <dir>] --out <dir> [--dev]");
  
  process.exit(1);
}

runBatch({
  billsDir: path.resolve(values.bills),
  csvDir: values.csv ? path.resolve(values.csv) : null,
  outDir: path.resolve(values.out),
  dev: values.dev,
}).catch((e) => {
  console.error(e.message);
  process.exit(1);
});