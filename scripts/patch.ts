// Spike CLI: node scripts/patch.ts <in.ffx> <out.ffx> --target <version>
import { readFileSync, writeFileSync } from "node:fs";
import { detect, patch } from "../src/converter/index.ts";

const [input, output, flag, target] = process.argv.slice(2);
if (!input || !output || flag !== "--target" || !target) {
  console.error("usage: node scripts/patch.ts <in.ffx> <out.ffx> --target <version>");
  process.exit(1);
}

const bytes = new Uint8Array(readFileSync(input));
const result = patch(bytes, target);
if (!result.ok) {
  console.error(`error: ${result.code}`);
  process.exit(1);
}
writeFileSync(output, result.bytes);
const source = detect(bytes);
console.log(`${input} (${source.ok ? source.version : "?"}) → ${output} (${target}), experimental`);
