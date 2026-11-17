import { setAccountScope } from "@/shared/query/query-client";

import type { components } from "@tripus/api-client";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export type AuthSession = components["schemas"]["AuthSessionDto"];

const SESSION_KEY = "tripus.auth.session";
let memorySession: AuthSession | null | undefined;

export async function getSession(): Promise<AuthSession | null> {
  if (memorySession !== undefined) return memorySession;
  const stored = Platform.OS === "web"
    ? globalThis.localStorage?.getItem(SESSION_KEY) ?? null
    : await SecureStore.getItemAsync(SESSION_KEY);
  memorySession = stored ? JSON.parse(stored) as AuthSession : null;
  setAccountScope(memorySession?.user.id);
  return memorySession;
}

export async function saveSession(session: AuthSession): Promise<void> {
  memorySession = session;
  setAccountScope(session.user.id);
  const serialized = JSON.stringify(session);
  if (Platform.OS === "web") globalThis.localStorage?.setItem(SESSION_KEY, serialized);
  else await SecureStore.setItemAsync(SESSION_KEY, serialized, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
}

export async function clearSession(): Promise<void> {
  memorySession = null;
  setAccountScope();
  if (Platform.OS === "web") globalThis.localStorage?.removeItem(SESSION_KEY);
  else await SecureStore.deleteItemAsync(SESSION_KEY);
}
