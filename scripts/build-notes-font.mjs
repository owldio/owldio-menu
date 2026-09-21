/**
 * Builds the Swei Spring Sugar (獅尾四季春加糖) faces the Moonlight Promise
 * notes book is set in.
 *
 * Each full face is about 7 MB — far too much for a phone on a concert-hall
 * network — so the book ships a subset holding only the characters it can set:
 * the notes, the programme details on its cover and closing page, and the
 * words the renderer writes itself. Re-run after editing any of those:
 *
 *   npm run fonts:notes
 *
 * Subsetting uses Python fontTools with brotli (pip install "fonttools[woff]");
 * set PYTHON to choose the interpreter. The source faces are downloaded once,
 * from the font's 1.068 release, into tmp/fonts.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RELEASE = "https://cdn.jsdelivr.net/gh/max32002/swei-spring@1.068";
const CACHE = join(ROOT, "tmp", "fonts");
const OUTPUT = join(ROOT, "assets", "fonts");

// Regular for reading; SemiBold gives the titles their weight.
const FACES = [
  { weight: 400, source: "SweiSpringSugarCJKtc-Regular.woff2" },
  { weight: 600, source: "SweiSpringSugarCJKtc-SemiBold.woff2" },
];

// Every character in these files may be set in the book's face.
const WHOLE_FILES = [
  "src/data/moonlight-promise-notes.js",
  "src/data/moonlight-promise-people.js",
  "src/domain/notes-flow.js",
  "src/domain/datetime.js",
  "src/notes-book-render.js",
  "src/notes-book.js",
];

// Latin for names and titles, and the punctuation of a Chinese text, whatever the notes say today.
const ALWAYS = [
  [0x0020, 0x007e],
  [0x00a0, 0x00ff],
  [0x2010, 0x2027],
  [0x2030, 0x205e],
  [0x3000, 0x303f],
  [0xff01, 0xff5e],
];

/** The programme record's own text: its title, summary, venue and credits. */
function programmeRecord() {
  const source = readFileSync(join(ROOT, "src/data/sample-programme.js"), "utf8");
  const start = source.indexOf("export const moonlightPromiseProgramme = {");
  const end = source.indexOf("\n};", start);
  if (start < 0 || end < 0) {
    throw new Error("Could not find the Moonlight Promise programme record in sample-programme.js.");
  }
  return source.slice(start, end);
}

function bookCharacters() {
  const characters = new Set();
  const texts = [programmeRecord(), ...WHOLE_FILES.map((file) => readFileSync(join(ROOT, file), "utf8"))];

  for (const text of texts) {
    for (const character of text) {
      if (character.codePointAt(0) > 0x7e) characters.add(character);
    }
  }
  for (const [first, last] of ALWAYS) {
    for (let code = first; code <= last; code += 1) characters.add(String.fromCodePoint(code));
  }

  return [...characters].sort().join("");
}

async function sourceFace(name) {
  const path = join(CACHE, name);
  if (existsSync(path)) return path;

  const response = await fetch(`${RELEASE}/WebFont/CJK%20TC/${name}`);
  if (!response.ok) throw new Error(`Could not download ${name}: HTTP ${response.status}`);
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(path, Buffer.from(await response.arrayBuffer()));
  return path;
}

function subset(source, textFile, output) {
  const python = process.env.PYTHON || "python";
  execFileSync(
    python,
    [
      "-m",
      "fontTools.subset",
      source,
      `--text-file=${textFile}`,
      "--flavor=woff2",
      "--layout-features=*",
      // Keep the copyright and licence records the Open Font License asks to travel with the font.
      "--name-IDs=*",
      "--name-languages=*",
      "--no-hinting",
      `--output-file=${output}`,
    ],
    { stdio: "inherit" },
  );
}

/** The Open Font License travels with the subsets, as it asks to. */
async function writeLicence() {
  const response = await fetch(`${RELEASE}/SIL_Open_Font_License_1.1.txt`);
  if (!response.ok) throw new Error(`Could not download the font licence: HTTP ${response.status}`);
  const header = [
    "Swei Spring Sugar (獅尾四季春加糖) 1.068 by Max Yeh — https://github.com/max32002/swei-spring",
    "Derived from Source Han Serif by Adobe. The fonts in this folder are subsets made by",
    "scripts/build-notes-font.mjs and are distributed under the same licence.",
    "",
  ].join("\n");
  writeFileSync(join(OUTPUT, "swei-spring-OFL.txt"), `${header}\n${await response.text()}`, "utf8");
}

const characters = bookCharacters();
const textFile = join(ROOT, "tmp", "notes-font-text.txt");
mkdirSync(dirname(textFile), { recursive: true });
writeFileSync(textFile, characters, "utf8");
mkdirSync(OUTPUT, { recursive: true });

console.log(`${[...characters].length} characters`);
for (const face of FACES) {
  const output = join(OUTPUT, `swei-spring-sugar-${face.weight}.woff2`);
  subset(await sourceFace(face.source), textFile, output);
  console.log(`${face.weight}: ${Math.round(readFileSync(output).length / 1024)} KB -> ${output}`);
}
await writeLicence();
