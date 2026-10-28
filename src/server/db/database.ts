import fs from 'fs';
import path from 'path';
import {
  createInitialDatabaseState,
  runDatabaseMigrations,
} from './migrations';
import { PlatformDatabaseSchema } from './schema';

export function getDatabaseFilePath(): string {
  if (process.env.PLATFORM_DB_PATH) {
    return path.resolve(process.env.PLATFORM_DB_PATH);
  }
  return path.join(process.cwd(), 'data', 'platform-db.json');
}

function ensureDirectoryExists(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function readDatabase(): PlatformDatabaseSchema {
  const dbPath = getDatabaseFilePath();
  ensureDirectoryExists(dbPath);

  if (!fs.existsSync(dbPath)) {
    const initial = createInitialDatabaseState();
    writeDatabase(initial);
    return initial;
  }

  try {
    const raw = fs.readFileSync(dbPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<PlatformDatabaseSchema>;
    const { db, migrated } = runDatabaseMigrations(parsed);
    if (migrated) {
      writeDatabase(db);
    }
    return db;
  } catch {
    const initial = createInitialDatabaseState();
    writeDatabase(initial);
    return initial;
  }
}

export function writeDatabase(db: PlatformDatabaseSchema): void {
  const dbPath = getDatabaseFilePath();
  ensureDirectoryExists(dbPath);
  const tempPath = `${dbPath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tempPath, dbPath);
}

/**
 * Executes a synchronous mutation against the latest persisted database state
 * and writes it atomically back to disk.
 */
export function withDatabaseTransaction<T>(
  mutator: (db: PlatformDatabaseSchema) => T
): T {
  const db = readDatabase();
  const result = mutator(db);
  writeDatabase(db);
  return result;
}

export function resetDatabaseToSeed(): PlatformDatabaseSchema {
  const initial = createInitialDatabaseState();
  writeDatabase(initial);
  return initial;
}
