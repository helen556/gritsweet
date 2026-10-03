"""Карта: фактура паперу й рельєфу з фото, натягнута на ПЕРЕВІРЕНИЙ контур (Natural Earth, без Криму);
спрайти полумʼя з фото горіння."""
import json
import re

import cv2
import numpy as np

from common import OUT, PKG, ROOT, crop_rgba, rgba, save_webp, synthesize_hidden, write_json

TEX_W = 1600


def outline():
    src = (ROOT / "src/lib/scenes/russia-outline.ts").read_text(encoding="utf-8")
    view = re.search(r"RUSSIA_VIEW = \{ w: (\d+), h: (\d+) \}", src)
    rings = json.loads(re.search(r"RUSSIA_RINGS: .*? = (\[\[.*\]\]);", src, re.S).group(1))
    return (int(view.group(1)), int(view.group(2))), [np.array(r, np.float32).reshape(-1, 2) for r in rings]


def run():
    (vw, vh), rings = outline()
    s = TEX_W / vw
    TW, TH = TEX_W, round(vh * s)
    target = np.zeros((TH, TW), np.uint8)
    cv2.fillPoly(target, [np.round(r * s).astype(np.int32) for r in rings], 255)

    photo = cv2.imread(str(PKG / "06_map/russia_paper_intact.png"))
    hsv = cv2.cvtColor(photo, cv2.COLOR_BGR2HSV)
    pm = ((hsv[:, :, 2] > 70) & (hsv[:, :, 1] > 40)).astype(np.uint8) * 255
    pm = cv2.morphologyEx(pm, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(pm)
    main = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    x, y, w, h = st[main, :4]

    # Обидві області — у спільну рамку: крайні точки материкової частини збігаються.
    ys, xs = np.nonzero(target)
    tx0, tx1, ty0, ty1 = xs.min(), xs.max(), ys.min(), ys.max()
    M = np.array([[w / (tx1 - tx0), 0, x - tx0 * w / (tx1 - tx0)], [0, h / (ty1 - ty0), y - ty0 * h / (ty1 - ty0)]], np.float32)
    warped = cv2.warpAffine(photo, M, (TW, TH), flags=cv2.WARP_INVERSE_MAP | cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    wmask = cv2.warpAffine(cv2.erode(pm, np.ones((9, 9), np.uint8)), M, (TW, TH), flags=cv2.WARP_INVERSE_MAP | cv2.INTER_NEAREST)
    region = cv2.dilate(target, np.ones((25, 25), np.uint8))
    visible = cv2.bitwise_and(wmask, region)
    tex = synthesize_hidden(warped, visible, region, seed=7)
    coverage = float((cv2.bitwise_and(visible, target) > 0).sum()) / float((target > 0).sum())
    out = OUT / "map"
    save_webp(out / "paper.webp", tex, 80)

    # Полумʼя: яскраві помаранчеві язики з фото горіння; альфа — за яскравістю.
    burn = cv2.imread(str(PKG / "06_map/russia_paper_burning.png"))
    bh = cv2.cvtColor(burn, cv2.COLOR_BGR2HSV).astype(np.float32)
    flame = ((bh[:, :, 0] > 5) & (bh[:, :, 0] < 32) & (bh[:, :, 2] > 200) & (bh[:, :, 1] > 90)).astype(np.uint8) * 255
    flame = cv2.morphologyEx(flame, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(flame)
    cand = [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 900 and st[i, cv2.CC_STAT_HEIGHT] > st[i, cv2.CC_STAT_WIDTH] * 0.9]
    cand = sorted(cand, key=lambda i: -st[i, cv2.CC_STAT_AREA])[:8]
    flames = []
    for k, i in enumerate(cand):
        fx, fy, fw, fh = st[i, :4]
        pad = 14
        x0, y0 = max(fx - pad, 0), max(fy - pad, 0)
        crop = burn[y0 : fy + fh + pad, x0 : fx + fw + pad]
        cm = (lab[y0 : fy + fh + pad, x0 : fx + fw + pad] == i).astype(np.uint8) * 255
        cm = cv2.GaussianBlur(cv2.dilate(cm, np.ones((9, 9), np.uint8)), (0, 0), 4)
        lum = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY).astype(np.float32)
        a = np.clip((lum - 90) / 120, 0, 1) * (cm / 255.0)
        sprite, _ = crop_rgba(rgba(crop, (a * 255).astype(np.uint8)))
        save_webp(out / f"flame-{k}.webp", sprite, 86)
        flames.append({"w": int(sprite.shape[1]), "h": int(sprite.shape[0])})
    write_json(out / "map.json", {"view": [vw, vh], "texture": [TW, TH], "photoCoverage": round(coverage, 3), "flames": flames})
    print("map: coverage", round(coverage, 3), "flames", len(flames))


if __name__ == "__main__":
    run()
