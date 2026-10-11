import { convert, detect, SUPPORTED } from "./converter/index.ts";
import "./ui/keyframe-grid.ts";

const MAX_BYTES = 50 * 1024 * 1024; // presets are a few KB; refuse before reading a huge file into memory
const YEARS: Record<string, string> = { "17": "2020", "18": "2021", "25": "2025", "26": "2026" };
const label = (v: string) => `After Effects ${YEARS[v] ?? v} (${v}.x)`;

const ERRORS: Record<string, string> = {
  empty: "That file is empty.",
  "not-riff": "That is not an After Effects preset (.ffx).",
  truncated: "That file looks cut off. Try downloading or exporting it again.",
  "unknown-version": "This preset was saved in a version of After Effects that Downframe does not recognise yet.",
  "unsupported-pair": "That conversion has not been tested, so it is not offered.",
  "check-failed": "The converted file failed a check, so no file was made. Your original is unchanged.",
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const panel = document.querySelector<HTMLElement>(".panel")!;
const fileInput = $<HTMLInputElement>("file");
const dropzone = $("dropzone");
const target = $<HTMLSelectElement>("target");
const error1 = $("error1");
const error2 = $("error2");

let source: { name: string; bytes: Uint8Array } | null = null;
let output: { name: string; bytes: Uint8Array<ArrayBuffer> } | null = null;

function show(step: 1 | 2 | 3, focus: HTMLElement) {
  panel.dataset.step = String(step);
  for (const tab of panel.querySelectorAll<HTMLElement>("[data-tab]")) {
    if (tab.dataset.tab === String(step)) tab.setAttribute("aria-current", "step");
    else tab.removeAttribute("aria-current");
  }
  focus.focus();
}

function restart() {
  source = output = null;
  fileInput.value = "";
  error1.textContent = error2.textContent = "";
  show(1, $("choose"));
}

async function load(file: File) {
  error1.textContent = "";
  if (file.size > MAX_BYTES) {
    error1.textContent = "That file is too large to be a preset.";
    return;
  }
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    error1.textContent = "Could not read that file. Try choosing it again.";
    return;
  }
  const detected = detect(bytes);
  if (!detected.ok) {
    error1.textContent = ERRORS[detected.code] ?? `Could not read that file (${detected.code}).`;
    return;
  }
  const targets = SUPPORTED[detected.version] ?? [];
  if (targets.length === 0) {
    error1.textContent = `This preset is from ${label(detected.version)}. No older version has been tested for it yet.`;
    return;
  }
  source = { name: file.name, bytes };
  $("source-name").textContent = file.name;
  $("source-meta").textContent = `Saved in ${label(detected.version)}`;
  target.replaceChildren(...targets.map((v) => new Option(label(v), v)));
  error2.textContent = "";
  show(2, target);
}

$("choose").addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  if (fileInput.files?.[0]) load(fileInput.files[0]);
});

// Stop a file dropped next to the zone from replacing the page.
for (const type of ["dragover", "drop"]) window.addEventListener(type, (e) => e.preventDefault());
dropzone.addEventListener("dragover", () => dropzone.classList.add("over"));
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("over"));
dropzone.addEventListener("drop", (e) => {
  dropzone.classList.remove("over");
  const file = e.dataTransfer?.files[0];
  if (file) load(file);
});

$("convert").addEventListener("click", () => {
  if (!source) return;
  const result = convert(source.bytes, target.value);
  if (!result.ok) {
    error2.textContent = ERRORS[result.code] ?? `Conversion failed (${result.code}).`;
    return;
  }
  output = { name: `${source.name.replace(/\.ffx$/i, "")}.ae${target.value}.ffx`, bytes: result.bytes };
  $("output-name").textContent = output.name;
  show(3, $("download"));
});

$("download").addEventListener("click", () => {
  if (!output) return;
  const url = URL.createObjectURL(new Blob([output.bytes], { type: "application/octet-stream" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: output.name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

for (const button of document.querySelectorAll("[data-restart]")) button.addEventListener("click", restart);
