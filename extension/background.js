import {
  VtexIdError,
  loginWithAccessKey,
  loginWithPassword,
  sendAccessKey,
  start,
} from "./vtexid.js";
import { classificaHost, contaPeloHtml, contaPeloSubdominio } from "./alvo.js";
import { limparSessaoDaPagina } from "./sessao-da-pagina.js";

const PROTOCOLO = 3;
const PENDENTE = "loginEmAndamento";
const RECEM = "recemLogado";
const JANELA_DE_DIAGNOSTICO = 60_000;

const guardaPendente = (v) => chrome.storage.session.set({ [PENDENTE]: v });
const lePendente = async () => (await chrome.storage.session.get(PENDENTE))[PENDENTE] ?? null;
const limpaPendente = () => chrome.storage.session.remove(PENDENTE);

async function descobreLoja(origin, hostname) {
  const exata = contaPeloSubdominio(hostname);
  if (exata) return { account: exata, origem: "subdominio" };

  try {
    const html = await (await fetch(origin, { credentials: "omit" })).text();
    const account = contaPeloHtml(html);
    return { account, origem: account ? "html" : "desconhecida" };
  } catch {
    return { account: "", origem: "desconhecida" };
  }
}

async function detectaAlvo() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return classificaHost("");

  let url;
  try {
    url = new URL(tab.url);
  } catch {
    return { ok: false, motivo: "Esta aba não é uma página de internet." };
  }

  const classe = classificaHost(url.hostname);
  if (!classe.ok) return { ok: false, hostname: url.hostname, motivo: classe.motivo };

  const { ultimo } = await chrome.storage.local.get("ultimo");

  const base = {
    ok: true,
    tabId: tab.id,
    origin: url.origin,
    hostname: url.hostname,
    tipo: classe.tipo,
    rotulo: classe.rotulo,
  };

  if (ultimo?.manual && ultimo.origin === url.origin && ultimo.account) {
    return { ...base, account: ultimo.account, origem: "manual" };
  }

  const { account, origem } = await descobreLoja(url.origin, url.hostname);
  return { ...base, account: account || ultimo?.account || "", origem };
}

const nomeDoCookie = (account) => `VtexIdclientAutCookie_${account}`;

const escreveCookie = (origin, account, jwt) =>
  chrome.cookies.set({
    url: origin,
    name: nomeDoCookie(account),
    value: jwt,
    path: "/",
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
  });

const apagaCookie = (origin, account) =>
  chrome.cookies.remove({ url: origin, name: nomeDoCookie(account) });

function decodificaJwt(token) {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

async function leSessao(origin, account) {
  const cookie = await chrome.cookies.get({ url: origin, name: nomeDoCookie(account) });
  if (!cookie?.value) return null;

  const jwt = decodificaJwt(cookie.value);
  if (!jwt) return { user: "acesso não identificado", expiresIn: null };

  return {
    user: jwt.sub ?? "acesso sem identificador",
    account: jwt.account ?? null,
    isRepresentative: jwt.isRepresentative ?? null,
    customerId: jwt.customerId ?? null,
    unitId: jwt.unitId ?? null,
    expiresIn: jwt.exp ? jwt.exp - Math.floor(Date.now() / 1000) : null,
  };
}

function porQueASessaoSumiu(tipo) {
  if (tipo === "preview") {
    return (
      "O acesso funcionou, mas a loja encerrou a sessão logo depois. " +
      "Isso acontece no endereço de teste quando a loja está com a renovação " +
      "de token ligada (experimental.refreshToken no discovery.config.js). " +
      "Desligue essa opção, ou teste em localhost."
    );
  }

  return (
    "O acesso funcionou, mas a sessão não ficou. Confira se o nome da loja no " +
    "rodapé é o mesmo do api.storeId no discovery.config.js."
  );
}

async function concluiLogin({ origin, account, jwt, tabId }) {
  await escreveCookie(origin, account, jwt);
  await limparSessaoDaPagina(tabId);
  await limpaPendente();
  await chrome.storage.session.set({ [RECEM]: { origin, quando: Date.now() } });

  const { ultimo } = await chrome.storage.local.get("ultimo");
  await chrome.storage.local.set({
    ultimo: { account, origin, manual: ultimo?.manual === true },
  });

  await chrome.tabs.reload(tabId);
}

const acoes = {
  async status() {
    const alvo = await detectaAlvo();
    if (!alvo.ok) return { protocolo: PROTOCOLO, ...alvo };

    const [sessao, pendente, recem] = await Promise.all([
      alvo.account ? leSessao(alvo.origin, alvo.account) : null,
      lePendente(),
      chrome.storage.session.get(RECEM).then((r) => r[RECEM] ?? null),
    ]);

    const sumiu =
      !sessao &&
      recem &&
      recem.origin === alvo.origin &&
      Date.now() - recem.quando < JANELA_DE_DIAGNOSTICO;

    if (sumiu) await chrome.storage.session.remove(RECEM);

    return {
      protocolo: PROTOCOLO,
      ...alvo,
      session: sessao,
      pending: pendente?.email ?? null,
      aviso: sumiu ? porQueASessaoSumiu(alvo.tipo) : null,
    };
  },

  async methods({ account }) {
    const { methods } = await start(account);
    return { methods };
  },

  async sendCode({ account, email }) {
    const { token } = await start(account);
    await sendAccessKey(account, token, email);
    await guardaPendente({ token, email, account });
    return { sent: true };
  },

  async loginCode({ origin, account, accessKey, tabId }) {
    const pendente = await lePendente();
    if (!pendente?.token) {
      throw new VtexIdError(
        "O código expirou. Peça um novo e tente de novo.",
        "InvalidToken"
      );
    }

    const jwt = await loginWithAccessKey(account, pendente.token, pendente.email, accessKey);
    await concluiLogin({ origin, account, jwt, tabId });
    return { user: pendente.email };
  },

  async loginPassword({ origin, account, email, password, tabId }) {
    const { token } = await start(account);
    const jwt = await loginWithPassword(account, token, email, password);
    await concluiLogin({ origin, account, jwt, tabId });
    return { user: email };
  },

  async logout({ origin, account, tabId }) {
    await apagaCookie(origin, account);
    const limpeza = await limparSessaoDaPagina(tabId);
    await limpaPendente();
    await chrome.storage.session.remove(RECEM);
    await chrome.tabs.reload(tabId);
    return { done: true, limpeza };
  },

  async setAccount({ origin, account }) {
    await chrome.storage.local.set({ ultimo: { account, origin, manual: true } });
    return { account };
  },

  async clearAccount() {
    await chrome.storage.local.remove("ultimo");
    return { done: true };
  },

  async cancel() {
    await limpaPendente();
    return { done: true };
  },
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const acao = acoes[msg?.action];

  if (!acao) {
    sendResponse({ error: `ação desconhecida: ${msg?.action}` });
    return false;
  }

  acao(msg)
    .then((data) => sendResponse({ data }))
    .catch((erro) =>
      sendResponse({ error: erro?.message ?? "Erro inesperado.", code: erro?.code ?? null })
    );

  return true;
});
