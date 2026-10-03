"""Рюкзак: база (порожній рюкзак), передній клапан (зі стану з камінням), окремі камені з дорисованими прихованими частинами."""
import cv2
import numpy as np

from common import OUT, trim_dark_rim, crop_rgba, edge_shade, load, poly_mask, rgba, save_webp, smooth_mask, synthesize_hidden, write_json

# Контури каменів на backpack_full_stones.png (1254×1254), розмічені вручну.
STONES = {
    "A": [(520,285),(545,265),(580,253),(620,250),(655,258),(680,275),(695,300),(690,325),(670,345),(645,365),(615,378),(590,368),(560,352),(530,338),(512,318),(510,300)],
    "B": [(430,330),(470,322),(505,324),(540,338),(575,355),(610,377),(640,400),(665,422),(684,446),(692,470),(690,495),(678,515),(660,532),(640,550),(615,565),(585,577),(555,583),(520,580),(490,570),(460,560),(430,548),(405,532),(388,510),(380,480),(380,440),(385,400),(395,370),(410,345)],
    "C": [(668,338),(700,322),(735,292),(768,268),(790,261),(812,267),(840,290),(868,328),(893,366),(915,395),(933,425),(947,460),(956,495),(955,525),(946,552),(928,572),(905,588),(880,590),(850,575),(820,555),(790,535),(760,515),(730,500),(705,480),(685,455),(668,420),(660,385)],
    "D": [(685,497),(715,494),(755,504),(790,519),(825,544),(860,569),(900,598),(935,618),(955,634),(962,650),(955,670),(930,690),(900,710),(875,728),(852,736),(830,728),(805,715),(780,705),(750,690),(720,675),(690,662),(668,650),(655,630),(648,600),(648,570),(655,545),(668,520)],
    "E": [(420,580),(450,565),(485,560),(525,565),(560,580),(590,600),(625,630),(650,660),(660,690),(660,740),(640,775),(620,790),(560,800),(480,790),(420,770),(395,745),(390,705),(382,670),(380,630),(390,600)],
    "F": [(662,735),(690,718),(725,711),(760,719),(785,733),(800,752),(804,776),(798,802),(775,818),(730,824),(690,814),(662,795),(652,765)],
}
# Дорисовані (приховані) продовження: камінь за іншим каменем або за тканиною.
HIDDEN_EXT = {
    "A": [(540,350),(600,385),(650,370),(680,340),(640,395),(580,392)],
    "C": [(760,515),(800,560),(850,600),(890,600),(860,620),(800,600)],
    "B": [(470,565),(540,592),(600,580),(560,600),(490,595)],
}
# Порядок від заднього до переднього.
ORDER = ["A", "C", "B", "D", "E", "F"]
# На кому лежить камінь і наскільки (px у координатах фото) осідає без опори.
SUPPORTS = {"A": {"B": 46, "C": 30}, "B": {"E": 38, "D": 24}, "C": {"D": 58}, "D": {"F": 26}, "E": {}, "F": {}}

# Передній клапан і бокові стінки (на фото з камінням) — перекривають камені.
FLAP = [(330,700),(360,712),(385,722),(420,733),(460,745),(500,757),(535,765),(570,775),(600,782),(640,790),(670,793),(710,800),(760,805),(810,800),(840,790),(880,770),(930,740),(965,712),(992,690),(1010,720),(1030,800),(1010,930),(940,1010),(700,1050),(420,1030),(330,960),(300,840)]
LEFT_RIM = [(310,250),(372,262),(378,300),(366,360),(358,430),(352,520),(350,610),(352,700),(300,720),(290,500)]
RIGHT_RIM = [(905,250),(930,300),(950,360),(965,430),(976,520),(986,600),(994,680),(1060,690),(1060,300)]


def run():
    full = load("02_backpack/backpack_full_stones.png")
    empty = load("02_backpack/backpack_empty.png")
    out = OUT / "backpack"
    h, w = full.shape[:2]

    front_fabric = np.maximum.reduce([poly_mask(full.shape, p) for p in (FLAP, LEFT_RIM, RIGHT_RIM)])
    polys = {k: poly_mask(full.shape, v) for k, v in STONES.items()}
    meta = {"size": [w, h], "order": ORDER, "supports": SUPPORTS, "stones": {}}

    for i, k in enumerate(ORDER):
        occl = front_fabric.copy()
        for j in ORDER[i + 1 :]:
            occl = np.maximum(occl, polys[j])
        visible = cv2.bitwise_and(polys[k], cv2.bitwise_not(occl))
        amodal = polys[k].copy()
        if k in HIDDEN_EXT:
            ext = poly_mask(full.shape, HIDDEN_EXT[k])
            amodal = np.maximum(amodal, ext)
        # округлити силует (камені опуклі)
        cnts, _ = cv2.findContours((amodal > 127).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        hull = cv2.convexHull(max(cnts, key=cv2.contourArea))
        amodal = np.zeros_like(amodal)
        cv2.fillPoly(amodal, [hull], 255)
        amodal = cv2.morphologyEx(amodal, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)))
        rgb = synthesize_hidden(full, visible, amodal, seed=i + 3)
        hidden = (amodal > 127) & (visible < 128)
        shaded = edge_shade(rgb, amodal, 0.45, 9)
        rgb = np.where(hidden[..., None], shaded, rgb)
        alpha = smooth_mask(trim_dark_rim(amodal, full, visible), 1.1)
        sprite, (x, y, sw, sh) = crop_rgba(rgba(rgb, alpha))
        save_webp(out / f"stone-{k}.webp", sprite, 84)
        vis_c = visible[y : y + sh, x : x + sw]
        m = cv2.moments((amodal > 127).astype(np.uint8))
        meta["stones"][k] = {
            "x": x, "y": y, "w": sw, "h": sh,
            "cx": round(m["m10"] / m["m00"], 1), "cy": round(m["m01"] / m["m00"], 1),
            "visibleShare": round(float((vis_c > 127).sum()) / float((amodal > 127).sum()), 3),
        }

    # Клапан: беремо з фото з камінням (він вигнутий під вагою), альфа мʼяка.
    flap_alpha = smooth_mask(front_fabric, 1.4)
    flap, (fx, fy, fw, fh) = crop_rgba(rgba(full, flap_alpha))
    save_webp(out / "flap.webp", flap, 80)
    meta["flap"] = {"x": fx, "y": fy, "w": fw, "h": fh}
    # Крива верхнього краю клапана — для деформації «розправляння».
    meta["flapEdge"] = FLAP[:20]
    save_webp(out / "base.webp", empty, 80)
    meta["opening"] = {"x0": 380, "x1": 960, "rimY": 300}
    write_json(out / "backpack.json", meta)
    print("backpack:", {k: v["visibleShare"] for k, v in meta["stones"].items()})


if __name__ == "__main__":
    run()
