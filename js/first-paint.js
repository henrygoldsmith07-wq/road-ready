/* Road Ready — first paint.
 *
 * A new learner was shown a blank screen until the whole app had loaded.
 * The first-run card was revealed from JavaScript at the end of boot, which
 * meant the largest contentful paint waited for every script in the app to
 * download, parse and run - measured at over a second and a half on a fast
 * connection, and far worse on the phone-and-commute case the app is built
 * for.
 *
 * The card itself is static markup. The only thing needed to decide whether
 * to show it is whether this browser has already onboarded, and that is a
 * single localStorage read. So the decision is made here, during parsing,
 * before the deferred application scripts are fetched at all.
 *
 * This file is deliberately tiny, is loaded WITHOUT defer so it runs during
 * parsing, and is kept out of the application's own modules: it must not
 * depend on anything that has not loaded yet.
 *
 * The app still makes the final call at boot. If the state says the learner
 * has onboarded, the card is hidden again.
 */
"use strict";

(function () {
  var el = document.getElementById("onboarding");
  if (!el || !el.hidden) return;

  var onboarded = false;
  try {
    var raw = window.localStorage.getItem("roadready.v1");
    if (raw) {
      var state = JSON.parse(raw);
      onboarded = !!(state && state.onboarded);
    }
  } catch (e) {
    // Storage unavailable or unreadable: the app will decide at boot, and
    // showing the card is the safe default.
    onboarded = false;
  }
  if (onboarded) return;

  el.hidden = false;

  /* The card is now on screen, but the application has not booted yet, so its
   * buttons have no handlers. A click landing in that window would be lost,
   * and a learner who taps "Skip" and sees nothing would rightly think the
   * app had frozen. The click is queued and replayed once the app announces
   * that it is ready. */
  var queued = null;
  document.addEventListener("click", function (event) {
    if (document.documentElement.dataset.appReady === "1") return;
    var target = event.target && event.target.closest
      ? event.target.closest("#obSkip, #obNext")
      : null;
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    queued = target;
  }, true);

  document.addEventListener("roadready:ready", function () {
    var target = queued;
    queued = null;
    if (target) target.click();
  });
})();
