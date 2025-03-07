import type { BuildConfig } from "bun";
import pluginTailwind from "bun-plugin-tailwind";
import pluginWasm from "./plugin-wasm";

export const outdir = "dist/site";

const config: BuildConfig = {
	entrypoints: ["src/index.html"],
	//naming: {
	//	entry: '[dir]/[name].[ext]',
	//	chunk: '[name].[ext]',
	//	asset: '[name].[ext]',
	//},
	outdir,
	sourcemap: "linked",
	minify: true,
	splitting: true,
	plugins: [pluginWasm, pluginTailwind],
};

export default config;
