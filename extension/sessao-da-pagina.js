const BANCO = "keyval-store";
const STORE = "keyval";
const CHAVE_SESSAO = "fs::session";
const CHAVE_PRONTIDAO = "faststore_session_ready";

async function limparNaPagina(banco, store, chave, chaveProntidao) {
  const resultado = { limpou: false, tinhaPessoa: false, erro: null };

  try {
    sessionStorage.removeItem(chaveProntidao);
  } catch {
    resultado.erro = null;
  }

  try {
    if (typeof indexedDB.databases === "function") {
      const existentes = await indexedDB.databases();
      if (!existentes.some((d) => d.name === banco)) return resultado;
    }

    const db = await new Promise((ok, erro) => {
      const req = indexedDB.open(banco);
      req.onsuccess = () => ok(req.result);
      req.onerror = () => erro(req.error);
    });

    if (!db.objectStoreNames.contains(store)) {
      db.close();
      return resultado;
    }

    await new Promise((ok, erro) => {
      const tx = db.transaction(store, "readwrite");
      const os = tx.objectStore(store);
      const leitura = os.get(chave);

      leitura.onsuccess = () => {
        const sessao = leitura.result;
        if (!sessao || typeof sessao !== "object") return;

        resultado.tinhaPessoa = Boolean(sessao.person);
        os.put({ ...sessao, person: null, b2b: null, refreshAfter: null }, chave);
        resultado.limpou = true;
      };

      tx.oncomplete = () => ok();
      tx.onerror = () => erro(tx.error);
      tx.onabort = () => erro(tx.error);
    });

    db.close();
  } catch (e) {
    resultado.erro = String(e?.message ?? e);
  }

  return resultado;
}

export async function limparSessaoDaPagina(tabId) {
  try {
    const [saida] = await chrome.scripting.executeScript({
      target: { tabId },
      func: limparNaPagina,
      args: [BANCO, STORE, CHAVE_SESSAO, CHAVE_PRONTIDAO],
    });

    return saida?.result ?? { limpou: false, erro: "sem resposta da página" };
  } catch (e) {
    return { limpou: false, erro: String(e?.message ?? e) };
  }
}
