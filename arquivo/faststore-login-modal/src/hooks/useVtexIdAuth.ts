/**
 * Máquina de estados do login B2C via VTEX ID.
 *
 * Toda a regra de negócio vive aqui. O componente de UI só consome:
 * não replique validação, chamada de mutation nem tratamento de erro no JSX.
 */
import { gql } from "@faststore/core/api";
import { useCallback, useEffect, useState } from "react";
// Arquivos do projeto consumidor (não vêm neste componente).
// Caminho relativo funciona porque a estrutura de pastas é espelhada.
import { request } from "../sdk/graphql/request";
import { sessionStore } from "../sdk/session";

export type AuthStep =
  /** e-mail + senha (tela principal) */
  | "password"
  /** código de 6 dígitos — login passwordless */
  | "accessKey"
  /** informar e-mail para receber o código */
  | "recover"
  /** código + nova senha (1º acesso e "esqueci minha senha") */
  | "newPassword";

export type AuthMethods = {
  password: boolean;
  accessKey: boolean;
  oauthProviders: string[];
};

type AuthResult = {
  success: boolean;
  errorCode: string | null;
  message: string | null;
};

const authMethodsQuery = gql(`
  query VtexIdAuthMethods {
    vtexIdAuthMethods {
      password
      accessKey
      oauthProviders
    }
  }
`);

const loginWithPasswordMutation = gql(`
  mutation VtexIdLoginWithPassword($email: String!, $password: String!) {
    vtexIdLoginWithPassword(email: $email, password: $password) {
      success
      errorCode
      message
    }
  }
`);

const sendAccessKeyMutation = gql(`
  mutation VtexIdSendAccessKey($email: String!) {
    vtexIdSendAccessKey(email: $email) {
      success
      errorCode
      message
    }
  }
`);

const loginWithAccessKeyMutation = gql(`
  mutation VtexIdLoginWithAccessKey($email: String!, $accessKey: String!) {
    vtexIdLoginWithAccessKey(email: $email, accessKey: $accessKey) {
      success
      errorCode
      message
    }
  }
`);

const setPasswordMutation = gql(`
  mutation VtexIdSetPassword(
    $email: String!
    $accessKey: String!
    $newPassword: String!
  ) {
    vtexIdSetPassword(
      email: $email
      accessKey: $accessKey
      newPassword: $newPassword
    ) {
      success
      errorCode
      message
    }
  }
`);

/** Política oficial da VTEX: 8+ caracteres, 1 número, 1 maiúscula, 1 minúscula. */
export const PASSWORD_POLICY =
  "Mínimo de 8 caracteres, com 1 número, 1 letra maiúscula e 1 minúscula.";

export function isValidPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[0-9]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password)
  );
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

const CONNECTION_ERROR = "Erro de conexão. Tente novamente.";

export type UseVtexIdAuthOptions = {
  /**
   * Recarrega a página após autenticar. Default `true`.
   *
   * O reload é o caminho mais seguro: renova sessão, carrinho, preços por perfil
   * e qualquer estado server-side de uma vez. Passe `false` só se o seu layout
   * precisar de uma transição sem reload — nesse caso a sessão é revalidada via
   * `sessionStore`, mas dados já renderizados no servidor continuam antigos.
   */
  reloadOnSuccess?: boolean;
  /** Chamado após autenticar, antes do reload/redirect. */
  onSuccess?: () => void;
  /** URL para onde navegar após autenticar. Sobrepõe o reload. */
  redirectTo?: string;
};

export function useVtexIdAuth(options: UseVtexIdAuthOptions = {}) {
  const { reloadOnSuccess = true, onSuccess, redirectTo } = options;

  const [step, setStep] = useState<AuthStep>("password");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [methods, setMethods] = useState<AuthMethods | null>(null);

  // Descobre os métodos habilitados na conta para renderizar a UI sem chutar.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await request<{ vtexIdAuthMethods: AuthMethods }>(
          authMethodsQuery,
          {}
        );
        if (!cancelled && data?.vtexIdAuthMethods) {
          setMethods(data.vtexIdAuthMethods);
        }
      } catch {
        // Falha aqui não bloqueia o login: a UI cai no default (senha habilitada).
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const finish = useCallback(() => {
    onSuccess?.();

    if (redirectTo) {
      window.location.assign(redirectTo);
      return;
    }

    if (reloadOnSuccess) {
      window.location.reload();
      return;
    }

    // Revalida a sessão sem reload (person, e-mail, perfil de preço).
    sessionStore.set({ ...sessionStore.read() });
  }, [onSuccess, redirectTo, reloadOnSuccess]);

  const run = useCallback(
    async (
      operation: Parameters<typeof request>[0],
      variables: Record<string, string>,
      fieldName: string
    ): Promise<AuthResult> => {
      setLoading(true);
      setError(null);
      setNotice(null);

      try {
        const data = await request<Record<string, AuthResult>>(
          operation,
          variables
        );
        const result = data?.[fieldName];

        if (!result?.success) {
          setError(result?.message ?? CONNECTION_ERROR);
          return result ?? { success: false, errorCode: null, message: null };
        }

        return result;
      } catch {
        setError(CONNECTION_ERROR);
        return { success: false, errorCode: "NetworkError", message: null };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loginWithPassword = useCallback(
    async (userEmail: string, password: string) => {
      if (!isValidEmail(userEmail)) {
        setError("Informe um e-mail válido.");
        return false;
      }
      if (!password) {
        setError("Informe sua senha.");
        return false;
      }

      setEmail(userEmail);
      const result = await run(
        loginWithPasswordMutation,
        { email: userEmail.trim(), password },
        "vtexIdLoginWithPassword"
      );

      if (result.success) finish();
      return result.success;
    },
    [finish, run]
  );

  /** Envia o código. `nextStep` decide se é login passwordless ou redefinição de senha. */
  const sendAccessKey = useCallback(
    async (userEmail: string, nextStep: AuthStep = "newPassword") => {
      if (!isValidEmail(userEmail)) {
        setError("Informe um e-mail válido.");
        return false;
      }

      setEmail(userEmail);
      const result = await run(
        sendAccessKeyMutation,
        { email: userEmail.trim() },
        "vtexIdSendAccessKey"
      );

      if (result.success) {
        setStep(nextStep);
        setNotice(`Enviamos um código de 6 dígitos para ${userEmail.trim()}.`);
      }

      return result.success;
    },
    [run]
  );

  const loginWithAccessKey = useCallback(
    async (accessKey: string) => {
      if (accessKey.trim().length < 6) {
        setError("Informe o código de 6 dígitos.");
        return false;
      }

      const result = await run(
        loginWithAccessKeyMutation,
        { email: email.trim(), accessKey: accessKey.trim() },
        "vtexIdLoginWithAccessKey"
      );

      if (result.success) finish();
      return result.success;
    },
    [email, finish, run]
  );

  const setNewPassword = useCallback(
    async (accessKey: string, newPassword: string) => {
      if (accessKey.trim().length < 6) {
        setError("Informe o código de 6 dígitos.");
        return false;
      }
      if (!isValidPassword(newPassword)) {
        setError(PASSWORD_POLICY);
        return false;
      }

      const result = await run(
        setPasswordMutation,
        {
          email: email.trim(),
          accessKey: accessKey.trim(),
          newPassword,
        },
        "vtexIdSetPassword"
      );

      if (result.success) finish();
      return result.success;
    },
    [email, finish, run]
  );

  const goToStep = useCallback((next: AuthStep) => {
    setError(null);
    setNotice(null);
    setStep(next);
  }, []);

  const reset = useCallback(() => {
    setStep("password");
    setEmail("");
    setError(null);
    setNotice(null);
    setLoading(false);
  }, []);

  return {
    /** Passo atual do fluxo. */
    step,
    /** Troca de passo limpando erro/aviso. */
    goToStep,
    /** E-mail informado, preservado entre os passos. */
    email,
    setEmail,
    loading,
    /** Mensagem de erro pt-BR pronta para exibir. */
    error,
    /** Mensagem informativa (ex.: "enviamos um código..."). */
    notice,
    /** Métodos habilitados na conta. `null` enquanto carrega. */
    methods,
    loginWithPassword,
    sendAccessKey,
    loginWithAccessKey,
    setNewPassword,
    reset,
  };
}
