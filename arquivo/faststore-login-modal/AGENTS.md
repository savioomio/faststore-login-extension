# AGENTS.md — LoginModal (FastStore / VTEX ID B2C)

> **Instruções para agentes de IA.** Se você foi direcionado a este componente, leia este arquivo inteiro antes de escrever qualquer linha. Ele contém tudo que é necessário: você **não** precisa pesquisar a API do VTEX ID nem inventar endpoints.

---

## 0. O que este componente é

Modal de login **B2C** para FastStore que fala direto com as rotas públicas do VTEX ID, sem redirecionar para a página nativa `/login`.

**Cobre:** login com senha · login com código de acesso (passwordless) · esqueci minha senha · definição de 1ª senha.

**Não cobre:** cadastro de novo cliente · B2B (username/organização/contrato) · login social (Google/Facebook) · logout (use o nativo do FastStore).

---

## 1. Ordem de leitura

1. Este arquivo (regras e passo a passo).
2. `src/graphql/vtex/resolvers/vtexIdAuth.ts` — onde vive todo o handshake.
3. `src/hooks/useVtexIdAuth.ts` — onde vive a máquina de estados.
4. `README.md` — referência de props e troubleshooting.
5. Se faltar contexto: este arquivo já traz tudo que o componente precisa. A base de conhecimento completa do VTEX ID — com o que foi verificado ao vivo por `curl` — está em [`docs/reference/vtex-id.md`](../../docs/reference/vtex-id.md) do repositório `vtex-login`. ⚠️ Ela **não viaja junto** quando o componente é copiado para um projeto cliente: só os arquivos de `src/` são copiados (ver §2). Num projeto cliente, peça o documento ao responsável.

---

## 2. Instalação (execute nesta ordem)

### Passo 1 — Copiar arquivos

| De (este componente) | Para (projeto FastStore) |
| :--- | :--- |
| `src/graphql/vtex/typeDefs/vtexid.graphql` | mesmo caminho |
| `src/graphql/vtex/resolvers/vtexIdAuth.ts` | mesmo caminho |
| `src/hooks/useVtexIdAuth.ts` | mesmo caminho |
| `src/sdk/loginModal.ts` | mesmo caminho |
| `src/components/login/LoginModal/LoginModal.tsx` | mesmo caminho |
| `src/components/login/LoginModal/login-modal.module.scss` | mesmo caminho |

**Preserve a estrutura de pastas exatamente.** Todos os imports são relativos e contam com ela.

### Passo 2 — Registrar os resolvers

Edite `src/graphql/vtex/resolvers/index.ts` **do projeto** (não crie um novo se já existir — faça merge):

```ts
import vtexIdAuthResolvers from "./vtexIdAuth";

export default {
  Query: { ...vtexIdAuthResolvers.Query /* , ...outros */ },
  Mutation: { ...vtexIdAuthResolvers.Mutation /* , ...outros */ },
};
```

### Passo 3 — Gerar o schema

```bash
yarn generate
```

Sem isso as mutations não existem e o front recebe erro de operação desconhecida.

### Passo 4 — Montar o modal

O `<LoginModal />` precisa existir **uma vez** numa árvore presente em todas as páginas. Ele renderiza via portal no `body`, então a posição no DOM é irrelevante. O caminho usual é o override da `Navbar` (exemplo completo no `README.md`).

O botão de login chama:

```ts
import { openLoginModal } from "../../sdk/loginModal"; // relativo ao SEU arquivo

openLoginModal();               // volta para a mesma página após logar
openLoginModal("/minha-conta"); // redireciona após logar
```

### Passo 5 — Verificar (ver seção 6)

---

## 3. Regras invioláveis

Quebrar qualquer uma destas produz bug que **parece outra coisa** e custa horas.

| # | Regra | O que acontece se quebrar |
| :--: | :--- | :--- |
| 1 | O `_vss` usado no `validate`/`setpassword` tem que ser **o mesmo** do `accesskey/send`. | Código **válido** responde `WrongCredentials`. Parece "código errado" e não é. |
| 2 | Sucesso do `accesskey/send` é **corpo vazio**. JSON com `authStatus` = **falha**. | Você trata falha como sucesso e o usuário fica esperando um e-mail que não vem. |
| 3 | Nunca misture `/api/vtexid/pub/` (legacy) com `/api/authenticator/pub/` (authenticator) no mesmo fluxo. | `InvalidToken`. Os tokens de sessão não são intercambiáveis. |
| 4 | Nada de `appKey`/`appToken` neste componente. As rotas `/pub/` autenticam o **usuário**, não a aplicação. | Vazamento de credencial administrativa. |
| 5 | O handshake roda **só no resolver**, nunca no browser. | Os cookies vêm com `Domain={conta}.myvtex.com` e não colam no host do front. |
| 6 | Mensagem de erro **nunca** revela se o e-mail existe. | `WrongCredentials` é anti-enumeração por design da VTEX — vazar isso é falha de segurança. |
| 7 | Imports **relativos**, nunca alias `src/...`. | Quebra em projetos cujo tsconfig não tem o `paths`. |
| 8 | Campo é `accesskey` (minúsculo) no `accesskey/validate` e `accessKey` (camelCase) no `classic/setpassword`. | Não é typo — são convenções diferentes. Trocar dá erro de validação. |

---

## 4. O que você PODE mudar livremente

- **`LoginModal.tsx`** — todo o markup. Troque por componentes do `@faststore/ui`, mude ordem de campos, textos, ícones, transições.
- **`login-modal.module.scss`** — todo o estilo. Nada ali é pré-requisito funcional.
- **Textos** em `STEP_TITLES`, labels e placeholders.
- **`ERROR_MESSAGES`** no resolver — para ajustar o tom das mensagens (respeitando a regra 6).

## 5. O que você NÃO deve mudar sem motivo explícito

- A sequência de passos do fluxo e as assinaturas do `useVtexIdAuth`.
- Qualquer coisa dentro de `vtexIdAuth.ts` marcada com comentário de aviso.
- O contrato GraphQL (`vtexid.graphql`) — mudar nome de mutation exige `yarn generate` e ajuste no hook.
- O nome do cookie `wc_vtexid_vss` e seu `Max-Age` de 600s (o `_vss` da VTEX expira em 10 min).

---

## 6. Checklist de verificação (rode antes de dizer "pronto")

- [ ] `yarn generate` rodou sem erro e as mutations aparecem em `.faststore/@generated/`.
- [ ] Abrir o modal → aba Network mostra `POST /api/graphql` com `operationName: VtexIdAuthMethods`.
- [ ] Login com senha correta → resposta com `success: true` **e** cookie `VtexIdclientAutCookie_*` visível em DevTools > Application > Cookies.
- [ ] Após o reload, o header mostra o usuário logado (não "Entre ou Cadastre-se").
- [ ] Login com senha errada → mensagem "E-mail ou senha incorretos.", sem vazar se o e-mail existe.
- [ ] "Esqueci minha senha" → e-mail chega, código funciona, usuário sai **logado** (o `setpassword` já autentica).
- [ ] Fechar no ESC, no clique fora e no botão ×; scroll do body destravado ao fechar.

---

## 7. Pré-requisitos de ambiente (verifique ANTES de debugar código)

| Item | Como checar | Se estiver errado |
| :--- | :--- | :--- |
| Método de login habilitado | Query `vtexIdAuthMethods` retorna `password: true` | Admin > Configurações da conta > Autenticação > **Loja virtual**. É configuração, não código. |
| `discovery.config.js` | `api.storeId` e `api.workspace` preenchidos | Corrigir — é de lá que sai a URL do VTEX ID. |
| Auth cookie root domain | Em produção, o cookie precisa colar no domínio próprio | **Ticket na VTEX (time de Identity)**. Item obrigatório de go-live, não tem workaround em código. |
| Pacotes `@faststore` atualizados | `yarn upgrade -L --scope @faststore` | A normalização de domínio de cookie em preview/localhost veio no release de 2026-02-12. |

---

## 8. Tabela de erros do VTEX ID

| `errorCode` | Significado real | Ação |
| :--- | :--- | :--- |
| `WrongCredentials` | Senha errada **ou** código errado **ou** código já usado **ou** usuário inexistente **ou** `_vss` de outra sessão | Ambíguo por design. Ao debugar, elimine primeiro a causa banal: **código já usado** (é single-use). |
| `InvalidAccessKey` | Código inválido ou expirado | Pedir novo código. |
| `InvalidToken` | `_vss` ausente, expirado (10 min) ou da outra família de API | Reiniciar o fluxo. |
| `InvalidEmail` | Campo `login` sem formato de e-mail | Validar no front. |
| `BlockedUser` | Bloqueio temporário por tentativas | Aguardar 15–30 min. **Não retentar em loop.** |
| `BlockedHostDomain` | Identificador sem `@` | Em B2C não deveria acontecer — é sinal de bug no front. |
| `MissingAuthCookie` | Código local: VTEX disse `Success` mas não veio cookie | Investigar `ctx.storage.cookies` / versão do `@faststore/core`. |
| `HTTP_403` sem corpo | Usuário recém-criado, organização/dados ainda propagando | Já tratado: o resolver retenta 3× / 700ms. |

---

## 9. Armadilhas de teste

- **Rate limits reais:** `start` = 200 · `setpassword` = 10 e 50 (duas janelas). Espace testes automatizados.
- **Código de acesso é single-use.** Reutilizar dá `WrongCredentials`.
- **Após poucas tentativas seguidas**, a VTEX pode responder `200` no `send` **sem enviar e-mail**. Não é bug do código — é bloqueio temporário.
- **`curl` sem cookie jar** (`-c`/`-b`) sempre dá `InvalidToken`: o `_vss` do `send` precisa chegar no passo seguinte.

---

## 10. Se a loja for B2B

**Pare.** Este componente não serve sem reescrever o resolver: B2B exige a família authenticator (`?an=`), usa username como identificador, não suporta código de acesso como login, e a rota legacy `classic/setpassword` tem furo de segurança com contrato inativo (devolve `Success` + cookies mesmo com o contrato bloqueado, criando bypass). Consulte a base de conhecimento interna do VTEX ID antes de adaptar.
