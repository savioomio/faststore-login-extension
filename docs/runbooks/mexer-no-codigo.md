# Mexer no código da extensão

> **O código não tem comentários — de propósito.** O que explicaria cada trecho
> está aqui. Antes de editar um arquivo, leia a seção dele: quase toda linha
> estranha é estranha por um motivo medido, e "arrumar" sem saber reintroduz um
> bug que já custou caro.
>
> Regra da casa: comentário vive em `.md`, não em `.js`. Se você descobrir algo
> novo mexendo no código, **atualize este arquivo**, não escreva no fonte.

---

## Mapa

| Arquivo | Responsabilidade |
|---|---|
| `manifest.json` | Permissões. Quatro hosts, quatro permissões, nada de `<all_urls>`. |
| `alvo.js` | **Onde a extensão pode escrever sessão** e como descobre a loja. |
| `vtexid.js` | O handshake com o VTEX ID. |
| `background.js` | Service worker: orquestra, guarda o token, escreve o cookie. |
| `sessao-da-pagina.js` | Zera a sessão que o FastStore guarda no IndexedDB. |
| `popup.*` | Interface. Não faz rede nem toca em cookie. |

Fluxo de um login por código:

```
popup → background.sendCode  → vtexid.start + accesskey/send → guarda token
                                                                (chrome.storage.session)
popup → background.loginCode → vtexid.accesskey/validate → JWT
                             → chrome.cookies.set
                             → sessao-da-pagina (limpa IndexedDB)
                             → chrome.tabs.reload
```

---

## `vtexid.js`

**Tudo roda com `credentials: 'omit'` e o `authenticationToken` no corpo.** Não é
estilo: é o que impede o navegador de trocar a sessão por outra (o bug "código
válido responde `WrongCredentials`") e o que preserva a sessão de admin de quem
desenvolve. Ver [ADR-0002](../adr/0002-handshake-stateless-token-no-corpo.md).

Armadilhas, todas medidas:

1. **Sucesso do `accesskey/send` é corpo VAZIO.** Se vier JSON com `authStatus`,
   é **falha**. Tratar ao contrário faz o usuário esperar um e-mail que não vem.
2. **O campo é `accesskey` minúsculo** no `accesskey/validate`. No
   `classic/setpassword` é `accessKey`. Não é typo — são convenções diferentes
   de endpoints diferentes.
3. **Falhas `4xx` às vezes vêm em `code`, não em `authStatus`.** Por isso
   `errorCodeOf` lê `authStatus ?? code ?? error.code ?? errors[0]`. Um cliente
   que só lê `authStatus` vira "erro inesperado" sem diagnóstico.
4. **O JWT vem no CORPO** (`authCookie.Value`), não só no `Set-Cookie`. É isso
   que dispensa ler header de resposta de outro domínio — o que em MV3 exigiria
   `webRequest` com permissão larga.
5. **Nunca misture as duas famílias de API.** Este arquivo é 100% legacy
   (`/api/vtexid/pub/`). O token da authenticator (`/api/authenticator/pub/`) dá
   `InvalidToken` aqui.
6. **`WrongCredentials` é ambíguo por design** (anti-enumeração da VTEX): senha
   errada, código errado, código **já usado**, código expirado ou usuário
   inexistente respondem igual. Por isso `messageFor` recebe um `contexto`
   (`"codigo"` / `"senha"`) — para escolher **quais saídas citar**, nunca para
   fingir diagnóstico. E nenhuma mensagem pode revelar se o e-mail existe
   ([R-5](../rules/seguranca.md#r-5--mensagem-de-erro-nunca-revela-se-o-usuário-existe)).

Referência completa dos endpoints: [`reference/vtex-id.md`](../reference/vtex-id.md).

---

## `alvo.js`

É o arquivo mais sensível: decide **onde uma sessão pode ser escrita**. Vive
separado por isso — dá para ler a regra inteira de uma vez.

- `localhost` / `127.0.0.1` — o `@faststore/core` tem carve-out explícito para
  cookie injetado (`utils/isLocalHost.ts`), e **a lista lá é fechada**: nem
  `0.0.0.0`, nem IP de rede local funcionam, por mais que pareçam equivalentes.
- `*.vtex.app` — o preview que vai para o cliente.
- `*.myvtex.com` — **recusado**: é onde vive a sessão real de admin de quem
  desenvolve.
- Produção — recusada por **desnecessidade**, não por medo. Ver
  [ADR-0004](../adr/0004-preview-entra-producao-nao.md).

⚠️ **Teste de sufixo ingênuo é furado.** `localhost.evil.com` termina com
`.com` mas começa com `localhost`; `evil-vtex.app.com` contém `vtex.app`. Os dois
são recusados hoje e há teste travando isso — se você mexer na classificação,
rode `testes/alvo.mjs`.

**Descoberta da loja**, em ordem:

1. **Subdomínio**, em `.vtex.app` — `boldb2b.vtex.app` → `boldb2b`. Exato, sem
   palpite. Trata deploy de branch (`algo--conta.vtex.app` → pega o último).
2. **Frequência no HTML**, em localhost — conta citações de
   `<loja>.vtexassets.com`, `.myvtex.com`, `.vtex.app` e `.vtexcommercestable.com.br`,
   menos uma denylist. Medido: 58 citações contra 5 do segundo colocado.
   É **heurística** — por isso o campo no rodapé do popup é editável.

Não há caminho canônico: o `__NEXT_DATA__` **não** carrega o `storeId` e a loja
não serializa o `discovery.config` (medido em 2026-08-30, no localhost e no
preview).

---

## `background.js`

**`PROTOCOLO` — suba o número ao mudar o formato das mensagens.** O Chrome
recarrega o popup ao editar arquivos mas **pode manter o service worker antigo
vivo**; o popup novo conversa com o background velho, os campos não batem e a
tela mostra `undefined`, que não parece nem de longe com "recarregue a
extensão". Aconteceu de verdade.

**O token do login em andamento vive em `chrome.storage.session`, não numa
variável de módulo.** O service worker do MV3 é desligado após ~30s de
ociosidade — e o intervalo entre pedir o código e digitá-lo é exatamente você
indo até o e-mail. Variável de módulo perderia o token nesse instante, e o
sintoma seria um código **válido** respondendo `InvalidToken`.
`chrome.storage.session` é memória: não vai para o disco e some ao fechar o
navegador.

**Correção manual da loja vence a detecção** (`ultimo.manual`), para a mesma
origem. Sem isso o campo "editável" não gruda: você corrige, a tela se redesenha,
a heurística roda de novo e devolve o palpite errado por cima do seu acerto. O
`finish()` preserva a marca `manual` — logar com sucesso não é motivo para a
extensão voltar a achar que sabe melhor.

**Cookie:** `httpOnly` como a VTEX faz (nenhum código de cliente lê este cookie
por `document.cookie` — quem lê é o servidor, por header); `secure` acompanha o
esquema da origem (obrigatório em `.vtex.app`, impossível em `http://localhost`).

**`RECEM` e o diagnóstico de sumiço.** Guarda "acabei de logar aqui". Se o
`status` seguinte não achar sessão, é porque a loja a apagou — e aí a mensagem
explica a causa em vez de deixar parecer código errado. Isso acontece em preview
quando a loja tem `experimental.refreshToken: true`; ver
[reference §4](../reference/faststore-sessao.md#4-o-caso-refreshtoken-true).
**Não há o que a extensão faça** — a renovação depende de um cookie de outra
origem.

---

## `sessao-da-pagina.js`

**Apagar o cookie NÃO desloga a interface.** O FastStore persiste a sessão
inteira — inclusive `person` — no IndexedDB, e re-hidrata dali no reload. Sem
este arquivo, a loja continua mostrando "Minha conta", o botão de favoritos
continua se achando logado, e qualquer ação falha — parecendo que a extensão não
deslogou.

```
banco             keyval-store
object store      keyval
chave             fs::session
```

A função `limparNaPagina` roda **dentro da página** via
`chrome.scripting.executeScript`, e por isso precisa ser autocontida: não enxerga
nada do escopo da extensão, só os argumentos.

⚠️ **Não apague a chave inteira.** Zere só `person`, `b2b` e `refreshAfter` —
exatamente o que o `logoutAndClearSession` do framework faz. A chave carrega
junto `postalCode`, `locale` e `channel`: apagar tudo faria o desenvolvedor
perder o CEP a cada troca de usuário, o que é mais irritante que o problema
original. Há teste travando isso.

Roda no logout **e no login** — no login para o usuário anterior não aparecer no
intervalo entre o reload e a resposta do `validateSession`.

`indexedDB.databases()` antes de abrir evita **criar** um banco vazio numa loja
que nunca o escreveu.

Detalhes e como conferir no DevTools:
[`reference/faststore-sessao.md`](../reference/faststore-sessao.md).

---

## `popup.js`

Só desenha e coleta: rede e cookie são do service worker.

- O campo de código aceita colar e **envia sozinho ao completar 6 dígitos**.
- O rodapé mostra a loja detectada; o campo de edição só aparece se a detecção
  falhar ou se você clicar no lápis. Quem usa não precisa saber o que é "conta
  VTEX" para logar.
- `aplicaModo()` desenha a partir do que a conta habilita (`show*Authentication`
  do `start`), sem chutar o método — é o que faz a extensão servir B2C e B2B sem
  ramificação.

**As mensagens de erro vêm prontas do `vtexid.js`.** Não "melhore" com
diagnóstico que a plataforma não deu, e não revele se o e-mail existe.

---

## Testes

```bash
node testes/alvo.mjs        # onde pode agir + descoberta da loja
node testes/sessao.mjs      # limpeza do IndexedDB
node testes/mensagens.mjs   # background com o chrome mockado
node testes/vtexid.mjs      # handshake contra a conta REAL (rede)
```

Node puro, sem dependências. **Rode os quatro depois de mexer em qualquer coisa.**

⚠️ **Espace os de rede.** `start` tem rate limit de 200 e, após poucas tentativas
seguidas, a VTEX responde `200` fantasma no `send` **sem enviar e-mail** e
bloqueia o usuário por 15–30 min. Um bloqueio no meio de uma investigação faz
você concluir a coisa errada.

Um login **bem-sucedido** nunca foi automatizado: exigiria consumir código de
acesso de usuário real. Isso se testa à mão, no navegador.
