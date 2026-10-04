"""Свічка (референс 02, середня панель): кадр без полумʼя (полумʼя малюється наживо), варіант «не горить»,
фактура дерева сірника (пряма смуга з лівої панелі).

Освітлення від полумʼя відокремлюємо грубо: «не горить» = той самий кадр, приглушений і охолоджений сильніше там,
куди падало світло полумʼя. У браузері між ними змішується за силою й мерехтінням живого полумʼя.
"""
import cv2
import numpy as np

from common import OUT, load_ref, save_webp, write_json

X0, X1 = 622, 1252
WICK_TIP = (321, 273)
FLAME_BOX = (282, 105, 362, 292)  # x0, y0, x1, y1 у координатах кадру


def run():
    out = OUT / "candle"
    im = load_ref("02_candle.png")
    frame = im[:, X0:X1].copy()
    h, w = frame.shape[:2]

    # --- прибрати полумʼя (фон за ним темний і однорідний) ---
    x0, y0, x1, y1 = FLAME_BOX
    lum = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    m = np.zeros((h, w), np.uint8)
    box = lum[y0:y1, x0:x1]
    # усе полумʼя з ореолом (фон тут темний і рівний); гніт домальовується в сцені
    cv2.ellipse(m, ((WICK_TIP[0] + 1, 195), (88, 200), 0), 255, -1)
    m[y0:y1, x0:x1] = np.maximum(m[y0:y1, x0:x1], (box > 30).astype(np.uint8) * 255)
    m[284:, :] = 0
    base = cv2.inpaint(frame, m, 15, cv2.INPAINT_TELEA)
    # інпейнт у темряві лишає мʼяку пляму — підкласти фактуру фону з сусідньої смуги
    bg = frame[110:290, 420:520].astype(np.float32)
    bg = cv2.resize(bg, (110, 200))
    lowbg = cv2.GaussianBlur(bg, (0, 0), 8)
    det = bg - lowbg
    mm = cv2.GaussianBlur(m, (0, 0), 6).astype(np.float32) / 255
    yy0, xx0 = 95, WICK_TIP[0] - 55
    reg = base[yy0 : yy0 + 200, xx0 : xx0 + 110].astype(np.float32)
    reg = reg + det * mm[yy0 : yy0 + 200, xx0 : xx0 + 110, None]
    base[yy0 : yy0 + 200, xx0 : xx0 + 110] = np.clip(reg, 0, 255).astype(np.uint8)
    # світлий слід основи полумʼя біля ґнота — замінити темним фоном збоку (ґніт домальовується в сцені)
    patch_m = np.zeros((h, w), np.float32)
    cv2.ellipse(patch_m, ((322, 262), (70, 52), 0), 1.0, -1)
    patch_m[283:, :] = 0
    patch_m = cv2.GaussianBlur(patch_m, (0, 0), 4)
    side = np.roll(base, 58, axis=0).astype(np.float32)  # та сама тепла імла трохи вище
    base = (base.astype(np.float32) * (1 - patch_m[..., None]) + side * patch_m[..., None]).astype(np.uint8)
    yy, xx = np.mgrid[0:h, 0:w]
    save_webp(out / "lit.webp", base, 88)

    # --- «не горить»: світло полумʼя згасло ---
    d = np.hypot((xx - WICK_TIP[0]) / 1.0, (yy - WICK_TIP[1]) / 1.25)
    flame_light = np.clip(1.15 - d / 380.0, 0, 1) ** 1.4
    f = base.astype(np.float32)
    ambient = 0.30 + 0.25 * (1 - flame_light)
    unlit = f * (ambient * (1 - 0.55 * flame_light))[..., None]
    # холодніше: менше червоного/жовтого
    unlit[..., 2] *= 0.82
    unlit[..., 1] *= 0.9
    unlit[..., 0] *= 1.02
    # відблиск полумʼя на столі
    refl = ((yy > 690) & (lum > 60)).astype(np.float32)
    refl = cv2.GaussianBlur(refl, (0, 0), 12)
    unlit *= (1 - 0.6 * refl)[..., None]
    save_webp(out / "unlit.webp", np.clip(unlit, 0, 255).astype(np.uint8), 86)

    # --- та сама свічка окремим спрайтом (для «Побудь тут»): свічка + кам'яна підставка ---
    sm = np.zeros((h, w), np.uint8)
    cv2.rectangle(sm, (198, 300), (453, 640), 255, -1)
    cv2.ellipse(sm, ((325, 304), (255, 50), 0), 255, -1)
    cv2.ellipse(sm, ((319, 648), (466, 150), 0), 255, -1)
    sm = cv2.GaussianBlur(sm, (0, 0), 1.2)
    sy0, sy1, sx0, sx1 = 270, 730, 80, 560
    for name, img in (("lit-sprite", base), ("unlit-sprite", np.clip(unlit, 0, 255).astype(np.uint8))):
        save_webp(out / f"{name}.webp", np.dstack([img[sy0:sy1, sx0:sx1], sm[sy0:sy1, sx0:sx1]]), 90)

    # --- дерево сірника: випрямлена смуга з лівої панелі ---
    a = np.array([0.0, 126.0])
    b = np.array([196.0, 211.0])
    L = float(np.hypot(*(b - a)))
    ux, uy = (b - a) / L
    S = 20
    src = np.float32([a, a + [ux * L, uy * L], a + [-uy * S, ux * S]])
    dst = np.float32([[0, S / 2], [L, S / 2], [0, S / 2 + S]])
    M = cv2.getAffineTransform(src, dst)
    strip = cv2.warpAffine(im, M, (int(L), S * 2), flags=cv2.INTER_CUBIC)[S // 2 - 6 : S // 2 + 7]
    # світло від полумʼя на смузі нерівне — вирівняти вздовж, лишити зерно
    g = strip.astype(np.float32)
    col = cv2.GaussianBlur(g.mean(axis=0, keepdims=True), (0, 0), 25)
    g = g / np.maximum(col, 1) * np.array([95, 140, 185], np.float32)
    save_webp(out / "match.webp", np.clip(g, 0, 255).astype(np.uint8), 90)

    write_json(
        out / "candle.json",
        {
            "size": [w, h],
            "wick": {"tip": WICK_TIP, "base": [322, 318]},
            # верх свічки (еліпс) — калюжка розтопленого воску
            "top": {"cx": 324, "cy": 314, "rx": 112, "ry": 22},
            "matchStrip": [int(strip.shape[1]), int(strip.shape[0])],
            "sprite": {"x": 80, "y": 270, "w": 480, "h": 460},
        },
    )
    print("candle ok", w, h, strip.shape)


if __name__ == "__main__":
    run()
