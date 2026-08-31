# ADR-0001 — Extensão de navegador, e não BFF, patch ou proxy

- **Estado:** proposta — aguarda aprovação do operador
- **Data:** 2026-08-30
- **Contexto vem de:** [research 2026-08-30](../research/2026-08-30-viabilidade-extensao-dev-login.md)

## Contexto

Testar em `localhost` qualquer coisa que exija sessão (favoritos, minha conta,
preço por organização, carrinho B2B) hoje exige logar no ambiente IO, copiar o
`VtexIdclientAutCookie_<conta>` do DevTools e colar no localhost — a cada troca
de usuário. Em loja B2B, onde o interessante é comparar usuários de organizações
diferentes, isso acontece dezenas de vezes por dia.

O cookie não cola sozinho porque volta com `Domain=<conta>.myvtex.com`.

Quatro caminhos foram considerados.

## Decisão

**Uma extensão de navegador (MV3) que roda o handshake do VTEX ID e escreve o
cookie de sessão em `localhost` via `chrome.cookies.set`.**

## Alternativas descartadas

### A) Mutation GraphQL dentro do projeto da loja

É a arquitetura **certa para produção** e já existe neste repo. Como ferramenta
de desenvolvimento, não serve:

- **Contamina o projeto do cliente.** Exige copiar resolver, typeDef, registrar
  no agregador e rodar `yarn generate` **em cada loja** — e o código de dev-login
  passa a poder ir para produção por descuido.
- **Multiplica por N.** São 20+ projetos FastStore em `vtex-faststore/`. Cada um
  precisaria da instalação e da manutenção.
- **Não resolve o caso de não-FastStore** (VTEX IO, Deco, Eitri — todos presentes
  no mesmo diretório de trabalho).

A extensão é **externa ao projeto**: nada é instalado na loja, e ela serve
qualquer loja de qualquer stack que rode em localhost.

### B) `patch-package` no `@faststore/core`

Descartado de saída: **patch não sobe para produção no VTEX WebOps**, e um patch que injeta autenticação é a
última coisa que se quer sobrevivendo por acidente num build.

### C) Proxy local (mitmproxy / Node) reescrevendo `Set-Cookie`

Funciona, e é o que muita gente faz. Mas: exige processo separado rodando,
configuração de certificado para HTTPS, e reconfiguração do navegador. Troca uma
fricção manual por uma fricção de infraestrutura, e não dá UI para "trocar de
usuário em um clique" — que é a dor principal.

### D) Script de terminal que imprime o cookie para colar

É meio caminho: automatiza o handshake mas mantém o copia-e-cola, que é
justamente o passo chato. E não faz logout nem troca de conta.

## Consequências

**Boas**

- Zero pegada nos projetos das lojas. Nenhum arquivo, nenhuma dependência,
  nenhum risco de vazar para produção.
- Serve todas as lojas e stacks que rodem em localhost.
- O logout vira `chrome.cookies.remove`, e a troca de usuário vira sobrescrever
  o cookie — as duas dores originais somem por construção.
- **O framework já está do nosso lado:** o `@faststore/core` documenta no
  próprio código que localhost existe para receber cookie injetado na mão, e
  protege esse cookie do fluxo de refresh-token
  (`isLocalHost.ts`, `useRefreshToken.ts:17-22` — ver research §3).

**Ruins, e assumidas**

- **Só Chromium.** O alvo é o Comet. Firefox tem diferenças em `chrome.cookies`
  não verificadas.
- **Distribuição é manual** ("carregar sem compactação") enquanto não for
  publicada. Aceitável: é ferramenta interna de time.
- **Uma ferramenta que escreve cookie de sessão é sensível por natureza.** Por
  isso ela é restrita a `localhost`/`127.0.0.1`
  ([R-2](../rules/seguranca.md#r-2--a-extensão-age-em-desenvolvimento-e-preview-não-em-produção)) e
  nunca vê `appKey`/`appToken`
  ([R-1](../rules/seguranca.md#r-1--nada-de-appkey--apptoken-na-extensão-nunca)).

## Relação com o modal de login de produção

Existiu neste repo um modal de login headless para FastStore, arquivado e depois
removido em 2026-08-30 (recuperável no commit inicial). Ele resolvia o mesmo
problema **em produção**, e a comparação é o que justifica esta arquitetura:

| | modal dentro da loja | esta extensão |
|---|---|---|
| Público | cliente final, produção | desenvolvedor, localhost |
| Onde roda | resolver GraphQL do projeto | service worker da extensão |
| Como o cookie cola | `ctx.storage.cookies.set` re-emite no host | `chrome.cookies.set` no localhost |
| Sessão do dev no IO | irrelevante | **preservada** (ver ADR-0002) |

Uma correção de entendimento do VTEX ID descoberta num deve ser levada ao outro.
