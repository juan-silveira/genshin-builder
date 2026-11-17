// Empacota o servidor num único arquivo (build/server.mjs) para a imagem Docker não precisar de node_modules.
import { build } from 'esbuild'

const common = {
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  // login pela janela do Chrome só existe no PC; no servidor essa rota fica desligada
  external: ['playwright-core'],
  // dependências CommonJS (express) usam require()
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: 'warning',
}
await build({ ...common, entryPoints: ['server/src/index.ts'], outfile: 'build/server.mjs' })
// importação dos dados do app antigo (uso único, dentro do container)
await build({ ...common, entryPoints: ['scripts/import-local.ts'], outfile: 'build/import.mjs' })
console.log('ok build/server.mjs build/import.mjs')
