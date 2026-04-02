/**
 * Shared testcontainers setup for integration tests.
 * Starts a postgres+pgvector container and runs migrations.
 */
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from '../../src/db/schema.js';
import path from 'path';

export interface TestDb {
  db: ReturnType<typeof drizzle>;
  sql: ReturnType<typeof postgres>;
  container: StartedPostgreSqlContainer;
  connectionUrl: string;
}

export async function startTestDb(): Promise<TestDb> {
  const container = await new PostgreSqlContainer('pgvector/pgvector:pg17')
    .withDatabase('kebo_test')
    .withUsername('postgres')
    .withPassword('postgres')
    .start();

  const connectionUrl = container.getConnectionUri();
  process.env.DATABASE_URL = connectionUrl;

  const sql = postgres(connectionUrl, { max: 1 });
  const db = drizzle(sql, { schema });

  // Enable pgvector extension and run migrations
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  await migrate(db, {
    migrationsFolder: path.join(process.cwd(), 'src/db/migrations'),
  });

  return { db, sql, container, connectionUrl };
}

export async function stopTestDb(testDb: TestDb): Promise<void> {
  await testDb.sql.end();
  await testDb.container.stop();
}
