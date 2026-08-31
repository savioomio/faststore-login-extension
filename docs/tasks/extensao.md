# Tasks — Extensão de dev-login

Numeração global e sequencial. Estados: `aberta` · `em decisão` · `em andamento` ·
`fechada`. Task fechada **não se apaga** — é o que impede o problema de voltar sem
ninguém reconhecer.

Origem de quase tudo aqui: [research 2026-08-30](../research/2026-08-30-viabilidade-extensao-dev-login.md).

---

## T-001 — Esqueleto da extensão MV3

**Estado:** **fechada** — verificada pelo operador em 2026-08-31 · commit inicial 2026-08-30

`extension/manifest.json`. O conjunto de permissões mudou duas vezes desde o
commit inicial, e as duas mudanças estão registradas:

- `scripting` **entrou** em [T-012](#t-012--deslogar-de-verdade-a-sessão-do-indexeddb):
  é a única forma de alcançar o IndexedDB da página, e sem ela o logout não
  desloga a interface;
- `tabs` **saiu** em [T-014](#t-014--a-permissão-tabs-saiu-do-manifesto): os
  `host_permissions` já entregam `tab.url` nas abas que interessam.

Hoje: `cookies`, `storage`, `scripting` e quatro hosts. Sem `<all_urls>`.

**Verificado:** a extensão carrega em `chrome://extensions` sem aviso e o popup
abre — operador, 2026-08-31.

---

## T-002 — Handshake do VTEX ID no service worker

**Estado:** **fechada** — login bem-sucedido verificado pelo operador em 2026-08-31 · **Depende de:** [ADR-0002](../adr/0002-handshake-stateless-token-no-corpo.md)

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

**Verificado em 2026-08-31 pelo operador:** o login **bem-sucedido** ponta a
ponta, à mão, no navegador. Era o que faltava — todos os testes anteriores, e a
research, exercitavam só o caminho de **falha**.

⚠️ **Nenhum teste automatizado cobre isso, e continua assim.** Automatizar
exigiria consumir código de acesso de usuário real
([`testes/README.md`](../testes/README.md)). Mexeu no `vtexid.js` ou no
`background.js`? O login real se refaz **à mão**.

---

## T-003 — Injeção do cookie e reload

**Estado:** **fechada** — verificada pelo operador em 2026-08-31 · **Depende de:** T-002

`chrome.cookies.set` de `VtexIdclientAutCookie_<conta>` em `http://localhost:<porta>`,
seguido de `chrome.tabs.reload`. Mais o inverso: botão de logout que faz
`chrome.cookies.remove`.

**Pronto quando:** favoritar um produto na PDP da `boldb2b` em `localhost:3000`
funciona logo após o login pela extensão, e o favorito aparece na Minha Conta da
VTEX (é o mesmo app `vtex.my-wishlists` — ver
`faststore-boldb2b/docs/adr/0007-wishlist-no-app-v2-da-vtex.md`).

---

## T-004 — Logout, e a troca de usuário

**Estado:** **fechada** — verificada pelo operador em 2026-08-31 · **Depende de:** T-003 · **Decidida pela** [ADR-0003](../adr/0003-sem-cofre-de-credenciais.md)

Botão que apaga o cookie (`chrome.cookies.remove`) e recarrega a aba.

**Trocar de usuário é logout + login com outro e-mail** — decisão do operador em
2026-08-30. Não existe cofre de sessões, lista de contas logadas nem cache de
JWT; a ideia foi descartada com motivo escrito na ADR-0003.

**Pronto quando:** logout derruba a sessão (o favorito volta a exigir login), e
logo em seguida dá para entrar com outro e-mail sem passo manual nenhum.

---

## T-005 — De onde vem a conta e a porta

**Estado:** **fechada** — heurística medida em 2026-08-30, campo editável conferido na tela pelo operador em 2026-08-31 · **Decidida** em 2026-08-30

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

**Conferido na tela em 2026-08-31:** o campo vem preenchido e a correção manual
persiste para aquele endereço.

---

## T-006 — Senha como método, além do código

**Estado:** **fechada** — verificada pelo operador em 2026-08-31 · **Escopo reduzido pela** [ADR-0003](../adr/0003-sem-cofre-de-credenciais.md)

`classic/validate` é instantâneo (sem ida ao e-mail) e a `boldb2b` tem os dois
métodos habilitados
([research §1](../research/2026-08-30-viabilidade-extensao-dev-login.md#1-a-conta-boldb2b-aceita-login-por-código)).

Entra como **campo digitado, usado e descartado**. A senha não é guardada em
lugar nenhum — a ADR-0003 fechou essa porta.

**Pronto quando:** dá para logar por senha numa conta que a tenha habilitada, e
nada da senha sobrevive ao fechamento do popup.

---

## T-007 — UI dirigida pelos flags da conta

**Estado:** **fechada** — conferida na tela pelo operador em 2026-08-31 · **Depende de:** T-002

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

**Estado:** **fechada** — login no preview verificado pelo operador em 2026-08-31 · **Decidida pela** [ADR-0004](../adr/0004-preview-entra-producao-nao.md)

A extensão passa a agir em `*.vtex.app`, para o cliente aprovar funcionalidade
logada sem tocar em DevTools. Produção fica de fora por desnecessidade.

Construído: `alvo.js` (classificação de host e descoberta de conta), conta lida
do subdomínio no preview, `secure` conforme o esquema, e o diagnóstico de cookie
apagado por `refreshToken: true`.

**Verificado em 2026-08-30** (lógica pura, por Node): 5 hosts aceitos e 8
recusados — incluindo `localhost.evil.com` e `evil-vtex.app.com`, que passariam
num teste ingênuo de sufixo. Conta lida do subdomínio, com deploy de branch.

**Verificado em 2026-08-31:** login real no preview da `boldb2b`, pelo operador.

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

**Estado:** **em andamento** · **Decidida pela** [ADR-0005](../adr/0005-distribuicao-pela-chrome-web-store.md) · **Bloqueia:** o uso por cliente

"Carregar sem compactação" exige modo desenvolvedor — inviável para quem "nunca
usou o DevTools", que é exatamente o público da [ADR-0004](../adr/0004-preview-entra-producao-nao.md).

**Decidido em 2026-08-31: Chrome Web Store, item `unlisted`.** É o único caminho
que dá instalação em um clique **e** atualização automática nas máquinas dos
clientes. `.crx` auto-hospedado está morto no Windows e no macOS fora de política
de empresa, e política de empresa exige Chrome gerenciado, que os clientes não
têm. O porquê inteiro, com as portas que isso fecha, está na
[ADR-0005](../adr/0005-distribuicao-pela-chrome-web-store.md).

Pronto neste repo (2026-08-31): renome sem risco de marca, `tabs` fora do
manifesto ([T-014](#t-014--a-permissão-tabs-saiu-do-manifesto)), versão `1.0.0`,
[política de privacidade](../../PRIVACIDADE.md) escrita, e o
[runbook de publicação](../runbooks/publicar-na-chrome-web-store.md) com listagem,
justificativa de cada permissão e nota para o revisor prontas para colar.

**Falta — e é com o operador:**

1. [T-015](#t-015--a-política-de-privacidade-precisa-de-um-url-público) — política num URL público (**bloqueia o envio**);
2. conta de desenvolvedor: 2FA, US$ 5, declaração de trader;
3. preview `.vtex.app` público + usuário de teste **com senha**, para o revisor
   conseguir entrar sozinho — sem isso a rejeição provável é "não funciona"
   ([runbook §5](../runbooks/publicar-na-chrome-web-store.md#5-justificativa-das-permissões-uso-de-dados-e-nota-para-o-revisor));
4. cinco capturas de 1280x800, sem segredo nenhum na tela;
5. enviar, e esperar de dias a semanas.

> A apresentação para a equipe da Wicomm ficou para 2026-08-31. **A forma de
> distribuir pode mudar ali** — se mudar, a [ADR-0005](../adr/0005-distribuicao-pela-chrome-web-store.md)
> é substituída por outra, não editada.

**Pronto quando:** um cliente que nunca abriu o DevTools instala pelo link e
loga na loja de preview.

**Enquanto isto não existe, a extensão serve ao time, não ao cliente** — e o
caminho de "carregar sem compactação" continua válido para quem é técnico.

---

## T-014 — A permissão `tabs` saiu do manifesto

**Estado:** **fechada** — conferida no navegador pelo operador em 2026-08-31 · **Serve à** [R-8](../rules/seguranca.md#r-8--permissões-da-extensão-o-mínimo-que-funciona)

`tabs` era permissão a mais. Ela existe para dar acesso a quatro campos sensíveis
de `tabs.Tab` — `url`, `pendingUrl`, `title`, `favIconUrl` — mas os
`host_permissions` **já entregam esses mesmos campos** nas abas que casam com
eles, e `tabs.reload()` não exige permissão nenhuma
([documentação da API `chrome.tabs`](https://developer.chrome.com/docs/extensions/reference/api/tabs)).
Como a extensão só age em `localhost`, `127.0.0.1` e `*.vtex.app` — todos no
manifesto — ela nunca precisou de `tabs`.

Menos uma permissão na tela de instalação, e uma a menos para justificar na
revisão da Google.

**A consequência, que precisou de mudança:** numa aba **fora** dos
`host_permissions` o Chrome passa a devolver `tab.url` como `undefined`. O
`detectaAlvo` respondia "Nenhuma aba aberta." nesse caso — mensagem errada e
confusa. Agora ele devolve `classificaHost("")`, que é a mesma recusa de host
não coberto: *"Esta aba não é uma loja em ambiente de teste."*
([`background.js:34`](../../extension/background.js#L34))

Coberto por [`testes/mensagens.mjs`](../testes/mensagens.mjs) — caso "aba fora
dos host_permissions".

**Medido no navegador em 2026-08-31, pelo operador** — a task nasceu como
dedução a partir da documentação da API, que é exatamente o jeito como a
[R-2 já errou uma vez](../rules/seguranca.md#-correção-de-uma-versão-anterior-desta-regra),
e por isso não fechou até alguém abrir o Chrome:

1. extensão recarregada em `chrome://extensions`, sem aviso;
2. em `localhost:3000` e no preview, o popup reconhece a loja **como antes** — os
   `host_permissions` entregam o `tab.url` mesmo sem `tabs`;
3. numa aba fora deles, a resposta é *"Esta aba não é uma loja em ambiente de
   teste"*.

Se algum dia o passo 2 quebrar, a volta é devolver `"tabs"` ao `manifest.json` —
e **corrigir esta task** com o que se mediu.

---

## T-015 — A política de privacidade precisa de um URL público

**Estado:** **aberta** · **Bloqueia:** [T-011](#t-011--como-o-cliente-instala-isso)

O texto está escrito e revisado em [`PRIVACIDADE.md`](../../PRIVACIDADE.md), em
português e inglês — o revisor da Google não lê português.

O que falta é **hospedagem**: o dashboard exige um URL acessível **sem login**, e
este repositório é **privado**, então o link do GitHub não serve.

**Decidido em 2026-08-31 pelo operador: uma página no domínio da Wicomm.** É a
saída recomendada no [runbook §2](../runbooks/publicar-na-chrome-web-store.md#2-a-política-de-privacidade-precisa-de-um-url-público)
— dá credibilidade e é o que o revisor espera de uma empresa. As outras duas
(gist público, repositório público) ficam registradas lá como descartadas.

Cair fora da decisão: **tornar este repositório público** levaria junto o `docs/`
inteiro, inclusive research e reference sobre endpoints que a VTEX **não
documenta**. Não é para acontecer por atalho.

**Falta:** publicar o conteúdo de [`PRIVACIDADE.md`](../../PRIVACIDADE.md) na
página, e trazer o URL.

**Pronto quando:** o URL abre numa janela anônima e está preenchido nos dois
lugares do dashboard — configurações da conta e aba *Privacy* do item.

---

## T-009 — Indicador de quem está logado

**Estado:** **fechada** — verificada com JWT real pelo operador em 2026-08-31

O JWT é legível (`sub`, `account`, `customerId`, `unitId`, `isRepresentative`,
`exp`). O popup pode mostrar quem está logado agora e quanto falta para expirar,
lendo o cookie do localhost — sem chamada de rede.

Em B2B isso responde "estou vendo a loja como qual organização?", que hoje só se
descobre decodificando o JWT na mão.

**Cuidado:** exibir, não logar
([R-4](../rules/seguranca.md#r-4--nada-de-segredo-em-log-em-documento-ou-em-commit)).
