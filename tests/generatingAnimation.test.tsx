import "./helpers/jsdomEnv";
import test, { afterEach, before } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { render, cleanup } from "@testing-library/react";
import i18n from "../i18n";
import GeneratingAnimation from "../components/ui/GeneratingAnimation";
import { TANGLED_YARN_PATH, SPIRAL_CIRCLE_PATH, GEN_VIEWBOX } from "../utils/generatingAnimation";
import { AA_NON_TEXT, contrastRatio } from "../utils/contrast";
import { THEMES, themeColor, type ThemeName } from "./helpers/themeColors";

before(async () => {
  if (!i18n.isInitialized) await new Promise<void>((resolve) => i18n.on("initialized", () => resolve()));
});
afterEach(async () => {
  cleanup();
  await i18n.changeLanguage("pl");
});

test("tekst z i18n (pl i en); role=status, aria-live=polite, SVG aria-hidden", async () => {
  const { getByTestId, container } = render(<GeneratingAnimation />);
  const root = getByTestId("generating-animation");
  assert.equal(root.getAttribute("role"), "status");
  assert.equal(root.getAttribute("aria-live"), "polite");
  assert.equal(root.querySelector("h3")!.textContent!.trim(), "Upraszczanie i porządkowanie...");
  assert.equal(root.querySelector("p")!.textContent!.trim(), "Inteligentny system eliminuje chaos i tworzy przejrzystą strukturę.");
  assert.equal(container.querySelector("svg")!.getAttribute("aria-hidden"), "true");

  cleanup();
  await i18n.changeLanguage("en");
  const en = render(<GeneratingAnimation />);
  const enRoot = en.getByTestId("generating-animation");
  assert.equal(enRoot.querySelector("h3")!.textContent!.trim(), "Simplifying and organizing...");
  assert.equal(enRoot.querySelector("p")!.textContent!.trim(), "The system eliminates chaos and builds a clear structure.");
});

test("bez paska postępu, bez liczb i bez sugerowania czasu", () => {
  const { container } = render(<GeneratingAnimation />);
  assert.equal(container.querySelector('[role="progressbar"]'), null);
  assert.ok(!/\d|%|sekund|minut/i.test(container.textContent!));
});

test("oryginalna grafika kłębka: tangledPath, spiralPath oraz filtry glow i shadow", () => {
  const { getByTestId, container } = render(<GeneratingAnimation />);
  const tangle = getByTestId("yarn-tangle");
  const spiral = getByTestId("yarn-spiral");
  assert.equal(tangle.getAttribute("d"), TANGLED_YARN_PATH);
  assert.equal(spiral.getAttribute("d"), SPIRAL_CIRCLE_PATH);

  const defs = container.querySelector("svg defs")!;
  assert.ok(defs.querySelector("#yarnShadow"), "Musi zawierać filtr yarnShadow");
  assert.ok(defs.querySelector("#yarnGlow"), "Musi zawierać filtr yarnGlow");
});

test("prefers-reduced-motion: obraz statyczny — kłębek widoczny, bez pętli animacji", () => {
  const { getByTestId } = render(<GeneratingAnimation reducedMotion={true} />);
  const tangle = getByTestId("yarn-tangle");
  const spiral = getByTestId("yarn-spiral");
  assert.equal(tangle.style.opacity, "1");
  assert.equal(spiral.style.opacity, "0");
});

test("kontrast graficzny linii (akcent) względem tła strony ≥ 3:1 w obu motywach", () => {
  const rows = ["motyw | linia | tło strony | kontrast"];
  for (const theme of ["dark", "light"] as ThemeName[]) {
    const ratio = contrastRatio(themeColor(theme, "--color-primary"), themeColor(theme, "--color-bg"));
    rows.push(`${theme} | ${THEMES[theme]["--color-primary"]} | ${THEMES[theme]["--color-bg"]} | ${ratio.toFixed(2)}`);
    assert.ok(ratio >= AA_NON_TEXT, `${theme}: ${ratio.toFixed(2)}`);
  }
  console.log(rows.join("\n"));
});
