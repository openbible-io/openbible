import { paths } from '../helpers/index.js'
import path from 'path'
import fs from 'fs'
import { routes } from '../../routes.js'

export function render(emitted, injectScript) {
	const start = process.hrtime()
	console.log('[render] start')
	let numRendered = 0
	// TODO: prerender non-reader panes
	let html = fs.readFileSync(paths.entryHTML, 'utf8')
		.replace('{css}', emitted
			.filter(f => f.endsWith('.css'))
			.map(f => `<link rel="stylesheet" href="${f}">`)
			.join('\n')
		)
		.replace('{js}', emitted
			.filter(f => f.endsWith('.js'))
			.map(f => `<script src="${f}"></script>`)
			.join('\n')
		)
	if (injectScript) {
		html = html.replace('</body>', `<script>${injectScript}</script></body>`)
	}
	routes.forEach(route => {
		fs.writeFileSync(path.join(paths.outdir, route + '.html'), html)
		numRendered++
	})

	const elapsed = process.hrtime(start)[1] / 1000000
	console.log('[render] rendered', numRendered, 'files in', elapsed + 'ms')
}

