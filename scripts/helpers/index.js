import cssVarsPlugin from './cssVariables.js'
import svgPlugin from './svg.js'
import cssModulesPlugin from './cssModules.js'
import crypto from 'crypto'

export const paths = {
	outdir: 'dist',
	staticDir: 'static',
	textDir: 'texts',
	entryHTML: 'src/index.html',
	entryJS: 'src/app.tsx'
}
const isProd = process.env.NODE_ENV === 'production'

export function getHash(string) {
	if (isProd) {
		const hash = crypto.createHash('md5').update(string).digest('hex')
		return '.' + hash.substring(0, 10).toUpperCase()
	}

	return 'dev'
}

export const esbuildConfig = {
	entryPoints: [paths.entryJS],
	entryNames: `[dir]/[name]${isProd ? '.[hash]' : ''}`,
	metafile: true,
	bundle: true,
	sourcemap: isProd ? false : 'inline',
	minify: isProd,
	outdir: paths.outdir,
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
		cssModulesPlugin
	]
}

