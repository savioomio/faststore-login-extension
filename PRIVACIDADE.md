# Política de Privacidade — Login de teste em lojas VTEX (Wicomm)

**Extensão:** Login de teste em lojas VTEX — Wicomm
**Responsável:** Wicomm
**Contato:** saviopessoaafonso@gmail.com
**Vigente desde:** 31 de agosto de 2026

> Esta extensão é uma ferramenta independente de desenvolvimento. **Não é um
> produto da VTEX**, não tem vínculo, patrocínio nem endosso da VTEX. "VTEX" e
> "FastStore" são marcas de seus respectivos titulares, citadas aqui apenas para
> identificar com quais sistemas a ferramenta funciona.

---

## Resumo em uma frase

A extensão não tem servidor, não coleta telemetria e não envia nada para a
Wicomm nem para terceiros: os dados que você digita vão **direto do seu
navegador para a API de autenticação da VTEX**, e o que sobra fica **no seu
próprio navegador**.

---

## 1. Que dados a extensão trata

| Dado | Para quê | Para onde vai | Quanto tempo fica |
|---|---|---|---|
| **E-mail** que você digita | iniciar o login no VTEX ID | API da VTEX (`https://<conta>.myvtex.com/api/...`) | enquanto o login está em andamento, em `chrome.storage.session` — apagado ao concluir e ao fechar o navegador |
| **Código de acesso** (6 dígitos) ou **senha** | provar que a conta é sua | API da VTEX | **não é armazenado**: é usado na requisição e descartado |
| **`authenticationToken`** (token intermediário do VTEX ID) | amarrar as etapas do login | fica no navegador | `chrome.storage.session` — morre com a sessão do navegador |
| **Cookie de sessão da VTEX** (`VtexIdclientAutCookie_<conta>`, um JWT) | manter você logado na loja de teste | gravado como cookie **apenas** em `localhost`, `127.0.0.1` e `*.vtex.app` | até você clicar em "Sair desta conta", desinstalar a extensão ou o cookie expirar |
| **Nome da conta e endereço da loja** (ex.: `boldb2b`, `http://localhost:3000`) | lembrar a loja da última vez | `chrome.storage.local`, no seu computador | até você corrigir a loja ou desinstalar a extensão |

**Não há coleta de:** histórico de navegação, conteúdo de páginas, endereço IP,
localização, contatos, dados financeiros, telemetria, métricas de uso ou
identificadores de publicidade.

## 2. Para onde os dados vão

Para **um único destino**: os endpoints de autenticação da própria VTEX, no
domínio da conta que você está testando.

- **Não existe servidor da Wicomm** nesse circuito. Nada é enviado para nós.
- **Nada é vendido, alugado, compartilhado ou transferido** para terceiros.
- **Não há código remoto**: todo o código executado vem no pacote da extensão.
- Os dados **não** são usados para publicidade, para determinar crédito, para
  empréstimo, nem para qualquer finalidade fora do login que você pediu.

## 3. Onde a extensão age

A extensão só grava sessão em **ambiente de teste**:

- `http://localhost` e `http://127.0.0.1`
- `https://*.vtex.app` (o preview da loja)

**Nunca em produção.** O domínio `*.myvtex.com` aparece nas permissões apenas
para **ler** a API de autenticação — que só existe lá — e essa leitura roda com
`credentials: 'omit'`, ou seja, sem enviar nem tocar em nenhuma sessão sua já
existente naquele domínio.

## 4. Permissões, e o que morre sem cada uma

| Permissão | Sem ela… |
|---|---|
| `cookies` | a extensão não consegue gravar nem apagar o cookie de sessão — que é a função inteira dela |
| `storage` | o login não sobrevive ao service worker do Chrome dormir no meio do processo |
| `scripting` | o "sair" não desloga de verdade: o FastStore guarda a sessão no IndexedDB da página, e só um script injetado alcança ali |
| `host_permissions` | sem `localhost`/`127.0.0.1`/`*.vtex.app` não há onde gravar a sessão; sem `*.myvtex.com` não há como chamar a API de login |

Não há `<all_urls>`, nem permissão de histórico, abas ou downloads.

## 5. Como apagar seus dados

- **"Sair desta conta"** no popup: apaga o cookie de sessão e limpa a sessão que
  a loja guarda no navegador.
- **Desinstalar a extensão**: o Chrome remove `chrome.storage.local` e
  `chrome.storage.session` junto.
- Como não há servidor nosso, **não existe cópia em lugar nenhum para pedir a
  exclusão**. Nada sai do seu computador exceto para a VTEX.

Para dados que a **VTEX** guarda sobre sua conta de usuário, o responsável é a
VTEX, sob a política de privacidade dela.

## 6. Menores de idade

A ferramenta é destinada a profissionais que desenvolvem ou aprovam lojas. Não é
direcionada a menores de 13 anos e não coleta dados deles conscientemente.

## 7. Mudanças nesta política

Se o tratamento de dados mudar, esta política é atualizada **antes** da versão
correspondente ir ao ar, e a mudança é comunicada na descrição da atualização na
Chrome Web Store. A data de vigência acima muda junto.

---

# Privacy Policy (English) — VTEX Test Login (Wicomm)

**Independent development tool. Not a VTEX product; not affiliated with,
sponsored, or endorsed by VTEX.**

**Summary:** this extension has no server of its own, collects no telemetry, and
sends nothing to Wicomm or to any third party. What you type goes **straight
from your browser to VTEX's own authentication API**; everything else stays in
your browser.

**Data handled**

- **Email address** you type — sent to VTEX's authentication API to start the
  login; held in `chrome.storage.session` only while the login is in progress,
  cleared on completion and when the browser closes.
- **Access code or password** — sent to VTEX to prove the account is yours;
  **never stored**, used in the request and discarded.
- **VTEX `authenticationToken`** — intermediate login token, kept in
  `chrome.storage.session`, gone when the browser session ends.
- **VTEX session cookie** (`VtexIdclientAutCookie_<account>`, a JWT) — written as
  a cookie **only** on `localhost`, `127.0.0.1` and `*.vtex.app`, until you log
  out, uninstall, or it expires.
- **Store account name and address** (e.g. `boldb2b`, `http://localhost:3000`) —
  kept in `chrome.storage.local` on your machine to remember the last store.

**Not collected:** browsing history, page content, IP address, location,
contacts, financial data, telemetry, usage analytics, advertising identifiers.

**Where it goes:** only to VTEX's own authentication endpoints on the account
domain you are testing. No Wicomm server is involved. Data is never sold,
rented, shared or transferred to third parties, never used for advertising or
creditworthiness, and never used for any purpose beyond the login you requested.
The extension executes **no remote code**.

**Where it acts:** it writes a session only on `localhost`, `127.0.0.1` and
`*.vtex.app`. Never in production. The `*.myvtex.com` host permission exists only
to **read** the authentication API — which is hosted only there — and that read
runs with `credentials: 'omit'`, so it neither sends nor touches any existing
session of yours on that domain.

**Deleting your data:** use "Sair desta conta" (log out) in the popup, or
uninstall the extension — Chrome removes its storage with it. There is no
server-side copy to request deletion of. Data VTEX holds about your user account
is governed by VTEX's own privacy policy.

**Children:** the tool targets professionals building or reviewing stores; it is
not directed at children under 13 and does not knowingly collect their data.

**Changes:** this policy is updated before any release that changes data
handling, and the change is noted in the Chrome Web Store update description.

**Contact:** saviopessoaafonso@gmail.com
