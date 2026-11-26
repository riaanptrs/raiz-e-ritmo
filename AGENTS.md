# Instructions for coding agents

## Scope and delivery

Read `README.md`, `docs/PRODUCT_BRIEF.md`, `docs/DATA_METHOD.md` and the assigned task before implementation. Use **Raiz & Ritmo** as the product name and `raiz-e-ritmo` as the repository slug. Work within this repository. Task 01 requests a reviewable implementation branch or pull request; it does not request an automatic public deployment. Follow any later explicit user instructions about delivery.

Use Vite, React and TypeScript for the initial application. Keep the first release static, compatible with GitHub Pages at the intended base path `/raiz-e-ritmo/`. Configure assets, navigation and PWA scope for that subpath. Choose supported dependencies during implementation, commit the lockfile, and document actual commands. No sign-in, backend or paid API is required.

## Data integrity

- Consume the supplied verified astronomy dataset; preserve provenance and original precision.
- Store event instants consistently and convert them using IANA time zones. Do not hard-code all of Brazil to UTC−3 or use the device zone silently.
- Keep phase, constellation sector, declination, nodes, distance and planetary aspects distinct.
- Never infer root/leaf/flower/fruit intervals from lunar phase alone. Unknown agricultural intervals must remain explicitly unavailable.
- Never invent calendar dates, weather observations, forecasts, scientific results or source permissions.
- Do not mix publisher methods or silently repair their data. Record any future correction separately.
- Do not copy private library texts, publisher artwork or complete protected calendar schedules into the repository.

## User experience and explanations

Write public copy in natural PT-BR. Explain why, how and when a task may be appropriate, including relevant conditions. Attribute traditional recommendations and describe evidence within its actual scope. Do not promise improved yield, flavour or therapeutic potency from calendar timing.

Use responsive layouts, semantic controls, readable text, keyboard navigation, visible focus and adequate contrast. A colour must never be the only indication of category or status. Keep implementation metadata on the source/method page rather than in routine garden interactions.

## Verification

Test the risks that matter: local date conversion across midnight, selected time zones and daylight-saving changes; month/year navigation; unsupported-year and missing-data states; repository-subpath assets; offline behaviour after the first successful load. Verify that no unvalidated agricultural category appears as a recommendation.

Run the real build and relevant tests. Report what passed, what was not checked, and any remaining limitation. Update documentation when behaviour or commands change. Avoid tests that merely duplicate implementation constants.
