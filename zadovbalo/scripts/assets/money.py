"""Купюри: лицьовий бік 500 і 1000 грн (односторонні зображення), долари — якщо додано ліцензований файл."""
import cv2
import numpy as np

from common import EXTRA, OUT, PKG, save_webp, write_json

W = 640


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
    u500 = cv2.imread(str(PKG / "01_money/uah_500_reference.jpg"))
    u1000 = cv2.imread(str(PKG / "01_money/uah_1000_reference.jpg"))
    for key, img, box in (("uah-500", u500, (0, 0, u500.shape[1], u500.shape[0])), ("uah-1000", u1000, (0, 75, u1000.shape[1], 575))):
        n = note(img, box)
        save_webp(out / f"{key}.webp", n, 84)
        meta["notes"][key] = {"w": n.shape[1], "h": n.shape[0]}
    usd = EXTRA / "money" / "usd_100_front.jpg"
    if usd.exists():
        img = cv2.imread(str(usd))
        n = note(img, (0, 0, img.shape[1], img.shape[0]))
        save_webp(out / "usd-100.webp", n, 84)
        meta["notes"]["usd-100"] = {"w": n.shape[1], "h": n.shape[0]}
    else:
        print("money: немає assets-src/money/usd_100_front.jpg — для USD буде нейтральна символічна купюра")
    write_json(out / "money.json", meta)
    print("money ok", list(meta["notes"]))


if __name__ == "__main__":
    run()
