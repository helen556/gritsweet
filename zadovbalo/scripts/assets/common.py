"""Спільні утиліти конвеєра матеріалів. Запуск: python3 scripts/assets/build.py (див. README)."""
import json
import os
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[2]  # zadovbalo/
PKG = ROOT.parent / "Vydyhny_Claude_Package" / "assets"
OUT = ROOT / "public" / "scenes"
EXTRA = ROOT / "assets-src"  # додаткові ліцензовані матеріали (напр. долари), якщо додані


def load(rel: str) -> np.ndarray:
    p = PKG / rel
    im = cv2.imread(str(p), cv2.IMREAD_COLOR)
    if im is None:
        raise SystemExit(f"Немає файла матеріалу: {p}")
    return im


def poly_mask(shape, pts, value=255):
    m = np.zeros(shape[:2], np.uint8)
    cv2.fillPoly(m, [np.array(pts, np.int32)], value)
    return m


def smooth_mask(m: np.ndarray, r: float = 1.2) -> np.ndarray:
    """Антиаліасинг краю маски (0..255)."""
    return cv2.GaussianBlur(m, (0, 0), r)


def synthesize_hidden(rgb: np.ndarray, visible: np.ndarray, amodal: np.ndarray, seed: int = 1) -> np.ndarray:
    """Заповнює невидиму частину предмета його ж фактурою (працює лише в межах предмета)."""
    ys, xs = np.nonzero(amodal > 127)
    m = 40
    y0, y1 = max(ys.min() - m, 0), min(ys.max() + m + 1, rgb.shape[0])
    x0, x1 = max(xs.min() - m, 0), min(xs.max() + m + 1, rgb.shape[1])
    out = rgb.copy()
    out[y0:y1, x0:x1] = _synthesize(rgb[y0:y1, x0:x1], visible[y0:y1, x0:x1], amodal[y0:y1, x0:x1], seed)
    return out


def _synthesize(rgb: np.ndarray, visible: np.ndarray, amodal: np.ndarray, seed: int) -> np.ndarray:
    """Низькі частоти (світлотінь) — інпейнтинг; високі (зерно) — латки з видимої частини."""
    rng = np.random.default_rng(seed)
    hidden = (amodal > 127) & (visible < 128)
    if not hidden.any():
        return rgb.copy()
    vis = (visible > 127).astype(np.uint8)
    low = cv2.GaussianBlur(rgb, (0, 0), 9)
    low_inp = cv2.resize(cv2.inpaint(cv2.resize(low, None, fx=0.25, fy=0.25, interpolation=cv2.INTER_AREA), cv2.resize(((1 - vis) * 255).astype(np.uint8), None, fx=0.25, fy=0.25, interpolation=cv2.INTER_NEAREST), 6, cv2.INPAINT_TELEA), (rgb.shape[1], rgb.shape[0]), interpolation=cv2.INTER_CUBIC)
    detail = rgb.astype(np.float32) - cv2.GaussianBlur(rgb, (0, 0), 9).astype(np.float32)
    # латки з повністю видимих ділянок
    inner = cv2.erode(vis, np.ones((25, 25), np.uint8))
    ys, xs = np.nonzero(inner)
    out = rgb.astype(np.float32).copy()
    acc = np.zeros(rgb.shape[:2], np.float32)
    fill = np.zeros_like(out)
    P = 48
    hy, hx = np.nonzero(hidden)
    if len(ys) == 0:
        fill_detail = np.zeros_like(out)
    else:
        win = np.outer(np.hanning(P), np.hanning(P)).astype(np.float32) + 1e-3
        y0, y1, x0, x1 = hy.min(), hy.max(), hx.min(), hx.max()
        for ty in range(y0 - P // 2, y1 + 1, P // 2):
            for tx in range(x0 - P // 2, x1 + 1, P // 2):
                i = rng.integers(len(ys))
                sy, sx = ys[i] - P // 2, xs[i] - P // 2
                if sy < 0 or sx < 0 or sy + P > rgb.shape[0] or sx + P > rgb.shape[1]:
                    continue
                patch = detail[sy : sy + P, sx : sx + P]
                ty0, tx0 = max(ty, 0), max(tx, 0)
                ty1, tx1 = min(ty + P, rgb.shape[0]), min(tx + P, rgb.shape[1])
                if ty1 <= ty0 or tx1 <= tx0:
                    continue
                py0, px0 = ty0 - ty, tx0 - tx
                w = win[py0 : py0 + ty1 - ty0, px0 : px0 + tx1 - tx0]
                fill[ty0:ty1, tx0:tx1] += patch[py0 : py0 + ty1 - ty0, px0 : px0 + tx1 - tx0] * w[..., None]
                acc[ty0:ty1, tx0:tx1] += w
        fill_detail = 1.6 * fill / np.maximum(acc, 1e-3)[..., None]
    # прихована частина — нижня/затінена сторона: темнішає вглиб від видимої
    dvis = cv2.distanceTransform((1 - vis).astype(np.uint8), cv2.DIST_L2, 5)
    shade = (1 - 0.38 * np.clip(dvis / 40, 0, 1))[..., None]
    synth = np.clip((low_inp.astype(np.float32) + fill_detail) * shade, 0, 255)
    # мʼякий перехід від видимого до синтезованого
    t = cv2.GaussianBlur((hidden * 255).astype(np.uint8), (0, 0), 3).astype(np.float32) / 255
    t = np.where(hidden, 1.0, t * (amodal > 127))[..., None]
    return (out * (1 - t) + synth * t).astype(np.uint8)


def edge_shade(rgb: np.ndarray, alpha: np.ndarray, strength: float = 0.35, width: float = 10) -> np.ndarray:
    """Темнішає до краю — обʼєм для дорисованих частин."""
    a = (alpha > 127).astype(np.uint8)
    dist = cv2.distanceTransform(a, cv2.DIST_L2, 5)
    k = 1 - strength * np.exp(-dist / width)
    return np.clip(rgb.astype(np.float32) * k[..., None], 0, 255).astype(np.uint8)


def save_webp(path: Path, img: np.ndarray, quality: int = 82):
    path.parent.mkdir(parents=True, exist_ok=True)
    ok = cv2.imwrite(str(path), img, [cv2.IMWRITE_WEBP_QUALITY, quality])
    if not ok:
        raise SystemExit(f"Не вдалося записати {path}")
    return path


def rgba(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    return np.dstack([rgb, alpha])


def crop_rgba(img: np.ndarray, pad: int = 2):
    a = img[:, :, 3]
    ys, xs = np.nonzero(a > 4)
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, img.shape[0])
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, img.shape[1])
    return img[y0:y1, x0:x1], (int(x0), int(y0), int(x1 - x0), int(y1 - y0))


def write_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def trim_dark_rim(alpha: np.ndarray, rgb: np.ndarray, visible: np.ndarray, width: int = 7, thresh: int = 42) -> np.ndarray:
    """Прибирає темні щілини між предметами, що потрапили в край вирізки."""
    lum = cv2.cvtColor(rgb, cv2.COLOR_BGR2GRAY)
    inner = cv2.erode((alpha > 127).astype(np.uint8), np.ones((width * 2 + 1, width * 2 + 1), np.uint8))
    rim = (alpha > 127) & (inner == 0) & (visible > 127) & (lum < thresh)
    a = alpha.copy()
    a[rim] = 0
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    a = cv2.morphologyEx(cv2.morphologyEx(a, cv2.MORPH_OPEN, k), cv2.MORPH_CLOSE, k)
    # згладити зубці: розмити й знову підтягнути контраст
    a = cv2.GaussianBlur(a, (0, 0), 2.2).astype(np.float32)
    return np.clip((a - 128) * 2.2 + 128, 0, 255).astype(np.uint8)
