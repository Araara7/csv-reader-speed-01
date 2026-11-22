# csv-reader-speed-01

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/Araara7/csv-reader-speed-01/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/Araara7/csv-reader-speed-01/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's own csv-reader 1.0.0: it reads broken CSV files exactly as csv-reader does — same `{columns, rows, errors}` on every case (BOM, CRLF, stray CR, quoted fields, `""` escapes, quote junk, unterminated quotes, short/long rows) — in about a sixth of the CPU time.

## How it is fast

- One pass, fields taken by `slice` — never built character by character.
- A record with no quote and no stray CR in its physical line is taken whole (`slice` + `split`).
- Everything else is scanned field by field: unquoted fields end at the nearest of the next comma (C++ `indexOf`), the next LF and the next CR (both cached, monotonic, so the total scan stays linear); quoted fields are located with `indexOf` and only transformed when they hold `""` or a CR.
- No dependencies, no WASM, no native code, no caching between cases. Node 22, standard library only.

## Layout

- `solve.js` — the entry: `run(input)` returns csv-reader 1.0.0's answer for `{text, header}`.
- `main.ts` — the harness driver (unchanged from the house baseline): reads `/input/cases.json`, answers each case with `run`, writes `/output/answers.json`.

## Check it

On the kit's practice set (6 cases, ~10.2 MB of CSV), the answers are byte-identical to the house baseline's, and `run()` takes ~85 ms against the baseline's ~490 ms on this machine (median of repeated runs; the harness times CPU net of a do-nothing control).

```sh
node main.ts  # with MAKEFUN_INPUT_DIR / MAKEFUN_OUTPUT_DIR set
```
