import NetInfo from "@react-native-community/netinfo";
import { focusManager, onlineManager, QueryClientProvider } from "@tanstack/react-query";
import { type PropsWithChildren, useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import { getSession } from "@/shared/auth/session";
import { readCacheEntries } from "@/shared/offline/cache";
import { getAccountScope, queryClient, resourceKey } from "./query-client";

export function AppQueryProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    void (async () => {
      await getSession();
      const account = getAccountScope();
      const entries = await readCacheEntries();
      if (account === getAccountScope()) for (const entry of entries) {
        if (entry.key.endsWith(":ai-undo")) continue;
        queryClient.setQueryData(resourceKey(entry.key), entry.value, { updatedAt: entry.updatedAt });
      }
    })().catch(() => undefined).finally(() => { if (mounted) setReady(true); });
    const unsubscribe = NetInfo.addEventListener((state) => {
      onlineManager.setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    });
    const subscription = AppState.addEventListener("change", (state) => {
      if (Platform.OS !== "web") focusManager.setFocused(state === "active");
    });
    return () => { mounted = false; unsubscribe(); subscription.remove(); };
  }, []);
  return <QueryClientProvider client={queryClient}>{ready ? children : null}</QueryClientProvider>;
}
