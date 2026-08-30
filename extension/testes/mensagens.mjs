// Exercita o background.js REAL com as APIs do chrome mockadas, do jeito que o
// popup o chama. E o teste que pega "o popup pergunta X e o background responde Y".
const EXT = new URL('..', import.meta.url).pathname

let listener = null
const store = { local: {}, session: {} }
const cookies = new Map()
let abaUrl = 'https://boldb2b.vtex.app/'

const area = (nome) => ({
  get: async (k) => (k == null ? { ...store[nome] } : { [k]: store[nome][k] }),
  set: async (o) => Object.assign(store[nome], o),
  remove: async (k) => { delete store[nome][k] },
})

globalThis.chrome = {
  tabs: { query: async () => [{ id: 7, url: abaUrl }], reload: async () => {} },
  storage: { local: area('local'), session: area('session') },
  cookies: {
    get: async ({ name }) => cookies.get(name) ?? null,
    set: async (c) => cookies.set(c.name, c),
    remove: async ({ name }) => cookies.delete(name),
  },
  runtime: { onMessage: { addListener: (fn) => { listener = fn } } },
  // A limpeza da sessão persistida roda dentro da página. Aqui só registramos
  // que foi chamada — o comportamento dela é testado em `sessao.mjs`.
  scripting: {
    executeScript: async ({ target }) => {
      injecoes.push(target.tabId)
      return [{ result: { limpou: true, tinhaPessoa: true, erro: null } }]
    },
  },
}
const injecoes = []
globalThis.fetch = async () => ({ text: async () => '', json: async () => ({}) })

await import(`${EXT}/background.js`)

const chamar = (msg) => new Promise((r) => listener(msg, null, r))

let f = 0
const t = (nome, cond, extra='') => { console.log(`  ${cond?'ok  ':'FALHOU '} ${nome}${extra?' — '+extra:''}`); if(!cond) f++ }

console.log('=== preview .vtex.app (o caso que quebrou) ===')
let { data } = await chamar({ action: 'status' })
t('reconhece o preview', data.ok === true, data.ok ? data.tipo : data.motivo)
t('NÃO cai na tela "fora de alcance"', data.ok === true)
t('conta lida do subdomínio', data.account === 'boldb2b', data.account)
t('marca origem como exata', data.origem === 'subdominio', data.origem)
t('manda a versão de protocolo', typeof data.protocolo === 'number', String(data.protocolo))
t('rótulo do ambiente existe', !!data.rotulo, data.rotulo)
t('sem sessão ainda', data.session === null)

console.log('\n=== localhost ===')
abaUrl = 'http://localhost:3000/'
;({ data } = await chamar({ action: 'status' }))
t('reconhece o local', data.ok === true && data.tipo === 'local', data.tipo)

console.log('\n=== myvtex.com deve ser recusado, COM motivo legível ===')
abaUrl = 'https://boldb2b.myvtex.com/'
;({ data } = await chamar({ action: 'status' }))
t('recusa', data.ok === false)
t('motivo definido (não "undefined")', typeof data.motivo === 'string' && data.motivo.length > 10)
t('motivo é frase completa, sem jargão', /^[A-Z].*\.$/.test(data.motivo ?? '') && !/cookie|sessão|admin|host/i.test(data.motivo ?? ''))
console.log(`       "${data.motivo}"`)

console.log('\n=== toda recusa tem motivo? ===')
for (const u of ['https://loja.bold.net/','https://exemplo.com/']) {
  abaUrl = u
  ;({ data } = await chamar({ action: 'status' }))
  t(`${u} recusado com motivo`, data.ok === false && typeof data.motivo === 'string', data.motivo?.slice(0,45))
}

console.log('\n=== ciclo cookie: injeta, lê, apaga ===')
abaUrl = 'https://boldb2b.vtex.app/'
const jwtFake = 'a.' + Buffer.from(JSON.stringify({sub:'teste@exemplo.com',account:'boldb2b',exp:Math.floor(Date.now()/1000)+86399})).toString('base64url') + '.z'
cookies.set('VtexIdclientAutCookie_boldb2b', { name:'VtexIdclientAutCookie_boldb2b', value: jwtFake })
;({ data } = await chamar({ action: 'status' }))
t('lê a sessão do cookie', data.session?.user === 'teste@exemplo.com', data.session?.user)
t('calcula expiração', data.session?.expiresIn > 86000, String(data.session?.expiresIn))
injecoes.length = 0
const saida = await chamar({ action:'logout', origin:'https://boldb2b.vtex.app', account:'boldb2b', tabId:7 })
t('logout apaga o cookie', !cookies.has('VtexIdclientAutCookie_boldb2b'))
t('logout TAMBÉM limpa a sessão da página', injecoes.includes(7), `injeções: ${injecoes.length}`)
t('e reporta o que limpou', saida.data?.limpeza?.limpou === true, JSON.stringify(saida.data?.limpeza))

console.log(f ? `\n${f} FALHA(S)` : '\nTudo passou.')
process.exit(f ? 1 : 0)
