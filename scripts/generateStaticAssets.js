import fs from 'fs';
import glob from 'glob';
import { usfm2json } from 'usfm2json';

glob.sync('./texts/**/*.usfm').forEach(file => {
	const toPrefixPath = file
		.replace(/\.[^\/.]+$/, '')
		.replace(/\d+-/, '')
		.replace('./texts', './static')

	console.log(`Rendering ${file} -> ${toPrefixPath}*`)
	const chapters = usfm2json(fs.readFileSync(file, 'utf8'))

	const toDir = toPrefixPath.replace(/\/[^\/]+$/, '')
	if (!fs.existsSync(toDir))
		fs.mkdirSync(toDir, { recursive: true })

	chapters.forEach((chapter, index) => {
		const chapterFile	= `${toPrefixPath}-${(index + 1 + '').padStart(2, '0')}.json`
		fs.writeFileSync(chapterFile, JSON.stringify(chapter, null, 2))
	})
})
