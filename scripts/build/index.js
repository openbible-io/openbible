import { copy } from './copy.js'
import { render } from '../html/render.js'
import { js } from './js.js'
import { fileURLToPath } from 'url'

export async function build(injectScript) {
	copy()
	const emitted = await js()
	render(emitted, injectScript)
	return emitted
}

if (process.argv[1] === fileURLToPath(import.meta.url)) build()

