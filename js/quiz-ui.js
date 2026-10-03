/* Road Ready — quiz UI (shared by practice and mock exams).
 *
 * Extracted from app.js: question rendering (signs, scenes, shuffled choices),
 * answering + feedback + the misconception-repair panel, choice marking,
 * flagging and the session timer display. Session lifecycle and scoring
 * (startExam, official simulations, finishSession) stay orchestrated by
 * app.js — this file renders one question and one answer at a time.
 *
 * Classic-script module: dependencies arrive via RoadReadyQuizUI.init(ctx).
 */
"use strict";

(function () {
  let ctx = null;

  /** @returns {any} element by id — vanilla app, DOM types vary per caller */
  function $(id) { return document.getElementById(id); }

  /** The live session object (mutated by app.js's lifecycle). */
  function session() { return ctx.getSession(); }

  function renderTimer() {
    const s = session();
    if (!s) return;
    const m = Math.floor(s.timeLeft / 60), sec = s.timeLeft % 60;
    $("qTimer").innerHTML = `${ctx.icon("clock", 13)} ${m}:${String(sec).padStart(2, "0")}`;
    $("qTimer").classList.toggle("urgent", s.timeLeft < 60);
  }

  function renderQuiz() {
    const { CATEGORIES, icon, escapeHTML, signArt, shuffle, speak } = ctx;
    const s = session();
    if (!s) return;
    const q = s.questions[s.i];
    const total = s.questions.length;
    // When this question became answerable. The gap to the answer is the only
    // evidence we have of whether it was recalled or worked out.
    s.shownAt = Date.now();
    $("qprogBar").style.setProperty("--w", (100 * s.i / total) + "%");
    $("qCounter").textContent = `Q ${s.i + 1}/${total}`;
    $("qCategory").textContent = (CATEGORIES[q.cat] || {}).name || q.cat;
    // question forms: single sign, sign combination, ASCII road-layout scene, and photo placeholder
    const signIds = Array.isArray(q.signIds) && q.signIds.length ? q.signIds : (q.signId ? [q.signId] : []);
    $("signFrame").hidden = !signIds.length;
    if (signIds.length) {
      $("signFrame").innerHTML = signIds.length > 1
        ? `<div class="sign-row">${signIds.map((id) => signArt(id, 104)).join("")}</div>`
        : signArt(signIds[0], 150);
    }
    const sceneHost = $("qScene");
    if (q.scene) {
      const isPhoto = q.form === "photo";
      const label = isPhoto ? "photograph — described scene" : "road layout diagram";
      const photoHead = isPhoto ? `<div class="photo-badge">${icon("camera", 12)} PHOTO — imagine this view</div>` : "";
      sceneHost.hidden = false;
      sceneHost.innerHTML = `${photoHead}<pre class="scene${isPhoto ? " photo-scene" : ""}" aria-label="${label}">${escapeHTML(q.scene)}</pre>`;
    } else {
      sceneHost.hidden = true;
      sceneHost.innerHTML = "";
    }
    $("qText").textContent = q.q;

    const box = $("choices");
    box.innerHTML = "";
    const order = shuffle(q.choices.map((_, idx) => idx));
    s.order = order;
    order.forEach((origIdx, disp) => {
      const b = document.createElement("button");
      b.className = "choice";
      b.innerHTML = `<span class="choice-key">${disp + 1}</span><span class="choice-text">${escapeHTML(q.choices[origIdx])}</span><span class="choice-mark"></span>`;
      b.addEventListener("click", () => answer(origIdx, b));
      box.appendChild(b);
    });
    $("feedback").hidden = true;
    const repair = $("fbRepair");
    if (repair) { repair.hidden = true; repair.replaceChildren(); }
    $("fbSource").hidden = true;
    $("fbSource").removeAttribute("href");
    $("btnNext").disabled = true;
    $("btnNext").textContent = s.i + 1 >= total ? "Finish" : "Next";
    const hint = document.querySelector(".kbd-hint");
    if (hint) hint.innerHTML = s.mode === "exam"
      ? `Tip: press <kbd>1</kbd>–<kbd>4</kbd> to answer — it advances automatically`
      : `Tip: press <kbd>1</kbd>–<kbd>4</kbd> to answer, <kbd>Enter</kbd> for next`;
    updateFlagBtn();
    speak(q.q + ". " + q.choices.map((c, i) => (i + 1) + ". " + c).join(" "));
  }

  function answer(origIdx, btnEl) {
    const { icon, speak, sourceForQuestion, recordAnswer, finishSession } = ctx;
    const s = session();
    if (!s || s.answeredCurrent) return;
    s.answeredCurrent = true;
    const q = s.questions[s.i];
    const right = origIdx === q.a;
    s.answers.push({ qid: q.id, picked: origIdx, right, rtMs: s.shownAt ? Date.now() - s.shownAt : null });
    recordAnswer(q, right); // ledger first: the repair panel reads this answer's effect

    if (s.mode === "practice") {
      markChoiceButtons(q);
      const state = ctx.getState();
      const fb = $("feedback");
      fb.hidden = !state.settings.feedback;
      $("fbHead").innerHTML = right ? `<span class="ok">${icon("check", 15)} Correct</span>` : `<span class="bad">${icon("x", 15)} Not quite</span>`;
      $("fbWhy").textContent = q.why;
      renderRepair(q, right);
      const source = sourceForQuestion(q);
      const sourceLink = $("fbSource");
      sourceLink.hidden = !source;
      if (source) {
        sourceLink.href = source.url;
        sourceLink.textContent = `Official source: ${source.agency} · ${q.sourceSection} ↗`;
        sourceLink.setAttribute("aria-label", `Open ${source.title}, section ${q.sourceSection}, in a new tab`);
      } else {
        sourceLink.removeAttribute("href");
        sourceLink.removeAttribute("aria-label");
      }
      if (btnEl) btnEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      $("btnNext").disabled = false;
      $("btnNext").focus();
      speak((right ? "Correct. " : "Not quite. ") + q.why);
      // marathon: missed questions come back once
      if (s.marathon && !right && !s.requeued[q.id]) {
        s.requeued[q.id] = true;
        s.questions.push(q);
      }
    } else {
      // exam: brief visual acknowledge, then auto-advance
      $("btnNext").disabled = true;
      const btns = document.querySelectorAll("#choices .choice");
      /** @type {NodeListOf<HTMLButtonElement>} */(btns).forEach((b) => (b.disabled = true));
      s.advanceId = setTimeout(() => {
        s.answeredCurrent = false;
        s.i++;
        if (s.i >= s.questions.length) finishSession();
        else renderQuiz();
      }, 420);
    }
  }

  /**
   * Misconception-repair panel under the practice feedback. A wrong answer
   * becomes a learning sequence, not just a correct answer:
   *   1. the correct rule (already shown as q.why);
   *   2. the distinction the learner MAY have missed (hedged — we do not know
   *      their reasoning);
   *   3. a concept variant queued for later in this session (different
   *      question, same concept) when one exists;
   *   4. repeated errors escalate: explicit comparison of the confused rules,
   *      then the concept becomes a tracked misconception card in Review Missed.
   */
  function renderRepair(q, right) {
    const { Coach, Core, getState, getBank } = ctx;
    const host = $("fbRepair");
    if (!host) return;
    host.replaceChildren();
    const key = Core.conceptKeyOf(q);
    if (right) {
      host.hidden = true;
      return;
    }
    const state = getState();
    const bank = getBank();
    const entry = state.misconceptions[key];
    const stage = entry ? entry.stage : 1;
    const frag = document.createDocumentFragment();

    const head = document.createElement("p");
    head.className = "repair-head";
    head.textContent = stage >= 2
      ? `These two rules get confused often — compare them directly:`
      : `The rule to hold on to`;
    const line = Coach.confusionLine(entry ? { ...entry, key } : null, bank, state.qstats);
    if (stage >= 2) {
      if (line) {
        const p = document.createElement("p");
        p.className = "repair-contrast";
        p.textContent = line.text;
        frag.append(head, p);
      } else {
        frag.append(head);
      }
      const drillNote = document.createElement("p");
      drillNote.className = "repair-note";
      drillNote.textContent = `A short drill on ${Coach.conceptLabel(key)} is waiting in Review Missed.`;
      frag.appendChild(drillNote);
    } else {
      const p = document.createElement("p");
      p.className = "repair-contrast";
      p.textContent = line && line.kind === "contrast"
        ? line.text
        : `You may be mixing this up with a nearby rule. The distinction: ${q.why.slice(0, 160)}`;
      frag.append(head, p);
    }

    // Schedule a concept variant to appear later in this session (never the
    // same question): the spaced-learning system handles later sessions.
    const s = session();
    const variant = (Core.groupByConcept(bank).get(key) || []).find((v) => v.id !== q.id && !s.requeued[v.id]);
    if (variant && s.mode === "practice") {
      s.requeued[variant.id] = true;
      s.questions.push(variant);
      const note = document.createElement("p");
      note.className = "repair-note";
      note.textContent = `One more ${Coach.conceptLabel(key).toLowerCase()} question — different scenario, same rule — comes up later in this session.`;
      frag.appendChild(note);
    }
    host.appendChild(frag);
    host.hidden = false;
  }

  function markChoiceButtons(q) {
    const { icon } = ctx;
    const s = session();
    const btns = /** @type {NodeListOf<HTMLElement>} */(document.querySelectorAll("#choices .choice"));
    btns.forEach((b, disp) => {
      const orig = s.order[disp];
      const picked = b === document.activeElement || b.classList.contains("picked");
      /** @type {HTMLButtonElement} */(b).disabled = true;
      if (orig === q.a) {
        b.classList.add("correct");
        b.querySelector(".choice-mark").innerHTML = icon("check", 16);
      } else if (picked) {
        b.classList.add("wrong");
        b.querySelector(".choice-mark").innerHTML = icon("x", 16);
      }
    });
  }

  function updateFlagBtn() {
    const { icon, getState } = ctx;
    const s = session();
    if (!s) return;
    const q = s.questions[s.i];
    const f = !!getState().flagged[q.id];
    $("btnFlag").classList.toggle("flagged", f);
    $("btnFlag").innerHTML = `${icon("flag", 13)} ${f ? "Flagged" : "Flag"}`;
  }

  function toggleFlag() {
    const { getState, save } = ctx;
    const s = session();
    if (!s) return;
    const state = getState();
    const q = s.questions[s.i];
    if (state.flagged[q.id]) delete state.flagged[q.id];
    else state.flagged[q.id] = true;
    save();
    updateFlagBtn();
  }

  /** Answer the choice at display position (keyboard 1–4). */
  function answerDisplayPosition(disp) {
    const s = session();
    if (!s || s.answeredCurrent) return;
    const btns = /** @type {NodeListOf<HTMLElement>} */(document.querySelectorAll("#choices .choice"));
    const b = btns[disp];
    if (!b) return;
    b.classList.add("picked");
    b.click();
  }

  window.RoadReadyQuizUI = {
    /**
     * @param {{CATEGORIES, icon, escapeHTML, signArt, shuffle, speak, getState,
     *          getBank, Coach, Core, getSession, sourceForQuestion,
     *          recordAnswer, finishSession, save}} deps
     */
    init(deps) { ctx = deps; },
    renderQuiz, renderTimer, answer, renderRepair, markChoiceButtons,
    updateFlagBtn, toggleFlag, answerDisplayPosition,
  };
})();
