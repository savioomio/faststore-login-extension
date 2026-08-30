# Sondar um endpoint não documentado do VTEX ID

> Quase tudo que este repo usa **não está no catálogo oficial de APIs da VTEX**:
> `classic/validate`, `accesskey/send` e `classic/setpassword` não aparecem lá
> (varredura completa em 2026-07-28, registrada na base de conhecimento).
>
> Este runbook é como se descobre o contrato de um endpoint desses **sem chutar**.
> Foi assim que se descobriu que o `authenticationToken` funciona no corpo
> ([research 2026-08-30 §2](../research/2026-08-30-viabilidade-extensao-dev-login.md#2--descoberta-o-handshake-é-stateless)).

---

## 1. O endpoint existe?

`POST` com corpo vazio. `404` = não existe; qualquer outra coisa = existe.

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  "https://<conta>.myvtex.com/api/authenticator/pub/authentication/passwordless/validate"
```

Vale a pena rodar sobre uma lista de caminhos suspeitos de uma vez — foi assim
que se montou o "mapa de existência" da base de conhecimento (§3.5).

## 2. Quais campos ele exige?

O mesmo `POST` de corpo vazio: a resposta `400` costuma **listar os campos
obrigatórios**.

```bash
curl -s -X POST "https://<conta>.myvtex.com/api/vtexid/pub/authentication/classic/setpassword" \
  -H 'content-type: application/x-www-form-urlencoded' -d ''
# → {"errors":{"newPassword":["The newPassword field is required."]}}
```

Nem sempre: rotas de autenticação às vezes respondem `authStatus` em vez de
`errors` (`InvalidEmail`, `InvalidToken`). Isso também informa — diz **qual
validação roda primeiro**.

## 3. Um parâmetro é aceito neste lugar?

Padrão de três testes. É o que separa "funcionou" de "coincidência":

```bash
TOKEN=$(curl -s "https://<conta>.myvtex.com/api/vtexid/pub/authentication/start?scope=<conta>&accountName=<conta>" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['authenticationToken'])")

# A) com o parâmetro no lugar que se quer testar
curl -s -X POST ".../accesskey/validate" -d "authenticationToken=$TOKEN&login=usuario@exemplo.com&accesskey=000000"

# B) com o parâmetro no lugar já conhecido (controle positivo)
curl -s -X POST ".../accesskey/validate" -H "cookie: _vss=$TOKEN" -d "login=usuario@exemplo.com&accesskey=000000"

# C) sem o parâmetro (controle negativo)
curl -s -X POST ".../accesskey/validate" -d "login=usuario@exemplo.com&accesskey=000000"
```

Leitura: **A == B ≠ C** prova que o parâmetro foi aceito em (A). Sem o (C), "A ==
B" poderia significar só que os dois foram ignorados.

Use credencial deliberadamente errada (`accesskey=000000`, e-mail inexistente).
A resposta anti-enumeração `WrongCredentials` é justamente o sinal de que **a
sessão foi aceita e a credencial foi avaliada** — que é o que se quer medir.

## 4. Como ler a resposta

| Sinal | Significa |
|---|---|
| `InvalidToken` | a sessão **não** foi aceita — o passo anterior falhou |
| `WrongCredentials` | a sessão **foi** aceita, a credencial é que não presta |
| corpo vazio no `accesskey/send` | **sucesso** (contraintuitivo) |
| JSON com `authStatus` no `accesskey/send` | **falha** |
| `401` com corpo em **texto puro** | **bloqueio temporário por tentativas** — pare, não retente |
| outro `4xx` com corpo **não-JSON** | propagação de usuário/organização — retentar |
| `4xx` com corpo JSON | falha real — **não** retentar |

Leia sempre `authStatus ?? code ?? error.code`: falhas `4xx` às vezes vêm em
`code` (`{"code":"BlockedHostDomain"}`), e um cliente que só lê `authStatus` vira
"erro inesperado" sem diagnóstico.

Confira também `x-vtex-janus-router-backend-app` — diz qual família respondeu
(`vid-v4.*` = legacy, `authenticator-v0.*` = authenticator).

---

## Regras ao sondar

1. **Espace os testes.** `start` tem `x-ratelimit-limit: 200`; `setpassword`,
   `10,50`. Após poucas tentativas seguidas a VTEX passa a responder `200`
   fantasma no `send` **sem enviar e-mail**, e bloqueia o usuário por 15–30 min.
   Um bloqueio no meio de uma investigação faz você concluir a coisa errada.
2. **Nunca queime código de acesso de usuário real** só para sondar contrato.
   Credencial errada de propósito responde o que você precisa saber.
3. **Cada teste consome um identificador para sempre** se envolver criação:
   identificadores são imutáveis e o usuário é indelével. Não há API para
   desfazer.
4. **Anote na research, com o `curl` e a resposta.** Endpoint não documentado não
   tem outra especificação além da sua evidência
   ([regra 1 de docs](../README.md#regras-que-valem-para-as-cinco-gavetas)).
