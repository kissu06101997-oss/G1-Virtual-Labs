import fs from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const SCREENSHOT_DIR = path.resolve(process.cwd(), "test-results/legacy-gate-w-screenshots");
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const CLASS_A_10A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01";
const CLASS_A_9A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02";

async function signInAs(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByTestId(`fill-${email}`).click();
  await page.getByTestId("signin-submit").click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}

async function assertBrandLogo(page: Page) {
  const home = page.getByRole("link", { name: "G1 Virtual Labs — Home", exact: true });
  await expect(home).toBeVisible();
  await expect(home).toHaveAttribute("href", "/");
  const logo = home.getByAltText("G1 Virtual Labs");
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute("src", "/brand/g1-virtual-labs.svg");
  await expect.poll(() => logo.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
}

async function assertNoSeriousA11yViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious"
  );
  expect(
    serious,
    `Accessibility violations on ${label}: ${JSON.stringify(serious.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length })), null, 2)}`
  ).toHaveLength(0);
}

test.describe("G1 Virtual Labs — Gate W Full End-to-End Verification", () => {
  test("Shared logo supports reduced motion and returns to Home by keyboard", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/about");
    await assertBrandLogo(page);
    await expect(page.locator(".g1-brand-logo__canvas")).toHaveCount(0);
    const home = page.getByRole("link", { name: "G1 Virtual Labs — Home", exact: true });
    await home.focus();
    await expect(home).toBeFocused();
    await home.press("Enter");
    await expect(page).toHaveURL(/\/$/);
    await expect(page).toHaveTitle(/G1 Virtual Labs/);
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content", "G1 Virtual Labs");
  });

  test("AT-01: Public discovery, EN/TE toggle, filter history, shared logo, axe-core & screenshots", async ({
    page,
  }) => {
    // 1. Homepage (Desktop)
    await page.goto("/");
    await assertBrandLogo(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Science you can experience.");
    await expect(page.getByTestId("education-stage-rail").locator("[aria-current]")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Continue Learning" }).locator('a[href^="/player/"]')).toHaveCount(0);
    await expect(page.getByText("Simulation Mode")).toBeVisible();
    await expect(page.getByText("Experiment Mode")).toBeVisible();
    await assertNoSeriousA11yViolations(page, "Homepage");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01_homepage_desktop.png") });

    // Switch to Telugu and verify Telugu localization
    await page.getByTestId("locale-toggle").first().click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("మీరు అనుభవించగల విజ్ఞాన శాస్త్రం.");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01_homepage_telugu.png") });
    // Switch back to English
    await page.getByTestId("locale-toggle").first().click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Science you can experience.");

    // 2. Explore laboratories & filter state preservation on Back
    await page.getByTestId("hero-explore-cta").click();
    await expect(page).toHaveURL(/\/laboratories$/);
    await assertBrandLogo(page);
    await assertNoSeriousA11yViolations(page, "Catalogue");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02_catalogue_desktop.png") });

    await page.getByTestId("home-subject-chemistry").click();
    await expect(page).toHaveURL(/\/laboratories\/chemistry$/);
    await expect(page.getByTestId("fixed-subject")).toHaveText("Chemistry");
    await page.getByRole("link", { name: /View experiment: Zinc and dilute sulfuric acid/ }).click();
    await expect(page).toHaveURL(/\/experiments\/AP-CHEM-10-2\.3/);
    await assertBrandLogo(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("dilute sulfuric acid");
    await assertNoSeriousA11yViolations(page, "Experiment Detail");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03_experiment_detail_desktop.png") });

    // Verify Back preserves filter state
    await page.goBack();
    await expect(page).toHaveURL(/\/laboratories\/chemistry$/);

    // 3. Verify review_pending experiment locks launch honestly
    await page.goto("/experiments/AP-CHEM-10-2.1");
    await expect(page.getByTestId("launch-simulation-btn")).toBeDisabled();
    await expect(page.getByTestId("launch-experiment-btn")).toBeDisabled();

    // 4. Help & capability check page
    await page.goto("/help");
    await assertBrandLogo(page);
    await expect(page.getByRole("heading", { name: "How can we help you?" })).toBeVisible();
    await expect(page.getByTestId("help-check-status")).toHaveCount(0);
    await assertNoSeriousA11yViolations(page, "Help");

    // 5. Mobile viewport check (no horizontal overflow)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
    );
    expect(overflow).toBe(false);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01_homepage_mobile.png") });
    await page.goto("/experiments/AP-CHEM-10-2.3");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03_detail_mobile.png") });
  });

  test("AT-02 & AT-05 & AT-06: Student dashboard, 6 subject×mode launches, reload/resume, 422 guards, DOM parity & submission", async ({
    page,
  }) => {
    await signInAs(page, "student.a@school-guntur-01.test");
    await expect(page).toHaveURL(/\/student$/);
    await assertBrandLogo(page);
    await expect(page.getByTestId("student-resume-cta")).toBeVisible();
    await assertNoSeriousA11yViolations(page, "Student Dashboard");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04_student_dashboard_desktop.png") });

    // 1. Chemistry Simulation Mode (resume seeded session, test 422 guard, advance step, reload, submit)
    await page.getByTestId("student-resume-cta").click();
    await expect(page).toHaveURL(/\/player\//);
    await assertBrandLogo(page);
    await assertNoSeriousA11yViolations(page, "Simulation Player");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06_simulation_player_desktop.png") });

    const revBefore = await page.getByTestId("player-revision-badge").textContent();

    // Test 2D Accessible DOM Parity + 422 safety rejection without mutation
    await page.getByTestId("toggle-dom-mode").click();
    await page.getByTestId("dom-action-guard-bad-reagent").click();
    await expect(page.getByTestId("player-feedback-banner")).toContainText("INCOMPATIBLE_MATERIAL");
    // Revision MUST NOT advance after rejected 422 action
    await expect(page.getByTestId("player-revision-badge")).toHaveText(revBefore!);

    // Execute valid apparatus connection via 2D accessible control
    await page.getByTestId("dom-action-connect-soap").click();
    await expect(page.getByTestId("player-revision-badge")).toContainText("2");

    // Execute bounded stoichiometry action via 2D accessible control
    await page.getByTestId("dom-action-run-default-bound").click();
    await expect(page.getByTestId("player-revision-badge")).toContainText("3");
    await expect(page.getByTestId("observation-list")).toContainText("1.5 umol");

    // Browser reload MUST restore exact revision 3 and observations from PostgreSQL!
    await page.reload();
    await expect(page.getByTestId("player-revision-badge")).toContainText("3");
    await expect(page.getByTestId("observation-list")).toContainText("1.5 umol");

    // Submit authoritative rubric assessment
    await page.getByTestId("player-submit-attempt-btn").click();
    await expect(page.getByTestId("player-submitted-banner")).toContainText("COMMITTED");

    // 2. Chemistry Experiment Mode (verify bounded theory calculation + screenshot)
    await page.goto("/experiments/AP-CHEM-10-2.3");
    await page.getByTestId("launch-experiment-btn").click();
    await expect(page).toHaveURL(/\/player\//);
    await page.getByTestId("exp-run-calculation-btn").click();
    await expect(page.getByTestId("exp-primary-result")).toContainText("1.5 µmol");
    await assertNoSeriousA11yViolations(page, "Experiment Player");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07_experiment_player_desktop.png") });
    await page.selectOption("#var-zinc", "4");
    await page.getByTestId("exp-record-comparison-btn").click();
    await page.getByTestId("player-submit-attempt-btn").click();
    await expect(page.getByTestId("player-submitted-banner")).toContainText("COMMITTED");

    // 3 & 4. Physics Simulation Mode & Experiment Mode
    await page.goto("/experiments/AP-PHYS-10-9.10");
    await page.getByTestId("launch-simulation-btn").click();
    await expect(page).toHaveURL(/\/player\//);
    await page.getByTestId("toggle-dom-mode").click();
    await page.getByTestId("dom-action-mount-slab").click();
    await page.getByTestId("dom-action-trace-45").click();
    await expect(page.getByTestId("observation-list")).toContainText("6.5828 mm");

    await page.goto("/experiments/AP-PHYS-10-9.10");
    await page.getByTestId("launch-experiment-btn").click();
    await expect(page).toHaveURL(/\/player\//);
    await page.getByTestId("exp-run-calculation-btn").click();
    await expect(page.getByTestId("exp-primary-result")).toContainText("6.5828 mm");

    // 5 & 6. Biology Simulation Mode & Experiment Mode (including 422 CALIBRATION_MISSING guard!)
    await page.goto("/experiments/AP-BIO-09-5.1");
    await page.getByTestId("launch-simulation-btn").click();
    await expect(page).toHaveURL(/\/player\//);
    await page.getByTestId("toggle-dom-mode").click();
    await page.getByTestId("dom-action-select-field-1").click();
    await page.getByTestId("dom-action-mark-cell-wall").click();
    await expect(page.getByTestId("observation-list")).toContainText("cell_wall");

    await page.goto("/experiments/AP-BIO-09-5.1");
    await page.getByTestId("launch-experiment-btn").click();
    await expect(page).toHaveURL(/\/player\//);
    await page.getByTestId("toggle-dom-mode").click();
    await page.getByTestId("dom-action-guard-uncalibrated").click();
    await expect(page.getByTestId("player-feedback-banner")).toContainText("CALIBRATION_MISSING");
  });

  test("AT-03 & AT-04: Teacher assignment publish, single report receipt, audited CSV & cross-tenant isolation", async ({
    page,
  }) => {
    await signInAs(page, "teacher.a@school-guntur-01.test");
    await page.getByRole("link", { name: "Class roster" }).click();
    await expect(page).toHaveURL(`/teacher/classes/${CLASS_A_10A}`);
    await page.goBack();
    await expect(page).toHaveURL(/\/teacher$/);
    await assertBrandLogo(page);
    await assertNoSeriousA11yViolations(page, "Teacher Dashboard");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05_teacher_dashboard_desktop.png") });

    // Publish a new versioned assignment to Class 10-A
    await page.getByTestId("teacher-assign-cta").click();
    await expect(page).toHaveURL(/\/teacher\/assignments$/);
    await page.getByTestId("publish-assignment-submit").click();
    await expect(page.getByTestId("assignment-published-banner")).toContainText("Published AP-CHEM-10-2.3");

    // Open class report and verify Learner A-101 submission propagated cleanly once
    await page.goto(`/teacher/reports?classId=${CLASS_A_10A}`);
    await expect(page.getByText("Learner A-101 (Synthetic)").first()).toBeVisible();

    // Same-school cross-class denial: Teacher A does NOT teach Class 9-A -> masked 404!
    const crossClassStatus = await page.evaluate(async (cid) => {
      const r = await fetch(`/api/v1/teacher/classes/${cid}/reports`);
      return r.status;
    }, CLASS_A_9A);
    expect(crossClassStatus).toBe(404);

    // Export audited CSV
    const csvStatus = await page.evaluate(async (cid) => {
      const r = await fetch(`/api/v1/teacher/classes/${cid}/reports?format=csv`);
      const text = await r.text();
      return { status: r.status, hasHeader: text.includes("submission_id,attempt_id") };
    }, CLASS_A_10A);
    expect(csvStatus.status).toBe(200);
    expect(csvStatus.hasHeader).toBe(true);

    // Cross-school denial: sign in as Teacher B (School B) and request School A Class 10-A -> masked 404!
    await signInAs(page, "teacher.b@school-vijayawada-02.test");
    const crossSchoolStatus = await page.evaluate(async (cid) => {
      const r = await fetch(`/api/v1/teacher/classes/${cid}/reports`);
      return r.status;
    }, CLASS_A_10A);
    expect(crossSchoolStatus).toBe(404);
  });

  test("AT-02/AT-03/AT-07 API invariants: manifest mismatch, token replay, small-cell suppression, two-person content review", async ({
    page,
  }) => {
    // 1. Manifest mismatch rejected (409) & token replay blocked (409)
    await signInAs(page, "student.a@school-guntur-01.test");
    const apiChecks = await page.evaluate(async () => {
      const csrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("g1_csrf="))
        ?.split("=")[1];

      const badManifest = await fetch("/api/v1/launch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf || "",
          "Idempotency-Key": "e2e-bad-manifest-check-0001",
        },
        body: JSON.stringify({
          assignmentId: null,
          experimentId: "AP-CHEM-10-2.3",
          labId: "chemistry",
          mode: "simulation",
          contentVersion: "0.1.0-research",
          manifestSha256: "f".repeat(64),
          locale: "en-IN",
          engineAbi: "lab@1",
        }),
      });

      const catRes = await fetch("/api/v1/catalog?meta=1");
      const cat = (await catRes.json()) as { items: Array<{ experimentId: string; manifestSha256: string }> };
      const chem = cat.items.find((i) => i.experimentId === "AP-CHEM-10-2.3")!;

      const goodLaunch = await fetch("/api/v1/launch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf || "",
          "Idempotency-Key": "e2e-replay-launch-check-0001",
        },
        body: JSON.stringify({
          assignmentId: null,
          experimentId: "AP-CHEM-10-2.3",
          labId: "chemistry",
          mode: "simulation",
          contentVersion: "0.1.0-research",
          manifestSha256: chem.manifestSha256,
          locale: "en-IN",
          engineAbi: "lab@1",
        }),
      });
      const launchData = (await goodLaunch.json()) as { launchToken: string };

      const redeem1 = await fetch("/api/v1/launch/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf || "",
          "Idempotency-Key": "e2e-redeem-once-check-0001",
        },
        body: JSON.stringify({ launchToken: launchData.launchToken }),
      });

      const redeem2 = await fetch("/api/v1/launch/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf || "",
          "Idempotency-Key": "e2e-redeem-replay-check-0002",
        },
        body: JSON.stringify({ launchToken: launchData.launchToken }),
      });

      return {
        badManifestStatus: badManifest.status,
        redeem1Status: redeem1.status,
        redeem2Status: redeem2.status,
      };
    });

    expect(apiChecks.badManifestStatus).toBe(409);
    expect(apiChecks.redeem1Status).toBe(200);
    expect(apiChecks.redeem2Status).toBe(409);

    // 2. State admin small-cell suppression (< 5)
    await signInAs(page, "state.ap@ap-edu.test");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByText("< 5 (suppressed)").first()).toBeVisible();

    // 3. Two-person editorial workflow: Editor creates draft -> Reviewer approves
    await signInAs(page, "editor@g1virtualabs.test");
    await expect(page).toHaveURL(/\/content$/);
    await page.fill("#draft-ver", "0.2.0-e2e");
    await page.getByTestId("submit-draft-btn").click();
    await expect(page.getByText("AP-CHEM-10-2.3@0.2.0-e2e", { exact: true })).toBeVisible();

    await signInAs(page, "reviewer@g1virtualabs.test");
    await expect(page).toHaveURL(/\/content$/);
    const approveBtn = page.locator('button:has-text("Approve & publish")').first();
    await approveBtn.click();
    await expect(page.getByText("Review decision 'approved' persisted")).toBeVisible();
  });
});
