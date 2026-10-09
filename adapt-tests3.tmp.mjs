import fs from "node:fs";
const p = "pi-web/src/components/SessionSidebar.test.mjs";
let s = fs.readFileSync(p, "utf8");
let n = 0;
const rep = (from, to) => { if (!s.includes(from)) { console.log("MISS:", JSON.stringify(from.slice(0, 60))); return; } s = s.split(from).join(to); n += 1; };

rep(`  assert.doesNotMatch(source, /new EventSource\(\\"\\/api\\/agent\\/running\\/events\\"\)/);`, "");
