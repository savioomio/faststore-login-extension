# ADR-0004 — O preview `.vtex.app` entra no escopo; produção não

- **Estado:** aceita
- **Data:** 2026-08-30
- **Decidido por:** operador
- **Revê:** [R-2](../rules/seguranca.md#r-2--a-extensão-age-em-desenvolvimento-e-preview-não-em-produção), que antes limitava tudo a `localhost`

## Contexto

A extensão nasceu resolvendo a dor do desenvolvedor em `localhost`. Funcionou.
Mas o desenvolvedor não é o único a testar a loja: o que se manda para o cliente
aprovar é o **preview** — `https://<conta>.vtex.app`.

E lá o problema é pior. O botão "Entre ou Cadastre-se" do preview aponta para
`https://<conta>.myvtex.com/api/io/login` (medido na `boldb2b`, 2026-08-30): o
cliente sai do preview, loga no domínio da VTEX, o cookie cola em `.myvtex.com`,
ele volta para `.vtex.app` — e continua deslogado. O mesmo domínio cruzado do
`localhost`.

Nas palavras do operador:

> *"se é chato para dev, imagina para o cliente ter que fazer esse processo, ele
> que nunca usou o DevTools"*

## Decisão

**A extensão passa a agir também em `*.vtex.app`.** O escopo dela é
**desenvolvimento e homologação**: `localhost`, `127.0.0.1` e o preview.

**Produção fica de fora — por desnecessidade, não por restrição.** Como o
operador colocou:

> *"quando subir para prod `.com.br` aí já funciona, já fica unificado, esses
> domínios da VTEX. Aí a extensão não entra mais no escopo."*

Em produção o *auth cookie root domain* está configurado na conta (item
obrigatório de go-live), os domínios são unificados e o login nativo funciona
sozinho. **Não há o que a extensão faça lá.**

Isso dá um teste limpo para o futuro: **se alguém sentir falta da extensão em
produção, o defeito é de configuração da conta VTEX, não da ferramenta.** A
resposta certa é o ticket na VTEX, nunca estender o alcance da extensão.

`*.myvtex.com` continua proibido, e por um motivo próprio: é onde vive a sessão
real de admin de quem desenvolve. Escrever cookie ali derrubaria o próprio login
de quem está usando a ferramenta.

## O que a decisão obrigou a construir

**1. Descoberta exata da conta no preview.** Em `<conta>.vtex.app` a conta é o
subdomínio — não precisa de heurística. O `contaPeloSubdominio` trata inclusive
deploy de branch (`<algo>--<conta>.vtex.app`). A heurística por frequência
continua, mas só para `localhost`.

**2. Diagnóstico do cookie apagado.** Descoberto ao medir: numa loja com
`experimental.refreshToken: true`, o primeiro `ValidateSession` depois da
injeção cai em `firstRefreshRequest` (JWT presente, sessão ainda sem
`refreshAfter`), responde `Unauthorized`, e o front chama `logoutAndClearSession`
— que **apaga o cookie recém-escrito**
(`utils/validateSessionRefreshToken.ts:24-28`, `sdk/account/useRefreshToken.ts`).

Em `localhost` o framework curto-circuita isso de propósito; no preview, não.
A extensão **não tem como consertar** — a renovação depende do cookie `vid_rt`,
que vive na origem de produção. O que ela faz é detectar o sumiço e explicar a
causa, em vez de deixar parecer que o código estava errado.

A `boldb2b` tem `refreshToken: false`, então o preview dela funciona.

**3. Cookie com `secure` conforme o esquema.** Obrigatório em `.vtex.app`
(https), impossível em `http://localhost`.

## Consequências

**Boas**

- O cliente aprova funcionalidade logada no preview sem tocar em DevTools.
- O desenvolvedor usa a mesma ferramenta nos dois ambientes.
- O escopo tem uma fronteira com **justificativa técnica**, não arbitrária:
  a extensão existe exatamente onde o domínio ainda não é unificado.

**Ruins, e assumidas**

- **`host_permissions` agora inclui `https://*.vtex.app/*`** — é um domínio
  público, e o recorte alcança o preview de qualquer conta VTEX, não só as
  nossas. É o menor recorte que a plataforma permite: o host é
  `<conta>.vtex.app`, e as contas variam por projeto.
- **Distribuir para cliente é o problema não resolvido.** "Carregar sem
  compactação" exige modo desenvolvedor — inviável para quem "nunca usou o
  DevTools". Publicar na Chrome Web Store resolve, e vira tarefa própria
  ([T-011](../tasks/extensao.md)).
- **O diagnóstico de `refreshToken: true` é reativo:** só aparece depois de um
  login que já gastou um código de acesso. Ler a flag antes seria melhor, mas a
  loja não serializa o `discovery.config` na página (medido).