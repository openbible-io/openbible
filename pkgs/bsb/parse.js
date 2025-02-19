import { readFileSync } from 'node:fs'
const f = readFileSync("test.json", "utf8");
JSON.parse(f);
