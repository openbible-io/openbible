import path from 'path'
import fs from 'fs'
import csstree from 'css-tree'

const namespace = 'css-variables'
const filter = /^\!css-variables\!/
export default {
	name: namespace,
	setup(build) {
		build.onResolve(
			{ filter },
			args => ({
				path: path.resolve(args.resolveDir, args.path.replace(filter, '')),
				namespace
			})
		)

		build.onLoad({ filter: /.*/, namespace }, async args => {
			const css = await fs.promises.readFile(args.path, 'utf8')
			const ast = csstree.parse(css)
			const cssVars = {}
			csstree.walk(ast, node => {
				if (
					node.type === 'Declaration' && 
					node.property.startsWith('--')
				) {
					cssVars[node.property] = node.value.value
				}
			})

			return {
				contents: JSON.stringify(cssVars),
				loader: 'json'
			}
		})
	}
}
