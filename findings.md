# What is causing the poop in SF? Phase 1 findings

Time-boxed pass, 2026-11-20. All 311 waste reports are lumped together: the category
(`human_waste_or_urine`) cannot separate dog waste, human feces and urine.

**Window:** Nov 2025 – Oct 2026 (12 full months). **Unit:** 233 census tracts, plus ~100m blocks.

## Answer

The poop problem is an encampment-area problem, not a residential dog-walking problem, and it is
packed into a small number of blocks. This phase cannot say whether the source in those areas is
people or their pets.

## What we set aside

We started with three suspects: unhoused people's pets, housed dog owners, and people without
toilet access. To fit the time box we dropped the following.

- **Photo analysis of poop type.** Many reports carry a photo, and classifying a sample as dog,
  human or urine was the planned way to split pets from people. Dropped for time. It also had a
  data risk we never measured: what share of reports have a usable photo.
- **A species split from the 311 fields.** Not possible at all. The single category merges human
  and animal waste and urine, with no field to separate them.
- **Dog population data** (licenses, dog parks). Not pulled, so "where dogs live" is inferred
  only from residential density.
- **Public toilet locations and hours.** Set aside at first, then pulled later (finding 5).
- **Trends over time.** This is a single 12-month snapshot.
- **Block-level modelling.** The statistical model is at tract level; blocks are used only for
  concentration and encampment-overlap counts.

The consequence: everything below treats all poop as one thing.

## Findings

### 1. It is extremely concentrated

- 51,439 reports in 12 months.
- Tenderloin (22%), Mission (19%) and SoMa (14%) hold 55% of them.
- 21 of 237 tracts hold half of all reports.
- 233 blocks (~100m cells) hold half. That is 5% of the 4,619 blocks with any report.

### 2. Encampment activity is the strongest predictor

- Tract-level rank correlation between waste and encampment reports per resident: **0.88**.
- Encampment density alone explains 85% of the variation in waste density across tracts.
- With reporting propensity, population density, income, rent and renter share held constant,
  encampment is still by far the largest factor (standardized effect 0.58, versus 0.22 for
  population density and 0.22 for the reporting control).
- The half of tracts with the most encampment activity produce **89%** of waste reports:
  125 per 1,000 residents, versus 12 per 1,000 in the other half.
- At block level, 42% of waste reports are on blocks with weekly-or-more encampment reports,
  versus 25% of overflowing-garbage-can reports (the control). Only 5% of waste reports are on
  blocks with no encampment reports at all.

### 3. The residential dog-walker theory gets little support

- Only 107 blocks have recurring waste (5 or more reports in 12 months) without encampment
  reports nearby (fewer than 12 within about 150m). They hold 840 reports, 1.6% of the total, and
  are scattered through the Sunset, Western Addition, Bayview and Richmond. By contrast 1,642
  blocks with recurring waste do have encampment reports nearby, and hold 88%.

- Tracts with little encampment activity hold 57% of the population and 11% of waste reports.
- Within those tracts, higher-income tracts do report more waste (14.9 per 1,000 versus 9.6 in
  the lowest third). But garbage-can reports rise by the same amount (15.1 versus 9.7), so this
  looks like richer areas reporting more, not having more poop.
- Rent shows no pattern (12.2, 12.3, 10.7 per 1,000 from low to high rent).
- Density shows a small rise (9.8 to 13.2 per 1,000 from low to high density).
- Citywide, income and rent are weakly negative (rank correlation −0.18 and −0.29) and fade to
  near zero once encampment activity is controlled.

### 4. The hot blocks form 24 islands

- The 233 blocks that hold half the reports merge into 24 separate clusters.
- One cluster of 143 blocks in the Tenderloin holds 36.5% of the city's waste reports.
- A 41-block cluster in the Mission holds 6.7%. The rest are small: Hayes Valley (two clusters
  of 9 blocks), North Beach (5 blocks) and 24th Street in the Mission (4 blocks) lead them.

### 5. Toilets are already where the poop is

Sources: Public Bathrooms and Water Fountains (`wfq4-upmv`) and Pit Stops (`mr6h-cr3u`).

- 12 of the city's 16 staffed Pit Stops are on or next to a hot block. Only 3 of those 12 list
  overnight hours.
- The Tenderloin island has 8 Pit Stops and the main Mission island has 2. The Hayes Valley and
  North Beach islands have none.
- Half of waste reports are within 434m of a Pit Stop, against 864m for garbage-can reports.
- This fits the city placing toilets in response to the problem. It does not show whether toilets
  reduce reports.

### 6. Homeless services: not testable with open data

The idea that poop follows routes between where people stay and services such as meals could not
be tested. DataSF has no usable list of meal sites, shelters or drop-in centers; the city
facilities list (`nc68-ngbr`) shows only five homelessness department sites. We stopped there.

### 7. Unhoused pets versus unhoused people: not answerable yet

Both produce the same pattern in this data. Splitting them needs the report photos.

## Proposed solution

Aim at the roughly 230 blocks that carry half the volume.

1. **Close the toilet gaps rather than add toilets everywhere.** The two big islands already have
   Pit Stops, but few list overnight hours. The Hayes Valley and North Beach islands have none.
2. **Scheduled early-morning cleaning on those blocks,** instead of waiting for complaints.
3. **Pet waste bags and supplies through outreach teams.** Cheap, and it covers the pet theory
   without waiting for proof.
4. **Measure it.** Compare treated hot blocks with similar untreated ones, before and after.

### Care-based prototype (tests the pets hypothesis)

A regular stop on the hot blocks offering one consistent dog food, waste bags and a bin, deworming
and basic vet care, and advice on set feeding times. It rests on the untested assumption that pets
cause a large share of the waste, so measure it by counting piles (dog or human) before and after.

Possible partners, from web listings we have not confirmed with the groups:

- [Vet SOS](https://sfccc.squarespace.com/veterinary-street-outreach-services) (San Francisco
  Community Clinic Consortium): free vet care for pets of unhoused San Franciscans since 2001.
- [Full Belly Bus](https://www.baywoof.org/featured-article/food-4-paws-full-belly-bus-expands-help-for-struggling-sf-pet-owners):
  free dog and cat food at several San Francisco sites.
- SF SPCA: partners with Vet SOS on limited emergency care.

Sources for the claims behind it:

- Diet change as a cause of diarrhea in dogs:
  [Merck Animal Health](https://www.merck-animal-health-usa.com/pet-owners/pet-health/health-issues/dealing-with-diarrhea-in-pets/),
  [VCA](https://vcahospitals.com/know-your-pet/diarrhea-in-dogs).
- Parasites as a cause of diarrhea in dogs:
  [Merck Veterinary Manual](https://www.merckvetmanual.com/dog-owners/digestive-disorders-of-dogs/disorders-of-the-stomach-and-intestines-in-dogs).
- Regular feeding times and elimination:
  [VCA](https://vcahospitals.com/pets-first/know-your-pet/feeding-times-and-frequency-for-your-dog),
  [AKC](https://www.akc.org/expert-advice/training/puppy-training/setting-schedules-and-developing-a-routine-for-your-new-puppy/).
- Pet ownership among people experiencing homelessness (about one in ten; estimates 6% to 25%):
  [research review](https://pmc.ncbi.nlm.nih.gov/articles/PMC7602009),
  [ASPCA](https://www.aspca.org/improving-laws-animals/public-policy/housing/people-pets-experiencing-homelessness).
- Not sourced, our own assumptions: that loose stool goes unbagged and gets reported, and that
  deworming helps more than diet.

## Caveats

- 311 counts reports, not poop. Encampment reports come through the same 311 channel, so some of
  the 0.88 is shared reporting behavior. The garbage-can control only partly removes that.
- These are cross-sectional correlations. The June 2026 analysis found waste and encampment
  reports do not move together month to month within a neighborhood, which argues against a
  simple one-to-one causal link.
- Report time shows when people notice, not when it happens. Weekday reports peak at 8am (40%
  filed 7–10am); on weekends the peak moves to 10am (30%). Garbage-can and graffiti reports shift
  the same way, so the morning peak mostly follows reporters' schedules. Waste is still more
  morning-heavy than either (31% and 23% on weekdays), which could be overnight build-up or
  crews logging at shift start. 311 timestamps cannot settle it.
- Census income tops out at $250,001 and rent at $3,501, which blunts comparisons at the high end.
- 4 of 237 tracts were dropped for missing income or rent.

## Next phase

- Classify a sample of report photos (dog, human, urine/other) to split people from pets.
- Get a list of homeless service sites (meals, shelters, drop-in centers) from outside DataSF.
- Compare reports before and after a Pit Stop opened or changed hours.
- Publish the hot-block list with addresses.

## Reproduce

```sh
python3 build/01_pull.py                 # 311 points from data.sf.gov -> data/raw/
.venv/bin/python -I build/02_analyze.py  # -> data/results.json, data/tracts.csv
.venv/bin/python -I build/03_viz.py      # -> data/viz.js for index.html (the visual work log)
```

Sources: SF 311 Cases (`vw6y-z8j6`), Census ACS 2023 5-year (tract), Census TIGERweb tract
boundaries. `data/raw/acs.json` needs a Census API key to re-pull.
