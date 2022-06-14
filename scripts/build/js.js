import { paths, esbuildConfig } from '../helpers/index.js'
import path from 'path'
import { build, analyzeMetafileSync } from 'esbuild'
import { fileURLToPath } from 'url'

export async function js() {
  const start = process.hrtime()
  console.log('[js] start') 
  const { metafile } = await build(esbuildConfig)
  const elapsed = process.hrtime(start)[1] / 1000000
  console.log('[js] bundled', Object.keys(metafile.inputs).length, 'files in', elapsed + 'ms')
	console.log(analyzeMetafileSync(metafile))
  return Object.keys(metafile.outputs)
    .map(f => f.replace(esbuildConfig.outdir, '').substr(1))
    .filter(outFile => outFile.startsWith(path.parse(paths.entryJS).name))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) js()

