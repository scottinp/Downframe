import { convert, detect, SUPPORTED } from "./converter/index.ts";
import { zip } from "./zip.ts";
import "./ui/keyframe-grid.ts";

const MAX_BYTES = 50 * 1024 * 1024; // presets are a few KB; refuse before reading a huge file into memory
const MAX_TOTAL = 200 * 1024 * 1024; // same guard for a whole batch
// AE 17 = 2020 and 18 = 2021; Adobe then jumped to 22 = 2022, so later versions are 2000 + version.
const year = (v: string) => String(Number(v) + (Number(v) < 22 ? 2003 : 2000));
const label = (v: string) => `After Effects ${year(v)} (${v}.x)`;

const ERRORS: Record<string, string> = {
  empty: "That file is empty.",
  "not-riff": "That is not an After Effects preset (.ffx).",
  truncated: "That file looks cut off. Try downloading or exporting it again.",
  "unknown-version": "This preset was saved in a version of After Effects that Downframe does not recognise yet.",
  "unsupported-pair": "That conversion has not been tested, so it is not offered.",
  "check-failed": "The converted file failed a check, so no file was made. Your original is unchanged.",
  "too-large": "That file is too large to be a preset.",
  "read-failed": "Could not read that file. Try choosing it again.",
};
const KEPT_UNKNOWN = "Unknown version, kept as is";
const message = (code: string) => ERRORS[code] ?? `Could not read that file (${code}).`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const panel = document.querySelector<HTMLElement>(".panel")!;
const fileInput = $<HTMLInputElement>("file");
const target = $<HTMLSelectElement>("target");
const error1 = $("error1");
const error2 = $("error2");

// A dropped file: readable presets have bytes + version, the rest keep the error code to show in their row.
// A preset of an unknown version also keeps its bytes, so it can be passed through unchanged.
type Item = { name: string; bytes?: Uint8Array; version?: string; code?: string };
type Row = { name: string; meta: string; bad?: boolean };

// Shared "files converted" total (api/count.ts). Stays hidden when the API is missing (vite dev) or down.
const counter = $("converted");
const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let shown = 0; // number on screen right now
let run = 0; // a newer total cancels a count-up still running

// Counts up from what's shown to the total over ~1.2 s, easing out.
function countTo(total: number) {
  $("stat").hidden = false;
  $("converted-label").textContent = total === 1 ? "file converted so far" : "files converted so far";
  const from = shown, start = performance.now(), id = ++run;
  const step = (now: number) => {
    if (id !== run) return;
    const t = still ? 1 : Math.min(1, (now - start) / 1200);
    shown = Math.round(from + (total - from) * (1 - (1 - t) ** 3));
    counter.textContent = shown.toLocaleString("en-US");
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const count = (init?: RequestInit) => fetch("/api/count", init)
  .then((r) => (r.ok ? r.json() : null))
  .then((d) => { if (typeof d?.total === "number" && d.total >= 1) countTo(d.total); })
  .catch(() => {});
count();

let items: Item[] = [];
let outputs: { name: string; bytes: Uint8Array<ArrayBuffer> }[] = [];

function show(step: 1 | 2 | 3, focus: HTMLElement) {
  panel.dataset.step = String(step);
  for (const tab of panel.querySelectorAll<HTMLElement>("[data-tab]")) {
    if (tab.dataset.tab === String(step)) tab.setAttribute("aria-current", "step");
    else tab.removeAttribute("aria-current");
  }
  focus.focus();
}

const span = (className: string, textContent: string) => Object.assign(document.createElement("span"), { className, textContent });

// One timeline-style row per file: number, colour label, name, status, and an optional remove button.
function renderRows(list: HTMLElement, rows: Row[], onRemove?: (i: number) => void) {
  list.replaceChildren(...rows.map((row, i) => {
    const li = document.createElement("li");
    if (row.bad) li.className = "bad";
    li.append(span("num", String(i + 1)), span("swatch", ""), span("file-name", row.name), span("file-meta", row.meta));
    if (onRemove) {
      const x = Object.assign(document.createElement("button"), { type: "button", className: "remove", textContent: "×" });
      x.setAttribute("aria-label", `Remove ${row.name}`);
      x.addEventListener("click", () => onRemove(i));
      li.append(x);
    }
    return li;
  }));
}

function restart() {
  items = outputs = [];
  fileInput.value = "";
  error1.textContent = error2.textContent = "";
  show(1, $("choose"));
}

async function read(file: File): Promise<Item> {
  if (file.size > MAX_BYTES) return { name: file.name, code: "too-large" };
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { name: file.name, code: "read-failed" };
  }
  const detected = detect(bytes);
  if (detected.ok) return { name: file.name, bytes, version: detected.version };
  return detected.code === "unknown-version" ? { name: file.name, bytes, code: detected.code } : { name: file.name, code: detected.code };
}

// On step 2, new files join the batch; otherwise they start a new one.
async function load(files: File[]) {
  const base = panel.dataset.step === "2" ? items : [];
  const error = base.length ? error2 : error1;
  error.textContent = "";
  if (files.length === 0) return;
  const size = base.reduce((sum, it) => sum + (it.bytes?.length ?? 0), 0) + files.reduce((sum, f) => sum + f.size, 0);
  if (size > MAX_TOTAL) {
    error.textContent = "Those files are too large to be presets. Try fewer at a time.";
    return;
  }
  const added = await Promise.all(files.map(read));
  // Re-read the batch after the await: another add may have finished while these files were reading.
  if (setItems([...(panel.dataset.step === "2" ? items : []), ...added])) show(2, target);
}

// Validates a file list and fills step 2. False (with error1 set) if nothing in it can be converted.
function setItems(loaded: Item[]): boolean {
  const readable = loaded.filter((it) => it.version);
  if (readable.length === 0) {
    error1.textContent = loaded.length === 1 ? message(loaded[0].code!)
      : loaded.some((it) => it.bytes) ? "Downframe does not recognise the version of any of these presets."
      : "None of these files are presets Downframe can read.";
    return false;
  }
  const targets = [...new Set(readable.flatMap((it) => SUPPORTED[it.version!] ?? []))].sort((a, b) => Number(b) - Number(a));
  if (targets.length === 0) {
    error1.textContent = readable.length === 1
      ? `${label(readable[0].version!)} has no supported older version, so there is nothing to convert.`
      : "None of these presets have a supported older version, so there is nothing to convert.";
    return false;
  }
  items = loaded;
  renderRows($("layers2"), items.map((it) => it.version ? { name: it.name, meta: `Saved in ${label(it.version)}` }
    : it.bytes ? { name: it.name, meta: KEPT_UNKNOWN }
    : { name: it.name, meta: message(it.code!), bad: true }), remove);
  const picked = target.value;
  target.replaceChildren(...targets.map((v) => new Option(label(v), v)));
  if (targets.includes(picked)) target.value = picked;
  error2.textContent = "";
  return true;
}

// Removing the last file, or every file that can be converted, goes back to step 1.
function remove(i: number) {
  const rest = items.filter((_, j) => j !== i);
  if (rest.length === 0) return restart();
  if (setItems(rest)) return target.focus();
  show(1, $("choose"));
}

for (const id of ["choose", "add"]) $(id).addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  const files = Array.from(fileInput.files ?? []);
  fileInput.value = ""; // so picking the same file again still fires change
  load(files);
});

// Stop a file dropped next to the zone from replacing the page. Steps 1 and 2 take drops anywhere on the panel.
for (const type of ["dragover", "drop"]) window.addEventListener(type, (e) => e.preventDefault());
// Moving over a child fires dragleave on the one before it, so count enters/leaves and clear only when back to zero.
const view2 = panel.querySelector<HTMLElement>(".v2")!;
const accepts = () => panel.dataset.step !== "3" && !view2.inert;
let depth = 0;
panel.addEventListener("dragenter", () => { depth++; if (accepts()) panel.classList.add("over"); });
panel.addEventListener("dragleave", () => { if (--depth <= 0) { depth = 0; panel.classList.remove("over"); } });
panel.addEventListener("drop", (e) => {
  depth = 0;
  panel.classList.remove("over");
  if (accepts()) load(Array.from(e.dataTransfer?.files ?? []));
});

// Converting takes milliseconds, so a short bar shows something happened. Step 2 is inert meanwhile so the batch can't change.
$("convert").addEventListener("click", () => {
  const button = $("convert");
  button.classList.add("busy");
  button.textContent = "Converting…";
  view2.inert = true;
  setTimeout(() => {
    button.classList.remove("busy");
    button.textContent = "Convert";
    view2.inert = false;
    button.focus();
    convertAll();
  }, 700);
});

function convertAll() {
  const to = target.value;
  outputs = [];
  let converted = 0;
  // Presets that can't be converted still go in the download unchanged, so a whole folder can be dropped as is.
  const keep = (it: Item, meta: string): Row => {
    outputs.push({ name: it.name, bytes: new Uint8Array(it.bytes!) });
    return { name: it.name, meta };
  };
  const rows = items.map((it): Row => {
    if (!it.bytes) return { name: it.name, meta: message(it.code!), bad: true };
    if (!it.version) return keep(it, KEPT_UNKNOWN);
    // Already opens in the target: include the original, so the download has every preset that was dropped.
    if (Number(it.version) <= Number(to)) return keep(it, `Already opens in ${year(to)}, included as is`);
    const result = convert(it.bytes, to);
    if (!result.ok && result.code === "unsupported-pair") return keep(it, `No tested conversion to ${year(to)}, kept as is`);
    if (!result.ok) return { name: it.name, meta: ERRORS[result.code] ?? `Conversion failed (${result.code}).`, bad: true };
    const name = `${it.name.replace(/\.ffx$/i, "")}.ae${to}.ffx`;
    outputs.push({ name, bytes: result.bytes });
    converted++;
    return { name, meta: "Converted" };
  });
  // Only the number is sent. The API caps one report at 100 (MAX_ADD).
  if (converted) count({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ n: Math.min(converted, 100) }) });
  if (outputs.length === 0) {
    error2.textContent = items.length === 1 ? rows[0].meta : "None of these files could be converted. Your originals are unchanged.";
    return;
  }
  renderRows($("layers3"), rows);
  $("download").textContent = outputs.length > 1 ? `Download all (${outputs.length})` : "Download";
  show(3, $("download"));
}

$("download").addEventListener("click", () => {
  if (outputs.length === 0) return;
  let name = outputs[0].name;
  let bytes = outputs[0].bytes;
  if (outputs.length > 1) {
    name = `downframe-ae${target.value}.zip`;
    bytes = zip(outputs);
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

for (const button of document.querySelectorAll("[data-restart]")) button.addEventListener("click", restart);
// Step 3 back to step 2 keeps the batch, so files can be added or removed and converted again.
$("back").addEventListener("click", () => show(2, target));
