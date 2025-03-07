import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, join } from "node:path";
import type { BunPlugin } from "bun";

const name = "tailwind-transform";
const namespace = name;

class NapiModule {
	extractClasses(args) {
		console.log("extractClasses", args);
	}
	static BUN_PLUGIN_NAME = name;
}

const plugin: BunPlugin = {
	name,
	setup(builder) {
		const napiModule = new NapiModule();

		builder.onBeforeParse(
			{ filter: /./ },
			{
				napiModule,
				symbol: "extractClasses",
			},
		);
		builder.onResolve({ filter: /\.css$/ }, (args) => {
			const path = createRequire(args.importer).resolve(args.path);
			return { path, namespace };
		});

		builder.onLoad({ filter: /\.css$/, namespace }, (args) => {
			const outname = basename(args.path);

			// TODO: how to use file loader + capture fname?
			const outdir = builder.config.outdir;
			if (!outdir) throw new Error("cannot copy wasm file to outdir");

			mkdirSync(outdir, { recursive: true });
			const out = join(outdir, outname);
			copyFileSync(args.path, out);

			return {
				contents: "body{background:blue}",
				loader: "css",
			};
		});
	},
};

export default plugin;
