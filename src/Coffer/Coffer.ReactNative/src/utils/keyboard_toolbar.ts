export interface ToolbarPlacementInput {
  /** Bottom edge of the view hosting the toolbar, in window coordinates (measureInWindow y + height). */
  hostBottom: number;
  /** Top edge of the keyboard in window coordinates (keyboard event endCoordinates.screenY), null when hidden. */
  keyboardTop: number | null;
  minBottom?: number;
}

/**
 * Distance from the host's bottom edge at which a toolbar must sit so its bottom touches the keyboard's top edge.
 * Works the same whether the window is resized for the keyboard or not (Android edge-to-edge vs. adjustResize),
 * because both values are measured in the same window coordinate space. Null = keyboard hidden.
 */
export function computeToolbarBottom({ hostBottom, keyboardTop, minBottom = -Infinity }: ToolbarPlacementInput): number | null {
  if (keyboardTop === null) return null;
  return Math.max(minBottom, Math.round(hostBottom - keyboardTop));
}
