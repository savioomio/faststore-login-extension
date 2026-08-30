/**
 * Login headless B2C via VTEX ID — resolvers server-side.
 *
 * ┌─ NÃO ALTERE SEM LER O AGENTS.md DO COMPONENTE ────────────────────────────┐
 * │ 1. O código de acesso é atrelado à sessão `_vss` que o enviou. Reusar     │
 * │    outro `_vss` faz um código VÁLIDO responder `WrongCredentials`.        │
 * │ 2. Sucesso do `accesskey/send` é CORPO VAZIO. Se vier JSON com            │
 * │    `authStatus`, é FALHA.                                                 │
 * │ 3. Nunca misture a família legacy (`/api/vtexid/pub/`) com a authenticator │
 * │    (`/api/authenticator/pub/`) dentro do mesmo fluxo — o `_vss` de uma     │
 * │    não vale na outra.                                                     │
 * │ 4. Nada de appKey/appToken aqui. Rotas `/pub/` autenticam o USUÁRIO.      │
 * └───────────────────────────────────────────────────────────────────────────┘
 */
import type { Resolver } from "@faststore/api";

type ApiContext = Parameters<Resolver>[2];

type AuthContext = ApiContext & {
  headers?: Record<string, string | undefined>;
  storage?: {
    cookies?: { set: (name: string, value: { setCookie: string }) => void };
  };
};

/** Retorno de toda mutation de auth — espelha o type `VtexIdAuthResult` do schema. */
type AuthResult = {
  success: boolean;
  errorCode: string | null;
  message: string | null;
};

type AuthResolver<Args> = (
  root: unknown,
  args: Args,
  ctx: AuthContext
) => Promise<AuthResult>;

// discovery.config.js é CommonJS
// eslint-disable-next-line @typescript-eslint/no-var-requires
const discovery = require("../../../../discovery.config.js") as {
  api?: { storeId?: string; workspace?: string };
};

const storeId = discovery?.api?.storeId ?? "";
const workspace = discovery?.api?.workspace ?? "master";

/** Conta VTEX. Em contas com nome diferente do storeId, ajuste aqui. */
const ACCOUNT = storeId;
const VTEX_BASE = `https://${workspace}--${storeId}.myvtex.com`;

/** Cookie first-party que carrega o `_vss` entre `send` e `validate`/`setpassword`. */
const VSS_COOKIE = "wc_vtexid_vss";
/** O `_vss` da VTEX expira em 10 min. Mantemos o nosso igual. */
const VSS_MAX_AGE = 600;

/** Cookies que devem ser repassados ao browser em caso de sucesso. */
const AUTH_COOKIE_PREFIXES = ["VtexIdclientAutCookie", "vid_rt"];

/* -------------------------------------------------------------------------- */
/* helpers                                                                     */
/* -------------------------------------------------------------------------- */

function getRequestCookies(ctx: AuthContext): string {
  return (
    (ctx.headers?.cookie as string | undefined) ||
    (ctx.headers?.Cookie as string | undefined) ||
    ""
  );
}

function readCookie(ctx: AuthContext, name: string): string {
  const match = getRequestCookies(ctx).match(
    new RegExp(`(?:^|;\\s*)${name}=([^;]*)`)
  );
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

/** Lê `Set-Cookie` da resposta cobrindo as variações de runtime (undici/node-fetch). */
function readSetCookies(response: Response): string[] {
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[];
    raw?: () => Record<string, string[]>;
  };

  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  if (typeof headers.raw === "function") {
    return headers.raw()["set-cookie"] ?? [];
  }

  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

function cookieName(raw: string): string {
  return raw.split("=")[0]?.trim() ?? "";
}

function cookieValue(raw: string): string {
  return raw.split(";")[0]?.split("=").slice(1).join("=") ?? "";
}

/**
 * Repassa os cookies de autenticação da VTEX para o browser.
 * O FastStore normaliza o atributo `Domain` para o host da request
 * (localhost / *.vtex.app) — em produção isso depende do
 * "auth cookie root domain" configurado na conta pelo time de Identity da VTEX.
 */
function relayAuthCookies(ctx: AuthContext, setCookies: string[]): boolean {
  let relayed = false;

  for (const raw of setCookies) {
    const name = cookieName(raw);
    if (!AUTH_COOKIE_PREFIXES.some((prefix) => name.startsWith(prefix))) {
      continue;
    }
    ctx.storage?.cookies?.set(name, { setCookie: raw });
    relayed = true;
  }

  return relayed;
}

/** Persiste o `_vss` recebido da VTEX como cookie first-party HttpOnly. */
function persistVss(ctx: AuthContext, token: string): void {
  if (!token) return;
  ctx.storage?.cookies?.set(VSS_COOKIE, {
    setCookie: `${VSS_COOKIE}=${encodeURIComponent(
      token
    )}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${VSS_MAX_AGE}`,
  });
}

function clearVss(ctx: AuthContext): void {
  ctx.storage?.cookies?.set(VSS_COOKIE, {
    setCookie: `${VSS_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
  });
}

/** Extrai o `_vss` de uma lista de `Set-Cookie`. */
function extractVss(setCookies: string[]): string {
  const raw = setCookies.find((c) => cookieName(c) === "_vss");
  return raw ? cookieValue(raw) : "";
}

function form(payload: Record<string, string>): string {
  return new URLSearchParams(payload).toString();
}

type VtexIdPayload = {
  authStatus?: string;
  code?: string;
  error?: { code?: string };
  errors?: Record<string, string[]>;
  authenticationToken?: string;
  showClassicAuthentication?: boolean;
  showAccessKeyAuthentication?: boolean;
  oauthProviders?: Array<{ providerName?: string }>;
};

type VtexIdResponse = {
  ok: boolean;
  status: number;
  /** `null` quando o corpo não é JSON (importante: 403 de propagação vem vazio). */
  payload: VtexIdPayload | null;
  setCookies: string[];
};

async function vtexIdFetch(
  path: string,
  init: { method: "GET" | "POST"; body?: string; vss?: string }
): Promise<VtexIdResponse> {
  const response = await fetch(`${VTEX_BASE}${path}`, {
    method: init.method,
    headers: {
      accept: "application/json",
      ...(init.body
        ? { "content-type": "application/x-www-form-urlencoded" }
        : {}),
      ...(init.vss ? { cookie: `_vss=${init.vss}` } : {}),
    },
    ...(init.body ? { body: init.body } : {}),
  });

  const text = await response.text();
  let payload: VtexIdPayload | null = null;
  try {
    payload = text ? (JSON.parse(text) as VtexIdPayload) : {};
  } catch {
    payload = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    payload,
    setCookies: readSetCookies(response),
  };
}

/* -------------------------------------------------------------------------- */
/* mapeamento de erro                                                          */
/* -------------------------------------------------------------------------- */

/**
 * `authStatus` é anti-enumeração: usuário inexistente e senha errada devolvem
 * o MESMO `WrongCredentials`. Nunca escreva mensagem que revele se o e-mail existe.
 */
const ERROR_MESSAGES: Record<string, string> = {
  WrongCredentials: "E-mail ou senha incorretos.",
  InvalidAccessKey: "Código inválido ou expirado. Solicite um novo código.",
  InvalidEmail: "Informe um e-mail válido.",
  InvalidToken:
    "Sua sessão expirou. Solicite um novo código e tente novamente.",
  BlockedUser:
    "Muitas tentativas. Seu acesso foi bloqueado temporariamente — aguarde alguns minutos.",
  BlockedHostDomain: "Informe um e-mail válido.",
  WeakPassword:
    "Senha fraca. Use no mínimo 8 caracteres, com 1 número, 1 maiúscula e 1 minúscula.",
  InvalidPasswordFormat:
    "Senha fora do padrão. Use no mínimo 8 caracteres, com 1 número, 1 maiúscula e 1 minúscula.",
};

const GENERIC_ERROR =
  "Não foi possível concluir. Tente novamente em alguns instantes.";

function errorCodeOf(res: VtexIdResponse): string {
  const payload = res.payload;
  if (!payload) return `HTTP_${res.status}`;

  return (
    payload.authStatus ||
    payload.code ||
    payload.error?.code ||
    (payload.errors ? Object.keys(payload.errors)[0] : "") ||
    `HTTP_${res.status}`
  );
}

function fail(res: VtexIdResponse) {
  const errorCode = errorCodeOf(res);
  return {
    success: false,
    errorCode,
    message: ERROR_MESSAGES[errorCode] ?? GENERIC_ERROR,
  };
}

function ok() {
  return { success: true, errorCode: null, message: null };
}

function failWith(errorCode: string, message: string) {
  return { success: false, errorCode, message };
}

/* -------------------------------------------------------------------------- */
/* passo 1 — start                                                             */
/* -------------------------------------------------------------------------- */

/** Start legacy: token vem no CORPO (`authenticationToken`) e também como `_vss`. */
async function startLegacy(): Promise<VtexIdResponse> {
  return vtexIdFetch(
    `/api/vtexid/pub/authentication/start?scope=${ACCOUNT}&accountName=${ACCOUNT}`,
    { method: "GET" }
  );
}

/** Start authenticator: responde 204 e o token vem SÓ no `Set-Cookie: _vss=`. */
async function startAuthenticator(user: string): Promise<string> {
  const res = await vtexIdFetch(
    `/api/authenticator/pub/authentication/start?an=${ACCOUNT}`,
    {
      method: "POST",
      body: form({
        user,
        scope: ACCOUNT,
        accountName: ACCOUNT,
        returnUrl: "/",
      }),
    }
  );

  return extractVss(res.setCookies);
}

/* -------------------------------------------------------------------------- */
/* resolvers                                                                   */
/* -------------------------------------------------------------------------- */

const vtexIdAuthMethods = async () => {
  const res = await startLegacy();
  const payload = res.payload;

  return {
    password: payload?.showClassicAuthentication ?? true,
    accessKey: payload?.showAccessKeyAuthentication ?? true,
    oauthProviders: (payload?.oauthProviders ?? [])
      .map((provider) => provider?.providerName)
      .filter((name): name is string => Boolean(name)),
  };
};

const vtexIdLoginWithPassword: AuthResolver<{
  email: string;
  password: string;
}> = async (_root, { email, password }, context) => {

  const start = await startLegacy();
  const token = start.payload?.authenticationToken ?? "";

  if (!token) {
    return failWith("InvalidToken", ERROR_MESSAGES.InvalidToken);
  }

  let res = await vtexIdFetch("/api/vtexid/pub/authentication/classic/validate", {
    method: "POST",
    vss: token,
    body: form({ login: email, password }),
  });

  // Contas com "Login with Alternative Keys" recusam a rota legacy.
  // Nesse caso o fluxo inteiro tem que rodar na authenticator.
  const rejectedLegacy =
    res.status === 400 &&
    JSON.stringify(res.payload ?? {}).includes("legacy routes");

  if (rejectedLegacy) {
    const authVss = await startAuthenticator(email);
    if (!authVss) {
      return failWith("InvalidToken", ERROR_MESSAGES.InvalidToken);
    }

    res = await vtexIdFetch(
      `/api/authenticator/pub/authentication/classic/validate?an=${ACCOUNT}`,
      { method: "POST", vss: authVss, body: form({ login: email, password }) }
    );
  }

  if (res.payload?.authStatus !== "Success") {
    return fail(res);
  }

  if (!relayAuthCookies(context, res.setCookies)) {
    return failWith("MissingAuthCookie", GENERIC_ERROR);
  }

  clearVss(context);
  return ok();
};

const vtexIdSendAccessKey: AuthResolver<{ email: string }> = async (
  _root,
  { email },
  context
) => {

  const start = await startLegacy();
  const token = start.payload?.authenticationToken ?? "";

  if (!token) {
    return failWith("InvalidToken", ERROR_MESSAGES.InvalidToken);
  }

  const res = await vtexIdFetch(
    `/api/vtexid/pub/authentication/accesskey/send?email=${encodeURIComponent(
      email
    )}`,
    { method: "POST", vss: token, body: form({ authenticationToken: token }) }
  );

  // Sucesso = corpo vazio. Qualquer `authStatus` no corpo significa FALHA.
  if (!res.ok || res.payload?.authStatus) {
    return fail(res);
  }

  // Sem isto, o código chega no e-mail mas o próximo passo responde WrongCredentials.
  persistVss(context, token);
  return ok();
};

const vtexIdLoginWithAccessKey: AuthResolver<{
  email: string;
  accessKey: string;
}> = async (_root, { email, accessKey }, context) => {
  const vss = readCookie(context, VSS_COOKIE);

  if (!vss) {
    return failWith("InvalidToken", ERROR_MESSAGES.InvalidToken);
  }

  const res = await vtexIdFetch(
    "/api/vtexid/pub/authentication/accesskey/validate",
    {
      method: "POST",
      vss,
      // atenção: aqui o campo é `accesskey` minúsculo; no setpassword é `accessKey`.
      body: form({ login: email, accesskey: accessKey }),
    }
  );

  if (res.payload?.authStatus !== "Success") {
    return fail(res);
  }

  if (!relayAuthCookies(context, res.setCookies)) {
    return failWith("MissingAuthCookie", GENERIC_ERROR);
  }

  clearVss(context);
  return ok();
};

const vtexIdSetPassword: AuthResolver<{
  email: string;
  accessKey: string;
  newPassword: string;
}> = async (_root, { email, accessKey, newPassword }, context) => {
  const vss = readCookie(context, VSS_COOKIE);

  if (!vss) {
    return failWith("InvalidToken", ERROR_MESSAGES.InvalidToken);
  }

  let res: VtexIdResponse | null = null;

  // Usuário recém-criado pode receber 403 com CORPO VAZIO por 1-2s (propagação).
  // Falha real de credencial SEMPRE vem como JSON — por isso só retentamos
  // quando o corpo não é parseável. Teto baixo: o endpoint tem rate limit 10,50.
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await vtexIdFetch(
      "/api/vtexid/pub/authentication/classic/setpassword",
      {
        method: "POST",
        vss,
        // atenção: aqui o campo é `accessKey` camelCase.
        body: form({ login: email, accessKey, newPassword }),
      }
    );

    const isPropagationError = !res.ok && res.payload === null;
    if (!isPropagationError) break;

    await new Promise((resolve) => setTimeout(resolve, 700));
  }

  if (!res || res.payload?.authStatus !== "Success") {
    return res ? fail(res) : failWith("Unknown", GENERIC_ERROR);
  }

  if (!relayAuthCookies(context, res.setCookies)) {
    return failWith("MissingAuthCookie", GENERIC_ERROR);
  }

  clearVss(context);
  return ok();
};

const vtexIdAuthResolvers = {
  Query: {
    vtexIdAuthMethods,
  },
  Mutation: {
    vtexIdLoginWithPassword,
    vtexIdSendAccessKey,
    vtexIdLoginWithAccessKey,
    vtexIdSetPassword,
  },
};

export default vtexIdAuthResolvers;
