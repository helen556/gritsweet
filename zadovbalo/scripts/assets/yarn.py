"""Пряжа: заплутана маса без хвоста, змотаний клубок без хвоста, текстура нитки (смуга, знята з реального хвоста)."""
import cv2
import numpy as np

from common import OUT, PKG, crop_rgba, poly_mask, rgba, save_webp, write_json

TANGLE_TAIL = [(900, 822), (950, 800), (978, 790), (1012, 800), (1230, 950), (1230, 1230), (800, 1230), (800, 862), (850, 840)]
TANGLE_EXIT = (978, 796)  # де нитка виходить із маси
BALL = ((577, 489), (722, 700))  # центр і осі еліпса клубка
TAIL_CENTER = [(860, 915), (900, 928), (980, 930), (1040, 928), (1100, 945), (1145, 980), (1160, 1020), (1140, 1065), (1100, 1100)]
STRIP_HALF = 16


def yarn_mask(img):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[:, :, 0].astype(int), hsv[:, :, 1].astype(int), hsv[:, :, 2].astype(int)
    red = ((h < 12) | (h > 160)) & (s > 70) & (v > 35)
    m = red.astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    return m


def solid_core(hard, k=41):
    """Внутрішні темні шари пряжі лишаються непрозорими; прозорі лише зовнішні проміжки."""
    closed = cv2.morphologyEx(hard, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    cnts, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filled = np.zeros_like(hard)
    cv2.drawContours(filled, cnts, -1, 255, -1)
    core = cv2.erode(filled, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    return np.maximum(hard, core)


def soft_alpha(img, hard):
    """Пухнасті волокна: альфа з насиченості біля краю."""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.float32)
    fuzz = np.clip((hsv[:, :, 1] - 40) / 60, 0, 1) * np.clip((hsv[:, :, 2] - 30) / 40, 0, 1)
    near = cv2.dilate(hard, np.ones((5, 5), np.uint8)) > 0
    a = np.where(hard > 0, 1.0, np.where(near, fuzz * 0.8, 0.0))
    return (cv2.GaussianBlur(a.astype(np.float32), (0, 0), 0.7) * 255).astype(np.uint8)


def resample(poly, step=1.0):
    pts = np.array(poly, np.float32)
    # згладити ламану кривою Катмулла–Рома
    out = []
    for i in range(len(pts) - 1):
        p0, p1, p2, p3 = pts[max(i - 1, 0)], pts[i], pts[i + 1], pts[min(i + 2, len(pts) - 1)]
        for t in np.linspace(0, 1, 40, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(pts[-1])
    out = np.array(out)
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(out, axis=0), axis=1))]
    s = np.arange(0, d[-1], step)
    return np.stack([np.interp(s, d, out[:, 0]), np.interp(s, d, out[:, 1])], 1)


def strip(img, alpha, center):
    c = resample(center)
    tang = np.gradient(c, axis=0)
    tang /= np.linalg.norm(tang, axis=1, keepdims=True)
    norm = np.stack([-tang[:, 1], tang[:, 0]], 1)
    offs = np.arange(-STRIP_HALF, STRIP_HALF + 1, dtype=np.float32)
    mapx = (c[:, 0][None, :] + norm[:, 0][None, :] * offs[:, None]).astype(np.float32)
    mapy = (c[:, 1][None, :] + norm[:, 1][None, :] * offs[:, None]).astype(np.float32)
    rgb = cv2.remap(img, mapx, mapy, cv2.INTER_LINEAR)
    a = cv2.remap(alpha, mapx, mapy, cv2.INTER_LINEAR)
    # центрувати: зсунути кожен стовпчик за центроїдом альфи (лінія розмітки не ідеальна)
    ys = np.arange(a.shape[0])[:, None]
    cy = (a.astype(np.float32) * ys).sum(0) / np.maximum(a.sum(0), 1)
    cy = cv2.GaussianBlur(cy.reshape(1, -1).astype(np.float32), (0, 0), 6).ravel()
    shift = cy - STRIP_HALF
    mapy2 = (np.arange(a.shape[0])[:, None] + shift[None, :]).astype(np.float32)
    mapx2 = np.tile(np.arange(a.shape[1], dtype=np.float32), (a.shape[0], 1))
    rgb = cv2.remap(rgb, mapx2, mapy2, cv2.INTER_LINEAR)
    a = cv2.remap(a, mapx2, mapy2, cv2.INTER_LINEAR)
    # безшовність: перехресне згасання кінців
    L, F = rgb.shape[1], 48
    rgb, a = rgb.astype(np.float32), a.astype(np.float32)
    w = np.linspace(0, 1, F)[None, :, None]
    rgb[:, :F] = rgb[:, :F] * w + rgb[:, L - F :] * (1 - w)
    a[:, :F] = a[:, :F] * w[..., 0] + a[:, L - F :] * (1 - w[..., 0])
    return rgba(rgb[:, : L - F].astype(np.uint8), a[:, : L - F].astype(np.uint8))


def run():
    out = OUT / "yarn"
    tangle = cv2.imread(str(PKG / "03_yarn/yarn_tangled_start.png"))
    wound = cv2.imread(str(PKG / "03_yarn/yarn_wound_finish.png"))

    tm = yarn_mask(tangle)
    tail = poly_mask(tangle.shape, TANGLE_TAIL)
    tail_only = cv2.bitwise_and(tm, tail)
    mass = cv2.bitwise_and(tm, cv2.bitwise_not(tail))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(mass)
    keep = np.zeros_like(mass)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] > 400:
            keep[lab == i] = 255
    mass_rgba, (mx, my, mw, mh) = crop_rgba(rgba(tangle, soft_alpha(tangle, solid_core(keep))))
    save_webp(out / "tangle.webp", mass_rgba, 84)

    wm = yarn_mask(wound)
    ell = np.zeros_like(wm)
    cv2.ellipse(ell, (BALL[0], BALL[1], 0), 255, -1)
    inner_ell = cv2.erode(ell, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)))
    ball = np.maximum(cv2.bitwise_and(wm, ell), inner_ell)
    ball_rgba, (bx, by, bw, bh) = crop_rgba(rgba(wound, soft_alpha(wound, ball)))
    save_webp(out / "ball.webp", ball_rgba, 84)

    st = strip(tangle, soft_alpha(tangle, tail_only), TAIL_CENTER)
    save_webp(out / "strand.webp", st, 88)

    # фон (поверхня) — без пряжі, для узгодженого тла сцени
    bg = cv2.inpaint(cv2.resize(tangle, (314, 314), interpolation=cv2.INTER_AREA), cv2.resize(cv2.dilate(tm, np.ones((9, 9), np.uint8)), (314, 314)), 9, cv2.INPAINT_TELEA)
    bg = cv2.GaussianBlur(bg, (0, 0), 3)
    save_webp(out / "surface.webp", cv2.resize(bg, (628, 628), interpolation=cv2.INTER_CUBIC), 70)

    write_json(out / "yarn.json", {
        "size": [tangle.shape[1], tangle.shape[0]],
        "tangle": {"x": mx, "y": my, "w": mw, "h": mh, "exit": TANGLE_EXIT},
        "ball": {"x": bx, "y": by, "w": bw, "h": bh, "cx": BALL[0][0], "cy": BALL[0][1], "r": BALL[1][0] / 2},
        "strand": {"w": int(st.shape[1]), "h": int(st.shape[0]), "thickness": 22},
    })
    print("yarn ok", st.shape)


if __name__ == "__main__":
    run()
