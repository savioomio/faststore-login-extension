# Publicar a extensão na Chrome Web Store

Procedimento para tirar a extensão de "carregar sem compactação" e entregá-la ao
cliente em **um clique**. Escrito em 2026-08-31, com as regras vigentes nessa
data — a Chrome Web Store muda de exigência sem avisar, então confira o
dashboard contra o que está aqui e **corrija este arquivo no lugar**.

Decisão de fundo — por que Web Store e por que *unlisted* — está em
[T-011](../tasks/extensao.md#t-011--como-o-cliente-instala-isso).

---

## 0. O que já está pronto neste repo

| Item | Onde |
|---|---|
| **Todos os textos, campo a campo, para colar** | [`chrome-web-store-campos.txt`](chrome-web-store-campos.txt) |
| Política de privacidade (PT + EN) | [`PRIVACIDADE.md`](../../PRIVACIDADE.md) — **falta pôr num URL público**, §2 |
| Nome e descrição curta | [`extension/manifest.json`](../../extension/manifest.json) |
| Descrição longa da listagem | §4 deste runbook, pronta para colar |
| Justificativa de cada permissão | §5 deste runbook, pronta para colar |
| Notas para o revisor | §7 deste runbook, pronta para colar |

---

## 1. Conta de desenvolvedor

1. **2FA obrigatório** na conta Google **antes** de qualquer coisa. Sem isso o
   dashboard não deixa publicar nem atualizar.
2. `https://chrome.google.com/webstore/devconsole` → pagar a taxa **única de
   US$ 5** (por conta, não por extensão).
3. Verificar o e-mail de contato.
4. **Declaração de trader (DSA da UE):** publicar como empresa é publicar "no
   curso de uma atividade comercial" → declare **trader**, com razão social,
   endereço e telefone. Declarar não-trader sendo empresa é o tipo de erro que
   só aparece como remoção meses depois.

> Use uma conta Google da **empresa**, não a pessoal. A extensão fica amarrada à
> conta que publica, e mover para outra conta depois é um processo manual com a
> Google.

## 2. A política de privacidade precisa de um URL público

O dashboard exige um **URL acessível sem login**. Este repositório é **privado**,
então o link para `PRIVACIDADE.md` aqui **não serve**. Três saídas:

| Saída | Custo | Observação |
|---|---|---|
| ✅ **Página no domínio da Wicomm** | precisa de deploy | **escolhida em 2026-08-31** — dá credibilidade e é o que o revisor espera de uma empresa |
| **Gist público** no GitHub | 2 minutos | descartada: funciona, mas fica com cara de rascunho |
| Tornar este repositório **público** | 1 clique | descartada — ⚠️ exporia todo o `docs/`, inclusive research e reference sobre endpoints não documentados da VTEX |

Cole o texto de [`PRIVACIDADE.md`](../../PRIVACIDADE.md) na página, **confira numa
janela anônima** que ela abre sem login, e guarde o URL: ele vai em **dois
lugares** — nas configurações da conta de desenvolvedor e na aba *Privacy* do
item. Acompanhado em
[T-015](../tasks/extensao.md#t-015--a-política-de-privacidade-precisa-de-um-url-público).

## 3. Empacotar

O pacote é **só a pasta `extension/`**. Os testes ficam em `docs/testes/` de
propósito, para não irem junto.

```bash
cd extension && zip -r ../login-vtex-wicomm-1.0.0.zip . -x '.*' -x '__MACOSX/*' && cd ..
unzip -l login-vtex-wicomm-1.0.0.zip   # confira: nada de .git, .DS_Store, node_modules
```

Regras que fazem o upload ser rejeitado na hora:
- o `manifest.json` tem de estar na **raiz** do zip, não dentro de uma subpasta;
- **nada de código ofuscado** (minificar é permitido, ofuscar não). Aqui não há
  build: o código vai como está, o que é a favor;
- a `version` do manifesto tem de **subir** a cada envio. Não dá para reenviar a
  mesma.

## 4. A listagem

**Visibilidade: `Unlisted`.** Não cria listagem pública nem aparece na busca, mas
qualquer pessoa com o link instala. Passa pela **mesma revisão** de um item
público — não existe atalho por ser unlisted.

- **Nome:** `Login de teste em lojas VTEX — Wicomm`
- **Descrição curta:** vem do `manifest.json`
- **Categoria:** *Developer Tools*
- **Idioma:** Português (Brasil)

**Descrição detalhada** (colar):

```
Entre como cliente na sua loja VTEX FastStore rodando em ambiente de teste, com
e-mail e um código de 6 dígitos — sem abrir o DevTools e sem copiar cookie na
mão.

PARA QUEM É
Quem desenvolve a loja (localhost) e quem aprova a loja antes de ela ir ao ar
(endereços de preview .vtex.app). Testar carrinho, favoritos, minha conta e
preço B2B exige estar logado, e até agora isso significava colar um cookie no
DevTools.

COMO FUNCIONA
1. Abra a loja de teste numa aba e clique no ícone da extensão.
2. Digite seu e-mail e peça o código.
3. Cole o código de 6 dígitos que chegou no e-mail.
4. A loja recarrega já conectada.

Se a sua conta aceita senha, dá para entrar direto com ela, sem esperar e-mail.

ONDE FUNCIONA
Apenas em ambiente de teste: localhost, 127.0.0.1 e endereços de preview
.vtex.app. A extensão NÃO age em lojas de produção, por decisão de projeto — lá
o login normal da loja já funciona.

PRIVACIDADE
Não há servidor nosso. O que você digita vai direto do seu navegador para a API
de autenticação da própria VTEX; o resto fica no seu navegador. Nenhuma
telemetria, nenhum dado para terceiros, nenhum código remoto.

AVISO
Ferramenta independente, criada pela Wicomm. Não é um produto da VTEX e não tem
vínculo, patrocínio nem endosso da VTEX. "VTEX" e "FastStore" são marcas de seus
respectivos titulares, citadas apenas para identificar com quais sistemas a
ferramenta funciona.
```

**Imagens** — pelo menos uma captura, no máximo cinco. **1280x800 ou 640x400,
JPEG ou PNG de 24 bits sem alfa** (uma captura de janela com canto arredondado
transparente é recusada). Tire estas, nesta ordem, que é a que conta a história
para o revisor:

1. popup aberto sobre a loja em `localhost:3000`, na tela de e-mail;
2. tela do código de 6 dígitos;
3. tela "Tudo certo", com o rodapé mostrando a loja detectada;
4. a loja recarregada com "Minha conta" preenchida;
5. popup numa aba qualquer, mostrando "Esta aba não é uma loja em ambiente de
   teste" — é a que prova o escopo restrito.

> ⚠️ **Nenhuma captura pode mostrar e-mail real, código ou JWT**
> ([R-4](../rules/seguranca.md#r-4--nada-de-segredo-em-log-em-documento-ou-em-commit)).
> Use o usuário de teste descartável e borre o que sobrar. A tela "Tudo certo"
> mostra o e-mail logado e a hora de expiração — é a que mais escapa.
>
> ⚠️ **E nenhuma captura com o nome antigo.** O popup dizia "FastStore Login" até
> 2026-08-31 ([`popup.html:63`](../../extension/popup.html#L63)); hoje diz "Login
> de teste". Captura com o nome velho contradiz o nome da listagem — e o nome
> velho é justamente o que sugeria produto da VTEX.

Tenha também um **ícone 128x128** (já existe em `extension/icones/128.png`) e
prepare um **tile 440x280**; o dashboard dirá se ele é obrigatório para a sua
categoria. Um **vídeo curto no YouTube** é opcional, mas resolve o problema da
§7 melhor que qualquer texto — vale os dez minutos de gravação.

## 5. Justificativa das permissões, uso de dados e nota para o revisor

**Os textos exatos, campo a campo, estão em
[`chrome-web-store-campos.txt`](chrome-web-store-campos.txt)** — um arquivo só,
para colar sem reescrever. Aqui ficam as armadilhas do formulário, conferidas na
tela do dashboard em 2026-08-31:

**1. "Você está usando código remoto?" vem marcado como SIM.** Está errado:
todo o JS vem no pacote, não há `<script>` externo, import remoto nem `eval()`.
**Marque NÃO.** Declarar SIM é divulgação falsa e puxa revisão aprofundada.

**2. "Justificativa de Permissão do host" é UM campo só**, para os quatro hosts
juntos — não um por host. O texto do `.txt` já vem unificado, separando o papel
de **escrever** (localhost, 127.0.0.1, `*.vtex.app`) do de **ler**
(`*.myvtex.com`). O dashboard avisa, em amarelo, que permissão de host pode puxar
revisão detalhada e atrasar a publicação. É esperado: é a permissão que a
extensão não tem como não pedir.

**3. "Mais instruções" tem limite de 500 caracteres** — bem menos do que a
explicação natural do fluxo. O texto do `.txt` cabe.

**4. Uso de dados: marcar exatamente duas caixas** — *Informações de
identificação pessoal* (o e-mail) e *Informações de autenticação* (código, senha
e token). Mais as três declarações, todas verdadeiras aqui. **O que está marcado
tem de bater com a [política de privacidade](../../PRIVACIDADE.md)** —
divergência entre os dois é motivo de rejeição.

> Desde **1º de agosto de 2026** vale a regra de dado *estritamente necessário*
> ao propósito único declarado, com divulgação prévia. Substancialmente a
> extensão já está dentro; o que ela precisa é estar **declarado**.

**5. Credenciais de teste são campo obrigatório na prática.** O revisor não tem
seu `localhost:3000` e **não tem acesso ao e-mail** que recebe o código de 6
dígitos. Sem uma forma de ele entrar sozinho, o item volta como "não funciona" —
é a rejeição mais provável deste item. Preparação necessária **antes** de enviar:

- um preview `.vtex.app` **no ar e público**;
- um usuário de teste **com senha habilitada** naquela conta — o caminho de senha
  (`classic/validate`) não depende de caixa de entrada, e é a única forma de o
  revisor conseguir entrar sozinho;
- esse usuário não pode ter dado real nenhum. É descartável, e **não é o seu
  e-mail pessoal**.

## 6. Enviar e esperar

Envie e **não mexa mais**. Prazo típico: poucos dias; pode chegar a semanas, e há
fila estendida desde abril de 2026. Passando de **três semanas**, abra chamado no
suporte a desenvolvedores.

O que puxa a revisão para baixo: permissão ampla (aqui não há `<all_urls>`, o que
ajuda), código ofuscado (não há), desenvolvedor novo e item novo (é o nosso caso
— conte com o prazo cheio na primeira vez).

**Se rejeitar:** a mensagem cita a política violada. Corrija exatamente aquilo,
suba a `version` e reenvie — reenviar sem mudar nada só queima tempo de fila. As
duas rejeições prováveis aqui são "o revisor não conseguiu usar" (§5) e
"justificativa de permissão insuficiente" (§5).

## 7. Depois de aprovada

1. O item ganha uma URL `https://chromewebstore.google.com/detail/<id>`. **É esse
   link que vai para o cliente** — instalar é um clique.
2. Registre o link no [`extension/README.md`](../../extension/README.md) e no
   [roadmap](../roadmap.md).
3. **Atualizar** = subir `version` no manifesto, gerar zip novo, enviar. Os
   clientes recebem sozinhos, sem fazer nada. Toda atualização passa por revisão
   de novo, então corrigir bug urgente **não é instantâneo** — conte com dias.
4. Considere o **Edge Add-ons** depois: aceita o mesmo pacote MV3, é grátis e
   certifica em até 7 dias úteis. Só vale se algum cliente usar Edge.

---

## Limites deste runbook

- Escrito a partir da documentação da Google em **2026-08-31**, não de uma
  publicação já feita por nós. Nenhum item deste repo passou por revisão ainda —
  os prazos e as causas de rejeição da §8 vêm da documentação e da experiência
  geral, não de medição nossa. **Quando a primeira submissão acontecer, corrija
  este arquivo com o que realmente aconteceu.**
- Os nomes exatos das caixas do formulário de dados (§6) mudam de tempos em
  tempos. As duas categorias que se aplicam são as descritas; se o rótulo na
  tela estiver diferente, escolha pelo sentido e corrija aqui.
