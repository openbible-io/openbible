import cssVarsPlugin from './cssVariables.js'
import svgPlugin from './svg.js'
import cssModulesPlugin from './cssModules.js'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

export const paths = {
	outdir: 'dist',
	staticDir: 'static',
	entryHTML: 'src/index.html',
	entryJS: 'src/app.tsx'
}
const isProd = process.env.NODE_ENV === 'production'

export function getHash(string) {
	if (isProd) {
		const hash = crypto.createHash('md5').update(string).digest('hex')
		return '.' + hash.substr(0, 8).toUpperCase()
	}

	return 'dev'
}

function _walk(dir, options, res) {
	if (typeof options.ext === 'string') {
		options.ext = new RegExp(options.ext)
	}
	fs.readdirSync(dir).forEach(file => {
		const filepath = path.join(dir, file);
		try {
			const stats = fs.statSync(filepath)
			if (stats.isDirectory()) {
				_walk(filepath, options, res)
			} else if (stats.isFile() && options.ext.test(filepath)) {
				res.push(filepath)
			}
		} catch { /* can't stat file */ }
	})
}

export function walk(dir, options = { ext: /\..*$/ }) {
	const res = []
	_walk(dir, options, res)
	return res
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

