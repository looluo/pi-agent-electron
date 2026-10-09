import fs from "node:fs";
const p = process.argv[2];
let s = fs.readFileSync(p, "utf8");
let n = 0;
s = s.replace(/<<<<<<< ours\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> theirs\n/g, (_m, a, b) => { n += 1; return a + b; });
fs.writeFileSync(p, s);
console.log(`${p}: ${n} conflicts unioned, markers left: ${(s.match(/<<<<<<<|>>>>>>>/g) || []).length}`);
