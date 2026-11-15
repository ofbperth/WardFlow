export type ClinicalRow = Record<string, unknown>;
export type ClinicalConfig = { activeKeyId: string; keys: Map<string, Buffer>; allowLegacyReads: boolean };
export type ClinicalCodec = {
  encryptValue(table: string, anchor: string, column: string, value: unknown): unknown;
  decryptValue(table: string, anchor: string, column: string, value: unknown): unknown;
  encryptRow(table: string, row: ClinicalRow, explicitAnchor?: string): ClinicalRow;
  decryptRow(table: string, row: ClinicalRow, explicitAnchor?: string): ClinicalRow;
};
export const protectedColumns: Readonly<Record<string, readonly string[]>>;
export class ClinicalEncryptionError extends Error {}
export function clinicalConfigFromEnv(env?: NodeJS.ProcessEnv): ClinicalConfig;
export function isEncryptedValue(value: unknown): boolean;
export function isProtectedStoredValue(table: string, row: ClinicalRow, column: string): boolean;
export function anchorColumn(table: string): string;
export function createClinicalCodec(config: ClinicalConfig): ClinicalCodec;
