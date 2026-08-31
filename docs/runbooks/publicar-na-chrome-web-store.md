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
| **Página no site da Wicomm** (ex.: `wicomm.com.br/extensao-login/privacidade`) | precisa de deploy | **recomendada** — dá credibilidade e é o que o revisor espera de uma empresa |
| **Gist público** no GitHub | 2 minutos | funciona, mas fica com cara de rascunho |
| Tornar este repositório **público** | 1 clique | ⚠️ expõe todo o `docs/` — inclusive research e reference sobre endpoints não documentados da VTEX. **Decisão do operador, não faça por conta.** |

Escolhida a saída, cole o texto de [`PRIVACIDADE.md`](../../PRIVACIDADE.md) lá e
guarde o URL: ele vai em **dois lugares** — nas configurações da conta de
desenvolvedor e na aba *Privacy* do item.

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

**Imagens** — pelo menos uma captura de 1280x800 (até 5). Tire estas, nesta
ordem, que é a que conta a história para o revisor:

1. popup aberto sobre a loja em `localhost:3000`, na tela de e-mail;
2. tela do código de 6 dígitos;
3. tela "Tudo certo", com o rodapé mostrando a loja detectada;
4. a loja recarregada com "Minha conta" preenchida;
5. popup numa aba qualquer, mostrando "Esta aba não é uma loja em ambiente de
   teste" — é a que prova o escopo restrito.

> ⚠️ **Nenhuma captura pode mostrar e-mail real, código ou JWT**
> ([R-4](../rules/seguranca.md#r-4--nada-de-segredo-em-log-em-documento-ou-em-commit)).
> Use `usuario@exemplo.com` e borre o que sobrar.

Tenha também um **ícone 128x128** (já existe em `extension/icones/128.png`) e
prepare um **tile 440x280**; o dashboard dirá se ele é obrigatório para a sua
categoria. Um **vídeo curto no YouTube** é opcional, mas resolve o problema da
§7 melhor que qualquer texto — vale os dez minutos de gravação.

## 5. Justificativa das permissões

Um campo por permissão. Colar assim:

| Campo | Texto |
|---|---|
| **`cookies`** | A extensão grava e apaga o cookie de sessão do VTEX ID (`VtexIdclientAutCookie_<conta>`) na loja de teste aberta na aba. É a função inteira da extensão: sem ela não há como entregar a sessão à loja, nem como deslogar. Só é usada em localhost, 127.0.0.1 e *.vtex.app. |
| **`storage`** | O service worker do Manifest V3 é encerrado por ociosidade no meio do login (entre pedir o código e digitá-lo). O `authenticationToken` intermediário do VTEX ID fica em `chrome.storage.session`, que morre com a sessão do navegador, e o nome da loja em `chrome.storage.local`. Sem isso o login se perde quando o usuário sai para buscar o código no e-mail. |
| **`scripting`** | A loja FastStore guarda a sessão do cliente no IndexedDB da página (`keyval-store` → `fs::session`), não só no cookie. Apagar o cookie não desloga a interface. A extensão injeta um script na aba da loja de teste apenas para zerar a identidade dessa sessão no logout, preservando CEP e idioma. É a única forma de alcançar o IndexedDB da página. |
| **`http://localhost/*`, `http://127.0.0.1/*`** | Onde a loja em desenvolvimento roda. É onde a extensão grava o cookie de sessão e recarrega a aba. |
| **`https://*.vtex.app/*`** | Endereço de preview de uma loja FastStore, usado por quem aprova a loja antes de ela ir ao ar. Mesmo uso do localhost. |
| **`https://*.myvtex.com/*`** | **Somente leitura.** A API de autenticação do VTEX ID só existe neste domínio (medido: 404 em localhost e no preview, 200 em *.myvtex.com), então é para lá que as chamadas de login são feitas. A extensão nunca grava cookie nem sessão neste domínio, e as chamadas usam `credentials: 'omit'`, sem enviar nem tocar em nenhuma sessão existente do usuário. |

**Propósito único** (campo *Single purpose*):

```
Autenticar um usuário VTEX numa loja FastStore rodando em ambiente de
desenvolvimento ou de preview, gravando o cookie de sessão do VTEX ID na aba,
para que o desenvolvedor ou o cliente possa testar funcionalidades que exigem
login sem manipular cookies no DevTools.
```

## 6. Formulário de uso de dados

Marcar **duas** categorias, e só:

- **Informação de identificação pessoal** — o e-mail que o usuário digita para
  iniciar o login;
- **Informação de autenticação** — o código de acesso ou a senha, mais o token
  de sessão do VTEX ID.

Não marcar: saúde, financeiro, comunicações pessoais, localização, histórico de
navegação, atividade do usuário, conteúdo de site.

As três certificações podem ser marcadas com verdade — não vendemos nem
transferimos dado a terceiros, não usamos para nada fora do propósito único, e
não usamos para análise de crédito ou empréstimo.

O URL da política de privacidade (§2) vai aqui também. **O que está marcado aqui
tem de bater com o texto da política** — divergência entre os dois é motivo de
rejeição.

> Desde **1º de agosto de 2026** vale a regra de dado *estritamente necessário*
> ao propósito único declarado, com divulgação prévia. Substancialmente a
> extensão já está dentro; o que ela precisa é estar **declarado**.

## 7. A nota para o revisor — o ponto que mais rejeita

O revisor **não tem** seu `localhost:3000` e **não tem acesso ao e-mail** que
recebe o código. Se ele não conseguir usar, o item volta como "não funciona".
Preencha o campo de notas com algo assim, trocando o que está entre `<>`:

```
Esta extensão funciona apenas em ambiente de teste de lojas VTEX FastStore
(localhost e endereços de preview .vtex.app). Para testar:

1. Abra <https://SUA-LOJA.vtex.app> (loja de demonstração, pública).
2. Clique no ícone da extensão.
3. Escolha "Prefiro entrar com minha senha".
4. Use as credenciais de teste: <usuario-de-teste@dominio> / <senha>
5. A página recarrega logada; o menu passa a mostrar a conta.

Em qualquer outra aba a extensão responde "Esta aba não é uma loja em ambiente
de teste" e não faz nada — é o comportamento esperado.

Vídeo demonstrando o fluxo completo: <link>
```

Preparação necessária **antes** de enviar:
- um preview `.vtex.app` **no ar e público**;
- um usuário de teste **com senha habilitada** naquela conta — o caminho de
  senha (`classic/validate`) não depende de caixa de entrada, e é a única forma
  de o revisor conseguir entrar sozinho;
- esse usuário não pode ter dado real nenhum. É descartável.

## 8. Enviar e esperar

Envie e **não mexa mais**. Prazo típico: poucos dias; pode chegar a semanas, e há
fila estendida desde abril de 2026. Passando de **três semanas**, abra chamado no
suporte a desenvolvedores.

O que puxa a revisão para baixo: permissão ampla (aqui não há `<all_urls>`, o que
ajuda), código ofuscado (não há), desenvolvedor novo e item novo (é o nosso caso
— conte com o prazo cheio na primeira vez).

**Se rejeitar:** a mensagem cita a política violada. Corrija exatamente aquilo,
suba a `version` e reenvie — reenviar sem mudar nada só queima tempo de fila. As
duas rejeições prováveis aqui são "o revisor não conseguiu usar" (§7) e
"justificativa de permissão insuficiente" (§5).

## 9. Depois de aprovada

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
