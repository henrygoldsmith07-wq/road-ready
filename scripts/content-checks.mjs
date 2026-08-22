/* Road Ready — content QA checks (pure, importable).
 * Exports runChecks(data) → {errors:[{rule,msg}], warnings:[...], stats:{...}}
 * Consumed by scripts/validate-content.mjs (CLI) and tests/content-qa.test.mjs.
 */
const ID_RE = /^[a-z]{1,4}\d{1,3}$/;
const PLACEHOLDER_RE = /\b(todo|tbd|fixme|placeholder|lorem ipsum|xxx)\b/i;

export const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
export const tokens = (s) => new Set(norm(s).split(" ").filter((w) => w.length > 2));

export function jaccard(aSet, bSet) {
  let inter = 0;
  for (const t of aSet) if (bSet.has(t)) inter++;
  return aSet.size + bSet.size === 0 ? 0 : inter / (aSet.size + bSet.size - inter);
}

/**
 * @param {{QUESTIONS:object[], CATEGORIES:object, SIGNS:object, STATE_PACKS?:object}} data
 */
export function runChecks(data, opts = {}) {
  const { QUESTIONS, CATEGORIES, SIGNS } = data;
  const STATE_PACKS = data.STATE_PACKS || {};
  const errors = [];
  const warnings = [];
  const err = (rule, msg) => errors.push({ rule, msg });
  const warn = (rule, msg, meta) => warnings.push(meta ? { rule, msg, ...meta } : { rule, msg });

  /* ---------- 1. question-bank schema validation ---------- */
  for (const q of QUESTIONS) {
    if (!q || typeof q !== "object") { err("schema", `entry is not an object`); continue; }
    const id = q.id ?? "(no id)";
    if (typeof q.id !== "string" || !ID_RE.test(q.id)) err("schema", `[${id}] bad id format`);
    if (!q.cat || typeof q.cat !== "string") err("schema", `[${id}] missing cat`);
    else if (!(q.cat in CATEGORIES)) err("schema", `[${id}] unknown category "${q.cat}"`);
    if (typeof q.q !== "string" || q.q.trim().length < 8) err("schema", `[${id}] question text too short`);
    if (!Array.isArray(q.choices) || q.choices.length < 2 || q.choices.length > 5) {
      err("schema", `[${id}] must have 2–5 choices`);
    } else {
      if (!q.choices.every((c) => typeof c === "string" && c.trim().length > 0)) err("schema", `[${id}] empty choice`);
      if (!Number.isInteger(q.a) || q.a < 0 || q.a >= q.choices.length) err("schema", `[${id}] answer index out of range`);
    }
    if (typeof q.why !== "string" || q.why.trim() === "") err("schema", `[${id}] missing explanation`);
    if (q.signId != null && !(q.signId in SIGNS)) err("signs-ref", `[${id}] references unknown sign "${q.signId}"`);
    if (Array.isArray(q.states)) {
      if (!q.states.length) err("schema", `[${id}] empty states array (omit instead)`);
      for (const s of q.states) {
        if (!(s in STATE_PACKS)) err("schema", `[${id}] states tag "${s}" has no matching pack`);
      }
    }
    if (typeof q.diff === "string" && !["easy", "medium", "hard"].includes(q.diff)) {
      err("schema", `[${id}] diff must be easy|medium|hard`);
    }
  }
  {
    const seenIds = new Set();
    for (const q of QUESTIONS) {
      if (seenIds.has(q.id)) err("schema", `duplicate question id "${q.id}"`);
      seenIds.add(q.id);
    }
  }

  /* ---------- 2. duplicate-question detection ---------- */
  // Sign questions legitimately share a prompt ("This sign means:") while the
  // displayed sign differs — so identity is prompt + signId.
  const dupKey = (q) => `${norm(q.q || "")}|${q.signId || "-"}`;
  const SIM_THRESHOLD = opts.simThreshold ?? 0.82;
  const byNormQ = new Map();
  const tokenized = [];
  for (const q of QUESTIONS) {
    const k = dupKey(q);
    if (byNormQ.has(k)) err("dup-question", `"${q.id}" duplicates "${byNormQ.get(k)}": "${(q.q || "").slice(0, 70)}"`);
    else byNormQ.set(k, q.id);
    tokenized.push({ id: q.id, cat: q.cat, signId: q.signId || null, toks: tokens(q.q || ""), text: (q.q || "").slice(0, 70) });
  }
  // near-dupe comparison stays within a topic and only for signless prompts:
  // two different signs with the same prompt are intentionally alike
  for (let i = 0; i < tokenized.length; i++) {
    if (tokenized[i].signId) continue;
    for (let j = i + 1; j < tokenized.length; j++) {
      if (tokenized[j].signId) continue;
      if (tokenized[i].cat !== tokenized[j].cat) continue;
      const sim = jaccard(tokenized[i].toks, tokenized[j].toks);
      if (sim >= SIM_THRESHOLD) warn("near-dup-question", `"${tokenized[i].id}" ~ "${tokenized[j].id}" (${Math.round(sim * 100)}%): "${tokenized[i].text}"`);
    }
  }

  /* ---------- 3. duplicate-answer detection ---------- */
  for (const q of QUESTIONS) {
    if (!Array.isArray(q.choices)) continue;
    const normChoices = q.choices.map(norm);
    const counts = new Map();
    normChoices.forEach((c, i) => {
      const list = counts.get(c) || [];
      list.push(i);
      counts.set(c, list);
    });
    for (const [c, idxs] of counts.entries()) {
      if (idxs.length > 1) err("dup-answer", `[${q.id}] identical choices at positions ${idxs.join(", ")}: "${String(q.choices[idxs[0]]).slice(0, 50)}"`);
    }
    if (Number.isInteger(q.a) && q.choices[q.a] != null) {
      const correct = normChoices[q.a];
      if (correct && normChoices.some((c, i) => i !== q.a && c === correct)) {
        err("dup-answer", `[${q.id}] correct answer text also appears as another choice — grading ambiguity`);
      }
    }
  }

  /* ---------- 4. topic-balance checker ---------- */
  const total = QUESTIONS.length;
  const counts = {};
  for (const q of QUESTIONS) counts[q.cat] = (counts[q.cat] || 0) + 1;
  const cats = Object.keys(CATEGORIES);
  const fairShare = total / Math.max(1, cats.length);
  const MIN_RATIO = opts.minTopicRatio ?? 0.45;
  const balance = {};
  for (const c of cats) {
    const n = counts[c] || 0;
    balance[c] = n;
    if (n === 0) { err("topic-balance", `topic "${c}" has no questions`); continue; }
    if (n < fairShare * MIN_RATIO) warn("topic-balance", `topic "${c}" thin: ${n}/${total} questions (${Math.round((n / fairShare) * 100)}% of even split)`);
  }
  for (const c of Object.keys(counts)) {
    if (!(c in CATEGORIES)) err("topic-balance", `questions use unregistered topic "${c}"`);
  }

  /* ---------- 5. broken-explanation checker ---------- */
  // Advisory heuristics carry review:true — surfaced, never CI-blocking.
  for (const q of QUESTIONS) {
    const why = typeof q.why === "string" ? q.why : "";
    if (!why) continue; // schema already flagged
    if (why.trim().length < 40) warn("explanation", `[${q.id}] explanation suspiciously short (${why.trim().length} chars)`, { review: true });
    if (PLACEHOLDER_RE.test(why)) err("explanation", `[${q.id}] placeholder text in explanation`);
    if (/[?]\s*$/.test(why)) warn("explanation", `[${q.id}] explanation ends with a question mark — truncated?`, { review: true });
    if (Number.isInteger(q.a) && Array.isArray(q.choices)) {
      const correctText = String(q.choices[q.a] ?? "");
      if (norm(correctText) && norm(why) === norm(correctText)) {
        err("explanation", `[${q.id}] explanation just echoes the answer without teaching anything`);
      }
      const ct = tokens(correctText);
      const wt = tokens(why);
      if (ct.size && wt.size && jaccard(ct, wt) === 0) {
        warn("explanation", `[${q.id}] explanation shares no wording with the correct answer — check it explains the right option`, { review: true });
      }
    }
  }

  /* ---------- 6. sign-data validation ---------- */
  const referenced = new Set(QUESTIONS.filter((q) => q.signId).map((q) => q.signId));
  for (const [id, s] of Object.entries(SIGNS)) {
    if (!s.name || typeof s.name !== "string") err("sign-data", `[sign:${id}] missing name`);
    if (!s.family || typeof s.family !== "string") warn("sign-data", `[sign:${id}] missing family`);
    if (!s.meaning || typeof s.meaning !== "string") err("sign-data", `[sign:${id}] missing meaning`);
    else if (s.meaning.trim().length < 30) warn("sign-data", `[sign:${id}] meaning very short`);
    if (typeof s.svg !== "string" || s.svg.trim() === "") err("sign-data", `[sign:${id}] missing svg`);
    else {
      const open = (s.svg.match(/<[a-zA-Z]/g) || []).length;
      const close = (s.svg.match(/<\/[a-zA-Z]+>/g) || []).length;
      const selfClosing = (s.svg.match(/\/>/g) || []).length;
      if (open !== close + selfClosing) err("sign-data", `[sign:${id}] svg tags unbalanced (${open} open, ${close} closed, ${selfClosing} self-closing)`);
      if (/NaN|undefined|\$\{/.test(s.svg)) err("sign-data", `[sign:${id}] svg contains template leakage`);
    }
  }
  const unusedSigns = Object.keys(SIGNS).filter((id) => !referenced.has(id));
  if (unusedSigns.length) warn("sign-data", `unused signs: ${unusedSigns.join(", ")}`, { review: true });

  return {
    errors,
    warnings,
    stats: { questions: total, signs: Object.keys(SIGNS).length, packs: Object.keys(STATE_PACKS).length, balance },
  };
}

/* ---------- provenance helpers (used by CLI manifest mode + tests) ---------- */
export function canonicalQuestion(q) {
  const { source, ...rest } = q; // explicit source tracked separately
  void source;
  return JSON.stringify(Object.keys(rest).sort().reduce((o, k) => { o[k] = rest[k]; return o; }, {}));
}
