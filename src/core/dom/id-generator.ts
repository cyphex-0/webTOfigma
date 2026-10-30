/**
 * Deterministic Node Identifier Generator.
 * Guarantees reproducible, collision-free node IDs derived strictly from
 * tree hierarchy paths and deterministic content hashes.
 * Independent of object key iteration order and random number generators.
 */

/**
 * Computes a fast, deterministic 32-bit FNV-1a hash string from input text.
 */
export function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Generates a stable node identifier from a page index and tree index path.
 * e.g., page 0, root -> "p0_n_0"; child 2 of child 1 -> "p0_n_0_1_2".
 */
export function generateNodeId(pageIndex: number, treePath: readonly number[]): string {
  const pathStr = treePath.length === 0 ? '0' : treePath.join('_');
  return `p${pageIndex}_n_${pathStr}`;
}

/**
 * Generates a deterministic synthetic node identifier using a prefix and content seed.
 * Useful for virtual wrapper frames, pseudo-elements (:before, :after), or generated section groups.
 */
export function generateSyntheticNodeId(
  pageIndex: number,
  prefix: string,
  contentSeed: string
): string {
  const hash = fnv1aHash(contentSeed);
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `p${pageIndex}_syn_${cleanPrefix}_${hash}`;
}

/**
 * Parses a standard tree-derived node ID back into its page index and tree path segments.
 */
export function parseNodeId(nodeId: string): { pageIndex: number; treePath: number[] } | null {
  const match = nodeId.match(/^p(\d+)_n_([0-9_]+)$/);
  if (!match || !match[1] || !match[2]) {
    return null;
  }
  const pageIndex = parseInt(match[1], 10);
  const treePath = match[2].split('_').map((seg) => parseInt(seg, 10));
  return { pageIndex, treePath };
}
