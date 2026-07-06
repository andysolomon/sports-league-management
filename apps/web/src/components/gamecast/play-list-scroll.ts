/**
 * Returns a target scrollTop when the row is outside the container viewport,
 * or null when the row already intersects the visible band (no nudge).
 */
export function computePlayListScrollTop(
  scrollTop: number,
  clientHeight: number,
  rowTop: number,
  rowHeight: number,
): number | null {
  const visibleBottom = scrollTop + clientHeight;
  const rowBottom = rowTop + rowHeight;

  if (rowTop < visibleBottom && rowBottom > scrollTop) {
    return null;
  }

  if (rowBottom <= scrollTop) {
    return rowTop;
  }

  return rowBottom - clientHeight;
}
