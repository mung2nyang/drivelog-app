import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'

export async function load(url, context, nextLoad) {
  if (url.endsWith('.css')) return { format: 'module', source: 'export default {}', shortCircuit: true }
  const loader = url.endsWith('.jsx') ? 'jsx' : url.endsWith('.tsx') ? 'tsx' : url.endsWith('.ts') ? 'ts' : null
  if (!loader) return nextLoad(url, context)
  const filePath = fileURLToPath(url)
  const source = await readFile(filePath, 'utf8')
  const { code } = esbuild.transformSync(source, {
    loader,
    format: 'esm',
    jsx: 'automatic',
    sourcefile: filePath,
  })
  return { format: 'module', source: code, shortCircuit: true }
}
