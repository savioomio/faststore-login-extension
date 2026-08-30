/**
 * Store global de abertura do modal de login.
 *
 * Store de módulo (não React Context) de propósito: qualquer arquivo pode chamar
 * `openLoginModal()` sem depender de onde o Provider foi montado — inclusive
 * fora de componentes React (ex.: handler de erro 401, callback de wishlist).
 */
import { useSyncExternalStore } from "react";

export type LoginModalState = {
  isOpen: boolean;
  /** Para onde navegar após o login. Se ausente, permanece na página atual. */
  redirectTo?: string;
};

const CLOSED: LoginModalState = { isOpen: false };

let state: LoginModalState = CLOSED;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export const loginModalStore = {
  read: () => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function openLoginModal(redirectTo?: string) {
  state = { isOpen: true, redirectTo };
  emit();
}

export function closeLoginModal() {
  if (!state.isOpen) return;
  state = CLOSED;
  emit();
}

export function useLoginModal(): LoginModalState & {
  open: typeof openLoginModal;
  close: typeof closeLoginModal;
} {
  const snapshot = useSyncExternalStore(
    loginModalStore.subscribe,
    loginModalStore.read,
    () => CLOSED
  );

  return { ...snapshot, open: openLoginModal, close: closeLoginModal };
}
