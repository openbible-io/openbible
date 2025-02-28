import { readFileSync } from "node:fs";
import { join } from "node:path";

export default {
	en: readFileSync(join(import.meta.dir, "en.txt"), "utf8"),
	he: readFileSync(join(import.meta.dir, "he.txt"), "utf8"),
	gr: readFileSync(join(import.meta.dir, "gr.txt"), "utf8"),
};

