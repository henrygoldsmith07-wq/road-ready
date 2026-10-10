/* PWA install prompt: pure visibility decision — the browser owns the real flow. */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";

describe("installPromptState", () => {
  it("stays hidden when already installed, whatever else is true", () => {
    expect(Core.installPromptState({ standalone: true, hasDeferredPrompt: true, platform: "other" }))
      .toEqual({ visible: false, variant: null });
    expect(Core.installPromptState({ standalone: true, platform: "ios" }))
      .toEqual({ visible: false, variant: null });
  });

  it("stays hidden after a session dismissal", () => {
    expect(Core.installPromptState({ dismissed: true, hasDeferredPrompt: true, platform: "other" }))
      .toEqual({ visible: false, variant: null });
  });

  it("offers the real install button only with a deferred browser prompt", () => {
    expect(Core.installPromptState({ hasDeferredPrompt: true, platform: "other" }))
      .toEqual({ visible: true, variant: "install" });
  });

  it("offers honest manual steps on iOS, where no prompt event exists", () => {
    expect(Core.installPromptState({ platform: "ios" }))
      .toEqual({ visible: true, variant: "ios" });
  });

  it("stays hidden on other platforms with no prompt event — never a dead button", () => {
    expect(Core.installPromptState({ platform: "other" }))
      .toEqual({ visible: false, variant: null });
    expect(Core.installPromptState({})).toEqual({ visible: false, variant: null });
    expect(Core.installPromptState()).toEqual({ visible: false, variant: null });
  });
});
