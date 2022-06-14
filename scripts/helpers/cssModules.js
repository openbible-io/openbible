import path from 'path'
import csstree from 'css-tree'
import fs from 'fs'

const namespace = 'css-module'

async function generateJSON(args) {
  const css = await fs.promises.readFile(args.path, 'utf8')
  const ast = csstree.parse(css)
  const classNames = {}
  csstree.walk(ast, node => {
    if (node.type === 'ClassSelector') {
      classNames[node.name] = node.name
    }
  })
	return {css, json: JSON.stringify(classNames)}
}

const filter = /\.css$/
export default {
  name: 'css-modules',
  setup: builder => {
		const cssFiles = {}
		async function onLoad(args) {
      const importPath = `${namespace}://${path.relative(process.cwd(), args.path)}`
			const { css, json } = await generateJSON(args)
      cssFiles[importPath] = css
			return {
				contents: `import "${importPath}"; export default ${json};`
			}
		}
    builder.onLoad({ filter, namespace: 'file' }, onLoad);
    builder.onResolve({ filter: /^css-module:\/\// }, (args) => {
			return {
				path: args.path,
				namespace: namespace
			}
		});
    builder.onLoad({ filter: /.*/, namespace: namespace}, (args) => {
      const css = cssFiles[args.path];
			const resolveDir = path.dirname(args.path.replace(`${namespace}://`, ''))
			return { contents: css, loader: "css", resolveDir }
    });
  }
}

