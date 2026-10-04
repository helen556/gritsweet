"""Купюра вправи: лицьовий бік 1000 грн із наданого референсу. Лише гривня (пакет змін 04.10.2026)."""
import cv2
import numpy as np

from common import OUT, PKG, save_webp, write_json

W = 1080  # повна роздільність референсу: на телефоні з DPR 3 купюра не розмивається


def note(img, box):
    x0, y0, x1, y1 = box
    n = img[y0:y1, x0:x1]
    h = round(n.shape[0] * W / n.shape[1])
    n = cv2.resize(n, (W, h), interpolation=cv2.INTER_AREA)
    # тонкий край паперу
    cv2.rectangle(n, (0, 0), (W - 1, h - 1), (150, 150, 150), 1)
    return n


def run():
    out = OUT / "money"
    meta = {"notes": {}}
    u1000 = cv2.imread(str(PKG / "01_money/uah_1000_reference.jpg"))
    n = note(u1000, (0, 75, u1000.shape[1], 575))
    save_webp(out / "uah-1000.webp", n, 86)
    meta["notes"]["uah-1000"] = {"w": n.shape[1], "h": n.shape[0]}
    write_json(out / "money.json", meta)
    print("money ok", list(meta["notes"]))


if __name__ == "__main__":
    run()
