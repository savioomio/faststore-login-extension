// Exercita a função que roda DENTRO da página, contra um IndexedDB real
// (fake-indexeddb se disponível; senão, um duplo fiel da API).
import { readFileSync } from 'node:fs'

let f = 0
const t = (n, c, e='') => { console.log(`  ${c?'ok  ':'FALHOU '} ${n}${e?' — '+e:''}`); if(!c) f++ }

// --- extrai a função injetada do arquivo real, sem duplicá-la aqui ---
const src = readFileSync(new URL('../sessao-da-pagina.js', import.meta.url), 'utf8')
const inicio = src.indexOf('async function limparNaPagina')
const fim = src.indexOf('\n}', src.indexOf('return resultado;\n}', inicio)) + 2
const corpo = src.slice(inicio, fim)
t('extraiu limparNaPagina do arquivo real', corpo.startsWith('async function limparNaPagina'))

// --- duplo do IndexedDB, com o suficiente para o caminho exercitado ---
const dados = new Map()
let bancos = [{ name: 'keyval-store' }]
const req = (valor, erro=null) => { const r = { result: valor, error: erro }; queueMicrotask(() => (erro ? r.onerror?.() : r.onsuccess?.())); return r }

globalThis.indexedDB = {
  databases: async () => bancos,
  open: (nome) => req({
    objectStoreNames: { contains: (s) => s === 'keyval' },
    close: () => {},
    transaction: () => {
      const tx = {}
      queueMicrotask(() => queueMicrotask(() => tx.oncomplete?.()))
      tx.objectStore = () => ({
        get: (k) => req(dados.get(k)),
        put: (v, k) => { dados.set(k, v); return req(undefined) },
      })
      return tx
    },
  }),
}
globalThis.sessionStorage = { removeItem() { this.removido = true } }

const limparNaPagina = eval(`(${corpo.replace('async function limparNaPagina','async function')})`)
const rodar = () => limparNaPagina('keyval-store','keyval','fs::session','faststore_session_ready')

console.log('\n=== sessão logada é zerada ===')
dados.set('fs::session', {
  person: { id: 'u1', email: 'cliente@exemplo.com' },
  b2b: { customerId: 'c1', isRepresentative: true },
  refreshAfter: '123',
  postalCode: '01310-100', locale: 'pt-BR', channel: '{"salesChannel":1}',
})
let r = await rodar()
const s = dados.get('fs::session')
t('reporta que limpou', r.limpou === true && r.tinhaPessoa === true, JSON.stringify(r))
t('person zerado', s.person === null)
t('b2b zerado', s.b2b === null)
t('refreshAfter zerado', s.refreshAfter === null)
t('PRESERVA o CEP', s.postalCode === '01310-100', s.postalCode)
t('PRESERVA locale e canal', s.locale === 'pt-BR' && s.channel === '{"salesChannel":1}')
t('limpa a flag de prontidão', globalThis.sessionStorage.removido === true)

console.log('\n=== sessão já deslogada: não quebra ===')
r = await rodar()
t('roda sem erro', r.erro === null, JSON.stringify(r))
t('reporta que não havia pessoa', r.tinhaPessoa === false)

console.log('\n=== banco inexistente: não cria nada ===')
bancos = []
dados.clear()
r = await rodar()
t('sai limpo', r.limpou === false && r.erro === null, JSON.stringify(r))
t('não escreveu nada', dados.size === 0)

console.log(f ? `\n${f} FALHA(S)` : '\nTudo passou.')
process.exit(f ? 1 : 0)
