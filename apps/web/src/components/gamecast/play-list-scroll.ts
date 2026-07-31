/**
 * Whether the list should follow the highlighted row.
 *
 * `sim` mode always follows — plays are revealed one at a time, so the newest
 * row is what the viewer is watching. `review` mode renders every play at once
 * and the viewer may be scrolling by hand, so following on a manual selection
 * would fight them. But while the transport is auto-advancing, the highlight
 * moves without the viewer touching anything; not following there leaves the
 * current play scrolled out of sight and the widget reads as frozen.
 */
export function shouldFollowCurrentPlay(
  mode: "sim" | "review",
  playing: boolean,
): boolean {
  return mode === "sim" || playing;
}

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
