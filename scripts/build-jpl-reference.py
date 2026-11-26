#!/usr/bin/env python3
"""Build independent lunar test fixtures from an hourly JPL Horizons response.

This script uses NumPy/SciPy, not the application's astronomy library. It does
not download data, modify production datasets, or infer agricultural benefits.
See tests/fixtures/JPL_README.md for input provenance and comparison limits.
"""

from __future__ import annotations

import argparse
from collections import Counter
import csv
from datetime import datetime, timedelta, timezone
import hashlib
import io
import json
from pathlib import Path
import platform

import numpy as np
import scipy
from scipy.interpolate import CubicSpline


UTC = timezone.utc
COLUMNS = {
    "declination_deg": 4,
    "distance_au": 5,
    "radial_velocity_km_s": 6,
    "ecliptic_longitude_deg": 8,
    "ecliptic_latitude_deg": 9,
}


def utc_text(instant: datetime) -> str:
    return instant.isoformat(timespec="seconds").replace("+00:00", "Z")


def read_horizons(path: Path):
    raw = path.read_bytes()
    response = json.loads(raw)
    text = response.get("result", "")
    for required in (
        "Target body name: Moon (301)",
        "{source: DE441}",
        "Center-site name: GEOCENTRIC",
        "Date__(UT)__HR:MN",
        "DEC___(a-app)",
        "ObsEcLon",
        "ObsEcLat",
        "$$SOE",
        "$$EOE",
    ):
        if required not in text:
            raise ValueError(f"Unsupported Horizons response; missing {required!r}")
    table = text.split("$$SOE", 1)[1].split("$$EOE", 1)[0].strip()
    rows = list(csv.reader(io.StringIO(table)))
    times = [
        datetime.strptime(row[0].strip(), "%Y-%b-%d %H:%M").replace(tzinfo=UTC)
        for row in rows
    ]
    x = np.asarray([(t - times[0]).total_seconds() for t in times])
    if len(rows) < 4 or not np.all(np.diff(x) == 3600.0):
        raise ValueError("Expected continuous, ordered samples exactly one hour apart")
    values = {
        name: np.asarray([float(row[column]) for row in rows])
        for name, column in COLUMNS.items()
    }
    if any(not np.all(np.isfinite(a)) for a in values.values()):
        raise ValueError("The requested numeric columns must have no missing values")
    constellations = [row[7].strip() for row in rows]
    if any(len(code) != 3 for code in constellations):
        raise ValueError("Expected JPL three-letter IAU constellation identifiers")
    return raw, response, times, x, values, constellations


def build_fixture(input_path: Path, provenance: dict, year: int) -> dict:
    raw, response, times, x, values, constellations = read_horizons(input_path)
    start = datetime(year, 1, 1, tzinfo=UTC)
    end = datetime(year + 1, 1, 1, tzinfo=UTC)
    # Padding keeps boundary conditions outside the year being validated.
    if times[0] > start - timedelta(days=1) or times[-1] < end + timedelta(days=1):
        raise ValueError("Input must cover the complete year plus at least a day on each side")
    epoch = times[0]
    start_x = (start - epoch).total_seconds()
    end_x = (end - epoch).total_seconds()
    splines = {
        name: CubicSpline(x, value, bc_type="not-a-knot", extrapolate=False)
        for name, value in values.items()
        if name != "ecliptic_longitude_deg"  # Wrapped angles are never interpolated here.
    }
    declination_rate = splines["declination_deg"].derivative()
    events = []

    def add_roots(curve, classify, value_name: str, unit: str):
        previous = None
        for root in sorted(curve.roots(extrapolate=False)):
            root = float(root)
            if not np.isfinite(root) or not (start_x <= root < end_x):
                continue
            if previous is not None and abs(root - previous) < 0.001:
                continue
            previous = root
            slope = float(curve.derivative()(root))
            if slope == 0:
                raise ValueError("Ambiguous tangential root in event series")
            index = int(np.searchsorted(x, root, side="right")) - 1
            event_type = classify(slope)
            # Seconds are a compact numerical result, not a claimed accuracy.
            instant = epoch + timedelta(seconds=round(root))
            events.append({
                "type": event_type,
                "instant_utc": utc_text(instant),
                "bracket_start_utc": utc_text(times[index]),
                "bracket_end_utc": utc_text(times[index + 1]),
                "value": round(float(splines[value_name](root)), 10),
                "unit": unit,
            })

    add_roots(
        splines["ecliptic_latitude_deg"],
        lambda slope: "ascending_node" if slope > 0 else "descending_node",
        "ecliptic_latitude_deg", "degrees",
    )
    # Use the independently supplied range-rate, not a distance finite difference.
    add_roots(
        splines["radial_velocity_km_s"],
        lambda slope: "perigee" if slope > 0 else "apogee",
        "distance_au", "AU",
    )
    add_roots(
        declination_rate,
        lambda slope: "declination_minimum" if slope > 0 else "declination_maximum",
        "declination_deg", "degrees",
    )
    events.sort(key=lambda event: event["instant_utc"])
    if len({(e["type"], e["instant_utc"]) for e in events}) != len(events):
        raise ValueError("Duplicate event found")

    time_indices = {instant: index for index, instant in enumerate(times)}
    coordinate_samples = []
    for month in range(1, 13):
        instant = datetime(year, month, 15, 12, tzinfo=UTC)
        index = time_indices[instant]
        coordinate_samples.append({
            "instant_utc": utc_text(instant),
            **{name: float(series[index]) for name, series in values.items()},
            "iau_constellation": constellations[index],
        })

    transitions = []
    for index in range(1, len(times)):
        if times[index] < start or times[index - 1] >= end:
            continue
        if constellations[index] != constellations[index - 1]:
            transitions.append({
                "start_utc": utc_text(times[index - 1]),
                "end_utc": utc_text(times[index]),
                "from": constellations[index - 1],
                "to": constellations[index],
            })

    return {
        "schema_version": "1.0",
        "year": year,
        "purpose": "Independent geocentric lunar geometry test reference; no crop-effect validation.",
        "source": {
            "name": "NASA/JPL Horizons observer table",
            "ephemeris": "DE441",
            "url": provenance["url"],
            "retrieved_utc": provenance.get("retrieved_utc"),
            "query": provenance.get("request"),
            "input_sha256": hashlib.sha256(raw).hexdigest(),
            "input_bytes": len(raw),
            "api_signature": response.get("signature"),
            "observer": "Earth geocentre (500@399)",
            "target": "Moon centre (301)",
            "sample_interval_seconds": 3600,
            "coverage_start_utc": utc_text(times[0]),
            "coverage_end_utc": utc_text(times[-1]),
            "sample_count": len(times),
            "frames": {
                "declination_deg": "Airless apparent equator/equinox of date, EOP-corrected IAU76/80; light-time, deflection, aberration, precession and nutation included.",
                "distance_au": "Apparent light-time-corrected geocentric range in AU.",
                "radial_velocity_km_s": "Apparent geocentric range-rate; positive receding, negative approaching.",
                "ecliptic_coordinates": "Apparent observer-centred IAU76/80 ecliptic of date; light-time, deflection and aberration included.",
                "iau_constellation": "IAU 1930 region containing the ASTROMETRIC target-centre position, as supplied by Horizons quantity 29.",
            },
            "precision": {
                "time_tags": "UTC hourly samples printed to the minute.",
                "declination_decimal_degrees": 9,
                "distance_decimal_AU": 14,
                "radial_velocity_decimal_km_s": 7,
                "ecliptic_decimal_degrees": 7,
                "event_output": "Numerical spline root rounded to nearest second; not independent one-second physical accuracy.",
            },
            "time_caveat": "Horizons UT output after 1962 is UTC; future intervals use the last known leap-second offset at retrieval.",
        },
        "method": {
            "interpolation": "SciPy CubicSpline with not-a-knot boundary conditions, continuous hourly inputs, no extrapolation.",
            "nodes": "Roots of interpolated apparent ecliptic latitude; increasing latitude is ascending node.",
            "apsides": "Roots of interpolated JPL deldot range-rate; negative-to-positive is perigee, positive-to-negative apogee.",
            "declination_turns": "Roots of the derivative of the interpolated apparent equatorial declination; classify with second derivative.",
            "coordinates": "Direct source values at 12:00 UTC on the 15th of each month; no interpolation.",
            "constellations": "Every adjacent hourly sample pair whose JPL IAU code changes; each pair is a one-hour ingress bracket, not an exact ingress time.",
            "event_interval": f"[{year}-01-01T00:00:00Z, {year + 1}-01-01T00:00:00Z)",
            "software": {
                "python": platform.python_version(),
                "numpy": np.__version__,
                "scipy": scipy.__version__,
            },
        },
        "limits": [
            "Interpolating an hourly table does not create authoritative second-resolution event measurements.",
            "Apparent coordinates and Horizons astrometric constellation labels have different corrections; tiny ingress offsets can be frame effects.",
            "A constellation excursion shorter than an hour can be missed if both sample endpoints have the same label.",
            "Geocentric events do not provide local rise/set, culmination altitude, eclipse visibility or occultation circumstances.",
            "No hemisphere-dependent agricultural interpretation or publisher-specific sector boundary is tested by these fixtures.",
            "Agreement verifies astronomical computation only, not planting, harvest, flavour or yield claims.",
        ],
        "event_counts": dict(sorted(Counter(e["type"] for e in events).items())),
        "events": events,
        "coordinate_samples": coordinate_samples,
        "constellation_transition_brackets": transitions,
    }


def build_boundary_reference(input_path: Path, core: dict) -> dict:
    """Apsides just outside the UTC year that may occur on a local-year date."""
    _, _, times, x, values, _ = read_horizons(input_path)
    year = core["year"]
    start = datetime(year, 1, 1, tzinfo=UTC)
    end = datetime(year + 1, 1, 1, tzinfo=UTC)
    velocity = CubicSpline(x, values["radial_velocity_km_s"], extrapolate=False)
    distance = CubicSpline(x, values["distance_au"], extrapolate=False)
    events = []
    for root in sorted(velocity.roots(extrapolate=False)):
        root = float(root)
        if not np.isfinite(root):
            continue
        instant = times[0] + timedelta(seconds=root)
        if not ((start - timedelta(days=1) <= instant < start) or
                (end <= instant < end + timedelta(days=1))):
            continue
        index = int(np.searchsorted(x, root, side="right")) - 1
        events.append({
            "type": "perigee" if velocity.derivative()(root) > 0 else "apogee",
            "instant_utc": utc_text(times[0] + timedelta(seconds=round(root))),
            "bracket_start_utc": utc_text(times[index]),
            "bracket_end_utc": utc_text(times[index + 1]),
            "value": round(float(distance(root)), 10),
            "unit": "AU",
        })
    return {
        "schema_version": "1.0",
        "year": year,
        "purpose": "Adjacent UTC apsides needed when a supported local calendar date crosses the UTC year boundary.",
        "selection": "Apsis instants in the 24 hours before or after the core UTC year; keep separate from core-year events.",
        "source": core["source"],
        "method": core["method"]["apsides"],
        "limits": core["limits"],
        "events": events,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="Raw Horizons Moon JSON response")
    parser.add_argument("output", type=Path, help="Output fixture JSON path")
    parser.add_argument("--year", type=int, default=2027)
    parser.add_argument("--provenance", type=Path,
                        help="Query provenance JSON; defaults to INPUT.provenance.json")
    parser.add_argument("--source-url", help="Exact retrieval URL if no provenance sidecar is available")
    parser.add_argument("--retrieved-at", help="Original UTC retrieval time; never inferred from file timestamps")
    parser.add_argument("--boundary-output", type=Path,
                        help="Optional separate adjacent-year apsis reference; does not change the core fixture")
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        parser.error("Input and output must be different files")
    if args.boundary_output and args.boundary_output.resolve() in {args.input.resolve(), args.output.resolve()}:
        parser.error("Boundary output must be different from input and core output")
    provenance_path = args.provenance or Path(str(args.input) + ".provenance.json")
    if provenance_path.is_file():
        provenance = json.loads(provenance_path.read_text(encoding="utf-8"))
    elif args.source_url:
        provenance = {"url": args.source_url, "retrieved_utc": args.retrieved_at}
    else:
        parser.error("Provide the provenance sidecar or --source-url; source identity is required")
    if not provenance.get("url"):
        parser.error("Provenance must contain its exact source URL")
    fixture = build_fixture(args.input, provenance, args.year)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(fixture, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.boundary_output:
        boundary = build_boundary_reference(args.input, fixture)
        args.boundary_output.parent.mkdir(parents=True, exist_ok=True)
        args.boundary_output.write_text(json.dumps(boundary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "event_counts": fixture["event_counts"],
        "events": len(fixture["events"]),
        "coordinate_samples": len(fixture["coordinate_samples"]),
        "constellation_transition_brackets": len(fixture["constellation_transition_brackets"]),
        "input_sha256": fixture["source"]["input_sha256"],
    }, indent=2))


if __name__ == "__main__":
    main()
