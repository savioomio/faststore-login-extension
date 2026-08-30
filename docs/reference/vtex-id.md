# VTEX ID — Base de conhecimento de login headless (custom login modal)

> **Documento autocontido e portátil.** Reúne tudo o que foi descoberto e **verificado ao vivo** sobre as
> APIs de autenticação do VTEX ID durante a construção de um modal de login custom em FastStore
> (conta `b2bgcb`, 2026-06 a 2026-07). Serve para **reaproveitar em qualquer loja VTEX** — inclusive
> **B2C** — para construir login/cadastro/recuperação de senha próprios, sem depender do `vtex.login` (IO).
>
> Foi separado do `docs/` do projeto de propósito: o `docs/` guarda só o que é específico do B2B daquela
> conta; **aqui** fica o conhecimento geral da plataforma. Pode ser movido para fora do repositório.
>
> ⚠️ **Nada aqui vem de "achismo".** Cada afirmação foi testada por `curl` contra uma conta real. Onde a
> documentação oficial da VTEX **não cobre** o endpoint, está marcado como *não documentado*.

---

## 0. Sumário executivo — o que dá para fazer

Com **apenas rotas públicas (`/pub/`)** do VTEX ID, sem `appKey`/`appToken`, um front custom consegue:

| Capacidade | Endpoint | Vale em B2C? | Vale em B2B? |
|---|---|---|---|
| Login por **senha** | `classic/validate` | ✅ | ✅ (único método suportado, junto de SSO) |
| Login por **código de acesso** (passwordless) | `accesskey/send` + `accesskey/validate` | ✅ | ❌ **não suportado pela VTEX** (ver §7) |
| **Definir 1ª senha** de usuário novo | `classic/setpassword` | ✅ | ✅ |
| **Recuperar/redefinir senha** ("esqueci minha senha") | `accesskey/send` + `classic/setpassword` | ✅ | ✅ (fluxo oficial) |
| Descobrir identificadores de um usuário | `GET /api/vtexid/pvt/user/info` (precisa appKey) | ✅ | ✅ |
| Expirar senha de um usuário | `POST /api/vtexid/password/expire` (precisa appKey) | ✅ | ✅ |

**Rotas públicas autenticam o USUÁRIO, não a aplicação** → não usam `appKey`/`appToken`. Isso é o que
torna um login custom viável 100% no front + um BFF fino (só para repassar cookies).

---

## 1. As DUAS APIs de autenticação (a coisa mais importante do documento)

O VTEX ID expõe **duas famílias de endpoints** que fazem coisas parecidas, mas **não são intercambiáveis**:

| | **Legacy** | **Authenticator** |
|---|---|---|
| Prefixo | `/api/vtexid/pub/authentication/...` | `/api/authenticator/pub/authentication/...` |
| Query string | — | **exige `?an={conta}`** |
| Backend (header `x-vtex-janus-router-backend-app`) | `vid-v4.x` | `authenticator-v0.16.x` |
| Consciência de **B2B** (organização/contrato) | ❌ **NÃO valida** | ✅ **valida** (`InvalidB2BClaims`) |
| Aceita **username** no campo `login` | ❌ só e-mail (`InvalidEmail`) | ✅ **username ou e-mail** |
| Como o `start` devolve o token | corpo JSON: `authenticationToken` | **cookie `Set-Cookie: _vss=`** (corpo vazio, `204`) |

### ⚠️ Regra de ouro nº 1 — não misture as duas APIs
O token de sessão (`_vss` / `authenticationToken`) de uma **não funciona** na outra (dá `InvalidToken`).
Todo um fluxo (start → send → validate/setpassword) tem que rodar **na mesma família**.

### ⚠️ Regra de ouro nº 2 — o código de acesso é atrelado à sessão do `send`
O código de 6 dígitos enviado pelo `accesskey/send` **só vale com o mesmo `_vss` usado no envio**.
Usar um `_vss` novo faz um código **válido** responder **`WrongCredentials`** — parece "código errado" e
não é. Isso custou horas de investigação. **Guarde o `_vss` do `send` e reuse no `validate`/`setpassword`.**

> 📌 **O que vale é a sessão, não o cookie.** Na família **legacy**, o mesmo token
> pode ir como campo `authenticationToken` **no corpo** — e aí a regra deixa de
> ser um risco, porque não há cookie para o navegador trocar. Ver **§2.5**.

### Qual escolher?
- **B2C:** a **legacy** é suficiente e mais simples (token no corpo, sem `?an=`). A authenticator também
  funciona.
- **B2B:** use **sempre a authenticator** — é a única que aplica as restrições de organização/contrato e
  a única que aceita username (o identificador primário em B2B).

---

## 2. Fluxo LEGACY (`/api/vtexid/pub/...`) — completo e testado

### 2.1 Start (obter a sessão)
```http
GET /api/vtexid/pub/authentication/start?scope={conta}&accountName={conta}
Accept: application/json
```
Resposta `200`:
```json
{
  "authenticationToken": "DD39F62A...216F",
  "oauthProviders": [],
  "showClassicAuthentication": true,
  "showAccessKeyAuthentication": true,
  "showPasskeyAuthentication": false,
  "authCookie": null,
  "isAuthenticated": false,
  "selectedProvider": null,
  "samlProviders": []
}
```
- O mesmo valor vem também como `Set-Cookie: _vss=...` (expira em **10 min**).
- Os flags `show*Authentication` dizem **quais métodos a conta tem habilitados** — útil para renderizar a
  UI dinamicamente.

### 2.2 Login por senha
```http
POST /api/vtexid/pub/authentication/classic/validate
Content-Type: application/x-www-form-urlencoded
Cookie: _vss={token}

login={email}&password={senha}
```
> ⚠️ Em contas com **"Login with Alternative Keys"** habilitado, esta rota legacy responde
> `400 "should not rely on legacy routes"` — nesse caso o login por senha **tem** que ir pela
> authenticator (§3.2).

### 2.3 Login por código de acesso (passwordless) — **válido em B2C**
```http
POST /api/vtexid/pub/authentication/accesskey/send?email={email}
Content-Type: application/x-www-form-urlencoded

authenticationToken={token}
```
- **Sucesso = corpo VAZIO (`{}`) com `200`.** Se vier um JSON com `authStatus`, **é falha**. (Contraintuitivo.)
- Depois:
```http
POST /api/vtexid/pub/authentication/accesskey/validate
Content-Type: application/x-www-form-urlencoded
Cookie: _vss={o MESMO token do send}

login={email}&accesskey={código de 6 dígitos}
```
- ⚠️ Nome do campo é **`accesskey`** (tudo minúsculo) aqui, mas **`accessKey`** (camelCase) no
  `setpassword`. Não é typo — são endpoints diferentes com convenções diferentes.

### 2.4 Definir / redefinir senha — **o endpoint mais útil e menos documentado**
```http
POST /api/vtexid/pub/authentication/classic/setpassword
Content-Type: application/x-www-form-urlencoded
Cookie: _vss={o MESMO token do send}

login={email}&accessKey={código}&newPassword={nova senha}
```
- **Chamada ÚNICA:** define a senha **e já devolve os cookies de autenticação** (o usuário sai logado).
  Não precisa validar o código separadamente antes.
- Serve para **os dois** casos: 1º acesso (usuário sem senha) e "esqueci minha senha".
- **Não está no catálogo oficial de APIs da VTEX** (nem `classic/validate` nem `accesskey/send` estão
  completos lá). Descoberto por teste.

---

### 2.5 O `authenticationToken` funciona **no corpo** — o fluxo legacy é *stateless*

> Verificado em **2026-08-30** contra a conta `boldb2b`. Isto **relativiza a regra
> de ouro nº 2** (§1) para a família legacy: o token não precisa viajar como
> cookie, e por isso não há como o navegador trocá-lo por outro.

O campo `authenticationToken` é aceito como campo de formulário em
`accesskey/validate` e `classic/validate` — exatamente como já era em
`accesskey/send`. Padrão de três testes (ver o porquê do controle negativo no
runbook de sondagem):

```bash
TOKEN=$(curl -s ".../pub/authentication/start?scope={conta}&accountName={conta}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['authenticationToken'])")

# A) token no CORPO, sem cookie
curl -X POST ".../pub/authentication/accesskey/validate" \
  -d "authenticationToken=$TOKEN&login={email}&accesskey=000000"     → WrongCredentials

# B) token só no COOKIE (o jeito conhecido)
curl -X POST ".../pub/authentication/accesskey/validate" \
  -H "cookie: _vss=$TOKEN" -d "login={email}&accesskey=000000"       → WrongCredentials

# C) sem token nenhum (controle negativo)
curl -X POST ".../pub/authentication/accesskey/validate" \
  -d "login={email}&accesskey=000000"                                → InvalidToken
```

**A == B ≠ C** prova que (A) foi aceito. Idem para `classic/validate`
(com token no corpo → `WrongCredentials`; sem → `InvalidToken`).

Por que importa:

- **Some a classe de bug mais cara do fluxo.** Quem guarda o token e o manda
  explicitamente não consegue esbarrar no "código válido responde
  `WrongCredentials`" — não há cookie para o navegador sobrescrever.
- **Cliente sem cookie jar passa a ser viável:** extensão de navegador, worker,
  script de QA sem `-c/-b`. Some a necessidade de persistir o `_vss` entre passos.
- **Não contamina outra sessão.** Um cliente que roda o handshake com
  `credentials: 'omit'` não sobrescreve o `_vss` de uma sessão real aberta no
  mesmo navegador.

⚠️ **Não documentado pela VTEX** (como o resto desta seção). Se for removido, o
sintoma é `InvalidToken` em todo login; o plano B é voltar ao cookie. Os três
comandos acima reconfirmam em 30 segundos.

⚠️ **Não testado na família authenticator** (§3), onde o `start` responde `204` e
o token só existe como `Set-Cookie`. Lá, presuma o cookie até medir.

---

## 3. Fluxo AUTHENTICATOR (`/api/authenticator/pub/...`) — completo e testado

### 3.1 Start (obter a sessão) — note as diferenças
```http
POST /api/authenticator/pub/authentication/start?an={conta}
Content-Type: application/x-www-form-urlencoded

user={username ou email}&scope={conta}&accountName={conta}&returnUrl=/
```
- Responde **`204` com corpo VAZIO** — o token vem **só** em `Set-Cookie: _vss=...`.
- O parâmetro **`user=`** é o passo "informar o identificador" do fluxo oficial: é aqui que a plataforma
  resolve a organização/contrato do usuário e decide o método de autenticação.
- Rate limit observado no header: `x-ratelimit-limit: 200`.

### 3.2 Login por senha
```http
POST /api/authenticator/pub/authentication/classic/validate?an={conta}
Content-Type: application/x-www-form-urlencoded
Cookie: _vss={token do start}

login={username ou email}&password={senha}
```
- **Aceita username OU e-mail** — testado, resultado idêntico para os dois.

### 3.3 Enviar código de acesso
```http
POST /api/authenticator/pub/authentication/accesskey/send?an={conta}
Content-Type: application/x-www-form-urlencoded
Cookie: _vss={token do start}

email={email}
```
- **Funciona e envia o e-mail** (testado 2026-07-29). ⚠️ Uma versão antiga desta documentação afirmava
  que esta rota "retorna 200 mas nunca envia" — **estava errado**: ela envia quando existe o `_vss` de um
  `start` feito com `user=`.
- Com **username** no campo `email` → `400 {"code":"BlockedHostDomain"}` (ele tenta interpretar como
  domínio). Só e-mail.

### 3.4 Definir / redefinir senha — **a versão boa**
```http
POST /api/authenticator/pub/authentication/classic/setpassword?an={conta}
Content-Type: application/x-www-form-urlencoded
Cookie: _vss={o MESMO token do send, OU do start se o código veio do admin}

login={username ou email}&accessKey={código}&newPassword={nova senha}
```
- **Aceita `login=username`** → é o **único caminho conhecido** para usuário **sem e-mail**.
- **Valida as regras de organização**: contrato inativo → `403` + `InvalidB2BClaims`, **sem** emitir cookie
  **e sem trocar a senha** (atômico). A legacy, no mesmo cenário, devolve `Success` + cookies (ver §7).
- Único campo **obrigatório** segundo a validação do endpoint: `newPassword` (o resto ele resolve pela
  sessão). Mesmo assim, mandar `login` explícito é o comportamento testado e recomendado.
- Existe também a variante `/api/authenticator/v1/pub/authentication/classic/setpassword` (mesmo shape).
- **O `_vss` pode vir de um `start` feito no mesmo request** quando o código não passou pelo `send`
  (código gerado pelo admin): `start(user=<username>)` → `setpassword` funciona, testado.
- ⚠️ **Falhas 4xx vêm em `code`, não em `authStatus`** (ex.: `{"code":"BlockedHostDomain"}`). Um cliente
  que só lê `authStatus` vira "erro inesperado" sem diagnóstico — leia `authStatus ?? code ?? error.code`.
- **Sucesso = `authStatus: "Success"` + os cookies `VtexIdclientAutCookie*`.** Não trate `200` de corpo
  vazio como sucesso sem conferir os cookies.

### 3.5 Mapa de existência de endpoints (probe com body vazio: `404` = não existe)
```
api/authenticator/pub/authentication/classic/validate            400  ✅ existe
api/authenticator/pub/authentication/classic/setpassword         400  ✅ existe
api/authenticator/pub/authentication/accesskey/validate          400  ✅ existe
api/authenticator/pub/authentication/accesskey/send              500  ✅ existe
api/authenticator/v1/pub/authentication/classic/setpassword      400  ✅ existe
api/authenticator/v1/pub/authentication/accesskey/validate       400  ✅ existe
api/authenticator/pub/authentication/passwordless/validate       404  ❌ não existe
api/authenticator/pub/authentication/setpassword                 404  ❌ não existe
```
> Técnica reaproveitável: um `POST` com corpo vazio devolve `400` listando **os campos obrigatórios** —
> é a forma mais rápida de descobrir o contrato de um endpoint não documentado. Ex.:
> `{"errors":{"newPassword":["The newPassword field is required."]}}`.

---

## 4. Catálogo de `authStatus` (observados ao vivo)

| `authStatus` | Significado real | Observação |
|---|---|---|
| `Success` | Autenticado | Vem com `authCookie` + `Set-Cookie` |
| `WrongCredentials` | Senha errada **OU** código errado **OU** código com `_vss` de outra sessão | ⚠️ Resposta **anti-enumeração**: usuário inexistente devolve o mesmo. Não dá para inferir se o usuário existe. |
| `InvalidEmail` | O campo `login`/`email` não tem formato de e-mail | Rotas **legacy** rejeitam username assim |
| `InvalidToken` | `_vss` ausente, expirado (10 min) ou **da outra API** | |
| `InvalidAccessKey` | Código inválido/expirado | |
| `BlockedUser` | Usuário **temporariamente bloqueado** por tentativas | Ver §6 |
| `InvalidB2BClaims` | Organização sem contrato ativo / usuário sem organização válida | **Só a authenticator emite** |
| `WeakPassword` / `InvalidPasswordFormat` | Senha fraca | Mapeamento *best-effort*, não confirmado ao vivo |
| *(corpo vazio + HTTP 403)* | Usuário recém-criado cuja organização/contrato ainda não propagou | Ver §6 |
| *(HTTP 401, corpo em TEXTO PURO)* | **Bloqueio temporário por tentativas** | ⚠️ O corpo é `Seu login está bloqueado temporariamente.` — **não é JSON**, então um cliente que só faz `JSON.parse` cai no erro genérico. Medido em 2026-08-30 no `accesskey/validate`. Trate `HTTP_401` explicitamente, e **nunca** mande "tente de novo": tentar renova o bloqueio. |

**Política de senha da VTEX** (confirmada em help.vtex.com): mínimo **8 caracteres, 1 número,
1 maiúscula, 1 minúscula**. Caractere especial **não** é exigido pela VTEX (testado: senha sem
especial é aceita) — se o seu form exigir, é regra sua.

---

## 5. Cookies de autenticação

Em caso de sucesso, a resposta traz **dois** cookies (nomes reais observados):
```
VtexIdclientAutCookie_{conta}=<JWT>
VtexIdclientAutCookie_{accountId-guid}=<mesmo JWT>
```
- Ambos com `Domain={conta}.myvtex.com; Secure; HttpOnly; SameSite=None`, validade **24h**
  (`expiresIn: 86399`).
- O corpo também traz o JWT em `authCookie: { Name, Value }`.
- O `_vss` é **apagado** pela própria VTEX (`Set-Cookie: _vss=; expires=1970...`) no sucesso.

### Payload do JWT (decodificado, campos úteis)
```json
{
  "sub": "colabsememail29",              // o identificador usado no login
  "account": "b2bgcb",
  "audience": "webstore",
  "userId": "ef1664f6-...",              // VTEX ID user id
  "customerId": "98d7f5c0-...",          // (B2B) id do contrato / conta corporativa
  "unitId": "f5f3c10b-...",              // (B2B) unidade organizacional
  "isRepresentative": true,              // (B2B)
  "roles": null,
  "exp": 1785446640
}
```

### ⚠️ O problema de domínio do cookie (crítico em headless)
O cookie volta com `Domain={conta}.myvtex.com`. Num front rodando em **outro domínio**
(`localhost`, `*.vtex.app`, domínio de produção próprio) ele **não cola**.

Duas saídas:
1. **Re-emitir o cookie server-side removendo/reescrevendo o atributo `Domain`** para o host da request.
   Em **FastStore**, `ctx.storage.cookies.set(name, { setCookie: raw })` faz isso automaticamente (o
   framework normaliza o domínio para o host) — release 2026-02-12.
2. **Configurar o "auth cookie root domain"** do domínio de produção na VTEX (time de Identity). Sem
   isso, em produção o usuário "loga" mas `validateSession`/checkout o vê **deslogado**. É **config VTEX,
   não código**, e é um item obrigatório de go-live.

---

## 6. Gotchas que custaram tempo (leia antes de debugar)

1. **Código atrelado à sessão** (§1, regra de ouro 2) — código certo + `_vss` errado = `WrongCredentials`.
2. **Sucesso do `accesskey/send` é corpo VAZIO.** Presença de `authStatus` no JSON = falha.
3. **Não infira ordem de validação a partir do `authStatus`.** Medido no `classic/setpassword` da
   authenticator com um usuário de contrato **inativo**: código **errado** → `WrongCredentials`; código
   **válido** → `403 InvalidB2BClaims`. Ou seja, a credencial é avaliada primeiro nesse endpoint (uma
   versão anterior deste documento afirmava o contrário). Consequência prática: **nenhum dos dois status
   prova nada** sobre o outro eixo — `WrongCredentials` não garante que o contrato está ok, e
   `InvalidB2BClaims` implica que o código estava certo mas **não** que a senha foi trocada (a rota é
   atômica: recusa sem tocar na senha).
4. **Usuário recém-criado → `403` com corpo VAZIO** no `setpassword`: a organização/contrato ainda está
   propagando (~1–2s). Uma falha real de credencial **sempre** vem como JSON parseável, então dá para
   distinguir: se `!response.ok` **e** o corpo não é JSON → **retentar** (3× / 700ms) em vez de mostrar
   erro. Não retentar aqui queima o código de acesso do usuário à toa.
5. **Bloqueio temporário por tentativas:** após poucas tentativas seguidas, a VTEX passa a responder
   `401 "Seu login está bloqueado temporariamente"` — ou, pior, **`200` fantasma no `send` sem enviar
   e-mail**. Espere ~15–30 min. **Espace os testes automatizados.**
6. **Rate limits reais** (headers): `start` = `x-ratelimit-limit: 200`; `setpassword` =
   `x-ratelimit-limit: 10,50` (duas janelas). Respeite em scripts de QA.
7. **Código de acesso é single-use:** reutilizar o mesmo código devolve `WrongCredentials`.
7b. **`WrongCredentials` no fluxo de código é ambíguo por design:** código errado, código já usado,
   código expirado **ou** usuário sem acesso à organização — todos respondem igual. E o `start` é
   **idêntico** para usuário ativo, sem acesso e **inexistente** (`204` + `_vss`), então **não existe
   como barrar antes de o usuário digitar o código**. Consequência de UX: a mensagem de erro no
   set-password tem que citar as duas saídas (pedir código novo / falar com o admin) em vez de fingir
   diagnóstico — e nunca dizer "senha inválida" numa tela que **define** senha.
   ⚠️ Ao depurar, elimine primeiro a causa banal (código já usado) antes de suspeitar de permissão.
8. **Identificadores de login são IMUTÁVEIS e o usuário é INDELÉVEL.** Não há API para editar/remover
   identifier nem para deletar storefront user. Cada teste **consome** um e-mail/username para sempre.
   Em QA, use `+alias` (mas veja o item 9).
9. **`+alias` no e-mail vira colisão de username** se você derivar username do e-mail truncando no `+`:
   `x+a@` e `x+b@` geram o mesmo username. Além disso o VTEX ID rejeita `+` em username
   (`400 One or more identifiers provided are invalid`). Sanitize (`+` → `.`) e tenha retry com sufixo.
10. **Nem todo erro de identificador é `409`.** Identificador em uso pode responder **`400`** com
    `"One or more identifiers provided are invalid"`. Trate os dois.

---

## 7. Diferenças B2B (contexto: por que a authenticator importa)

Só relevante em contas com **B2B Buyer Portal**. Em B2C, ignore esta seção.

- **Métodos suportados em B2B: username+senha e SSO/IdP. Só.** Código de acesso, Google e Facebook
  **não são suportados como login** (declarado na doc oficial "Login em lojas B2B").
- O código de acesso **continua válido** como **recuperação/definição de senha** — que é o fluxo oficial
  documentado (esqueci a senha → código → redefinir; a senha anterior é removida ao gerar o código).
- **Restrições de acesso:** "usuário não associado a organização válida" e "organização sem contrato
  ativo" bloqueiam o login.
- 🚨 **Furo de segurança da rota legacy (verificado ao vivo):** com contrato **inativo**,
  `vtexid/pub/.../classic/setpassword` devolve **`Success` + cookies = usuário LOGADO**, enquanto o
  `classic/validate` corretamente barra com `InvalidB2BClaims`. Ou seja: **implementar "esqueci minha
  senha" pela rota legacy cria um bypass do bloqueio de organização inativa.**
  **A rota authenticator não tem esse furo** (`403 InvalidB2BClaims`, sem cookie, sem trocar a senha).
  → **Em B2B, use exclusivamente a authenticator.**
- **Usuário sem e-mail é cenário normal em B2B** (e-mail é opcional; username é o identificador
  primário). O admin da organização gera um **código válido por 12h** (Organization > Users > ⋮ > Reset
  password). Esse código **só funciona na rota authenticator**, com `login={username}` — na legacy dá
  `InvalidEmail`.
- **Dois e-mails distintos** em B2B: **recuperação de acesso** (único na loja, opcional, é o que autentica)
  e **transacional** (não precisa ser único, pode ser compartilhado).
- **Regras de username** (doc oficial): 3–30 caracteres, case-insensitive, permitido `letras números . @ - _`,
  sem espaços.
- **Métodos por unidade organizacional:** `GET/POST/PATCH/DELETE /api/vtexid/organization-units/{unitId}/settings`
  define identificação (username/e-mail) e métodos (senha/IdP) **por unidade**. Exige o app
  `vtex.login-alternative-key`. Exemplo de resposta real:
  `{"authenticationMethods":[{"type":"Password","name":"Password","status":"Enabled"}]}`.

---

## 8. Endpoints administrativos úteis (exigem appKey/appToken)

| Objetivo | Endpoint | Nota |
|---|---|---|
| Ver identificadores de um usuário | `GET /api/vtexid/pvt/user/info?user={username ou email}` | Resource *View User*. Se `userEmail` == username, o usuário **não tem e-mail**. Retorna `null` se não achar. |
| Expirar a senha de um usuário | `POST /api/vtexid/password/expire?email={email}` | Resource *Expire User Password*. |
| Criar storefront user | `POST /api/authenticator/storefront/users?isLegacyPassword=false` | Também existe `/api/authenticator/v1/storefront/users` (documentado). **Testado: os dois se comportam igual para login.** `isLegacyPassword=false` → usuário nasce **sem senha** e a define no 1º acesso. |

> ⚠️ **Segredos server-side sempre.** `appKey`/`appToken` nunca no browser, nunca em log, nunca commitados.

---

## 9. Arquitetura de referência (o que funcionou em FastStore)

O handshake **não pode** rodar no browser (os cookies do VTEX ID precisam ser re-emitidos com o domínio
certo, e você não quer expor o fluxo). O que funcionou:

- **Mutations GraphQL** como API extension (`src/graphql/vtex/resolvers/`), **não** Next API Route custom,
  **não** `patch-package` (patch não sobe para produção no VTEX WebOps).
- Uma mutation por operação: `loginWithPassword`, `sendAccessCode`, `setPassword`.
- O resolver: chama o VTEX ID → em caso de sucesso, repassa cada `Set-Cookie` para o browser via
  `ctx.storage.cookies.set(...)` → o front roda `validateSession()` para popular a sessão.
- Persistir o `_vss` entre `send` e `setpassword` como cookie **first-party** (`HttpOnly`), e **limpá-lo**
  no fim do fluxo.
- **Defesa em profundidade (opcional):** depois de um `setpassword` com `Success`, e **antes** de repassar
  os cookies, rodar `start` + `classic/validate` com a senha recém-definida; se não vier `Success`, não
  emita sessão. É **obrigatório se você usar a rota legacy** (é a única forma de tapar o furo do §7) e
  **redundante na authenticator**, que já recusa na origem e de forma atômica — ali é só seguro contra
  regressão da plataforma, ao custo de 1 round-trip em todo set-password bem-sucedido. No projeto
  `b2bgcb` foi implementada na fase legacy e **removida** ao migrar para a authenticator.
- **Retry de propagação:** um usuário/organização recém-criado pode receber `403` (corpo vazio na legacy,
  possivelmente `InvalidB2BClaims` na authenticator) por alguns segundos. Retentar é seguro na
  authenticator porque a recusa é atômica — mas mantenha o teto baixo: `setpassword` tem
  `x-ratelimit-limit: 10,50`.
- **Um identificador sem `@` nunca vai receber e-mail** (`accesskey/send` → `BlockedHostDomain`). Em B2B,
  trate esse caso como "o código vem do admin": rode só o `start`, guarde o `_vss` e leve o usuário para
  a tela de código — o `setpassword` aceita `login=<username>`.

### Teste sem browser (receita de QA)
Dá para exercitar o fluxo inteiro por `curl` contra o próprio endpoint GraphQL local:
```bash
POST /api/graphql?operationName=X&operationHash=Y
body: {"operationName":"X","operationHash":"Y","variables":{...}}
```
- Os hashes das *persisted queries* ficam em `.faststore/@generated/persisted-documents.json`.
- ⚠️ **Use cookie jar** (`curl -c/-b`): o `_vss` emitido pelo `send` precisa chegar no `setpassword`.
  Sem o jar dá `InvalidToken`, que **parece** "código errado".

---

## 10. Documentação oficial de referência

- [Login em lojas B2B](https://help.vtex.com/pt/docs/tutorials/login-em-lojas-b2b) ·
  [Login for B2B stores](https://help.vtex.com/en/docs/tutorials/login-for-b2b-stores)
- [Configurar métodos de autenticação por unidade organizacional](https://help.vtex.com/pt/docs/tutorials/configurar-metodos-de-autenticacao-por-unidade-organizacional)
- [Adicionar usuários à organização compradora](https://help.vtex.com/pt/docs/tutorials/adicionar-usuarios-a-organizacao-compradora) (código de 12h)
- [VTEX ID API](https://developers.vtex.com/docs/api-reference/vtex-id-api) ·
  [Headless authentication](https://developers.vtex.com/docs/guides/headless-authentication) ·
  [Refresh token flow for headless](https://developers.vtex.com/docs/guides/refresh-token-flow-for-headless-implementations)
- [B2B user provisioning](https://developers.vtex.com/docs/guides/b2b-user-provisioning) ·
  [B2B password migration](https://developers.vtex.com/docs/guides/b2b-password-migration)
- [Login (SSO)](https://developers.vtex.com/docs/guides/login-integration-guide)

> ⚠️ **`classic/validate`, `accesskey/send` e `classic/setpassword` NÃO estão no catálogo oficial de API**
> (varredura completa em help center + dev portal + API reference, 2026-07-28). Tudo neste documento
> sobre eles é conhecimento obtido por teste direto.
