**Run `docker compose up --build -d` and open [the ask screen](http://localhost:8080/).** Use the same command on macOS, Windows and Linux. First-time setup requires Docker with Compose and a model provider key in `.env`.

# Case study

A local assistant for an analyst inspecting an empty bulk vessel hold. Ask a question and click a citation to inspect the quoted words in the original manual. An authorised officer conducts the inspection. [Assignment brief](docs/challenge/INSTRUCTIONS.md) · [Checklist](docs/challenge/ACCEPTANCE_CRITERIA.md) · [Optional study atlas](http://localhost:8080/atlas/) · [Original plan](ideas.md)

**Another question** starts a fresh thread. **Follow-up question** sends up to four preceding exchanges from the selected thread to resolve references such as “Who inspects them?” Each answer retrieves fresh evidence from the manual. **Recent questions** reopens saved answers in the same browser tab, including after a refresh.

## Setup

Copy `.env.example` to `.env` and configure **one** of these provider pairs. Chat defaults to **GPT-6 Luna** (`CHAT_MODEL=gpt-6-luna`). The two other permitted values are `gpt-6.2-sol` and `gpt-6.2-astra`. The selected provider also runs OpenAI `text-embedding-3-small` for 256-dimensional retrieval vectors.

| `MODEL_PROVIDER` | Key variable |
|---|---|
| `openai` | `OPENAI_API_KEY` |
| `openrouter` | `OPENROUTER_API_KEY` |
| `vercel` | `AI_GATEWAY_API_KEY` |

From the repository folder, run the Compose command above. The first start downloads the reviewed PDF, verifies its checksum and embeds six passages. The `case-data` volume retains the PDF, index and answer traces when you stop the app with `docker compose down`. Use `docker compose logs -f assistant` to see startup progress. If port 8080 is taken, set `CASE_STUDY_PORT` in `.env` and open that port instead.

## What the app verifies

- **Claims.** Each distinct claim appears once with its verified citations. A removed-claim count appears beside the answer when a claim fails verification after a retry.
- **PDF.** Each citation opens the original PDF page and highlights only the lines of its unique quotation.
- **Evaluation.** The 23 cases include two development cases, nine original held-out cases and twelve conversation and scope checks. Each result records the top similarity, retrieved steps, cited steps, gap status and whether the expected checks passed. [Cases](eval/cases.json)
- **Saved embeddings.** Each request's query vector is logged locally for offline replay. The public baseline contains two recorded question vectors. [Baseline fixture](eval/fixtures/ranking-baseline.json)
- **Trace.** Expand an answer to see its model, retrieval count, retrieved and cited IDs, source SHA-256, elapsed milliseconds and reported token counts. The same metadata is appended to the Git-ignored `data/logs/answers.jsonl`.
- **Gaps.** The reader sees the scope and nearest passages marked “does not answer” for the missing detail. Supported parts of a partial answer keep their own quotes.
- **Retrieval.** Removing the repeated decision tables reduces the six embedding inputs from 5,283 to 3,262 characters. Generation still gets the full steps, and the rebuild compares both rankings with identical question vectors.
- **Public files.** The shareable source includes the attribution, checksum, configuration template, recorded fixtures and tests. Credentials, logs, generated indexes and original PDFs stay local.

## Reproduce the checks

Run these commands from the repository folder with the container running:

```sh
docker compose exec assistant python -m unittest discover -s tests -v
docker compose exec assistant python -m eval.run --rebuild
docker compose cp assistant:/app/eval/ranking-comparison.json eval/ranking-comparison.json
docker compose cp assistant:/app/eval/live-results.json eval/live-results.json
```

The evaluation calls the selected provider. The copy commands save the rankings and per-case responses to the checkout. A failed provider connection preserves the previous completed evaluation. Run the tests again to replay the new ranking capture. To exercise the HTTP endpoint inside the container, run `docker compose exec assistant python -m eval.run --base-url http://127.0.0.1:8000`.

| Recorded check | Observation |
|---|---|
| Residue location and purpose, original two-passage run | **Partial.** The answer cited steps 1 and 3 for collection on the tank top. It omitted step 4's reason for inspection. |
| Minimum pile weight, original two-passage run | **Pass.** The retrieved passages gave no weight. The assistant returned a gap without inventing a number. |
| Four-passage baseline, same location question | Step 4 ranks **third of six** in the saved full-step vector replay. A subsequent OpenRouter browser run cited page 22, step 4 for inspecting the piles for evidence of infestation. |
| Luna browser check, 19 November 2026, same question | **Partial.** Step 4 ranked second. The answer cited only step 3 for collecting residues in piles on the tank top and omitted the specific purpose of checking for infestation. |
| F2 ladder follow-up, 19 November 2026 | The running container cited step 2 for “If clear, continue to Step 3.” Replaying that reply with the updated code retains the condition and cites step 3 for the inspection on arrival at the tank top. |
| Earlier eleven-case suite | The Vercel rebuild attempt stopped at DNS resolution. The archived results above predate the expanded follow-up suite. |

A complete gap has no expected supporting step, so retrieval hit and citation hit are recorded as `null`. Where several steps are required, the report lists each missing step. Quote and keyword checks catch common mistakes. A human still judges whether a quotation supports the whole claim, including any conditions. [Original recorded responses](eval/results.json)

## Source

**A3.** Department of Agriculture, Fisheries and Forestry. 2026. *Inspecting empty bulk vessels for export*, IMLS-12-3065, version 7.0, 1 July 2026. Accessed 19 November 2026. The collection covers section 8.1, pages 20–22, steps 1–6. Table text is reflowed and bullets normalised. © Department of Agriculture, Fisheries and Forestry 2026. The publisher's CC BY 4.0 terms exclude the departmental logo, Commonwealth Coat of Arms and certain third-party material. The public release obtains the reviewed PDF from DAFF for local use. [Official PDF](https://www.agriculture.gov.au/sites/default/files/sitecollectiondocuments/biosecurity/export/plants-plant-products/plant-exports-manual/work-instruction-empty-bulk-vessel.pdf) · [Reuse terms](https://www.agriculture.gov.au/about/copyright) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

## Decisions and next steps

- **Bad quotes.** Retry once, keep verified claims, and show “Could not verify an answer” if every claim fails.
- **Broad questions.** Give up to three cited claims of at least six words each, then suggest a specific step or area.
- **Claim grounding.** The cited passage supplies its step, page and section numbers. The quote must support the inspection details, including any quantities.
- **Unique highlights.** Require one occurrence within the cited step. When “record inspection findings” repeats, use a longer exact quotation or another cell that supports the claim.
- **Thread memory after errors.** Keep the question in the thread with `(no verified answer)` so the analyst can clarify it. Each follow-up still requires fresh evidence.
- **Thread evaluation.** Compare the structural-damage follow-up with and without the actual bilge-well answer as history. Other cases check step changes, scope gaps and the void-space warning.
- **Similarity cutoff.** The reported top cosine similarities were **0.57** for the out-of-scope USDA FGIS question and **0.35** for the relevant “What should I look out for?” A cutoff between them would discard the relevant question and retain the unrelated one. Retrieve four of the six steps and verify their evidence.
- **Test traces.** Keep local test-run logs out of the shared repository. The evaluation reports and ranking fixtures carry the reproducible results.
- The two archived chats and embedding batch cost about US$0.00092 under the historical configuration. For a new Luna run, use the token counts in the trace and the selected gateway's current prices.
- **1. Review grounding.** Check the actual claim, quote and conditional row for each held-out case, including partial answers and track missing required steps separately from wrong inferences.
- **2. Check retrieval coverage.** Compare rankings on the same saved vectors before tuning chunk text, retrieval count or a cutoff and track failures on questions about conditional actions.
- **3. Handle revisions.** Replay the suite and check quote coordinates against a new manual edition before accepting its hash.
- The first prototype was estimated at 20 minutes of agent-assisted work. Subsequent revisions were untimed. Offline checks cover extraction, quote rejection, rendered PDF marks, retrieval replay and trace records.
