import { sep } from 'path'
import htmlPlugin from 'esbuild-plugin-template'
import cssVarsPlugin from './plugins/cssVariables.mjs'
import svgPlugin from './plugins/svg.mjs'
import routes from './routes.mjs'
import copyPlugin from 'esbuild-copy-static-files'
import cssModulesPlugin from 'esbuild-css-modules-plugin'

function htmlConfig() {
	return routes.map(r => ({
		filename: `${r}.html`,
		template(result, initialOptions) {
			const outputs = (Object.keys(result?.metafile?.outputs ?? []));
			const stripBase = f => f.replace(initialOptions.outdir + sep, '');
			const stylesheets = outputs.filter(f => f.endsWith('.css')).map(stripBase);
			const scripts = outputs.filter(f => f.endsWith('.js')).map(stripBase);
			return `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="utf-8">
		<title>Open Bible</title>
		${stylesheets.map(f => `<link rel="stylesheet" href="${f}"></script>`).join('\n')}
	</head>
	<body>
		<div id="root"></div>
		${scripts.map(f => `<script src="${f}"></script>`).join('\n')}
	</body>
</html>`
		}
}))
};

const outdir = 'dist';

export const esbuildConfig = ({ isProd }) => ({
	entryPoints: ['src/app.tsx'],
	entryNames: `[dir]/[name]${isProd ? '.[hash]' : ''}`,
	metafile: true,
	bundle: true,
	sourcemap: isProd ? 'external' : 'inline',
	minify: isProd,
	outdir,
	jsxFactory: 'h',
	jsxFragment: 'Fragment',
	loader: {
		'.svg': 'dataurl',
		'.png': 'file',
		'.jpg': 'file',
		'.gif': 'file',
		'.ttf': 'file',
		'.woff': 'file',
		'.woff2': 'file',
	},
	plugins: [
		cssVarsPlugin,
		svgPlugin,
		cssModulesPlugin({
			pattern: '[name]_[local]',
			filter: /\.css$/,
		}),
		htmlPlugin(htmlConfig(isProd)),
		copyPlugin({
			src: 'static',
			dest: outdir,
		}),
	],
})
