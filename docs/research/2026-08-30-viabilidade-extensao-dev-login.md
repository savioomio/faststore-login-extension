# 2026-08-30 — Viabilidade da extensão de dev-login

> **Pergunta:** dá para uma extensão de navegador logar um usuário VTEX numa loja
> FastStore rodando em `localhost`, informando só e-mail e código, sem passar
> pelo ambiente IO e sem copiar cookie na mão?
>
> **Resposta: dá, e é mais limpo do que se esperava.** Os dois lados do circuito
> foram medidos ao vivo hoje contra a conta `boldb2b`, com a loja rodando em
> `http://localhost:3000`. Duas descobertas mudam o desenho: o handshake do VTEX
> ID é **stateless** (§2), e o FastStore **já foi construído** esperando cookie
> injetado na mão em localhost (§3).
>
> Ambiente: `faststore-boldb2b`, `@faststore/cli ^4.4.0`, conta `boldb2b`,
> workspace `master`. Nada foi alterado no projeto da loja — só leitura e `curl`.

---

## 0. O problema, como ele é hoje

Para testar qualquer coisa que exija sessão (favoritos, minha conta, preço por
organização, carrinho B2B) em `localhost`, o caminho atual é:

1. logar em `boldb2b.myvtex.com` (ambiente IO),
2. abrir o DevTools e copiar o `VtexIdclientAutCookie_boldb2b`,
3. colar no `localhost:3000` na mão,
4. e repetir tudo isso **a cada troca de usuário**.

Trocar de conta é o pior caso: é o passo 1 ao 3 inteiro, mais o logout do IO.
Em loja B2B — onde o interessante é justamente comparar **usuários de
organizações diferentes** — isso acontece dezenas de vezes por dia.

### Por que o cookie não cola sozinho

O VTEX ID devolve o cookie com `Domain=boldb2b.myvtex.com`. Medido hoje:

```
$ curl -i "https://boldb2b.myvtex.com/api/vtexid/pub/authentication/start?scope=boldb2b&accountName=boldb2b"

set-cookie: _vss=<token>; expires=…; domain=boldb2b.myvtex.com; path=/; secure; samesite=none; httponly
```

Um front em `localhost` está em outra origem. O cookie **não cola** — daí o
copia-e-cola manual. É o mesmo problema que o `faststore-login-modal` resolve em produção
re-emitindo o cookie no resolver; aqui não há resolver no meio, então quem
re-emite tem de ser a extensão.

---

## 1. A conta `boldb2b` aceita login por código

Contraria a leitura pessimista da base de conhecimento ([§7 de
`docs/reference/vtex-id.md`](../reference/vtex-id.md), que diz que B2B não suporta código de acesso
como **login**). O que a conta responde:

```
$ curl -s "https://boldb2b.myvtex.com/api/vtexid/pub/authentication/start?scope=boldb2b&accountName=boldb2b"
{
  "authenticationToken": "<token>",
  "oauthProviders": [],
  "showClassicAuthentication": true,
  "showAccessKeyAuthentication": true,     ← código de acesso HABILITADO
  "showPasskeyAuthentication": false,
  "isAuthenticated": false
}
```

Header da resposta: `x-vtex-janus-router-backend-app: vid-v4.205.6-prd-026` (família legacy).

**Consequência de desenho:** a extensão **não deve chutar** o método. Ela roda o
`start` e desenha a UI a partir dos flags `show*Authentication` — exatamente como
o `useVtexIdAuth` já faz. Assim ela funciona em B2C e B2B sem ramificação.

> ⚠️ **Limite:** o flag diz que a conta **tem o método habilitado**. Não foi
> testado ponta a ponta com um usuário real da `boldb2b` (exigiria consumir um
> código de acesso de uma caixa de e-mail real). Ver §6.

---

## 2. 🔑 Descoberta: o handshake é *stateless*

**A base de conhecimento diz que o `_vss` precisa viajar como cookie entre os
passos** — é a "regra de ouro nº 2", a que "custou horas de investigação".
Medido hoje: o `authenticationToken` funciona **no corpo do formulário**, e o
resultado é idêntico ao do cookie.

Com um `<token>` obtido de um `start`:

```
A) token no CORPO, sem cookie
$ curl -X POST ".../pub/authentication/accesskey/validate" \
    -d "authenticationToken=<token>&login=usuario@exemplo.com&accesskey=000000"
   → {"authStatus": "WrongCredentials"}          ← a sessão foi aceita

B) token só no COOKIE
$ curl -X POST ".../pub/authentication/accesskey/validate" \
    -H "cookie: _vss=<token>" \
    -d "login=usuario@exemplo.com&accesskey=000000"
   → {"authStatus": "WrongCredentials"}          ← idêntico a (A)

C) sem token nenhum
$ curl -X POST ".../pub/authentication/accesskey/validate" \
    -d "login=usuario@exemplo.com&accesskey=000000"
   → {"authStatus": "InvalidToken"}              ← prova que (A) e (B) valeram
```

O mesmo vale para `classic/validate`:

```
com  authenticationToken no corpo → WrongCredentials
sem  authenticationToken          → InvalidToken
```

E o `accesskey/send` já era assim (o modal manda o token no corpo desde sempre —
`arquivo/faststore-login-modal/src/graphql/vtex/resolvers/vtexIdAuth.ts:371`).

### Por que isso muda tudo

A extensão pode rodar **todo** o handshake com `credentials: 'omit'`, guardando o
token numa variável do service worker. Consequências:

1. **A regra de ouro nº 2 deixa de ser um risco.** Não há como o navegador
   substituir o `_vss` por outro: a extensão manda o token exato que recebeu.
   Some a classe de bug mais cara do fluxo — "código válido responde
   `WrongCredentials`".
2. **A extensão não toca na sessão real do dev em `myvtex.com`.** Sem
   `credentials: 'include'`, nada do jar do navegador é enviado nem sobrescrito.
   Logar um usuário de teste pela extensão **não derruba** o login do admin no
   ambiente IO — que é exatamente a dor de hoje.
3. **Sem `_vss`, sem cookie de terceiro domínio, sem `declarativeNetRequest`**
   para forjar header `Cookie` (que o `fetch` não deixa setar). O desenho fica
   trivial.

> Isto é conhecimento novo sobre a plataforma e **não vale só para a extensão**:
> foi promovido para [`docs/reference/vtex-id.md`](../reference/vtex-id.md) §2.5.

---

## 3. 🔑 Descoberta: o FastStore já espera cookie injetado na mão

Não é gambiarra tolerada — é **recurso documentado no código do framework**.
`@faststore/core/src/utils/isLocalHost.ts`, comentário do próprio arquivo:

> *"These are the only hosts where the FastStore app skips the refresh-token flow
> so developers can drive the app with a **manually injected
> `VtexIdclientAutCookie_<account>` cookie** regardless of feature flags."*

E o fluxo de refresh-token desiste explicitamente para **não apagar** esse cookie
(`@faststore/core/src/sdk/account/useRefreshToken.ts:17-22`):

> *"From localhost the request is […] which would also wipe the manually injected
> `VtexIdclientAutCookie_<account>`"*

O hostname precisa ser exatamente `localhost` ou `127.0.0.1` — a lista é fechada
(`LOCAL_HOSTNAMES`, `isLocalHost.ts:8`).

### O nome do cookie é único e previsível

O core lê a sessão de um cookie só, montado por concatenação:

```ts
// @faststore/core/src/utils/getCookie.ts:29
parse(headers?.cookie ?? '')?.['VtexIdclientAutCookie_' + account]
```

Mesma coisa em `getIsRepresentative.ts:14` (B2B) e em `pages/api/graphql.ts:143`.
Ou seja: **`VtexIdclientAutCookie_<storeId>`**, onde `<storeId>` é o
`api.storeId` do `discovery.config.js` — `boldb2b` nesta loja
(`faststore-boldb2b/discovery.config.js`, `api.storeId`).

**A extensão precisa escrever um cookie. Um só.** Não precisa do
`VtexIdclientAutCookie_<guid>`, nem de `vtex_session`, nem de `vtex_segment`
para estabelecer identidade.

---

## 4. O circuito, medido ponta a ponta

Com a loja rodando em `localhost:3000`:

```
$ curl -X POST 'http://localhost:3000/api/graphql?operationName=WishlistLists&operationHash=<hash>' \
    -H 'content-type: application/json' -d '{…}'
  → {"data":{"wishlistLists":null}}                      SEM cookie: nulo
```

Com um cookie de formato válido mas assinatura falsa, indo até a IO:

```
$ curl -X POST 'https://master--boldb2b.myvtex.com/_v/private/graphql/v1' \
    -H "cookie: VtexIdclientAutCookie_boldb2b=<jwt-falso>" \
    -H 'x-b2b-senderapp: vtex.b2b-organizations@1.x' \
    -d '{"query":"query{getWishlistsByEmail{id email}}"}'
  → {"errors":[{"message":"Unauthorized access", … "status":401 …}]}
```

Isto fecha o circuito: o cookie **é lido** pelo resolver do localhost
(`faststore-boldb2b/src/graphql/vtex/resolvers/wishlist.ts:121-131`), **é
repassado** à IO, e a IO o **avalia** — recusando só porque a assinatura é falsa.
Com um JWT real, o favorito funciona.

> O resolver de leitura degrada calado para `null` de propósito
> (`wishlist.ts:143-149`): lista indisponível não derruba a PDP. Por isso a
> resposta do localhost é `null` e não um erro — o diagnóstico só aparece batendo
> direto na IO, como acima. **Vale como dica de depuração.**

### O fluxo completo que a extensão vai executar

```
  ┌─ extensão (service worker), credentials: 'omit' ─────────────────────┐
  │                                                                       │
  │  1. GET  /api/vtexid/pub/authentication/start?scope=<conta>…          │
  │         → { authenticationToken, show*Authentication }                │
  │           guarda o token em memória (10 min)                          │
  │                                                                       │
  │  2. POST /api/vtexid/pub/authentication/accesskey/send?email=<email>  │
  │         body: authenticationToken=<token>                             │
  │         → sucesso é CORPO VAZIO (JSON com authStatus = FALHA)         │
  │                                                                       │
  │  3. [dev digita o código de 6 dígitos no popup]                       │
  │                                                                       │
  │  4. POST /api/vtexid/pub/authentication/accesskey/validate            │
  │         body: authenticationToken=<token>&login=<email>&accesskey=…   │
  │         → { authStatus: "Success", authCookie: { Name, Value } }      │
  └───────────────────────────────────────────────────────────────────────┘
                                    ↓
     5. chrome.cookies.set({
          url:   'http://localhost:3000',
          name:  'VtexIdclientAutCookie_' + conta,
          value: authCookie.Value        ← o JWT vem no CORPO da resposta
        })
                                    ↓
     6. chrome.tabs.reload()  →  loja logada
```

**O passo 5 é o pulo do gato do passo 4:** o JWT vem no **corpo JSON**
(`authCookie: { Name, Value }`), não só no `Set-Cookie`. Confirmado na forma da
resposta medida hoje — todo retorno de autenticação traz os campos
`authCookie` e `accountAuthCookie`. A extensão nunca precisa ler header
`Set-Cookie` de outro domínio, o que em MV3 exigiria `webRequest` com permissão
larga.

### Logout e troca de usuário, que era a dor original

- **Logout** = `chrome.cookies.remove` + reload. Uma linha.
- **Trocar de usuário** = sobrescrever o cookie. Não precisa deslogar antes.
- **Trocar instantâneo** = o JWT vale **24h** (`expiresIn: 86399`). Logando uma
  vez cada conta de teste, dá para guardar os JWTs e alternar entre elas **sem
  novo código de e-mail** durante o dia inteiro. É a funcionalidade que resolve
  "trocar de usuário é um trapo" — e é uma decisão em aberto, ver
  [`tasks/extensao.md`](../tasks/extensao.md) T-004.

---

## 5. Permissões mínimas

Verificado contra o que cada passo precisa. Nada de `<all_urls>` (ver
[R-8](../rules/seguranca.md#r-8--permissões-da-extensão-o-mínimo-que-funciona)).

```jsonc
{
  "manifest_version": 3,
  "permissions": [
    "cookies",   // passo 5: escrever/remover o cookie de sessão
    "storage",   // perfis salvos
    "tabs"       // recarregar a aba após injetar
  ],
  "host_permissions": [
    "http://localhost/*",     // alvo do cookie
    "http://127.0.0.1/*",     // idem — a outra metade de LOCAL_HOSTNAMES
    "https://*.myvtex.com/*"  // origem do handshake do VTEX ID
  ]
}
```

Notas:
- **`cookies` sem `host_permissions` do alvo não escreve nada** — as duas entradas
  de localhost são obrigatórias, não redundantes.
- `*.myvtex.com` é largo, mas é o menor recorte possível: a conta varia por
  projeto (`boldb2b`, `b2bgcb`, …) e o host é `<workspace>--<conta>.myvtex.com`.
- **Não** precisa de `webRequest` nem `declarativeNetRequest` — consequência
  direta de §2 e do JWT vir no corpo (§4).

---

## 6. Limites desta investigação

O que **foi** medido ao vivo hoje, contra `boldb2b` + `localhost:3000`:

- ✅ `start` responde e diz quais métodos a conta habilita.
- ✅ `authenticationToken` no corpo é aceito por `accesskey/validate` e
  `classic/validate`; sem ele, `InvalidToken`.
- ✅ `accesskey/send` aceita o token no corpo e responde `200`.
- ✅ A forma da resposta de autenticação inclui `authCookie` e `accountAuthCookie`.
- ✅ O localhost lê `VtexIdclientAutCookie_boldb2b` e o repassa à IO, que o avalia.
- ✅ Os nomes de cookie e o tratamento especial de localhost no `@faststore/core`
  (citações de arquivo e linha em §3).

O que **não** foi medido, e por quê:

- ❌ **Um login real ponta a ponta.** Exigiria consumir um código de acesso de uma
  caixa de e-mail real de um usuário da `boldb2b`. Não foi feito para não gastar
  código de usuário alheio nem esbarrar no bloqueio por tentativas
  ([R-7](../rules/seguranca.md#r-7--respeite-os-limites-da-plataforma)).
  **É o primeiro teste a fazer quando a extensão existir** — e é o único que
  prova §4 inteiro.
- ❌ **O favorito da PDP com JWT real.** Depende do item acima. O que está provado
  é que a recusa atual é de **assinatura**, não de caminho: o cookie chega até a IO.
- ❌ **Comportamento em B2B com contrato inativo.** A base de conhecimento (§7)
  registra um furo de segurança na rota **legacy** `classic/setpassword` nesse
  cenário. A extensão **não implementa `setpassword`** — só login — então o furo
  não a alcança. Se um dia implementar, tem de ser pela família authenticator.
- ❌ **Extensões em navegadores não-Chromium.** O alvo declarado é o Comet
  (Chromium). O `chrome.cookies` do Firefox tem diferenças em `SameSite`, não
  verificadas.

---

## O que sai daqui

| Vira | Onde |
|---|---|
| Decisão: extensão, e não BFF/patch | [ADR-0001](../adr/0001-extensao-em-vez-de-bff.md) |
| Decisão: handshake stateless | [ADR-0002](../adr/0002-handshake-stateless-token-no-corpo.md) |
| Conhecimento de plataforma (token no corpo) | [`docs/reference/vtex-id.md`](../reference/vtex-id.md) §2.5 |
| Tarefas | [`tasks/extensao.md`](../tasks/extensao.md) |
