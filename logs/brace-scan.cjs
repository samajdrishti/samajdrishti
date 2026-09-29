const fs = require("fs");
const file = "C:/Users/prema/Downloads/Prototype/samaj-drishti/backend-java/src/main/java/in/gov/samajdrishti/seed/DemoDataSeeder.java";
const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
let depth = 0, inBlock = false;
const methods = [];
lines.forEach((raw, i) => {
  let line = raw.replace(/\/\/.*$/, "").replace(/"(\\.|[^"\\])*"/g, '""').replace(/'(\\.|[^'\\])*'/g, "''");
  if (inBlock) { const end = line.indexOf("*/"); if (end === -1) return; line = line.slice(end + 2); inBlock = false; }
  const start = line.indexOf("/*"); if (start !== -1 && line.indexOf("*/", start) === -1) { inBlock = true; line = line.slice(0, start); }
  if (/^\s{4}(private|public|protected|static|void)\b.*\(/.test(line) || /^\s{4}record\s/.test(line)) {
    methods.push({ line: i + 1, depth, text: line.trim().slice(0, 58) });
  }
  for (const ch of line) { if (ch === "{") depth++; else if (ch === "}") depth--; }
});
console.log("final brace depth:", depth, depth === 0 ? "(balanced)" : "(UNBALANCED)");
console.log("\nmethod declarations with the brace depth they START at (class members should be 1):");
let prev = null;
for (const m of methods) {
  const flag = m.depth !== 1 ? "   <-- unexpected depth" : "";
  if (flag || prev === null || Math.abs(m.depth - prev) > 1) console.log(`  line ${String(m.line).padStart(4)}  depth=${m.depth}  ${m.text}${flag}`);
  prev = m.depth;
}
