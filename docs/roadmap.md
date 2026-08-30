# Roadmap

Visão de cima: o que está no ar, o que está desenhado e inerte, o que nem começou.
Atualizado em 2026-08-30.

---

## No ar

**[`docs/reference/vtex-id.md`](reference/vtex-id.md)** — base de conhecimento da autenticação
VTEX, verificada ao vivo por `curl` contra conta real. Portátil: não depende deste
repo nem de projeto nenhum. É a fonte de verdade sobre a plataforma; o que for
descoberto nos outros dois volta para cá.

**A extensão** — carregável, com login por código e por senha, injeção de
cookie, logout que desloga de verdade, e suporte a `localhost` e preview
`.vtex.app`. Falta o teste de um login bem-sucedido feito à mão.

> Um modal de login de produção viveu aqui como material de estudo e foi
> **removido** em 2026-08-30 — é componente de loja, não de ferramenta de
> desenvolvimento. Está no commit inicial se alguém precisar.

---

## Desenhado, aguardando aprovação

**Extensão de dev-login** — o assunto de 2026-08-30.

Viabilidade **medida e fechada**: os dois lados do circuito foram verificados ao
vivo ([research](research/2026-08-30-viabilidade-extensao-dev-login.md)). Duas
descobertas simplificaram o desenho — o handshake é stateless, e o
`@faststore/core` já espera cookie injetado na mão em localhost.

As três decisões pendentes foram respondidas pelo operador em 2026-08-30, e a
resposta **encolheu o projeto**: sem cofre de sessões, trocar de usuário é logout
+ login com outro e-mail ([ADR-0003](adr/0003-sem-cofre-de-credenciais.md)).
As fases 1 e 2 previstas colapsaram numa só.

### Fases

| Fase | Entrega | Tasks |
|---|---|---|
| **1 — a ferramenta** | detectar conta/porta, login por código, cookie injetado, logout, favorito da PDP funcionando | T-001 → T-005 |
| **2 — acabamento** | senha como método, UI pelos flags da conta, erro honesto, quem-está-logado | T-006 → T-009 |

A fase 1 termina no teste que a research **não pôde** fazer: um login real ponta
a ponta ([research §6](research/2026-08-30-viabilidade-extensao-dev-login.md#6-limites-desta-investigação))
— exige um e-mail de usuário da conta e acesso à caixa de entrada dele.
Até ele passar, tudo aqui é projeto, não resultado.

---

## Não começou

- **Publicar a extensão** (Chrome Web Store ou distribuição interna). Enquanto
  isso, "carregar sem compactação".
- **Suporte a não-Chromium.** Firefox tem diferenças em `chrome.cookies` não
  verificadas.
- **Cadastro de cliente** (`storefront/users`) — fora de escopo em todos os três
  produtos deste repo, até alguém precisar.


---

## Fora de escopo, de propósito

- **`setpassword` na extensão.** Altera a conta do usuário, e na família legacy
  tem furo de segurança conhecido em B2B. Ver
  [ADR-0002 — escopo](adr/0002-handshake-stateless-token-no-corpo.md#escopo-a-extensão-não-implementa-setpassword).
- **Impersonation por telesales.** Existe na plataforma
  (`vtex.impersonate-session`) e é legítima no contexto dela — mas usa credencial
  de **admin** para entrar como cliente arbitrário, o oposto de
  [R-1](rules/seguranca.md#r-1--nada-de-appkey--apptoken-na-extensão-nunca) e
  [R-6](rules/seguranca.md#r-6--login-é-ação-do-dono-da-conta-não-da-ferramenta).
- **Qualquer escrita de cookie fora de `localhost`/`127.0.0.1`.**
  [R-2](rules/seguranca.md#r-2--a-extensão-só-existe-para-ambiente-local).
