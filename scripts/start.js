import { esbuildConfig } from './helpers/index.js'
import { build } from './build/index.js'
import { render } from './html/render.js'
import { serve, clients } from './serve.js'
import esbuild from 'esbuild';

async function start() {
	const emitted = await build()
	esbuild.build({
		...esbuildConfig,
		watch: {
			onRebuild(error) {
				if (error) {
					console.log(error)
					return
				}
				render(emitted)
				clients.forEach(res => res.write('data: update\n\n'))
				clients.length = 0
			},
		},
	}).then(() => {
		process.stdout.write('watching for changes on ')
		serve()
	})
}

start()

