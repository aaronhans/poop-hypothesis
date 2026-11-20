/* Visual work log — zero dependencies. Data: window.VIZ (data/viz.js, baked by build/03_viz.py). */
const V = window.VIZ;
const NS = "http://www.w3.org/2000/svg";
const $ = (id) => document.getElementById(id);
const el = (name, attrs = {}, text) => {
  const n = document.createElementNS(NS, name);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (text != null) n.textContent = text;
  return n;
};
const fmt = (n) => n.toLocaleString("en-US");

/* ---------- shared tooltip ---------- */
const tip = $("tip");
function showTip(evt, html) {
  tip.innerHTML = html;
  tip.hidden = false;
  const r = tip.getBoundingClientRect();
  let x = evt.clientX + 14, y = evt.clientY + 14;
  if (x + r.width > innerWidth - 8) x = evt.clientX - r.width - 14;
  if (y + r.height > innerHeight - 8) y = evt.clientY - r.height - 14;
  tip.style.left = Math.max(8, x) + "px";
  tip.style.top = Math.max(8, y) + "px";
}
const hideTip = () => { tip.hidden = true; };

/* ---------- hypothesis ledger ---------- */
const STATUS = {
  yes: ["✓", "Held up"], part: ["◐", "Partly held up"], no: ["✕", "Did not hold up"],
  back: ["↩", "Dropped"], open: ["?", "Not tested"], mixed: ["~", "Unclear"],
};
const LEDGER = [
  ["Pets of unhoused people cause much of it", "Aaron", "open", "h-s1",
    "It fits the camp link. But so does human poop. The data cannot tell them apart without photos."],
  ["People with no toilet to use cause much of it", "Claude", "mixed", "h-s7",
    "Staffed toilets are on the hot blocks now. Few are open at night. We cannot tell if they cut reports."],
  ["Housed dog owners on walks near home cause much of it", "Aaron", "no", "h-s5",
    "Only 107 blocks have repeat poop with no camp reports close by. They hold 1.6% of reports."],
  ["Poop tracks the income or home cost of an area", "Aaron", "no", "h-s5",
    "Rent shows no pattern. Richer areas report more poop. They report more full trash cans by the same amount."],
  ["Poop tracks how crowded an area is", "Aaron", "part", "h-s5",
    "A small effect (0.22). The camp effect is much bigger (0.58)."],
  ["Poop is tied to camp areas", "Earlier work", "yes", "h-s4",
    "A strong match across areas (0.88 out of 1). It holds after our checks. It does not prove cause."],
  ["The link is just busy streets that get more of every report", "Earlier work", "part", "h-s4",
    "Trash can reports cluster on camp blocks too (25%). Poop does so far more (42%)."],
  ["Poop and camps rise and fall as one over time", "Earlier work", "open", "h-s2",
    "Not tested again. In June they did not move as one. That still argues against a simple cause."],
  ["311 counts who reports, not what is there", "Earlier work", "yes", "h-s5",
    "In areas with few camps, the richest third files 55% more poop reports. It also files 56% more trash can reports."],
  ["A few blocks carry most of it", "The data", "yes", "h-s3",
    "233 blocks hold half of all reports. Each is about 100 meters wide."],
  ["The morning peak means poop builds up at night", "Claude", "back", "h-s6",
    "The peak comes two hours later on weekends. So it tracks the people who report."],
  ["The morning peak is people who report on the way to work", "Aaron", "part", "h-s6",
    "The peak follows daily habits. But weekend reports drop only 15%."],
  ["Poop follows the routes from camps to services such as meals", "Aaron", "open", "h-s7",
    "The city has no good open list of service sites. We stopped early, as agreed."],
  ["Dog poop gets left when bad food or worms make it too loose to bag", "Another session", "open", "h-care",
    "Vet sources link food changes and worms to loose poop. Nothing here shows this drives reports. The care plan would test it."],
];
$("ledger").innerHTML = LEDGER.map(([h, who, s, step, why]) =>
  `<tr><th scope="row"><a href="#${step}">${h}</a></th><td>${who}</td>` +
  `<td><span class="status ${s}"><i aria-hidden="true">${STATUS[s][0]}</i>${STATUS[s][1]}</span></td><td>${why}</td></tr>`).join("");

/* ---------- maps ---------- */
const LNG0 = -122.52, LNG1 = -122.355, LAT0 = 37.705, LAT1 = 37.835, MW = 440;
const KX = MW / (LNG1 - LNG0), MH = Math.round((LAT1 - LAT0) * KX / Math.cos(37.77 * Math.PI / 180)), KY = MH / (LAT1 - LAT0);
const px = (lng) => (lng - LNG0) * KX, py = (lat) => (LAT1 - lat) * KY;
const BINS = [[1, 4], [5, 19], [20, 49], [50, 149], [150, Infinity]];
const bin = (n) => BINS.findIndex(([a, b]) => n >= a && n <= b) + 1;
const cellIndex = new Map(V.cells.map((c) => [c[0] + "," + c[1], c]));

function drawMap(id, col) {
  const svg = $(id);
  svg.setAttribute("viewBox", `0 0 ${MW} ${MH}`);
  const base = V.outlines.map((r) => "M" + r.map(([x, y]) => px(x).toFixed(1) + " " + py(y).toFixed(1)).join("L") + "Z").join("");
  svg.append(el("path", { d: base, class: "outline" }));
  const w = V.dlng * KX, h = V.dlat * KY, g = el("g");
  for (const c of V.cells) {
    if (!c[col]) continue;
    g.append(el("rect", {
      x: (px((c[1] - 1) * V.dlng)).toFixed(1), y: py((c[0] + 1) * V.dlat).toFixed(1),
      width: w.toFixed(2), height: h.toFixed(2), class: `cell b${bin(c[col])}${c[4] ? " half" : ""}`,
    }));
  }
  svg.append(g);
  svg.addEventListener("pointermove", (e) => {
    const r = svg.getBoundingClientRect();
    const lng = LNG0 + (e.clientX - r.left) / r.width * (LNG1 - LNG0);
    const lat = LAT1 - (e.clientY - r.top) / r.height * (LAT1 - LAT0);
    const c = cellIndex.get(Math.trunc(lat / V.dlat) + "," + Math.trunc(lng / V.dlng));
    if (!c) return hideTip();
    showTip(e, `<b>Block near ${lat.toFixed(4)}, ${lng.toFixed(4)}</b>Poop reports: ${fmt(c[2])}<br>Camp reports: ${fmt(c[3])}` +
      (c[4] ? "<br>One of the 233 blocks that hold half" : ""));
  });
  svg.addEventListener("pointerleave", hideTip);
}
drawMap("mapWaste", 2);
drawMap("mapEnc", 3);
$("mapLegend").innerHTML = "<li>Reports in 12 months:</li>" + BINS.map(([a, b], i) =>
  `<li><i style="background:var(--seq-${i + 1})"></i>${b === Infinity ? a + "+" : a + "–" + b}</li>`).join("");
$("halfOnly").addEventListener("change", (e) => $("mapWaste").classList.toggle("half-only", e.target.checked));

/* ---------- islands: only the hot blocks ---------- */
(function islands() {
  const svg = $("islands"), LW = 250;
  svg.setAttribute("viewBox", `0 0 ${MW + LW} ${MH}`);
  const base = V.outlines.map((r) => "M" + r.map(([x, y]) => px(x).toFixed(1) + " " + py(y).toFixed(1)).join("L") + "Z").join("");
  svg.append(el("path", { d: base, class: "ghost" }));
  const w = V.dlng * KX, h = V.dlat * KY;
  for (const c of V.cells) if (c[4]) svg.append(el("rect", { x: px((c[1] - 1) * V.dlng).toFixed(1), y: py((c[0] + 1) * V.dlat).toFixed(1), width: w.toFixed(2), height: h.toFixed(2), class: "island" }));
  // numbered labels in a right-hand column with leader lines, ordered north to south
  const labs = V.clusters.map((k) => {
    const xs = k.cells.map((c) => px((c[1] - 0.5) * V.dlng)), ys = k.cells.map((c) => py((c[0] + 0.5) * V.dlat));
    return { k, x: Math.max(...xs) + w, y: ys.reduce((a, b) => a + b) / ys.length };
  }).sort((a, b) => a.y - b.y);
  const y0 = MH * 0.2, gap = 46;
  labs.forEach((l, i) => {
    const ty = y0 + i * gap, tx = MW - 24;
    svg.append(el("path", { d: `M${l.x.toFixed(1)} ${l.y.toFixed(1)}L${tx - 26} ${ty - 4}H${tx - 6}`, class: "leader" }));
    svg.append(el("text", { x: tx, y: ty, class: "val" }, `${l.k.rank}. ${l.k.name}`));
    svg.append(el("text", { x: tx, y: ty + 16, class: "lbl" }, `${fmt(l.k.blocks)} blocks · ${(l.k.share * 100).toFixed(1)}% of reports`));
  });
  svg.append(el("text", { x: MW - 24, y: y0 + labs.length * gap + 6, class: "lbl" }, `Plus ${V.n_clusters - V.clusters.length} smaller islands`));
})();

/* ---------- island panels: OSM street tiles clipped to each cluster's shape ---------- */
(function panels() {
  const KEY = "cb1_345x_1_c35f447893a720bcee1599fe";  // same CARTO basemap the intervention-evaluation dashboards use
  const dark = () => document.documentElement.dataset.theme === "dark" ||
    (document.documentElement.dataset.theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  const tileUrl = (z, x, y, layer) => `https://${"abcd"[(x + y) % 4]}.basemaps.cartocdn.com/light_${layer}/${z}/${x}/${y}@2x.png?key=${KEY}`;
  const mx = (lng, z) => (lng + 180) / 360 * 256 * 2 ** z;
  const my = (lat, z) => { const s = Math.sin(lat * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256 * 2 ** z; };
  const host = $("panels");
  // five classes with equal numbers of hot blocks in each (quintiles), so every island shows the full light-to-dark range
  const counts = V.cells.filter((c) => c[4]).map((c) => c[2]).sort((a, b) => a - b);
  const cuts = [0.2, 0.4, 0.6, 0.8].map((q) => counts[Math.floor(q * counts.length)]);
  const PB = [[counts[0], cuts[0] - 1], [cuts[0], cuts[1] - 1], [cuts[1], cuts[2] - 1], [cuts[2], cuts[3] - 1], [cuts[3], Infinity]];
  const pbin = (n) => PB.findIndex(([a, b]) => n >= a && n <= b) + 1;

  function build(fig, k) {
    const set = new Set(k.cells.map((c) => c[0] + "," + c[1]));
    const lat0 = Math.min(...k.cells.map((c) => c[0])) * V.dlat, lat1 = (Math.max(...k.cells.map((c) => c[0])) + 1) * V.dlat;
    const lng0 = (Math.min(...k.cells.map((c) => c[1])) - 1) * V.dlng, lng1 = Math.max(...k.cells.map((c) => c[1])) * V.dlng;
    let z = 18;  // largest zoom that keeps the island under ~900px on its long side
    while (z > 13 && Math.max(mx(lng1, z) - mx(lng0, z), my(lat0, z) - my(lat1, z)) > 900) z--;
    const pad = mx(V.dlng, z) - mx(0, z), X0 = mx(lng0, z) - pad, Y0 = my(lat1, z) - pad;
    const W = mx(lng1, z) - mx(lng0, z) + 2 * pad, H = my(lat0, z) - my(lat1, z) + 2 * pad;
    const svg = el("svg", { viewBox: `0 0 ${W.toFixed(0)} ${H.toFixed(0)}`, role: "img",
      "aria-label": `Street map cut to the shape of island ${k.rank}, ${k.name}: ${k.blocks} blocks with ${fmt(k.reports)} poop reports. Busiest streets: ${k.streets.join(", ")}.` });
    const id = "clip" + k.rank, clip = el("clipPath", { id }), tint = el("g"), edge = [];
    const box = (c) => { const x = mx((c[1] - 1) * V.dlng, z) - X0, y = my((c[0] + 1) * V.dlat, z) - Y0; return [x, y, mx(c[1] * V.dlng, z) - X0 - x, my(c[0] * V.dlat, z) - Y0 - y]; };
    for (const c of k.cells) {
      const [x, y, w, h] = box(c);
      clip.append(el("rect", { x: x - 0.4, y: y - 0.4, width: w + 0.8, height: h + 0.8 }));
      const r = el("rect", { x, y, width: w, height: h, class: `cell tint b${pbin(c[2])}` });
      r.addEventListener("pointermove", (e) => showTip(e, `<b>${k.name}</b>${fmt(c[2])} poop reports on this block in 12 months`));
      r.addEventListener("pointerleave", hideTip);
      tint.append(r);
      // outline: only the edges that face outside the island
      if (!set.has((c[0] + 1) + "," + c[1])) edge.push(`M${x} ${y}h${w}`);
      if (!set.has((c[0] - 1) + "," + c[1])) edge.push(`M${x} ${y + h}h${w}`);
      if (!set.has(c[0] + "," + (c[1] - 1))) edge.push(`M${x} ${y}v${h}`);
      if (!set.has(c[0] + "," + (c[1] + 1))) edge.push(`M${x + w} ${y}v${h}`);
    }
    const tiles = el("g", { "clip-path": `url(#${id})` });
    const labels = el("g", { "clip-path": `url(#${id})` });
    for (let tx = Math.floor(X0 / 256); tx <= Math.floor((X0 + W) / 256); tx++)
      for (let ty = Math.floor(Y0 / 256); ty <= Math.floor((Y0 + H) / 256); ty++)
      {
        // color first, then the street map blended over it, then crisp labels on top
        const at = { x: tx * 256 - X0, y: ty * 256 - Y0, width: 256.5, height: 256.5 };
        tiles.append(el("image", { href: tileUrl(z, tx, ty, "nolabels"), class: "streets", ...at }));
        labels.append(el("image", { href: tileUrl(z, tx, ty, "only_labels"), class: "names", ...at }));
      }
    tiles.prepend(tint);
    svg.append(el("defs"), tiles, labels, el("path", { d: edge.join(""), class: "shore" }));
    for (const t of V.toilets) {  // public toilets on or beside the island
      const tx = mx(t.lng, z) - X0, ty = my(t.lat, z) - Y0;
      if (tx < 0 || ty < 0 || tx > W || ty > H) continue;
      const cell = [Math.trunc(t.lat / V.dlat), Math.trunc(t.lng / V.dlng)];
      let adj = false;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if (set.has((cell[0] + i) + "," + (cell[1] + j))) adj = true;
      if (!adj) continue;
      const u = W / 60 + 5;
      const m = t.pit ? el("rect", { x: tx - u * 0.85, y: ty - u * 0.85, width: 1.7 * u, height: 1.7 * u, transform: `rotate(45 ${tx} ${ty})` }) : el("circle", { cx: tx, cy: ty, r: u });
      m.setAttribute("class", "wc" + (t.night ? " night" : ""));
      m.setAttribute("stroke-width", u / 3);
      m.addEventListener("pointermove", (e) => showTip(e, `<b>${t.name}</b>${t.pit ? "Staffed Pit Stop" : "Public restroom"}<br>${t.hours}${t.night ? "<br>Open at night" : ""}`));
      m.addEventListener("pointerleave", hideTip);
      svg.append(m);
    }
    svg.querySelector("defs").append(clip);
    fig.append(svg);
  }

  V.clusters.forEach((k) => {
    const fig = document.createElement("figure");
    fig.className = k.rank <= 2 ? "big" : "";
    fig.innerHTML = `<figcaption>${k.rank}. ${k.name}<span>${fmt(k.blocks)} blocks · ${fmt(k.reports)} reports · ${(k.share * 100).toFixed(1)}% of the city's total<br>Busiest streets: ${k.streets.join(", ")}</span></figcaption>`;
    host.append(fig);
    // only fetch street tiles when the panel is about to scroll into view
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); build(fig, k); } }, { rootMargin: "600px" });
    io.observe(fig);
  });
  $("panelLegend").innerHTML = "<li><strong>Poop reports on the block in 12 months</strong></li>" + PB.map(([a, b], i) =>
    `<li><i style="background:var(--seq-${i + 1})"></i>${b === Infinity ? a + "+" : a + "–" + b}</li>`).join("");
  $("toiletLegend").innerHTML = `<li><strong>Public toilets</strong></li><li><i class="wc-key sq"></i>Staffed Pit Stop</li><li><i class="wc-key"></i>Other public restroom</li>` +
    `<li><i class="wc-key sq night"></i>Solid fill: open at night</li>`;
  $("gapLegend").innerHTML = `<li><strong>Gaps</strong></li><li><i class="gap-key"></i>Empty hole: a block with fewer than ${counts[0]} reports. It is not one of the 233.</li>`;
  // Step 7 facts + table
  const T = V.results.toilets, pct = (v) => Math.round(v * 100) + "%";
  $("toiletFacts").innerHTML =
    `<li>${T.pit_near_hot} of the city's ${T.pit_stops} staffed Pit Stops are on or next to a hot block.</li>` +
    `<li>Of those ${T.pit_near_hot}, ${T.pit_near_hot_overnight} list night hours.</li>` +
    `<li>Half of all poop reports are within ${T.pit_stop.waste.median_m} meters of a Pit Stop. For trash can reports it is ${T.pit_stop.control.median_m} meters.</li>` +
    `<li>${pct(T.any_restroom.waste.within_300m)} of poop reports are within 300 meters of a public toilet. For trash can reports it is ${pct(T.any_restroom.control.within_300m)}.</li>`;
  $("pitTable").innerHTML = V.toilets.filter((t) => t.pit && t.hot).sort((a, b) => b.night - a.night).map((t) =>
    `<tr><th scope="row">${t.name}</th><td>${t.hours}</td><td>${t.night ? "Yes" : "No"}</td></tr>`).join("");
})();

/* ---------- mismatch map: where the pattern breaks ---------- */
(function mismatch() {
  const svg = $("mapMismatch");
  svg.setAttribute("viewBox", `0 0 ${MW} ${MH}`);
  const base = V.outlines.map((r) => "M" + r.map(([x, y]) => px(x).toFixed(1) + " " + py(y).toFixed(1)).join("L") + "Z").join("");
  svg.append(el("path", { d: base, class: "outline" }));
  const w = V.dlng * KX, h = V.dlat * KY, M = V.results.mismatch;
  const NAMES = { 1: "Repeat poop, camp reports close by", 2: "Repeat poop, no camp reports close by", 3: "Camp reports, almost no poop" };
  const cx = (c) => px((c[1] - 0.5) * V.dlng), cy = (c) => py((c[0] + 0.5) * V.dlat);
  for (const c of V.cells) if (c[5] === 1) svg.append(el("rect", { x: (cx(c) - w / 2).toFixed(1), y: (cy(c) - h / 2).toFixed(1), width: w.toFixed(2), height: h.toFixed(2), class: "t0" }));
  // the exceptions are the story: larger marks with a surface ring, different shapes so color is not the only cue
  for (const c of V.cells) {
    if (c[5] === 3) { const s = 3.6; svg.append(el("path", { d: `M${cx(c)} ${cy(c) - s}l${s} ${s}l${-s} ${s}l${-s} ${-s}Z`, class: "pt t2" })); }
    if (c[5] === 2) svg.append(el("circle", { cx: cx(c).toFixed(1), cy: cy(c).toFixed(1), r: 3.2, class: "pt t1" }));
  }
  svg.addEventListener("pointermove", (e) => {
    const r = svg.getBoundingClientRect();
    const lng = LNG0 + (e.clientX - r.left) / r.width * (LNG1 - LNG0), lat = LAT1 - (e.clientY - r.top) / r.height * (LAT1 - LAT0);
    let best = null, bd = 1e9;  // nearest classified block within ~1.5 cells
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const c = cellIndex.get((Math.trunc(lat / V.dlat) + i) + "," + (Math.trunc(lng / V.dlng) + j));
      if (!c || !c[5]) continue;
      const d = Math.hypot(i, j) - (c[5] > 1 ? 0.6 : 0);
      if (d < bd) { bd = d; best = c; }
    }
    if (!best) return hideTip();
    showTip(e, `<b>${NAMES[best[5]]}</b>Poop reports: ${fmt(best[2])}<br>Camp reports on this block: ${fmt(best[3])}`);
  });
  svg.addEventListener("pointerleave", hideTip);
  $("mismatchLegend").innerHTML =
    `<li><i class="swatch-1"></i>${NAMES[1]}: ${fmt(M.both.blocks)} blocks, ${Math.round(M.both.waste_share * 100)}% of poop reports</li>` +
    `<li><i class="dot swatch-2"></i>${NAMES[2]}: ${fmt(M.waste_only.blocks)} blocks, ${(M.waste_only.waste_share * 100).toFixed(1)}%</li>` +
    `<li><i class="diamond swatch-3"></i>${NAMES[3]}: ${fmt(M.enc_only.blocks)} blocks</li>`;
})();

/* ---------- scatter ---------- */
(function scatter() {
  const W = 720, H = 440, m = { l: 58, r: 20, t: 12, b: 46 };
  const svg = $("scatter");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const lx = (v) => m.l + (Math.log10(v) - Math.log10(0.25)) / (Math.log10(1500) - Math.log10(0.25)) * (W - m.l - m.r);
  const ly = (v) => H - m.b - (Math.log10(v) - Math.log10(0.7)) / (Math.log10(1000) - Math.log10(0.7)) * (H - m.t - m.b);
  for (const t of [1, 10, 100, 1000]) {
    svg.append(el("line", { x1: lx(t), x2: lx(t), y1: m.t, y2: H - m.b, class: "gridline" }));
    svg.append(el("text", { x: lx(t), y: H - m.b + 18, class: "tick", "text-anchor": "middle" }, fmt(t)));
    svg.append(el("line", { x1: m.l, x2: W - m.r, y1: ly(t), y2: ly(t), class: "gridline" }));
    svg.append(el("text", { x: m.l - 8, y: ly(t) + 4, class: "tick", "text-anchor": "end" }, fmt(t)));
  }
  svg.append(el("line", { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, class: "axisline" }));
  svg.append(el("text", { x: (m.l + W - m.r) / 2, y: H - 6, class: "axis-title", "text-anchor": "middle" }, "Camp reports per 1,000 people"));
  svg.append(el("text", { x: 14, y: (m.t + H - m.b) / 2, class: "axis-title", "text-anchor": "middle", transform: `rotate(-90 14 ${(m.t + H - m.b) / 2})` }, "Poop reports per 1,000 people"));
  const names = ["Lowest income third", "Middle income third", "Highest income third"];
  for (const t of [...V.tracts].sort((a, b) => b.w - a.w)) {
    const c = el("circle", { cx: lx(t.e).toFixed(1), cy: ly(t.w).toFixed(1), r: 4.5, class: `pt t${t.t}` });
    c.addEventListener("pointermove", (e) => showTip(e,
      `<b>${t.hood || "Area"} · census area ${t.id}</b>Poop: ${fmt(t.w)} per 1,000 people (${fmt(t.wn)} reports)<br>` +
      `Camps: ${fmt(t.e)} per 1,000 people (${fmt(t.en)} reports)<br>Median income: $${fmt(t.inc)} · ${names[t.t].toLowerCase()}<br>People: ${fmt(t.pop)}`));
    c.addEventListener("pointerleave", hideTip);
    svg.append(c);
  }
  // selective direct labels: the two extremes
  const top = V.tracts.reduce((a, b) => (b.w > a.w ? b : a)), low = V.tracts.reduce((a, b) => (b.w < a.w ? b : a));
  svg.append(el("text", { x: lx(top.e) - 9, y: ly(top.w) + 4, class: "lbl", "text-anchor": "end" }, `${top.hood}: ${fmt(Math.round(top.w))} per 1,000`));
  svg.append(el("text", { x: lx(low.e) + 9, y: ly(low.w) + 4, class: "lbl" }, `${low.hood}: ${low.w} per 1,000`));
  const R = V.results.income_terciles_all.map((t) => t.range);
  const k = (n) => "$" + Math.round(n / 1000) + "k";
  $("scatterLegend").innerHTML = "<li>Median household income:</li>" + names.map((n, i) =>
    `<li><i class="dot swatch-${i + 1}"></i>${n} (${k(R[i][0])}–${i === 2 ? "$250k+" : k(R[i][1])})</li>`).join("");
})();

/* ---------- paired bars ---------- */
(function bars() {
  const D = V.results.income_terciles_low_encampment;
  const groups = ["Lowest income third", "Middle income third", "Highest income third"];
  const series = [["Poop reports", "waste_per_1k", "t0", "swatch-1"], ["Full trash can reports (our check)", "ctrl_per_1k", "t1", "swatch-2"]];
  const W = 720, H = 300, m = { l: 40, r: 12, t: 22, b: 48 }, max = 16;
  const svg = $("bars");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const y = (v) => H - m.b - v / max * (H - m.t - m.b);
  for (const t of [0, 4, 8, 12, 16]) {
    svg.append(el("line", { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: t ? "gridline" : "axisline" }));
    svg.append(el("text", { x: m.l - 8, y: y(t) + 4, class: "tick", "text-anchor": "end" }, t));
  }
  const gw = (W - m.l - m.r) / 3, bw = 56, gap = 2;
  D.forEach((d, i) => {
    const cx = m.l + gw * i + gw / 2;
    series.forEach(([name, key, cls], j) => {
      const v = d[key], x = cx + (j ? gap / 2 : -bw - gap / 2), top = y(v), r = 4;
      const p = el("path", { class: cls, d: `M${x} ${y(0)}V${top + r}q0 -${r} ${r} -${r}h${bw - 2 * r}q${r} 0 ${r} ${r}V${y(0)}Z` });
      p.addEventListener("pointermove", (e) => showTip(e, `<b>${groups[i]}</b>${name}: ${v} per 1,000 people`));
      p.addEventListener("pointerleave", hideTip);
      svg.append(p, el("text", { x: x + bw / 2, y: top - 6, class: "val", "text-anchor": "middle" }, v.toFixed(1)));
    });
    svg.append(el("text", { x: cx, y: H - m.b + 18, class: "lbl", "text-anchor": "middle" }, groups[i]));
    svg.append(el("text", { x: cx, y: H - m.b + 34, class: "tick", "text-anchor": "middle" },
      `$${Math.round(d.range[0] / 1000)}k–${i === 2 ? "$250k+" : "$" + Math.round(d.range[1] / 1000) + "k"}`));
  });
  $("barsLegend").innerHTML = series.map((s) => `<li><i class="${s[3]}"></i>${s[0]}</li>`).join("");
  $("barsTable").innerHTML = `<table><thead><tr><th scope="col">Income third</th><th scope="col" class="num">Poop reports per 1,000</th><th scope="col" class="num">Trash can reports per 1,000</th></tr></thead><tbody>` +
    D.map((d, i) => `<tr><th scope="row">${groups[i]}</th><td class="num">${d.waste_per_1k}</td><td class="num">${d.ctrl_per_1k}</td></tr>`).join("") + "</tbody></table>";
})();

/* ---------- hours ---------- */
(function hours() {
  const D = V.hours.waste, H0 = 5, H1 = 22;
  const W = 720, H = 300, m = { l: 40, r: 16, t: 14, b: 44 }, max = 20;
  const svg = $("hours");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const x = (h) => m.l + (h - H0) / (H1 - H0) * (W - m.l - m.r), y = (v) => H - m.b - v / max * (H - m.t - m.b);
  const hr = (h) => (h === 12 ? "12pm" : h < 12 ? h + "am" : h - 12 + "pm");
  for (const t of [0, 5, 10, 15, 20]) {
    svg.append(el("line", { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: t ? "gridline" : "axisline" }));
    svg.append(el("text", { x: m.l - 8, y: y(t) + 4, class: "tick", "text-anchor": "end" }, t + "%"));
  }
  for (let h = 6; h <= H1; h += 2) svg.append(el("text", { x: x(h), y: H - m.b + 18, class: "tick", "text-anchor": "middle" }, hr(h)));
  svg.append(el("text", { x: (m.l + W - m.r) / 2, y: H - 6, class: "axis-title", "text-anchor": "middle" }, "Hour the report was filed"));
  const cross = el("line", { y1: m.t, y2: H - m.b, class: "cross", visibility: "hidden" });
  svg.append(cross);
  const S = [["Weekdays", D.weekday, "a"], ["Weekends", D.weekend, "b"]], dots = [];
  for (const [name, arr, cls] of S) {
    let d = "";
    for (let h = H0; h <= H1; h++) d += (h === H0 ? "M" : "L") + x(h).toFixed(1) + " " + y(arr[h]).toFixed(1);
    svg.append(el("path", { d, class: "ln " + cls }));
    const pk = arr.indexOf(Math.max(...arr));
    svg.append(el("circle", { cx: x(pk), cy: y(arr[pk]), r: 4, class: `pt t${cls === "a" ? 0 : 1}` }));
    svg.append(el("text", { x: x(pk) + 8, y: y(arr[pk]) - 8, class: "lbl" },
      `${name} peak: ${hr(pk)}`));
    const dot = el("circle", { r: 4, class: `pt on t${cls === "a" ? 0 : 1}`, visibility: "hidden" });
    svg.append(dot);
    dots.push([dot, arr]);
  }
  svg.addEventListener("pointermove", (e) => {
    const r = svg.getBoundingClientRect();
    const h = Math.max(H0, Math.min(H1, Math.round(H0 + ((e.clientX - r.left) / r.width * W - m.l) / (W - m.l - m.r) * (H1 - H0))));
    cross.setAttribute("x1", x(h)); cross.setAttribute("x2", x(h)); cross.setAttribute("visibility", "visible");
    for (const [dot, arr] of dots) { dot.setAttribute("cx", x(h)); dot.setAttribute("cy", y(arr[h])); dot.setAttribute("visibility", "visible"); }
    showTip(e, `<b>${hr(h)}–${hr(h + 1)}</b>Weekdays: ${D.weekday[h]}% of reports<br>Weekends: ${D.weekend[h]}% of reports`);
  });
  svg.addEventListener("pointerleave", () => {
    hideTip(); cross.setAttribute("visibility", "hidden");
    for (const [dot] of dots) dot.setAttribute("visibility", "hidden");
  });
  $("hoursLegend").innerHTML = `<li><i class="line swatch-1"></i>Weekdays</li><li><i class="line swatch-2"></i>Weekends</li>`;
  let rows = "";
  for (let h = H0; h <= H1; h++) rows += `<tr><th scope="row">${hr(h)}</th><td class="num">${D.weekday[h]}%</td><td class="num">${D.weekend[h]}%</td></tr>`;
  $("hoursTable").innerHTML = `<table><thead><tr><th scope="col">Hour</th><th scope="col" class="num">Weekdays</th><th scope="col" class="num">Weekends</th></tr></thead><tbody>${rows}</tbody></table>`;
})();
