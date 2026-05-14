/**
 * Creates a draggable DOM handle using the Pointer Events API.
 * Pointer capture on the element itself ensures move/up fire everywhere
 * (no document.addEventListener needed).
 *
 * @param container - Parent element to append the handle to
 * @param cssText   - Inline CSS for the handle element
 * @param content   - Text / emoji content
 * @param opts      - Drag callbacks + coordinate converter
 */
export function makeDragHandle<C extends object>(
  container: HTMLElement,
  cssText: string,
  content: string,
  opts: {
    /**
     * Convert a PointerEvent to a domain coordinate. Return null to skip the event.
     * For building gizmos: `(e) => ({ x: e.clientX, y: e.clientY })`
     * For furniture gizmos: a function that converts screen → room coords (unclamped).
     */
    coordConverter: (e: PointerEvent) => C | null;
    onStart?: (coords: C, e: PointerEvent) => void;
    onDrag?:  (coords: C, e: PointerEvent) => void;
    onEnd?:   (coords: C | null, e: PointerEvent) => void;
  },
): {
  element:     HTMLElement;
  /** Reposition the handle (absolute/fixed left/top) */
  setPosition: (left: number, top: number) => void;
  remove:      () => void;
} {
  const el = document.createElement('div');
  el.style.cssText = cssText;
  el.textContent = content;
  el.style.touchAction = 'none'; // prevent scroll hijack on touch

  const { coordConverter, onStart, onDrag, onEnd } = opts;

  el.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    const c = coordConverter(e);
    if (c) onStart?.(c, e);
  });

  el.addEventListener('pointermove', (e) => {
    if (!el.hasPointerCapture(e.pointerId)) return;
    const c = coordConverter(e);
    if (c) onDrag?.(c, e);
  });

  el.addEventListener('pointerup', (e) => {
    const c = coordConverter(e);
    onEnd?.(c, e);
    el.releasePointerCapture(e.pointerId);
  });

  el.addEventListener('pointercancel', (e) => {
    onEnd?.(null, e);
    el.releasePointerCapture(e.pointerId);
  });

  container.appendChild(el);

  return {
    element: el,
    setPosition(left, top) {
      el.style.left = `${left}px`;
      el.style.top  = `${top}px`;
    },
    remove() { el.remove(); },
  };
}
