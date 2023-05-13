import { esbuildConfig, paths } from './helpers/index.js'
import esbuild from 'esbuild'
import { build } from './build/index.js'

const port = 3000

// https://github.com/evanw/esbuild/pull/2816
await build(`
new EventSource('/esbuild').addEventListener('change', e => {
	const { added, removed, updated } = JSON.parse(e.data)
	if (!added.length && !removed.length && updated.length === 1) {
		for (const link of document.getElementsByTagName("link")) {
			const url = new URL(link.href)
			if (url.host === location.host && url.pathname === updated[0]) {
				const next = link.cloneNode()
				next.href = updated[0] + '?' + Math.random().toString(36).slice(2)
				next.onload = () => link.remove()
				link.parentNode.insertBefore(next, link.nextSibling)
				return
			}
		}
	}
	location.reload()
})
`)

const context = await esbuild.context(esbuildConfig)
await context.watch()
await context.serve({
	port,
	servedir: paths.outdir
})
console.log(`serving on http://localhost:${port}`)

// context.dispose()

