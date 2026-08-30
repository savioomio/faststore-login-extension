# Documentação — VTEX Login

Seis gavetas. Escolher a gaveta errada é o jeito mais rápido de a informação
sumir: um achado de investigação enterrado num runbook não é encontrado por quem
procura "como faço", e uma decisão de arquitetura escrita numa task morre junto
com a task.

| Gaveta | Responde | Vira obsoleto? |
|---|---|---|
| [`reference/`](reference/) | **O que a plataforma faz** | Sim — e aí se corrige no lugar, datando o teste |
| [`adr/`](adr/) | **Por que** é assim, aqui | Não — vira "substituído por" |
| [`rules/`](rules/) | **O que não se faz**, nunca | Não — é a linha que não se cruza |
| [`runbooks/`](runbooks/) | **Como** se faz | Sim, e aí se corrige no lugar |
| [`research/`](research/) | **O que descobrimos** naquele dia | Sim, e aí se escreve outro |
| [`tasks/`](tasks/) | **O que falta** fazer | Sim, e aí se fecha |

Mais o [`roadmap.md`](roadmap.md), que é a visão de cima.

> A convenção é a mesma da loja Bold (`faststore-boldb2b/docs/`). É de propósito:
> quem trabalha nos dois repos não deve precisar aprender duas organizações.
> As duas gavetas a mais existem por causa do que **este** repo é:
> `rules/` porque a ferramenta manipula credencial de gente de verdade, e
> `reference/` porque aqui se documenta **a plataforma**, não só o nosso código.

### `reference/` e `research/` não são a mesma coisa

Confundir as duas é o erro fácil, e some com conhecimento caro:

- **`research/`** é uma **foto datada** de uma investigação: a pergunta, o que se
  mediu, o que ficou por medir. Não se reescreve — envelhece e vira histórico.
- **`reference/`** é o **conhecimento destilado** que sobreviveu à investigação,
  organizado por assunto para ser consultado. Corrige-se no lugar quando a
  plataforma muda ou quando se descobre que estava errado.

O caminho normal é: mede-se na `research/`, e o que for **conhecimento de
plataforma** (não decisão nossa) é promovido para `reference/`. Foi o que
aconteceu com o `authenticationToken` no corpo — medido na research de
2026-08-30, promovido para [`reference/vtex-id.md`](reference/vtex-id.md) §2.5.

---

## Como nomear

```
reference/assunto.md                   assunto, porque se consulta por assunto
adr/0001-titulo-da-decisao.md          número, porque se cita por número
rules/assunto.md                       assunto, e são poucos arquivos
runbooks/assunto.md                    assunto, porque se procura por assunto
research/AAAA-MM-DD-assunto.md         data, porque envelhece
tasks/<área>.md, seções ## T-001…      área por arquivo, número por seção
```

- **Reference** — nomeada pelo assunto da plataforma (`vtex-id.md`), sem data no
  nome: ela é viva, e a data mora **dentro**, junto de cada teste. Numerar as
  seções (§2.5) importa, porque é assim que se cita de fora.
- **ADR** — numerado e sequencial. Uma decisão é referenciada por outra
  ("substitui a ADR-0003"), e número é a única referência que não muda quando o
  título é reescrito.
- **Rule** — nomeada pelo assunto. Regra não tem versão nem histórico: se mudou,
  é porque virou outra regra, e aí vira ADR explicando a mudança.
- **Runbook** — nomeado pelo assunto, sem número. **Corrige-se no lugar** quando
  o procedimento muda.
- **Research** — prefixado com a data. É uma foto de um dia; a API da VTEX muda
  sem avisar (várias rotas aqui são **não documentadas**). A data é o aviso.
- **Task** — um arquivo por área, cada task uma seção `## T-XXX`. Numeração
  global e sequencial, para caber na mensagem de commit (`feat(popup): … (T-003)`).

---

## Regras que valem para as seis gavetas

1. **Sempre com evidência.** Toda afirmação sobre código aponta `arquivo:linha`.
   Toda afirmação sobre a API da VTEX traz **o `curl` e a resposta** que a prova.
   "Parece que" não entra em documento. Este projeto depende de endpoints que a
   VTEX **não documenta** — a evidência é a única especificação que existe.
2. **Separe o observado do deduzido.** Toda research termina com "Limites desta
   investigação". Um documento afirmando uma conferência que não aconteceu é pior
   que nenhum documento.
3. **Nunca cole segredo em documento.** Nem JWT real, nem senha, nem `appToken`,
   nem código de acesso — mesmo expirado, mesmo de conta de teste. Use
   `<jwt>`, `<código>`, `usuario@exemplo.com`. Ver [`rules/seguranca.md`](rules/seguranca.md).
4. **Português.** Termos da plataforma (`authenticationToken`, `authStatus`,
   `Set-Cookie`) ficam como a VTEX os escreve.
5. **Link cruzado.** Task aponta a research que a originou; research aponta as
   ADRs que a explicam; ADR aponta o código que a implementa.

---

## Índice

### Reference
- [VTEX ID — autenticação headless](reference/vtex-id.md) · o documento mais
  reaproveitável do repo: portátil, autocontido, e a fonte de verdade sobre a
  plataforma para os dois pacotes.
- [FastStore — onde a sessão do cliente realmente mora](reference/faststore-sessao.md) ·
  **a sessão não é o cookie**: apagar o cookie não desloga a interface.

### Rules
- [Segurança — as linhas que não se cruzam](rules/seguranca.md)

### ADRs
- [ADR-0001 — Extensão de navegador em vez de BFF ou patch no projeto](adr/0001-extensao-em-vez-de-bff.md)
- [ADR-0002 — Handshake stateless: `authenticationToken` no corpo](adr/0002-handshake-stateless-token-no-corpo.md)
- [ADR-0003 — A extensão não guarda credencial nenhuma](adr/0003-sem-cofre-de-credenciais.md)
- [ADR-0004 — O preview `.vtex.app` entra no escopo; produção não](adr/0004-preview-entra-producao-nao.md)

### Research
- [2026-08-30 — Viabilidade da extensão de dev-login](research/2026-08-30-viabilidade-extensao-dev-login.md)

### Runbooks
- [Sondar um endpoint não documentado do VTEX ID](runbooks/sondar-endpoint-vtex-id.md)

### Tasks
- [Extensão](tasks/extensao.md)

---

## O que **não** mora aqui

`docs/` guarda conhecimento. O que se **entrega** é a
[extensão](../extension/), e a documentação de *como instalar e usar* fica com
ela — [`extension/README.md`](../extension/README.md). O *porquê* das decisões e
o conhecimento de plataforma ficam aqui.

⚠️ **O código da extensão não tem comentários.** O que os substitui é
[`runbooks/mexer-no-codigo.md`](runbooks/mexer-no-codigo.md): um mapa arquivo a
arquivo com as armadilhas de cada um. Mexeu no código e aprendeu algo? Vai para
lá, não para o fonte.
