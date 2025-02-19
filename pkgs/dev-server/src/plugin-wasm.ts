import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, join } from "node:path";
import type { BunPlugin } from "bun";

const name = "wasm-loader";
const namespace = name;

const plugin: BunPlugin = {
	name,
	setup(builder) {
		builder.onResolve({ filter: /\.wasm$/ }, (args) => {
			const path = createRequire(args.importer).resolve(args.path);
			return { path, namespace };
		});

		builder.onLoad({ filter: /\.wasm$/, namespace }, (args) => {
			const outname = basename(args.path);

			// TODO: how to use file loader + capture fname?
			const outdir = builder.config.outdir;
			if (!outdir) throw new Error("cannot copy wasm file to outdir");

			mkdirSync(outdir, { recursive: true });
			const out = join(outdir, outname);
			copyFileSync(args.path, out);

			return {
				contents: `
let res;
const req = fetch("/${outname}");
if ("instantiateStreaming" in WebAssembly) {
	res = await WebAssembly.compileStreaming(req);
} else {
	const buffer = await req.arrayBuffer();
	res = await WebAssembly.compile(buffer);
}
export default res;`,
				loader: "js",
			};
		});
	},
};

export default plugin;
