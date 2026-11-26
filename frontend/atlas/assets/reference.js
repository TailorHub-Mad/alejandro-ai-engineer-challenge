// Learning reference for the case study implementation and its two recorded cases.
window.HOLD_REFERENCE = {
  "glossary": [
    {
      "term": "Corpus",
      "definition": "The exact material a question can be answered from.",
      "example": "One Australian DAFF work instruction contributes section 8.1, pages 20–22.",
      "lesson": "scope"
    },
    {
      "term": "Provenance",
      "definition": "The trail that lets a reader identify and check the source of a passage.",
      "example": "Source A3, edition 7.0, page 20, section 8.1, step 1 identifies a specific instruction.",
      "lesson": "scope"
    },
    {
      "term": "Edition",
      "definition": "A published version of a source. An instruction can change between editions.",
      "example": "The reviewed work instruction is IMLS-12-3065, version 7.0, dated 1 July 2026.",
      "lesson": "scope"
    },
    {
      "term": "Tank top",
      "definition": "In this excerpt the term names the floor surface inside the hold where the manual says material is retained in piles.",
      "example": "The location question depends on understanding the phrase “tank top” in the retrieved instructions.",
      "lesson": "scope"
    },
    {
      "term": "AO",
      "definition": "The manual’s abbreviation for the authorised officer carrying out the inspection.",
      "example": "Step 4 refers to the AO inspecting material on the tank top for evidence of infestation.",
      "lesson": "scope"
    },
    {
      "term": "SHA-256 digest",
      "definition": "A fixed-length fingerprint of the input bytes. The parser checks it before relying on the reviewed layout.",
      "example": "A publisher can reuse a download URL for a revised PDF. Changed bytes produce a different fingerprint and stop the build.",
      "lesson": "pdf"
    },
    {
      "term": "Page slice",
      "definition": "Python selects a range using a zero-based start and an exclusive end.",
      "example": "pdf.pages[19:22] returns the twentieth, twenty-first and twenty-second pages. The displayed page numbers remain 20, 21 and 22.",
      "lesson": "pdf"
    },
    {
      "term": "Bounding box",
      "definition": "Four coordinates that enclose a region on the PDF page.",
      "example": "The extractor reads the step number and the action from separate cell boxes, then crops the action above its decision table.",
      "lesson": "pdf"
    },
    {
      "term": "Nested table",
      "definition": "A table inside a larger table cell. Its position connects it to the enclosing instruction.",
      "example": "The condition–action rows inside step 2 belong with the ladder inspection. Their vertical position places them inside that step.",
      "lesson": "pdf"
    },
    {
      "term": "Glyph normalisation",
      "definition": "A correction to the extracted characters used to represent printed marks.",
      "example": "The reviewed PDF yields a replacement character for a round bullet. The cleaner maps it to a bullet and folds whitespace.",
      "lesson": "pdf"
    },
    {
      "term": "Chunk",
      "definition": "The unit stored, embedded, ranked and cited.",
      "example": "Each of the six chunks contains one complete numbered step, including any conditions and actions within it.",
      "lesson": "chunks"
    },
    {
      "term": "Stable passage ID",
      "definition": "A repeatable identifier assigned to the same step when the selected edition is reprocessed.",
      "example": "A3-8.1-03 identifies step 3 in section 8.1 of A3. The separate page field locates it on page 21.",
      "lesson": "chunks"
    },
    {
      "term": "Metadata",
      "definition": "Fields describing a passage that travel with its text.",
      "example": "Each chunk records id, source, page, section, step and text. Retrieval adds a score to the returned copy.",
      "lesson": "chunks"
    },
    {
      "term": "Embedding",
      "definition": "A model-generated list of numbers representing text for similarity search.",
      "example": "text-embedding-3-small converts the body of step 4 and a question about piles into comparable lists.",
      "lesson": "embeddings"
    },
    {
      "term": "Dimension",
      "definition": "One coordinate in a vector. All coordinates must use the same learned space.",
      "example": "Each passage and question has 256 coordinates. A value in one position has no named inspection meaning.",
      "lesson": "embeddings"
    },
    {
      "term": "Batch",
      "definition": "Several inputs sent together in one model request.",
      "example": "A normal build embeds six passages at once. The verification run batched six passages and two questions, totalling eight inputs.",
      "lesson": "embeddings"
    },
    {
      "term": "Response index",
      "definition": "A provider-supplied position that connects a returned embedding to its input text.",
      "example": "The client sorts embedding rows by index and checks for each index from zero through the final input position.",
      "lesson": "embeddings"
    },
    {
      "term": "Float32",
      "definition": "A four-byte floating-point representation used for local vector arithmetic.",
      "example": "The six-by-256 matrix holds 1,536 numbers. Its numerical array takes 6,144 bytes, excluding text, metadata and the JSON representation.",
      "lesson": "embeddings"
    },
    {
      "term": "Euclidean norm",
      "definition": "A vector’s length, obtained by taking the square root of the sum of squared coordinates.",
      "example": "A vector with coordinates 3 and 4 has length 5. Dividing each coordinate by 5 gives 0.6 and 0.8.",
      "lesson": "embeddings"
    },
    {
      "term": "Unit vector",
      "definition": "A vector scaled to length one, preserving its direction.",
      "example": "unit_vectors divides each matrix row by its own length and rejects zero-length vectors.",
      "lesson": "embeddings"
    },
    {
      "term": "Persisted index",
      "definition": "The saved material needed to recover search without embedding the documents again.",
      "example": "data/store/index.json contains the edition, embedding model, dimensions, chunk records and vectors.",
      "lesson": "index"
    },
    {
      "term": "Atomic replacement",
      "definition": "Publishing a freshly built file by replacing the destination in one filesystem operation.",
      "example": "build writes complete JSON to a temporary file beside the current index before os.replace installs it.",
      "lesson": "index"
    },
    {
      "term": "Process-local cache",
      "definition": "A value retained in the memory of one running backend process.",
      "example": "load_index loads the file on the first successful request. Restarting the backend reloads a rebuilt file.",
      "lesson": "index"
    },
    {
      "term": "API route",
      "definition": "A method and path with a defined input and output contract.",
      "example": "POST /api/ask accepts a JSON object with question. GET /source/A3 serves the original PDF or redirects to the publisher.",
      "lesson": "request"
    },
    {
      "term": "Request validation",
      "definition": "Checks on the submitted data before expensive processing begins.",
      "example": "The question must be a string of 1–1,200 characters. The route also strips surrounding whitespace and rejects whitespace-only input.",
      "lesson": "request"
    },
    {
      "term": "Provider",
      "definition": "The service endpoint and credentials used to reach a model.",
      "example": "The recorded run used OpenRouter. The application also supports direct OpenAI and Vercel AI Gateway configuration.",
      "lesson": "request"
    },
    {
      "term": "Bearer credential",
      "definition": "A secret authentication value placed in the server’s outgoing Authorization header.",
      "example": "The active provider maps to one backend environment variable. The question form needs only the text of the question.",
      "lesson": "request"
    },
    {
      "term": "Single turn",
      "definition": "A standalone question starts with an empty conversation history.",
      "example": "Another question starts fresh. Follow-up question uses up to four preceding exchanges from the selected thread to understand references such as “What weight?”",
      "lesson": "request"
    },
    {
      "term": "Cosine similarity",
      "definition": "A measure of how closely two vectors point in the same direction, ranging from −1 to 1 for nonzero real vectors.",
      "example": "For the location question, step 3 scored 0.55044. These units describe vector similarity and have no probability interpretation.",
      "lesson": "retrieval"
    },
    {
      "term": "Dot product",
      "definition": "The sum of coordinate-by-coordinate products. For two unit vectors it equals their cosine similarity.",
      "example": "self.vectors @ query computes six scores by multiplying the six-row matrix by the question vector.",
      "lesson": "retrieval"
    },
    {
      "term": "Top-k retrieval",
      "definition": "Keeping a bounded number of the highest-ranking passages.",
      "example": "The historical whole-step ranking places step 4 third for the location question. The original top-two run supplied steps 3 and 1.",
      "lesson": "retrieval"
    },
    {
      "term": "Stable sort",
      "definition": "A sort that retains the original order of equal-valued items.",
      "example": "Two exactly tied steps preserve index order. Near-equal scores retain their full precision until the displayed values are rounded.",
      "lesson": "retrieval"
    },
    {
      "term": "System message",
      "definition": "The message defining the chat model’s task, scope and expected output.",
      "example": "The prompt confines the answer to section 8.1 and asks for a citation for each supported claim.",
      "lesson": "prompt"
    },
    {
      "term": "Context",
      "definition": "The information supplied to the model alongside the question.",
      "example": "The user-role message serialises the question and its selected passages. Each passage carries its ID, page, step and text.",
      "lesson": "prompt"
    },
    {
      "term": "Token",
      "definition": "A unit of text processed by a language model. Counts depend on the model’s tokenizer.",
      "example": "The recorded location case used 803 prompt tokens and 122 completion tokens.",
      "lesson": "prompt"
    },
    {
      "term": "Temperature",
      "definition": "A generation parameter affecting variation in token selection.",
      "example": "The archived chat requests specified temperature 0. The current request uses low reasoning effort and omits the temperature parameter.",
      "lesson": "prompt"
    },
    {
      "term": "JSON object mode",
      "definition": "A generation setting that asks the model to produce a machine-readable JSON object.",
      "example": "The application still parses and checks status, claims and citations after receiving the model’s response.",
      "lesson": "prompt"
    },
    {
      "term": "Evidence gap",
      "definition": "A successful response indicating that the retrieved text does not establish the requested detail.",
      "example": "The historical weight question matched two relevant steps. Neither specified a minimum pile weight.",
      "lesson": "validation"
    },
    {
      "term": "Citation membership",
      "definition": "A structural test that limits claim references to passage IDs present in the retrieved context.",
      "example": "For retrieval of steps 3 and 1, a citation to step 4 makes an answered response fail validation.",
      "lesson": "validation"
    },
    {
      "term": "Entailment",
      "definition": "Whether a passage actually supports the meaning of a claim.",
      "example": "A passage can support collecting piles for inspection while providing no evidence for a numerical weight.",
      "lesson": "validation"
    },
    {
      "term": "DOM",
      "definition": "The browser’s in-memory representation of the page and its controls.",
      "example": "The browser renders each claim and its citations, then selects the highlighted PDF evidence when the reader activates a citation.",
      "lesson": "interface"
    },
    {
      "term": "Fragment link",
      "definition": "The part after # in a URL identifying a location within a page or viewer.",
      "example": "A #page=21 fragment hints which page to open in a PDF viewer. The app also provides a highlighted view of the cited passage.",
      "lesson": "interface"
    },
    {
      "term": "Timeout",
      "definition": "A bound on waiting for an operation, configured at the point where that operation runs.",
      "example": "The HTTP model client uses a 25-second timeout on its call. The browser independently aborts its fetch after 65 seconds.",
      "lesson": "interface"
    },
    {
      "term": "Regression check",
      "definition": "A repeatable case that detects a previously identified failure returning.",
      "example": "The extraction test checks that the action about piles stays with residues and the demonstration requirement stays with damage.",
      "lesson": "evaluation"
    },
    {
      "term": "Replay",
      "definition": "Reusing a captured provider response to exercise local application processing.",
      "example": "The verification sent real model requests through the provider playground, then checked the matching payloads and responses through FastAPI in process.",
      "lesson": "evaluation"
    },
    {
      "term": "Upstream inference cost",
      "definition": "The provider-reported model cost for a particular request, which can differ from the account charge.",
      "example": "The final embedding batch and two chat runs together reported about US$0.00092 in upstream cost.",
      "lesson": "evaluation"
    },
    {
      "term": "Held-out question",
      "definition": "A question reserved for assessment and kept out of prompt and parameter tuning.",
      "example": "A future analyst-authored test set would let the team measure whether a revised prompt generalises beyond the two development cases.",
      "lesson": "pilot"
    },
    {
      "term": "Retrieval hit",
      "definition": "A case where the selected set contains a passage labelled as supporting the expected answer.",
      "example": "A future quality check could count whether any retrieved step contains the fact named in a reviewer’s label.",
      "lesson": "pilot"
    },
    {
      "term": "Diagnostic trace",
      "definition": "A record of a request’s stages used to locate its failure.",
      "example": "A proposed pilot trace would connect the model, index edition, retrieved IDs, latency and token counts for a flagged answer.",
      "lesson": "pilot"
    }
  ],
  "quiz": [
    {
      "question": "What can the analyst establish from an answer in this PoC?",
      "choices": [
        "That a vessel has passed an official inspection",
        "What the selected edition says about inspection inside an empty hold",
        "How all Australian cargo inspections are performed"
      ],
      "answer": 1,
      "explanation": "The collection covers six steps in one work instruction. The operator can consult and check that guidance. An authorised inspection determines vessel readiness.",
      "lesson": "scope"
    },
    {
      "question": "The publisher silently replaces the PDF at the same URL. What happens on the next build?",
      "choices": [
        "Indexing stops when the file digest differs",
        "The parser silently applies the old page coordinates",
        "All six chunk IDs gain a new edition suffix"
      ],
      "answer": 0,
      "explanation": "extract_chunks compares the downloaded bytes with the pinned SHA-256 digest before it opens the document. An edition change needs review.",
      "lesson": "pdf"
    },
    {
      "question": "Why is step 2 a useful stress test for extraction?",
      "choices": [
        "Its table uses a different source publisher",
        "Its page contains only that step",
        "Damage and residue have different actions in neighbouring rows"
      ],
      "answer": 2,
      "explanation": "A flattening error could assign the instruction about collecting piles to structural damage. The regression test checks the two rows separately.",
      "lesson": "chunks"
    },
    {
      "question": "Why does Models.embed sort the provider’s rows before returning their vectors?",
      "choices": [
        "To make longer passages rank first",
        "To align each vector with the original input position",
        "To make equal scores statistically independent"
      ],
      "answer": 1,
      "explanation": "An embedding’s response index identifies its input. A duplicate or missing index would break the connection between passage text and vector.",
      "lesson": "embeddings"
    },
    {
      "question": "You rebuild the index while an active backend already has it cached. What must happen before new questions use the new file?",
      "choices": [
        "Restart that backend process",
        "Reload the webpage",
        "Re-enter the PDF access date"
      ],
      "answer": 0,
      "explanation": "load_index caches a single Index object in the process. A browser reload does not replace that object.",
      "lesson": "index"
    },
    {
      "question": "Why does a matrix–vector multiplication produce cosine scores here?",
      "choices": [
        "Every token appears the same number of times",
        "The JSON file arranges passages by meaning",
        "Both stored vectors and the query are scaled to unit length"
      ],
      "answer": 2,
      "explanation": "The cosine divides the dot product by both lengths. With unit vectors, both factors in the denominator are one.",
      "lesson": "retrieval"
    },
    {
      "question": "The runner reports step 3 at 0.55044 and step 1 at 0.54968. Which conclusion follows?",
      "choices": [
        "Step 3 is more likely to be true by 0.076 percentage points",
        "Step 3 ranked slightly ahead of step 1 for this query",
        "Step 3 alone should be enough to answer every related question"
      ],
      "answer": 1,
      "explanation": "The numbers are similarity scores for a particular embedding model and query. Each passage still needs to support the relevant factual claim.",
      "lesson": "retrieval"
    },
    {
      "question": "Why does the weight question still go to the chat model after retrieval?",
      "choices": [
        "The route always returns the highest-ranked four steps from the loaded index and delegates support assessment to generation",
        "The retriever detects a numerical threshold in the manual",
        "The app automatically fetches the full PDF again to look for weights"
      ],
      "answer": 0,
      "explanation": "Nearby text can discuss piles while omitting their minimum weight. There is no cosine cutoff in this implementation.",
      "lesson": "prompt"
    },
    {
      "question": "The model returns an answered claim citing a real passage ID that was outside this request’s retrieved set. What does the API do?",
      "choices": [
        "Accepts it because the passage exists somewhere in the index",
        "Performs another search and rewrites the citation",
        "Rejects the claim with HTTP 422"
      ],
      "answer": 2,
      "explanation": "Every citation must resolve to a retrieved step and quote an exact substring of that step.",
      "lesson": "validation"
    },
    {
      "question": "A statement is wrong but cites a passage that was actually retrieved. Which check can expose it?",
      "choices": [
        "Changing the passage ID to a string",
        "Reading the passage against the statement’s meaning",
        "Checking that every line is valid JSON"
      ],
      "answer": 1,
      "explanation": "Membership and JSON checks establish structure. A reviewer can catch a claim whose meaning goes beyond the cited text.",
      "lesson": "validation"
    },
    {
      "question": "The weight case returns evidence_gap with an empty claims list. What reaches the reader?",
      "choices": [
        "The standard gap explanation and the retrieved passages",
        "A 503 index error and no evidence",
        "A fabricated default minimum weight"
      ],
      "answer": 0,
      "explanation": "The backend inserts a visible explanation for this valid gap. The interface presents the retrieved steps for inspection.",
      "lesson": "interface"
    },
    {
      "question": "A model provider rejects the credential with HTTP 401. Which status does the local question API return?",
      "choices": [
        "200 with an evidence gap",
        "401 directly from the local form",
        "502 with a safe message identifying the upstream 401"
      ],
      "answer": 2,
      "explanation": "Models.post catches the provider error. ask_question translates a ModelError to a local 502 so a technical failure stays distinct from a successful evidence gap.",
      "lesson": "request"
    },
    {
      "question": "What did the original two k = 2 recordings establish?",
      "choices": [
        "The system has measured generalisation across unseen vessel questions",
        "Live embedding and chat responses matched requests replayed through the local application",
        "Every network and browser step ran live end to end on the review machine"
      ],
      "answer": 1,
      "explanation": "The shell could not reach the provider directly. The captured outputs demonstrate real model behaviour and local processing for the earlier two-passage configuration.",
      "lesson": "evaluation"
    },
    {
      "question": "What distinguishes a development case from a held-out test in this project?",
      "choices": [
        "Development cases may influence the prompt, while held-out questions are reserved for later assessment",
        "Only held-out cases can have an expected source passage",
        "Development cases must have an incorrect answer"
      ],
      "answer": 0,
      "explanation": "The first answer’s extra explanation prompted a wording change. Repeating that case checks regression, while a separately reserved set can test generalisation.",
      "lesson": "evaluation"
    },
    {
      "question": "A reviewer reports a wrong answer after more manuals are added. Which observation best separates retrieval failure from generation failure?",
      "choices": [
        "The number of files installed by pip",
        "The colour of the answer card",
        "Whether the passages sent to the model contained the required fact"
      ],
      "answer": 2,
      "explanation": "Identify the expected source first. If it was indexed and missed by retrieval, investigate ranking. If the supporting passage arrived, inspect the prompt and the model’s use of evidence.",
      "lesson": "pilot"
    },
    {
      "question": "A pilot introduces private manuals for different teams. Which design changes deserve review before sending a question?",
      "choices": [
        "Increase max_tokens and use a larger font",
        "Apply access rules to retrieval and confirm the inference provider may receive the selected text",
        "Place the department logo in every prompt"
      ],
      "answer": 1,
      "explanation": "The current fixed corpus is public and single-user. A private collection introduces two distinct concerns about who can retrieve a passage and which external service may process it.",
      "lesson": "pilot"
    }
  ],
  "failures": [
    {
      "id": "pdf-missing",
      "label": "Original PDF missing",
      "layer": "Source preparation",
      "trigger": "Run the index builder without the A3 PDF at the configured path.",
      "route": "Preparation command · FileNotFoundError",
      "visible": "The console asks for DAFF work instruction v7.0 at the expected path.",
      "cause": "The parser needs the reviewed document bytes before it can extract or embed a step.",
      "check": "Check data/raw/A3_DAFF_work_instruction_empty_bulk_vessel.pdf and its official acquisition instructions."
    },
    {
      "id": "edition-change",
      "label": "Source edition changed",
      "layer": "Source preparation",
      "trigger": "Build from a file whose SHA-256 digest differs from the pinned digest.",
      "route": "Preparation command · ValueError",
      "visible": "The console says the PDF differs from the reviewed edition.",
      "cause": "The published URL can survive a change to the page layout or wording. The source check prevents accidental re-indexing.",
      "check": "Compare edition, selected pages and conditional rows with the reviewed copy before updating the parser or pin."
    },
    {
      "id": "table-shape",
      "label": "Decision table shape changed",
      "layer": "Source preparation",
      "trigger": "The extractor finds no table on a selected page or a decision-table header lacks If or Then.",
      "route": "Preparation command · ValueError",
      "visible": "The console identifies the missing page table or unexpected decision table at a step.",
      "cause": "The extractor relies on structured table geometry and a particular document edition.",
      "check": "Compare page coordinates and headers with the PDF. Check that the six steps appear in order before accepting a new edition."
    },
    {
      "id": "index-unavailable",
      "label": "Index unavailable",
      "layer": "Index load",
      "trigger": "Ask a question before building the index, or open an unreadable JSON index.",
      "route": "POST /api/ask · HTTP 503",
      "visible": "The index is unavailable. Run python -m backend.index and restart the server.",
      "cause": "The backend needs a complete local index before it can rank passages.",
      "check": "Check index.json, run the preparation command successfully, and restart the backend."
    },
    {
      "id": "index-incompatible",
      "label": "Index uses a different vector space",
      "layer": "Index load",
      "trigger": "Load a store with a different embedding-model name or dimension count.",
      "route": "POST /api/ask · HTTP 503",
      "visible": "The app displays the same index-unavailable message used for a failed load.",
      "cause": "The loader checks stored model and dimensions. Comparing vectors from incompatible spaces invalidates the ranking.",
      "check": "Compare index metadata to text-embedding-3-small and 256, then rebuild with the intended settings."
    },
    {
      "id": "stale-cache",
      "label": "Old index after a rebuild",
      "layer": "Index cache",
      "trigger": "Replace index.json after this backend has already loaded a valid index.",
      "route": "POST /api/ask · cached search may still succeed",
      "visible": "Answers may continue citing older text or ranking an earlier set of passages.",
      "cause": "The single-entry process cache never checks the modification time of the file.",
      "check": "Restart the backend and compare a known passage to the rebuilt index."
    },
    {
      "id": "blank-question",
      "label": "Question is blank",
      "layer": "Input validation",
      "trigger": "Submit an empty or whitespace-only question.",
      "route": "Browser form validation or POST /api/ask · HTTP 422",
      "visible": "The browser asks for a question. The whitespace-only API check returns “Enter a question.”",
      "cause": "Client-side trimming catches spaces. The API independently validates the field and checks its stripped value.",
      "check": "Submit a nonempty question. A direct API client must send JSON containing a question string."
    },
    {
      "id": "credential",
      "label": "Model credential rejected",
      "layer": "Provider transport",
      "trigger": "The selected provider returns HTTP 401 for its bearer credential.",
      "route": "POST /api/ask · local HTTP 502",
      "visible": "Model service returned HTTP 401. Check the backend API key.",
      "cause": "The provider controls authentication. The local route maps provider errors to a safe ModelError.",
      "check": "Confirm the issuer matches MODEL_PROVIDER and that the correct backend variable is set. Restart after changing configuration."
    },
    {
      "id": "credit",
      "label": "Model credit unavailable",
      "layer": "Provider transport",
      "trigger": "The provider replies with HTTP 402.",
      "route": "POST /api/ask · local HTTP 502",
      "visible": "Model service returned HTTP 402. Check the available model credit.",
      "cause": "A provider billing or credit check prevented the inference call.",
      "check": "Check account credit and the key’s spending limit with the selected provider."
    },
    {
      "id": "permissions",
      "label": "Model access denied",
      "layer": "Provider transport",
      "trigger": "The provider replies with HTTP 403.",
      "route": "POST /api/ask · local HTTP 502",
      "visible": "Model service returned HTTP 403. Check the key's model permissions.",
      "cause": "The credential may lack access to the selected endpoint or model.",
      "check": "Check permissions for both the embedding model and the chat model."
    },
    {
      "id": "rate-limit",
      "label": "Rate limit reached",
      "layer": "Provider transport",
      "trigger": "The provider replies with HTTP 429.",
      "route": "POST /api/ask · local HTTP 502",
      "visible": "Model service returned HTTP 429. The rate limit was reached. Try again shortly.",
      "cause": "The upstream service declined the call under its limits. This client does not schedule automatic retries.",
      "check": "Wait before resubmitting. Review the provider’s limit if it repeats."
    },
    {
      "id": "timeout",
      "label": "Model call times out",
      "layer": "Provider transport",
      "trigger": "A model call raises TimeoutError while using the 25-second timeout.",
      "route": "POST /api/ask · local HTTP 502",
      "visible": "The model service timed out after 25 seconds.",
      "cause": "Embedding and generation are separate outbound calls. Either can time out.",
      "check": "Check connectivity to the active provider and retry. Also distinguish this from the browser’s separate timeout."
    },
    {
      "id": "embedding-batch",
      "label": "Embedding response is incomplete",
      "layer": "Embedding client",
      "trigger": "The returned indexes do not cover every input position exactly once.",
      "route": "Preparation fails, or POST /api/ask · local HTTP 502",
      "visible": "The embedding service returned an incomplete batch.",
      "cause": "The program cannot safely pair vectors with texts when positions are missing or duplicated.",
      "check": "Inspect the count and indexes for a controlled request. Rebuild after the six-passage embedding batch succeeds."
    },
    {
      "id": "embedding-shape",
      "label": "Invalid vector shape or length",
      "layer": "Vector preparation",
      "trigger": "Receive a vector with the wrong width, a zero norm, or a nonfinite norm.",
      "route": "Build fails, local HTTP 502 for a query, or local HTTP 503 during index load",
      "visible": "A direct model error reports invalid embedding dimensions or values. A failed store load shows the index-unavailable message.",
      "cause": "Normalisation and cosine ranking require one finite, nonzero 256-coordinate row per input.",
      "check": "Check which stage supplied the bad vector and whether stored model settings match the active configuration."
    },
    {
      "id": "generation-json",
      "label": "Chat result cannot be parsed",
      "layer": "Generation",
      "trigger": "The chat service returns content that cannot be decoded as JSON or lacks the expected choice/message path.",
      "route": "POST /api/ask · local HTTP 502",
      "visible": "The model returned an unreadable answer. Try again.",
      "cause": "The client must decode the object inside the first choice’s message before the claim validator can inspect it.",
      "check": "Repeat a controlled request with JSON object mode and check the response structure."
    },
    {
      "id": "invalid-citation",
      "label": "Claim cites unavailable evidence",
      "layer": "Answer validation",
      "trigger": "A model-authored claim lacks a citation, refers to an unretrieved ID, or provides a quote absent from that step.",
      "route": "POST /api/ask · local HTTP 422",
      "visible": "The generated answer could not be verified against the source passages.",
      "cause": "The backend checks both the retrieved ID and the exact quote in that passage. A mismatch rejects the generated answer.",
      "check": "Compare the claimed IDs with the IDs retrieved by the same request. Run the citation regression test."
    },
    {
      "id": "gap",
      "label": "Relevant passages omit the answer",
      "layer": "Evidence assessment",
      "trigger": "A question asks for a minimum pile weight absent from the retrieved steps.",
      "route": "POST /api/ask · HTTP 200 · evidence_gap",
      "visible": "Evidence gap. The retrieved passages do not specify the requested detail.",
      "cause": "In the archived run, both passages discussed residue piles without specifying a minimum. The recorded model returned an empty claim list.",
      "check": "Open steps 4 and 3. Confirm the text supports the collection location and supplies no numeric weight."
    },
    {
      "id": "unsupported-detail",
      "label": "Real citation, unsupported inference",
      "layer": "Semantic review",
      "trigger": "The answer cites a retrieved row and adds a purpose the row never states.",
      "route": "POST /api/ask · an answered response can pass structural checks",
      "visible": "The reader may see a plausible explanation beside a valid page citation.",
      "cause": "The backend verifies the ID and exact quoted text. A reviewer checks whether the quote supports the claim.",
      "check": "Read each claim against its row. An early trial added an inferred benefit, so the prompt was tightened and the case repeated."
    },
    {
      "id": "ui-timeout",
      "label": "Browser stops waiting",
      "layer": "Browser",
      "trigger": "The frontend’s 65-second timer aborts its fetch.",
      "route": "Browser AbortController · local status unavailable",
      "visible": "The request timed out. Try again.",
      "cause": "This timer belongs to the browser. Aborting its fetch can leave a backend or provider call already in progress.",
      "check": "Check backend output and upstream connectivity. Retry after inspecting the cause."
    },
    {
      "id": "network",
      "label": "Browser cannot reach the backend",
      "layer": "Browser",
      "trigger": "The form’s fetch fails with a network TypeError.",
      "route": "Browser fetch · no local HTTP response",
      "visible": "Could not reach the local backend.",
      "cause": "The browser could not complete its connection to the local application.",
      "check": "Check the server is running at the expected origin and port."
    },
    {
      "id": "certification",
      "label": "User asks for vessel certification",
      "layer": "Scope",
      "trigger": "A question asks whether a particular vessel can be approved for loading.",
      "route": "Scope instruction · no certification endpoint",
      "visible": "The interface states that vessel readiness requires an authorised inspection.",
      "cause": "Six public procedure steps and a text model cannot establish the physical state of an actual vessel.",
      "check": "Explain the scope and point to applicable guidance. A new certification workflow would require different evidence, authority and design."
    }
  ],
  "files": {
    "backend/source.py": [
      {
        "symbol": "PDF, SOURCE_URL and PDF_SHA256",
        "explanation": "Bind the extractor to a local copy of one dated work instruction, its publisher URL, and the digest of the reviewed bytes. The URL also supplies the PDF route’s fallback."
      },
      {
        "symbol": "SECTION_TITLE",
        "explanation": "Provides the section title added to every passage’s embedding input. It supplies shared inspection context even for the short final steps."
      },
      {
        "symbol": "clean(text)",
        "explanation": "Replaces the reviewed PDF’s broken bullet glyph, splits on whitespace and rejoins the words. The decision-row separator is added after this cleanup."
      },
      {
        "symbol": "extract_chunks()",
        "explanation": "Checks the file and digest, opens pages 20–22, and finds the outer step table and nested condition tables. For each row it reads the step and action crops separately, keeps conditions paired with their actions, and requires steps 1 through 6 in order."
      }
    ],
    "backend/index.py": [
      {
        "symbol": "STORE and TOP_K",
        "explanation": "Select data/store/index.json and retain the four highest-ranked steps. Both values are local configuration in code."
      },
      {
        "symbol": "unit_vectors(values, count)",
        "explanation": "Converts input to float32, takes the norm across each row, checks shape and finite positive lengths, and divides by length. The same operation normalises index and query vectors."
      },
      {
        "symbol": "embedding_text(chunk)",
        "explanation": "Embeds the procedure before its If/Then table with a section and step prefix. The complete chunk stays available for quoting and generation."
      },
      {
        "symbol": "build(models, path)",
        "explanation": "Extracts six chunks, embeds their texts in one request and serialises the normalised vectors with the metadata. A temporary file in the same directory is atomically installed, then cleaned up."
      },
      {
        "symbol": "Index.__init__",
        "explanation": "Loads the JSON and checks embedding metadata, nonempty chunks and unique IDs. Re-validates and normalises the vector matrix for the in-memory store."
      },
      {
        "symbol": "Index.retrieve(question_vector)",
        "explanation": "Normalises the query, computes six dot products and stably sorts by descending score. It selects top-k before rounding the returned scores to five decimals."
      },
      {
        "symbol": "__main__",
        "explanation": "Makes python -m backend.index a rebuild command. It prints the new indexed-step count or exits with the preparation error."
      }
    ],
    "backend/models.py": [
      {
        "symbol": "load_dotenv and PROVIDERS",
        "explanation": "Load the local environment file into the backend. The provider table pins each supported base URL, key variable name and model-name prefix."
      },
      {
        "symbol": "EMBEDDING_MODEL, CHAT_MODEL, DIMENSIONS and TIMEOUT",
        "explanation": "The client defaults to GPT-6 Luna, with Sol and Astra available by configuration. Embeddings use text-embedding-3-small at 256 dimensions. Each upstream request has a 25-second timeout."
      },
      {
        "symbol": "ModelError",
        "explanation": "Carries safe, readable failures between the model client, command-line builder and FastAPI route. Raw upstream error bodies stay out of these messages."
      },
      {
        "symbol": "NoRedirect.redirect_request",
        "explanation": "Returns None so urllib does not automatically follow HTTP redirects while making an authenticated model request."
      },
      {
        "symbol": "Models.__init__",
        "explanation": "Normalises MODEL_PROVIDER, selects a known provider mapping, and reports a configuration error for an unknown name."
      },
      {
        "symbol": "Models.post",
        "explanation": "Reads the selected backend credential, encodes the payload, sends a JSON request with authorised headers and decodes the provider reply. Translates provider HTTP, timeout and connection errors."
      },
      {
        "symbol": "Models.embed",
        "explanation": "Posts a list of input texts to embeddings. It reorders rows using their response index and checks the positions before handing the vectors to the caller."
      },
      {
        "symbol": "Models.generate",
        "explanation": "Requests a JSON object with low reasoning effort and a 2,048-token completion budget. Parses the content of the first choice as JSON."
      }
    ],
    "backend/answer.py": [
      {
        "symbol": "SYSTEM_PROMPT",
        "explanation": "Defines the source edition, scope, evidence rules, response structure and handling of absent facts. The revised wording specifically asks for purposes explicitly stated in the passage."
      },
      {
        "symbol": "ask(question, index, models)",
        "explanation": "Embeds the single question, retrieves the highest-ranked steps, builds the two-message model request and validates the reply before returning claims and evidence."
      },
      {
        "symbol": "context and messages",
        "explanation": "Context includes passage ID, page, step and text. A whitespace-normalised system instruction and a compact JSON user message carry the question and those passages to generation."
      },
      {
        "symbol": "allowed, status and claims",
        "explanation": "Checks the status, claim text and cited IDs against the retrieved steps. Each model-written claim needs an exact quote from its cited step."
      },
      {
        "symbol": "evidence_gap with no claims",
        "explanation": "Inserts the reader-facing sentence that the retrieved passages do not specify the detail. The original retrieved passages remain in the API response."
      }
    ],
    "backend/evidence.py": [
      {
        "symbol": "passage_locations",
        "explanation": "Maps each indexed step to its row on the original page and converts top-based coordinates into PDF coordinates."
      },
      {
        "symbol": "highlighted_pdf",
        "explanation": "Locates the quote in the cited step and highlights its words on each line of the original PDF page."
      }
    ],
    "backend/app.py": [
      {
        "symbol": "Question",
        "explanation": "A Pydantic request model requiring the question string to be 1–1,200 characters long."
      },
      {
        "symbol": "load_index()",
        "explanation": "A one-entry lru_cache lazily loads the index and translates recognised load failures to HTTP 503. A successful load persists for the lifetime of the process."
      },
      {
        "symbol": "ask_question()",
        "explanation": "Implements POST /api/ask. It strips whitespace, rejects a blank question, obtains the index and provider client, and maps ModelError to a local 502."
      },
      {
        "symbol": "original_pdf()",
        "explanation": "Implements GET /source/A3. Returns the local PDF with the application/pdf media type if present, otherwise redirects to the publisher."
      },
      {
        "symbol": "app.mount",
        "explanation": "Serves the frontend directory at the root with HTML index support. The API and source routes are registered first."
      }
    ],
    "frontend/index.html": [
      {
        "symbol": "#ask-form, #question and #submit",
        "explanation": "Collect a single required English question and submit it on demand. The textarea enforces the same 1,200-character input ceiling as the API."
      },
      {
        "symbol": ".example",
        "explanation": "Provides the two recorded questions as buttons. Selecting one fills the input and immediately submits the question."
      },
      {
        "symbol": "#progress, #result and #evidence",
        "explanation": "Separate loading announcements, the final outcome and the retrieved text. The progress region is polite live feedback for assistive technology."
      },
      {
        "symbol": "aside and /source/A3#page=20",
        "explanation": "Show publisher, edition and excerpt coverage and open the original work instruction at the start of the selected section."
      }
    ],
    "frontend/app.js": [
      {
        "symbol": "element(tag, text)",
        "explanation": "Creates a DOM node and assigns its textContent so that model and source text are displayed literally."
      },
      {
        "symbol": "display(title, status)",
        "explanation": "Sets the result heading and status attribute, reveals the result, and moves focus there without forcing a scroll."
      },
      {
        "symbol": "showAnswer(data)",
        "explanation": "Renders the returned claims and evidence. Each claim citation opens its highlighted source beside the answer."
      },
      {
        "symbol": "form submit listener",
        "explanation": "Trims the input, clears stale output, disables repeat submission, creates a 65-second abort timer, and posts JSON to the local question API. It restores the controls in finally."
      },
      {
        "symbol": "question input and .example click listeners",
        "explanation": "Typing clears an old validation message. An example click submits the selected question through the same path as a typed question."
      }
    ],
    "frontend/styles.css": [
      {
        "symbol": ".workspace",
        "explanation": "Lays the question workspace and source sidebar out in two columns. The mobile breakpoint stacks them into one column."
      },
      {
        "symbol": "#result[data-status]",
        "explanation": "Applies different border colours to an answer, an evidence gap and a technical error. The text heading also identifies each state."
      },
      {
        "symbol": "details, summary and .cite",
        "explanation": "Style the expandable evidence and inline source links. Passage text preserves line breaks so the extracted condition/action rows remain readable."
      },
      {
        "symbol": ":focus-visible and [hidden]",
        "explanation": "Give keyboard-focused controls a visible outline and keep inactive result and evidence sections hidden until populated."
      },
      {
        "symbol": "@media",
        "explanation": "At narrow widths, the answer and source viewer stack so each can use the full reading width."
      }
    ],
    "eval/cases.json": [
      {
        "symbol": "residue-location",
        "explanation": "Sets the answerable question and its source-derived expectation before the run. The expected location is piles on the tank top for inspection."
      },
      {
        "symbol": "residue-weight",
        "explanation": "Sets the near-miss question and expected gap. A good result avoids inventing any minimum pile weight."
      }
    ],
    "eval/run.py": [
      {
        "symbol": "main()",
        "explanation": "Reads the current case list and saves the completed evaluation with retrieval, citation and gap metrics. The optional HTTP mode targets a running local server."
      },
      {
        "symbol": "printed JSON",
        "explanation": "Pairs the original question and expectation with actual status, claims, retrieved IDs and scores. A human still judges whether each claim is supported."
      },
      {
        "symbol": "HTTPError and URLError",
        "explanation": "Stops with the case ID and safe local API error on an HTTP failure, or asks for the local server to be started on a connection failure."
      }
    ],
    "eval/results.json": [
      {
        "symbol": "method and model settings",
        "explanation": "Describe the live-provider calls and the separate in-process backend replay, plus the model names, dimensions, top-k, temperature and output cap."
      },
      {
        "symbol": "cases[].retrieved",
        "explanation": "Records ranked passage IDs and five-decimal scores. These are the outputs available for diagnosing retrieval in the two runs."
      },
      {
        "symbol": "provider_response and displayed_claims",
        "explanation": "Keep the actual model outcome and the application’s visible claims separately. The empty-claim gap demonstrates why these fields can differ."
      },
      {
        "symbol": "embeddings, usage and judgement",
        "explanation": "Record the embedding batch, per-answer token usage and upstream cost, and a human-readable reason for each pass."
      }
    ],
    "tests/test_evidence.py": [
      {
        "symbol": "EvidenceTests.test_pdf_table_keeps_damage_and_residue_actions_separate",
        "explanation": "Runs real extraction. Checks the six page assignments and two adjacent branches of step 2 to catch a condition/action swap."
      },
      {
        "symbol": "EvidenceTests.answer_with",
        "explanation": "Supplies mock model output and one known retrieved passage to ask. This isolates answer validation from network and embedding quality."
      },
      {
        "symbol": "test_gap_with_no_claims_gets_a_visible_explanation",
        "explanation": "Verifies that an empty-claim evidence gap produces text for the reader with an empty citation list."
      },
      {
        "symbol": "test_answer_requires_a_retrieved_citation",
        "explanation": "Checks two rejection paths for an answered claim, once with an empty citation list and once with an invented passage ID."
      }
    ],
    ".env.example": [
      {
        "symbol": "MODEL_PROVIDER and empty credential variables",
        "explanation": "A copyable configuration template lists one key variable for each supported issuer. Only the local backend needs a filled credential."
      }
    ],
    "requirements.txt": [
      {
        "symbol": "Pinned Python packages",
        "explanation": "FastAPI provides the API, Uvicorn serves it, pdfplumber extracts PDF structure, NumPy handles vector operations, and python-dotenv reads backend configuration."
      }
    ],
    "README.md": [
      {
        "symbol": "Run locally",
        "explanation": "Lists the environment setup, provider pairs, rebuild and launch commands, URL and evaluation command."
      },
      {
        "symbol": "Source and attribution",
        "explanation": "Identifies the reviewed edition, selected pages, publisher and licence. Records how the source text was reformatted."
      },
      {
        "symbol": "Two recorded cases and decisions",
        "explanation": "Reports observed evidence, tuning history and cost. Distinguishes checks already run from a direct transport and interactive review still to be performed."
      }
    ],
    "data/store/index.json": [
      {
        "symbol": "edition, embedding_model and dimensions",
        "explanation": "Identify the corpus edition and embedding configuration that produced this snapshot."
      },
      {
        "symbol": "chunks and vectors",
        "explanation": "The records and vector matrix use corresponding row positions. The entry at position i supplies the text, ID and page for the vector at position i."
      }
    ],
    "docs/challenge/INSTRUCTIONS.md": [
      {
        "symbol": "R1–R4",
        "explanation": "Define the source, live retrieval, evidence and missing-information requirements. These motivate the parser, local index, per-claim citations and gap state."
      },
      {
        "symbol": "R5–R8",
        "explanation": "Define error feedback, verification, reproduction and decision notes. The interview uses the working prototype to examine engineering judgement and ownership."
      }
    ],
    "docs/challenge/ACCEPTANCE_CRITERIA.md": [
      {
        "symbol": "AC1–AC8",
        "explanation": "Gives observable completion evidence for each requirement. A reviewer can inspect the extraction, rerun both cases and trace an answer to its source."
      },
      {
        "symbol": "Review format",
        "explanation": "Allows approximately three to four hours for the prototype with a five-hour cap, followed by a separate 60-minute review including a ten-minute walkthrough."
      }
    ]
  }
};
