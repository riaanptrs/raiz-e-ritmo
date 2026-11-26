# Independent JPL lunar reference

`jpl-2027-reference.json` is a numerical test reference derived from a saved NASA/JPL Horizons **DE441** observer table. It is independent of the application's astronomy library. It tests geometry; it does not validate biodynamic cultivation effects or reproduce a publisher's agricultural calendar.

## Input and provenance

The fixture records the exact source query URL, original retrieval time, raw JSON SHA-256, byte length, API signature, coordinate frames and printed precision. The input covers 25 December 2026 through 5 January 2028 in continuous hourly steps, with the Earth centre as observer and the Moon centre as target. Requested Horizons quantities are 2, 20, 29 and 31.

The raw response is about 1 MB and is not copied into the app bundle. To obtain an input, request the exact URL stored at `source.url` in the fixture and save the returned JSON. Keep the original response when reproducing the recorded input hash: a fresh query can legitimately change metadata or predictions. A matching sidecar named `INPUT.json.provenance.json` may contain `url`, `retrieved_utc` and `request`; otherwise supply the exact source URL on the command line.

[Horizons API documentation](https://ssd-api.jpl.nasa.gov/doc/horizons.html) and [quantity/coordinate definitions](https://ssd.jpl.nasa.gov/horizons/manual.html) explain the source fields.

## Regenerate

Use Python with NumPy and SciPy installed. The fixture's `method.software` records the versions used to generate it.

```sh
python scripts/build-jpl-reference.py /path/to/jpl_moon_2027_hourly.json tests/fixtures/jpl-2027-reference.json
```

If no provenance sidecar is present:

```sh
python scripts/build-jpl-reference.py /path/to/moon.json /path/to/reference.json --source-url '<exact Horizons query URL>' --retrieved-at '<original retrieval UTC timestamp>'
```

The script performs no download and writes only the requested output file. `--year` selects a year other than the default 2027; input data must cover that entire year with at least a day of padding on each side. It refuses discontinuous/non-hourly data, missing fields, incorrect target/ephemeris markers, and input/output path collisions.

## What each section means

| Section | Definition |
| --- | --- |
| `events` | All spline-derived 2027 ecliptic nodes, range-rate zeros and declination extrema, ordered by UTC instant. |
| `coordinate_samples` | Twelve unmodified source samples: 15th of each month at 12:00 UTC. |
| `constellation_transition_brackets` | Every adjacent hourly source pair with different IAU constellation IDs in the covered year. |

Node times solve apparent ecliptic latitude = 0. A positive slope is `ascending_node`; a negative slope is `descending_node`. These definitions do not reverse when the user's hemisphere changes.

Perigee/apogee times solve the separately supplied JPL range-rate (`deldot`) = 0, using a cubic spline. Negative-to-positive means perigee; positive-to-negative means apogee. The event value is the interpolated range in AU, not range-rate.

Declination extrema are roots of the first derivative of the cubic spline of apparent equatorial declination. The second derivative distinguishes `declination_maximum` from `declination_minimum`. This is separate from node crossings and from Moon phase.

Every event includes the enclosing source-hour bracket. Output roots are rounded to seconds to make comparisons deterministic. **An interpolated second is not a claim of one-second astronomical accuracy.** Comparison tolerances must account for engine accuracy, interpolation and reference-frame differences.

## Frames and limits

- Declination is apparent equator/equinox of date in Horizons' IAU76/80 convention; ecliptic longitude/latitude are apparent ecliptic of date. Both include the corrections described in the original response.
- JPL's `Cnst` field instead describes the **astrometric** position in IAU 1930 regions. An engine using apparent coordinates may enter a region slightly earlier or later. Verify sample labels and allow a stated frame margin when comparing brackets.
- A bracket gives an observed change between two hourly samples. It does not prove that no shorter excursion occurred between equal-label samples, nor determine an exact ingress minute.
- These are geocentric quantities. They contain no local horizon, altitude, weather, crop or visibility calculation.
- Horizons' future UTC conversion uses the last leap-second offset known at retrieval. Future reruns need not reproduce every timestamp identically.
- Passing these tests does not validate root/leaf/flower/fruit recommendations, hemisphere conventions, publisher overrides, or agricultural efficacy.

## Refined apsides and the local-year boundary

The separate `jpl-apsis-refinement-2027.json` report checks the 26 core-year apsides against 104 newly queried JPL samples. Its `boundary_events` array checks one additional apogee at **2028-01-01 03:59:18 UTC**, which still occurs on 31 December 2027 in western time zones. This extra event is not counted as a 2027 UTC event. The original `jpl-2027-reference.json` stays unchanged.

The adjacent event is reproduced from the same original hourly input with an optional separate output:

```sh
python scripts/build-jpl-reference.py /path/to/jpl_moon_2027_hourly.json /path/to/core-reference.json --boundary-output tests/fixtures/jpl-apsis-boundary-reference.json
```

Fresh-response JSON files and their provenance sidecars are committed beside the report. Rebuild the production apsis data and its refinement report entirely offline:

```sh
python scripts/refine-apsides.py \
  --reference tests/fixtures/jpl-2027-reference.json \
  --boundary-reference tests/fixtures/jpl-apsis-boundary-reference.json \
  --raw tests/fixtures/apsis_refinement_raw_1.json tests/fixtures/apsis_refinement_raw_2.json tests/fixtures/apsis_refinement_raw_boundary.json \
  --output data/astronomy/lunar-apsides-2027.json \
  --report-output tests/fixtures/jpl-apsis-refinement-2027.json
```

The verifier derives roots from the fresh samples' own timestamps and range-rates before consulting the reference for pairing. Both production and refinement report retain 26 core `events` and one separate `boundary_events` entry. The summary states 27 total checks and 108 fresh samples. Before grouping into local dates, the application must include the boundary entry. It does not establish full data coverage for 2028.
