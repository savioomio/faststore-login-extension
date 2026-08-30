/**
 * A sessao que o FastStore guarda NO NAVEGADOR, fora do cookie.
 *
 * ┌─ POR QUE ISTO EXISTE ──────────────────────────────────────────────────────┐
 * │ Apagar o cookie NAO desloga a interface. O FastStore persiste a sessao      │
 * │ inteira — inclusive `person` — no IndexedDB, e re-hidrata dali no reload.   │
 * │ Resultado: sem cookie nenhum, a loja continua mostrando "Minha conta", o    │
 * │ botao de favoritos continua se achando logado, e QUALQUER acao falha.       │
 * │                                                                            │
 * │ E pior que um bug de tela: parece que a extensao nao deslogou.             │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * Onde fica (medido em 2026-08-30, `@faststore/sdk` com `idb-keyval` 6.2.5):
 *
 *   banco IndexedDB   keyval-store      (padrao do idb-keyval)
 *   object store      keyval            (idem)
 *   chave da sessao   fs::session       (`createSessionStore`, 3o argumento)
 *   chave do carrinho fs::cart          (`createCartStore`)
 *
 * Ver `docs/reference/faststore-sessao.md`.
 */

const BANCO = "keyval-store";
const STORE = "keyval";
const CHAVE_SESSAO = "fs::session";

/**
 * Roda DENTRO da pagina (via `chrome.scripting.executeScript`).
 *
 * Precisa ser autocontida: nao enxerga nada do escopo da extensao, so os
 * argumentos que recebe. Por isso os nomes vao por parametro.
 *
 * O que ela faz e exatamente o que o `logoutAndClearSession` do framework faz
 * (`@faststore/core/src/sdk/session/index.ts:219`): zera `person`, `b2b` e
 * `refreshAfter` e PRESERVA o resto. Apagar a sessao inteira tambem funcionaria
 * para deslogar, mas levaria junto o CEP, o locale e o canal de venda — o
 * desenvolvedor perderia a regiao que acabou de configurar a cada troca de
 * usuario, e isso e mais irritante do que o problema original.
 */
async function limparNaPagina(banco, store, chave, chaveProntidao) {
  const resultado = { limpou: false, tinhaPessoa: false, erro: null };

  try {
    // A flag de "sessao ja validada" existe so para a UI nao piscar. Mantida,
    // ela faz a tela renderizar na hora com o que estiver no store — inclusive
    // o usuario velho, no instante anterior ao `validateSession` responder.
    sessionStorage.removeItem(chaveProntidao);
  } catch {
    // Navegador com storage bloqueado: segue, nao e essencial.
  }

  try {
    // `databases()` evita CRIAR um banco vazio quando a loja nunca o escreveu.
    if (typeof indexedDB.databases === "function") {
      const existentes = await indexedDB.databases();
      if (!existentes.some((d) => d.name === banco)) return resultado;
    }

    const db = await new Promise((ok, erro) => {
      const req = indexedDB.open(banco);
      req.onsuccess = () => ok(req.result);
      req.onerror = () => erro(req.error);
      // Sem `onupgradeneeded`: nao e papel desta extensao criar o esquema.
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

/** Chave da flag de prontidao (`@faststore/core/src/sdk/session/storageKeys.ts`). */
const CHAVE_PRONTIDAO = "faststore_session_ready";

/**
 * Zera a identidade na sessao persistida da aba.
 *
 * Chamada no LOGOUT (senao a interface nao desloga) e tambem no LOGIN — ali
 * para que um usuario anterior nao apareca no instante entre o reload e a
 * resposta do `validateSession`. Em troca de usuario isso e visivel.
 *
 * Nunca lanca: falhar aqui nao pode impedir o cookie de ser escrito ou apagado,
 * que e a parte que realmente importa.
 */
export async function limparSessaoDaPagina(tabId) {
  try {
    const [saida] = await chrome.scripting.executeScript({
      target: { tabId },
      func: limparNaPagina,
      args: [BANCO, STORE, CHAVE_SESSAO, CHAVE_PRONTIDAO],
    });

    return saida?.result ?? { limpou: false, erro: "sem resposta da página" };
  } catch (e) {
    // Aba em chrome://, devtools ou pagina sem permissao: degrada calado.
    return { limpou: false, erro: String(e?.message ?? e) };
  }
}
