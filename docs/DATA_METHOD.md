# Data and interpretation method

## Verified input

`data/astronomy/moon-phases-2027.json` contains the 2027 principal phase reference. Its source is the [US Naval Observatory year table](https://aa.usno.navy.mil/calculated/moon/phases?year=2027). The research audit checked all 49 events against a separate calculation using [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/manual.html) geocentric apparent Sun and Moon positions; agreement was within 40 seconds of USNO’s listed minutes.

These are event times, not a complete biodynamic planting schedule. Preserve the dataset’s provenance and minute precision. Any precomputed local time is a reference value; the interface must derive display dates from the event instant and selected time zone.

Two useful conversion checks are:

- 7 January 2027, 20:24 UTC → 7 January, 17:24 in `America/Sao_Paulo`.
- 19 June 2027, 00:44 UTC → 18 June, 21:44 in `America/Sao_Paulo`.

## Interpretation boundaries

The Brazilian and European calendars inspected during the research did not provide one interchangeable, fully documented algorithm. Their constellation boundaries, planetary adjustments, unsuitable periods and hemisphere conventions can differ. Ordinary zodiac signs and IAU constellation regions must not be substituted for a named publisher’s rules.

A future agricultural interval needs a method and edition, source locator, original time basis, start/end semantics, precision, task meaning, hemisphere convention, validation status and redistribution status. Preserve uncertain transitions; an hourly chart does not justify invented minute precision.

Do not generate missing periods by copying another year, interpolating colours or taking a majority vote between sources. Keep astronomical event accuracy distinct from evidence that a gardening recommendation improves an outcome.

## Adding or correcting data

Keep source values and corrections traceable. Record the retrieval date, edition/version, verification procedure and reason for a change. A newly added event family—such as nodes or declination turns—requires its own verification before display as checked data.

Full agricultural schedules remain unavailable in the first release. Public access to a publisher’s PDF is not a recorded permission to redistribute its entire schedule or artwork. Link readers to source publications while those questions are resolved.
