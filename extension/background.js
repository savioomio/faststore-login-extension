/**
 * Service worker — o que fala com o VTEX ID e com o cookie jar do alvo.
 *
 * O popup nao faz rede nem toca em cookie: ele manda mensagem para ca. Isso
 * existe porque o popup MORRE quando voce clica fora dele — e voce vai clicar
 * fora dele, para abrir o e-mail e pegar o codigo. Ver `PENDING`.
 */
import {
  VtexIdError,
  loginWithAccessKey,
  loginWithPassword,
  sendAccessKey,
  start,
} from "./vtexid.js";
import { classificaHost, contaPeloHtml, contaPeloSubdominio } from "./alvo.js";
import { limparSessaoDaPagina } from "./sessao-da-pagina.js";

/**
 * Versao do contrato entre popup e service worker.
 *
 * Existe por uma armadilha do MV3: ao editar os arquivos, o Chrome recarrega o
 * popup na hora, mas o SERVICE WORKER ANTIGO pode continuar vivo. O popup novo
 * conversa com o background velho, os campos nao batem, e a tela mostra
 * "undefined" — que nao parece nem de longe com "recarregue a extensao".
 * Aconteceu de verdade em 2026-08-30.
 *
 * SUBA ESTE NUMERO ao mudar o formato das mensagens.
 */
const PROTOCOLO = 3;

/* -------------------------------------------------------------------------- */
/* a sessao do login em andamento                                              */
/* -------------------------------------------------------------------------- */

/**
 * O `authenticationToken` entre o `send` e o `validate`.
 *
 * Vive em `chrome.storage.session`, que e MEMORIA (nunca vai para o disco e some
 * ao fechar o navegador). Nao e variavel de modulo porque o service worker do
 * MV3 e desligado apos ~30s de ociosidade — e o intervalo entre pedir o codigo e
 * digitar o codigo e justamente voce indo ate o e-mail. Variavel de modulo
 * perderia o token nesse instante, e o sintoma seria um codigo VALIDO
 * respondendo `InvalidToken`.
 */
const PENDING = "pendingLogin";
/** Marca de "acabei de logar", para diagnosticar cookie apagado. Ver `status`. */
const RECEM = "recemLogado";

const setPending = (v) => chrome.storage.session.set({ [PENDING]: v });
const getPending = async () => (await chrome.storage.session.get(PENDING))[PENDING] ?? null;
const clearPending = () => chrome.storage.session.remove(PENDING);

/* -------------------------------------------------------------------------- */
/* deteccao de onde a loja esta                                                */
/* -------------------------------------------------------------------------- */

async function detectAccount(origin, hostname) {
  // Em `.vtex.app` a conta e o subdominio: exato, sem palpite.
  const exata = contaPeloSubdominio(hostname);
  if (exata) return { account: exata, exata: true };

  try {
    const html = await (await fetch(origin, { credentials: "omit" })).text();
    return { account: contaPeloHtml(html), exata: false };
  } catch {
    // Loja fora do ar ou sem HTML util: o campo editavel resolve.
    return { account: "", exata: false };
  }
}

async function detectTarget() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return { ok: false, motivo: "Nenhuma aba ativa." };

  let url;
  try {
    url = new URL(tab.url);
  } catch {
    return { ok: false, motivo: "A aba atual não é um endereço de site." };
  }

  const classe = classificaHost(url.hostname);
  if (!classe.ok) {
    return { ok: false, hostname: url.hostname, motivo: classe.motivo };
  }

  const { ultimo } = await chrome.storage.local.get("ultimo");

  const base = {
    ok: true,
    tabId: tab.id,
    origin: url.origin,
    hostname: url.hostname,
    tipo: classe.tipo,
    rotulo: classe.rotulo,
  };

  // Correcao manual VENCE a deteccao, para esta mesma origem. Sem isto o campo
  // "editavel" nao gruda: voce corrige a conta, a tela se redesenha, a
  // deteccao roda de novo e devolve o palpite errado por cima do seu acerto.
  if (ultimo?.manual && ultimo.origin === url.origin && ultimo.account) {
    return { ...base, account: ultimo.account, origem: "manual" };
  }

  const { account, exata } = await detectAccount(url.origin, url.hostname);

  return {
    ...base,
    account: account || ultimo?.account || "",
    origem: account ? (exata ? "subdominio" : "html") : "desconhecida",
  };
}

/* -------------------------------------------------------------------------- */
/* o cookie                                                                    */
/* -------------------------------------------------------------------------- */

const cookieName = (account) => `VtexIdclientAutCookie_${account}`;

/**
 * Escreve a sessao no alvo.
 *
 * `httpOnly` como a VTEX faz: nenhum codigo de cliente le este cookie por
 * `document.cookie` (conferido no `@faststore/core` — quem le e o servidor, por
 * header). `secure` acompanha o esquema da origem: obrigatorio em `.vtex.app`
 * (https), impossivel em `http://localhost`.
 */
async function injectCookie(origin, account, jwt) {
  await chrome.cookies.set({
    url: origin,
    name: cookieName(account),
    value: jwt,
    path: "/",
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
  });
}

const removeCookie = (origin, account) =>
  chrome.cookies.remove({ url: origin, name: cookieName(account) });

async function readSession(origin, account) {
  const cookie = await chrome.cookies.get({ url: origin, name: cookieName(account) });
  if (!cookie?.value) return null;

  // O JWT e legivel e responde "estou vendo a loja como quem?" — em B2B, a
  // pergunta que hoje so se responde decodificando na mao. Sem chamada de rede.
  const jwt = decodeJwt(cookie.value);
  if (!jwt) return { user: "(sessão ilegível)", expiresIn: null };

  return {
    user: jwt.sub ?? "(sem identificador)",
    account: jwt.account ?? null,
    isRepresentative: jwt.isRepresentative ?? null,
    customerId: jwt.customerId ?? null,
    unitId: jwt.unitId ?? null,
    expiresIn: jwt.exp ? jwt.exp - Math.floor(Date.now() / 1000) : null,
  };
}

function decodeJwt(token) {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

/**
 * Por que a sessao sumiu logo depois de um login que deu certo.
 *
 * ⚠️ Isto acontece em PREVIEW, nunca em local, e a causa esta no framework:
 * numa loja com `experimental.refreshToken: true`, o primeiro `ValidateSession`
 * apos a injecao cai em `firstRefreshRequest` (JWT presente + sessao ainda sem
 * `refreshAfter`) e responde `Unauthorized`; o front entao tenta renovar, falha
 * — o cookie `vid_rt` vive na origem de producao, nao no preview — e chama
 * `logoutAndClearSession`, que APAGA o cookie que acabamos de escrever.
 * (`utils/validateSessionRefreshToken.ts:24-28`, `sdk/account/useRefreshToken.ts`.)
 *
 * Em `localhost` o framework curto-circuita tudo isso de proposito
 * (`utils/isLocalHost.ts`), e por isso o mesmo login sobrevive la.
 *
 * Nao ha o que a extensao possa fazer: a renovacao depende de um cookie de
 * outra origem. O que ela pode fazer e DIZER isso, em vez de deixar o usuario
 * achando que digitou o codigo errado.
 */
function diagnosticoDeSumico(tipo) {
  if (tipo === "preview") {
    return (
      "O login deu certo, mas a loja apagou a sessão logo em seguida. " +
      "Isso acontece em preview quando a loja está com `experimental.refreshToken: true` " +
      "no discovery.config.js — o preview não tem como renovar o token e derruba a sessão. " +
      "Desligue a flag para testar no preview, ou teste em localhost."
    );
  }

  return (
    "O login deu certo, mas a sessão não ficou. Confira se a conta informada é a " +
    "mesma do `api.storeId` no discovery.config.js da loja."
  );
}

/* -------------------------------------------------------------------------- */
/* roteamento de mensagens                                                     */
/* -------------------------------------------------------------------------- */

const acoes = {
  async status() {
    const alvo = await detectTarget();
    if (!alvo.ok) return { protocolo: PROTOCOLO, ...alvo };

    const [sessao, pendente, recem] = await Promise.all([
      alvo.account ? readSession(alvo.origin, alvo.account) : null,
      getPending(),
      chrome.storage.session.get(RECEM).then((r) => r[RECEM] ?? null),
    ]);

    // Logamos ha pouco e a sessao nao esta la: alguem a apagou. Diagnostique.
    const sumiu =
      !sessao &&
      recem &&
      recem.origin === alvo.origin &&
      Date.now() - recem.quando < 60_000;

    if (sumiu) await chrome.storage.session.remove(RECEM);

    return {
      protocolo: PROTOCOLO,
      ...alvo,
      session: sessao,
      pending: pendente?.email ?? null,
      aviso: sumiu ? diagnosticoDeSumico(alvo.tipo) : null,
    };
  },

  /** Abre a sessao do VTEX ID so para saber quais metodos a conta habilita. */
  async methods({ account }) {
    const { methods } = await start(account);
    return { methods };
  },

  async sendCode({ account, email }) {
    const { token } = await start(account);
    await sendAccessKey(account, token, email);

    // Sem guardar o token aqui, o codigo chega no e-mail e o passo seguinte
    // responde InvalidToken. E o bug mais caro deste fluxo.
    await setPending({ token, email, account });
    return { sent: true };
  },

  async loginCode({ origin, account, accessKey, tabId }) {
    const pendente = await getPending();
    if (!pendente?.token) {
      throw new VtexIdError(
        "A sessão do login expirou (10 min) ou o código foi pedido em outra conta. Peça um código novo.",
        "InvalidToken"
      );
    }

    const jwt = await loginWithAccessKey(account, pendente.token, pendente.email, accessKey);
    await finish({ origin, account, jwt, tabId });
    return { user: pendente.email };
  },

  async loginPassword({ origin, account, email, password, tabId }) {
    const { token } = await start(account);
    const jwt = await loginWithPassword(account, token, email, password);
    await finish({ origin, account, jwt, tabId });
    return { user: email };
  },

  async logout({ origin, account, tabId }) {
    await removeCookie(origin, account);

    // ⚠️ Sem isto o cookie some e a INTERFACE CONTINUA LOGADA: o FastStore
    // re-hidrata `person` do IndexedDB no reload. Ver `sessao-da-pagina.js`.
    const limpeza = await limparSessaoDaPagina(tabId);

    await clearPending();
    await chrome.storage.session.remove(RECEM);
    await chrome.tabs.reload(tabId);

    return { done: true, limpeza };
  },

  /** Fixa a conta corrigida na mao para esta origem. Ver `detectTarget`. */
  async setAccount({ origin, account }) {
    await chrome.storage.local.set({ ultimo: { account, origin, manual: true } });
    return { account };
  },

  /** Volta a confiar na deteccao para esta origem. */
  async clearAccount() {
    await chrome.storage.local.remove("ultimo");
    return { done: true };
  },

  async cancel() {
    await clearPending();
    return { done: true };
  },
};

async function finish({ origin, account, jwt, tabId }) {
  await injectCookie(origin, account, jwt);

  // Tambem no login: zera a identidade persistida para que o usuario ANTERIOR
  // nao apareca no intervalo entre o reload e a resposta do `validateSession`.
  // Em troca de usuario isso e visivel.
  await limparSessaoDaPagina(tabId);

  await clearPending();

  // Marca para o `status` saber distinguir "nunca logou" de "logou e a loja
  // apagou" — sao a mesma tela e causas opostas.
  await chrome.storage.session.set({ [RECEM]: { origin, quando: Date.now() } });

  // Guarda so conveniencia: conta e origem. Nada que autentique ninguem (ADR-0003).
  // `manual` e preservado — logar com sucesso nao e motivo para a extensao
  // voltar a achar que sabe a conta melhor que voce.
  const { ultimo } = await chrome.storage.local.get("ultimo");
  await chrome.storage.local.set({
    ultimo: { account, origin, manual: ultimo?.manual === true },
  });

  await chrome.tabs.reload(tabId);
}

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

  return true; // resposta assincrona
});
