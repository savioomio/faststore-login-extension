/**
 * Handshake com o VTEX ID — o coracao da extensao.
 *
 * ┌─ LEIA ANTES DE ALTERAR ────────────────────────────────────────────────────┐
 * │ 1. TUDO roda com `credentials: 'omit'` e o `authenticationToken` no CORPO.  │
 * │    Nao e detalhe de estilo: e o que impede o navegador de trocar a sessao   │
 * │    por outra (o bug "codigo valido responde WrongCredentials") e o que      │
 * │    preserva a sessao real do dev no ambiente IO. Ver ADR-0002.              │
 * │ 2. Sucesso do `accesskey/send` e CORPO VAZIO. JSON com `authStatus` = FALHA.│
 * │ 3. Campo e `accesskey` (minusculo) no accesskey/validate. Nao e typo.       │
 * │ 4. Nada de appKey/appToken aqui. Rotas /pub/ autenticam o USUARIO. Ver R-1. │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * Familia LEGACY (`/api/vtexid/pub/`) do inicio ao fim. Nunca misture com a
 * authenticator (`/api/authenticator/pub/`): os tokens de sessao nao sao
 * intercambiaveis e o sintoma e `InvalidToken`.
 */

const base = (account) => `https://${account}.myvtex.com`;

/** Toda chamada ao VTEX ID passa por aqui. Sem cookie, sempre. */
async function call(account, path, body) {
  const response = await fetch(`${base(account)}${path}`, {
    method: body === undefined ? "GET" : "POST",
    // A razao de ser do ADR-0002. Nao troque por 'include'.
    credentials: "omit",
    headers: {
      accept: "application/json",
      ...(body === undefined
        ? {}
        : { "content-type": "application/x-www-form-urlencoded" }),
    },
    ...(body === undefined ? {} : { body: new URLSearchParams(body).toString() }),
  });

  const text = await response.text();

  // Corpo nao-JSON e informacao, nao acidente: um 4xx sem JSON e propagacao de
  // usuario/organizacao recem-criada, e a unica falha que vale retentar.
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = null;
  }

  return { ok: response.ok, status: response.status, payload };
}

/**
 * Falhas 4xx as vezes vem em `code` e nao em `authStatus`. Um cliente que so le
 * `authStatus` vira "erro inesperado" sem diagnostico.
 */
export function errorCodeOf({ status, payload }) {
  if (!payload) return `HTTP_${status}`;
  return (
    payload.authStatus ||
    payload.code ||
    payload.error?.code ||
    (payload.errors ? Object.keys(payload.errors)[0] : "") ||
    `HTTP_${status}`
  );
}

/**
 * Passo 1 — abre a sessao e diz quais metodos a conta habilita.
 *
 * O token vem no CORPO (`authenticationToken`), nao so no Set-Cookie: e por isso
 * que a extensao nunca precisa ler cookie de outro dominio.
 */
export async function start(account) {
  const res = await call(
    account,
    `/api/vtexid/pub/authentication/start?scope=${account}&accountName=${account}`
  );

  const token = res.payload?.authenticationToken ?? "";
  if (!token) {
    throw new VtexIdError(
      "Não foi possível falar com o VTEX ID desta conta. Confira o nome da conta.",
      errorCodeOf(res)
    );
  }

  return {
    token,
    methods: {
      // A UI se desenha a partir disto, sem chutar o metodo — e o que faz a
      // extensao servir B2C e B2B sem ramificacao.
      password: res.payload?.showClassicAuthentication ?? false,
      accessKey: res.payload?.showAccessKeyAuthentication ?? false,
    },
  };
}

/**
 * Passo 2 — dispara o codigo de 6 digitos.
 *
 * ⚠️ SUCESSO E CORPO VAZIO. Se vier JSON com `authStatus`, e FALHA. Tratar ao
 * contrario faz o usuario esperar um e-mail que nunca chega.
 */
export async function sendAccessKey(account, token, email) {
  const res = await call(
    account,
    `/api/vtexid/pub/authentication/accesskey/send?email=${encodeURIComponent(email)}`,
    { authenticationToken: token }
  );

  if (!res.ok || res.payload?.authStatus) {
    const code = errorCodeOf(res);
    throw new VtexIdError(messageFor(code, "codigo"), code);
  }
}

/** Passo 3 — troca o codigo pelo JWT. */
export async function loginWithAccessKey(account, token, email, accessKey) {
  return authenticate(
    account,
    "/api/vtexid/pub/authentication/accesskey/validate",
    // `accesskey` minusculo aqui. No classic/setpassword e `accessKey`. Nao e typo.
    { authenticationToken: token, login: email, accesskey: accessKey },
    "codigo"
  );
}

/** Caminho alternativo — senha. Digitada, usada e descartada (ADR-0003). */
export async function loginWithPassword(account, token, email, password) {
  return authenticate(
    account,
    "/api/vtexid/pub/authentication/classic/validate",
    { authenticationToken: token, login: email, password },
    "senha"
  );
}

async function authenticate(account, path, body, contexto) {
  const res = await call(account, path, body);

  if (res.payload?.authStatus !== "Success") {
    const code = errorCodeOf(res);
    throw new VtexIdError(messageFor(code, contexto), code);
  }

  // O JWT vem no CORPO. E isso que dispensa ler Set-Cookie de outro dominio —
  // que em MV3 exigiria `webRequest` com permissao larga.
  const jwt = res.payload?.authCookie?.Value;
  if (!jwt) {
    throw new VtexIdError(
      "O VTEX ID autenticou mas não devolveu a sessão. Tente de novo.",
      "MissingAuthCookie"
    );
  }

  return jwt;
}

export class VtexIdError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

/**
 * ⚠️ `WrongCredentials` e ambiguo POR DESIGN da VTEX: senha errada, codigo
 * errado, codigo JA USADO, codigo expirado ou usuario inexistente respondem
 * igual. E anti-enumeracao — nunca escreva mensagem que revele se o e-mail
 * existe (R-5).
 *
 * A plataforma nao diz qual e a causa, entao a mensagem nao finge diagnostico:
 * ela cita as saidas reais. O `contexto` so escolhe QUAIS saidas fazem sentido —
 * quem entrou por senha nao precisa ouvir sobre codigo de uso unico.
 *
 * Ao depurar, elimine primeiro a causa banal: o codigo e de USO UNICO.
 */
const MESSAGES = {
  WrongCredentials: {
    codigo:
      "Não autenticou. Cada código vale uma única vez — se você já usou este, peça um novo. Se persistir, confirme com o admin se o usuário tem acesso.",
    senha: "Não autenticou. Confira a senha e tente de novo.",
    "": "Não autenticou. Confira os dados e tente de novo.",
  },
  InvalidAccessKey: "Código inválido ou expirado. Peça um novo.",
  InvalidToken:
    "A sessão do login expirou (ela dura 10 min). Peça um código novo e comece de novo.",
  InvalidEmail: "Informe um e-mail válido.",
  BlockedUser:
    "A VTEX bloqueou este usuário temporariamente por excesso de tentativas. Aguarde 15 a 30 min.",
  BlockedHostDomain: "Informe um e-mail válido (com @).",
  InvalidB2BClaims:
    "Usuário sem organização válida ou com contrato inativo. Fale com o admin da conta.",
};

const GENERIC = "Não foi possível concluir. Tente de novo em alguns instantes.";

/** `contexto`: "codigo" | "senha" | "" — de qual fluxo veio a falha. */
export function messageFor(code, contexto = "") {
  const entrada = MESSAGES[code];
  if (!entrada) return GENERIC;
  if (typeof entrada === "string") return entrada;
  return entrada[contexto] ?? entrada[""];
}
