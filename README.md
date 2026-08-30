# VTEX Dev Login

Extensão de navegador que loga um usuário VTEX numa loja FastStore rodando em
**`localhost`** ou em **preview `.vtex.app`** — sem copiar cookie do DevTools na
mão.

```
extension/   a extensão            é isto que se carrega no navegador
docs/        o que se sabe         decisões, regras, investigações, tarefas
arquivo/     o que não é daqui     material de estudo, não mantido
```

---

## O problema

Testar qualquer coisa que exija sessão — favoritos, minha conta, preço por
organização, carrinho B2B — custa hoje: logar no ambiente IO, abrir o DevTools,
copiar o `VtexIdclientAutCookie_<conta>`, colar no localhost. **A cada troca de
usuário.** O cookie não cola sozinho porque volta com
`Domain=<conta>.myvtex.com`.

No **preview** é pior: é o que se manda para o cliente aprovar, e ele nunca
abriu um DevTools na vida.

A extensão faz o handshake do VTEX ID (e-mail + código de 6 dígitos, ou senha) e
escreve o cookie direto no alvo. Logout é um clique; trocar de usuário, outro.

**Não é gambiarra:** o `@faststore/core` documenta no próprio código que
`localhost` existe para receber cookie injetado na mão, e protege esse cookie do
fluxo de refresh-token. A extensão automatiza o que o framework já espera que se
faça na unha.

## Onde ela age

| Onde | Para quem |
|---|---|
| `localhost`, `127.0.0.1` | desenvolvedor |
| `*.vtex.app` | **cliente**, na homologação |
| produção (`.com.br`) | ninguém — lá o domínio é unificado e o login nativo funciona |

Se alguém sentir falta dela **em produção**, o defeito é de configuração da conta
VTEX (*auth cookie root domain*), não da ferramenta.

---

## Começar

**Usar** → [`extension/README.md`](extension/README.md): como carregar no
navegador, como logar, e o que fazer quando der errado.

**Mexer no código** → [`CLAUDE.md`](CLAUDE.md) primeiro. Depois
[`docs/`](docs/README.md).

**Entender a autenticação da VTEX** →
[`docs/reference/vtex-id.md`](docs/reference/vtex-id.md). Autocontido e portátil:
serve para construir qualquer login VTEX, aqui ou em outro projeto. Quase tudo
nele é sobre endpoints que a VTEX **não documenta** — cada afirmação traz o teste
que a prova.

**Estado das coisas** → [`docs/roadmap.md`](docs/roadmap.md).

---

## Duas regras que valem no repo inteiro

1. **Nada de `appKey`/`appToken`.** Tudo usa rotas `/pub/`, que autenticam o
   **usuário**, não a aplicação. Se parecer que "só falta o appToken", a resposta
   certa é outro endpoint.
   ([R-1](docs/rules/seguranca.md#r-1--nada-de-appkey--apptoken-na-extensão-nunca))
2. **Nada de segredo em documento, log ou commit** — nem JWT, nem código de
   acesso, nem senha, mesmo expirados, mesmo de conta de teste. Um JWT da VTEX
   carrega `userId`, `customerId`, `unitId` e a conta.
   ([R-4](docs/rules/seguranca.md#r-4--nada-de-segredo-em-log-em-documento-ou-em-commit))
