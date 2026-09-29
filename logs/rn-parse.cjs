const esbuild = require("C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/node_modules/esbuild");
const fs = require("fs");
const path = require("path");
const root = "C:/Users/prema/Downloads/Prototype/samaj-drishti/mobile/src";
const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|jsx)$/.test(entry.name)) files.push(full);
  }
})(root);
let bad = 0;
for (const file of files) {
  try {
    esbuild.transformSync(fs.readFileSync(file, "utf8"), { loader: "jsx" });
  } catch (err) {
    bad += 1;
    console.log("PARSE FAIL:", path.basename(file), "-", String(err.message).split("\n")[0]);
  }
}
console.log(`mobile (React Native) esbuild parse: ${files.length} files, ${bad} failures`);
