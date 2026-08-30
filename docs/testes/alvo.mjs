import { classificaHost, contaPeloSubdominio, contaPeloHtml } from '../../extension/alvo.js'

let f = 0
const t = (nome, cond, extra='') => { console.log(`  ${cond?'ok  ':'FALHOU '} ${nome}${extra?' — '+extra:''}`); if(!cond) f++ }

console.log('=== ACEITA ===')
for (const [h, tipo] of [['localhost','local'],['127.0.0.1','local'],
                          ['boldb2b.vtex.app','preview'],['LOJA.VTEX.APP','preview'],
                          ['abc123--boldb2b.vtex.app','preview']]) {
  const c = classificaHost(h)
  t(`${h} → ${tipo}`, c.ok && c.tipo === tipo, c.ok ? c.tipo : c.motivo?.slice(0,40))
}

console.log('\n=== RECUSA (o que não pode receber sessão) ===')
for (const h of ['loja.bold.net','boldb2b.myvtex.com','master--boldb2b.myvtex.com',
                 'vtex.app','evil-vtex.app.com','0.0.0.0','192.168.0.10','localhost.evil.com']) {
  const c = classificaHost(h)
  t(`${h} recusado`, !c.ok, c.ok ? `⚠ ACEITOU como ${c.tipo}` : '')
}

console.log('\n=== conta pelo subdomínio ===')
t('boldb2b.vtex.app', contaPeloSubdominio('boldb2b.vtex.app') === 'boldb2b')
t('deploy de branch', contaPeloSubdominio('abc123--boldb2b.vtex.app') === 'boldb2b')
t('localhost não tem', contaPeloSubdominio('localhost') === '')
t('ruído "vtex" ignorado', contaPeloSubdominio('vtex.vtex.app') === '')

console.log('\n=== conta pelo HTML ===')
t('heurística acha a mais citada',
  contaPeloHtml('<img src="https://boldb2b.vtexassets.com/a"><a href="https://boldb2b.myvtex.com/x"><i src="https://starter.vtex.app/y">') === 'boldb2b')
t('html vazio devolve vazio', contaPeloHtml('') === '')

console.log(f ? `\n${f} FALHA(S)` : '\nTudo passou.')
process.exit(f ? 1 : 0)
