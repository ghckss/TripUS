import { act, renderHook, waitFor } from "@testing-library/react-native";
import { defineQuery, queryClient, resourceKey, setAccountScope, setResource } from "./query-client";
import { useResource } from "./use-resource";

let mockFocus: (() => void) | undefined;
jest.mock("expo-router", () => ({ useFocusEffect: (callback: () => void) => { mockFocus = callback; } }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

it("deduplicates concurrent callers and reuses a fresh result", async () => {
  const pending = deferred<string[]>();
  const request = jest.fn(() => pending.promise);
  const list = defineQuery(() => ({ key: "list", request }));
  const first = list(); const second = list();
  pending.resolve(["first"]);
  expect(await first).toEqual(["first"]);
  expect(await second).toEqual(["first"]);
  expect(await list()).toEqual(["first"]);
  expect(request).toHaveBeenCalledTimes(1);
});

it("keeps cached content while a stale screen refreshes and on refresh failure", async () => {
  setResource("list", ["retained"]);
  queryClient.setQueryData(resourceKey("list"), ["retained"], { updatedAt: Date.now() - 120_000 });
  const pending = deferred<string[]>();
  const request = jest.fn(() => pending.promise);
  const list = defineQuery(() => ({ key: "list", request }));
  const { result } = await renderHook(() => useResource(list.options()));
  expect(result.current.data).toEqual(["retained"]);
  expect(result.current.loading).toBe(false);
  expect(result.current.isFetching).toBe(true);
  await act(async () => pending.resolve(["new"]));
  await waitFor(() => expect(result.current.data).toEqual(["new"]));
  request.mockRejectedValueOnce(new Error("offline"));
  await act(async () => { await result.current.refetch(); });
  expect(result.current.data).toEqual(["new"]);
  expect(result.current.loading).toBe(false);
});

it("does not call the network when a fresh screen regains focus", async () => {
  const request = jest.fn().mockResolvedValue(["trip"]);
  const list = defineQuery(() => ({ key: "list", request }));
  const { result } = await renderHook(() => useResource(list.options()));
  await waitFor(() => expect(result.current.data).toEqual(["trip"]));
  await act(async () => { mockFocus?.(); });
  expect(request).toHaveBeenCalledTimes(1);
});

it("does not let an earlier read overwrite a mutation response", async () => {
  const pending = deferred<string>();
  const get = defineQuery(() => ({ key: "trip", request: () => pending.promise }));
  const old = get().catch(() => undefined);
  setResource("trip", "saved");
  pending.resolve("old"); await old;
  expect(queryClient.getQueryData(resourceKey("trip"))).toBe("saved");
});

it("clears all previous-account resources and ignores their late response", async () => {
  setAccountScope("user-a");
  setResource("list", ["private"]);
  const pending = deferred<string[]>();
  const get = defineQuery(() => ({ key: "pending", request: () => pending.promise }));
  const old = get().catch(() => undefined);
  setAccountScope("user-b");
  pending.resolve(["private"]); await old;
  expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  expect(queryClient.getQueryData(resourceKey("list"))).toBeUndefined();
});

it("does not cancel an initial list read when a mutation cannot build a complete list", async () => {
  const pending = deferred<string[]>();
  const list = defineQuery(() => ({ key: "list", request: () => pending.promise }));
  const loading = list();
  setResource<string[]>("list", (current) => current?.filter((id) => id !== "deleted"));
  pending.resolve(["all"]);
  expect(await loading).toEqual(["all"]);
});
