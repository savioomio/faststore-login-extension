const AMBIENTES = [
  {
    tipo: "local",
    rotulo: "local",
    aceita: (host) => host === "localhost" || host === "127.0.0.1",
  },
  {
    tipo: "preview",
    rotulo: "preview",
    aceita: (host) => host.endsWith(".vtex.app"),
  },
];

const RECUSADOS = [
  {
    aceita: (host) => host.endsWith(".myvtex.com"),
    motivo: "Este é o painel da VTEX, não a loja.",
  },
];

const FORA_DE_ALCANCE = "Esta aba não é uma loja em ambiente de teste.";

export function classificaHost(hostname) {
  const host = (hostname ?? "").toLowerCase();

  for (const ambiente of AMBIENTES) {
    if (ambiente.aceita(host)) {
      return { ok: true, tipo: ambiente.tipo, rotulo: ambiente.rotulo };
    }
  }

  for (const recusado of RECUSADOS) {
    if (recusado.aceita(host)) return { ok: false, motivo: recusado.motivo };
  }

  return { ok: false, motivo: FORA_DE_ALCANCE };
}

const NAO_E_LOJA = new Set(["vtex", "starter", "www", "io", "assets"]);

export function contaPeloSubdominio(hostname) {
  const host = (hostname ?? "").toLowerCase();
  if (!host.endsWith(".vtex.app")) return "";

  const rotulo = host.slice(0, -".vtex.app".length).split("--").pop() ?? "";
  return NAO_E_LOJA.has(rotulo) ? "" : rotulo;
}

const PADROES_DE_LOJA = [
  /https:\/\/([a-z0-9][a-z0-9-]*)\.vtexassets\.com/g,
  /https:\/\/(?:[a-z0-9-]+--)?([a-z0-9][a-z0-9-]*)\.myvtex\.com/g,
  /https:\/\/([a-z0-9][a-z0-9-]*)\.vtex\.app/g,
  /https:\/\/([a-z0-9][a-z0-9-]*)\.vtexcommercestable\.com\.br/g,
];

export function contaPeloHtml(html) {
  const votos = new Map();

  for (const padrao of PADROES_DE_LOJA) {
    for (const [, loja] of html.matchAll(padrao)) {
      if (NAO_E_LOJA.has(loja)) continue;
      votos.set(loja, (votos.get(loja) ?? 0) + 1);
    }
  }

  return [...votos.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}
