# Arquivo

O que **não** faz parte deste projeto, mas não devia ser jogado fora.

Este repo tem um propósito só: a [extensão de dev-login](../extension/). O que
está aqui chegou antes dela, serviu de material de estudo, e ficou.

---

## `faststore-login-modal/`

Modal de login headless B2C para FastStore: resolver GraphQL, hook, UI e
documentação de instalação. **Funciona** — não está aqui por estar quebrado.

**Por que foi arquivado:** é um componente de **produção**, para ser copiado
dentro de uma loja. A extensão é uma ferramenta de **desenvolvimento**, externa
a qualquer loja. Dois públicos, dois ciclos de vida, duas formas de entrega —
não é o mesmo produto e não devia dividir repositório.

**Onde ele deveria morar:** junto dos outros componentes reaproveitáveis
(`wicomm/code/biblioteca-de-componentes`), não aqui.

**O que ele ainda serve, daqui:**

1. É o **irmão de produção** da extensão: mesmo handshake com o VTEX ID, outro
   destino para o cookie. A comparação entre os dois é o que justifica a
   arquitetura da extensão — ver
   [ADR-0001](../docs/adr/0001-extensao-em-vez-de-bff.md).
2. É a origem da [base de conhecimento do VTEX ID](../docs/reference/vtex-id.md),
   que **não** foi arquivada: aquilo é conhecimento de plataforma e continua
   valendo para a extensão.

**Se for movido daqui:** o `docs/` continua de pé sozinho. Só a ADR-0001 e a
[reference de sessão](../docs/reference/faststore-sessao.md) o citam, e as duas
sobrevivem à referência morta — mas vale corrigir os links na mudança.

---

> **Nada aqui é mantido.** Não espere que acompanhe versões do `@faststore/core`
> nem que reflita o que se aprendeu depois de 2026-08-30. Para o conhecimento
> vivo sobre autenticação VTEX, use [`docs/reference/`](../docs/reference/).
