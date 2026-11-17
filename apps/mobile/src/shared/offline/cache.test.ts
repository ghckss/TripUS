import { cachedRequest, readCache, readCacheEntries, writeCache } from "./cache";
import { queryClient, resourceKey, setAccountScope, setResource } from "@/shared/query/query-client";

const mockRows = new Map<string, { key: string; value: string; updated_at: string }>();
jest.mock("expo-sqlite", () => ({ openDatabaseAsync: jest.fn(async () => ({
  execAsync: jest.fn(),
  runAsync: jest.fn(async (_sql: string, key: string, value: string, updated_at: string) => { mockRows.set(key, { key, value, updated_at }); }),
  getFirstAsync: jest.fn(async (_sql: string, key: string) => mockRows.get(key)),
  getAllAsync: jest.fn(async () => [...mockRows.values()]),
})) }));
beforeEach(() => mockRows.clear());
it("isolates persistent snapshots by account and excludes old unscoped entries", async () => {
  mockRows.set("trips:list", { key: "trips:list", value: '["legacy"]', updated_at: new Date().toISOString() });
  setAccountScope("alice"); await writeCache("trips:list", ["alice-trip"]);
  setAccountScope("bob"); expect(await readCache("trips:list")).toBeUndefined();
  expect(await readCacheEntries()).toEqual([]);
  setAccountScope("alice"); expect(await readCache("trips:list")).toEqual(["alice-trip"]);
});
it("restores the original update time so old disk data is still stale", async () => {
  setAccountScope("alice");
  mockRows.set("alice:trips:list", { key: "alice:trips:list", value: '["saved"]', updated_at: "2020-01-01T00:00:00Z" });
  const [entry] = await readCacheEntries();
  expect(entry.updatedAt).toBe(Date.parse("2020-01-01T00:00:00Z"));
  queryClient.setQueryData(resourceKey(entry.key), entry.value, { updatedAt: entry.updatedAt });
  expect(queryClient.getQueryCache().find({ queryKey: resourceKey(entry.key) })?.isStaleByTime(60_000)).toBe(true);
});
it("does not persist a read result after the account changes", async () => {
  setAccountScope("alice");
  let finish!: (data: string[]) => void;
  const pending = cachedRequest("trips:list", () => new Promise<string[]>((resolve) => { finish = resolve; }));
  setAccountScope("bob"); finish(["private"]);
  await expect(pending).rejects.toThrow("Session changed");
  expect(mockRows.size).toBe(0);
});
it("preserves a newer mutation response when an old read finishes late", async () => {
  let finish!: (data: string[]) => void;
  const pending = cachedRequest("trips:list", () => new Promise<string[]>((resolve) => { finish = resolve; }));
  setResource("trips:list", ["saved"]); await writeCache("trips:list", ["saved"]);
  finish(["old"]);
  expect(await pending).toEqual(["saved"]);
  expect(await readCache("trips:list")).toEqual(["saved"]);
});
