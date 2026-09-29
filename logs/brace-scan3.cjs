const fs = require("fs");
const file = "C:/Users/prema/Downloads/Prototype/samaj-drishti/backend-java/src/main/java/in/gov/samajdrishti/seed/DemoDataSeeder.java";
const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
let depth = 0, inBlock = false;
const depthAt = [];
lines.forEach((raw) => {
  let line = raw.replace(/\/\/.*$/, "").replace(/"(\\.|[^"\\])*"/g, '""').replace(/'(\\.|[^'\\])*'/g, "''");
  if (inBlock) { const e = line.indexOf("*/"); if (e === -1) { depthAt.push(depth); return; } line = line.slice(e + 2); inBlock = false; }
  const s = line.indexOf("/*"); if (s !== -1 && line.indexOf("*/", s) === -1) { inBlock = true; line = line.slice(0, s); }
  depthAt.push(depth);
  for (const ch of line) { if (ch === "{") depth++; else if (ch === "}") depth--; }
});
for (let i = 655; i < 700; i++) {
  const text = (lines[i] || "").trim().slice(0, 76);
  if (!text) continue;
  console.log(`${String(i + 1).padStart(4)}  d=${depthAt[i]}  ${text}`);
}
