"""Лоток: дерево + пісок без камінців (дорисований), окремі камінці, карта висот піску й маска піску."""
import cv2
import numpy as np

from common import OUT, crop_rgba, rgba, save_webp, smooth_mask, synthesize_hidden, write_json

# Прямокутники камінців на sand_mixed_stones_start.png (1536×1024), розмічені вручну.
RECTS = [
    (255, 197, 400, 305), (553, 195, 668, 275), (757, 212, 845, 310), (428, 300, 536, 397),
    (268, 360, 374, 442), (678, 340, 768, 448), (797, 440, 872, 518), (418, 477, 540, 563),
    (620, 511, 730, 582), (250, 540, 342, 625), (518, 617, 620, 690), (723, 640, 842, 722),
    (265, 656, 424, 770),
]
INNER = (215, 161, 1321, 791)  # дно лотка (піщана й вільна частини)
LIGHT = np.array([-0.45, -0.75, 0.5])  # світло зверху зліва, як на фото
GRID = 4  # карта висот — 1/4 роздільності


def stone_mask(img, rect, i):
    x0, y0, x1, y1 = rect
    m = np.zeros(img.shape[:2], np.uint8)
    pad = 10
    r = (x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad)
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    m[:] = cv2.GC_BGD
    m[r[1] : r[1] + r[3], r[0] : r[0] + r[2]] = cv2.GC_PR_BGD
    cv2.ellipse(m, (((x0 + x1) / 2, (y0 + y1) / 2), ((x1 - x0) * 0.98, (y1 - y0) * 0.98), 0), int(cv2.GC_PR_FGD), -1)
    cv2.ellipse(m, (((x0 + x1) / 2, (y0 + y1) / 2), ((x1 - x0) * 0.55, (y1 - y0) * 0.55), 0), int(cv2.GC_FGD), -1)
    cv2.grabCut(img, m, None, bgd, fgd, 6, cv2.GC_INIT_WITH_MASK)
    fg = np.where((m == cv2.GC_FGD) | (m == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(fg)
    if n > 1:
        k = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        fg = np.where(lab == k, 255, 0).astype(np.uint8)
    # камінці гладкі й опуклі — опукла оболонка + легке згладжування
    cnts, _ = cv2.findContours(fg, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    hull = cv2.convexHull(max(cnts, key=cv2.contourArea))
    out = np.zeros_like(fg)
    cv2.fillPoly(out, [hull], 255)
    return cv2.erode(out, np.ones((3, 3), np.uint8))


def integrate(g, l):
    """Висоти з відтінку: g = -(lx·Hx + ly·Hy). Розвʼязок у частотній області з регуляризацією."""
    h, w = g.shape
    ky = np.fft.fftfreq(h)[:, None] * 2 * np.pi
    kx = np.fft.fftfreq(w)[None, :] * 2 * np.pi
    D = -1j * (l[0] * kx + l[1] * ky)
    G = np.fft.fft2(g - g.mean())
    eps = 0.02
    H = G * np.conj(D) / (np.abs(D) ** 2 + eps * (kx**2 + ky**2) + 1e-6)
    H[0, 0] = 0
    return np.real(np.fft.ifft2(H))


def run():
    img = cv2.imread(str(__import__("common").PKG / "04_sand/sand_mixed_stones_start.png"))
    out = OUT / "sand"
    H, W = img.shape[:2]
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    Lc = cv2.GaussianBlur(lab[:, :, 0], (0, 0), 3)

    stones = []
    all_st = np.zeros((H, W), np.uint8)
    for i, r in enumerate(RECTS):
        m = stone_mask(img, r, i)
        stones.append(m)
        all_st = np.maximum(all_st, m)

    # Пісок: світла ділянка в межах дна (разом із місцями під камінцями).
    x0, y0, x1, y1 = INNER
    inner = np.zeros((H, W), np.uint8)
    inner[y0:y1, x0:x1] = 255
    sand = ((Lc > 150) & (inner > 0)).astype(np.uint8) * 255
    sand = np.maximum(sand, cv2.dilate(all_st, np.ones((15, 15), np.uint8)) & inner)
    sand = cv2.morphologyEx(sand, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
    sand = cv2.morphologyEx(sand, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))

    # Прибрати камінці разом із контактною тінню й дорисувати пісок.
    holes = cv2.dilate(all_st, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (29, 29)))
    visible = cv2.bitwise_and(sand, cv2.bitwise_not(holes))
    tray = synthesize_hidden(img, visible, sand, seed=11)

    # «Знеосвітлити» пісок: прибрати брижі (масштаб > 6px), зберегти зерно.
    lum = cv2.cvtColor(tray, cv2.COLOR_BGR2GRAY).astype(np.float32) + 1
    shade_fine = cv2.GaussianBlur(lum, (0, 0), 1.5)
    base = cv2.GaussianBlur(lum, (0, 0), 7)
    target = cv2.GaussianBlur(lum, (0, 0), 70)
    sandf = (sand > 127)
    ratio = np.where(sandf, target / base, 1.0)
    albedo = np.clip(tray.astype(np.float32) * ratio[..., None], 0, 255).astype(np.uint8)
    feather = cv2.GaussianBlur(sand, (0, 0), 2).astype(np.float32)[..., None] / 255
    tray_delit = (albedo * feather + tray * (1 - feather)).astype(np.uint8)

    # Висоти брижів із відтінку.
    S = np.where(sandf, base / target, 1.0)
    g = cv2.resize(S - 1, (W // GRID, H // GRID), interpolation=cv2.INTER_AREA)
    l = LIGHT / np.linalg.norm(LIGHT)
    hgt = integrate(g * l[2], l) * GRID  # у пікселях фото
    smask = cv2.resize(sand, (W // GRID, H // GRID), interpolation=cv2.INTER_AREA) > 127
    hgt -= np.median(hgt[smask])
    # за межами піску — продовжити найближчими значеннями (без стрибка на краю)
    from scipy import ndimage
    core = cv2.erode(smask.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    _, (iy, ix) = ndimage.distance_transform_edt(~core, return_indices=True)
    hgt = hgt[iy, ix]
    scale = float(np.abs(hgt).max()) or 1.0
    enc = np.clip(hgt / scale * 127.5 + 127.5, 0, 255).astype(np.uint8)
    cv2.imwrite(str(out / "height.png"), enc)
    fade = cv2.GaussianBlur(cv2.erode(cv2.resize(sand, (W // GRID, H // GRID), interpolation=cv2.INTER_AREA), np.ones((3, 3), np.uint8)), (0, 0), 1.5)
    cv2.imwrite(str(out / "mask.png"), fade)

    save_webp(out / "tray.webp", tray_delit, 82)
    meta = {"size": [W, H], "grid": GRID, "heightScale": round(scale, 3), "light": [round(v, 4) for v in l], "inner": INNER, "free": [960, 175, 1300, 780], "stones": []}
    for i, m in enumerate(stones):
        a = smooth_mask(m, 1.0)
        sprite, (x, y, w, h) = crop_rgba(rgba(img, a))
        save_webp(out / f"pebble-{i:02d}.webp", sprite, 86)
        mm = cv2.moments((m > 127).astype(np.uint8))
        meta["stones"].append({"x": x, "y": y, "w": w, "h": h, "cx": round(mm["m10"] / mm["m00"], 1), "cy": round(mm["m01"] / mm["m00"], 1)})
    write_json(out / "sand.json", meta)
    print("sand: stones", len(stones), "heightScale", round(scale, 2))


if __name__ == "__main__":
    run()
