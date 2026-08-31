# ADR-0005 — Distribuição pela Chrome Web Store, como item *unlisted*

- **Estado:** aceita
- **Data:** 2026-08-31
- **Decidido por:** operador
- **Fecha:** [T-011](../tasks/extensao.md#t-011--como-o-cliente-instala-isso), o problema que a [ADR-0004](0004-preview-entra-producao-nao.md) deixou aberto
- **Como se faz:** [runbook de publicação](../runbooks/publicar-na-chrome-web-store.md)

## Contexto

A [ADR-0004](0004-preview-entra-producao-nao.md) colocou o **cliente** dentro do
escopo da ferramenta — quem aprova a loja no preview `.vtex.app` e "nunca usou o
DevTools". E terminou admitindo o buraco:

> *"Distribuir para cliente é o problema não resolvido."*

"Carregar sem compactação" pede modo desenvolvedor, uma pasta descompactada que
não pode sumir da máquina, e um aviso do Chrome a cada abertura. Para o público
da ADR-0004 isso não é instalação, é obstáculo. Enquanto durar, a extensão serve
ao time e não ao cliente — que é justamente quem a ADR-0004 quis servir.

A questão desta ADR é só uma: **como o arquivo chega à máquina do cliente e se
mantém atualizado lá.**

## Os caminhos, medidos contra a documentação da Google (2026-08-31)

| Caminho | Instalação | Atualização | Onde morre |
|---|---|---|---|
| **Chrome Web Store** | um clique no link | automática | revisão da Google: dias a semanas, e de novo a cada correção |
| `.crx` auto-hospedado | — | — | **bloqueado no Windows desde o Chrome 33 e no macOS desde o 44**, fora de política de empresa |
| Política de empresa (`ExtensionInstallForcelist`) | zero, chega sozinha | automática | exige Chrome **gerenciado** (Workspace, Intune, Jamf) — os clientes não têm |
| Carregar sem compactação | modo desenvolvedor | manual, avisando cada cliente | é o que já temos, e é o problema |

O `.crx` num link parece a saída óbvia — "é só mandar o arquivo" — e é a que não
existe mais há uma década nos dois sistemas que os clientes usam.

## Decisão

**Publicar na Chrome Web Store, com visibilidade `unlisted`.**

`unlisted` não cria listagem pública nem aparece na busca: quem tem o link
instala, quem não tem não encontra. É o recorte certo para uma ferramenta de
agência — o link vai para o cliente, e não há por que uma extensão que loga em
loja VTEX de teste circular na vitrine.

**`private` (trusted testers) foi considerado e descartado:** exigiria cadastrar
a conta Google de cada pessoa de cada cliente, uma a uma, e passa pela **mesma**
revisão. Todo o atrito, nenhum ganho.

Três coisas mudaram no pacote por causa desta decisão:

1. **Nome.** `FastStore Login` virou **`Login de teste em lojas VTEX — Wicomm`**.
   A política de impersonation da Google proíbe dar a entender que o item é
   autorizado ou produzido por outra empresa; "FastStore Login" sozinho sugere
   produto da VTEX. Citar a marca para dizer **com o que a ferramenta funciona**
   é uso legítimo — desde que a autoria esteja no nome e a não-afiliação, na
   descrição e na política.
2. **`tabs` saiu do manifesto** ([T-014](../tasks/extensao.md#t-014--a-permissão-tabs-saiu-do-manifesto)).
   Permissão a mais é escrutínio a mais na revisão e um item a mais na tela de
   instalação, e essa não fazia falta.
3. **Política de privacidade escrita** ([`PRIVACIDADE.md`](../../PRIVACIDADE.md)),
   em português e inglês. É obrigatória: a extensão trata e-mail e credencial.

## Consequências

**Boas**

- O cliente instala em um clique, e **atualiza sozinho**. Isso é mais importante
  do que parece: este repo depende de endpoints que a VTEX **não documenta** e
  pode mudar sem aviso. Uma correção urgente alcança todo mundo sem telefonema.
- O pacote passa a ser assinado pela Google. Some o aviso de modo desenvolvedor,
  e some a pasta que não pode ser movida.
- A revisão da Google é uma auditoria externa de graça sobre uma ferramenta que
  manipula credencial de gente de verdade.

**Ruins, e assumidas**

- **Correção urgente deixa de ser instantânea.** Toda atualização passa por
  revisão de novo. Um bug crítico leva dias para alcançar o cliente — e é o
  preço direto do ganho de cima.
- **A extensão passa a depender de uma política que não é nossa.** A Google pode
  mudar de regra, atrasar, ou remover o item. A mitigação é o repo continuar
  instalável sem compactação: se a loja fechar a porta, o time não para.
- **Precisa de um usuário de teste com senha, numa conta pública.** O revisor não
  tem nosso `localhost` nem a caixa de entrada que recebe o código; sem uma forma
  de ele entrar sozinho, a rejeição provável é "não funciona". Isso obriga a
  manter um preview `.vtex.app` no ar e um usuário descartável — pequena
  superfície nova, e ela existe.
- **A conta que publica é dona do item.** Publicar pela conta pessoal e depois
  querer transferir é processo manual com a Google. Usar conta da empresa.
- **Fica só no Chromium.** Edge aceita o mesmo pacote e é decisão barata quando
  algum cliente pedir; Firefox exigiria porte de `chrome.cookies`, e continua
  fora ([roadmap](../roadmap.md)).

## O que esta decisão **não** decide

- **Onde a política de privacidade vai ser hospedada** — este repositório é
  privado, e o dashboard exige URL público. Fica em
  [T-015](../tasks/extensao.md#t-015--a-política-de-privacidade-precisa-de-um-url-público),
  com as opções e o custo de cada uma. **Tornar o repo público é uma delas, e é
  decisão do operador:** levaria junto a research e a reference sobre endpoints
  não documentados da VTEX.
- **Cobrar pela extensão.** Nunca esteve em questão: é ferramenta de trabalho da
  agência, entregue a cliente da agência.
