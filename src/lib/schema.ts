import { pgTable, text, boolean, bigint, real } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  avatar: text('avatar'),
})

export const sessions = pgTable('sessions', {
  token: text('token').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
})

export const trips = pgTable('trips', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  startDate: bigint('start_date', { mode: 'number' }).notNull(),
  endDate: bigint('end_date', { mode: 'number' }),
  isPublic: boolean('is_public').notNull().default(false),
})

export const records = pgTable('records', {
  id: text('id').primaryKey(),
  tripId: text('trip_id')
    .notNull()
    .references(() => trips.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  locLat: real('loc_lat').notNull(),
  locLng: real('loc_lng').notNull(),
  locName: text('loc_name').notNull(),
  timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
})

export const photos = pgTable('photos', {
  id: text('id').primaryKey(),
  recordId: text('record_id')
    .notNull()
    .references(() => records.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  locLat: real('loc_lat'),
  locLng: real('loc_lng'),
  timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
})
