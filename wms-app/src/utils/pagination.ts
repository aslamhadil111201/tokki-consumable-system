/** Zero-based indices for a compact window of page buttons. */
export function getPageIndices(totalPages: number, currentPage: number) {
  const total = Math.max(0, Math.floor(totalPages));
  const size = Math.min(5, total);
  const current = Math.max(1, Math.min(total, currentPage));
  const start = Math.max(0, Math.min(total - size, current - 3));
  return Array.from({ length: size }, (_, offset) => start + offset);
}
