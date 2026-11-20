"""Bake data/viz.js (window.VIZ = {...}) for index.html. Run: .venv/bin/python -I build/03_viz.py"""
import json, pathlib, runpy, contextlib, io
from collections import Counter, defaultdict

HERE = pathlib.Path(__file__).resolve().parent
with contextlib.redirect_stdout(io.StringIO()):
    A = runpy.run_path(str(HERE / "02_analyze.py"))
R, rows, ok, cell_n, pts, tract_of, tracts = (A[k] for k in ("R", "rows", "ok", "cell_n", "pts", "tract_of", "tracts"))
DLAT, DLNG = A["DLAT"], A["DLNG"]

# dominant neighborhood per tract (for tooltips)
hood = defaultdict(Counter)
for k in ("waste", "encampment"):
    for lat, lng, n in pts[k]:
        g = tract_of(lat, lng)
        if g and n:
            hood[g][n] += 1

srt = sorted(ok, key=lambda r: r["income"])
terc = {r["geoid"]: i * 3 // len(srt) for i, r in enumerate(srt)}
T = [dict(id=r["geoid"][5:], hood=(hood[r["geoid"]].most_common(1) or [("", 0)])[0][0], pop=int(r["pop"]),
          inc=int(r["income"]), t=terc[r["geoid"]], w=round(r["waste_per_1k"], 1), e=round(r["enc_per_1k"], 1),
          wn=r["waste"], en=r["enc"]) for r in ok]

# cells: [row, col, waste, enc]; which cells make up half of all waste
keys = set(cell_n["waste"]) | set(cell_n["encampment"])
ranked = sorted(cell_n["waste"].items(), key=lambda kv: -kv[1])
half, cum, tot = set(), 0, sum(cell_n["waste"].values())
for c, n in ranked:
    if cum >= tot / 2:
        break
    half.add(c)
    cum += n
# mismatch class: 1 = recurring waste WITH encampment reports nearby, 2 = recurring waste WITHOUT, 3 = encampments without waste
W_, E_ = cell_n["waste"], cell_n["encampment"]
nb = lambda C, c: sum(C.get((c[0] + i, c[1] + j), 0) for i in (-1, 0, 1) for j in (-1, 0, 1))  # ~150 m


def klass(c):
    w, e = W_.get(c, 0), E_.get(c, 0)
    if w >= 5:
        return 2 if nb(E_, c) < 12 else 1
    return 3 if (e >= 12 and nb(W_, c) < 5) else 0


cells = [[c[0], c[1], W_.get(c, 0), E_.get(c, 0), 1 if c in half else 0, klass(c)] for c in keys]
mm = {}
for i, nm in enumerate(("low", "both", "waste_only", "enc_only")):
    cs = [c for c in cells if c[5] == i]
    mm[nm] = dict(blocks=len(cs), waste=sum(c[2] for c in cs), enc=sum(c[3] for c in cs),
                  waste_share=round(sum(c[2] for c in cs) / tot, 3))
R["mismatch"] = mm
json.dump(R, open(HERE.parent / "data" / "results.json", "w"), indent=1)

# tract outlines (decimated) for the basemap
outl = []
for t in tracts:
    for poly in t.polys:
        ring = poly[0]
        step = 3 if len(ring) > 40 else 1
        outl.append([[round(float(x), 4), round(float(y), 4)] for x, y in ring[::step]])

hours = {}
for k in ("waste", "control", "graffiti"):
    wk, we = [0] * 24, [0] * 24
    for r in json.load(open(HERE.parent / "data" / "raw" / f"hours_{k}.json")):
        (we if int(r["d"]) in (0, 6) else wk)[int(r["h"])] += int(r["n"])
    hours[k] = dict(weekday=[round(100 * x / sum(wk), 1) for x in wk], weekend=[round(100 * x / sum(we), 1) for x in we],
                    weekday_per_day=round(sum(wk) / 5 / 52), weekend_per_day=round(sum(we) / 2 / 52))

# ---- hot-block "islands": connected clusters of the blocks that hold half of all waste reports ----
import re, urllib.parse, urllib.request
cell_of = A["cell_of"]
cell_hood = defaultdict(Counter)
for lat, lng, n in pts["waste"]:
    cell_hood[cell_of(lat, lng)][n] += 1
seen, comps = set(), []
for c in half:
    if c in seen:
        continue
    stack, comp = [c], []
    seen.add(c)
    while stack:
        x = stack.pop()
        comp.append(x)
        for i in (-1, 0, 1):
            for j in (-1, 0, 1):
                nbr = (x[0] + i, x[1] + j)
                if nbr in half and nbr not in seen:
                    seen.add(nbr)
                    stack.append(nbr)
    comps.append(comp)
comps.sort(key=lambda k: -sum(W_[c] for c in k))
cache = HERE.parent / "data" / "raw" / "cluster_streets.json"
streets_cache = json.loads(cache.read_text()) if cache.exists() else {}
clusters = []
for rank, comp in enumerate(comps[:6], 1):
    hc = Counter()
    for c in comp:
        hc.update(cell_hood[c])
    top = hc.most_common(2)
    name = top[0][0] + (" and " + top[1][0] if len(top) > 1 and top[1][1] >= 0.25 * sum(hc.values()) else "")
    lat0, lat1 = min(c[0] for c in comp) * DLAT, (max(c[0] for c in comp) + 1) * DLAT
    lng0, lng1 = (min(c[1] for c in comp) - 1) * DLNG, max(c[1] for c in comp) * DLNG
    key = f"{lat0:.4f},{lat1:.4f},{lng0:.4f},{lng1:.4f}"
    if key not in streets_cache:  # busiest streets inside the cluster's bounding box (public 311 data)
        q = ("SELECT street, count(*) AS n WHERE service_details = 'human_waste_or_urine' "
             "AND requested_datetime >= '2025-11-01' AND requested_datetime < '2026-11-01' "
             f"AND lat >= {lat0} AND lat < {lat1} AND long >= {lng0} AND long < {lng1} AND street IS NOT NULL "
             "GROUP BY street ORDER BY n DESC LIMIT 3")
        url = "https://data.sf.gov/resource/vw6y-z8j6.json?" + urllib.parse.urlencode({"$query": q})
        streets_cache[key] = [r["street"].title() for r in json.load(urllib.request.urlopen(url, timeout=60))]
        cache.write_text(json.dumps(streets_cache))
    clusters.append(dict(rank=rank, name=name, blocks=len(comp), reports=sum(W_[c] for c in comp),
                         share=round(sum(W_[c] for c in comp) / tot, 3), streets=[re.sub(r"(\d)(Th|St|Nd|Rd)\b", lambda m: m.group(1) + m.group(2).lower(), x) for x in streets_cache[key]],
                         cells=[[c[0], c[1], W_[c]] for c in comp]))
    print(rank, name, len(comp), clusters[-1]["reports"], clusters[-1]["share"], streets_cache[key])
R["clusters_total"] = len(comps)

# ---- public toilets (DataSF: Public Bathrooms `wfq4-upmv`, Pit Stops `mr6h-cr3u`) ----
import math
RAWD = HERE.parent / "data" / "raw"
toilets = []
for p_ in json.load(open(RAWD / "pitstops.json")):
    if not p_.get("location"):
        continue
    hrs = (p_.get("hours") or "").strip()
    lng_, lat_ = p_["location"]["coordinates"]
    toilets.append(dict(lat=lat_, lng=lng_, name=p_["name"] + ", " + p_.get("address", ""), pit=1, hours=hrs or "Hours not listed",
                        night=1 if ("24 hours" in hrs or "6pm to 6am" in hrs) else 0))
for r_ in json.load(open(RAWD / "restrooms.json")):
    if r_.get("source") == "pit_stop" or not r_.get("latitude"):
        continue
    o, c_ = r_.get("public_access_hours_open"), r_.get("public_access_hours_close")
    toilets.append(dict(lat=float(r_["latitude"]), lng=float(r_["longitude"]), name=r_.get("name", "Public restroom"), pit=0,
                        hours=f"{o[:5]} to {c_[:5]}" if o and c_ else "Hours not listed", night=1 if (o, c_) == ("00:00:00", "24:00:00") else 0))
dist = lambda a, b: math.hypot((a[0] - b[0]) * 111320, (a[1] - b[1]) * 111320 * math.cos(math.radians(37.77)))


def near_stats(key, S):
    ds = sorted((min(dist(((c[0] + .5) * DLAT, (c[1] - .5) * DLNG), s) for s in S), n) for c, n in cell_n[key].items())
    t_, cum_ = sum(n for _, n in ds), 0
    for d, n in ds:
        cum_ += n
        if cum_ >= t_ / 2:
            med = d
            break
    return dict(median_m=round(med), within_300m=round(sum(n for d, n in ds if d <= 300) / t_, 3))


allT = [(t["lat"], t["lng"]) for t in toilets]
pitT = [(t["lat"], t["lng"]) for t in toilets if t["pit"]]
by = lambda t, S: any((cell_of(t["lat"], t["lng"])[0] + i, cell_of(t["lat"], t["lng"])[1] + j) in S for i in (-1, 0, 1) for j in (-1, 0, 1))
for t in toilets:
    t["hot"] = 1 if by(t, half) else 0
for k in clusters:
    cs = {(c[0], c[1]) for c in k["cells"]}
    k["pit_stops"] = sum(1 for t in toilets if t["pit"] and by(t, cs))
    k["pit_night"] = sum(1 for t in toilets if t["pit"] and t["night"] and by(t, cs))
    k["restrooms"] = sum(1 for t in toilets if by(t, cs))
R["toilets"] = dict(
    total=len(toilets), pit_stops=len(pitT), pit_near_hot=sum(t["hot"] for t in toilets if t["pit"]),
    pit_near_hot_overnight=sum(1 for t in toilets if t["pit"] and t["hot"] and t["night"]),
    restrooms_near_hot=sum(t["hot"] for t in toilets),
    any_restroom={k: near_stats(k, allT) for k in ("waste", "control", "encampment")},
    pit_stop={k: near_stats(k, pitT) for k in ("waste", "control", "encampment")})
json.dump(R, open(HERE.parent / "data" / "results.json", "w"), indent=1)
print(json.dumps(R["toilets"]))
print([(k["rank"], k["pit_stops"], k["pit_night"], k["restrooms"]) for k in clusters])

V = dict(toilets=toilets, clusters=clusters, n_clusters=len(comps), dlat=DLAT, dlng=DLNG, cells=cells, tracts=T, outlines=outl, hours=hours, results=R)
(HERE.parent / "data" / "viz.js").write_text("window.VIZ=" + json.dumps(V, separators=(",", ":")) + ";")
print("cells", len(cells), "half-cells", len(half), "tracts", len(T), "bytes", (HERE.parent / "data" / "viz.js").stat().st_size)
print(json.dumps(hours["waste"]))
