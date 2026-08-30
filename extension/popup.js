const PROTOCOLO = 3;
const SEGUNDOS_PARA_REENVIAR = 30;

const $ = (id) => document.getElementById(id);

const el = {
  ambiente: $("ambiente"),
  telaFora: $("tela-fora"),
  telaEmail: $("tela-email"),
  telaCodigo: $("tela-codigo"),
  telaConectado: $("tela-conectado"),
  foraMotivo: $("fora-motivo"),
  email: $("email"),
  senha: $("senha"),
  blocoSenha: $("bloco-senha"),
  codigo: $("codigo"),
  codigoEmail: $("codigo-email"),
  conta: $("conta"),
  campoLoja: $("campo-loja"),
  lojaNome: $("loja-nome"),
  rodape: $("rodape"),
  sessaoUser: $("sessao-user"),
  sessaoDetalhes: $("sessao-detalhes"),
  btnEnviar: $("btn-enviar"),
  btnEntrar: $("btn-entrar"),
  btnSair: $("btn-sair"),
  btnVoltar: $("btn-voltar"),
  btnReenviar: $("btn-reenviar"),
  btnAlternar: $("btn-alternar"),
  btnEditarLoja: $("btn-editar-loja"),
  erro: $("erro"),
  ok: $("ok"),
  aviso: $("aviso"),
  avisoTitulo: $("aviso-titulo"),
  avisoTexto: $("aviso-texto"),
};

let alvo = null;
let metodos = { password: false, accessKey: true };
let modoSenha = false;
let contadorReenvio = null;

const RECARREGUE =
  "A extensão foi atualizada. Abra chrome://extensions e clique em recarregar nela.";

function send(action, payload = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action, ...payload }, (resposta) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else if (resposta?.error) reject(new Error(resposta.error));
      else resolve(resposta?.data);
    });
  });
}

function mostrar(tela) {
  for (const t of [el.telaFora, el.telaEmail, el.telaCodigo, el.telaConectado]) {
    t.hidden = true;
  }
  tela.hidden = false;
  el.rodape.hidden = tela === el.telaFora;
}

function erro(texto) {
  el.erro.textContent = texto ?? "";
  el.erro.hidden = !texto;
  el.ok.hidden = true;
}

function sucesso(texto) {
  el.ok.textContent = texto ?? "";
  el.ok.hidden = !texto;
  el.erro.hidden = true;
}

function limpaFaixas() {
  el.erro.hidden = true;
  el.ok.hidden = true;
}

function aviso(texto) {
  el.aviso.hidden = !texto;
  if (!texto) return;
  el.avisoTitulo.textContent = "A loja encerrou a sessão";
  el.avisoTexto.textContent = texto;
  el.aviso.open = false;
}

async function comCarregando(botao, textoOcupado, fn) {
  const rotulo = botao.querySelector(".rotulo");
  const icone = botao.querySelector(".ic-acao");
  const spinner = botao.querySelector(".girando");
  const textoOriginal = rotulo?.textContent;

  botao.disabled = true;
  botao.classList.add("ocupado");
  icone?.toggleAttribute("hidden", true);
  spinner?.toggleAttribute("hidden", false);
  if (rotulo) rotulo.textContent = textoOcupado;
  limpaFaixas();

  try {
    await fn();
  } catch (e) {
    erro(e.message);
  } finally {
    botao.disabled = false;
    botao.classList.remove("ocupado");
    icone?.toggleAttribute("hidden", false);
    spinner?.toggleAttribute("hidden", true);
    if (rotulo && textoOriginal) rotulo.textContent = textoOriginal;
  }
}

function tempoLegivel(segundos) {
  if (segundos === null) return "—";
  if (segundos <= 0) return "expirada";
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
}

function desenhaSessao(sessao) {
  el.sessaoUser.textContent = sessao.user;

  const linhas = [["acesso expira em", tempoLegivel(sessao.expiresIn)]];
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

function aplicaModo() {
  const soSenha = metodos.password && !metodos.accessKey;
  const ambos = metodos.password && metodos.accessKey;
  modoSenha = modoSenha || soSenha;

  el.blocoSenha.hidden = !modoSenha;
  el.btnEnviar.querySelector(".rotulo").textContent = modoSenha
    ? "Entrar"
    : "Enviar código";
  el.btnEnviar.querySelector(".ic-acao use").setAttribute("href", modoSenha ? "#i-check" : "#i-send");

  el.btnAlternar.hidden = !ambos;
  el.btnAlternar.textContent = modoSenha
    ? "Prefiro receber um código por e-mail"
    : "Prefiro entrar com minha senha";
}

async function carregaMetodos(conta) {
  if (!conta) return;
  try {
    const r = await send("methods", { account: conta });
    metodos = r.methods;
  } catch {
    metodos = { password: true, accessKey: true };
  }
  aplicaModo();
}

function iniciaContagem() {
  clearInterval(contadorReenvio);
  let restam = SEGUNDOS_PARA_REENVIAR;

  const tique = () => {
    if (restam > 0) {
      el.btnReenviar.disabled = true;
      el.btnReenviar.textContent = `Reenviar em ${restam}s`;
      restam -= 1;
    } else {
      clearInterval(contadorReenvio);
      el.btnReenviar.disabled = false;
      el.btnReenviar.textContent = "Não recebeu? Reenviar";
    }
  };

  tique();
  contadorReenvio = setInterval(tique, 1000);
}

async function atualiza() {
  const estado = await send("status");

  if (estado.protocolo !== PROTOCOLO) {
    el.ambiente.hidden = true;
    el.foraMotivo.textContent = RECARREGUE;
    mostrar(el.telaFora);
    return;
  }

  if (!estado.ok) {
    el.ambiente.hidden = true;
    el.foraMotivo.textContent =
      estado.motivo ?? "Esta aba não é uma loja em ambiente de teste.";
    mostrar(el.telaFora);
    return;
  }

  alvo = estado;
  el.ambiente.textContent = estado.rotulo;
  el.ambiente.dataset.tipo = estado.tipo;
  el.ambiente.hidden = false;

  el.conta.value = estado.account;
  el.lojaNome.textContent = estado.account || "loja não identificada";
  el.campoLoja.hidden = Boolean(estado.account);

  aviso(estado.aviso);

  if (estado.pending) {
    el.codigoEmail.textContent = estado.pending;
    mostrar(el.telaCodigo);
    iniciaContagem();
    el.codigo.focus();
    return;
  }

  if (estado.session) {
    desenhaSessao(estado.session);
    mostrar(el.telaConectado);
    return;
  }

  mostrar(el.telaEmail);
  await carregaMetodos(estado.account);
  el.email.focus();
}

async function pedirCodigo(email, conta) {
  await send("sendCode", { account: conta, email });
  el.codigoEmail.textContent = email;
  el.codigo.value = "";
  mostrar(el.telaCodigo);
  iniciaContagem();
  el.codigo.focus();
  sucesso("Código enviado. Ele vale por uma única vez.");
}

async function concluir(mensagem) {
  sucesso(mensagem);
  setTimeout(atualiza, 700);
}

el.btnEnviar.addEventListener("click", () => {
  const email = el.email.value.trim();
  const conta = el.conta.value.trim();

  if (!conta) return erro("Informe qual é a loja no rodapé.");
  if (!email.includes("@")) return erro("Digite um e-mail válido.");

  return comCarregando(el.btnEnviar, modoSenha ? "Entrando…" : "Enviando…", async () => {
    if (modoSenha) {
      if (!el.senha.value) throw new Error("Digite sua senha.");
      await send("loginPassword", {
        origin: alvo.origin,
        account: conta,
        email,
        password: el.senha.value,
        tabId: alvo.tabId,
      });
      el.senha.value = "";
      return concluir("Conectado. Atualizando a loja…");
    }
    return pedirCodigo(email, conta);
  });
});

el.btnEntrar.addEventListener("click", () => {
  const codigo = el.codigo.value.trim();
  if (codigo.length < 6) return erro("O código tem 6 dígitos.");

  return comCarregando(el.btnEntrar, "Entrando…", async () => {
    await send("loginCode", {
      origin: alvo.origin,
      account: el.conta.value.trim(),
      accessKey: codigo,
      tabId: alvo.tabId,
    });
    return concluir("Conectado. Atualizando a loja…");
  });
});

el.btnReenviar.addEventListener("click", async () => {
  el.btnReenviar.disabled = true;
  el.btnReenviar.textContent = "Enviando…";
  limpaFaixas();

  try {
    await pedirCodigo(el.codigoEmail.textContent, el.conta.value.trim());
  } catch (e) {
    erro(e.message);
    el.btnReenviar.disabled = false;
    el.btnReenviar.textContent = "Não recebeu? Reenviar";
  }
});

el.btnVoltar.addEventListener("click", async () => {
  clearInterval(contadorReenvio);
  await send("cancel");
  el.codigo.value = "";
  await atualiza();
});

el.btnSair.addEventListener("click", () =>
  comCarregando(el.btnSair, "Saindo…", async () => {
    await send("logout", {
      origin: alvo.origin,
      account: el.conta.value.trim(),
      tabId: alvo.tabId,
    });
    el.email.value = "";
    el.codigo.value = "";
    return concluir("Você saiu da conta.");
  })
);

el.btnAlternar.addEventListener("click", () => {
  modoSenha = !modoSenha;
  limpaFaixas();
  aplicaModo();
  (modoSenha ? el.senha : el.email).focus();
});

el.btnEditarLoja.addEventListener("click", () => {
  el.campoLoja.hidden = !el.campoLoja.hidden;
  if (!el.campoLoja.hidden) el.conta.focus();
});

el.conta.addEventListener("change", async () => {
  const conta = el.conta.value.trim();
  if (!alvo) return;
  await send(conta ? "setAccount" : "clearAccount", { origin: alvo.origin, account: conta });
  await atualiza();
});

el.codigo.addEventListener("input", () => {
  el.codigo.value = el.codigo.value.replace(/\D/g, "").slice(0, 6);
  if (el.codigo.value.length === 6) el.btnEntrar.click();
});

for (const [campo, botao] of [
  [el.email, el.btnEnviar],
  [el.senha, el.btnEnviar],
  [el.conta, el.btnEnviar],
]) {
  campo.addEventListener("keydown", (e) => {
    if (e.key === "Enter") botao.click();
  });
}

atualiza().catch((e) => erro(e.message));
