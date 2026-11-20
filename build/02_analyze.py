"""Tract- and block-level cross-reference: 311 waste vs encampments, density, income, housing cost.
Run: .venv/bin/python -I build/02_analyze.py   -> prints findings, writes data/tracts.csv + data/results.json
"""
import csv, json, math, pathlib
from collections import Counter, defaultdict
import warnings
import numpy as np
warnings.filterwarnings('ignore', message='.*encountered in matmul')  # spurious numpy2+Accelerate warning

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
R = {}  # results


def load_points(key):
    with open(RAW / f"{key}.csv") as f:
        return [(float(r["lat"]), float(r["long"]), r["analysis_neighborhood"]) for r in csv.DictReader(f)
                if r["lat"] and r["long"]]


# ---------- tracts ----------
def rings_of(geom):
    polys = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
    return [[np.array(ring) for ring in poly] for poly in polys]


def in_ring(x, y, ring):
    xs, ys = ring[:, 0], ring[:, 1]
    x2, y2 = np.roll(xs, -1), np.roll(ys, -1)
    cond = (ys > y) != (y2 > y)
    with np.errstate(divide="ignore", invalid="ignore"):
        xi = (x2 - xs) * (y - ys) / (y2 - ys) + xs
    return bool(np.count_nonzero(cond & (x < xi)) % 2)


class Tract:
    def __init__(self, feat):
        p = feat["properties"]
        self.geoid, self.area_km2 = p["GEOID"], p["AREALAND"] / 1e6
        self.polys = rings_of(feat["geometry"])
        allpts = np.vstack([r for poly in self.polys for r in poly])
        self.bbox = (allpts[:, 0].min(), allpts[:, 1].min(), allpts[:, 0].max(), allpts[:, 1].max())

    def contains(self, x, y):
        b = self.bbox
        if not (b[0] <= x <= b[2] and b[1] <= y <= b[3]):
            return False
        for poly in self.polys:
            if in_ring(x, y, poly[0]) and not any(in_ring(x, y, h) for h in poly[1:]):
                return True
        return False


tracts = [Tract(f) for f in json.load(open(RAW / "tracts.geojson"))["features"]]
tracts = [t for t in tracts if t.area_km2 > 0]

# ~100 m cells; assign each *cell* (by its centre) to a tract once, then points inherit it
DLAT, DLNG = 0.0009, 0.00114
cell_of = lambda lat, lng: (int(lat / DLAT), int(lng / DLNG))
_cell_tract = {}


def tract_of(lat, lng):
    c = cell_of(lat, lng)
    if c not in _cell_tract:
        y, x = (c[0] + 0.5) * DLAT, (c[1] - 0.5) * DLNG  # lng negative -> int() truncates toward 0
        _cell_tract[c] = next((t.geoid for t in tracts if t.contains(x, y)), None) or \
            next((t.geoid for t in tracts if t.contains(lng, lat)), None)
    return _cell_tract[c]


pts = {k: load_points(k) for k in ("waste", "encampment", "control")}
tract_n = {k: Counter() for k in pts}
cell_n = {k: Counter() for k in pts}
for k, plist in pts.items():
    for lat, lng, _ in plist:
        cell_n[k][cell_of(lat, lng)] += 1
        g = tract_of(lat, lng)
        if g:
            tract_n[k][g] += 1
R["totals"] = {k: len(v) for k, v in pts.items()}
R["assigned_to_tract"] = {k: sum(tract_n[k].values()) for k in pts}

# ---------- ACS ----------
acs_rows = json.load(open(RAW / "acs.json"))
hdr = acs_rows[0]
acs = {}
for row in acs_rows[1:]:
    d = dict(zip(hdr, row))
    num = lambda v: (float(v) if v not in (None, "") and float(v) > -1e8 else None)
    acs["06075" + d["tract"]] = dict(
        pop=num(d["B01003_001E"]), units=num(d["B25001_001E"]), income=num(d["B19013_001E"]),
        rent=num(d["B25064_001E"]), home_value=num(d["B25077_001E"]),
        renter_share=(num(d["B25003_003E"]) / num(d["B25003_001E"])) if num(d["B25003_001E"]) else None)

rows = []
for t in tracts:
    a = acs.get(t.geoid)
    if not a or not a["pop"] or a["pop"] < 500:
        continue
    r = dict(geoid=t.geoid, area_km2=t.area_km2, **a,
             waste=tract_n["waste"][t.geoid], enc=tract_n["encampment"][t.geoid], ctrl=tract_n["control"][t.geoid])
    r["pop_density"] = a["pop"] / t.area_km2
    r["unit_density"] = a["units"] / t.area_km2
    for k in ("waste", "enc", "ctrl"):
        r[k + "_per_1k"] = r[k] / a["pop"] * 1000
        r[k + "_per_km2"] = r[k] / t.area_km2
    rows.append(r)
with open(ROOT / "data" / "tracts.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0]))
    w.writeheader()
    w.writerows(rows)
R["tracts_used"] = len(rows)


# ---------- stats helpers ----------
def rank(a):
    a = np.asarray(a, float)
    order = a.argsort()
    r = np.empty(len(a))
    r[order] = np.arange(len(a))
    for v in np.unique(a):  # average ties
        m = a == v
        r[m] = r[m].mean()
    return r


def spearman(x, y):
    return float(np.corrcoef(rank(x), rank(y))[0, 1])


def ols(y, X, names):
    """standardized OLS -> betas, t-stats, R2"""
    y = (y - y.mean()) / y.std()
    Xs = (X - X.mean(0)) / X.std(0)
    A = np.column_stack([np.ones(len(y)), Xs])
    beta, *_ = np.linalg.lstsq(A, y, rcond=None)
    res = y - A @ beta
    n, p = A.shape
    s2 = res @ res / (n - p)
    se = np.sqrt(np.diag(s2 * np.linalg.inv(A.T @ A)))
    r2 = 1 - (res @ res) / (y @ y)
    return dict(n=n, r2=round(float(r2), 3),
                coefs={nm: dict(beta=round(float(b), 3), t=round(float(b / s), 2))
                       for nm, b, s in zip(names, beta[1:], se[1:])})


col = lambda k, rs=rows: np.array([r[k] if r[k] is not None else np.nan for r in rs], float)

# ---------- A. concentration ----------
w_sorted = sorted((r["waste"] for r in rows), reverse=True)
tot = sum(w_sorted)
cum, n50 = 0, 0
for v in w_sorted:
    cum += v
    n50 += 1
    if cum >= tot / 2:
        break
cells = sorted(cell_n["waste"].values(), reverse=True)
ctot = sum(cells)
top1 = max(1, len(cells) // 100)
c50 = next(i + 1 for i, c in enumerate(np.cumsum(cells)) if c >= ctot / 2)
hood = Counter(n for _, _, n in pts["waste"])
R["concentration"] = dict(
    tracts_for_half=n50, tracts_total=len(rows), top10_tract_share=round(sum(w_sorted[:10]) / tot, 3),
    cells_with_waste=len(cells), cells_for_half=c50, top1pct_cell_share=round(sum(cells[:top1]) / ctot, 3),
    top_neighborhoods=[(n, c, round(c / len(pts["waste"]), 3)) for n, c in hood.most_common(8)])


# ---------- B. block-level encampment exposure (cell + 8 neighbours ~ within 150 m) ----------
def exposure(c):
    return sum(cell_n["encampment"].get((c[0] + i, c[1] + j), 0) for i in (-1, 0, 1) for j in (-1, 0, 1))


BINS = [("0", 0, 0), ("1-11 (<1/mo)", 1, 11), ("12-51", 12, 51), ("52+ (1+/wk)", 52, 10**9)]
expo = {}
for k in ("waste", "control"):
    d = Counter()
    for c, n in cell_n[k].items():
        e = exposure(c)
        d[next(b[0] for b in BINS if b[1] <= e <= b[2])] += n
    t = sum(d.values())
    expo[k] = {b[0]: round(d[b[0]] / t, 3) for b in BINS}
R["encampment_exposure_share"] = expo
same = {}
for k in ("waste", "control"):
    d = Counter()
    for c, n in cell_n[k].items():
        e = cell_n["encampment"].get(c, 0)
        d[next(b[0] for b in BINS if b[1] <= e <= b[2])] += n
    t = sum(d.values())
    same[k] = {b[0]: round(d[b[0]] / t, 3) for b in BINS}
R["encampment_exposure_same_cell"] = same
R["cells"] = dict(waste=len(cell_n["waste"]), encampment=len(cell_n["encampment"]),
                  waste_cells_with_encampment=sum(1 for c in cell_n["waste"] if c in cell_n["encampment"]))  # share of reports by # encampment reports within ~150 m over 12 mo

# ---------- C. tract correlations ----------
ok = [r for r in rows if all(r[k] is not None for k in ("income", "rent", "renter_share"))]
R["tracts_complete"] = len(ok)
c2 = lambda k: col(k, ok)
R["spearman_waste_per_1k_vs"] = {k: round(spearman(c2("waste_per_1k"), c2(k)), 2) for k in
                                 ("enc_per_1k", "ctrl_per_1k", "pop_density", "unit_density", "income", "rent",
                                  "renter_share")}
R["spearman_waste_per_km2_vs"] = {k: round(spearman(c2("waste_per_km2"), c2(k)), 2) for k in
                                  ("enc_per_km2", "ctrl_per_km2", "pop_density", "unit_density", "income", "rent",
                                   "renter_share")}
hv = [r for r in ok if r["home_value"] is not None]
R["home_value"] = dict(tracts=len(hv), spearman_waste_per_1k=round(spearman(col("waste_per_1k", hv), col("home_value", hv)), 2),
                       spearman_waste_per_km2=round(spearman(col("waste_per_km2", hv), col("home_value", hv)), 2))

# ---------- D. regression: what explains waste density once encampments + reporting are held constant ----------
lg = lambda k: np.log(c2(k) + 1)
y = lg("waste_per_km2")
names = ["encampment", "reporting_control", "pop_density", "income", "rent", "renter_share"]
X = np.column_stack([lg("enc_per_km2"), lg("ctrl_per_km2"), lg("pop_density"), lg("income"), lg("rent"),
                     c2("renter_share")])
R["ols_full"] = ols(y, X, names)
R["ols_encampment_only"] = ols(y, X[:, :1], names[:1])
R["ols_no_encampment"] = ols(y, X[:, 1:], names[1:])
R["ols_residential_only"] = ols(y, X[:, 2:], names[2:])

# ---------- E. the "housed dog-walker" test: tracts with little encampment activity ----------
enc_rate = c2("enc_per_km2")
low = [r for r, e in zip(ok, enc_rate) if e <= np.median(enc_rate)]
cl = lambda k: col(k, low)
R["low_encampment_half"] = dict(
    tracts=len(low), waste_reports=int(cl("waste").sum()),
    share_of_all_waste=round(float(cl("waste").sum() / c2("waste").sum()), 3),
    share_of_population=round(float(cl("pop").sum() / c2("pop").sum()), 3),
    waste_per_1k=round(float(cl("waste").sum() / cl("pop").sum() * 1000), 1),
    spearman_waste_per_1k_vs={k: round(spearman(cl("waste_per_1k"), cl(k)), 2) for k in
                              ("enc_per_1k", "ctrl_per_1k", "pop_density", "unit_density", "income", "rent",
                               "renter_share")})
hi = [r for r, e in zip(ok, enc_rate) if e > np.median(enc_rate)]
R["high_encampment_half"] = dict(
    tracts=len(hi), waste_per_1k=round(float(col("waste", hi).sum() / col("pop", hi).sum() * 1000), 1),
    share_of_all_waste=round(float(col("waste", hi).sum() / c2("waste").sum()), 3))


def terciles(rs, key, label):
    rs = sorted(rs, key=lambda r: r[key])
    n = len(rs)
    out = []
    for i, nm in enumerate(("low", "mid", "high")):
        g = rs[i * n // 3:(i + 1) * n // 3]
        pop = sum(r["pop"] for r in g)
        out.append(dict(tercile=f"{nm} {label}", range=[round(g[0][key]), round(g[-1][key])],
                        waste_per_1k=round(sum(r["waste"] for r in g) / pop * 1000, 1),
                        enc_per_1k=round(sum(r["enc"] for r in g) / pop * 1000, 1),
                        ctrl_per_1k=round(sum(r["ctrl"] for r in g) / pop * 1000, 1)))
    return out


R["income_terciles_all"] = terciles(ok, "income", "income")
R["income_terciles_low_encampment"] = terciles(low, "income", "income")
R["density_terciles_low_encampment"] = terciles(low, "pop_density", "density")
R["rent_terciles_low_encampment"] = terciles(low, "rent", "rent")

json.dump(R, open(ROOT / "data" / "results.json", "w"), indent=1)
print(json.dumps(R, indent=1))
