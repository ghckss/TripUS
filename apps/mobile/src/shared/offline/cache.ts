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
  try {
    const db = await database();
    const row = await db.getFirstAsync<CacheRow>(
      "SELECT value FROM offline_cache WHERE key = ?",
      key,
    );
    return row ? JSON.parse(row.value) as T : undefined;
  } catch {
    return undefined;
  }
}

export async function writeCache<T>(key: string, value: T): Promise<void> {
  try {
    const db = await database();
    await db.runAsync(
      `INSERT INTO offline_cache (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      key,
      JSON.stringify(value),
      new Date().toISOString(),
    );
  } catch {
    // The app remains usable if local storage is temporarily unavailable.
  }
}

export async function deleteCache(key: string): Promise<void> {
  try {
    const db = await database();
    await db.runAsync("DELETE FROM offline_cache WHERE key = ?", key);
  } catch {
    // Cache invalidation must not fail an already successful server mutation.
  }
}

export async function cachedRequest<T>(key: string, request: () => Promise<T>): Promise<T> {
  try {
    const value = await request();
    await writeCache(key, value);
    return value;
  } catch (error) {
    const cached = await readCache<T>(key);
    if (cached !== undefined) return cached;
    throw error;
  }
}

export const cacheKeys = {
  trips: "trips:list",
  trip: (tripId: string) => `trips:${tripId}`,
  places: (tripId: string) => `trips:${tripId}:places`,
  itinerary: (tripId: string) => `trips:${tripId}:itinerary`,
  aiUndo: (tripId: string) => `trips:${tripId}:ai-undo`,
} as const;
