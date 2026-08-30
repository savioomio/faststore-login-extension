# faststore-login-extension

Loga um usuário VTEX numa loja em **`localhost`** ou num **preview
`.vtex.app`**, sem copiar cookie do DevTools na mão.

| Onde | Para quem | Por quê |
| :--- | :--- | :--- |
| `localhost`, `127.0.0.1` | desenvolvedor | testar funcionalidade logada |
| `*.vtex.app` | **cliente**, na homologação | aprovar o que exige login sem tocar em DevTools |
| produção (`.com.br`) | — | **não precisa**: lá o domínio é unificado e o login nativo funciona |

> Se alguém sentir falta desta extensão **em produção**, o defeito é de
> configuração da conta VTEX (*auth cookie root domain*), não da ferramenta.
> A resposta certa é o ticket na VTEX. Ver
> [ADR-0004](../docs/adr/0004-preview-entra-producao-nao.md).

---

## Instalar

1. `chrome://extensions` (ou `comet://extensions`)
2. Ligue **Modo do desenvolvedor**
3. **Carregar sem compactação** → aponte para esta pasta (`extension/`)

Não há build. São arquivos soltos.

> ⚠️ **Depois de editar qualquer arquivo, clique em recarregar (↻) na página de
> extensões.** O Chrome atualiza o popup na hora mas **pode manter o service
> worker antigo vivo** — aí o popup novo conversa com o background velho e a
> tela mostra bobagem. A extensão detecta esse desencontro e diz "recarregue",
> mas só a partir da versão que já estiver rodando.

## Usar

Com a loja aberta (`http://localhost:3000` ou `https://<conta>.vtex.app`),
clique no ícone da extensão. A etiqueta no topo diz em qual ambiente você está.

1. A **conta** vem preenchida — no preview ela é lida do endereço (exata); em
   localhost é detectada na página (heurística). Corrija se estiver errada.
2. Digite o **e-mail** do usuário e **Enviar código**.
3. Pegue o código de 6 dígitos no e-mail, volte e digite. A loja recarrega logada.

Com **senha**: preencha o campo de senha junto com o e-mail e entre direto, sem
ida à caixa de entrada. O campo só aparece se a conta habilitar o método.

**Trocar de usuário:** *Sair e limpar cookie*, depois entrar com outro e-mail.
**Logout:** o mesmo botão.

> Fechar o popup para ir buscar o código **é o caminho normal** — a extensão
> guarda a sessão do login em andamento e volta no mesmo passo quando você
> reabre.

---

## Como funciona

```
  extensão (service worker)              VTEX ID                 localhost
  ─────────────────────────              ───────                 ─────────
  1. start ────────────────────────────────▶
     ◀──────── authenticationToken + métodos habilitados
  2. accesskey/send ───────────────────────▶  (envia o e-mail)
  3. [você digita o código]
  4. accesskey/validate ───────────────────▶
     ◀──────── authCookie.Value (o JWT)
  5. chrome.cookies.set ─────────────────────────────────────────▶
                                             VtexIdclientAutCookie_<conta>
  6. reload da aba
```

Três coisas fazem isso funcionar, e nenhuma é óbvia:

**O JWT vem no corpo JSON**, não só no `Set-Cookie`. Por isso a extensão nunca
precisa ler header de resposta de outro domínio — o que em MV3 exigiria
`webRequest` com permissão larga.

**O handshake é stateless.** O `authenticationToken` vai no **corpo** de cada
passo, e tudo roda com `credentials: 'omit'`. Consequência: a extensão não toca
na sua sessão real do ambiente IO, e não existe o clássico bug de "código válido
responde `WrongCredentials`" (que acontece quando o `_vss` do envio não é o mesmo
da validação). Ver [ADR-0002](../docs/adr/0002-handshake-stateless-token-no-corpo.md).

**O FastStore já espera isso.** O `@faststore/core` documenta no próprio código
que `localhost` existe para receber cookie injetado na mão, e o fluxo de
refresh-token desiste ali de propósito para não apagá-lo
(`utils/isLocalHost.ts`, `sdk/account/useRefreshToken.ts:17-22`).

---

## O que ela não faz, de propósito

- **Não guarda credencial nenhuma.** Nem senha, nem JWT, nem lista de contas
  logadas. Trocar de usuário é logout + login.
  ([ADR-0003](../docs/adr/0003-sem-cofre-de-credenciais.md))
- **Não escreve cookie em produção nem em `.myvtex.com`.** Em produção não é
  preciso; em `.myvtex.com` derrubaria a sua própria sessão de admin.
  ([R-2](../docs/rules/seguranca.md#r-2--a-extensão-age-em-desenvolvimento-e-preview-não-em-produção))
- **Não usa `appKey`/`appToken`.** Só rotas `/pub/`, que autenticam o **usuário**.
  ([R-1](../docs/rules/seguranca.md#r-1--nada-de-appkey--apptoken-na-extensão-nunca))
- **Não define nem redefine senha.** É operação que altera a conta do usuário, e
  na família legacy tem furo de segurança conhecido em B2B.

## Permissões: ler e escrever são coisas diferentes

O `*.myvtex.com` no manifesto engana. Ele **não** é para escrever sessão lá:

| Domínio | A extensão **lê** (chama API) | A extensão **escreve** (grava sessão) |
| :--- | :---: | :---: |
| `*.myvtex.com` | ✅ é o **único** lugar onde a API do VTEX ID existe | ❌ nunca — é onde vive a sua sessão de admin |
| `localhost`, `127.0.0.1` | — | ✅ |
| `*.vtex.app` | — | ✅ |

Medido em 2026-08-30: `/api/vtexid/pub/authentication/start` responde **404** em
`localhost:3000` e em `boldb2b.vtex.app`, e **200** em `boldb2b.myvtex.com`. Não
há como falar com o VTEX ID sem essa permissão.

E a leitura roda com `credentials: 'omit'`, então **não toca na sua sessão de
admin** — nem envia, nem sobrescreve. Ver
[ADR-0002](../docs/adr/0002-handshake-stateless-token-no-corpo.md).

Quem manda em onde se pode **escrever** é o [`alvo.js`](alvo.js), não o manifesto.

---

## Testes

```bash
node testes/alvo.mjs        # onde pode agir + descoberta da conta (puro)
node testes/sessao.mjs      # limpeza do IndexedDB, contra um duplo da API
node testes/mensagens.mjs   # background com o chrome mockado, como o popup o chama
node testes/vtexid.mjs      # handshake contra a conta REAL (precisa de rede)
```

O `mensagens.mjs` é o que pega a classe de bug "o popup pergunta X e o background
responde Y" — foi escrito depois de ela acontecer. O `vtexid.mjs` só exercita
caminhos de **falha**: credencial errada de propósito, para não gastar código de
acesso de usuário real.

---

## Arquivos

| | |
|---|---|
| `manifest.json` | MV3. Três permissões, quatro hosts — nada de `<all_urls>`. |
| `alvo.js` | **Onde a extensão pode agir** e como descobre a conta. Separado de propósito: é a regra mais sensível do projeto. |
| `sessao-da-pagina.js` | Zera a sessão que o FastStore guarda no IndexedDB. **Sem isto o logout não desloga a tela.** |
| `vtexid.js` | O handshake. **Leia o cabeçalho antes de alterar.** |
| `background.js` | Detecção da conta, cookie, e a sessão do login em andamento. |
| `popup.html/css/js` | Interface. Só desenha e coleta. |

---

## Quando der errado

| Sintoma | Causa provável |
|---|---|
| "fora de alcance" | Só `localhost`, `127.0.0.1` e `*.vtex.app`. Nem `0.0.0.0`, nem IP de rede, nem `.myvtex.com` (é onde vive a sua sessão de admin). |
| **No preview:** loga, recarrega e volta deslogado | A loja está com `experimental.refreshToken: true`. O preview não tem como renovar o token e derruba a sessão no primeiro `ValidateSession`. A extensão detecta e avisa. Desligue a flag para homologar, ou teste em localhost. |
| Diz "Minha conta" mas toda ação falha | Sessão da tela e cookie discordando. Confira os dois no DevTools → Application: **Cookies** (`VtexIdclientAutCookie_<conta>`) e **IndexedDB** → `keyval-store` → `keyval` → `fs::session`. A extensão sincroniza os dois; se divergiram, algo mais mexeu ali. Ver [reference](../docs/reference/faststore-sessao.md). |
| Conta detectada errada | Corrija no campo; ele é editável de propósito. A detecção é heurística (o `__NEXT_DATA__` não carrega o `storeId`). |
| "A sessão do login expirou" | O `authenticationToken` dura 10 min. Peça código novo. |
| Código certo recusado | Ele é de **uso único** — é a causa banal, elimine ela primeiro. |
| `200` no envio mas o e-mail não chega | Bloqueio temporário por tentativas. Espere 15–30 min; a VTEX responde `200` fantasma nesse estado. |
| Logou, mas a loja mostra visitante | Confirme que a conta do cookie bate com `api.storeId` do `discovery.config.js`. O nome é `VtexIdclientAutCookie_<storeId>`, exato. |
| Favorito falha logado | O resolver da loja degrada calado para `null`. Para ver o erro real, bata direto na IO — receita no [runbook](../docs/runbooks/sondar-endpoint-vtex-id.md). |

Erros do VTEX ID e o que significam de verdade: [base de conhecimento §4](../docs/reference/vtex-id.md).
