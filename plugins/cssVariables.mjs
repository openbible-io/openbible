import path from 'path'
import { readFileSync } from 'fs'
import { transform } from 'lightningcss'

function stringify(variable) {
	if (Array.isArray(variable.value)) return variable.value.map(stringify).join('')
	switch (variable.type) {
		case 'color':
		case 'token':
			return stringify(variable.value)
		case 'rgb':
			return `rgba(${variable.r}, ${variable.g}, ${variable.b}, ${variable.alpha})`
		case 'ident':
			return variable.value
		case 'comma':
			return ', '
		case 'string':
			return `"${variable.value}"`
		case 'length':
			return `${variable.value.value}${variable.value.unit}`
		default:
			throw new Error("cannot stringify variable " + JSON.stringify(variable))
	}
}

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

		build.onLoad({ filter: /.*/, namespace }, args => {
			const cssVars = {}
			transform({
				filename: args.path,
				code: readFileSync(args.path),
				visitor: {
					Declaration: {
						custom(variable) {
							if (variable.name.startsWith('--')) {
								cssVars[variable.name] = stringify(variable)
							}
						}
					}
				}
			});

			return {
				contents: JSON.stringify(cssVars),
				loader: 'json'
			}
		})
	}
}
