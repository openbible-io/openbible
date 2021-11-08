import { esbuildConfig } from './helpers/index.js'
import { build } from './build/index.js'
import { render } from './html/render.js'
import { serve, clients } from './serve.js'
import esbuild from 'esbuild';

const emitted = build()
console.log('watching for changes')
esbuild.build({
  ...esbuildConfig,
  watch: {
    onRebuild(error) {
      console.log('hello')
      if (error) {
        console.log(error)
        return
      }
      render(emitted)
      clients.forEach(res => res.write('data: update\n\n'))
      clients.length = 0
    },
  },
})
serve()

