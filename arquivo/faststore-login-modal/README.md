# LoginModal (FastStore) — Login B2C headless com VTEX ID

> Modal de login próprio para lojas **B2C** em FastStore, falando direto com as rotas públicas do **VTEX ID** — sem redirecionar o usuário para a página nativa `/login` da VTEX. Cobre login por senha, login por código de acesso (passwordless), "esqueci minha senha" e definição de primeira senha.

> 🤖 **Se você é uma IA:** leia o [AGENTS.md](./AGENTS.md) deste componente antes de qualquer coisa. Ele tem o passo a passo de instalação, as regras que não podem ser quebradas e o checklist de verificação.

---

## 📸 Preview

O layout entregue é **neutro de propósito** — a expectativa é que cada projeto substitua o markup e o SCSS pelo design da loja. O fluxo e as chamadas de API são a parte reutilizável.

---

## ℹ️ Informações Gerais

| Campo | Descrição |
| :--- | :--- |
| **Nome do(s) componente(s)** | `LoginModal` \| `useVtexIdAuth` \| `loginModalStore` \| `vtexIdAuthResolvers` |
| **Diretório(s)** | `src/components/login/LoginModal/` \| `src/hooks/` \| `src/sdk/` \| `src/graphql/vtex/` |
| **Plataforma** | FastStore (`@faststore/core` v3+) |
| **Segmento** | **B2C apenas.** Para B2B (username, organização, contrato), ver seção [B2B](#-e-se-a-loja-for-b2b) |
| **Responsável** | Sávio Pessôa Afonso |

### Arquivos usados

- **UI**
  - `src/components/login/LoginModal/LoginModal.tsx` — *o arquivo que você vai customizar*
  - `src/components/login/LoginModal/login-modal.module.scss`
- **Hooks / Estado**
  - `src/hooks/useVtexIdAuth.ts` — máquina de estados do fluxo (não replique a lógica no JSX)
  - `src/sdk/loginModal.ts` — store global de abrir/fechar o modal
- **GraphQL (schema + resolvers)**
  - `src/graphql/vtex/typeDefs/vtexid.graphql`
  - `src/graphql/vtex/resolvers/vtexIdAuth.ts` — **todo o handshake com o VTEX ID**

---

## ⚙️ Props

### `LoginModal`

| Prop | Tipo | Descrição | Obrigatório | Valor Padrão |
| :--- | :--- | :--- | :---: | :--- |
| `title` | `string` | Título exibido no passo de senha. | Não | `"Entrar com e-mail e senha"` |
| `signUpUrl` | `string \| null` | URL da página de cadastro. `null` esconde o link. | Não | `"/cadastro"` |
| `reloadOnSuccess` | `boolean` | Recarrega a página após autenticar. | Não | `true` |
| `onSuccess` | `() => void` | Callback após autenticar, antes do reload/redirect. | Não | `undefined` |
| `className` | `string` | Classe extra no container do modal. | Não | `undefined` |

> ℹ️ **Por que `reloadOnSuccess` é `true` por padrão?** O reload renova sessão, carrinho, política comercial e qualquer conteúdo renderizado no servidor de uma vez só. Com `false`, a sessão é revalidada via `sessionStore`, mas o que já veio do SSR continua com os dados de visitante.

### `useVtexIdAuth(options)`

| Opção | Tipo | Descrição | Valor Padrão |
| :--- | :--- | :--- | :--- |
| `reloadOnSuccess` | `boolean` | Igual à prop do modal. | `true` |
| `onSuccess` | `() => void` | Callback pós-autenticação. | `undefined` |
| `redirectTo` | `string` | URL de destino após login. Sobrepõe o reload. | `undefined` |

Retorna: `{ step, goToStep, email, setEmail, loading, error, notice, methods, loginWithPassword, sendAccessKey, loginWithAccessKey, setNewPassword, reset }`.

---

## 🚀 Condições de Funcionamento

1. **Método de login habilitado no Admin.** Em B2C, senha e código de acesso são **opcionais** e precisam estar ligados em *Configurações da conta > Autenticação > aba Loja virtual*. Se senha estiver desligada, o formulário de e-mail+senha simplesmente não autentica. O componente consulta isso em runtime (`vtexIdAuthMethods`) e esconde o que não estiver habilitado.
2. **`discovery.config.js` com `api.storeId` e `api.workspace` corretos** — é de lá que o resolver monta a URL do VTEX ID.
3. **Resolvers registrados** no agregador `src/graphql/vtex/resolvers/index.ts` do projeto (ver [Instruções de Uso](#-instruções-de-uso)).
4. **`yarn generate` executado** após copiar os arquivos — sem isso as mutations não existem no schema gerado e o front recebe erro de operação desconhecida.
5. **Auth cookie root domain configurado na VTEX** (item obrigatório de go-live). Em `localhost` e `*.vtex.app` o FastStore normaliza o domínio do cookie automaticamente; no domínio de produção próprio, **é configuração feita pelo time de Identity da VTEX via ticket**. Sem isso o usuário "loga" e o checkout continua vendo visitante.
6. **Dependências do projeto consumidor**: `src/sdk/graphql/request`, `src/sdk/session`, React 18+ (`useSyncExternalStore`).

---

## 🛠️ Funcionamento Técnico

### Por que existe um resolver no meio

O handshake **não pode** rodar no browser. Os cookies devolvidos pelo VTEX ID vêm com `Domain={conta}.myvtex.com` e não colam num front que roda em outro domínio. O resolver server-side chama o VTEX ID, pega o `Set-Cookie` da resposta e **re-emite cada cookie para o host da request** via `ctx.storage.cookies.set()`.

```
browser → /api/graphql (mutation) → resolver → VTEX ID (/api/vtexid/pub/...)
                                       ↓
                            Set-Cookie repassado ao browser
                                       ↓
                          sessionStore / reload → usuário logado
```

### Fluxos implementados

| Fluxo | Passos | Endpoints VTEX ID |
| :--- | :--- | :--- |
| **Login com senha** | 1 chamada | `start` → `classic/validate` |
| **Login com código** | 2 chamadas | `start` → `accesskey/send` → `accesskey/validate` |
| **Esqueci minha senha / 1º acesso** | 2 chamadas | `start` → `accesskey/send` → `classic/setpassword` |

O `classic/setpassword` é chamada **única**: define a senha **e já devolve os cookies de autenticação**. Não é preciso validar o código antes.

### Os três detalhes que quebram tudo se ignorados

1. **O código de acesso é atrelado à sessão `_vss` que o enviou.** Usar um `_vss` novo faz um código **válido** responder `WrongCredentials` — parece "código errado" e não é. Por isso o resolver guarda o `_vss` do `send` num cookie first-party `wc_vtexid_vss` (HttpOnly, 10 min) e o reusa no `validate`/`setpassword`.
2. **Sucesso do `accesskey/send` é corpo VAZIO.** Se a resposta trouxer JSON com `authStatus`, é **falha**. O resolver trata assim.
3. **Não misture as duas famílias de API.** `/api/vtexid/pub/` (legacy) e `/api/authenticator/pub/` (authenticator) têm tokens de sessão incompatíveis. B2C usa a legacy. O único ponto onde o resolver cruza é o fallback do login com senha, e nesse caso ele refaz o `start` na outra família.

### Fallback "Login with Alternative Keys"

Contas com esse recurso habilitado recusam a rota legacy com `400 "should not rely on legacy routes"`. O resolver detecta e refaz o login pela authenticator (`?an={conta}`). Nenhuma ação necessária do desenvolvedor.

### Anti-enumeração

`WrongCredentials` é a resposta tanto para senha errada quanto para usuário inexistente — por design da VTEX. **Nunca** escreva mensagem que revele se o e-mail existe. As mensagens em `ERROR_MESSAGES` (no resolver) já respeitam isso.

---

## 📖 Instruções de Uso

### 1) Copiar os arquivos

Copie preservando a estrutura:

```bash
src/components/login/LoginModal/LoginModal.tsx
src/components/login/LoginModal/login-modal.module.scss
src/hooks/useVtexIdAuth.ts
src/sdk/loginModal.ts
src/graphql/vtex/typeDefs/vtexid.graphql
src/graphql/vtex/resolvers/vtexIdAuth.ts
```

> ⚠️ **Imports são todos relativos** — não use o alias `src/...`. A estrutura de pastas acima é espelhada do projeto consumidor justamente para que os relativos resolvam sem depender do `paths` do tsconfig.

### 2) Registrar os resolvers

Em `src/graphql/vtex/resolvers/index.ts` (arquivo **do projeto**, não deste componente):

```ts
import vtexIdAuthResolvers from "./vtexIdAuth";

export default {
  Query: {
    ...vtexIdAuthResolvers.Query,
    // ...demais resolvers do projeto
  },
  Mutation: {
    ...vtexIdAuthResolvers.Mutation,
    // ...demais resolvers do projeto
  },
};
```

### 3) Gerar o schema

```bash
yarn generate
```

### 4) Montar o modal e abrir de qualquer lugar

O modal se auto-renderiza quando a store global manda abrir, então basta montá-lo **uma vez** num ponto global — o override da `Navbar` é o lugar natural:

```tsx
// src/components/overrides/Navbar.tsx
import { SectionOverride } from "@faststore/core";
import LoginModal from "../login/LoginModal/LoginModal";
import { openLoginModal } from "../../sdk/loginModal";

const SECTION = "Navbar" as const;

const override: SectionOverride = {
  section: SECTION,
  components: {
    ButtonSignIn: {
      props: {
        onClick: (event: React.MouseEvent) => {
          event.preventDefault();
          openLoginModal();
        },
      },
    },
    // renderiza o modal junto da navbar (fica em portal no body)
    NavbarSlider: {
      Component: (props: any) => (
        <>
          <LoginModal />
        </>
      ),
    },
  },
};

export default override;
```

> ⚠️ O nome dos componentes internos da `Navbar` varia por versão do `@faststore/core`. Confira a [lista de seções nativas](https://developers.vtex.com/docs/guides/faststore/building-sections-list-of-native-sections) da sua versão. Se preferir não depender disso, monte o `<LoginModal />` em qualquer componente que exista em todas as páginas — ele usa portal para o `body`, então a posição no DOM não importa.

Abrindo de qualquer outro ponto do código (inclusive fora de React):

```ts
import { openLoginModal } from "../../sdk/loginModal"; // ajuste o relativo ao seu arquivo

openLoginModal();               // abre e volta para a mesma página
openLoginModal("/minha-conta"); // abre e redireciona após o login
```

Exemplo integrando com a Wishlist deste mesmo repositório:

```tsx
<WishlistButton variant={variant} onUnauthenticatedClick={() => openLoginModal()} />
```

### 5) Customizar o layout

Mexa **só** em `LoginModal.tsx` (markup) e `login-modal.module.scss` (estilo). Mantenha as chamadas `auth.loginWithPassword`, `auth.sendAccessKey`, `auth.loginWithAccessKey` e `auth.setNewPassword` — é o contrato do fluxo.

### 6) Testar sem browser (QA)

```bash
# 1. pegue o hash da operação
cat .faststore/@generated/persisted-documents.json | grep -i VtexIdSendAccessKey

# 2. use cookie jar — o `_vss` do send precisa chegar no setpassword
curl -c jar.txt -b jar.txt -X POST 'http://localhost:3000/api/graphql?operationName=VtexIdSendAccessKey&operationHash=<hash>' \
  -H 'content-type: application/json' \
  -d '{"operationName":"VtexIdSendAccessKey","operationHash":"<hash>","variables":{"email":"teste@exemplo.com"}}'
```

Sem o `-c/-b` dá `InvalidToken`, que **parece** "código errado".

---

## ❓ Troubleshooting

### 1) Código correto responde "código inválido"

- **Causa**: o `_vss` usado no `validate`/`setpassword` não é o mesmo do `send`.
- **Checar**: se o cookie `wc_vtexid_vss` está indo e voltando (DevTools > Application > Cookies). Se o resolver está rodando em ambiente onde `ctx.storage.cookies.set` funciona. Em `curl`, se você está usando cookie jar.
- **Segunda causa mais comum**: código **já usado** — é single-use. Peça um novo antes de suspeitar de qualquer outra coisa.

### 2) Loga, mas o site continua mostrando "Entre ou Cadastre-se"

- **Causa**: cookie de autenticação não colou no domínio.
- **Checar**: em produção, se o **auth cookie root domain** foi configurado pela VTEX (ticket). Em preview/localhost, se os pacotes `@faststore` estão atualizados (a normalização de domínio veio no release de 2026-02-12).
- **Sintoma clássico**: `VtexIdclientAutCookie_*` aparece na resposta do `/api/graphql` mas não aparece na aba Cookies do browser.

### 3) `200` no envio do código, mas o e-mail nunca chega

- **Causa**: bloqueio temporário por excesso de tentativas. A VTEX passa a responder `200` fantasma sem enviar.
- **Solução**: aguardar 15–30 min. **Espace os testes automatizados** — `start` tem rate limit de 200 e `setpassword` de 10/50 (duas janelas).

### 4) "Erro inesperado" sem diagnóstico

- **Causa**: falhas `4xx` da VTEX às vezes vêm em `code` e não em `authStatus`.
- **Solução**: já tratado — o resolver lê `authStatus ?? code ?? error.code`. Se aparecer um código novo, adicione em `ERROR_MESSAGES`.

### 5) Mutation não existe / `Unknown operation`

- **Causa**: `yarn generate` não rodou, ou os resolvers não foram registrados no `index.ts`.
- **Solução**: rodar `yarn generate` (pode rodar com o dev server de pé) e conferir o registro.

### 6) O formulário de senha não autentica nunca

- **Causa**: login por senha desabilitado no Admin da conta.
- **Checar**: *Configurações da conta > Autenticação > Loja virtual*. O campo `methods.password` do hook reflete isso — se vier `false`, é configuração, não código.

---

## 🏢 E se a loja for B2B?

Este componente **não serve** para B2B sem ajustes. Em B2B:

- Use **sempre** a família authenticator (`/api/authenticator/pub/...` com `?an={conta}`) — é a única que valida organização/contrato.
- Código de acesso **não é método de login** (só de recuperação de senha).
- O identificador primário é **username**, não e-mail.
- A rota legacy `classic/setpassword` tem um **furo de segurança** em B2B: com contrato inativo ela devolve `Success` + cookies, criando bypass do bloqueio de organização.

Referência completa: [`docs/reference/vtex-id.md`](../../docs/reference/vtex-id.md) — em especial a §7 (diferenças B2B) e a §3 (fluxo authenticator).

---

## 📚 Referências

- [`docs/reference/vtex-id.md`](../../docs/reference/vtex-id.md) — base de conhecimento completa do VTEX ID, com o que foi verificado ao vivo por `curl`. Documento interno do repo `vtex-login`; **não é copiado junto** com o componente
- [Refresh token flow for headless implementations](https://developers.vtex.com/docs/guides/refresh-token-flow-for-headless-implementations) — documenta oficialmente `start`, `accesskey/send` e `accesskey/validate`
- [VTEX ID API](https://developers.vtex.com/docs/api-reference/vtex-id-api)
- [Autenticação (Help Center)](https://help.vtex.com/pt/docs/tutorials/autenticacao) — onde habilitar os métodos de login
- [Enabling refresh token on FastStore](https://developers.vtex.com/docs/faststore/enabling-refresh-token) — sessão além de 24h (exige ticket na VTEX)
- [Extending API schemas (FastStore)](https://developers.vtex.com/docs/faststore/extending-api-schema)

> ⚠️ `classic/validate` (sem `?an=`) e `classic/setpassword` **não estão** no catálogo oficial de APIs da VTEX. O comportamento documentado aqui foi obtido por teste direto contra conta real.
