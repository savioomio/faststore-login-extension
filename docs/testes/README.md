# Testes

Ficam **fora** de `extension/` de propósito: assim não vão junto no pacote que
se carrega no navegador nem no que um dia subir para a Chrome Web Store. Eles
testam o código de lá, importando de `../../extension/`.

```bash
node docs/testes/alvo.mjs        # onde a extensão pode agir + descoberta da loja
node docs/testes/sessao.mjs      # limpeza da sessão guardada no navegador
node docs/testes/mensagens.mjs   # o background, como a janelinha o chama
node docs/testes/vtexid.mjs      # login contra a conta REAL (precisa de rede)
```

Node puro, sem instalar nada, sem framework. **Rode os quatro depois de mexer em
qualquer coisa.**

---

## O que cada um cobre, e por quê

### `alvo.mjs` — a regra mais sensível do projeto

`alvo.js` decide **onde uma sessão pode ser escrita**. Um erro aqui não trava
nada: só permite escrever sessão onde não devia.

Cobre 5 hosts aceitos e 8 recusados. Os que importam são os traiçoeiros:
`localhost.evil.com` (começa certo, termina errado) e `evil-vtex.app.com`
(contém `vtex.app` no meio) — os dois passariam num teste ingênuo de sufixo.

### `sessao.mjs` — não estrague o CEP de quem usa

Extrai a função `limparNaPagina` **do arquivo real** (em vez de duplicá-la) e a
roda contra um duplo do IndexedDB.

O teste que mais importa é o de **preservação**: a limpeza tem de zerar
`person`/`b2b`/`refreshAfter` e **manter** `postalCode`, `locale` e `channel`.
Apagar a chave inteira também deslogaria — e faria o usuário perder a região que
acabou de configurar, a cada troca de conta.

### `mensagens.mjs` — o contrato entre a janelinha e o fundo

Roda o `background.js` de verdade com o `chrome` mockado, chamando como o popup
chama.

**Foi escrito depois de um bug acontecer:** o popup perguntava por um campo que o
background não devolvia mais, e a tela mostrava `undefined`. Este teste pega essa
classe inteira — inclusive a exigência de que toda recusa venha com um motivo em
frase completa e sem jargão.

### `vtexid.mjs` — o handshake, contra a conta real

Precisa de rede. Exercita **só caminhos de falha**, com credencial errada de
propósito: um login bem-sucedido consumiria código de acesso de usuário real.

⚠️ **Espace as execuções.** O `start` tem rate limit de 200 e, após poucas
tentativas seguidas, a VTEX passa a responder `200` fantasma no envio **sem
mandar e-mail** e bloqueia o usuário por 15–30 min.

Este teste **se auto-diagnostica**: se a VTEX responder `HTTP_401`, ele avisa que
a conta está bloqueada e que aquilo é **condição de ambiente, não defeito do
código** — em vez de acusar uma falha que não existe. Rodá-lo em excesso é
justamente o que provoca o bloqueio.

> Foi assim que se descobriu, em 2026-08-30, que o bloqueio vem como `401` com
> corpo em **texto puro** (não JSON) e caía na mensagem genérica "tente de novo"
> — o pior conselho possível, já que tentar renova o bloqueio.

---

## O que nenhum deles cobre

**Um login que dá certo.** Exigiria consumir um código de acesso real de uma
caixa de e-mail real. Isso se testa à mão, no navegador — e é o que ainda falta
para fechar [T-002 e T-003](../tasks/extensao.md).

**A interface.** Não há teste de DOM. O que existe é conferência estática
(todo `id` usado no JS existe no HTML, todo ícone referenciado está definido).
