import { getAccountScope, queryClient, resourceKey } from "@/shared/query/query-client";
import * as SQLite from "expo-sqlite";

type CacheRow = { value: string };

let databasePromise: ReturnType<typeof SQLite.openDatabaseAsync> | undefined;

async function database() {
  databasePromise ??= SQLite.openDatabaseAsync("tripus.db").then(async (db) => {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS offline_cache (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    return db;
  });
  return databasePromise;
}

export async function readCache<T>(key: string): Promise<T | undefined> {
  const scopedKey = `${getAccountScope()}:${key}`;
  try {
    const db = await database();
    const row = await db.getFirstAsync<CacheRow>(
      "SELECT value FROM offline_cache WHERE key = ?",
      scopedKey,
    );
    return row ? JSON.parse(row.value) as T : undefined;
  } catch {
    return undefined;
  }
}

export async function writeCache<T>(key: string, value: T): Promise<void> {
  const scopedKey = `${getAccountScope()}:${key}`;
  try {
    const db = await database();
    await db.runAsync(
      `INSERT INTO offline_cache (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      scopedKey,
      JSON.stringify(value),
      new Date().toISOString(),
    );
  } catch {
    // The app remains usable if local storage is temporarily unavailable.
  }
}

export async function deleteCache(key: string): Promise<void> {
  const scopedKey = `${getAccountScope()}:${key}`;
  try {
    const db = await database();
    await db.runAsync("DELETE FROM offline_cache WHERE key = ?", scopedKey);
  } catch {
    // Cache invalidation must not fail an already successful server mutation.
  }
}

export async function cachedRequest<T>(key: string, request: () => Promise<T>): Promise<T> {
  const account = getAccountScope();
  const queryKey = resourceKey(key);
  const version = queryClient.getQueryState(queryKey)?.dataUpdateCount ?? 0;
  try {
    const value = await request();
    if (account !== getAccountScope()) throw new Error("Session changed during request");
    if ((queryClient.getQueryState(queryKey)?.dataUpdateCount ?? 0) !== version) {
      const latest = queryClient.getQueryData<T>(queryKey);
      if (latest !== undefined) return latest;
    }
    await writeCache(key, value);
    return value;
  } catch (error) {
    if (account !== getAccountScope()) throw error;
    const cached = await readCache<T>(key);
    if (cached !== undefined) return cached;
    throw error;
  }
}

export const cacheKeys = {
  trips: "trips:list",
  completedTrips: "trips:completed",
  trip: (tripId: string) => `trips:${tripId}`,
  places: (tripId: string) => `trips:${tripId}:places`,
  itinerary: (tripId: string) => `trips:${tripId}:itinerary`,
  aiUndo: (tripId: string) => `trips:${tripId}:ai-undo`,
} as const;

/** Restore only this account's durable resources, retaining their original freshness. */
export async function readCacheEntries(): Promise<{ key: string; value: unknown; updatedAt: number }[]> {
  const prefix = `${getAccountScope()}:`;
  try {
    const db = await database();
    const rows = await db.getAllAsync<{ key: string; value: string; updated_at: string }>("SELECT key, value, updated_at FROM offline_cache WHERE substr(key, 1, ?) = ?", prefix.length, prefix);
    return rows.filter((row) => row.key.startsWith(prefix)).flatMap((row) => {
      try { return [{ key: row.key.slice(prefix.length), value: JSON.parse(row.value), updatedAt: Date.parse(row.updated_at) || 0 }]; }
      catch { return []; }
    });
  } catch { return []; }
}
