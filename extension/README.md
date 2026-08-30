# faststore-login-extension

Entre na loja em ambiente de teste com seu **e-mail e um código** — sem copiar
nada do DevTools.

| Onde funciona | Para quem |
| :--- | :--- |
| `localhost`, `127.0.0.1` | quem desenvolve |
| `*.vtex.app` | **quem aprova** a loja antes de ir ao ar |
| produção (`.com.br`) | ninguém precisa — lá o login da loja já funciona |

---

## Instalar

1. Abra `chrome://extensions` (ou `comet://extensions`)
2. Ligue **Modo do desenvolvedor**, no canto superior direito
3. **Carregar sem compactação** → escolha esta pasta

> ⚠️ **Editou algum arquivo? Clique em recarregar (↻)** na página de extensões.
> O Chrome atualiza a janelinha na hora mas pode manter o processo de fundo
> antigo — e aí a extensão avisa "recarregue" em vez de funcionar.

## Usar

Abra a loja numa aba e clique no ícone da fechadura.

1. Digite seu **e-mail** → *Enviar código*
2. Pegue o **código de 6 dígitos** no e-mail e cole. Ele entra sozinho.
3. Pronto. A loja recarrega já conectada.

**Trocar de conta:** *Sair desta conta*, depois entrar com outro e-mail.

Se a loja aceitar senha, aparece a opção *Prefiro entrar com minha senha* — aí
não precisa esperar e-mail.

> Pode fechar a janelinha para ir buscar o código. Ao voltar, ela retoma no
> mesmo ponto.

---

## Quando não funcionar

| O que aparece | O que fazer |
| :--- | :--- |
| **Abra a loja primeiro** | A aba atual não é a loja. Abra `localhost:3000` ou o endereço `.vtex.app` e clique no ícone de novo. |
| **Não deu certo** (no código) | Cada código vale **uma vez só**. Peça um novo em *Reenviar*. |
| **O código expirou** | O código dura 10 minutos. Peça outro. |
| **Muitas tentativas seguidas** | A VTEX bloqueia por 15–30 min. Nesse período ela diz que enviou o e-mail, mas não envia. Espere. |
| **A loja encerrou a sessão** | Só no endereço de teste, quando a loja está com `experimental.refreshToken: true`. Desligue a opção ou teste em `localhost`. |
| **Diz que entrou, mas a loja não deixa fazer nada** | O acesso e a tela discordaram. Saia e entre de novo. Detalhe técnico em [`docs/reference/faststore-sessao.md`](../docs/reference/faststore-sessao.md). |
| Nome da loja errado no rodapé | Clique no lápis e corrija. A correção fica salva para aquele endereço. |

---

## Para quem for mexer no código

**Os arquivos não têm comentários, de propósito.** O que explicaria cada trecho
está em [`docs/runbooks/mexer-no-codigo.md`](../docs/runbooks/mexer-no-codigo.md)
— com as armadilhas de cada arquivo, todas medidas. Leia a seção antes de editar.

| | |
|---|---|
| `manifest.json` | Permissões: quatro hosts, quatro permissões, nada de `<all_urls>`. |
| `alvo.js` | **Onde a extensão pode escrever sessão** e como descobre a loja. |
| `vtexid.js` | O handshake com o VTEX ID. |
| `background.js` | Orquestra, guarda o token, escreve o cookie. |
| `sessao-da-pagina.js` | Zera a sessão que a loja guarda no navegador. |
| `popup.*` | A janelinha. Não faz rede nem toca em cookie. |
| `icones/` | Gerados por script, sem dependência de imagem externa. |

Tudo nesta pasta — e só isto — é o que o navegador carrega.

### Permissões: ler e escrever são coisas diferentes

O `*.myvtex.com` no manifesto engana — ele **não** é para escrever sessão lá:

| Domínio | **Lê** (chama a API de login) | **Escreve** (grava sessão) |
| :--- | :---: | :---: |
| `*.myvtex.com` | ✅ é o **único** lugar onde a API existe | ❌ nunca |
| `localhost`, `127.0.0.1` | — | ✅ |
| `*.vtex.app` | — | ✅ |

Medido: `/api/vtexid/pub/authentication/start` responde **404** em `localhost` e
em `.vtex.app`, e **200** em `.myvtex.com`. A leitura roda com
`credentials: 'omit'` — não toca em nenhuma sessão existente.

Quem manda em onde se **escreve** é o `alvo.js`, não o manifesto.

### Testes

Ficam em [`docs/testes/`](../docs/testes/), fora desta pasta, para não irem junto
no pacote do navegador. Rode os quatro depois de mexer em qualquer coisa:

```bash
node docs/testes/alvo.mjs
node docs/testes/sessao.mjs
node docs/testes/mensagens.mjs
node docs/testes/vtexid.mjs
```
