import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface PopoverCoords {
  left: number;
  width: number;
  top?: number; // set when placed below the trigger
  bottom?: number; // set when placed above the trigger (distance from viewport bottom)
  maxHeight: number; // space available on the chosen side (popover scrolls within)
}

/**
 * Anchors a portaled popover to a trigger with `position: fixed`, so it renders
 * above any `overflow` / scroll container (drawers, cards, modals) instead of
 * being clipped. Repositions on scroll/resize and closes on outside click.
 * `placement` opens it below (default) or above the trigger.
 */
export function useAnchoredPopover<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
  placement: 'top' | 'bottom' | 'auto' = 'auto',
) {
  const triggerRef = useRef<T>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<PopoverCoords | null>(null);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    const reposition = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const GAP = 4;
      const MARGIN = 12;
      const spaceBelow = window.innerHeight - r.bottom;
      const spaceAbove = r.top;
      // Prefer below (default); flip up only when cramped and there's more room.
      const placeTop =
        placement === 'top' ||
        (placement === 'auto' && spaceBelow < 280 && spaceAbove > spaceBelow);
      setCoords(
        placeTop
          ? {
              left: r.left,
              width: r.width,
              bottom: window.innerHeight - r.top + GAP,
              maxHeight: spaceAbove - GAP - MARGIN,
            }
          : {
              left: r.left,
              width: r.width,
              top: r.bottom + GAP,
              maxHeight: spaceBelow - GAP - MARGIN,
            },
      );
    };
    reposition();
    // capture:true catches scrolls on any ancestor container, not just window.
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || popoverRef.current?.contains(t)) {
        return;
      }
      onCloseRef.current();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return { triggerRef, popoverRef, coords };
}
