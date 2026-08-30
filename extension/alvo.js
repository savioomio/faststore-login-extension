/**
 * Onde a extensao pode agir, e como ela descobre a conta ali.
 *
 * Separado do `background.js` porque a regra de "onde pode" e a coisa mais
 * sensivel da extensao: ela decide em que dominios uma sessao pode ser escrita.
 * Ficando sozinha num arquivo, da para ler a regra inteira de uma vez.
 *
 * Ver `docs/rules/seguranca.md` R-2.
 */

/** Ambientes permitidos, e por que cada um. */
const AMBIENTES = [
  {
    tipo: "local",
    rotulo: "local",
    // O `@faststore/core` trata estes dois de forma especial: pula o fluxo de
    // refresh-token justamente para o cookie injetado sobreviver
    // (`utils/isLocalHost.ts`). E a lista la e FECHADA — nem `0.0.0.0`, nem IP
    // de rede local funcionam, por mais que pareçam equivalentes.
    aceita: (host) => host === "localhost" || host === "127.0.0.1",
  },
  {
    tipo: "preview",
    rotulo: "preview",
    // O preview que se manda para o cliente. Aqui NAO ha o atalho de localhost:
    // se a loja tiver `experimental.refreshToken: true`, o proprio front derruba
    // o cookie injetado no primeiro ValidateSession. Ver `diagnosticoDeSumico`.
    aceita: (host) => host.endsWith(".vtex.app"),
  },
];

/**
 * Dominios explicitamente recusados, com o motivo — para a mensagem de erro
 * poder explicar em vez de so dizer "nao".
 */
const RECUSADOS = [
  {
    aceita: (host) => host.endsWith(".myvtex.com"),
    motivo:
      "é o ambiente da VTEX, onde vive a sua sessão real de admin. Escrever cookie aqui derrubaria o seu próprio login.",
  },
];

export function classificaHost(hostname) {
  const host = (hostname ?? "").toLowerCase();

  for (const ambiente of AMBIENTES) {
    if (ambiente.aceita(host)) {
      return { ok: true, tipo: ambiente.tipo, rotulo: ambiente.rotulo };
    }
  }

  for (const recusado of RECUSADOS) {
    if (recusado.aceita(host)) {
      return { ok: false, motivo: recusado.motivo };
    }
  }

  return {
    ok: false,
    motivo:
      "não é ambiente de desenvolvimento nem preview. A extensão só age em localhost, 127.0.0.1 e *.vtex.app.",
  };
}

/* -------------------------------------------------------------------------- */
/* descoberta da conta                                                         */
/* -------------------------------------------------------------------------- */

/** Subdominios que aparecem no HTML mas nunca sao a conta da loja. */
const NAO_E_CONTA = new Set(["vtex", "starter", "www", "io", "assets"]);

/**
 * Em `.vtex.app` a conta E o subdominio — `boldb2b.vtex.app` → `boldb2b`.
 * Isso e EXATO, nao heuristica, entao vem antes de qualquer palpite.
 *
 * Deploys de branch usam `<algo>--<conta>.vtex.app`; por isso o `split("--")`
 * pega o ULTIMO pedaco.
 */
export function contaPeloSubdominio(hostname) {
  const host = (hostname ?? "").toLowerCase();
  if (!host.endsWith(".vtex.app")) return "";

  const rotulo = host.slice(0, -".vtex.app".length).split("--").pop() ?? "";
  return NAO_E_CONTA.has(rotulo) ? "" : rotulo;
}

/**
 * Descobre a conta contando citacoes dela no HTML servido pela loja.
 *
 * Nao ha campo canonico: o `__NEXT_DATA__` NAO carrega o `storeId` e a loja nao
 * serializa o `discovery.config` (medido em 2026-08-30, no localhost e no
 * preview). O que existe em abundancia sao URLs da conta — CDN de imagem, links
 * para o ambiente IO. Entao conta-se a frequencia e o mais citado vence.
 *
 * Medido: 58 citacoes contra 5 do segundo colocado, e o mesmo resultado no
 * localhost e no preview. Ainda assim e HEURISTICA — por isso o campo no popup
 * e editavel.
 */
export function contaPeloHtml(html) {
  const padroes = [
    /https:\/\/([a-z0-9][a-z0-9-]*)\.vtexassets\.com/g,
    /https:\/\/(?:[a-z0-9-]+--)?([a-z0-9][a-z0-9-]*)\.myvtex\.com/g,
    /https:\/\/([a-z0-9][a-z0-9-]*)\.vtex\.app/g,
    /https:\/\/([a-z0-9][a-z0-9-]*)\.vtexcommercestable\.com\.br/g,
  ];

  const votos = new Map();
  for (const padrao of padroes) {
    for (const [, conta] of html.matchAll(padrao)) {
      if (NAO_E_CONTA.has(conta)) continue;
      votos.set(conta, (votos.get(conta) ?? 0) + 1);
    }
  }

  return [...votos.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}
