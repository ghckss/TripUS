import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { queryClient, resourceKey } from "./query-client";

/** Screen focus checks freshness, so returning to a fresh screen performs no request. */
export function useResource<Data>(options: UseQueryOptions<Data, Error, Data>) {
  const query = useQuery(options, queryClient);
  const key = JSON.stringify(options.queryKey);
  useFocusEffect(useCallback(() => {
    if (options.enabled !== false) void queryClient.fetchQuery(options).catch(() => undefined);
    // A stable resource key owns the request; changing observer state must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, options.enabled]));
  return { ...query, loading: query.isPending && query.data === undefined };
}

export function useApiQuery<Data, Args extends unknown[]>(
  key: string,
  load: ((...args: Args) => Promise<Data>) & { options?: (...args: Args) => UseQueryOptions<Data, Error, Data> },
  ...args: Args
) {
  return useResource(load.options ? load.options(...args) : {
    queryKey: resourceKey(key), queryFn: () => load(...args),
  });
}
