"""Пупирчаста плівка (референс 03): ціла плівка як основа + атлас лопнутих комірок із правої половини.

Кожен пухирець — окрема комірка: центри знаходимо зіставленням із середнім пухирцем (сітка на фото нерівна).
Лопнуті латки беремо з тієї ж фотосесії (права половина), вирівнюємо яскравість під ліву.
"""
import cv2
import numpy as np

from common import OUT, load_ref, save_webp, write_json

HALF = 768
TPL = 44  # пів-розміру шаблону пухирця
PATCH = 52  # пів-розміру лопнутої латки


def find_cells(gray: np.ndarray, tmpl: np.ndarray | None, seed=(170, 165)):
    gb = cv2.GaussianBlur(gray, (0, 0), 1.2)
    if tmpl is None:
        x, y = seed
        tmpl = gb[y - TPL : y + TPL, x - TPL : x + TPL].copy()
    pts = []
    for _ in range(3):
        m = cv2.matchTemplate(gb, tmpl, cv2.TM_CCOEFF_NORMED)
        mx = cv2.dilate(m, np.ones((61, 61)))
        pk = np.argwhere((m == mx) & (m > 0.25))
        pts = [(int(px + TPL), int(py + TPL), float(m[py, px])) for py, px in pk]
        top = sorted(pts, key=lambda p: -p[2])[:30]
        tmpl = np.mean([gb[y - TPL : y + TPL, x - TPL : x + TPL] for x, y, _ in top], axis=0).astype(np.float32)
    return pts, tmpl


def subpixel(gray, x, y, tmpl):
    """Уточнення центру в межах ±6 px."""
    gb = cv2.GaussianBlur(gray, (0, 0), 1.2)
    r = TPL + 6
    y0, x0 = max(y - r, 0), max(x - r, 0)
    win = gb[y0 : y + r, x0 : x + r]
    if win.shape[0] < 2 * TPL + 1 or win.shape[1] < 2 * TPL + 1:
        return float(x), float(y)
    m = cv2.matchTemplate(win, tmpl, cv2.TM_CCOEFF_NORMED)
    _, _, _, loc = cv2.minMaxLoc(m)
    return float(x0 + loc[0] + TPL), float(y0 + loc[1] + TPL)


def fill_rows(gray, cells, tmpl, x_min=40, x_max=HALF - 40, y_max=950):
    """Дозаповнює крайні пухирці рядів, яких не знайшло зіставлення (крок ~92 px)."""
    rows: list[list] = []
    for c in sorted(cells, key=lambda c: c[1]):
        if rows and abs(rows[-1][-1][1] - c[1]) < 35:
            rows[-1].append(c)
        else:
            rows.append([c])
    gb = cv2.GaussianBlur(gray, (0, 0), 1.2)
    out = []
    for row in rows:
        row.sort(key=lambda c: c[0])
        xs = [c[0] for c in row]
        step = float(np.median(np.diff(xs))) if len(xs) > 1 else 92.0
        y = float(np.mean([c[1] for c in row]))
        for direction, start in ((-1, xs[0]), (1, xs[-1])):
            x = start + direction * step
            while x_min < x < x_max:
                xi, yi = int(round(x)), int(round(y))
                win = gb[yi - TPL : yi + TPL, xi - TPL : xi + TPL]
                if win.shape != tmpl.shape or float(cv2.matchTemplate(win, tmpl, cv2.TM_CCOEFF_NORMED)[0, 0]) < 0.12:
                    break
                row.append(subpixel(gray, xi, yi, tmpl) + (0.3,))
                x += direction * step
        out += [c for c in row if c[1] < y_max]
    return sorted(out, key=lambda c: (round(c[1] / 40), c[0]))


def run():
    out = OUT / "bubble"
    im = load_ref("03_bubble_wrap.png")
    left, right = im[:, :HALF], im[:, HALF:]
    gl = cv2.cvtColor(left, cv2.COLOR_BGR2GRAY).astype(np.float32)
    gr = cv2.cvtColor(right, cv2.COLOR_BGR2GRAY).astype(np.float32)

    cells_l, tmpl = find_cells(gl, None)
    cells_r, _ = find_cells(gr, tmpl)
    cells = [subpixel(gl, x, y, tmpl) + (s,) for x, y, s in cells_l if s > 0.42]
    # дублікати (два збіги на одну комірку)
    uniq = []
    for c in sorted(cells, key=lambda c: -c[2]):
        if all((c[0] - u[0]) ** 2 + (c[1] - u[1]) ** 2 > 60**2 for u in uniq):
            uniq.append(c)
    cells = fill_rows(gl, uniq, tmpl)

    # Кадр плівки з невеликим полем фактури тканини.
    x0, y0, x1, y1 = 14, 6, 754, 1018
    sheet = left[y0:y1, x0:x1]
    save_webp(out / "sheet.webp", sheet, 88)

    # Атлас лопнутих комірок: яскравість/контраст — як у цілої плівки навколо.
    sel = [c for c in cells_r if c[2] > 0.5 and PATCH <= c[0] < HALF - PATCH and PATCH <= c[1] < im.shape[0] - PATCH]
    sel = sorted(sel, key=lambda c: -c[2])[:48]
    ref_mean, ref_std = gl[60:960, 60:700].mean(), gl[60:960, 60:700].std()
    src_mean, src_std = gr[60:960, 60:700].mean(), gr[60:960, 60:700].std()
    gain = ref_std / src_std
    cols = 8
    rows = (len(sel) + cols - 1) // cols
    S = PATCH * 2
    atlas = np.zeros((rows * S, cols * S, 3), np.uint8)
    for i, (x, y, _) in enumerate(sel):
        p = right[y - PATCH : y + PATCH, x - PATCH : x + PATCH].astype(np.float32)
        p = (p - src_mean) * gain + ref_mean
        atlas[(i // cols) * S : (i // cols + 1) * S, (i % cols) * S : (i % cols + 1) * S] = np.clip(p, 0, 255).astype(np.uint8)
    save_webp(out / "popped.webp", atlas, 86)

    # Колір тканини довкола — для заповнення полів на широких екранах.
    border = np.concatenate([left[:, :10].reshape(-1, 3), left[:, -10:].reshape(-1, 3)])
    b, g, r = np.median(border, axis=0)
    write_json(
        out / "bubble.json",
        {
            "size": [x1 - x0, y1 - y0],
            "radius": 41,
            "cells": [[round(x - x0, 1), round(y - y0, 1)] for x, y, _ in cells],
            "popped": {"size": S, "cols": cols, "count": len(sel)},
            "background": f"#{int(r):02x}{int(g):02x}{int(b):02x}",
        },
    )
    print("bubble ok", len(cells), "комірок,", len(sel), "лопнутих латок")


if __name__ == "__main__":
    run()
