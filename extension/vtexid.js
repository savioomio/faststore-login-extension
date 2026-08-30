const base = (account) => `https://${account}.myvtex.com`;

async function call(account, path, body) {
  const response = await fetch(`${base(account)}${path}`, {
    method: body === undefined ? "GET" : "POST",
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

  let payload = null;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = null;
  }

  return { ok: response.ok, status: response.status, payload };
}

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

export async function start(account) {
  const res = await call(
    account,
    `/api/vtexid/pub/authentication/start?scope=${account}&accountName=${account}`
  );

  const token = res.payload?.authenticationToken ?? "";
  if (!token) {
    throw new VtexIdError(
      "Não encontramos esta loja. Confira o nome dela no rodapé.",
      errorCodeOf(res)
    );
  }

  return {
    token,
    methods: {
      password: res.payload?.showClassicAuthentication ?? false,
      accessKey: res.payload?.showAccessKeyAuthentication ?? false,
    },
  };
}

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

export async function loginWithAccessKey(account, token, email, accessKey) {
  return authenticate(
    account,
    "/api/vtexid/pub/authentication/accesskey/validate",
    { authenticationToken: token, login: email, accesskey: accessKey },
    "codigo"
  );
}

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

  const jwt = res.payload?.authCookie?.Value;
  if (!jwt) {
    throw new VtexIdError(
      "A loja autenticou mas não devolveu o acesso. Tente de novo.",
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

const MESSAGES = {
  WrongCredentials: {
    codigo:
      "Não deu certo. Cada código vale uma única vez — se já usou este, peça um novo.",
    senha: "E-mail ou senha incorretos.",
    "": "Não deu certo. Confira os dados e tente de novo.",
  },
  InvalidAccessKey: "Código inválido ou expirado. Peça um novo.",
  InvalidToken: "O código expirou. Peça um novo e tente de novo.",
  InvalidEmail: "Digite um e-mail válido.",
  BlockedUser: "Muitas tentativas seguidas. Aguarde de 15 a 30 minutos.",
  HTTP_401:
    "Muitas tentativas seguidas: a loja bloqueou este acesso por 15 a 30 minutos. " +
    "Espere antes de tentar de novo — tentar agora só renova o bloqueio.",
  BlockedHostDomain: "Digite um e-mail válido, com @.",
  InvalidB2BClaims: "Esta conta não tem acesso à loja. Fale com o administrador.",
};

const GENERICA = "Não foi possível concluir. Tente de novo em alguns instantes.";

export function messageFor(code, contexto = "") {
  const entrada = MESSAGES[code];
  if (!entrada) return GENERICA;
  if (typeof entrada === "string") return entrada;
  return entrada[contexto] ?? entrada[""];
}
