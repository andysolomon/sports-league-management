# GHSA source documents

Authoritative GHSA sources behind the seed importer
(`scripts/ghsa-seed/`). Retrieved 2026-06-17.

## Local files

| File | What it is | Used for |
| --- | --- | --- |
| [`GHSA_Reclassification_2024-26.pdf`](./GHSA_Reclassification_2024-26.pdf) | Official 2024-26 **enrollment-based reclassification** — 457 schools listed **by class, not by football region** (FTE counts). | Validating school **names / existence**. Cannot validate football regions. |

## Online sources (no downloadable PDF)

| Source | What it is | Used for |
| --- | --- | --- |
| <https://www.ghsa.net/2024-ghsa-football-standings> | **2024 football region alignment** as actually competed — regions per class. HTML page, not a PDF. | **Source of record for `scripts/ghsa-seed/data/ghsa-2024-26.json`** (416 football schools, 56 regions). |
| <https://www.ghsa.net/2024-2025-region-alignments> | All-sports region alignments, 2024-25. | Cross-reference. |
| <https://www.si.com/high-school/georgia/2023/11/16/ghsa-announces-2024-26-regions-and-classifications> | News article, Nov 2023 announced alignment. | Initial draft only — **superseded** by the official football standings above. |

## Why 416 vs 457

The reclassification PDF (457) is all-sports and enrollment-based; the football
alignment (416) excludes the ~44 schools that don't field varsity football and
differs in class membership for some schools. See
`scripts/ghsa-seed/README.md` → "How this was verified" for the full reconciliation.

## Not included (future cycle — grab on request)

These official **region-alignment-format** PDFs exist for the next cycle and can
be added if/when we seed 2026-28:

- `GHSA_Proposed_Region_Alignment_for_2026-2028_11-10-2025.pdf`
- `Region_Alignment_for_2026-2028_with_Sub_Regions_11-17-2025.pdf`

(under `https://www.ghsa.net/sites/default/files/documents/reclassification/`)
