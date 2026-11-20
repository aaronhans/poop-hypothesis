"""Pull 12 months of SF 311 points (public open data, anonymous read-only GETs) -> data/raw/<signal>.csv

Signals:
  waste       human_waste_or_urine (the single mixed human/animal bucket)
  encampment  Encampment category UNION rerouted homelessness requests (see sf/intervention-evaluation)
  control     overflowing city garbage cans (reporting-propensity control, not encampment-driven)
"""
import csv, io, sys, time, urllib.parse, urllib.request, pathlib

BASE = "https://data.sf.gov/resource/vw6y-z8j6.csv"
START, END = "2025-11-01T00:00:00", "2026-11-01T00:00:00"
WINDOW = f"requested_datetime >= '{START}' AND requested_datetime < '{END}' AND lat IS NOT NULL"
SIGNALS = {
    "waste": "service_name = 'Street and Sidewalk Cleaning' AND service_details = 'human_waste_or_urine'",
    "encampment": "(service_name IN ('Encampment','Encampments') OR (service_name = 'General Request' "
                  "AND lower(service_subtype) LIKE '%homeless%'))",
    "control": "lower(service_details) LIKE '%garbage_can_overflowing%'",
}
OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "raw"
PAGE = 50000


def pull(key):
    rows, offset, header = [], 0, None
    while True:
        q = (f"SELECT service_request_id, requested_datetime, lat, long, analysis_neighborhood, source "
             f"WHERE {WINDOW} AND {SIGNALS[key]} ORDER BY service_request_id LIMIT {PAGE} OFFSET {offset}")
        url = BASE + "?" + urllib.parse.urlencode({"$query": q})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(url, timeout=120) as r:
                    text = r.read().decode("utf-8")
                break
            except Exception as e:  # noqa
                print(key, "retry", attempt, e, file=sys.stderr)
                time.sleep(3 * (attempt + 1))
        else:
            raise SystemExit(f"{key}: pull failed")
        page = list(csv.reader(io.StringIO(text)))
        header, body = page[0], page[1:]
        rows += body
        print(key, "rows", len(rows), flush=True)
        if len(body) < PAGE:
            break
        offset += PAGE
    with open(OUT / f"{key}.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


if __name__ == "__main__":
    for k in (sys.argv[1:] or SIGNALS):
        pull(k)
