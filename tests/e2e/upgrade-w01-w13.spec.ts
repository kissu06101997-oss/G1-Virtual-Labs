import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const SCREENSHOT_DIR = path.resolve(
  process.cwd(),
  "test-results/legacy-premium-screenshots"
);
const CANONICAL_LOGO_SHA256 =
  "94b8b12e4a13317df3e00b1a6e8604aec9fdb4074cf355b55658dc9739c77a65";

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function signInAs(page: Page, email: string, password = "G1LocalTest!2026") {
  await page.goto("/sign-in");
  await page.fill("#signin-email", email);
  await page.fill("#signin-password", password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/sign-in")),
    page.getByTestId("signin-submit").click(),
  ]);
}

async function signOut(page: Page) {
  const btn = page.getByRole("button", { name: /sign out|సైన్ అవుట్/i }).first();
  if (await btn.isVisible()) {
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/"),
      btn.click(),
    ]);
  }
}

test.describe("G1 Virtual Labs Premium Upgrade Verification (W01–W13)", () => {
  test("U01 — Canonical logo SHA-256, Permissions-Policy cleanup (W13), 7 education stages & balanced subject hubs (W08)", async ({
    page,
    request,
  }) => {
    // 1. Canonical logo byte integrity & Permissions-Policy header check
    const logoRes = await request.get("/brand/g1-canonical-logo.png");
    expect(logoRes.status()).toBe(200);
    const logoBytes = await logoRes.body();
    const sha256 = crypto.createHash("sha256").update(logoBytes).digest("hex");
    expect(sha256).toBe(CANONICAL_LOGO_SHA256);

    const homeRes = await request.get("/");
    const permPolicy = homeRes.headers()["permissions-policy"] || "";
    expect(permPolicy).not.toContain("interest-cohort");

    // 2. Desktop 1600x900 Homepage with 7-stage rail
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto("/");
    await expect(page.getByTestId("education-stage-rail")).toBeVisible();
    for (const stageId of [
      "class-6",
      "class-7",
      "class-8",
      "class-9",
      "class-10",
      "intermediate-1",
      "intermediate-2",
    ]) {
      await expect(page.getByTestId(`stage-pill-${stageId}`)).toBeVisible();
    }
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "home_1600x900_en.png"),
      fullPage: true,
    });

    // 3. Catalogue 7-stage filtering + honest empty state for unpublished stages
    await page.goto("/laboratories");
    await expect(page.getByRole("heading", { name: "Choose your science laboratory." })).toBeVisible();
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "catalogue_1600x900_en.png"),
      fullPage: true,
    });

    await page.getByTestId("home-subject-chemistry").click();
    const classFilter = page.getByRole("combobox", { name: "Class", exact: true });
    await classFilter.click();
    await page.getByRole("option", { name: "Intermediate 1st Year", exact: true }).click();
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(/grade=11/);
    await expect(page.getByRole("heading", { name: "No published practicals match" })).toBeVisible();
    await expect(page.getByText(/BIEAP|AP SCERT/)).toHaveCount(0);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "catalogue_inter1_empty_1600x900_en.png"),
      fullPage: true,
    });

    await classFilter.click();
    await page.getByRole("option", { name: "Class 6", exact: true }).click();
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(/grade=6/);
    await expect(page.getByRole("heading", { name: "No published practicals match" })).toBeVisible();

    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(classFilter).toHaveText("All classes");

    // 4. Subject hub balanced 2-column layout (Chemistry has 2 items)
    await page.goto("/laboratories/chemistry");
    await expect(page.getByRole("heading", { name: "Zinc and dilute sulfuric acid" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Acid–base indicators" })).toHaveCount(0);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "chemistry_1600x900_en.png"),
      fullPage: true,
    });
  });

  test("U02 — Responsive reflow at 768px (Sign in unclipped), 390px, 360px, mobile Escape key & Telugu locale (W07, W10, W13)", async ({
    page,
  }) => {
    // 1. 768x1024 Tablet — Sign in MUST NOT clip and scrollWidth <= 768
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");
    const signInLink = page.getByTestId("tablet-signin-link");
    await expect(signInLink).toBeVisible();
    const box = await signInLink.boundingBox();
    expect(box).not.toBeNull();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(768);
    const overflow768 = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    );
    expect(overflow768).toBe(true);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "home_768x1024_en.png"),
      fullPage: true,
    });

    // 2. 390x844 Mobile — Drawer Escape close + aria-current + zero overflow
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/laboratories");
    const overflow390 = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    );
    expect(overflow390).toBe(true);

    const menuBtn = page.getByTestId("mobile-menu-toggle");
    await menuBtn.click();
    await expect(page.getByTestId("mobile-nav-drawer")).toBeVisible();
    await expect(
      page.getByTestId("mobile-nav-drawer").locator('a[aria-current="page"]')
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("mobile-nav-drawer")).toHaveCount(0);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "catalogue_390x844_en.png"),
      fullPage: true,
    });

    // 3. 360x800 Small Mobile — zero overflow
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/");
    const overflow360 = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    );
    expect(overflow360).toBe(true);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "home_360x800_en.png"),
      fullPage: true,
    });

    // 4. Telugu locale (te-IN) + Help Re-run check timestamp (W10 + W13)
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto("/");
    await page.locator('[data-testid="locale-toggle"]:visible').first().click();
    await expect(page.locator("html")).toHaveAttribute("lang", /^te/);
    await expect(page.getByText("6వ తరగతి")).toBeVisible();
    await expect(page.getByText("ఇంటర్మీడియట్ 1వ సంవత్సరం", { exact: true })).toBeVisible();
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "home_1600x900_te.png"),
      fullPage: true,
    });

    await page.goto("/help");
    await expect(page.getByRole("heading", { name: "మీకు ఎలా సహాయం చేయగలం?" })).toBeVisible();
    await expect(page.getByTestId("help-check-status")).toHaveCount(0);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "help_1600x900_te.png"),
      fullPage: true,
    });

    // Switch back to en-IN
    await page.locator('[data-testid="locale-toggle"]:visible').first().click();
    await expect(page.locator("html")).toHaveAttribute("lang", /^en/);
  });

  test("Contact Us stays clear of the language control at desktop breakpoints", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const language = page.locator('[data-testid="locale-toggle"]:visible').first();
    const contact = page.locator('.g1-primary-nav a[href="/contact"]');
    for (const [documentLanguage, buttonText] of [["en", "తెలుగు"], ["te", "English"]]) {
      await expect(page.locator("html")).toHaveAttribute("lang", documentLanguage);
      await expect(language).toHaveText(buttonText);
      for (const width of [1280, 1440, 1509, 1510, 1536, 1670]) {
        await page.setViewportSize({ width, height: 900 });
        await expect.poll(async () => {
          const [link, button] = await Promise.all([contact.boundingBox(), language.boundingBox()]);
          return link && button ? button.x - (link.x + link.width) : -1;
        }, { message: `Header gap at ${width}px in ${documentLanguage}` }).toBeGreaterThanOrEqual(4);
      }
      await language.click();
    }
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await contact.click();
    await expect(page).toHaveURL(/\/contact$/);
    await expect(contact).toHaveAttribute("aria-current", "page");
  });

  test("U03 — W01/W02/W03/W06: Simulation-only assignment mode enforcement, pinned old version after newer publish, teacher preview, amendment & evidence drill-down", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });

    // 1. Teacher A previews Physics practical (labeled Preview, ungraded) & publishes Simulation-only assignment
    await signInAs(page, "teacher.a@school-guntur-01.test");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "teacher_1600x900_en.png"),
      fullPage: true,
    });

    await page.goto("/experiments/AP-PHYS-10-9.10");
    await expect(page.getByTestId("teacher-preview-badge")).toBeVisible();
    await expect(page.getByTestId("launch-simulation-btn")).toContainText(
      "Preview Simulation Mode"
    );

    await page.goto("/teacher/assignments");
    await page.selectOption("#assign-experiment", "AP-PHYS-10-9.10");
    // Uncheck Experiment Mode so this assignment is Simulation Mode ONLY
    await page.getByTestId("assign-mode-experiment").uncheck();
    await expect(page.getByTestId("assignment-publish-preview")).toContainText(
      "AP-PHYS-10-9.10@v0.1.0-research"
    );
    await page.getByTestId("publish-assignment-submit").click();
    const banner = page.getByTestId("assignment-published-banner");
    await expect(banner).toBeVisible();
    const bannerText = (await banner.textContent()) || "";
    const match = bannerText.match(/Assignment ID ([0-9a-f-]{36})/i);
    expect(match).not.toBeNull();
    const simOnlyAssignmentId = match![1];

    // Test W02 Amendment on the first amendable assignment
    const firstAmendBtn = page.locator('[data-testid^="amend-assignment-"]').first();
    await firstAmendBtn.click();
    await page.getByTestId("assign-revision-notes").fill("Updated schedule for W02 test");
    await page.getByTestId("publish-assignment-submit").click();
    await expect(page.getByTestId("assignment-published-banner")).toContainText("rev #2");

    await signOut(page);

    // 2. Editor proposes a NEWER Physics version 0.2.0-w01pin, Reviewer approves it
    await signInAs(page, "editor@g1virtualabs.test");
    await page.goto("/content");
    await page.selectOption("#draft-exp", "AP-PHYS-10-9.10");
    await page.fill("#draft-ver", "0.2.0-w01pin");
    await page.getByTestId("submit-draft-btn").click();
    await expect(page.getByText(/submitted for independent reviewer sign-off/i)).toBeVisible();
    await signOut(page);

    await signInAs(page, "reviewer@g1virtualabs.test");
    await page.goto("/content");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "content_reviewer_1600x900_en.png"),
      fullPage: true,
    });
    const approveBtn = page.locator('[data-testid^="approve-review-"]').first();
    await approveBtn.click();
    await expect(page.getByText(/approved/i).first()).toBeVisible();
    await signOut(page);

    // 3. Student A opens the OLD Simulation-only assignment even though v0.2.0-w01pin is now published!
    await signInAs(page, "student.a@school-guntur-01.test");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "student_1600x900_en.png"),
      fullPage: true,
    });

    await page.goto(`/experiments/AP-PHYS-10-9.10?assignmentId=${simOnlyAssignmentId}`);
    // W01: Detail page MUST resolve pinned version 0.1.0-research (NOT 0.2.0-w01pin)
    await expect(page.getByTestId("detail-version-tag")).toHaveText("v0.1.0-research");
    await expect(page.getByTestId("resolved-assignment-banner")).toContainText(
      "Pinned v0.1.0-research"
    );
    // W01: Experiment Mode button MUST be disabled with clear reason; Simulation Mode MUST be enabled
    await expect(page.getByTestId("launch-experiment-btn")).toBeDisabled();
    await expect(page.getByTestId("mode-disabled-reason-experiment")).toContainText(
      "Simulation Mode only"
    );
    await expect(page.getByTestId("launch-simulation-btn")).toBeEnabled();
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "detail_assigned_sim_only_1600x900_en.png"),
      fullPage: true,
    });

    // Launch pinned Simulation Mode assignment cleanly
    await Promise.all([
      page.waitForURL(/\/player\/[0-9a-f-]+/),
      page.getByTestId("launch-simulation-btn").click(),
    ]);

    // Execute guided steps and submit
    await page.getByTestId("stage-hotspot-mount-slab").click();
    await expect(page.getByTestId("player-revision-badge")).toContainText("1");
    await page.getByTestId("stage-hotspot-trace-45").click();
    await expect(page.getByTestId("player-revision-badge")).toContainText("2");
    await page.getByTestId("player-submit-attempt-btn").click();
    await expect(page.getByTestId("player-submitted-banner")).toBeVisible();

    // Verify own result drill-down on /student#results (W03 / G1-21)
    await page.goto("/student#results");
    const studentDetail = page.locator('[data-testid^="student-result-detail-"]').first();
    await expect(studentDetail).toBeVisible();
    await studentDetail.locator("summary").click();
    await expect(studentDetail).toContainText("Rubric criteria breakdown:");

    await signOut(page);

    // 4. Teacher A inspects submitted evidence & rubric criterion breakdown on /teacher/reports (W03)
    await signInAs(page, "teacher.a@school-guntur-01.test");
    await page.goto("/teacher/reports");
    await expect(page.getByTestId("teacher-featured-evidence-inspector")).toBeVisible();
    const drilldown = page.locator('[data-testid^="evidence-drilldown-"]').first();
    await drilldown.locator("summary").click();
    await expect(drilldown).toContainText("Rubric Criterion Breakdown:");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "teacher_reports_1600x900_en.png"),
      fullPage: true,
    });
  });

  test("U04 — W05/W09/W11: Player offline recovery with zero unhandled rejections, Experiment Mode capture, Admin scopes & Axe WCAG 2.2 AA", async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    const uncaughtErrors: string[] = [];
    page.on("pageerror", (err) => uncaughtErrors.push(err.message));

    await signInAs(page, "student.a@school-guntur-01.test");

    // Use a new session so this test is independent of the earlier submission test.
    await page.goto("/experiments/AP-CHEM-10-2.3");
    await page.getByTestId("launch-simulation-btn").click();
    await expect(page).toHaveURL(/\/player\//);
    await expect(page.getByTestId("player-revision-badge")).toBeVisible();
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "player_simulation_1600x900_en.png"),
      fullPage: true,
    });

    // 2. W05: Simulate disconnect, trigger action, verify truthful offline banner & zero unhandled rejection
    const revBeforeNum = ((await page.getByTestId("player-revision-badge").textContent()) || "").match(/\d+/)?.[0];
    await context.setOffline(true);
    await page.getByTestId("stage-hotspot-connect-soap").click();
    await expect(page.getByTestId("player-offline-banner")).toBeVisible();
    await expect(page.getByTestId("stage-save-pill")).toContainText("Offline");
    await expect(page.getByTestId("player-revision-badge")).toContainText(`⚠`);
    await expect(page.getByTestId("player-revision-badge")).toContainText(revBeforeNum || "1");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "player_offline_1600x900_en.png"),
      fullPage: true,
    });

    // Reconnect and click Retry pending action
    await context.setOffline(false);
    await page.getByTestId("player-retry-action-btn").click();
    await expect(page.getByTestId("player-offline-banner")).toHaveCount(0);
    await expect(page.getByTestId("player-feedback-banner")).toContainText("Committed at revision");
    expect(uncaughtErrors).toHaveLength(0);

    // 3. Launch Chemistry Experiment Mode, run control + comparison, capture screenshot
    await page.goto("/experiments/AP-CHEM-10-2.3");
    await Promise.all([
      page.waitForURL(/\/player\/[0-9a-f-]+/),
      page.getByTestId("launch-experiment-btn").click(),
    ]);
    await page.getByTestId("exp-run-calculation-btn").click();
    await expect(page.getByTestId("exp-primary-result")).toContainText("1.5 µmol");
    await page.selectOption("#var-zinc", "1");
    await page.getByTestId("exp-record-comparison-btn").click();
    await expect(page.getByTestId("exp-primary-result")).toContainText("1 µmol");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "player_experiment_1600x900_en.png"),
      fullPage: true,
    });

    await signOut(page);

    // 4. Admin School & State screenshots (W11)
    await signInAs(page, "schooladmin.a@school-guntur-01.test");
    await page.goto("/admin");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "admin_school_1600x900_en.png"),
      fullPage: true,
    });
    await signOut(page);

    await signInAs(page, "state.ap@ap-edu.test");
    await page.goto("/admin");
    await expect(page.getByTestId("admin-aggregate-freshness")).toContainText("IST");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "admin_state_1600x900_en.png"),
      fullPage: true,
    });
    await signOut(page);

    // 5. Axe WCAG 2.2 AA scan on upgraded homepage, catalogue, detail and help
    for (const route of ["/", "/laboratories", "/laboratories/chemistry", "/experiments/AP-CHEM-10-2.3", "/help"]) {
      await page.goto(route);
      const scan = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const severe = scan.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
      );
      expect(severe, `Axe violations on ${route}`).toEqual([]);
    }
  });
});
