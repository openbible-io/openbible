const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
import { plugin } from 'esbuild-plugin-svgj'

const paths = {
  outdir: 'dist',
  staticDir: 'static',
  entryHTML: 'src/index.html',
  entryJS: 'src/app.tsx'
}

function getHash(string) {
	if (process.env.NODE_ENV === 'production') {
		const hash = crypto.createHash('md5').update(string).digest('hex')
		return hash.substr(0, 5)
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

function walk(dir, options = { ext: /\..*$/ }) {
  const res = []
  _walk(dir, options, res)
  return res
}

const namespace = 'css-variables'
const cssVarsPlugin = {
  name: namespace,
  setup(build) {
    build.onResolve(
      { filter: /^\!css-variables\!/ },
      args => ({
        path: args.path,
        namespace
      }))

    build.onLoad({ filter: /.*/, namespace }, args => ({
      contents: JSON.stringify(args),
      loader: 'json'
    }))
  }
}

const isProd = process.env.NODE_ENV === 'production'

const esbuildConfig = {
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
    svgPlugin
  ]
}

module.exports = {
  paths,
  getHash,
  walk,
  esbuildConfig
}
