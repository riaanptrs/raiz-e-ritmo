# Raiz & Ritmo — Product brief

Display name: **Raiz & Ritmo**. Repository slug: `raiz-e-ritmo`.

Public description: **Calendário e guia de agricultura biodinâmica em português.**

## Purpose

Help Portuguese-speaking home gardeners understand a calendar entry, consider local conditions, and learn the reasoning behind a gardening practice. The first release combines verified 2027 astronomy with introductory education. A complete agricultural timing system is a separate data milestone.

## First release

Provide four simple destinations:

| Destination | Main purpose |
| --- | --- |
| Hoje | Show the selected local date, available astronomical information and the next verified phase. Explain when the date falls outside available coverage. |
| Calendário | Navigate 2027 by month and open a day for its events, local times and explanations. |
| Aprender | Original introductions to the different lunar cycles, biodynamic calendar traditions, soil and local observation. |
| Fontes e método | Explain sources, verification, data coverage, precision, unresolved agricultural intervals and correction policy. |

Display the chosen time zone prominently enough to interpret dates. Default to `America/Sao_Paulo`; let users change it. Preserve their selection locally. A date without a principal phase event should say so without inventing additional events.

For unavailable agricultural intervals, use direct wording such as **“Classificação biodinâmica indisponível para esta data.”** Explain that root, leaf, flower and fruit recommendations require a validated method. Do not colour dates with guessed categories.

## Educational content

Separate observable astronomy, the recommendations of a named tradition, and the findings of research. Explain that a calendar preference still depends on soil, weather, crop stage and the intended task. Keep source links close to substantive claims.

The application must not fabricate a year-long weather forecast. No weather integration or automatic preparation reminder is required for this release.

## Delivery characteristics

The app should be responsive and installable as a PWA where supported. Cache the app shell, verified data and included guides for offline use after an initial successful load. Explain offline status and offer a clear update path when cached content changes.

The initial experience requires no account or server. Personal garden notes, crop tracking and reminders belong to later milestones. Optional future device-local notes must explain their storage and export behaviour.
