import { paths } from './helpers/index.js'
import fs from 'fs'
import { fileURLToPath } from 'url'

export function clean() {
  console.log('[clean] start')
  const start = process.hrtime()
  fs.rmSync(paths.outdir, { recursive: true, force: true })
  fs.rmSync(paths.generatedDir, { recursive: true, force: true })
  const elapsed = process.hrtime(start)[1] / 1000000
  console.log('[clean]', elapsed + 'ms')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) clean()

