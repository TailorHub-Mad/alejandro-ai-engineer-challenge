"use strict";

const form = document.querySelector("#ask-form");
const question = document.querySelector("#question");
const submit = document.querySelector("#submit");
const asked = document.querySelector("#asked");
const askedQuestion = document.querySelector("#asked-question");
const editQuestion = document.querySelector("#edit-question");
const progress = document.querySelector("#progress");
const result = document.querySelector("#result");
const evidence = document.querySelector("#evidence");
const gapScope = document.querySelector("#gap-scope");
const answerTrace = document.querySelector("#answer-trace");
const passages = document.querySelector("#passages");
const claims = document.querySelector("#claims");
const sourcePane = document.querySelector("#source-pane");
const pdfViewer = document.querySelector("#pdf-viewer");
const modes = document.querySelector("#question-mode");
const newMode = document.querySelector("#mode-new");
const followUpMode = document.querySelector("#mode-follow-up");
const recent = document.querySelector("#recent-questions");
const threadNav = document.querySelector("#thread-nav");
const contextLabel = document.querySelector("#context-label");
const recentKey = "case-study:questions:v1";
const maxRecent = 24;
const noVerifiedAnswer = "(no verified answer)";
const allowedChatModels = new Set(["gpt-6-luna", "gpt-6.2-sol", "gpt-6.2-astra"]);
let turns = [];
let activeId = null;
let sourceTrigger = null;

function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function locationLabel(row) {
  return "Page " + row.page + " · Section " + row.section + " · Step " + row.step;
}

function highlightedPdf(row, quote) {
  return "/source/A3/passages/" + encodeURIComponent(row.id) + ".pdf?quote=" +
    encodeURIComponent(quote) + "#page=" +
    encodeURIComponent(row.page) + "&view=Fit&toolbar=0";
}

function showPassage(row, quote, trigger) {
  sourceTrigger = trigger;
  sourcePane.hidden = false;
  document.querySelector("#source-location").textContent = row.source + " · " + locationLabel(row);
  document.querySelector("#source-text").textContent = row.text;
  document.querySelector("#source-quote").textContent = quote;
  const url = highlightedPdf(row, quote);
  if (pdfViewer.getAttribute("src") !== url) {
    pdfViewer.title = "Highlighted PDF · " + locationLabel(row);
    pdfViewer.src = url;
  }
  document.querySelector("#open-passage").href = url;
  for (const link of result.querySelectorAll(".cite")) {
    if (link.href === trigger.href) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  }
  document.querySelector("#source-heading").focus();
}

function closeSource() {
  sourcePane.hidden = true;
  pdfViewer.removeAttribute("src");
  sourcePane.querySelector(".transcript").open = false;
  for (const link of result.querySelectorAll("[aria-current]")) link.removeAttribute("aria-current");
  sourceTrigger?.focus();
  sourceTrigger = null;
}

document.querySelector("#close-source").addEventListener("click", closeSource);
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && recent.open) {
    recent.open = false;
    recent.querySelector("summary").focus();
    return;
  }
  if (event.key === "Escape" && !sourcePane.hidden) closeSource();
});
document.addEventListener("click", event => {
  if (recent.open && !recent.contains(event.target)) recent.open = false;
});

function citationLink(row, quote) {
  const link = element("a", "p. " + row.page + " · step " + row.step);
  link.href = highlightedPdf(row, quote);
  link.className = "cite";
  link.title = quote;
  link.setAttribute("aria-controls", "source-pane");
  link.setAttribute("aria-label", "Read exact quote, " + locationLabel(row) + ": " + quote);
  link.addEventListener("click", event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    showPassage(row, quote, link);
  });
  return link;
}

function display(title, status) {
  document.querySelector("#result-title").textContent = title;
  editQuestion.textContent = status === "error" ? "Edit and retry" : "Edit question";
  result.dataset.status = status;
  result.hidden = false;
  if (document.activeElement === askedQuestion) result.focus({ preventScroll: true });
}

function showTrace(trace) {
  const tokens = trace.tokens || {};
  const fields = [
    ["Model", trace.model],
    ["Retrieval depth (k)", trace.k],
    ["Retrieved IDs, in rank order", trace.retrieved_ids.join(", ") || "None"],
    ["Cited IDs", trace.cited_ids.join(", ") || "None"],
    ["Edition SHA-256", trace.edition_hash],
    ["Latency", trace.latency_ms + " ms"],
    ["Embedding tokens", tokens.embedding_tokens],
    ["Prompt tokens", tokens.prompt_tokens],
    ["Completion tokens", tokens.completion_tokens],
  ];
  const list = document.querySelector("#trace-fields");
  list.replaceChildren();
  for (const [label, value] of fields) {
    list.append(element("dt", label), element("dd", value ?? "Unreported"));
  }
  answerTrace.hidden = false;
}

function distinctClaims(claims) {
  const grouped = new Map();
  for (const claim of claims) {
    const key = claim.text.normalize("NFKC").trim().replace(/\s+/gu, " ").replace(/[.!?]+$/u, "").toLowerCase();
    if (!grouped.has(key)) grouped.set(key, { text: claim.text, citations: [] });
    const citations = grouped.get(key).citations;
    for (const ref of claim.citations) {
      if (!citations.some(other => other.id === ref.id && other.quote === ref.quote)) citations.push(ref);
    }
  }
  return Array.from(grouped.values());
}

function allClaimsRemoved(data) {
  return data.removed_claims > 0 && !data.claims.some(claim => claim.citations.length);
}

function showAnswer(data) {
  if (data.status === "error") {
    claims.append(element("p", data.message));
    if (Array.isArray(data.trace?.retrieved_ids) && Array.isArray(data.trace?.cited_ids)) showTrace(data.trace);
    display("Request failed", "error");
    return;
  }
  if (!data.trace || data.claims.some(claim => claim.citations.some(citation => typeof citation === "string"))) {
    throw new Error("Restart the local backend to load the updated citation format, then ask again.");
  }
  const unverified = allClaimsRemoved(data);
  const gap = data.status === "evidence_gap" && !unverified;
  const byId = new Map(data.evidence.map(row => [row.id, row]));
  const citedIds = new Set(data.claims.flatMap(claim => claim.citations.map(citation => citation.id)));
  for (const [index, row] of data.evidence.entries()) {
    const detail = document.createElement("details");
    const summary = element("summary", row.source + " · " + locationLabel(row));
    const metrics = ["Rank " + (index + 1)];
    if (gap) {
      if (citedIds.has(row.id)) metrics.push("Cited for the supported part");
      metrics.push(citedIds.size ? "Does not answer the missing part" : "Does not answer");
    } else {
      metrics.push(citedIds.has(row.id) ? "Cited" : "Retrieved only");
    }
    if (Number.isFinite(row.score)) metrics.push("Cosine " + row.score.toFixed(5));
    summary.append(element("small", metrics.join(" · ")));
    const page = element("a", "Open original page ↗");
    page.href = "/source/A3#page=" + encodeURIComponent(row.page);
    page.target = "_blank";
    page.rel = "noopener";
    detail.append(summary, element("p", row.text), page);
    passages.append(detail);
  }
  for (const claim of unverified ? [] : distinctClaims(data.claims)) {
    const block = document.createElement("div");
    block.className = "claim";
    block.append(element("p", claim.text));
    const citations = document.createElement("div");
    citations.className = "citations";
    for (const { id, quote } of claim.citations) {
      const row = byId.get(id);
      if (!row || typeof quote !== "string" || !quote.trim()) {
        throw new Error("The answer is missing its quoted source. Please try again.");
      }
      citations.append(citationLink(row, quote));
    }
    if (citations.childElementCount) block.append(citations);
    claims.append(block);
  }
  if (Number.isInteger(data.removed_claims) && data.removed_claims > 0) {
    const noun = data.removed_claims === 1 ? "claim" : "claims";
    const note = element("small", `${data.removed_claims} ${noun} removed: could not be verified`);
    note.className = "verification-note";
    claims.append(note);
  }
  if (typeof data.suggestion === "string" && data.suggestion.trim()) {
    const suggestion = element("p", data.suggestion);
    suggestion.className = "narrowing-suggestion";
    claims.append(suggestion);
  }
  showTrace(data.trace);
  evidence.hidden = !data.evidence.length;
  evidence.open = gap;
  gapScope.hidden = !gap;
  document.querySelector("#passages-label").textContent = gap ? "Nearest passages" : "Source passages";
  document.querySelector("#passage-count").textContent = "(" + data.evidence.length + ")";
  const title = gap ? (citedIds.size ? "Partial answer" : "Evidence gap") : "Answer";
  display(unverified ? "Could not verify an answer." : title, data.status);
}

function findTurn(id) {
  return turns.find(turn => turn.id === id);
}

function saveRecent() {
  try {
    sessionStorage.setItem(recentKey, JSON.stringify({ turns, activeId }));
  } catch {
    // Keep the in-memory thread usable when browser storage is full or disabled.
  }
}

function syncMode() {
  const parent = findTurn(activeId);
  modes.hidden = !parent;
  const follow = parent && followUpMode.checked;
  form.querySelector("label[for=question]").classList.toggle("visually-hidden", !!parent);
  contextLabel.hidden = !follow;
  contextLabel.textContent = follow ? "Following up on: " + parent.question : "";
  question.placeholder = follow ? "Continue this thread…" :
    asked.hidden ? "What would you like to check?" : "Ask another question about the manual…";
}

function selectMode(follow) {
  newMode.checked = !follow;
  followUpMode.checked = follow;
  syncMode();
}

modes.addEventListener("change", syncMode);

function turnButton(turn) {
  const button = element("button", turn.question);
  if (turn.data.status === "error") button.append(element("small", "Request failed"));
  button.type = "button";
  button.dataset.turnId = String(turn.id);
  button.disabled = submit.disabled;
  if (turn.id === activeId) button.setAttribute("aria-current", "true");
  button.addEventListener("click", () => {
    if (submit.disabled) return;
    openTurn(turn);
    saveRecent();
  });
  return button;
}

function updateNavigation() {
  recent.hidden = turns.length === 0;
  document.querySelector("#recent-list").replaceChildren(...turns.slice().reverse().map(turnButton));
  const current = findTurn(activeId);
  const related = current ? turns.filter(turn => turn.threadId === current.threadId) : [];
  threadNav.hidden = related.length < 2 || submit.disabled;
  document.querySelector("#thread-count").textContent = "(" + related.length + ")";
  document.querySelector("#thread-list").replaceChildren(...related.map(turnButton));
}

function resetResult() {
  if (!sourcePane.hidden) closeSource();
  result.hidden = evidence.hidden = gapScope.hidden = answerTrace.hidden = true;
  evidence.open = answerTrace.open = false;
  claims.replaceChildren();
  passages.replaceChildren();
}

function showQuestion(text) {
  document.querySelector(".intro").hidden = true;
  document.querySelector(".examples").hidden = true;
  question.rows = 1;
  asked.hidden = false;
  askedQuestion.textContent = text;
  askedQuestion.focus();
}

function openTurn(turn, follow = true) {
  resetResult();
  activeId = turn.id;
  recent.open = threadNav.open = false;
  showQuestion(turn.question);
  showAnswer(turn.data);
  selectMode(follow);
  editQuestion.hidden = false;
  updateNavigation();
}

function historyFrom(parent) {
  const history = [];
  for (let turn = parent; turn && history.length < 4; turn = findTurn(turn.parentId)) {
    const answer = turn.data.status === "error" || allClaimsRemoved(turn.data) ? noVerifiedAnswer :
      distinctClaims(turn.data.claims).map(claim => claim.text).join("\n").slice(0, 3000);
    history.unshift({ question: turn.question, answer });
  }
  return history;
}

async function checkBackendModel(signal) {
  const response = await fetch("/api/config", { cache: "no-store", signal });
  const legacyMessage = "This tab is connected to an older server. Run docker compose up --build from the project folder and open the Docker address listed in the README.";
  if (response.status === 404) throw new Error(legacyMessage);
  let config;
  try {
    config = await response.json();
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error(legacyMessage);
  }
  if (!response.ok) throw new Error(typeof config?.detail === "string" ? config.detail : "The local server could not report its model settings.");
  const model = config?.chat_model;
  if (typeof model !== "string" || !allowedChatModels.has(model.replace(/^openai\//, ""))) {
    throw new Error("Set CHAT_MODEL to gpt-6-luna, gpt-6.2-sol, or gpt-6.2-astra in the project's .env, then restart the app.");
  }
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (submit.disabled) return;
  const value = question.value.trim();
  if (!value) {
    question.setCustomValidity("Enter a question.");
    question.reportValidity();
    return;
  }
  const parent = followUpMode.checked ? findTurn(activeId) : null;
  const history = historyFrom(parent);
  const request = { question: value };
  if (history.length) request.history = history;
  submit.disabled = modes.disabled = true;
  recent.open = threadNav.open = false;
  activeId = parent?.id ?? null;
  resetResult();
  showQuestion(value);
  syncMode();
  updateNavigation();
  question.value = "";
  editQuestion.hidden = true;
  progress.textContent = "Searching the manual and checking the answer…";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  let data;
  let errorTrace;
  try {
    await checkBackendModel(controller.signal);
    const response = await fetch("/api/ask", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request), signal: controller.signal,
    });
    data = await response.json();
    if (!response.ok) {
      errorTrace = data.detail?.trace;
      const detail = typeof data.detail === "string" ? data.detail : data.detail?.message;
      throw new Error(detail || "Check the question and try again.");
    }
    if (history.length && data.history_turns !== history.length) {
      throw new Error("Restart the local backend to enable threaded follow-ups, then submit this question again.");
    }
    showAnswer(data);
  } catch (error) {
    const message = error.name === "AbortError" ? "The request timed out. Try again."
      : error instanceof TypeError ? "Could not reach the local backend." : error.message;
    data = { status: "error", message, trace: errorTrace };
    resetResult();
    showAnswer(data);
    if (!question.value) question.value = value;
  } finally {
    clearTimeout(timeout);
    progress.textContent = "";
    submit.disabled = modes.disabled = false;
    editQuestion.hidden = false;
  }
  const id = (turns.at(-1)?.id ?? 0) + 1;
  turns.push({ id, parentId: parent?.id ?? null, threadId: parent?.threadId ?? id, question: value, data });
  turns = turns.slice(-maxRecent);
  activeId = id;
  selectMode(!!parent);
  updateNavigation();
  saveRecent();
});

editQuestion.addEventListener("click", () => {
  const text = askedQuestion.textContent;
  const parent = findTurn(findTurn(activeId)?.parentId);
  if (parent) openTurn(parent);
  else selectMode(false);
  question.value = text;
  question.setCustomValidity("");
  question.focus();
});
question.addEventListener("input", () => question.setCustomValidity(""));
for (const button of document.querySelectorAll(".example")) {
  button.addEventListener("click", () => {
    question.value = button.firstElementChild.textContent;
    question.setCustomValidity("");
    form.requestSubmit();
  });
}

try {
  const saved = JSON.parse(sessionStorage.getItem(recentKey) || "null");
  if (Array.isArray(saved?.turns)) {
    turns = saved.turns.slice(-maxRecent);
    const current = findTurn(saved.activeId);
    if (current) openTurn(current, current.parentId !== null);
    else updateNavigation();
  }
} catch {
  // Discard incompatible saved responses and leave the initial question form available.
  turns = [];
  activeId = null;
  resetResult();
  asked.hidden = true;
  document.querySelector(".intro").hidden = document.querySelector(".examples").hidden = false;
  question.rows = 3;
  selectMode(false);
  updateNavigation();
}
