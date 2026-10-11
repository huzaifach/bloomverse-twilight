#!/usr/bin/env python3
"""Pack sliced PNGs into 2048px atlases (Phaser JSON-hash format). Deterministic."""
import json
import os
import sys

from PIL import Image

REPO = os.path.expanduser("~/workspace/bloomverse-twilight")
SRC = os.path.expanduser("~/workspace/bloomverse-twilight-art-src")
DST = os.path.join(REPO, "public", "assets", "atlases")
MAX = 2048
PAD = 4

GROUPS = {
    # (files, max dimension px — 384 keeps 3x supersample over ~120px display)
    "game": ([f"{f}_t{i}.png" for f in ("sylvani", "prism", "dusk", "astral")
              for i in range(1, 9)]
             + [f"hybrid_{i}.png" for i in range(1, 9)]
             + ["spirit-moss-keeper.png", "spirit-dusk-moth.png",
                "spirit-star-wisp.png", "spirit-bramble.png",
                "spirit-ember-wisp.png", "spirit-nightchoir.png",
                "spirit-thorn.png", "spirit-crystal-wisp.png",
                "spirit-mooncap-elder.png", "spirit-petal-dancer.png",
                "spirit-root-guardian.png", "spirit-gloom-batling.png"], 384),
    "ui": (["tile-withered.png", "tile-parchment.png", "wish-pod.png",
            "star-pot.png", "icon-moondew.png", "icon-stardust.png",
            "icon-renown.png", "icon-gear.png", "panel-parchment.png",
            "panel-umbral.png", "ribbon-banner.png", "button-amber.png",
            "pill-label.png", "divider-flourish.png", "icon-sleeping-moon.png",
            "coach-hand.png", "frame-spirit-card.png", "track-starchart.png",
            "fx-gold-burst.png", "ornament-corner.png", "tex-parchment.png",
            "tex-umbral.png", "tex-nightteal.png", "tex-moss.png",
            "blessing-sunrise.png", "blessing-rain.png", "blessing-moon.png",
            "blessing-star.png", "blessing-leaf.png", "blessing-crystal.png",
            "blessing-moth.png", "blessing-heart.png",
            "medal-bronze.png", "medal-silver.png", "medal-gold.png",
            "medal-star-prestige.png",
            "pot-clay.png", "pot-star.png", "pot-astral.png",
            "withered-heart.png", "charm-raincaller.png", "moth-moon.png"], 768),
}


def pack(files, max_dim):
    items = []
    for f in sorted(files):
        p = os.path.join(SRC, f)
        if not os.path.exists(p):
            print(f"MISSING sprite: {f}", file=sys.stderr)
            sys.exit(1)
        im = Image.open(p).convert("RGBA")
        if max(im.size) > max_dim:
            im.thumbnail((max_dim, max_dim), Image.LANCZOS)
        items.append((f, im))
    items.sort(key=lambda t: (-t[1].height, -t[1].width, t[0]))
    pages = []  # each: {"img","frames","shelves":[{y,h,x}]}

    def new_page():
        pg = {"img": Image.new("RGBA", (MAX, MAX), (0, 0, 0, 0)),
              "frames": {}, "shelves": []}
        pages.append(pg)
        return pg

    for name, im in items:
        w, h = im.size
        placed = False
        for pg in pages:
            for sh in pg["shelves"]:
                if h <= sh["h"] and sh["x"] + w + PAD <= MAX:
                    x, y = sh["x"], sh["y"]
                    pg["img"].alpha_composite(im, (x, y))
                    pg["frames"][name] = {"x": x, "y": y, "w": w, "h": h}
                    sh["x"] += w + PAD
                    placed = True
                    break
            if placed:
                break
            bottom = max((s["y"] + s["h"] for s in pg["shelves"]), default=0)
            if bottom + h + PAD <= MAX and w + PAD <= MAX:
                pg["img"].alpha_composite(im, (0, bottom))
                pg["frames"][name] = {"x": 0, "y": bottom, "w": w, "h": h}
                pg["shelves"].append({"y": bottom, "h": h + PAD, "x": w + PAD})
                placed = True
                break
        if not placed:
            pg = new_page()
            pg["img"].alpha_composite(im, (0, 0))
            pg["frames"][name] = {"x": 0, "y": 0, "w": w, "h": h}
            pg["shelves"].append({"y": 0, "h": h + PAD, "x": w + PAD})
    return pages


def main():
    os.makedirs(DST, exist_ok=True)
    # clear old atlases
    for f in os.listdir(DST):
        os.remove(os.path.join(DST, f))
    total = 0
    for group, (files, max_dim) in GROUPS.items():
        for n, pg in enumerate(pack(files, max_dim)):
            img, frames = pg["img"], pg["frames"]
            bbox = img.getbbox()
            ox, oy = (bbox[0], bbox[1]) if bbox else (0, 0)
            img = img.crop(bbox) if bbox else img
            webp = f"atlas-{group}-{n}.webp"
            img.save(os.path.join(DST, webp), "WEBP", quality=85, method=6)
            data = {"frames": {
                name: {"frame": {"x": f["x"] - ox, "y": f["y"] - oy,
                                 "w": f["w"], "h": f["h"]},
                        "rotated": False, "trimmed": False,
                        "spriteSourceSize": {"x": 0, "y": 0,
                                             "w": f["w"], "h": f["h"]},
                        "sourceSize": {"w": f["w"], "h": f["h"]}}
                for name, f in frames.items()},
                "meta": {"app": "bloomverse-packer", "version": "1.0",
                         "image": webp,
                         "size": {"w": img.size[0], "h": img.size[1]},
                         "scale": "1"}}
            with open(os.path.join(DST, f"atlas-{group}-{n}.json"), "w") as fh:
                json.dump(data, fh)
            total += len(frames)
            print(f"{webp}: {img.size[0]}x{img.size[1]}, {len(frames)} frames")
    print("ATLAS_SPRITES", total)


if __name__ == "__main__":
    main()
