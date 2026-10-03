# Конвеєр матеріалів сцен

Джерело — пакет `Vydyhny_Claude_Package/assets/` у корені репозиторію (фото-референси). Результат — `public/scenes/<сцена>/`.

```
pip install opencv-python-headless numpy scipy
cd zadovbalo/scripts/assets
python3 backpack.py && python3 sand.py && python3 yarn.py && python3 money.py && python3 clay.py && python3 map.py
```

- `backpack.py` — порожній рюкзак як основа, передній клапан, 6 окремих каменів (приховані частини дорисовано фактурою того ж каменю).
- `sand.py` — лоток без камінців (пісок дорисовано), 13 камінців, карта висот брижів (`height.png`) і маска піску.
- `yarn.py` — заплутана маса без хвоста, клубок, смуга фактури нитки для динамічної нитки.
- `money.py` — лицьовий бік 500/1000 грн. Долари — лише якщо додано ліцензований `assets-src/money/usd_100_front.jpg`.
- `clay.py` — безшовний дрібний рельєф глини.
- `map.py` — фактура з фото на перевіреному контурі (Natural Earth, без Криму), спрайти полумʼя.

Стан: матеріали готуються; сцени на них ще в роботі.
