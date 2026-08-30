# ADR-0003 — A extensão não guarda credencial nenhuma

- **Estado:** aceita
- **Data:** 2026-08-30
- **Decidido por:** operador, respondendo à consulta de escopo de 2026-08-30

## Contexto

O desenho proposto inicialmente incluía um "cofre de sessões": logar uma vez em
cada conta de teste, guardar os JWTs (válidos por 24h) e alternar entre as contas
já logadas com um clique, sem novo código de e-mail. Havia também a opção de
guardar senhas cifradas para login instantâneo.

Consultado, o operador reformulou o problema:

> *"Eu pensava que ela só fazia login e manipulava os cookies, o token."*
>
> *"A troca de usuário seria apenas eu fazer logout, limpar os cookies de login e
> entrar com um novo e-mail, por exemplo."*

## Decisão

**A extensão transporta sessão. Ela não guarda sessão.**

Trocar de usuário é a sequência que o operador descreveu: **logout** (apagar o
cookie) e **login** com outro e-mail. Não existe lista de contas logadas, não
existe cache de JWT, não existe senha salva.

O que persiste em disco (`chrome.storage.local`) é só conveniência sem valor de
segurança: a última conta e porta usadas, e os e-mails já digitados, para
autocompletar. Nada disso autentica ninguém.

| Dado | Onde vive | Quanto dura |
|---|---|---|
| `authenticationToken` (`_vss`) | memória do service worker | o fluxo de login (10 min) |
| JWT de sessão | **só** no cookie do `localhost` | 24h, ou até o logout |
| Senha | lugar nenhum — campo digitado, usado, descartado | — |
| Conta, porta, e-mails digitados | `chrome.storage.local` | até você limpar |

## Consequências

**Boas**

- **A extensão deixa de ser um alvo.** Sem cofre, comprometer a extensão não
  entrega sessão de ninguém: o que existe é o mesmo cookie que já está no
  navegador, no `localhost`, e que qualquer DevTools mostra.
- **[R-3](../rules/seguranca.md#r-3--segredo-não-vai-para-o-disco-em-texto-claro-e-senha-preferencialmente-não-vai)
  fica trivial de cumprir.** Não há segredo em disco, então não há cifra a
  implementar, senha-mestra a gerenciar, nem chave a rotacionar. A regra deixa de
  depender de disciplina e passa a valer por construção.
- **O MVP encolhe.** T-004 e T-006 saem do caminho; o produto inteiro vira
  "login, logout, detectar onde". As fases 1 e 2 do roadmap colapsam numa só.

**Ruins, e aceitas**

- **Cada troca de usuário custa um código de e-mail** (ou a senha digitada de
  novo). É o preço de não guardar segredo, e foi escolhido de olhos abertos.
  Mitigação parcial: em conta que aceite senha, o login é imediato — sem ida à
  caixa de entrada.

## O que isto fecha

Se daqui a seis meses parecer boa ideia "só guardar o token para não precisar
logar de novo": **é esta decisão sendo desfeita.** Reabra como ADR nova, com o
motivo. O ganho é conveniência; o custo é a extensão virar um cofre de sessões de
clientes no disco de quem desenvolve.
