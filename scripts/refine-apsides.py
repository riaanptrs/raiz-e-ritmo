#!/usr/bin/env python3
"""Verify JPL apsides against fresh samples and build the bounded production data.

Offline by default and by design: this script never makes a network request.
Requires NumPy and SciPy. Each raw file needs its .provenance.json sidecar.
"""

from __future__ import annotations

import argparse
import csv
from datetime import datetime, timedelta, timezone
import hashlib
import io
import json
from pathlib import Path

import numpy as np
import scipy
from scipy.interpolate import CubicSpline
from scipy.optimize import brentq

AU_KM = 149597870.7
UTC = timezone.utc


def dt(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def iso(value: datetime, *, seconds: bool = False) -> str:
    return value.isoformat(timespec="seconds" if seconds else "microseconds").replace("+00:00", "Z")


def read_fresh(paths: list[Path]) -> tuple[list[dict], list[dict]]:
    rows, sources = [], []
    for path in paths:
        raw = path.read_bytes()
        response = json.loads(raw)
        text = response["result"]
        if not all(s in text for s in (
            "Target body name: Moon (301)", "{source: DE441}",
            "Center-site name: GEOCENTRIC", "delta", "deldot", "$$SOE", "$$EOE",
        )):
            raise ValueError(f"Unsupported Horizons response in {path.name}")
        sidecar = Path(str(path) + ".provenance.json")
        provenance = json.loads(sidecar.read_text(encoding="utf-8"))
        actual_sha = hashlib.sha256(raw).hexdigest()
        if provenance["sha256"] != actual_sha:
            raise ValueError(f"Raw source hash mismatch for {path.name}")
        query = provenance["request"]
        if query["QUANTITIES"].strip("'") != "20" or query["TIME_TYPE"].strip("'") != "UT":
            raise ValueError("Expected quantity 20 in UTC")
        table = text.split("$$SOE", 1)[1].split("$$EOE", 1)[0].strip()
        for row in csv.reader(io.StringIO(table)):
            instant = datetime.strptime(row[0].strip(), "%Y-%b-%d %H:%M:%S.%f").replace(tzinfo=UTC)
            rows.append({
                "instant": instant,
                "distance_au": float(row[3]),
                "range_rate_km_s": float(row[4]),
            })
        sources.append({
            "raw_file": path.name,
            "provenance_file": sidecar.name,
            "sha256": actual_sha,
            "bytes": len(raw),
            "url": provenance["url"],
            "retrieved_utc": provenance["retrieved_utc"],
            "request": query,
            "api_signature": response.get("signature"),
        })
    rows.sort(key=lambda r: r["instant"])
    if len({r["instant"] for r in rows}) != len(rows):
        raise ValueError("Repeated fresh-sample timestamps")
    return rows, sources


def build(reference_path: Path, raw_paths: list[Path], boundary_path: Path | None = None) -> tuple[dict, dict]:
    reference_raw = reference_path.read_bytes()
    reference = json.loads(reference_raw)
    core_baselines = [e for e in reference["events"] if e["type"] in ("perigee", "apogee")]
    boundary_baselines, boundary_metadata = [], None
    if boundary_path:
        boundary_raw = boundary_path.read_bytes()
        boundary = json.loads(boundary_raw)
        if boundary["year"] != reference["year"]:
            raise ValueError("Boundary reference must belong to the same core year")
        boundary_baselines = boundary["events"]
        if any(e["type"] not in ("perigee", "apogee") or dt(e["instant_utc"]).year == reference["year"] for e in boundary_baselines):
            raise ValueError("Boundary reference must contain only adjacent-year apsides")
        boundary_metadata = {"file": boundary_path.name, "sha256": hashlib.sha256(boundary_raw).hexdigest()}
    baselines = sorted(core_baselines + boundary_baselines, key=lambda e: e["instant_utc"])
    samples, sources = read_fresh(raw_paths)
    if len(samples) != len(baselines) * 4:
        raise ValueError("Expected four fresh samples per reference apsis")
    checks, used = [], set()
    # Fresh roots depend exclusively on each quartet's own times and range-rates.
    # The original reference is consulted afterward, only to pair and compare.
    for index in range(0, len(samples), 4):
        group = samples[index:index + 4]
        epoch = group[0]["instant"]
        x = np.asarray([(r["instant"] - epoch).total_seconds() for r in group])
        y = np.asarray([r["range_rate_km_s"] for r in group])
        if list(x) != [0.0, 60.0, 180.0, 240.0] or y[1] * y[2] >= 0:
            raise ValueError("Fresh quartet does not contain the expected central zero crossing")
        curve = CubicSpline(x, y, bc_type="not-a-knot", extrapolate=False)
        root = float(brentq(curve, x[1], x[2]))
        linear = float(x[1] + (x[2] - x[1]) * (-y[1]) / (y[2] - y[1]))
        slope = float(curve.derivative()(root))
        event_type = "perigee" if slope > 0 else "apogee"
        fresh = epoch + timedelta(seconds=root)
        matching = [(i, b) for i, b in enumerate(baselines) if b["type"] == event_type]
        baseline_index, baseline = min(matching, key=lambda pair: abs((dt(pair[1]["instant_utc"]) - fresh).total_seconds()))
        difference = (fresh - dt(baseline["instant_utc"])).total_seconds()
        if baseline_index in used or abs(difference) > 60:
            raise ValueError("Fresh event missing, repeated, or more than one minute from reference")
        used.add(baseline_index)
        checks.append({
            "type": event_type,
            "coverage_role": "core" if dt(baseline["instant_utc"]).year == reference["year"] else "boundary",
            "hourly_fixture_utc": baseline["instant_utc"],
            "fresh_cubic_root_utc": iso(fresh),
            "fresh_linear_root_utc": iso(epoch + timedelta(seconds=linear)),
            "fresh_cubic_minus_hourly_fixture_seconds": round(difference, 6),
            "fresh_linear_minus_fresh_cubic_seconds": round(linear - root, 6),
            "estimated_rate_print_quantization_seconds": round(5e-8 / abs(slope), 3),
            "fresh_samples": [{
                "instant_utc": iso(row["instant"], seconds=True),
                "distance_au": row["distance_au"],
                "range_rate_km_s": row["range_rate_km_s"],
            } for row in group],
        })
    if len(used) != len(baselines):
        raise ValueError("Not all reference apsides were checked")
    checks.sort(key=lambda e: e["hourly_fixture_utc"])
    summary = {
        "events_checked": len(checks),
        "core_year": reference["year"],
        "core_events_checked": sum(e["coverage_role"] == "core" for e in checks),
        "boundary_events_checked": sum(e["coverage_role"] == "boundary" for e in checks),
        "fresh_JPL_samples": len(samples),
        "maximum_absolute_difference_seconds": max(abs(e["fresh_cubic_minus_hourly_fixture_seconds"]) for e in checks),
        "maximum_linear_cubic_difference_seconds": max(abs(e["fresh_linear_minus_fresh_cubic_seconds"]) for e in checks),
        "maximum_estimated_rate_print_quantization_seconds": max(e["estimated_rate_print_quantization_seconds"] for e in checks),
        "comparison_reference": "Original hourly spline timestamps rounded to the nearest second, as committed in the reference fixture.",
    }
    reference_sha = hashlib.sha256(reference_raw).hexdigest()
    report = {
        "schema_version": "1.0",
        "year": reference["year"],
        "purpose": "Fresh DE441 sampling check of the hourly-derived lunar apsides; independent of the application's ephemeris library.",
        "reference_fixture": reference_path.name,
        "reference_fixture_sha256": reference_sha,
        "boundary_reference": boundary_metadata,
        "method": {
            "sampling": "Four new JPL samples per apsis, at offsets minus120, minus60, plus60 and plus120 seconds from the coarse reference. Source times themselves are the independent variables.",
            "root": "CubicSpline range-rate root in the inner sign-changing bracket; also linear interpolation of that bracket.",
            "classification": "Range-rate negative-to-positive is perigee; positive-to-negative is apogee.",
            "acceptance_limit_seconds": 60,
            "software": {"numpy": np.__version__, "scipy": scipy.__version__},
        },
        "summary": summary,
        "limits": [
            "The fresh requests use the same DE441 ephemeris. This tests sampling/interpolation, not independent physical observations.",
            "Range-rate is printed to1e-7 km/s; half_LSB divided by the rate slope estimates timing sensitivity to this rounding, not a confidence interval.",
            "Microseconds in diagnostic roots describe numerical output, not asserted physical accuracy.",
            "Comparison with the rounded-second fixture differs slightly from the initial research comparison with unrounded hourly roots.",
            "No planting, yield, flavour or biodynamic recommendation is verified by this check.",
        ],
        "sources": sources,
        "events": [{k: v for k, v in e.items() if k != "coverage_role"} for e in checks if e["coverage_role"] == "core"],
        "boundary_events": [{k: v for k, v in e.items() if k != "coverage_role"} for e in checks if e["coverage_role"] == "boundary"],
    }
    year = reference["year"]
    production = {
        "schema_version": "1.0",
        "dataset_id": f"lunar-apsides-{year}-jpl-v1",
        "year": year,
        "coverage_basis": f"Core lunar apsides within {year} UTC, with separately verified adjacent UTC events for local-year boundaries",
        "boundary_policy": "Combine events and boundary_events before grouping by the selected local date. Boundary entries support the core local year; they are not full coverage of another year.",
        "data_kind": "astronomical_events",
        "source": {
            "name": "NASA/JPL Horizons DE441",
            "url": reference["source"]["url"],
            "retrieved_utc": reference["source"]["retrieved_utc"],
            "raw_input_sha256": reference["source"]["input_sha256"],
            "reference_fixture": reference_path.name,
            "reference_fixture_sha256": reference_sha,
            "boundary_reference": boundary_metadata,
            "frame": "Earth-centred apparent range and range-rate, light-time corrected; Moon centre, DE441.",
            "method": "Zero crossings of a cubic spline of hourly JPL range-rate. Distance interpolated from the same source. Instants retain the original hourly-reference result, rounded to the nearest second.",
            "numeric_timestamp_resolution": "second",
            "display_precision": "minute",
            "physical_accuracy": "No one-second physical-accuracy claim; displayed minute precision is distinct from the numerical root resolution.",
        },
        "verification": {
            "status": "JPL_sampling_cross_checked",
            "report": "jpl-apsis-refinement-2027.json",
            "method": "Fresh JPL range-rate queries around every apsis, independently refitted before comparison with the original reference.",
            **summary,
            "fresh_raw_sha256": [s["sha256"] for s in sources],
        },
        "limitations": [
            "Bounded year coverage: do not extrapolate these events into unsupported years.",
            "These global geocentric instants do not change between hemispheres; local dates and clock times depend on the selected time zone.",
            "The sampling check uses the same JPL physical ephemeris and is not evidence of a crop response.",
            "A biodynamic caution period around a perigee is an additional attributed rule, not a duration supplied by this dataset.",
            reference["source"]["time_caveat"],
        ],
        "events": [{
            "id": "apsis-" + dt(e["instant_utc"]).strftime("%Y%m%dT%H%M%S") + "-" + e["type"],
            "type": e["type"],
            "label_pt_BR": "Perigeu lunar" if e["type"] == "perigee" else "Apogeu lunar",
            "instant_utc": e["instant_utc"],
            "distance_km": round(e["value"] * AU_KM, 1),
            "precision": "minute",
            "verification_status": "JPL_sampling_cross_checked",
        } for e in core_baselines],
        "boundary_events": [{
            "id": "apsis-" + dt(e["instant_utc"]).strftime("%Y%m%dT%H%M%S") + "-" + e["type"],
            "type": e["type"],
            "label_pt_BR": "Perigeu lunar" if e["type"] == "perigee" else "Apogeu lunar",
            "instant_utc": e["instant_utc"],
            "distance_km": round(e["value"] * AU_KM, 1),
            "precision": "minute",
            "verification_status": "JPL_sampling_cross_checked",
        } for e in boundary_baselines],
    }
    return production, report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reference", type=Path, required=True, help="Hourly-derived JPL reference fixture")
    parser.add_argument("--boundary-reference", type=Path, help="Separate adjacent-year apsis reference")
    parser.add_argument("--raw", type=Path, nargs="+", required=True, help="Fresh Horizons quantity20 JSON files, each with provenance sidecar")
    parser.add_argument("--output", type=Path, required=True, help="Production apsis dataset")
    parser.add_argument("--report-output", type=Path, required=True, help="Verification report JSON")
    args = parser.parse_args()
    inputs = {p.resolve() for p in [args.reference, *args.raw, *[Path(str(p) + ".provenance.json") for p in args.raw]]}
    if args.boundary_reference:
        inputs.add(args.boundary_reference.resolve())
    outputs = {args.output.resolve(), args.report_output.resolve()}
    if len(outputs) != 2 or inputs & outputs:
        parser.error("Outputs must be distinct and cannot overwrite inputs")
    production, report = build(args.reference, args.raw, args.boundary_reference)
    for path, data in ((args.output, production), (args.report_output, report)):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], indent=2))


if __name__ == "__main__":
    main()
