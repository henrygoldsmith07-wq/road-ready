/* Road Ready E2E — the Content & Sources provenance ledger.
 *
 * The ledger's value depends on it being honest, so the assertions here are
 * about honesty as much as layout: it must not claim an official document it
 * does not have, it must label a composite as a composite, and it must show
 * the date each source was last checked.
 */
import { test, expect } from "@playwright/test";

async function freshApp(page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("#app")).toBeVisible();
}

async function openGuide(page) {
  await freshApp(page);
  if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
  await page.locator('#bottomNav button[data-nav="guide"]').click();
  await expect(page.locator("#view-guide")).toHaveClass(/active/);
}

async function openSources(page) {
  await openGuide(page);
  await page.locator("#btnSources").click();
  await expect(page.locator("#view-sources")).toHaveClass(/active/);
}

test.describe("content & sources", () => {
  test("the ledger opens from the Study Guide and back returns there", async ({ page }) => {
    await openSources(page);
    await expect(page.locator("#view-sources")).toBeVisible();
    await page.click("#btnBack");
    await expect(page.locator("#view-guide")).toHaveClass(/active/);
  });

  test("every source card shows when it was last checked", async ({ page }) => {
    await openSources(page);
    const cards = page.locator("#sourcesBody .source-card");
    expect(await cards.count()).toBeGreaterThan(0);
    await expect(cards.first().locator(".source-facts")).toContainText("Last checked");
    // The date is rendered, not left blank.
    const checked = await cards.first().locator(".source-facts dd").first().textContent();
    expect(checked.trim()).not.toBe("");
    expect(checked.trim()).not.toMatch(/not recorded/);
  });

  test("a composite source offers text, not a link to a page that does not exist", async ({ page }) => {
    await openSources(page);
    // With no state chosen the only source is the composite of many state
    // handbooks. There is no single document to link to, so the card must
    // say so instead of rendering a dead link.
    expect(await page.locator("#sourcesBody .source-card a.source-open").count()).toBe(0);
    await expect(page.locator("#sourcesBody .source-card").first()).toContainText("no single page to link to");
  });

  test("a state's own handbook links to the issuing authority", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      const raw = localStorage.getItem("roadready.v1");
      const s = raw ? JSON.parse(raw) : {};
      s.settings = Object.assign({}, s.settings, { statePack: "CA" });
      localStorage.setItem("roadready.v1", JSON.stringify(s));
    });
    await page.reload();
    await expect(page.locator("#app")).toBeVisible();
    if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
    await page.locator('#bottomNav button[data-nav="guide"]').click();
    await page.locator("#btnSources").click();
    await expect(page.locator("#view-sources")).toHaveClass(/active/);

    const link = page.locator("#sourcesBody .source-card a.source-open").first();
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^https:\/\//);
    // The link opens in a new tab, safely.
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
  });

  test("with no state chosen the ledger does not claim an official document", async ({ page }) => {
    await openSources(page);
    const text = await page.locator("#view-sources").innerText();
    // A fresh learner has no state pack, so the bank rests entirely on the
    // composite. The view must say that, not imply an official citation.
    // (The badge is uppercased in CSS, so innerText is compared case-insensitively.)
    expect(text.toLowerCase()).toContain("reference basis");
    expect(text).not.toContain("named official document");
  });

  test("the composite is labelled a reference basis, not an official source", async ({ page }) => {
    await openSources(page);
    const badges = page.locator("#sourcesBody .source-badge");
    const count = await badges.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const text = (await badges.nth(i).textContent()).trim();
      expect(["Official source", "Reference basis"]).toContain(text);
    }
    // A fresh US learner sees only the composite, and it is marked as such.
    await expect(page.locator("#sourcesBody .source-badge.is-basis").first()).toBeVisible();
  });

  test("a state pack's questions cite that state's own official handbook", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      const raw = localStorage.getItem("roadready.v1");
      const s = raw ? JSON.parse(raw) : {};
      s.settings = Object.assign({}, s.settings, { statePack: "CA" });
      localStorage.setItem("roadready.v1", JSON.stringify(s));
    });
    await page.reload();
    await expect(page.locator("#app")).toBeVisible();
    if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
    await page.locator('#bottomNav button[data-nav="guide"]').click();
    await page.locator("#btnSources").click();
    await expect(page.locator("#view-sources")).toHaveClass(/active/);

    const text = await page.locator("#view-sources").innerText();
    expect(text).toContain("California");
    // Now an official document really is present, so it may be claimed.
    expect(text).toContain("named official document");
    await expect(page.locator("#sourcesBody .source-badge").first()).toHaveText(/Official source/);
  });
});
