// Exercita o codigo REAL da extensao (vtexid.js) e a heuristica de deteccao
// copiada verbatim do background.js, contra o localhost e a conta de verdade.
import { start, sendAccessKey, loginWithAccessKey, loginWithPassword, VtexIdError } from '../../extension/vtexid.js'

const NAO_E_CONTA = new Set(['vtex','starter','www','io','assets'])
async function detectAccount(origin) {
  const html = await (await fetch(origin, { credentials: 'omit' })).text()
  const padroes = [
    /https:\/\/([a-z0-9][a-z0-9-]*)\.vtexassets\.com/g,
    /https:\/\/(?:[a-z0-9-]+--)?([a-z0-9][a-z0-9-]*)\.myvtex\.com/g,
    /https:\/\/([a-z0-9][a-z0-9-]*)\.vtex\.app/g,
    /https:\/\/([a-z0-9][a-z0-9-]*)\.vtexcommercestable\.com\.br/g,
  ]
  const votos = new Map()
  for (const p of padroes)
    for (const [, c] of html.matchAll(p)) {
      if (NAO_E_CONTA.has(c)) continue
      votos.set(c, (votos.get(c) ?? 0) + 1)
    }
  return [...votos.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0] ?? ''
}

let falhas = 0
const t = (nome, cond, extra='') => { console.log(`  ${cond?'ok  ':'FALHOU '} ${nome}${extra?' — '+extra:''}`); if(!cond) falhas++ }

console.log('=== 1. deteccao de conta (background.js) ===')
const conta = await detectAccount('http://localhost:3000')
t('detecta a conta na pagina servida', conta === 'boldb2b', `detectou "${conta}"`)

console.log('\n=== 2. start (vtexid.js) ===')
const { token, methods } = await start(conta)
t('abre sessao e devolve token', typeof token === 'string' && token.length > 30)
t('le os metodos da conta', typeof methods.password === 'boolean')
console.log(`       metodos: password=${methods.password} accessKey=${methods.accessKey}`)

console.log('\n=== 3. login por senha errada -> erro tratado, sem vazar existencia ===')
try {
  await loginWithPassword(conta, token, 'naoexiste-teste-wc@exemplo.com', 'SenhaErrada1')
  t('deveria ter lancado', false)
} catch (e) {
  t('lanca VtexIdError', e instanceof VtexIdError, `code=${e.code}`)
  t('mensagem do fluxo de SENHA nao fala de codigo', !/c[oó]digo/i.test(e.message)) && t('mensagem nao revela se o e-mail existe',
     !/n[ãa]o (existe|cadastrad)|inexistente|no encontrado/i.test(e.message))
  console.log(`       "${e.message}"`)
}

console.log('\n=== 4. codigo errado -> erro tratado ===')
try {
  await loginWithAccessKey(conta, token, 'naoexiste-teste-wc@exemplo.com', '000000')
  t('deveria ter lancado', false)
} catch (e) {
  t('lanca VtexIdError com codigo', e instanceof VtexIdError && !!e.code, `code=${e.code}`)
  console.log(`       "${e.message}"`)

  if (e.code === 'HTTP_401') {
    // Nao e falha de codigo: a VTEX bloqueou a conta por excesso de tentativas
    // (justamente o que estes testes provocam). Ver docs/testes/README.md.
    console.log('       ATENCAO: a conta esta BLOQUEADA temporariamente pela VTEX.')
    console.log('       Isto e condicao de ambiente, nao defeito do codigo.')
    console.log('       Espere 15-30 min e rode de novo para valer.')
    t('avisa sobre o bloqueio, sem mandar tentar de novo',
      /bloqueou|aguarde|espere/i.test(e.message) && !/^Não foi possível concluir/.test(e.message))
  } else {
    t('mensagem do fluxo de CODIGO cita o uso unico', /única vez|uma única/i.test(e.message))
  }
}

console.log('\n=== 5. token ausente -> InvalidToken (nao "codigo errado") ===')
try {
  await loginWithAccessKey(conta, '', 'naoexiste-teste-wc@exemplo.com', '000000')
  t('deveria ter lancado', false)
} catch (e) {
  t('distingue sessao expirada de credencial ruim', e.code === 'InvalidToken', `code=${e.code}`)
}

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo passou.')
process.exit(falhas ? 1 : 0)
