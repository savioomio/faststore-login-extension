# Regras de segurança

> Esta ferramenta autentica **pessoas de verdade** em **contas de cliente de
> verdade** e guarda o resultado no navegador do desenvolvedor. As regras abaixo
> não são preferência de estilo. Cada uma delas, quebrada, vira incidente.

---

## R-1 — Nada de `appKey` / `appToken` na extensão. Nunca.

Todo o fluxo usa **rotas públicas** (`/api/vtexid/pub/...`), que autenticam o
**usuário**, não a aplicação. Elas não pedem credencial administrativa, e é
exatamente isso que torna a extensão possível.

`appKey`/`appToken` são credenciais de **administrador da conta**. Numa extensão
de navegador elas ficariam:
- legíveis por qualquer um com acesso ao perfil do Chrome,
- legíveis no pacote da extensão se compartilhada,
- e capazes de **impersonar qualquer cliente** e ler dados pessoais em massa.

Se em algum momento parecer que "só falta o appToken para funcionar", **pare**:
a resposta certa é outro endpoint público, não a credencial de admin.

## R-2 — A extensão age em desenvolvimento e preview. Não em produção.

| Host | Pode? | Por quê |
| :--- | :---: | :--- |
| `localhost`, `127.0.0.1` | ✅ | Ambiente do desenvolvedor. O framework tem carve-out explícito para cookie injetado (`utils/isLocalHost.ts`). |
| `*.vtex.app` | ✅ | O preview que vai para o cliente. Sofre o mesmo problema de domínio cruzado, e o cliente não tem como resolver na mão. |
| `*.myvtex.com` | ❌ | É onde vive a **sua sessão real de admin**. Escrever aqui derrubaria o seu próprio login. |
| Produção (`.com.br`, domínio do cliente) | ❌ | **Não é restrição, é desnecessidade.** Ver abaixo. |

### Por que produção fica de fora

Não é que seja perigoso e a gente se contenha — é que **lá o problema não
existe**. Em produção o *auth cookie root domain* está configurado na VTEX
(item obrigatório de go-live, ver [reference §5](../reference/vtex-id.md)), os
domínios são unificados e o login nativo da loja funciona sozinho. A extensão
não teria o que fazer.

O corolário é o que importa: **se alguém sentir falta da extensão em produção, o
defeito é de configuração da conta, não da ferramenta.** A resposta certa é abrir
o ticket na VTEX, nunca estender a extensão para lá.

### ⚠️ Correção de uma versão anterior desta regra

Até 2026-08-30 esta regra dizia que fora de `localhost` "o `@faststore/core`
sobrescreve o cookie de qualquer jeito". **Isso era dedução, não medição, e está
errado.** O que foi medido depois:

- `.vtex.app` **está** na allowlist de normalização de domínio de cookie do
  framework (`pages/api/graphql.ts:19`, `ALLOWED_HOST_SUFFIXES`);
- o cookie injetado só é apagado quando a loja tem
  `experimental.refreshToken: true` — aí o primeiro `ValidateSession` cai em
  `firstRefreshRequest` e o front chama `logoutAndClearSession`
  (`utils/validateSessionRefreshToken.ts:24-28`);
- com `refreshToken: false` (o caso da `boldb2b`), o cookie sobrevive no preview.

A extensão trata esse caso: ela detecta a sessão sumindo logo após um login
bem-sucedido e **explica a causa**, em vez de deixar parecer código errado.

Fica o registro como lembrete do que a [regra 1 de docs](../README.md) manda:
afirmação sobre a plataforma **sem `curl` que a prove** é achismo, mesmo quando
escrita por quem leu o código.

## R-3 — Segredo não vai para o disco em texto claro, e senha preferencialmente não vai.

O que a extensão pode guardar, e onde:

| Dado | Onde | Por quê |
|---|---|---|
| Lista de perfis (rótulo, conta, e-mail) | `chrome.storage.local` | Não é segredo. |
| JWT de sessão (`VtexIdclientAutCookie_*`) | `chrome.storage.session` | Vive 24h no máximo e some ao fechar o navegador. |
| `authenticationToken` (`_vss`) | memória do service worker | Vive 10 min. Não persistir. |
| Senha | **preferencialmente em lugar nenhum** | Ver abaixo. |

Se guardar senha vier a ser aprovado (é uma decisão em aberto —
[`tasks/extensao.md`](../tasks/extensao.md)), então: `chrome.storage.local`
cifrado com WebCrypto e chave derivada de uma senha-mestra que o dev digita —
**nunca** texto claro, e **nunca** para usuário que não seja de teste.

## R-4 — Nada de segredo em log, em documento ou em commit.

Nem JWT, nem código de acesso, nem senha — **mesmo expirado, mesmo de conta de
teste**. Um JWT da VTEX carrega `userId`, `customerId`, `unitId` e a conta: é
dado pessoal e mapa da organização do cliente.

Em documento use `<jwt>`, `<código>`, `usuario@exemplo.com`.
No código, nada de `console.log` de resposta crua de autenticação.

## R-5 — Mensagem de erro nunca revela se o usuário existe.

`WrongCredentials` é a resposta da VTEX tanto para senha errada quanto para
usuário inexistente — é **anti-enumeração por design**. Uma UI que diferencie os
dois casos transforma a extensão num verificador de e-mails cadastrados na base
do cliente.

Isto vale mesmo sendo ferramenta interna: o comportamento vaza para os prints,
para o vídeo de demonstração e para o próximo lugar onde o código for colado.

## R-6 — Login é ação do dono da conta, não da ferramenta.

A extensão automatiza o **transporte** do cookie. Ela não decide por quem entrar.
Cada login exige a interação de quem tem acesso àquela caixa de e-mail (o código
de 6 dígitos) ou àquela senha.

Corolário: **não** implementar impersonation por telesales/`vtex.impersonate-session`
nem nada que use credencial de admin para entrar como cliente arbitrário. Isso
existe na plataforma, é legítimo no contexto certo, e **não é o contexto desta
ferramenta** (ver R-1).

## R-7 — Respeite os limites da plataforma.

| Endpoint | Limite observado |
|---|---|
| `start` | `x-ratelimit-limit: 200` |
| `setpassword` | `x-ratelimit-limit: 10,50` (duas janelas) |

E: **código de acesso é de uso único**; após poucas tentativas seguidas a VTEX
responde `200` no `send` **sem enviar e-mail** e bloqueia o usuário por 15–30 min.

A extensão precisa ter botão de "reenviar código" com contador, e não pode ter
retry automático em cima de falha de credencial. Retentar só o caso conhecido de
propagação (`4xx` com corpo **não-JSON**), teto de 3 tentativas.

## R-8 — Permissões da extensão: o mínimo que funciona.

Pedir `<all_urls>` numa extensão que mexe com cookie de sessão é injustificável.
O conjunto **de hoje** está logo abaixo; a
[research de viabilidade](../research/2026-08-30-viabilidade-extensao-dev-login.md#5-permissões-mínimas)
guarda o conjunto **original**, de 2026-08-30, e envelheceu de propósito — mudou
duas vezes desde então.

Toda permissão nova entra com uma linha explicando **qual funcionalidade morre
sem ela**. E toda permissão que **deixa** de ser necessária sai — não se guarda
permissão "por via das dúvidas".

**Conjunto de hoje** (`extension/manifest.json`, 2026-08-31):

| Permissão | O que morre sem ela |
|---|---|
| `cookies` | não há como gravar nem apagar o cookie de sessão. É a função inteira |
| `storage` | o login se perde quando o service worker dorme, entre pedir o código e digitá-lo |
| `scripting` | o logout não desloga a interface: a sessão do FastStore vive no IndexedDB da página |
| 4 hosts | 3 para gravar a sessão (`localhost`, `127.0.0.1`, `*.vtex.app`), 1 só para **ler** a API (`*.myvtex.com`) |

`tabs` **saiu** em 2026-08-31: os `host_permissions` já entregam `tab.url` nas
abas que interessam, e `tabs.reload()` não pede permissão nenhuma. Deduzido da
documentação da API e **conferido no navegador** antes de fechar —
[T-014](../tasks/extensao.md#t-014--a-permissão-tabs-saiu-do-manifesto).

Nunca houve `<all_urls>`, e isso também é o que faz a revisão da Chrome Web Store
ser possível ([ADR-0005](../adr/0005-distribuicao-pela-chrome-web-store.md)).
