# Task 01 — Implement the Raiz & Ritmo PWA

Read `AGENTS.md`, `docs/PRODUCT_BRIEF.md` and `docs/DATA_METHOD.md`. Implement the first release described there using the supplied astronomy dataset. Do not depend on information from an earlier conversation.

## Deliverable

Create a working Vite/React/TypeScript application named **Raiz & Ritmo**, with PT-BR copy, responsive calendar and day views, time-zone selection, introductory learning content, and a source/method page. Use the product name consistently in the interface, page title and PWA metadata. Add appropriate original icons and offline caching. Use an accessible, calm visual design suited to gardening.

Target the future GitHub Pages base path **`/raiz-e-ritmo/`**. Configure the build base, assets, navigation, manifest start URL and service-worker scope consistently for that subpath. The repository exists; the application has not been deployed. Keep deployment configuration explicit and documented; do not automatically publish this task. Return a reviewable branch or pull request with a clear description of behaviour, validation and remaining limitations.

## Acceptance criteria

- All supplied 2027 phase events appear on the correct local dates at their documented precision.
- Month/day navigation works with keyboard and touch; unsupported coverage has a clear state.
- If the current date is outside the supplied year, start at January 2027 and label the coverage clearly; do not fabricate current-year events.
- Changing time zone updates dates and times consistently, including midnight crossings.
- No root, leaf, flower or fruit interval is invented; its unavailability is understandable.
- Educational claims identify their sources and distinguish astronomy, tradition and evidence.
- The app works offline after a successful initial load and handles updates clearly.
- Assets and navigation work under a repository subpath.
- The production build and meaningful calendar/time-zone tests pass.
- README documents the commands that now exist and accurately describes current limitations.

Implement the complete bounded release above. Leave personal notes, live weather, preparations scheduling and unverified agricultural datasets for the later milestones.
