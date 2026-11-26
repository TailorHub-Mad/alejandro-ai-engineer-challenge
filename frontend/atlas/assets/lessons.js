window.HOLD_LESSONS = [
  {
    id: "scope",
    title: "Define the evidence boundary",
    summary: "An analyst asks a question and gets a checkable claim or an explicit evidence gap. Every factual answer must point back to text the analyst can read.",
    principle: "Start with what would count as evidence. The application can establish what the selected edition says. An authorised inspector decides whether an actual vessel is ready.",
    mechanics: [
      { title: "One document, three pages", body: "A3 identifies the Australian Department of Agriculture, Fisheries and Forestry work instruction IMLS-12-3065, version 7.0, published 1 July 2026. The indexed collection covers section 8.1, pages 20–22, and its six steps for inspecting the inside of an empty hold." },
      { title: "A file can exist outside the searchable collection", body: "The repository also holds a USDA directive and a second Australian document. The extractor opens only A3. Even elsewhere in A3, a cross-reference to section 16 supplies a pointer rather than the contents of section 16." },
      { title: "Separate preparation from answering", body: "Prepare the passages and vectors once. On a question, reuse that work, embed the question, retrieve the highest-ranked passages and ask the chat model to answer. A single question can be answered without rereading the PDF." },
      { title: "Pick a useful pair of questions", body: "A location and a minimum weight can concern the same piles of residue. These pages explain where the piles go and why they are retained. A minimum weight would require additional evidence. Topic overlap alone cannot settle either question." },
      { title: "Read the attribution", body: "The source record names the publisher, edition, section, pages, access date and reuse terms. It also describes the formatting changes. A reviewer can distinguish the department's instructions from the tool's extracted representation." }
    ],
    pitfall: "A fluent answer can quietly broaden Australian export guidance into a universal maritime rule. Keep the edition, jurisdiction and selected section visible.",
    check: "Can you explain why a question about section 16 may fall outside the collection even when a retrieved passage mentions it?",
    code: { file: "backend/source.py", symbol: "SECTION_TITLE" }
  },
  {
    id: "pdf",
    title: "Recover the table structure",
    summary: "A page stores glyphs and positions. The relationship between a finding and an action lives partly in the arrangement of its table cells.",
    principle: "Preserve the reading relationship that carries the instruction. On page 20, the row for structural damage and the row for residue prescribe different actions.",
    mechanics: [
      { title: "Verify the bytes", body: "Before parsing, the code checks the source file exists and compares its SHA-256 digest with the reviewed PDF's digest. The digest fingerprints the bytes. A match identifies this copy, while a publisher update requires a new review of its content and layout." },
      { title: "Translate page numbers", body: "Python slices include the start index and exclude the end. pdf.pages[19:22] reads list entries 19, 20 and 21. pdfplumber reports these to readers as pages 20, 21 and 22." },
      { title: "Find an outer step and its inner decisions", body: "On each selected page, pdfplumber finds the ruled tables. The extractor sorts by left edge and takes the leftmost as the outer step table. It skips the heading, crops the step-number cell, and assigns inner tables whose top lies inside the action cell's vertical span." },
      { title: "Read across a decision row", body: "Text above the first inner table becomes the step introduction. For a nested table, the header must contain If and Then. Each body row supplies a condition and its corresponding action. The extractor makes their pairing explicit in the text." },
      { title: "Check the edition-specific assumptions", body: "This parser expects two populated outer cells per step and two meaningful cells per decision row. It also expects the extracted step numbers, in order, to be exactly 1 through 6. The assumptions are narrow enough to inspect against three original pages." }
    ],
    pitfall: "Flattening the two columns into a single stream can attach the action for residues to structural damage. The words can all survive while the instruction changes.",
    check: "Look at page 20, step 2. Find the condition attached to the instruction to retain material in piles, then compare the neighbouring damage row.",
    code: { file: "backend/source.py", symbol: "extract_chunks" }
  },
  {
    id: "chunks",
    title: "Give each step an address",
    summary: "A chunk is the smallest unit this system retrieves. Here it is a complete numbered inspection step, including its notes and decision rows.",
    principle: "Choose a retrieval unit that can support a meaningful citation. A condition, its action and the surrounding step should arrive together.",
    mechanics: [
      { title: "Keep source coordinates", body: "A3-8.1-03 is an application ID. A3 identifies the source, 8.1 identifies the section and 03 identifies step 3. Separate fields keep the printed page, section and step available to both the prompt builder and the interface." },
      { title: "Clean the extraction conservatively", body: "The PDF's bullet font sometimes yields a replacement character. clean replaces that glyph with a bullet and collapses whitespace. The extractor inserts a blank line before each reconstructed condition–action pair, which makes a passage readable in the evidence panel." },
      { title: "Make a second representation for search", body: "The current embedding_text uses the procedure before the If/Then table and prefixes the section title and step number. Readers and the chat model receive the full step, including its branches. The vector lab replays the original whole-step inputs." },
      { title: "Observe the size trade-off", body: "Step 3 contains a long inspection checklist and several branches. Step 6 is one short instruction. Whole-step chunks preserve the structure, but one vector for a long step must represent several topics at once." },
      { title: "Keep cross-references intelligible", body: "Step 5 tells the inspector to repeat earlier activities in reverse. Retrieving step 5 by itself can leave a dependency on other steps. The search returns independent hits and does not automatically follow referenced step numbers." }
    ],
    pitfall: "An ID can survive a document revision while the words at that location change. Interpret each ID together with the index edition.",
    check: "Compare the stored step with the text submitted for embedding. Which words are added, which line breaks disappear, and which fields still locate the original?",
    code: { file: "backend/index.py", symbol: "embedding_text" }
  },
  {
    id: "embeddings",
    title: "Turn language into coordinates",
    summary: "The same OpenAI embedding model converts the six passage strings and each new question into arrays of 256 numbers.",
    principle: "A vector lets the program compare texts mathematically. Its coordinates are learned features. The original passage remains the evidence that a reader can interpret.",
    mechanics: [
      { title: "Specify one coordinate system", body: "The client requests text-embedding-3-small with dimensions set to 256. Using the same model and settings for questions and passages makes the two sets of coordinates comparable. A change of embedding model requires rebuilding the stored vectors." },
      { title: "Batch the documents", body: "A normal rebuild sends six strings to the embeddings endpoint in one request. A normal question sends a one-element list. The saved development experiment combined six passages and two known questions into one eight-item batch to transport the same input strings." },
      { title: "Restore the association", body: "Each response entry carries its input index. The client sorts entries by that index and requires a complete sequence from zero to the last input. A missing or duplicated position would associate the wrong vector with a citation." },
      { title: "Divide by length", body: "unit_vectors converts values to float32 and computes each row's Euclidean length, the square root of the sum of squared components. Dividing every component by that length gives a unit-length direction. The same operation applies to a new question." },
      { title: "Reject unusable geometry", body: "The matrix must have one row per input and exactly 256 columns. A zero length makes division undefined. A non-finite length signals unusable numeric values. The code rejects these cases before the vectors enter a ranking." }
    ],
    pitfall: "An individual coordinate has no assigned label such as residue or weight. A similarity score also carries no calibrated probability that a passage answers the question.",
    check: "If every coordinate of a nonzero vector were doubled, what would happen to its unit-length direction and cosine score?",
    code: { file: "backend/models.py", symbol: "embed" }
  },
  {
    id: "index",
    title: "Persist and reload the collection",
    summary: "The search index is a local JSON file. It holds the edition, embedding configuration, passages and a six-by-256 matrix in matching row order.",
    principle: "The durable unit is a complete snapshot. Its text, metadata and vectors have to agree for an answer to lead back to the right page.",
    mechanics: [
      { title: "Pair rows by position", body: "The first item in chunks corresponds to the first row of vectors, and so on. Six rows with 256 coordinates contain 1,536 scalar values. JSON stores those numbers as text on disk. NumPy restores a float32 matrix in memory." },
      { title: "Publish a complete write", body: "build writes a named temporary file in the destination directory. Only after writing the complete JSON does os.replace switch the destination to it. A failed write before replacement leaves the previous destination intact, and a finally block cleans up the temporary path." },
      { title: "Check the snapshot on load", body: "Index reads UTF-8 JSON, checks the embedding model and dimension count, and requires a nonempty chunk list with unique IDs. It checks matrix shape and unit-normalises the rows again. These checks cannot detect every possible mismatch, such as two otherwise valid vector rows exchanged in the file." },
      { title: "Know when memory changes", body: "FastAPI's load_index uses a one-entry process cache. The first successful request loads the index; later requests reuse it. Replacing the disk file leaves an already-loaded process using its current snapshot. Restart the server after a rebuild." }
    ],
    pitfall: "Changing the source file, rebuilding the index, and making a running server use that index are three distinct events.",
    check: "Imagine replacing index.json halfway through a review. Predict what a running process will see before and after a restart.",
    code: { file: "backend/index.py", symbol: "build" }
  },
  {
    id: "request",
    title: "Follow the request boundaries",
    summary: "The browser sends an English question to a local FastAPI endpoint. Only the backend holds a provider key and makes model requests.",
    principle: "At each boundary, identify the sender, recipient and exact data crossing it. That explains credentials, network dependencies and the different failure messages.",
    mechanics: [
      { title: "Validate the question twice", body: "The web form requires input, limits it to 1,200 characters and trims whitespace. POST /api/ask independently requires a JSON string of length 1–1,200 and rejects a whitespace-only result after stripping it. A script calling the API still encounters the backend check." },
      { title: "Resolve the right credential", body: "MODEL_PROVIDER chooses openai, openrouter or vercel. Each maps to an HTTPS base URL, its own environment variable and the correct model-name prefix. The same backend credential serves both embeddings and generation. The frontend receives neither the key nor the upstream response body on errors." },
      { title: "Follow two sequential upstream calls", body: "For a new question the backend sends the question string for embedding, ranks locally, then sends the question plus its four selected passages for generation. Each upstream request sets a 25-second timeout. The frontend aborts its own fetch after 65 seconds; aborting the browser request does not itself guarantee cancellation at the provider." },
      { title: "Interpret HTTP status codes", body: "An input error returns 422. An unreadable or incompatible local index becomes 503. A provider or model-response failure becomes 502 with a display-safe message. An ordinary evidence gap completes successfully with HTTP 200 and a status inside the response body." },
      { title: "Handle upstream failures without leaking details", body: "The provider client maps 401 to a key check, 402 to available credit, 403 to model permissions and 429 to rate limiting. It declines HTTP redirects and avoids returning raw upstream bodies. The current client performs one attempt per call." }
    ],
    pitfall: "Evidence can be missing even when every service works. A failed authentication or network connection says nothing about what the manual contains.",
    check: "Trace a query when the model key has expired. Which layer learns the upstream status, which status reaches the browser, and what does the analyst see?",
    code: { file: "backend/app.py", symbol: "ask_question" }
  },
  {
    id: "retrieval",
    title: "Rank six passages",
    summary: "A normalised question vector is compared with each normalised passage vector. The four highest scores determine exactly which source text the chat model can inspect.",
    principle: "For unit vectors, the dot product equals cosine similarity. Values near one indicate similar directions, zero indicates perpendicular directions, and minus one indicates opposite directions.",
    mechanics: [
      { title: "Compute every score", body: "self.vectors @ query takes a 6 × 256 matrix and a 256-element vector and returns six scores. For one score, multiply the question and passage coordinates pairwise and sum all 256 products. An exact scan is cheap at this collection size." },
      { title: "Select before rounding", body: "NumPy sorts the negatives of the scores in ascending order to put the greatest original scores first. A stable sort preserves the original row order for exact ties. The code slices off four winners, then rounds their reported scores to five decimal places." },
      { title: "Inspect a close race", body: "In the archived whole-step index for the location question, step 3 scores 0.55044 and step 1 scores 0.54968. That small difference affects their order. Step 4 ranks third. It entered neither the historical top-two prompt nor its citations. Four slots now admit that direct instruction." },
      { title: "Understand a relevant gap", body: "The minimum-weight question retrieves steps 4 and 3 at 0.44707 and 0.37810. Both discuss the material named in the question. Neither supplies a minimum weight. The PoC forwards its top four. No score cutoff has been calibrated: cosine measures topical similarity, while the answer depends on whether the passage states the requested fact." },
      { title: "Change one parameter at a time", body: "A larger k admits more potential evidence and more distractors. A smaller k can omit a qualifying sentence or an indirectly referenced step. Compare retrieval hits and supported claims on independently labelled questions before changing the production setting." }
    ],
    pitfall: "The highest score is relative to the six available candidates. Even an unrelated question produces a first-place passage.",
    check: "If two displayed scores both round to the same five decimals, can you conclude that the underlying scores were exactly tied?",
    code: { file: "backend/index.py", symbol: "retrieve" }
  },
  {
    id: "prompt",
    title: "Assemble a bounded model request",
    summary: "The application creates one system message and one user message. The user message carries the question plus the selected passages in a JSON object.",
    principle: "Grounding starts by controlling what evidence the model receives and stating what it may conclude. The model can still infer too much, so the output needs inspection.",
    mechanics: [
      { title: "Set the task and authority", body: "The system message gives the edition and scope, requires condition and action to stay together, asks for explicitly stated purposes, and instructs the model to report missing details. It also forbids certifying a vessel. Whitespace in the system prompt is normalised before sending." },
      { title: "Send only fields the model needs", body: "Each transmitted passage has id, page, step and text. Similarity scores and the full vector matrix stay local. The question and passages are serialised in one user message. A separate system role identifies the instructions the application supplied." },
      { title: "Choose generation settings", body: "The backend defaults to GPT-6 Luna for answers. It requests JSON, uses low reasoning effort and caps the completion budget at 2,048 tokens. The trace shows which model answered." },
      { title: "Request claims with citations", body: "The intended object has a status of answered or evidence_gap and an array of claims. Each current claim pairs its text with citations containing a retrieved ID and an exact quote from that step. JSON object mode encourages parseable syntax. Application code performs the field and citation checks separately." },
      { title: "Avoid unsupported explanations", body: "An early run correctly located the piles and then claimed broader benefits about managing residues. The cited rows state the purpose of inspection. The revised prompt asks for the purpose explicitly stated in the passage and drops inferred downstream benefits." }
    ],
    pitfall: "Structured output can be valid JSON while making an unsupported factual claim. Formatting and factual support require different checks.",
    check: "Name two fields that appear in a retrieved row and are absent from the passage object sent to the model. Where does the application use each field?",
    code: { file: "backend/answer.py", symbol: "SYSTEM_PROMPT" }
  },
  {
    id: "validation",
    title: "Validate the answer contract",
    summary: "The server parses model output and checks the status, claims, citation IDs and exact quotes before sending an answer to the browser.",
    principle: "Structural checks can reject an impossible citation. Establishing that a real citation supports the precise wording requires reading the passage.",
    mechanics: [
      { title: "Parse two layers of JSON", body: "The HTTP response itself is JSON. Inside it, choices[0].message.content contains the model's generated text. The client decodes that text again as JSON. A missing choice, missing content or unreadable object leads to a model error." },
      { title: "Define the allowed references", body: "The server looks up every cited ID in this request's retrieved evidence and checks that the quoted text is a contiguous substring of that specific step. Referring to a real step elsewhere in the manual still fails if that step was outside this request's retrieval set." },
      { title: "Check each claim", body: "The status must be answered or evidence_gap. Claims must be a list of at most ten items. Each claim needs a nonblank text string. An answered result needs at least one claim, and every model-authored claim in either status needs at least one valid citation." },
      { title: "Render an empty gap deliberately", body: "The recorded weight response contained evidence_gap and an empty claims list. The server inserted its standard explanation so the interface would have a clear result to display. Only the application-written gap explanation is uncited. Each fact in a partial answer must supply a verified quote." },
      { title: "Treat malformed evidence as an error", body: "An invented passage ID, a mismatched quote or an unsupported answer structure is rejected with HTTP 422. Silently dropping the bad citation could leave a confident sentence on screen without its promised support." }
    ],
    pitfall: "Two words can defeat an otherwise correct citation. Adding a threshold or purpose that a cited row never gives can pass every structural check.",
    check: "Predict what happens to an answered claim with no IDs, a gap with no claims, and a quantitative claim with a valid but irrelevant ID.",
    code: { file: "backend/answer.py", symbol: "ask" }
  },
  {
    id: "interface",
    title: "Make the evidence inspectable",
    summary: "The UI presents each claim next to its citation links and keeps the retrieved passages available for comparison, including when the model reports a gap.",
    principle: "The user should be able to trace a sentence back through one click to the highlighted source passage on its original PDF page, beside the answer.",
    mechanics: [
      { title: "Control the interaction", body: "Selecting an example submits it immediately and hides the examples. The composer stays available for a draft while a search runs. Submitting the next question becomes available when the request finishes." },
      { title: "Connect claim, row and page", body: "Clicking a claim's citation selects the PDF passage beside the answer. The label uses the source, page, section and step. This lets a reader compare the exact wording with the model's sentence." },
      { title: "Understand the PDF link", body: "The path /source/A3 serves the local PDF when present and redirects to the official source if absent. The citation viewer identifies the source, original page, section and step, and uses one highlight rectangle per line of the verified quote. The original PDF remains available for context." },
      { title: "Tell three outcomes apart", body: "An answer shows cited claims. A partial answer keeps the supported part. The gap view gives the search scope and labels nearest passages for the missing detail. A failed request shows the error. In all three states the user can submit another question once the request finishes." },
      { title: "Render text as text", body: "Passages and answer sentences are assigned using textContent. Markup-like characters in source or model text therefore appear as ordinary characters. The citation URL carries the retrieved ID and the exact quoted text. Open Answer trace to see the model, k, IDs, edition hash, latency and token counts." }
    ],
    pitfall: "A retrieved row can be relevant without being cited. The evidence panel shows every selected row, while the individual claim links identify the model's references.",
    check: "On the weight case, compare the empty citation list with the retrieved passages. What does each tell the reader?",
    code: { file: "frontend/app.js", symbol: "showAnswer" }
  },
  {
    id: "evaluation",
    title: "Reconstruct the verification run",
    summary: "The record separates question, expected behaviour, retrieved IDs, raw provider output, displayed claims and human judgement. Each part answers a different debugging question.",
    principle: "Check retrieval, answer support, and transport separately. A passing demonstration is evidence about the cases actually exercised.",
    mechanics: [
      { title: "Write expectations before generation", body: "The location case expects piles on the tank top for inspection; the current check also looks for step 4 and its specific purpose, checking for infestation. The weight case expects an evidence gap because the selected section gives no minimum. Recording expectations first makes it harder to accept a plausible answer merely because the model produced it." },
      { title: "Track what was live", body: "The embeddings and chat outputs came from real OpenRouter API playground calls to OpenAI models. Outbound HTTPS was blocked in the development shell. The local FastAPI check replayed the returned values and checked the generated inputs, retrieval and settings. Those are historical top-two recordings. New live runs are saved separately by the evaluator." },
      { title: "Compare the two observed outcomes", body: "The historical location answer cited steps 1 and 3. It gave the location and general inspection purpose twice, but missed step 4’s specific purpose: checking for infestation. The weight case returned an empty evidence gap and passed after backend formatting. The earlier prompt refinement means these are known development examples rather than held-out evidence of generalisation." },
      { title: "Account for usage", body: "The eight-item embedding batch used 1,098 tokens. The two final chat calls used 1,695 input and 139 output tokens together. Their recorded upstream inference cost plus embeddings totals US$0.00092236. The earlier prompt trial adds approximately US$0.00052. Upstream cost and the amount charged to a particular billing account can differ." },
      { title: "Repeat at the right level", body: "python -m eval.run exercises the current case list through the local handler and records retrieval hits, citations and gap outcomes. Use --base-url to exercise a running API. Offline tests cover PDF lines, the gap fallback and rejection of fabricated quotes. Mocked responses exercise the branch logic without spending model credit." }
    ],
    pitfall: "A correct answer can hide poor retrieval if the model supplied a fact from prior knowledge. Inspect the returned passage text and its ID alongside the sentence.",
    check: "Suppose the right step was retrieved but the answer invented a number. Which evidence in the recorded case separates retrieval failure from unsupported generation?",
    code: { file: "eval/run.py", symbol: "main" }
  },
  {
    id: "pilot",
    title: "Decide what earns the next hour",
    summary: "The next engineering decision depends on observed failure modes. The repository prioritises measuring quality, handling changing editions and diagnosing failed pilot requests.",
    principle: "Change the smallest part that addresses a measured weakness, then repeat an independently defined check. A working demo and a pilot serve different purposes.",
    mechanics: [
      { title: "First, measure unseen questions", body: "Collect realistic analyst questions and hold some out of prompt development. Label the required steps, supported facts and genuine gaps. Measure whether a required step appears among the selected passages, whether each claimed fact is supported, and whether the system correctly answers or abstains." },
      { title: "Second, make editions reviewable", body: "Today a pinned PDF digest blocks an unreviewed revision. For a pilot, build a candidate index for the new edition, compare conditional rows and citation pages, repeat the held-out cases, then promote the checked edition. Record a way to restore the previous snapshot." },
      { title: "Third, make failures diagnosable", body: "For flagged pilot queries, capture the edition, model, retrieved IDs, latency and token counts with a suitable privacy policy. A missing source, a poor ranking, an unsupported claim and a provider error call for different repairs. Time how quickly reviewers can classify a failure." },
      { title: "Reprioritise when constraints change", body: "If private sources enter the collection, access checks must precede retrieval, and the team must decide which content may leave the machine for inference. If the corpus grows, first measure scan latency, memory and update time. Those measurements can justify a new storage or indexing choice." },
      { title: "Defend the current trade-off", body: "The fixed public collection fits in one local file. Exact search takes six dot products. There is no scheduled ingestion pipeline, cloud bucket, vector database or AWS emulator in this implementation. Each would need to solve a specific new requirement before it earned its operating cost." }
    ],
    pitfall: "A pilot change can improve one metric while hurting another. Increasing k may surface a required step and also admit distracting instructions from a different condition.",
    check: "If only one more hour were available, which failure would you investigate first, what evidence would you collect, and what result would change your decision?",
    code: { file: "README.md", symbol: "Decisions and discussion" }
  }
];
