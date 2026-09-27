/* Road Ready — jurisdiction-native guide controller. */
"use strict";

(function () {
  function apply({ country }) {
    if (!country) return;
    const scope = country.guide && country.guide.scope;
    const us = document.getElementById("guideUs");
    const gb = document.getElementById("guideGb");
    if (us) us.hidden = scope !== "us";
    if (gb) gb.hidden = scope !== "gb";

    const sub = document.getElementById("guideSubtitle");
    if (sub && country.guide && country.guide.subtitle) sub.textContent = country.guide.subtitle;

  }

  window.RoadReadyGuide = { apply };
})();
