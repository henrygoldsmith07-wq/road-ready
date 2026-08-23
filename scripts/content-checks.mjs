/* Road Ready — content QA checks (pure, importable).
 * Exports runChecks(data) → {errors:[{rule,msg}], warnings:[...], stats:{...}}
 * Consumed by scripts/validate-content.mjs (CLI) and tests/content-qa.test.mjs.
 */
const ID_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\d{1,3}$/;
const PLACEHOLDER_RE = /\b(todo|tbd|fixme|placeholder|lorem ipsum|xxx)\b/i;
const CONCEPT_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const VERIFIED_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const OFFICIAL_SOURCE_HOSTS = new Set([
  "www.dmv.ca.gov", "www.dps.texas.gov", "dmv.ny.gov", "www.flhsmv.gov", "dol.wa.gov", "www.pa.gov",
]);

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
  const SOURCE_REGISTRY = data.SOURCE_REGISTRY || {};
  const UNIVERSAL_DEFAULTS = data.UNIVERSAL_DEFAULTS || {};
  const CONCEPT_FACT_KEYS = data.CONCEPT_FACT_KEYS || {};
  const errors = [];
  const warnings = [];
  const provenance = new Map(); // qid -> {sourceId, section, defaulted}
  const err = (rule, msg) => errors.push({ rule, msg });
  const warn = (rule, msg, meta) => warnings.push(meta ? { rule, msg, ...meta } : { rule, msg });

  /* ---------- 0. official source registry ---------- */
  const MAX_AGE_DAYS = data.VERIFICATION_MAX_AGE_DAYS ?? 365;
  const nowMs = opts.nowMs ?? Date.now();
  for (const [sourceId, source] of Object.entries(SOURCE_REGISTRY)) {
    if (!source || typeof source !== "object") { err("source-registry", `${sourceId} is not an object`); continue; }
    if (typeof source.agency !== "string" || !source.agency.trim()) err("source-registry", `${sourceId} missing agency`);
    if (typeof source.title !== "string" || !source.title.trim()) err("source-registry", `${sourceId} missing title`);
    if (typeof source.jurisdiction !== "string" || !(source.jurisdiction === "*" || source.jurisdiction in STATE_PACKS))
      err("source-registry", `${sourceId} has unknown jurisdiction "${source.jurisdiction || ""}"`);
    if (typeof source.verified !== "string" || !VERIFIED_DATE_RE.test(source.verified)) {
      err("source-registry", `${sourceId} needs a YYYY-MM-DD verified date`);
    } else {
      // verification must be fresh — stale citations fail CI
      const ageDays = Math.floor((nowMs - Date.parse(source.verified + "T00:00:00Z")) / 86400000);
      if (!isFinite(ageDays) || ageDays < 0) err("source-registry", `${sourceId} has an impossible verified date (${source.verified})`);
      else if (ageDays > MAX_AGE_DAYS)
        err("provenance-stale", `${sourceId} verification is ${ageDays} days old (max ${MAX_AGE_DAYS}) — re-verify against the current edition and update "verified"`);
    }
    if (source.url == null) {
      // composite sources cite many documents; a note explaining that is mandatory
      if (!source.note) err("source-registry", `${sourceId} has no URL and no note justifying its absence`);
    } else {
      try {
        const url = new URL(source.url);
        if (url.protocol !== "https:") err("source-registry", `${sourceId} URL must use HTTPS`);
        if (!OFFICIAL_SOURCE_HOSTS.has(url.hostname)) err("source-registry", `${sourceId} URL is not on an approved issuing-agency host: ${url.hostname}`);
      } catch {
        err("source-registry", `${sourceId} has an invalid URL`);
      }
    }
  }
  for (const [packId, pack] of Object.entries(STATE_PACKS)) {
    if (packId === "generic") continue;
    if (typeof pack.sourceId !== "string" || !(pack.sourceId in SOURCE_REGISTRY)) {
      err("source-registry", `${packId} pack has no registered official source`);
    } else if (SOURCE_REGISTRY[pack.sourceId].jurisdiction !== packId) {
      err("source-registry", `${packId} pack points to a ${SOURCE_REGISTRY[pack.sourceId].jurisdiction} source`);
    }
  }

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

    /* ---------- jurisdiction / provenance schema ---------- */
    const isJurisdictional = Array.isArray(q.jurisdiction) && q.jurisdiction.length > 0;
    if (q.jurisdiction != null) {
      if (!Array.isArray(q.jurisdiction)) err("schema", `[${id}] jurisdiction must be an array of pack ids`);
      else if (!q.jurisdiction.length) err("schema", `[${id}] empty jurisdiction array (omit for universal questions)`);
      else for (const j of q.jurisdiction) {
        if (!(j in STATE_PACKS)) err("schema", `[${id}] jurisdiction "${j}" has no matching pack`);
        else if (j === "generic") err("schema", `[${id}] jurisdiction "generic" is implied — omit the tag for universal questions`);
      }
    }
    if (isJurisdictional) {
      // jurisdiction-tagged questions carry full provenance — no exceptions
      if (typeof q.sourceId !== "string" || !q.sourceId.trim())
        err("provenance", `[${id}] jurisdiction-tagged question missing sourceId`);
      if (typeof q.sourceSection !== "string" || !q.sourceSection.trim())
        err("provenance", `[${id}] jurisdiction-tagged question missing sourceSection`);
      if (typeof q.sourceId === "string" && !(q.sourceId in SOURCE_REGISTRY))
        err("source-registry", `[${id}] references unregistered source "${q.sourceId}"`);
      else if (typeof q.sourceId === "string") {
        const sourceJurisdiction = SOURCE_REGISTRY[q.sourceId].jurisdiction;
        if (!q.jurisdiction.includes(sourceJurisdiction))
          err("source-registry", `[${id}] source jurisdiction ${sourceJurisdiction} does not match question tags`);
        else
          provenance.set(id, { sourceId: q.sourceId, section: q.sourceSection || null, defaulted: false });
      }
      if (typeof q.concept !== "string" || !CONCEPT_RE.test(q.concept || ""))
        err("schema", `[${id}] jurisdiction-tagged question needs a kebab-case concept (e.g. "school-bus")`);
    } else {
      // universal questions MUST resolve through UNIVERSAL_DEFAULTS — hard
      // requirement, no silent fallbacks anywhere in the toolchain
      if (typeof q.sourceId === "string" && q.sourceId.trim()) {
        if (!(q.sourceId in SOURCE_REGISTRY))
          err("source-registry", `[${id}] references unregistered source "${q.sourceId}"`);
        else
          provenance.set(id, { sourceId: q.sourceId, section: q.sourceSection || null, defaulted: false });
      } else {
        const def = UNIVERSAL_DEFAULTS[q.cat];
        if (!def) {
          err("provenance", `[${id}] has no source and category "${q.cat}" has no universal default — add sourceId or a UNIVERSAL_DEFAULTS entry`);
        } else if (!(def.sourceId in SOURCE_REGISTRY)) {
          err("source-registry", `[${id}] default source "${def.sourceId}" is not registered`);
        } else {
          provenance.set(id, { sourceId: def.sourceId, section: q.sourceSection || def.section || null, defaulted: true });
        }
      }
    }
    if (q.concept != null && typeof q.concept === "string" && !CONCEPT_RE.test(q.concept))
      err("schema", `[${id}] concept must be kebab-case`);
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

  /* ---------- 4. state-fact consistency (factual QA) ---------- */
  // A jurisdiction-tagged question's correct answer + explanation must
  // corroborate the pack's fact table for its concept. Numbers are compared
  // numerically ("four" == "4"); non-numeric facts fall back to keyword overlap.
  const WORD_NUMS = { one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10", fifteen: "15", twenty: "20", thirty: "30", forty: "40", fifty: "50" };
  // Numbers are extracted from the RAW text (not norm()) so decimals survive:
  // "0.01%" must never collapse into the same token as "0.05%".
  const digitsOf = (s) => new Set(
    (String(s).toLowerCase().replace(new RegExp(`\\b(${Object.keys(WORD_NUMS).join("|")})\\b`, "g"), (m) => WORD_NUMS[m])
      .match(/\d+(?:\.\d+)?/g) || [])
  );
  const STOPWORDS = new Set(["the", "and", "for", "you", "your", "must", "may", "not", "are", "when", "with", "from", "this", "that", "have", "only", "any", "more", "least"]);
  const keywordsOf = (s) => new Set(norm(s).split(" ").filter((w) => w.length > 3 && !STOPWORDS.has(w)));
  const sharesKeyword = (aSet, bSet) => {
    for (const t of aSet) if (bSet.has(t)) return true;
    return false;
  };

  let factChecks = 0;
  for (const q of QUESTIONS) {
    if (!Array.isArray(q.jurisdiction) || !q.jurisdiction.length || typeof q.concept !== "string") continue;
    const factKeys = CONCEPT_FACT_KEYS[q.concept];
    if (!factKeys) continue; // concept has no fact-table guard — nothing to cross-check
    const packId = q.jurisdiction[0];
    const facts = (STATE_PACKS[packId] || {}).facts || {};
    const candidates = factKeys.map((k) => [k, facts[k]]).filter(([, v]) => typeof v === "string" && v.trim());
    if (!candidates.length) {
      warn("fact-consistency", `[${q.id}] concept "${q.concept}" has no ${packId} fact-table entry to check against — add one to the pack`, { review: true });
      continue;
    }
    const evidence = `${Number.isInteger(q.a) && Array.isArray(q.choices) ? String(q.choices[q.a] ?? "") : ""} ${q.why || ""}`;
    const evidenceDigits = digitsOf(evidence);
    const evidenceKeywords = keywordsOf(evidence);
    const corroborates = candidates.some(([k, v]) => {
      const nums = digitsOf(v);
      if (nums.size) return [...nums].some((n) => evidenceDigits.has(n));
      return sharesKeyword(keywordsOf(v), evidenceKeywords);
    });
    if (!corroborates) {
      err("fact-consistency", `[${q.id}] "${q.concept}" answer/explanation does not corroborate the ${packId} fact table (${candidates.map(([k]) => k).join("/")})`);
    } else {
      factChecks++;
    }
  }

  /* ---------- 5. topic-balance checker ---------- */
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
    stats: { questions: total, signs: Object.keys(SIGNS).length, packs: Object.keys(STATE_PACKS).length, balance, factChecks },
    provenance,
  };
}

/* ---------- provenance helpers (used by CLI manifest mode + tests) ---------- */
export function canonicalQuestion(q) {
  const { source, ...rest } = q; // explicit source tracked separately
  void source;
  return JSON.stringify(Object.keys(rest).sort().reduce((o, k) => { o[k] = rest[k]; return o; }, {}));
}
