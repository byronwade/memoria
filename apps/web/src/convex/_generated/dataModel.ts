// Placeholder Convex dataModel definitions.
// Replace with generated files from `npx convex dev` when a Convex project is connected.

/**
 * Type-safe ID for Convex documents.
 * This is a placeholder - Convex generates proper branded types.
 */
export type Id<TableName extends string> = string & { __tableName: TableName };

/**
 * Generic document type with standard Convex fields
 */
export interface GenericDocument {
	_id: Id<string>;
	_creationTime: number;
}
