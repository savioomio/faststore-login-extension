/**
 * Modal de login B2C (VTEX ID headless).
 *
 * ESTE É O ARQUIVO QUE VOCÊ DEVE CUSTOMIZAR. Todo o markup abaixo é layout —
 * troque à vontade por componentes do `@faststore/ui` ou pelo design da loja.
 * O que NÃO deve mudar: as chamadas do `useVtexIdAuth` e os passos do fluxo.
 */
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLoginModal } from "../../../sdk/loginModal";

import {
  PASSWORD_POLICY,
  useVtexIdAuth,
  type AuthStep,
} from "../../../hooks/useVtexIdAuth";

import styles from "./login-modal.module.scss";

export interface LoginModalProps {
  /** Título do passo de senha. */
  title?: string;
  /** URL da página de cadastro. Passe `null` para esconder o link. */
  signUpUrl?: string | null;
  /** Recarrega a página após autenticar. Default `true`. */
  reloadOnSuccess?: boolean;
  /** Callback após autenticar, antes do reload/redirect. */
  onSuccess?: () => void;
  /** Classe extra no container do modal. */
  className?: string;
}

const STEP_TITLES: Record<AuthStep, string> = {
  password: "Entrar com e-mail e senha",
  accessKey: "Entrar com código de acesso",
  recover: "Recuperar senha",
  newPassword: "Criar nova senha",
};

export default function LoginModal({
  title,
  signUpUrl = "/cadastro",
  reloadOnSuccess = true,
  onSuccess,
  className,
}: LoginModalProps) {
  const { isOpen, redirectTo, close } = useLoginModal();
  const [mounted, setMounted] = useState(false);

  const auth = useVtexIdAuth({ reloadOnSuccess, onSuccess, redirectTo });

  const [password, setPassword] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  // Fecha no ESC e trava o scroll do body enquanto aberto.
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, close]);

  // Reseta o formulário a cada abertura.
  useEffect(() => {
    if (!isOpen) return;

    auth.reset();
    setPassword("");
    setAccessKey("");
    setNewPassword("");
    firstFieldRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  const showAccessKeyLogin = auth.methods?.accessKey ?? false;
  const showPasswordLogin = auth.methods?.password ?? true;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    switch (auth.step) {
      case "password":
        auth.loginWithPassword(auth.email, password);
        break;
      case "recover":
        auth.sendAccessKey(auth.email, "newPassword");
        break;
      case "accessKey":
        auth.loginWithAccessKey(accessKey);
        break;
      case "newPassword":
        auth.setNewPassword(accessKey, newPassword);
        break;
    }
  };

  return createPortal(
    <div
      className={styles.overlay}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        className={`${styles.modal} ${className ?? ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
      >
        <button
          type="button"
          className={styles.closeButton}
          onClick={close}
          aria-label="Fechar"
        >
          ×
        </button>

        <h2 id="login-modal-title" className={styles.title}>
          {auth.step === "password"
            ? title ?? STEP_TITLES.password
            : STEP_TITLES[auth.step as AuthStep]}
        </h2>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {/* e-mail: presente em todos os passos, somente leitura após o envio do código */}
          {(auth.step === "password" ||
            auth.step === "recover" ||
            auth.step === "accessKey") && (
            <label className={styles.field}>
              <span className={styles.label}>E-mail</span>
              <input
                ref={firstFieldRef}
                className={styles.input}
                type="email"
                name="email"
                autoComplete="email"
                placeholder="Digite seu e-mail"
                value={auth.email}
                onChange={(event) => auth.setEmail(event.target.value)}
                disabled={auth.loading || auth.step === "accessKey"}
                required
              />
            </label>
          )}

          {auth.step === "password" && showPasswordLogin && (
            <label className={styles.field}>
              <span className={styles.label}>Senha</span>
              <input
                className={styles.input}
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="Digite sua senha"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={auth.loading}
                required
              />
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => auth.goToStep("recover")}
              >
                Esqueci minha senha
              </button>
            </label>
          )}

          {(auth.step === "accessKey" || auth.step === "newPassword") && (
            <label className={styles.field}>
              <span className={styles.label}>Código de acesso</span>
              <input
                className={styles.input}
                type="text"
                name="accessKey"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={accessKey}
                onChange={(event) =>
                  setAccessKey(event.target.value.replace(/\D/g, ""))
                }
                disabled={auth.loading}
                required
              />
            </label>
          )}

          {auth.step === "newPassword" && (
            <label className={styles.field}>
              <span className={styles.label}>Nova senha</span>
              <input
                className={styles.input}
                type="password"
                name="newPassword"
                autoComplete="new-password"
                placeholder="Digite a nova senha"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                disabled={auth.loading}
                required
              />
              <span className={styles.hint}>{PASSWORD_POLICY}</span>
            </label>
          )}

          {auth.notice && (
            <p className={styles.notice} role="status">
              {auth.notice}
            </p>
          )}
          {auth.error && (
            <p className={styles.error} role="alert">
              {auth.error}
            </p>
          )}

          <button
            type="submit"
            className={styles.submitButton}
            disabled={auth.loading}
          >
            {auth.loading ? "Aguarde..." : submitLabel(auth.step)}
          </button>
        </form>

        {/* alternativas de fluxo */}
        <div className={styles.actions}>
          {auth.step === "password" && showAccessKeyLogin && (
            <button
              type="button"
              className={styles.linkButton}
              onClick={async () => {
                const sent = await auth.sendAccessKey(auth.email, "accessKey");
                if (sent) setAccessKey("");
              }}
              disabled={auth.loading}
            >
              Entrar com código de acesso
            </button>
          )}

          {(auth.step === "accessKey" ||
            auth.step === "newPassword" ||
            auth.step === "recover") && (
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => auth.goToStep("password")}
              disabled={auth.loading}
            >
              Voltar para login com senha
            </button>
          )}

          {auth.step === "password" && signUpUrl && (
            <p className={styles.signUp}>
              Ainda não possui conta?{" "}
              <a className={styles.link} href={signUpUrl}>
                Cadastre-se
              </a>
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function submitLabel(step: AuthStep): string {
  switch (step) {
    case "password":
      return "Entrar";
    case "recover":
      return "Enviar código";
    case "accessKey":
      return "Entrar";
    case "newPassword":
      return "Salvar e entrar";
  }
}
