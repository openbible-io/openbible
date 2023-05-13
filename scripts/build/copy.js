import { paths } from '../helpers/index.js'
import path from 'path'
import fs from 'fs'

const fromPath = paths.staticDir
const outdir = paths.outdir

export function copy() {
	const start = process.hrtime()
	let fileCount = 0
	console.log('[copy] start')
	if (!fs.existsSync(outdir)) {
		fs.mkdirSync(outdir)
	}

	fs.readdirSync(fromPath).forEach(file => {
		fs.cpSync(path.join(fromPath, file), path.join(outdir, file), { recursive: true })
		fileCount++
	})
	const elapsed = process.hrtime(start)[1] / 1000000
	console.log('[copy] copied', fileCount, 'files in', elapsed + 'ms')
}

