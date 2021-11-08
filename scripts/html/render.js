const { paths } = require('../helpers')
const path = require('path')
const fs = require('fs')

// TODO: extract to routes file
const routes = [
  'index',
  'settings',
  'about'
];

function render(emitted) {
  const start = process.hrtime()
  console.log('[render] start')
  let numRendered = 0
  // TODO: prerender non-reader panes
  const html = fs.readFileSync(paths.entryHTML, 'utf8')
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
  routes.forEach(route => {
    fs.writeFileSync(path.join(paths.outdir, route + '.html'), html)
    numRendered++
  })

  const elapsed = process.hrtime(start)[1] / 1000000
  console.log('[render] rendered', numRendered, 'files in', elapsed + 'ms')
}

module.exports = {
  render
}

