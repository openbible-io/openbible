const { build } = require('./build')
const { render, esbuildConfigSSR } = require('./html/render')
const { serve, clients } = require('./serve')
const esbuild = require('esbuild')

const emitted = build()
console.log('watching for changes')
esbuild.build({
  ...esbuildConfigSSR,
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
})
serve()

