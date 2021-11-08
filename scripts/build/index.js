const { paths } = require('../helpers')
const { copy } = require('./copy')
const { render } = require('../html/render')
const { clean } = require('../clean')
const { js } = require('./js')

async function build() {
  clean()
  copy()
  const emitted = await js(paths.entryJS)
  render(emitted)
  return emitted
}

if (require.main === module) build()

module.exports = {
  build
}

