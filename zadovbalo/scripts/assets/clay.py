"""Глина: безшовна карта дрібного рельєфу (подряпини, пори, мазки) з фото сірої глини."""
import cv2
import numpy as np

from common import OUT, PKG, save_webp, write_json

CROPS = [(320, 290, 570, 520), (370, 600, 620, 880)]
SIZE = 512


def tileable(img):
    """Безшовність: дзеркальне перехресне згасання країв."""
    h, w = img.shape
    out = img.astype(np.float32)
    f = w // 4
    ramp = np.linspace(0, 1, f)
    out[:, :f] = out[:, :f] * ramp + out[:, ::-1][:, :f] * (1 - ramp)
    out[:, w - f :] = out[:, w - f :] * ramp[::-1] + out[:, :f][:, ::-1] * (1 - ramp[::-1])
    out2 = out.copy()
    out2[:f] = out[:f] * ramp[:, None] + out[::-1][:f] * (1 - ramp[:, None])
    out2[h - f :] = out[h - f :] * ramp[::-1][:, None] + out[:f][::-1] * (1 - ramp[::-1][:, None])
    return out2


def run():
    img = cv2.imread(str(PKG / "05_clay/clay_material_reference.jpg"), cv2.IMREAD_GRAYSCALE).astype(np.float32)
    tiles = []
    for x0, y0, x1, y1 in CROPS:
        c = img[y0:y1, x0:x1]
        hp = c - cv2.GaussianBlur(c, (0, 0), 10)
        hp /= max(hp.std(), 1e-3)
        tiles.append(cv2.resize(hp, (SIZE // 2 * 2, SIZE // 2 * 2), interpolation=cv2.INTER_CUBIC))
    t = 0.6 * tiles[0] + 0.4 * tiles[1]
    t = tileable(cv2.resize(t, (SIZE, SIZE)))
    # той самий шар двічі в різних масштабах — менше повторюваності
    enc = np.clip(t / (4 * t.std()) * 127 + 128, 0, 255).astype(np.uint8)
    out = OUT / "clay"
    out.mkdir(parents=True, exist_ok=True)
    save_webp(out / "detail.webp", enc, 88)
    lit = img[300:520, 330:560]
    write_json(out / "clay.json", {"albedo": [round(float(np.percentile(lit, 70)) / 255, 3)] * 3, "detailSize": SIZE})
    print("clay ok")


if __name__ == "__main__":
    run()
