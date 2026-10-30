/**
 * Storage Schema Versioning and Migration Coordinator.
 */

export const CURRENT_STORAGE_SCHEMA_VERSION = 1;

export interface StorageMigrationRecord {
  fromVersion: number;
  toVersion: number;
  migratedAt: number;
}

export function assertCompatibleSchemaVersion(storedVersion: number): void {
  if (storedVersion > CURRENT_STORAGE_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported schemaVersion ${storedVersion}. Current supported version is ${CURRENT_STORAGE_SCHEMA_VERSION}. Please update the extension.`
    );
  }
}
