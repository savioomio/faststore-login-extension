/**
 * Popup — so desenha e coleta. Rede e cookie sao do service worker.
 *
 * Regra que nao se quebra aqui: mensagem de erro NUNCA revela se o e-mail existe
 * (R-5). O `WrongCredentials` da VTEX e anti-enumeracao por design; o texto vem
 * pronto do `vtexid.js` e nao deve ser "melhorado" com diagnostico que a
 * plataforma nao deu.
 */

const $ = (id) => document.getElementById(id);

const el = {
  alvo: $("alvo"),
  ambiente: $("ambiente"),
  telaFora: $("tela-fora"),
  foraMotivo: $("fora-motivo"),
  avisoBox: $("aviso"),
  telaConta: $("tela-conta"),
  telaLogado: $("tela-logado"),
  telaEntrar: $("tela-entrar"),
  telaCodigo: $("tela-codigo"),
  conta: $("conta"),
  contaNota: $("conta-nota"),
  sessaoUser: $("sessao-user"),
  sessaoDetalhes: $("sessao-detalhes"),
  email: $("email"),
  senha: $("senha"),
  blocoSenha: $("bloco-senha"),
  metodosNota: $("metodos-nota"),
  codigo: $("codigo"),
  codigoEmail: $("codigo-email"),
  btnEntrar: $("btn-entrar"),
  btnCodigo: $("btn-codigo"),
  btnSair: $("btn-sair"),
  btnVoltar: $("btn-voltar"),
  erro: $("erro"),
  ok: $("ok"),
};

let alvo = null;
let metodos = { password: true, accessKey: true };

/** Tem que bater com o `PROTOCOLO` do background.js. */
const PROTOCOLO = 3;

const RECARREGUE =
  "A extensão foi atualizada mas o processo antigo ainda está rodando. " +
  "Abra chrome://extensions e clique em recarregar (↻) nesta extensão.";

/* -------------------------------------------------------------------------- */

function send(action, payload = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action, ...payload }, (resposta) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (resposta?.error) {
        reject(new Error(resposta.error));
      } else {
        resolve(resposta?.data);
      }
    });
  });
}

function mostrar(secao) {
  for (const s of [el.telaFora, el.telaConta, el.telaLogado, el.telaEntrar, el.telaCodigo]) {
    s.hidden = true;
  }
  if (secao === "fora") el.telaFora.hidden = false;
  if (secao === "logado") {
    el.telaConta.hidden = false;
    el.telaLogado.hidden = false;
  }
  if (secao === "entrar") {
    el.telaConta.hidden = false;
    el.telaEntrar.hidden = false;
  }
  if (secao === "codigo") el.telaCodigo.hidden = false;
}

function erro(texto) {
  el.erro.textContent = texto;
  el.erro.hidden = !texto;
  el.ok.hidden = true;
}

function ok(texto) {
  el.ok.textContent = texto;
  el.ok.hidden = !texto;
  el.erro.hidden = true;
}

function limpaAvisos() {
  el.erro.hidden = true;
  el.ok.hidden = true;
}

/** Diagnóstico longo — fica visível até a próxima leitura de estado. */
function aviso(texto) {
  el.avisoBox.textContent = texto ?? "";
  el.avisoBox.hidden = !texto;
}

/** Roda uma acao com o botao travado — evita duplo clique gastando rate limit. */
async function comBotao(botao, rotulo, fn) {
  const original = botao.textContent;
  botao.disabled = true;
  botao.textContent = rotulo;
  limpaAvisos();
  try {
    await fn();
  } catch (e) {
    erro(e.message);
  } finally {
    botao.disabled = false;
    botao.textContent = original;
  }
}

/* -------------------------------------------------------------------------- */

function formataTempo(segundos) {
  if (segundos === null) return "—";
  if (segundos <= 0) return "expirada";
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
}

function desenhaSessao(sessao) {
  el.sessaoUser.textContent = sessao.user;

  const linhas = [["expira em", formataTempo(sessao.expiresIn)]];
  // Campos so de B2B: respondem "estou vendo a loja como qual organizacao?".
  if (sessao.isRepresentative !== null) {
    linhas.push(["representante", sessao.isRepresentative ? "sim" : "não"]);
  }
  if (sessao.customerId) linhas.push(["organização", sessao.customerId.slice(0, 8) + "…"]);
  if (sessao.unitId) linhas.push(["unidade", sessao.unitId.slice(0, 8) + "…"]);

  el.sessaoDetalhes.replaceChildren(
    ...linhas.flatMap(([rotulo, valor]) => {
      const dt = document.createElement("dt");
      dt.textContent = rotulo;
      const dd = document.createElement("dd");
      dd.textContent = valor;
      return [dt, dd];
    })
  );
}

/**
 * Pergunta a conta quais metodos ela habilita e desenha a UI a partir disso —
 * sem chutar. E o que faz a extensao servir B2C e B2B sem ramificacao (T-007).
 */
async function carregaMetodos(conta) {
  el.metodosNota.textContent = "";
  el.blocoSenha.hidden = true;

  if (!conta) return;

  try {
    const r = await send("methods", { account: conta });
    metodos = r.methods;
  } catch {
    return; // conta errada ou sem rede: a UI fica no default e o erro aparece ao tentar
  }

  el.blocoSenha.hidden = !metodos.password;
  el.btnEntrar.textContent = metodos.accessKey ? "Enviar código" : "Entrar";

  if (!metodos.accessKey && !metodos.password) {
    el.metodosNota.textContent =
      "Esta conta não habilita senha nem código de acesso na loja virtual.";
  } else if (!metodos.accessKey) {
    el.metodosNota.textContent = "Esta conta só aceita senha.";
  } else if (!metodos.password) {
    el.metodosNota.textContent = "Esta conta só aceita código de acesso.";
  }
}

/* -------------------------------------------------------------------------- */

async function atualiza() {
  const estado = await send("status");

  // Service worker velho: os campos não batem e a tela mostraria "undefined".
  if (estado.protocolo !== PROTOCOLO) {
    el.alvo.textContent = "versão desencontrada";
    el.ambiente.hidden = true;
    el.foraMotivo.textContent = RECARREGUE;
    mostrar("fora");
    return;
  }

  if (!estado.ok) {
    el.alvo.textContent = estado.hostname ?? "sem aba";
    el.ambiente.hidden = true;
    const motivo = estado.motivo ?? "não é um alvo válido.";
    el.foraMotivo.textContent = estado.hostname
      ? `${estado.hostname} ${motivo}`
      : motivo;
    mostrar("fora");
    return;
  }

  alvo = estado;
  el.alvo.textContent = estado.origin.replace(/^https?:\/\//, "");
  el.ambiente.textContent = estado.rotulo;
  el.ambiente.dataset.tipo = estado.tipo;
  el.ambiente.hidden = false;

  // Vem do background quando um login deu certo e a loja apagou a sessão.
  aviso(estado.aviso);
  el.conta.value = estado.account;
  el.contaNota.textContent = {
    manual: "definida por você — apague o campo para voltar a detectar",
    subdominio: "lida do endereço do preview — exata",
    html: "detectada na página — edite se estiver errada",
    desconhecida: "não foi possível detectar; informe a conta",
  }[estado.origem];

  // Codigo ja pedido e popup reaberto: retoma exatamente onde parou. E o caminho
  // normal, nao a excecao — voce fechou o popup para ir ao e-mail.
  if (estado.pending) {
    el.codigoEmail.textContent = estado.pending;
    mostrar("codigo");
    el.codigo.focus();
    return;
  }

  if (estado.session) {
    desenhaSessao(estado.session);
    mostrar("logado");
    return;
  }

  mostrar("entrar");
  await carregaMetodos(estado.account);
  el.email.focus();
}

/* -------------------------------------------------------------------------- */

el.conta.addEventListener("change", async () => {
  const conta = el.conta.value.trim();
  if (!alvo) return;

  // Fixa a correcao para esta origem — senao a heuristica a desfaz no proximo
  // desenho da tela.
  if (conta) {
    await send("setAccount", { origin: alvo.origin, account: conta });
  } else {
    await send("clearAccount");
  }

  await atualiza();
});

el.btnEntrar.addEventListener("click", () => {
  const email = el.email.value.trim();
  const senha = el.senha.value;
  const conta = el.conta.value.trim();

  if (!conta) return erro("Informe a conta VTEX.");
  if (!email.includes("@")) return erro("Informe um e-mail válido.");

  // Senha preenchida vence: e o caminho instantaneo, sem ida ao e-mail.
  if (senha) {
    return comBotao(el.btnEntrar, "entrando…", async () => {
      await send("loginPassword", {
        origin: alvo.origin,
        account: conta,
        email,
        password: senha,
        tabId: alvo.tabId,
      });
      el.senha.value = ""; // a senha nao sobrevive ao popup (ADR-0003)
      ok(`Entrou como ${email}. Recarregando a loja…`);
      setTimeout(atualiza, 600);
    });
  }

  if (!metodos.accessKey) {
    return erro("Esta conta não aceita código de acesso. Informe a senha.");
  }

  return comBotao(el.btnEntrar, "enviando…", async () => {
    await send("sendCode", { account: conta, email });
    el.codigoEmail.textContent = email;
    mostrar("codigo");
    el.codigo.focus();
    ok("Código enviado. Ele vale uma vez só.");
  });
});

el.btnCodigo.addEventListener("click", () => {
  const codigo = el.codigo.value.trim();
  if (codigo.length < 6) return erro("Informe os 6 dígitos.");

  return comBotao(el.btnCodigo, "entrando…", async () => {
    const r = await send("loginCode", {
      origin: alvo.origin,
      account: el.conta.value.trim(),
      accessKey: codigo,
      tabId: alvo.tabId,
    });
    ok(`Entrou como ${r.user}. Recarregando a loja…`);
    setTimeout(atualiza, 600);
  });
});

el.btnVoltar.addEventListener("click", async () => {
  await send("cancel");
  el.codigo.value = "";
  await atualiza();
});

el.btnSair.addEventListener("click", () =>
  comBotao(el.btnSair, "saindo…", async () => {
    await send("logout", {
      origin: alvo.origin,
      account: el.conta.value.trim(),
      tabId: alvo.tabId,
    });
    el.email.value = "";
    el.codigo.value = "";
    setTimeout(atualiza, 400);
  })
);

// Enter envia o formulario da vez.
for (const [campo, botao] of [
  [el.email, el.btnEntrar],
  [el.senha, el.btnEntrar],
  [el.codigo, el.btnCodigo],
]) {
  campo.addEventListener("keydown", (e) => {
    if (e.key === "Enter") botao.click();
  });
}

// So digito no campo de codigo.
el.codigo.addEventListener("input", () => {
  el.codigo.value = el.codigo.value.replace(/\D/g, "");
});

atualiza().catch((e) => erro(e.message));
