/**
 * Normalizes a list of linked entity IDs (category IDs, tag IDs) by:
 *  - deduplicating (Set semantics)
 *  - trimming whitespace from each entry
 *  - returning an empty array if the input is missing or empty
 *
 * This is a domain utility for the Quiz aggregate's category/tag link management.
 * It does NOT validate UUIDs — that responsibility lives in the DTO layer.
 */
export function normalizeLinkIds(values?: string[]): string[] {
  if (!values || values.length === 0) {
    return [];
  }

  return [...new Set(values.map((id) => id.trim()))];
}
