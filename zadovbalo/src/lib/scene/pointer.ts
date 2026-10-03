"use client";

import { useEffect as useEffectReact, useRef as useRefReact } from "react";

export interface PointerInfo {
  id: number;
  x: number;
  y: number;
  /** 0..1; миша — 0.5. */
  pressure: number;
  type: string;
  time: number;
}

export interface PointerHandlers {
  down?: (p: PointerInfo, e: PointerEvent) => boolean | void;
  move?: (p: PointerInfo, e: PointerEvent) => void;
  /** cancelled = pointercancel / втрачено capture: жест не завершено «успішно». */
  up?: (p: PointerInfo, cancelled: boolean) => void;
}

/**
 * Pointer Events з capture. Координати — у CSS-пікселях відносно елемента.
 * `down` повертає false, щоб не захоплювати вказівник (наприклад, дотик повз обʼєкт).
 */
export function bindPointer(el: HTMLElement, h: PointerHandlers) {
  const active = new Set<number>();
  const info = (e: PointerEvent): PointerInfo => {
    const r = el.getBoundingClientRect();
    return {
      id: e.pointerId,
      x: e.clientX - r.left,
      y: e.clientY - r.top,
      pressure: e.pointerType === "mouse" ? 0.5 : e.pressure || 0.5,
      type: e.pointerType,
      time: e.timeStamp,
    };
  };
  const onDown = (e: PointerEvent) => {
    if (e.button > 0) return;
    // Кнопки, поля й меню всередині сцени — не жест: інакше захоплення «краде» їхній клік.
    if (
      (e.target as Element | null)?.closest?.(
        "button, a, input, textarea, select, summary, label, [role=radio], [role=dialog]",
      )
    )
      return;
    if (h.down?.(info(e), e) === false) return;
    active.add(e.pointerId);
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onMove = (e: PointerEvent) => {
    if (!active.has(e.pointerId)) return;
    // Згладжені події між кадрами — плавніший слід пальця.
    const events =
      typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
    if (events.length > 1) for (const c of events) h.move?.(info(c), c);
    else h.move?.(info(e), e);
  };
  const end = (cancelled: boolean) => (e: PointerEvent) => {
    if (!active.delete(e.pointerId)) return;
    if (el.hasPointerCapture(e.pointerId))
      el.releasePointerCapture(e.pointerId);
    h.up?.(info(e), cancelled);
  };
  const onUp = end(false);
  const onCancel = end(true);
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onCancel);
  el.addEventListener("lostpointercapture", onCancel);
  return () => {
    el.removeEventListener("pointerdown", onDown);
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    el.removeEventListener("pointercancel", onCancel);
    el.removeEventListener("lostpointercapture", onCancel);
  };
}

/**
 * Привʼязати жести один раз: обробники беруться з ref, тож зміна розміру чи стану сцени
 * посеред жесту не губить захоплений палець.
 */
export function usePointer(
  target: React.RefObject<HTMLElement | null>,
  handlers: PointerHandlers,
) {
  const ref = useRefReact(handlers);
  useEffectReact(() => {
    ref.current = handlers;
  });
  useEffectReact(() => {
    const el = target.current;
    if (!el) return;
    return bindPointer(el, {
      down: (p, e) => ref.current.down?.(p, e),
      move: (p, e) => ref.current.move?.(p, e),
      up: (p, c) => ref.current.up?.(p, c),
    });
  }, [target]);
}
