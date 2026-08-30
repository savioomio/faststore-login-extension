# ADR-0002 — Handshake stateless: `authenticationToken` no corpo, `credentials: 'omit'`

- **Estado:** proposta — aguarda aprovação do operador
- **Data:** 2026-08-30
- **Evidência:** [research 2026-08-30 §2](../research/2026-08-30-viabilidade-extensao-dev-login.md#2--descoberta-o-handshake-é-stateless)

## Contexto

A base de conhecimento do VTEX ID tem uma "regra de ouro nº 2": o código de
acesso é atrelado à sessão `_vss` que o enviou, e usar outro `_vss` faz um código
**válido** responder `WrongCredentials`. Isso "custou horas de investigação" e é
a classe de bug mais cara do fluxo.

O desenho óbvio de uma extensão seria deixar o navegador cuidar disso: fazer
`fetch` com `credentials: 'include'` para `*.myvtex.com`, e o cookie `_vss` viaja
sozinho. Dois problemas:

1. O jar do navegador é **compartilhado com a sessão real do desenvolvedor** no
   ambiente IO. O handshake da extensão sobrescreveria o `_vss` de lá, e o
   sucesso do login **apaga** o `_vss` (`Set-Cookie: _vss=; expires=1970…`).
2. `fetch` não deixa definir o header `Cookie` manualmente. Controlar qual `_vss`
   é enviado exigiria `declarativeNetRequest` — permissão larga e frágil.

Medido em 2026-08-30, existe uma terceira saída.

## Decisão

**Todo o handshake roda com `credentials: 'omit'`, passando o
`authenticationToken` como campo do formulário.** O token vive numa variável do
service worker pelos 10 minutos de validade, e nunca é persistido.

```js
// passo 1 — o token vem no CORPO da resposta
const { authenticationToken } = await (await fetch(
  `${base}/api/vtexid/pub/authentication/start?scope=${conta}&accountName=${conta}`,
  { credentials: 'omit', headers: { accept: 'application/json' } }
)).json()

// passos 2 e 4 — e vai no CORPO da requisição
await fetch(`${base}/api/vtexid/pub/authentication/accesskey/validate`, {
  method: 'POST',
  credentials: 'omit',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ authenticationToken, login, accesskey }),
})
```

A prova de que a sessão é aceita assim está na research: com o token no corpo a
resposta é `WrongCredentials` (credencial avaliada); **sem** o token é
`InvalidToken`.

## Consequências

**A regra de ouro nº 2 deixa de ser um risco nesta ferramenta.** Não existe
caminho pelo qual o navegador troque o `_vss` por outro — a extensão manda o
token exato que recebeu. O bug mais caro do fluxo fica impossível por construção,
não por disciplina.

**A sessão do desenvolvedor no ambiente IO é preservada.** Sem
`credentials: 'include'`, nada do jar é enviado nem sobrescrito. Logar um usuário
de teste pela extensão não derruba o login do admin em `<conta>.myvtex.com` — o
que é uma melhoria sobre o processo manual de hoje, onde as duas coisas brigam.

**O desenho fica pequeno.** Sem `webRequest`, sem `declarativeNetRequest`, sem
cookie jar de terceiro domínio. Some junto com isso a permissão larga que essas
APIs exigiriam ([R-8](../rules/seguranca.md#r-8--permissões-da-extensão-o-mínimo-que-funciona)).

**Risco assumido:** `authenticationToken` no corpo **não é documentado pela VTEX**
— como quase tudo neste fluxo. Se a plataforma remover o suporte, o sintoma é
`InvalidToken` em todo login, e o plano B é conhecido (usar
`declarativeNetRequest` para injetar o header `Cookie`). O teste da research §2
está escrito de forma a poder ser reexecutado em 30 segundos para confirmar.

## Escopo: a extensão não implementa `setpassword`

Só **login** (`classic/validate` e `accesskey/validate`). Definir/redefinir senha
fica de fora de propósito:

- é operação que **altera** a conta do usuário, não só lê — fora do que uma
  ferramenta de teste deve fazer;
- na família legacy ela tem um **furo de segurança conhecido** em B2B (contrato
  inativo devolve `Success` + cookies — base de conhecimento §7).

Se um dia entrar, tem de ser pela família authenticator, e vira outra ADR.
