# Roadmap

Visão de cima: o que está no ar, o que está desenhado e inerte, o que nem começou.
Atualizado em 2026-08-31.

---

## No ar

**[`docs/reference/vtex-id.md`](reference/vtex-id.md)** — base de conhecimento da autenticação
VTEX, verificada ao vivo por `curl` contra conta real. Portátil: não depende deste
repo nem de projeto nenhum. É a fonte de verdade sobre a plataforma; o que for
descoberto nos outros dois volta para cá.

**A extensão, versão 1.0.0** — login por código e por senha, injeção de cookie,
logout que desloga de verdade, `localhost` e preview `.vtex.app`. O **login real
ponta a ponta foi verificado à mão pelo operador em 2026-08-31**, nos dois
ambientes — era o teste que faltava, e com ele a fase 1 fechou.

Serve ao **time**. Para servir ao **cliente** falta a distribuição, logo abaixo.

> Um modal de login de produção viveu aqui como material de estudo e foi
> **removido** em 2026-08-30 — é componente de loja, não de ferramenta de
> desenvolvimento. Está no commit inicial se alguém precisar.

---

## Construído e verificado — como se chegou aqui

**Extensão de dev-login** — o assunto de 2026-08-30, fechado em 2026-08-31.

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

A fase 1 terminava no teste que a research **não pôde** fazer: um login real
ponta a ponta ([research §6](research/2026-08-30-viabilidade-extensao-dev-login.md#6-limites-desta-investigação)).
**Passou em 2026-08-31**, à mão, pelo operador. As duas fases estão construídas e
verificadas; o que resta não é código.

⚠️ Esse teste **continua sem automação, e vai continuar** — automatizar exigiria
queimar código de acesso de usuário real. Mexeu no `vtexid.js` ou no
`background.js`, refaz à mão.

---

## Em andamento

**Publicar na Chrome Web Store, como item `unlisted`** — decidido em 2026-08-31
([ADR-0005](adr/0005-distribuicao-pela-chrome-web-store.md)). É o que transforma
a ferramenta do time em ferramenta do cliente: instalação em um clique e
atualização automática. `.crx` num link não é opção — está bloqueado no Windows e
no macOS há uma década fora de política de empresa.

Pronto: renome sem risco de marca, `tabs` fora do manifesto, versão `1.0.0`,
[política de privacidade](../PRIVACIDADE.md) e
[runbook de publicação](runbooks/publicar-na-chrome-web-store.md) com tudo pronto
para colar no dashboard.

Falta, e é com o operador: pôr a política num URL público
([T-015](tasks/extensao.md#t-015--a-política-de-privacidade-precisa-de-um-url-público)),
abrir a conta de desenvolvedor e enviar
([T-011](tasks/extensao.md#t-011--como-o-cliente-instala-isso)).

**A extensão é apresentada à equipe da Wicomm em 2026-08-31, e a forma de
distribuir pode mudar ali.** Até essa conversa, a ADR-0005 é a decisão vigente —
se a equipe escolher outro caminho, ela é **substituída**, não reescrita.

---

## Não começou

- **Edge Add-ons.** Aceita o mesmo pacote MV3, é grátis, certifica em até 7 dias
  úteis. Vale quando algum cliente usar Edge — não antes.
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
  [R-2](rules/seguranca.md#r-2--a-extensão-age-em-desenvolvimento-e-preview-não-em-produção).
