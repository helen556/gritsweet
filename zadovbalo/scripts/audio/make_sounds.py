"""Власні звукові семпли «Видихни» (без сторонніх записів, ліцензія — та сама, що й у проєкту).

Кожен звук синтезовано з фізичних складників: короткий перехідний удар, модальні резонанси матеріалу
(кераміка/скло/метал — різні частоти й загасання), відфільтрований шум і дрібні вторинні удари.
Запуск: python3 scripts/audio/make_sounds.py → public/sounds/*.wav (короткі) та *.mp3 (довгі петлі).
"""
import subprocess
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "sounds"
SR = 44100
rng = np.random.default_rng(20261004)


def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def band(x, lo, hi, order=2):
    nyq = SR / 2
    if lo <= 0:
        sos = butter(order, hi / nyq, "low", output="sos")
    elif hi >= nyq:
        sos = butter(order, lo / nyq, "high", output="sos")
    else:
        sos = butter(order, [lo / nyq, hi / nyq], "band", output="sos")
    return sosfilt(sos, x)


def noise(dur):
    return rng.standard_normal(int(dur * SR))


def env_exp(dur, tau, attack=0.0005):
    t = t_axis(dur)
    a = np.clip(t / max(attack, 1e-6), 0, 1)
    return a * np.exp(-t / tau)


def modes(dur, freqs, taus, amps, jitter=0.0):
    t = t_axis(dur)
    out = np.zeros_like(t)
    for f, tau, a in zip(freqs, taus, amps):
        f = f * (1 + jitter * rng.uniform(-1, 1))
        out += a * np.sin(2 * np.pi * f * t + rng.uniform(0, 2 * np.pi)) * np.exp(-t / tau)
    return out


def place(buf, x, at):
    i = int(at * SR)
    n = min(len(x), len(buf) - i)
    if n > 0:
        buf[i : i + n] += x[:n]


def finish(x, peak=0.7, fade=0.004):
    x = x - np.mean(x)
    f = int(fade * SR)
    if f:
        x[-f:] *= np.linspace(1, 0, f)
    m = np.max(np.abs(x)) or 1
    return x * (peak / m)


def write_wav(name, x, peak=0.7):
    OUT.mkdir(parents=True, exist_ok=True)
    y = (finish(x, peak) * 32767).astype(np.int16)
    with wave.open(str(OUT / f"{name}.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(y.tobytes())


def write_mp3(name, x, peak=0.6, kbps=96):
    tmp = OUT / f"{name}.tmp.wav"
    y = (finish(x, peak, fade=0) * 32767).astype(np.int16)
    with wave.open(str(tmp), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(y.tobytes())
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(tmp), "-c:a", "libmp3lame", "-b:a", f"{kbps}k", str(OUT / f"{name}.mp3")], check=True)
    tmp.unlink()


# ---------- плівка: сухий «поп» ----------
def pop(i):
    d = 0.16
    buf = np.zeros(int(d * SR))
    # розрив мембрани: дуже короткий широкосмуговий клац
    snap = band(noise(0.012), 1200 + 300 * i, 7000) * env_exp(0.012, 0.0018 + 0.0004 * i)
    # повітря виходить: глухий поштовх
    thump = modes(0.05, [170 + 25 * i, 310], [0.012, 0.007], [0.5, 0.25]) * np.clip(t_axis(0.05) / 0.001, 0, 1)
    # плівка мнеться: кілька дрібних тріщинок слідом
    place(buf, snap, 0.002)
    place(buf, thump * 0.35, 0.002)
    for _ in range(3 + i):
        c = band(noise(0.006), 2500, 9000) * env_exp(0.006, 0.0012) * rng.uniform(0.08, 0.22)
        place(buf, c, 0.008 + rng.uniform(0, 0.05))
    return buf


# ---------- кераміка й скло ----------
def ceramic_smash(seed_shift):
    d = 1.4
    buf = np.zeros(int(d * SR))
    hit = band(noise(0.04), 60, 900) * env_exp(0.04, 0.012)  # глухий удар об стіну
    place(buf, hit * 0.9, 0)
    crunch = band(noise(0.25), 900, 8000) * env_exp(0.25, 0.045)
    place(buf, crunch * 0.6, 0.002)
    # уламки: інгармонійні резонанси 1.8–6.5 кГц, коротке загасання (глазурована кераміка)
    for k in range(9):
        base = rng.uniform(1800, 4200)
        f = [base, base * 1.53, base * 2.31]
        place(buf, modes(0.3, f, [0.07, 0.05, 0.03], [0.35, 0.22, 0.12], 0.02) * rng.uniform(0.3, 0.8), rng.uniform(0, 0.06) + 0.003 * seed_shift)
    # падіння дрібних шматків на підлогу
    for _ in range(14):
        base = rng.uniform(2200, 5200)
        x = modes(0.08, [base, base * 1.6], [0.025, 0.015], [0.3, 0.15]) + band(noise(0.08), 2000, 9000) * env_exp(0.08, 0.004) * 0.3
        place(buf, x * rng.uniform(0.08, 0.3), rng.uniform(0.3, 1.25))
    return buf


def glass_smash(seed_shift):
    d = 1.9
    buf = np.zeros(int(d * SR))
    hit = band(noise(0.03), 150, 2500) * env_exp(0.03, 0.006)
    place(buf, hit * 0.55, 0)
    shatter = band(noise(0.5), 2500, 14000) * env_exp(0.5, 0.09)
    place(buf, shatter * 0.55, 0.001)
    # скло: вищі й довші резонанси
    for k in range(14):
        base = rng.uniform(3500, 9000)
        place(buf, modes(0.7, [base, base * 1.38, base * 2.07], [0.25, 0.16, 0.09], [0.25, 0.16, 0.08], 0.03) * rng.uniform(0.25, 0.7), rng.uniform(0, 0.09) + 0.003 * seed_shift)
    for _ in range(22):
        base = rng.uniform(4000, 10500)
        x = modes(0.25, [base, base * 1.45], [0.08, 0.05], [0.25, 0.12])
        x[: int(0.02 * SR)] += band(noise(0.02), 5000, 15000) * env_exp(0.02, 0.002) * 0.4
        place(buf, x * rng.uniform(0.06, 0.25), rng.uniform(0.25, 1.75))
    return buf


def ceramic_tink(i):
    base = 2600 + 700 * i
    x = modes(0.12, [base, base * 1.57, base * 2.2], [0.03, 0.02, 0.012], [0.5, 0.3, 0.15], 0.02)
    x += band(noise(0.12), 1500, 8000) * env_exp(0.12, 0.003) * 0.6
    return x


def glass_tink(i):
    base = 5200 + 1100 * i
    x = modes(0.3, [base, base * 1.41, base * 2.13], [0.1, 0.06, 0.035], [0.45, 0.25, 0.12], 0.02)
    x += band(noise(0.3), 5000, 15000) * env_exp(0.3, 0.0015) * 0.5
    return x


# ---------- блискавка ----------
def zipper_loop():
    """Петля 1 с: ряд дрібних клацань зубців. У браузері швидкість і гучність ідуть за рухом пальця."""
    d = 1.0
    buf = np.zeros(int(d * SR))
    rate = 260
    tpos = 0.0
    while tpos < d - 0.002:
        c = band(noise(0.0025), 1800, 7500) * env_exp(0.0025, 0.0006) * rng.uniform(0.5, 1.0)
        c += modes(0.0025, [rng.uniform(2800, 3600)], [0.0008], [0.4])
        place(buf, c, tpos)
        tpos += (1 / rate) * rng.uniform(0.8, 1.2)
    # тертя тканини
    buf += band(noise(d), 900, 4000) * 0.04
    return buf


def zip_end():
    x = modes(0.09, [2900, 4650, 7100], [0.02, 0.012, 0.007], [0.5, 0.3, 0.15])
    x += band(noise(0.09), 1500, 9000) * env_exp(0.09, 0.0025) * 0.7
    x += modes(0.09, [420], [0.012], [0.3])
    return x


# ---------- свічка ----------
def ignite():
    """Тихе «ф-ф» займання ґнота."""
    d = 0.9
    t = t_axis(d)
    e = np.clip(t / 0.05, 0, 1) * np.exp(-np.maximum(t - 0.05, 0) / 0.25)
    return band(noise(d), 150, 1800) * e


def crackle(i):
    d = 0.05
    x = band(noise(d), 1500 + 600 * i, 7000) * env_exp(d, 0.0012 + 0.0005 * i)
    x += modes(d, [900 + 200 * i], [0.004], [0.2])
    return x


def snuff():
    d = 0.5
    t = t_axis(d)
    e = np.clip(t / 0.02, 0, 1) * np.exp(-t / 0.09)
    return band(noise(d), 80, 900) * e


def match_strike():
    d = 0.6
    t = t_axis(d)
    scratch = band(noise(d), 1500, 7000) * np.clip(t / 0.01, 0, 1) * np.exp(-t / 0.05)
    flare = band(noise(d), 200, 2500) * np.clip((t - 0.04) / 0.03, 0, 1) * np.exp(-np.maximum(t - 0.07, 0) / 0.18)
    return scratch * 0.7 + flare * 0.5


# ---------- банка ----------
def can_click():
    x = modes(0.12, [2150, 4720, 7350, 9800], [0.03, 0.018, 0.01, 0.006], [0.45, 0.35, 0.2, 0.1])
    x += band(noise(0.12), 2000, 12000) * env_exp(0.12, 0.0015) * 0.9
    x += modes(0.12, [520], [0.015], [0.25])
    return x


def can_hiss():
    d = 1.6
    t = t_axis(d)
    e = np.clip(t / 0.006, 0, 1) * (0.75 * np.exp(-t / 0.12) + 0.25 * np.exp(-t / 0.6))
    x = band(noise(d), 2500, 11000) * e
    # дрібні бульбашки
    for _ in range(90):
        at = rng.uniform(0.05, d - 0.05) ** 1.4 / d ** 0.4
        b = modes(0.02, [rng.uniform(1800, 5200)], [0.003], [1.0]) * rng.uniform(0.02, 0.08) * np.exp(-at / 0.8)
        place(x, b, at)
    return x


# ---------- дощ ----------
def rain_loop():
    d = 8.0
    n = int(d * SR)
    base = band(noise(d), 300, 6000) * 0.25 + band(noise(d), 60, 600) * 0.12
    buf = base
    for _ in range(int(d * 45)):
        at = rng.uniform(0, d - 0.05)
        drop = band(noise(0.03), rng.uniform(1500, 3000), 9000) * env_exp(0.03, rng.uniform(0.002, 0.006)) * rng.uniform(0.15, 0.6)
        place(buf, drop, at)
    # безшовна петля: перехресне загасання кінця в початок
    f = int(0.5 * SR)
    w = np.linspace(0, 1, f)
    buf[:f] = buf[:f] * w + buf[n - f :] * (1 - w)
    return buf[: n - f]


def run():
    for i in range(4):
        write_wav(f"pop-{i}", pop(i), 0.8)
    # Довгі звуки — MP3 (затримка кодера ≈25 мс, у межах відчуття синхронності); короткі удари — WAV без затримки.
    for i in range(2):
        write_mp3(f"ceramic-{i}", ceramic_smash(i), 0.75, 112)
        write_mp3(f"glass-{i}", glass_smash(i), 0.7, 112)
    for i in range(3):
        write_wav(f"ceramic-tink-{i}", ceramic_tink(i), 0.6)
        write_wav(f"glass-tink-{i}", glass_tink(i), 0.55)
        write_wav(f"crackle-{i}", crackle(i), 0.5)
    write_wav("zip-loop", zipper_loop(), 0.6)
    write_wav("zip-end", zip_end(), 0.6)
    write_mp3("ignite", ignite(), 0.5, 80)
    write_wav("snuff", snuff(), 0.45)
    write_wav("match", match_strike(), 0.5)
    write_wav("can-click", can_click(), 0.7)
    write_mp3("can-hiss", can_hiss(), 0.55, 96)
    write_mp3("rain", rain_loop(), 0.5)
    print("sounds ok →", OUT)


if __name__ == "__main__":
    run()
