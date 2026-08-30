# Tasks — Extensão de dev-login

Numeração global e sequencial. Estados: `aberta` · `em decisão` · `em andamento` ·
`fechada`. Task fechada **não se apaga** — é o que impede o problema de voltar sem
ninguém reconhecer.

Origem de quase tudo aqui: [research 2026-08-30](../research/2026-08-30-viabilidade-extensao-dev-login.md).

---

## T-001 — Esqueleto da extensão MV3

**Estado:** construída, **falta carregar no navegador** · commit inicial 2026-08-30

`extension/manifest.json` com três permissões (`cookies`, `storage`, `tabs`) e
três hosts. `scripting` foi cortado: a detecção da conta lê o HTML por `fetch`,
que já é coberto pelo host permission de localhost.

**Pronto quando:** a extensão carrega em `chrome://extensions` sem aviso, e o
popup abre. ⬅️ **falta você fazer isto**

---

## T-002 — Handshake do VTEX ID no service worker

**Estado:** construído, **falta o teste real** · **Depende de:** [ADR-0002](../adr/0002-handshake-stateless-token-no-corpo.md)

`start` → `accesskey/send` → `accesskey/validate`, tudo com `credentials: 'omit'`
e `authenticationToken` no corpo. Mais `classic/validate` para o caminho de senha.

**Cuidados que já custaram caro** (base de conhecimento):
- sucesso do `accesskey/send` é **corpo vazio**; JSON com `authStatus` é **falha**;
- campo é `accesskey` minúsculo no `accesskey/validate`;
- ler o erro como `authStatus ?? code ?? error.code` — falhas `4xx` às vezes vêm
  em `code`;
- não retentar falha de credencial (só `4xx` com corpo não-JSON, teto 3×).

**Verificado em 2026-08-30**, rodando `extension/vtexid.js` por Node contra a
conta `boldb2b` (o mesmo código que a extensão executa):

- ✅ `start` devolve token e lê `password: true`, `accessKey: true`;
- ✅ senha errada → `WrongCredentials`, mensagem sem vazar existência do e-mail;
- ✅ código errado → `WrongCredentials`, mensagem citando o uso único;
- ✅ sem token → `InvalidToken`, distinto de credencial ruim.

**Ainda não verificado — e é o que fecha a task:** um login **bem-sucedido**.
Exige e-mail de usuário real da conta e acesso à caixa de entrada. É o teste que
a research também não pôde fazer (§6 de lá), e nenhum dos anteriores o substitui:
todos exercitam o caminho de **falha**.

---

## T-003 — Injeção do cookie e reload

**Estado:** construída, **falta o teste real** · **Depende de:** T-002

`chrome.cookies.set` de `VtexIdclientAutCookie_<conta>` em `http://localhost:<porta>`,
seguido de `chrome.tabs.reload`. Mais o inverso: botão de logout que faz
`chrome.cookies.remove`.

**Pronto quando:** favoritar um produto na PDP da `boldb2b` em `localhost:3000`
funciona logo após o login pela extensão, e o favorito aparece na Minha Conta da
VTEX (é o mesmo app `vtex.my-wishlists` — ver
`faststore-boldb2b/docs/adr/0007-wishlist-no-app-v2-da-vtex.md`).

---

## T-004 — Logout, e a troca de usuário

**Estado:** construída, **falta o teste real** · **Depende de:** T-003 · **Decidida pela** [ADR-0003](../adr/0003-sem-cofre-de-credenciais.md)

Botão que apaga o cookie (`chrome.cookies.remove`) e recarrega a aba.

**Trocar de usuário é logout + login com outro e-mail** — decisão do operador em
2026-08-30. Não existe cofre de sessões, lista de contas logadas nem cache de
JWT; a ideia foi descartada com motivo escrito na ADR-0003.

**Pronto quando:** logout derruba a sessão (o favorito volta a exigir login), e
logo em seguida dá para entrar com outro e-mail sem passo manual nenhum.

---

## T-005 — De onde vem a conta e a porta

**Estado:** construída e **verificada** · **Decidida** em 2026-08-30

**Detectar e deixar corrigir.** A extensão lê a conta da página aberta
(`__NEXT_DATA__` / `discovery.config`) e a porta da aba atual, e mostra os dois
num campo **editável**.

Acerta sozinha no caso normal do FastStore; o campo editável é o que a faz servir
projeto de outra stack (IO, Deco, Eitri) e loja que fuja do padrão — sem quebrar
calada, que era o defeito da detecção pura.

**Verificado em 2026-08-30:** a heurística (frequência de `<conta>.vtexassets.com`,
`.myvtex.com`, `.vtex.app`, `.vtexcommercestable.com.br`, menos uma denylist)
rodou contra o HTML servido pelo `localhost:3000` e devolveu `boldb2b` — 58
citações contra 5 do segundo colocado.

**Falta:** conferir no popup que o campo vem preenchido e que editar funciona.

---

## T-006 — Senha como método, além do código

**Estado:** construída, **falta o teste real** · **Escopo reduzido pela** [ADR-0003](../adr/0003-sem-cofre-de-credenciais.md)

`classic/validate` é instantâneo (sem ida ao e-mail) e a `boldb2b` tem os dois
métodos habilitados
([research §1](../research/2026-08-30-viabilidade-extensao-dev-login.md#1-a-conta-boldb2b-aceita-login-por-código)).

Entra como **campo digitado, usado e descartado**. A senha não é guardada em
lugar nenhum — a ADR-0003 fechou essa porta.

**Pronto quando:** dá para logar por senha numa conta que a tenha habilitada, e
nada da senha sobrevive ao fechamento do popup.

---

## T-007 — UI dirigida pelos flags da conta

**Estado:** construída, **falta conferir na tela** · **Depende de:** T-002

O `start` devolve `showClassicAuthentication` / `showAccessKeyAuthentication` /
`oauthProviders`. A UI desenha a partir deles, sem chutar o método — é o que
faz a extensão funcionar em B2C e B2B sem ramificação.

**Pronto quando:** apontando para uma conta sem código de acesso, a aba de código
não aparece.

---

## T-008 — Diagnóstico honesto de erro

**Estado:** construída e **verificada** em 2026-08-30 · **Depende de:** T-002

`WrongCredentials` é ambíguo **por design**: código errado, código já usado,
código expirado ou usuário sem acesso. A mensagem tem de citar as saídas reais
("peça um código novo" / "confirme o acesso do usuário") sem fingir diagnóstico,
e sem revelar se o e-mail existe
([R-5](../rules/seguranca.md#r-5--mensagem-de-erro-nunca-revela-se-o-usuário-existe)).

**Armadilha a documentar na UI:** ao depurar, elimine primeiro a causa banal —
**código já usado**, que é de uso único.

---

## T-013 — Bloqueio temporário caía no erro genérico

**Estado:** corrigida e **verificada** · **Achado** rodando os próprios testes

A VTEX sinaliza bloqueio por tentativas com `401` e corpo em **texto puro**
(`Seu login está bloqueado temporariamente.`). Como não é JSON, o `errorCodeOf`
devolvia `HTTP_401`, que não estava mapeado — e a pessoa via *"Não foi possível
concluir. Tente de novo em alguns instantes."*

**Tentar de novo renova o bloqueio.** A mensagem mandava fazer exatamente a
única coisa que piora a situação.

Corrigido: `HTTP_401` mapeado para uma mensagem que diz o tempo de espera e
desaconselha a nova tentativa. O teste `vtexid.mjs` passa a reconhecer o estado e
reportá-lo como condição de ambiente. Registrado em
[`reference/vtex-id.md`](../reference/vtex-id.md) §4.

---

## T-010 — Preview `.vtex.app`

**Estado:** construída, **falta o teste real** · **Decidida pela** [ADR-0004](../adr/0004-preview-entra-producao-nao.md)

A extensão passa a agir em `*.vtex.app`, para o cliente aprovar funcionalidade
logada sem tocar em DevTools. Produção fica de fora por desnecessidade.

Construído: `alvo.js` (classificação de host e descoberta de conta), conta lida
do subdomínio no preview, `secure` conforme o esquema, e o diagnóstico de cookie
apagado por `refreshToken: true`.

**Verificado em 2026-08-30** (lógica pura, por Node): 5 hosts aceitos e 8
recusados — incluindo `localhost.evil.com` e `evil-vtex.app.com`, que passariam
num teste ingênuo de sufixo. Conta lida do subdomínio, com deploy de branch.

**Falta:** um login real no preview da `boldb2b`.

---

## T-012 — Deslogar de verdade: a sessão do IndexedDB

**Estado:** construída e **verificada** · **Achado por:** operador, testando

Apagar o cookie **não deslogava a interface**. O FastStore persiste a sessão
inteira — inclusive `person` — no IndexedDB (`keyval-store` → `keyval` →
`fs::session`) e re-hidrata dali no reload. A loja seguia mostrando "Minha
conta", o botão de favoritos se achava logado, e qualquer ação falhava.

Pior: **parecia que a extensão não tinha deslogado.**

Construído: [`sessao-da-pagina.js`](../../extension/sessao-da-pagina.js)
zera `person`/`b2b`/`refreshAfter` via `chrome.scripting.executeScript`, do mesmo
jeito cirúrgico que o `logoutAndClearSession` do framework — **preservando** CEP,
locale e canal. Roda no logout **e no login** (senão o usuário anterior aparece
na troca).

Custou a permissão `scripting`, que havia sido cortada: é a única forma de
alcançar o IndexedDB da página.

**Verificado em 2026-08-30** ([`testes/sessao.mjs`](../testes/sessao.mjs)):
identidade zerada, CEP e locale preservados, flag de prontidão limpa, sessão já
deslogada não quebra, banco inexistente não é criado.

Conhecimento de plataforma promovido para
[`reference/faststore-sessao.md`](../reference/faststore-sessao.md).

---

## T-011 — Como o cliente instala isso

**Estado:** aberta · **Bloqueia:** o uso por cliente

"Carregar sem compactação" exige modo desenvolvedor — inviável para quem "nunca
usou o DevTools", que é exatamente o público da [ADR-0004](../adr/0004-preview-entra-producao-nao.md).

Caminhos: publicar na Chrome Web Store (2 cliques para o cliente, mas revisão da
Google e uma extensão que escreve cookie de sessão tende a receber escrutínio),
ou distribuição interna por política de empresa.

**Enquanto isto não existe, a extensão serve ao time, não ao cliente.**

---

## T-009 — Indicador de quem está logado

**Estado:** construída, **falta o teste real** (precisa de um JWT de verdade)

O JWT é legível (`sub`, `account`, `customerId`, `unitId`, `isRepresentative`,
`exp`). O popup pode mostrar quem está logado agora e quanto falta para expirar,
lendo o cookie do localhost — sem chamada de rede.

Em B2B isso responde "estou vendo a loja como qual organização?", que hoje só se
descobre decodificando o JWT na mão.

**Cuidado:** exibir, não logar
([R-4](../rules/seguranca.md#r-4--nada-de-segredo-em-log-em-documento-ou-em-commit)).
