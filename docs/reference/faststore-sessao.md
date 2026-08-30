# FastStore — onde a sessão do cliente realmente mora

> **A sessão não é o cookie.** O cookie autentica no servidor; a interface se
> guia por uma cópia da sessão guardada **no IndexedDB do navegador**. Quem mexe
> em autenticação sem saber disso produz o pior tipo de bug: a tela diz uma
> coisa, o servidor diz outra.
>
> Medido em 2026-08-30 contra `@faststore/core` (`@faststore/cli ^4.4.0`) e
> `@faststore/sdk` com `idb-keyval` 6.2.5.

---

## 1. As três camadas

| Camada | Onde vive | Quem escreve | Some quando |
|---|---|---|---|
| **Autenticação** | cookie `VtexIdclientAutCookie_<conta>` | VTEX ID (ou a extensão) | expira em 24h, ou se apagado |
| **Sessão da interface** | **IndexedDB**, `keyval-store` → `keyval` → `fs::session` | `sessionStore` do framework | só se alguém apagar |
| **Prontidão da tela** | `sessionStorage`, `faststore_session_ready` | `useSessionReady` | ao fechar a aba |

Nomes exatos, e como se chega neles:

```
banco             keyval-store    padrão do idb-keyval
object store      keyval          idem
chave da sessão   fs::session     createSessionStore(…, s = "fs::session", …)
chave do carrinho fs::cart        createCartStore(…, s = "fs::cart")
```

O `@faststore/sdk` importa `get`/`set` de `idb-keyval` e monta o store
persistido; os nomes das chaves são o 3º argumento de `createSessionStore` /
`createCartStore` (visíveis no bundle `dist/es/index.mjs`). **Não há
`localStorage` no caminho** — procurar por ele é o primeiro erro de quem
investiga isso.

## 2. 🚨 Apagar o cookie NÃO desloga a interface

Este é o achado que motivou o documento.

O que o `person` alimenta na loja Bold — e o padrão se repete em qualquer
FastStore:

```
useSession() → person → isSignedIn      CustomNavbar.tsx:985-986
  ├─ rótulo "Minha conta" vs "Entre ou Cadastre-se"   :995
  ├─ destino do atalho de favoritos                    :992
  └─ botão de favoritar na PDP e no card               BuyBox.tsx:471 · BoldProductCard.tsx:551
```

Como `person` vem do IndexedDB e é re-hidratado no reload, apagar só o cookie
produz:

- a loja continua exibindo **"Minha conta"**;
- o botão de favoritos continua se achando logado;
- **qualquer ação falha**, porque o servidor não tem mais sessão.

E o efeito colateral é pior que o bug: **parece que a ferramenta não deslogou.**

### O que fazer

Zere `person`, `b2b` e `refreshAfter` na chave `fs::session` — exatamente o que
o próprio framework faz em `logoutAndClearSession`
(`sdk/session/index.ts:219-232`):

```js
sessionStore.set({ ...session, person: null, b2b: null, refreshAfter: null })
```

⚠️ **Não apague a chave inteira.** Ela carrega junto `postalCode`, `locale`,
`currency` e `channel` — o CEP e a região que a pessoa acabou de configurar.
Perder isso a cada logout é mais irritante que o problema original.

A extensão implementa isso em
[`sessao-da-pagina.js`](../../extension/sessao-da-pagina.js),
e roda a limpeza **também no login** — senão, ao trocar de usuário, o usuário
anterior aparece no intervalo entre o reload e a resposta do `validateSession`.

## 3. Quem repopula, e quando

`validateSession` (mutation do framework) é quem confirma a sessão contra o
servidor e volta a preencher `person` e `b2b`. Ele roda no cliente, depois da
hidratação — por isso existe a janela em que a tela mostra o estado **antigo**.

A flag `faststore_session_ready` (`sessionStorage`) existe justamente para a UI
não piscar nessa janela: com ela marcada, a tela renderiza na hora o que estiver
no store. **Ou seja, ela faz o estado velho aparecer mais rápido** — limpe-a
junto ao zerar a identidade.

## 4. O caso `refreshToken: true`

Com `experimental.refreshToken: true` no `discovery.config.js`, o `/api/graphql`
intercepta o `ValidateSession` fora de `localhost`
(`pages/api/graphql.ts:161-183`). Se a sessão ainda não tem `refreshAfter` e há
um JWT, cai em `firstRefreshRequest` e responde `Unauthorized`
(`utils/validateSessionRefreshToken.ts:24-28`); o cliente tenta renovar, falha
onde o cookie `vid_rt` não existe, e chama `logoutAndClearSession`.

Consequência prática: **em preview `.vtex.app`, um cookie injetado é apagado
pelo próprio front** quando essa flag está ligada. Em `localhost` não — ali o
framework curto-circuita tudo de propósito (`utils/isLocalHost.ts`).

## 5. Como conferir no navegador

DevTools → **Application**:

- **Cookies** → `VtexIdclientAutCookie_<conta>` — a autenticação
- **IndexedDB** → `keyval-store` → `keyval` → `fs::session` — o que a tela usa
- **Session Storage** → `faststore_session_ready`

**Se os dois primeiros discordarem, a tela vai mentir.** É o teste de uma olhada
para "por que diz que estou logado e dá erro".

## Limites desta investigação

- Medido na versão acima; nomes de chave são argumento padrão de função e
  **podem mudar em upgrade do framework**. O jeito de reconferir é procurar
  `createSessionStore` no bundle do `@faststore/sdk`, ou simplesmente olhar o
  IndexedDB no DevTools.
- O `fs::cart` foi identificado mas **não investigado**: não se sabe aqui o que
  sobrevive a uma troca de usuário no carrinho. O framework revalida o carrinho
  quando a sessão muda (`sdk/session/index.ts:213-214`), mas isso não foi
  medido.
- Nada disto foi verificado com um login real ponta a ponta — o comportamento
  descrito vem da leitura do código do framework mais o teste da função de
  limpeza contra um duplo do IndexedDB
  ([`testes/sessao.mjs`](../testes/sessao.mjs)).
