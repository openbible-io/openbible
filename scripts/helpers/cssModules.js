import path from 'path'
import csstree from 'css-tree'
import fs from 'fs'

const namespace = 'css-modules'
let cssConcat = ''

async function generateJSON(args) {
  const css = await fs.promises.readFile(args.path, 'utf8')
  cssConcat += css
  cssConcat += '\n'
  const ast = csstree.parse(css)
  const classNames = {}
  csstree.walk(ast, (node) => {
    if (node.type === 'ClassSelector') {
      classNames[node.name] = node.name
    }
  })
  return {
    contents: JSON.stringify(classNames),
    loader: 'json'
  }
}

const filter = /\.css$/
export default {
  name: namespace,
  setup: builder => {
    builder.onLoad({ filter, namespace: 'file' }, generateJSON);
    builder.onEnd(async result => {
      const outFile = path.join(builder.initialOptions.outdir, 'app.css')
      result.metafile.outputs[outFile] = {}
      await fs.promises.writeFile(outFile, cssConcat)
      cssConcat = ''
    })
  }
}

