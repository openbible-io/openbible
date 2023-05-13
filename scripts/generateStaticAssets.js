import { paths } from './helpers/index.js'
import path from 'path';
import fs from 'fs';
import { usfm2json } from 'usfm2json';

const textDir = paths.textDir
const translations = ['en_ult', 'en_ust']

function toJSON(file) {
	const toPrefixPath = file
		.replace(/\.[^\/.]+$/, '')
		.replace(/\d+-/, '')
		.replace(textDir, paths.staticDir)

	console.log(`Rendering ${file} -> ${toPrefixPath}*`)
	const chapters = usfm2json(fs.readFileSync(file, 'utf8'))

	const toDir = toPrefixPath.replace(/\/[^\/]+$/, '')
	if (!fs.existsSync(toDir))
		fs.mkdirSync(toDir, { recursive: true })

	chapters.forEach((chapter, index) => {
		const chapterFile	= `${toPrefixPath}-${(index + 1 + '').padStart(2, '0')}.json`
		fs.writeFileSync(chapterFile, JSON.stringify(chapter, null, 2))
	})
}

translations.forEach(t => {
	fs.readdirSync(path.join(textDir, t), { withFileTypes: true }).forEach(dirent => {
		if (dirent.isFile() && dirent.name.endsWith('.usfm')) {
			const file = path.join(textDir, t, dirent.name)
			toJSON(file)
		}
	});
});

