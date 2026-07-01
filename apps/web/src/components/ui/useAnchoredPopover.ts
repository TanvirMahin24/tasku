import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface PopoverCoords {
  left: number;
  top: number;
  width: number;
}

/**
 * Anchors a portaled popover to a trigger with `position: fixed`, so it renders
 * above any `overflow` / scroll container (drawers, cards, modals) instead of
 * being clipped. Repositions on scroll/resize and closes on outside click.
 */
export function useAnchoredPopover<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
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
      if (r) setCoords({ left: r.left, top: r.bottom + 4, width: r.width });
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
