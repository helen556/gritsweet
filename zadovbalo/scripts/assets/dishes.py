"""«Просто бісить» (референс 01, ліва панель): стіна й підлога без предметів, тарілка й пляшка окремими спрайтами.

Тарілку й пляшку вирізано за контуром; стіну під ними відновлено фактурою самої стіни
(низькі частоти — інпейнтинг світла, деталь — латки зі стіни поруч). Уламки будуються в браузері з цих спрайтів.
"""
import cv2
import numpy as np

from common import OUT, fill_region, load_ref, poly_mask, rgba, save_webp, write_json

PANEL = (0, 553)
PLATE = {"cx": 222.0, "cy": 347.0, "rx": 155.0, "ry": 151.5, "angle": -4.0}
BOTTLE = [
    (465, 165), (505, 170), (495, 210), (490, 250), (500, 300), (502, 340), (480, 500), (462, 570), (452, 580),
    (360, 557), (357, 540), (390, 410), (405, 315), (437, 290), (450, 275), (462, 190),
]
# Не-стіна (рослина, ваза, бруски, підлога) — з них латки не беремо.
NOT_WALL = [
    [(0, 120), (150, 120), (150, 400), (115, 640), (0, 650)],  # гілка й ваза
    [(0, 630), (553, 630), (553, 936), (0, 936)],  # бруски, тканина, підлога
]


def run():
    out = OUT / "dishes"
    im = load_ref("01_dishes_and_bottle.png")[:, PANEL[0] : PANEL[1]].copy()
    h, w = im.shape[:2]

    plate_m = np.zeros((h, w), np.uint8)
    cv2.ellipse(plate_m, ((PLATE["cx"], PLATE["cy"]), (PLATE["rx"] * 2, PLATE["ry"] * 2), PLATE["angle"]), 255, -1, cv2.LINE_AA)
    bottle_m = poly_mask(im.shape, BOTTLE)
    bottle_m = cv2.GaussianBlur(bottle_m, (0, 0), 0.8)

    # --- спрайти ---
    def sprite(mask, pad=4):
        ys, xs = np.nonzero(mask > 8)
        x0, x1, y0, y1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, w), max(ys.min() - pad, 0), min(ys.max() + pad + 1, h)
        return rgba(im[y0:y1, x0:x1], mask[y0:y1, x0:x1]), (int(x0), int(y0), int(x1 - x0), int(y1 - y0))

    plate_alpha = cv2.erode(plate_m, np.ones((3, 3), np.uint8))
    plate_alpha = cv2.GaussianBlur(plate_alpha, (0, 0), 0.9)
    plate_rgba, plate_box = sprite(plate_alpha)
    save_webp(out / "plate.webp", plate_rgba, 92)

    # Скло прозоре: темний фон, що просвічує крізь пляшку, робимо напівпрозорим (відблиски й колір лишаються).
    bx0, by0, bw, bh = sprite(bottle_m)[1]
    crop = im[by0 : by0 + bh, bx0 : bx0 + bw].astype(np.float32)
    lum = crop.mean(axis=2)
    a = bottle_m[by0 : by0 + bh, bx0 : bx0 + bw].astype(np.float32) / 255
    glass_a = np.clip(0.55 + lum / 255 * 0.9, 0, 1) * a
    bottle_rgba = np.dstack([crop.astype(np.uint8), (glass_a * 255).astype(np.uint8)])
    save_webp(out / "bottle.webp", bottle_rgba, 92)

    # --- стіна без предметів ---
    hide = np.maximum(cv2.dilate(plate_m, np.ones((11, 11), np.uint8)), cv2.dilate(bottle_m, np.ones((17, 17), np.uint8)))
    wall = np.full((h, w), 255, np.uint8)
    for poly in NOT_WALL:
        wall = np.minimum(wall, 255 - poly_mask(im.shape, poly))
    source = np.where(cv2.dilate(hide, np.ones((7, 7), np.uint8)) > 0, 0, wall).astype(np.uint8)
    clean = fill_region(im, (hide > 0).astype(np.uint8) * 255, source)
    save_webp(out / "wall.webp", clean, 86)

    write_json(
        out / "dishes.json",
        {
            "size": [w, h],
            # де стіна сходиться з підлогою та лінія горизонту (для перспективи польоту й підлоги)
            "seamY": 705,
            "horizonY": 330,
            "plate": {"box": plate_box, "cx": PLATE["cx"], "cy": PLATE["cy"], "r": (PLATE["rx"] + PLATE["ry"]) / 2},
            "bottle": {"box": [bx0, by0, bw, bh], "axis": [[483, 172], [408, 568]]},
        },
    )
    print("dishes ok", plate_box, (bx0, by0, bw, bh))


if __name__ == "__main__":
    run()
