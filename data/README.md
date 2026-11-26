# Included data

`astronomy/moon-phases-2027.json` is the verified initial input. It contains 49 principal phase event instants, their Portuguese labels, source information, precision and verification limits.

The application should use each event's `type` and `instant_utc`. Convert the instant with the user's chosen IANA time zone before grouping it by local day or month. Do not parse a displayed date as though it were UTC, and do not replace the event time with local midnight.

The four event types are `new_moon`, `first_quarter`, `full_moon` and `last_quarter`. They are discrete moments; the dataset does not contain daily agricultural categories or an illuminated lunar-shape calculation.

No 2026 events are included. If today's date is outside coverage, initialize the calendar to January 2027 and clearly identify it as the 2027 calendar. Keep unsupported years explicit.

The USNO table provides Universal Time at minute precision. ISO timestamps use the UTC representation appropriate to that displayed precision; any future higher-precision engine must handle time standards explicitly. JPL interpolation was an independent research check, not the app's production ephemeris implementation.

Source and verification details are also explained in `docs/DATA_METHOD.md`. Retain this provenance when transforming the input into application assets.

