import fs from "node:fs";
const p = "pi-web/src/components/SessionSidebar.test.mjs";
let s = fs.readFileSync(p, "utf8");
const rep = (from, to) => { if (!s.includes(from)) { console.log("MISS:", from.slice(0, 60)); return; } s = s.split(from).join(to); };

rep(`  assert.doesNotMatch(source, /new EventSource("\/api\/agent\/running\/events")/);
  assert.match(source, /fetch\("\/api\/agent\/running"/);`,
`  // Fork: the poll rides the pi:agent:running IPC channel, not a route.
  assert.match(source, /window\.pi\.agentRunning\(\)/);`);

rep(`  assert.match(body, /fetch\(`\/api\/worktrees\?cwd=\$\{encodeURIComponent\(project\.root\)\}`/);`,
`  assert.match(body, /window\.pi\.worktreesGet\(project\.root\)/);`);

fs.writeFileSync(p, s);
console.log("done");
