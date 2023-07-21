import path from 'path'
import { readFile } from 'fs/promises'
import { render, defaultOpts, defaultProps } from 'svgj'

const namespace = 'svgj'
const args = {
	jsxFrom: 'preact',
	jsxImports: '{ h }',
	exportName: 'default',
	displayName: 'ReactComponent',
	props: defaultProps,
	opts: defaultOpts,
	useMemo: false
}
async function generateJSX(opts) {
	return {
		contents: render(await readFile(opts.path, 'utf8'), args.displayName, args.jsxImports, args.jsxFrom, args.exportName, args.props, args.opts, args.useMemo),
		loader: 'jsx',
		resolveDir: path.dirname(opts.path)
	};
}
async function onResolve(opts) {
	return {
		path: path.resolve(opts.resolveDir, opts.path),
		namespace
	};
}
const filter = /\.svg$/
export default {
	name: 'svgj',
	setup: (builder) => {
		builder.onResolve({ filter }, onResolve);
		builder.onLoad({ filter, namespace }, generateJSX);
	}
}

