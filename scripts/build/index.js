import { copy } from './copy.js'
import { render } from '../html/render.js'
import { clean } from '../clean.js'
import { js } from './js.js'
import { fileURLToPath } from 'url'

export async function build() {
  clean()
  copy()
  const emitted = await js()
  render(emitted)
  return emitted
}

if (process.argv[1] === fileURLToPath(import.meta.url)) build()

