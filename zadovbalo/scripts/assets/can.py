"""Банка (референс 04, верхня ліва панель — закрита): банка без кільця, кільце окремим спрайтом, контур клапана.

Кільце обертається навколо заклепки (у браузері — афінне перетворення в площині кришки з її перспективою);
носик продавлює надрізаний клапан усередину. Поверхню кришки під кільцем відновлено самою кришкою.
"""
import cv2
import numpy as np

from common import OUT, fill_region, load_ref, poly_mask, rgba, save_webp, write_json

PANEL = (0, 0, 509, 666)
RIVET = (252.5, 128.5)
TAB = [
    (201.2, 75), (217.5, 72.5), (255, 70), (277.5, 69.5), (282.5, 75), (285, 95), (290, 120), (290, 132.5), (285, 142.5),
    (275, 148.8), (255, 151.2), (235, 150), (222.5, 145), (212.5, 132.5), (203.8, 110), (197.5, 90), (198.8, 80),
]
# надрізаний клапан (крапля під носиком кільця), шарнір — верхній край біля заклепки
FLAP = [(214, 140), (198, 150), (192, 163), (198, 177), (212, 186), (240, 192), (272, 192), (300, 187), (318, 178), (326, 164), (322, 150), (308, 141), (288, 138), (250, 139)]
LID = {"cx": 251.0, "cy": 122.0, "rx": 136.0, "ry": 85.0}


def run():
    out = OUT / "can"
    im = load_ref("04_beverage_can.png")
    x0, y0, x1, y1 = PANEL
    frame = im[y0:y1, x0:x1].copy()
    h, w = frame.shape[:2]

    # контур кільця з невеликим запасом: світлий обідок штампування — теж частина кільця
    tab_m = cv2.dilate(poly_mask(frame.shape, TAB), np.ones((7, 7), np.uint8))
    tab_soft = cv2.GaussianBlur(tab_m, (0, 0), 0.8)
    ys, xs = np.nonzero(tab_m)
    bx0, by0, bx1, by1 = xs.min() - 3, ys.min() - 3, xs.max() + 4, ys.max() + 4
    save_webp(out / "tab.webp", rgba(frame[by0:by1, bx0:bx1], tab_soft[by0:by1, bx0:bx1]), 94)

    # кришка без кільця: заклепка лишається (кільце кріпиться до неї)
    hole = cv2.dilate(tab_m, np.ones((7, 7), np.uint8))
    rivet = np.zeros((h, w), np.uint8)
    cv2.circle(rivet, (int(RIVET[0]), int(RIVET[1])), 9, 255, -1)
    hole[rivet > 0] = 0
    lid = np.zeros((h, w), np.uint8)
    cv2.ellipse(lid, ((LID["cx"], LID["cy"]), (LID["rx"] * 2 - 34, LID["ry"] * 2 - 26), 0), 255, -1)
    source = np.where((cv2.dilate(hole, np.ones((9, 9), np.uint8)) == 0) & (lid > 0) & (poly_mask(frame.shape, FLAP) == 0), 255, 0).astype(np.uint8)
    base = fill_region(frame, hole, source, seed=4, P=24, low_sigma=10, gain=1.2)
    save_webp(out / "can.webp", base, 90)

    write_json(
        out / "can.json",
        {
            "size": [w, h],
            "rivet": RIVET,
            "tab": {"x": int(bx0), "y": int(by0), "w": int(bx1 - bx0), "h": int(by1 - by0), "ringTip": [240, 71]},
            "flap": FLAP,
            "hinge": [[214, 140], [308, 141]],
            "lid": LID,
            "background": "#%02x%02x%02x" % tuple(int(v) for v in np.median(np.concatenate([frame[:20, :].reshape(-1, 3), frame[:, :12].reshape(-1, 3)]), axis=0)[::-1]),
        },
    )
    print("can ok", (bx0, by0, bx1 - bx0, by1 - by0))


if __name__ == "__main__":
    run()
