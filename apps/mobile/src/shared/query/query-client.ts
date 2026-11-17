import { QueryClient, queryOptions } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, gcTime: 30 * 60_000, retry: false },
    mutations: { retry: false },
  },
});
let accountScope = "anonymous";
export function getAccountScope() { return accountScope; }
export function setAccountScope(userId?: string) {
  const next = userId ?? "anonymous";
  if (next === accountScope) return;
  accountScope = next;
  queryClient.clear();
}
export function resourceKey(key: string): readonly unknown[] { return ["account", accountScope, key] as const; }

/** One raw query function shared by React observers and imperative form workflows. */
export function defineQuery<Args extends unknown[], Data>(
  factory: (...args: Args) => { key: string; request: () => Promise<Data>; staleTime?: number },
) {
  const options = (...args: Args) => {
    const { key, request, staleTime } = factory(...args);
    return queryOptions({ queryKey: resourceKey(key), queryFn: request, ...(staleTime !== undefined ? { staleTime } : {}) });
  };
  return Object.assign((...args: Args) => queryClient.fetchQuery(options(...args)), { options });
}
export function setResource<Data>(key: string, value: Data | ((previous: Data | undefined) => Data | undefined)) {
  const queryKey = resourceKey(key);
  const next = typeof value === "function"
    ? (value as (previous: Data | undefined) => Data | undefined)(queryClient.getQueryData<Data>(queryKey))
    : value;
  // A list that has not loaded yet must finish its original request.
  if (next === undefined) return undefined;
  void queryClient.cancelQueries({ queryKey, exact: true }, { silent: true });
  return queryClient.setQueryData<Data>(queryKey, next);
}
export function invalidateResource(key: string) {
  return queryClient.invalidateQueries({ queryKey: resourceKey(key) });
}
export function removeResources(prefix: string) {
  const childPrefix = prefix.endsWith(":") ? prefix : `${prefix}:`;
  queryClient.removeQueries({ predicate: (query) => query.queryKey[1] === accountScope
    && (query.queryKey[2] === prefix || String(query.queryKey[2]).startsWith(childPrefix)) });
}
