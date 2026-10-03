"use client";

import { useEffect, useState } from "react";

/** Завантажити й декодувати зображення сцени (до першого кадру, щоб не було «миготіння»). */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (typeof img.decode === "function")
        img.decode().then(
          () => resolve(img),
          () => resolve(img),
        );
      else resolve(img);
    };
    img.onerror = () => reject(new Error(`image: ${src}`));
    img.src = src;
  });
}

export async function loadJson<T>(src: string): Promise<T> {
  const res = await fetch(src, { cache: "force-cache" });
  if (!res.ok) throw new Error(`json: ${src}`);
  return (await res.json()) as T;
}

export type AssetState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; retry: () => void };

/** Асинхронно підвантажує матеріали сцени; помилка мережі — з можливістю повторити. */
export function useSceneAssets<T>(load: () => Promise<T>): AssetState<T> {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<AssetState<T>>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    load().then(
      (data) => alive && setState({ status: "ready", data }),
      () =>
        alive &&
        setState({
          status: "error",
          retry: () => {
            setState({ status: "loading" });
            setAttempt((n) => n + 1);
          },
        }),
    );
    return () => {
      alive = false;
    };
    // load — стабільна функція модуля сцени
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);
  return state;
}

/** Вписати зображення-сцену (w×h) у полотно з полями. Повертає масштаб і зсув. */
export function fitContain(
  cw: number,
  ch: number,
  w: number,
  h: number,
  pad = 0,
) {
  const s = Math.min((cw - pad * 2) / w, (ch - pad * 2) / h);
  return { s, ox: (cw - w * s) / 2, oy: (ch - h * s) / 2 };
}
