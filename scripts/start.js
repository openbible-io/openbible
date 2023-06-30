import { esbuildConfig, paths } from './helpers/index.js'
import esbuild from 'esbuild'
import { build } from './build/index.js'
import http from 'http'
import { routes } from '../routes.js'

const host = 'localhost'
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

// https://esbuild.github.io/api/#serve-proxy
await context.serve({
	port: port + 1,
	servedir: paths.outdir
})

http.createServer((req, res) => {
	const options = {
		hostname: host,
		port: port + 1,
		path: routes.includes(req.url.substring(1)) ? `${req.url}.html` : req.url,
		method: req.method,
		headers: req.headers,
	}

	// Forward each incoming request to esbuild
	const proxyReq = http.request(options, proxyRes => {
		// If esbuild returns "not found", send a custom 404 page
		if (proxyRes.statusCode === 404) {
			res.writeHead(404, { 'Content-Type': 'text/html' })
			res.end('<h1>A custom 404 page</h1>')
			return
		}

		// Otherwise, forward the response from esbuild to the client
		res.writeHead(proxyRes.statusCode, proxyRes.headers)
		proxyRes.pipe(res, { end: true })
	})

	// Forward the body of the request to esbuild
	req.pipe(proxyReq, { end: true })
}).listen(port)


console.log(`serving on http://${host}:${port}`)

// context.dispose()

