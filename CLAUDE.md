# CLAUDE.md — faststore-login-extension

Ponto de entrada para agentes. Leia inteiro antes de escrever a primeira linha.

Este repo tem **um** produto: a extensão em [`extension/`](extension/).

**O código não tem comentários, de propósito.** O que explicaria cada trecho vive
em [`docs/runbooks/mexer-no-codigo.md`](docs/runbooks/mexer-no-codigo.md) — leia a
seção do arquivo antes de editá-lo. Descobriu algo novo? Atualize aquele
documento, não escreva no fonte.

---

## 1. Antes de tocar em código

| Preciso saber… | Vá para |
|---|---|
| Como a autenticação da VTEX funciona | [`docs/reference/vtex-id.md`](docs/reference/vtex-id.md) |
| Onde a sessão do cliente realmente mora | [`docs/reference/faststore-sessao.md`](docs/reference/faststore-sessao.md) |
| O que **não** se faz, nunca | [`docs/rules/seguranca.md`](docs/rules/seguranca.md) |
| Por que é assim, e não do jeito óbvio | [`docs/adr/`](docs/adr/) |
| O que já foi medido, e como | [`docs/research/`](docs/research/) |
| O que falta fazer | [`docs/tasks/extensao.md`](docs/tasks/extensao.md) |
| Como a extensão se usa | [`extension/README.md`](extension/README.md) |
| Como publicar na Chrome Web Store | [`docs/runbooks/publicar-na-chrome-web-store.md`](docs/runbooks/publicar-na-chrome-web-store.md) |
| O que a extensão faz com os dados de quem usa | [`PRIVACIDADE.md`](PRIVACIDADE.md) |

**Você não precisa pesquisar a API do VTEX ID nem inventar endpoint.** A
reference tem tudo, e cada afirmação dela traz o `curl` que a prova.

---

## 2. Oito coisas que já custaram caro

Não são preferências. Cada uma quebrou alguma coisa de um jeito que **parecia
outro problema**.

1. **Nada de `appKey`/`appToken`.** Não é zelo, é o que torna o projeto possível:
   rotas `/pub/` autenticam o **usuário**, não a aplicação. Se parecer que "só
   falta o appToken", a resposta certa é outro endpoint.

2. **A sessão não é o cookie.** O FastStore guarda `person` no **IndexedDB**
   (`keyval-store` → `keyval` → `fs::session`). Apagar o cookie **não desloga a
   interface** — a loja segue dizendo "Minha conta" e toda ação falha. Ver
   [`sessao-da-pagina.js`](extension/sessao-da-pagina.js) e a
   [reference](docs/reference/faststore-sessao.md).

3. **Nunca misture as duas famílias de API** — `/api/vtexid/pub/` (legacy) e
   `/api/authenticator/pub/` (authenticator). O token de uma dá `InvalidToken` na
   outra. Um fluxo inteiro roda numa família só.

4. **Sucesso do `accesskey/send` é corpo VAZIO.** JSON com `authStatus` é
   **falha**. Tratar ao contrário faz o usuário esperar um e-mail que não vem.

5. **`WrongCredentials` é ambíguo por design** (anti-enumeração): senha errada,
   código errado, código **já usado**, ou usuário inexistente respondem igual.
   Nunca escreva mensagem que revele se o e-mail existe. Ao depurar, elimine
   primeiro a causa banal: o código é de **uso único**.

6. **Permissão que não é mais necessária sai do manifesto.** `tabs` saiu em
   2026-08-31: os `host_permissions` já entregam `tab.url` nas abas que
   interessam. O efeito colateral é que numa aba **fora** deles o Chrome devolve
   `tab.url` como `undefined` — e a resposta certa é a recusa normal ("não é uma
   loja"), não "nenhuma aba aberta". Hoje são `cookies`, `storage`, `scripting` e
   quatro hosts. Ver [R-8](docs/rules/seguranca.md#r-8--permissões-da-extensão-o-mínimo-que-funciona).

7. **O service worker do MV3 morre sozinho** (~30s de ociosidade) e **sobrevive a
   editar arquivos**. Por isso o `authenticationToken` vive em
   `chrome.storage.session`, e por isso existe o `PROTOCOLO` entre popup e
   background — se você mudar o formato das mensagens, **suba o número**, senão a
   tela mostra `undefined` em vez de "recarregue a extensão".

8. **Nada de segredo em log, documento ou commit.** Nem JWT, nem código, nem
   senha — mesmo expirados, mesmo de teste. Um JWT da VTEX carrega `userId`,
   `customerId`, `unitId` e a conta.

---

## 3. Onde a extensão pode agir

`localhost`, `127.0.0.1` e `*.vtex.app`. **Nunca produção, nunca `*.myvtex.com`.**

A regra inteira vive em [`extension/alvo.js`](extension/alvo.js), sozinha num
arquivo de propósito: é ela que decide onde uma sessão pode ser escrita.

⚠️ **O `*.myvtex.com` do manifesto engana.** Ele é para **ler** — a API do VTEX
ID só existe lá (medido: 404 em localhost e no preview, 200 no myvtex). Escrever
lá é proibido, e a leitura roda com `credentials: 'omit'`, sem tocar na sessão de
admin de quem desenvolve. Ver
[ADR-0002](docs/adr/0002-handshake-stateless-token-no-corpo.md) e
[R-2](docs/rules/seguranca.md#r-2--a-extensão-age-em-desenvolvimento-e-preview-não-em-produção).

---

## 4. Como se afirma coisa aqui

Este projeto depende de endpoints que a **VTEX não documenta**. Não existe
especificação além da evidência que a gente mesmo produziu.

- **Toda afirmação sobre a API traz o `curl` e a resposta.** "Parece que" não
  entra em documento nem em comentário.
- **Toda afirmação sobre código aponta `arquivo:linha`.**
- **Separe o observado do deduzido.** Toda research termina com "Limites desta
  investigação".
- **Antes de sondar endpoint novo**, leia o
  [runbook](docs/runbooks/sondar-endpoint-vtex-id.md): ele tem o padrão de três
  testes (A/B/C) que separa "funcionou" de "coincidência", e os limites de taxa
  que fazem você concluir a coisa errada se ignorados.

> Já aconteceu de uma regra deste repo estar **errada por dedução** — a
> [R-2](docs/rules/seguranca.md#-correção-de-uma-versão-anterior-desta-regra)
> afirmava, sem medir, que o framework sobrescrevia o cookie fora de localhost.
> A correção ficou registrada de propósito. Ler o código não substitui medir.

---

## 5. Testes

```bash
node docs/testes/alvo.mjs        # onde pode agir + descoberta da loja
node docs/testes/sessao.mjs      # limpeza da sessão guardada no navegador
node docs/testes/mensagens.mjs   # o background, como a janelinha o chama
node docs/testes/vtexid.mjs      # login contra a conta REAL (precisa de rede)
```

Ficam fora de `extension/` para não irem junto no pacote do navegador. Node puro,
sem instalar nada. **Rode os quatro antes de dizer que está pronto.** O que cada
um cobre e o que nenhum cobre: [`docs/testes/README.md`](docs/testes/README.md).

- `mensagens.mjs` pega a classe "o popup pergunta X e o background responde Y" —
  foi escrito depois de ela acontecer.
- `vtexid.mjs` só exercita caminhos de **falha**, com credencial errada de
  propósito. Um login **bem-sucedido** nunca foi automatizado: exigiria consumir
  código de acesso de usuário real. Isso se testa à mão, no navegador.

⚠️ **Espace os testes de rede.** `start` tem rate limit de 200 e, após poucas
tentativas seguidas, a VTEX responde `200` fantasma no `send` **sem enviar
e-mail** e bloqueia o usuário por 15–30 min. Um bloqueio no meio de uma
investigação faz você concluir a coisa errada.

---

## 6. Deixar o rastro

**Descobriu algo sobre a plataforma** → vai para
[`docs/reference/`](docs/reference/), não só para a research. É de lá que os
outros projetos se servem.

**Investigou e o resultado é conhecimento** → research datada em
[`docs/research/`](docs/research/), **e as tasks que saíram dela**.

**Tomou uma decisão que fecha uma porta** → [ADR](docs/adr/). O teste: se daqui a
seis meses alguém desfizer isso sem saber o motivo e quebrar algo, é ADR.

**Descobriu um procedimento repetível** → [runbook](docs/runbooks/).

**Fechou uma task** → mude o estado e anote o commit. **Não apague** — o card é o
que impede o problema de voltar sem ninguém reconhecer.

Convenções de nome e o que vai em cada gaveta:
[`docs/README.md`](docs/README.md).

---

## 7. Ambiente de teste

`faststore-boldb2b` (fora deste repo, em `wicomm/code/vtex-faststore/`) roda em
`http://localhost:3000` e tem preview em `https://boldb2b.vtex.app`. Conta B2B,
`vtex.my-wishlists` instalado, favorito da PDP exigindo sessão — é o cenário que
a extensão precisa resolver.

**Só leitura.** Nada deste repo altera aquele projeto: a extensão é externa por
decisão de arquitetura ([ADR-0001](docs/adr/0001-extensao-em-vez-de-bff.md)), e é
isso que a faz servir as 20+ lojas de `vtex-faststore/` sem instalar nada em
nenhuma.
