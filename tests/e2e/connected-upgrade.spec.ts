import { randomBytes, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { emptyCreatorDraft } from "../../src/lib/creator-contract";

const output = process.env.G1_UPGRADE_SCREENSHOTS || path.resolve("test-results", "website-upgrade");
const fixturePassword = "G1LocalTest!2026";

async function capture(page: Page, name: string) {
  await mkdir(output, { recursive: true });
  await page.evaluate(() => { window.scrollTo(0, 0); });
  await page.screenshot({ path: path.join(output, name + ".png"), fullPage: true, caret: "initial", animations: "disabled" });
}

async function captureDesktopAndMobile(page: Page, name: string) {
  const original = page.viewportSize()!;
  try {
    for (const [device, width, height] of [["desktop", 1670, 942], ["mobile", 390, 844]] as const) {
      await page.setViewportSize({ width, height });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await capture(page, name + "-" + device);
    }
  } finally {
    await page.setViewportSize(original);
  }
}

async function captureResponsive(page: Page, name: string) {
  const original = page.viewportSize()!;
  const origin = new URL(page.url()).origin;
  try {
    for (const [language, locale] of [["en", "en-IN"], ["te", "te-IN"]]) {
      await page.context().addCookies([{ name: "g1_locale", value: locale, url: origin }]);
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("lang", language);
      for (const [layout, width, height] of [["desktop", 1440, 900], ["tablet", 768, 1024], ["mobile", 390, 844]] as const) {
        await page.setViewportSize({ width, height });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await capture(page, `${name}-${layout}-${language}`);
      }
    }
  } finally {
    await page.context().clearCookies({ name: "g1_locale" });
    await page.setViewportSize(original);
    await page.reload();
  }
}

async function login(page: Page, username: string, password = fixturePassword, creator = false) {
  await page.goto(creator ? "/sign-in?role=creator" : "/sign-in");
  await page.locator("#signin-email").fill(username);
  await page.locator("#signin-password").fill(password);
  await page.getByTestId("signin-submit").click();
  await expect(page).not.toHaveURL(/\/sign-in/);
}

async function post(page: Page, url: string, data: unknown) {
  const csrf = (await page.context().cookies()).find(cookie => cookie.name === "g1_csrf");
  expect(csrf).toBeTruthy();
  return page.request.post(url, { data, headers: { "X-CSRF-Token": csrf!.value, "Idempotency-Key": randomUUID() } });
}

test("public navigation, responsive reflow and dependent discovery", async ({ page }) => {
  const health = await Promise.all(Array.from({ length: 12 }, () => page.request.get("/api/health")));
  expect(health.every(response => response.ok())).toBe(true);
  await page.goto("/");
  const stages = page.getByTestId("education-stage-rail");
  await expect(stages.getByRole("link")).toHaveCount(7);
  await expect(page.locator("footer")).toHaveCount(0);
  await expect(page.getByTestId("home-atom-toggle")).toHaveCount(0);
  await expect(stages.locator("[aria-current]")).toHaveCount(0);
  for (const width of [320, 390, 768, 1280, 1670, 1900]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const image = await page.getByTestId("home-science-image").boundingBox();
  const intro = await page.getByRole("heading", { level: 1 }).boundingBox();
  expect(image!.y + image!.height).toBeLessThanOrEqual(intro!.y + 50);
  const overviewPanel = await page.locator(".g1-home-intro").boundingBox();
  const subjects = await page.locator(".g1-home-subjects").boundingBox();
  expect(overviewPanel!.y).toBeGreaterThanOrEqual(image!.y + image!.height - 4);
  expect(overviewPanel!.y + overviewPanel!.height).toBeLessThan(subjects!.y);
  await capture(page, "homepage-after-desktop");
  await page.getByTestId("hero-explore-cta").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Choose your science laboratory.");
  await capture(page, "laboratories-after-desktop");
  for (const [subject, experiment] of [["Chemistry", "Zinc and dilute sulfuric acid"], ["Biology", "Onion epidermis"], ["Physics", "Glass slab refraction"]]) {
    await page.getByRole("link", { name: new RegExp("^" + subject) }).click();
    await expect(page.getByRole("link", { name: "View experiment: " + experiment })).toBeVisible();
    await capture(page, subject.toLowerCase() + "-laboratory-after-desktop");
    await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Laboratories", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Choose your science laboratory.", exact: true })).toBeVisible();
  }
  await expect(page.getByRole("search")).toHaveCount(0);
  await page.getByTestId("home-subject-physics").click();
  await expect(page.getByTestId("fixed-subject")).toHaveText("Physics");
  await expect(page.getByRole("combobox", { name: "Subject", exact: true })).toHaveCount(0);
  await page.getByRole("combobox", { name: "Class", exact: true }).click();
  await page.getByRole("option", { name: "Class 10", exact: true }).click();
  const lesson = page.getByRole("combobox", { name: "Lesson", exact: true });
  await lesson.press("Space");
  await expect(page.getByRole("listbox", { name: "Lesson" }).getByRole("option")).toHaveCount(2);
  await lesson.press("l");
  await lesson.press("Space");
  await expect(lesson).toHaveText("Light reflection and refraction");
  await lesson.press("ArrowDown");
  await lesson.press("Escape");
  await expect(lesson).toHaveAttribute("aria-expanded", "false");
  await expect(lesson).toBeFocused();
  await expect(lesson).toHaveText("Light reflection and refraction");
  await page.getByRole("searchbox").fill("9.10");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("link", { name: /View experiment: Glass slab refraction/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /View experiment:/ })).toHaveCount(1);
  await capture(page, "filtered-lesson-after-desktop");
  await page.getByRole("link", { name: /View experiment: Glass slab refraction/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("parallel glass slab");
  await expect(page.getByRole("link", { name: "Back to laboratory" })).toHaveAttribute("href", /physics\?grade=10&lesson=.*&q=9\.10/);
  await capture(page, "experiment-overview-after-desktop");
  await page.goto("/help?q=accessible+controls");
  await expect(page.getByRole("heading", { name: "Playing a lab" })).toBeVisible();
  await page.goto("/help");
  await capture(page, "help-after-desktop");
  await page.goto("/about");
  await expect(page.getByRole("heading", { name: "What’s coming next" })).toBeVisible();
  await capture(page, "about-after-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const menu = page.getByTestId("mobile-menu-toggle");
  await menu.click();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator('[data-testid="locale-toggle"]:visible').click();
  await expect(page.locator("html")).toHaveAttribute("lang", "te");
  await expect(page.getByTestId("tablet-signin-link")).toBeHidden();
  const menuBox = await menu.boundingBox();
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(390);
  await capture(page, "homepage-after-mobile-telugu");
});

test("all seven stages carry their class into the illustrated subject cards", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [index, label] of ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "1st Inter", "2nd Inter"].entries()) {
    const grade = index + 6;
    await page.goto("/");
    await page.getByTestId("education-stage-rail").getByRole("link", { name: label, exact: true }).press("Enter");
    await expect(page).toHaveURL("/laboratories?grade=" + grade);
    await expect(page.getByRole("search")).toHaveCount(0);
    for (const subject of ["chemistry", "physics", "biology"]) {
      const card = page.getByTestId("home-subject-" + subject);
      await expect(card).toHaveAttribute("href", "/laboratories/" + subject + "?grade=" + grade + "&from=class");
      await expect(card.locator("img")).toBeVisible();
    }
    await page.getByTestId("home-subject-physics").locator("img").click();
    await expect(page).toHaveURL("/laboratories/physics?grade=" + grade + "&from=class");
    const className = grade === 11 ? "Intermediate 1st Year" : grade === 12 ? "Intermediate 2nd Year" : label;
    await expect(page.getByTestId("fixed-class")).toHaveText(className);
    await expect(page.getByTestId("fixed-subject")).toHaveText("Physics");
    await expect(page.getByRole("combobox", { name: "Class", exact: true })).toHaveCount(0);
    await page.getByRole("link", { name: "Back to class subjects" }).click();
    await expect(page).toHaveURL("/laboratories?grade=" + grade);
  }
});

test("the English homepage class tabs stay equal-sized in one row", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const rail = page.getByTestId("education-stage-rail");
  const tabs = rail.getByRole("link");
  await expect(tabs).toHaveText(["Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "1st Inter", "2nd Inter"]);
  for (const width of [390, 768, 1061, 1536]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => tabs.evaluateAll(links => {
      const bounds = links.map(link => link.getBoundingClientRect());
      const spread = (field: "top" | "width" | "height") => {
        const values = bounds.map(rect => rect[field]);
        return Math.max(...values) - Math.min(...values) < 1;
      };
      return spread("top") && spread("width") && spread("height") &&
        document.documentElement.scrollWidth <= innerWidth;
    }), { message: `One even row at ${width}px` }).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const last = rail.getByRole("link", { name: "2nd Inter", exact: true });
  await last.focus();
  await expect(last).toBeInViewport({ ratio: 1 });
  await last.press("Enter");
  await expect(page).toHaveURL(/\/laboratories\?grade=12$/);
});

test("Student opens Profile and Dashboard, with private persistent profile edits", async ({ page, browser, request }) => {
  test.skip(process.env.G1_ISOLATED_UPGRADE_QA !== "true", "Changes a profile in the isolated synthetic database.");
  const profileEndpoint = "/api/student/profile";
  const account = "student.b@school-vijayawada-02.test";
  const updatedName = "Student B Profile QA";

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const primary = page.getByRole("navigation", { name: "Primary navigation" });
  await primary.getByRole("link", { name: "Student", exact: true }).press("Enter");
  await expect(page).toHaveURL(/\/sign-in\?next=\/student\/profile&role=student$/);
  expect((await request.put(profileEndpoint, { data: { displayName: updatedName } })).status()).toBe(401);

  await page.locator("#signin-email").fill(account);
  await page.locator("#signin-password").fill(fixturePassword);
  await page.getByTestId("signin-submit").click();
  await expect(page).toHaveURL("/student/profile");
  await expect(primary.getByRole("link", { name: "Student", exact: true })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Student Dashboard", exact: true })).toHaveCount(0);

  const studentNav = page.getByRole("navigation", { name: "Student account" });
  const name = page.getByRole("textbox", { name: "Display name" });
  await expect(studentNav.getByRole("link", { name: "Profile" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText(account, { exact: true })).toBeVisible();
  expect((await page.request.put(profileEndpoint, { data: { displayName: updatedName } })).status()).toBe(400);

  await capture(page, "student-profile-desktop");
  await name.fill(updatedName);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText("Profile saved.");
  await page.reload();
  await expect(name).toHaveValue(updatedName);
  await studentNav.getByRole("link", { name: "Dashboard" }).click();
  await expect(page).toHaveURL("/student");
  await expect(studentNav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Welcome, " + updatedName })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("mobile-menu-toggle").click();
  const mobileNav = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(mobileNav.getByRole("link", { name: "Student", exact: true })).toHaveCount(1);
  await mobileNav.getByRole("link", { name: "Student", exact: true }).click();
  await expect(page).toHaveURL("/student/profile");
  await expect(page.getByTestId("mobile-nav-drawer")).toHaveCount(0);
  await expect(name).toHaveValue(updatedName);
  await capture(page, "student-profile-mobile");

  const teacher = await browser.newContext();
  try {
    const teacherPage = await teacher.newPage();
    await login(teacherPage, "teacher.a@school-guntur-01.test");
    expect((await teacherPage.request.get("/student/profile")).status()).toBe(404);
    const denied = await teacherPage.request.put(profileEndpoint, { data: { displayName: updatedName } });
    expect(denied.status()).toBe(404);
  } finally {
    await teacher.close();
  }
});

test("homepage cards open separate Simulation and Experiment workspaces", async ({ page }) => {
  await page.goto("/");
  const simulation = page.getByTestId("home-mode-simulation");
  await simulation.locator("img").click();
  await expect(page).toHaveURL(/\/modes\/simulation$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Simulation Mode");
  await expect(page.getByRole("list", { name: "Simulation stages" }).getByRole("heading")).toHaveText([
    "Aim", "Theory & Procedure", "Animation Video", "Result", "Assessment",
  ]);
  await expect(page.getByTestId("launch-experiment-btn")).toHaveCount(0);

  await page.goto("/");
  await page.getByTestId("home-mode-experiment").press("Enter");
  await expect(page).toHaveURL(/\/modes\/experiment$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Experiment Mode");
  await expect(page.getByRole("heading", { name: "Variables", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Comparisons", exact: true })).toBeVisible();
  await expect(page.getByTestId("launch-simulation-btn")).toHaveCount(0);
  await page.getByRole("navigation", { name: "Choose a practical" }).getByRole("link", { name: "Glass slab refraction" }).click();
  await expect(page).toHaveURL(/\/modes\/experiment\?practical=AP-PHYS-10-9\.10$/);
  await page.getByTestId("launch-experiment-btn").click();
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  expect(new URL(page.url()).searchParams.get("next")).toBe("/modes/experiment?practical=AP-PHYS-10-9.10");
});

test("laboratory filters open directly under their own fields on desktop and touch", async ({ browser, page }) => {
  const mobile = await browser.newPage({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  try {
    for (const view of [page, mobile]) {
      await view.goto("/laboratories/chemistry");
      for (const name of ["Class", "Lesson"]) {
        const field = view.getByRole("combobox", { name, exact: true });
        const list = view.getByRole("listbox", { name, exact: true });
        await field.scrollIntoViewIfNeeded();
        const closedBox = await field.boundingBox();
        await (view === mobile ? field.tap() : field.click());
        await expect(list).toBeVisible();
        await expect(view.getByRole("listbox")).toHaveCount(1);
        const [fieldBox, listBox] = await Promise.all([field.boundingBox(), list.boundingBox()]);
        expect(fieldBox).toEqual(closedBox);
        expect(listBox!.x).toBeCloseTo(fieldBox!.x, 0);
        expect(listBox!.width).toBeCloseTo(fieldBox!.width, 0);
        expect(Math.abs(listBox!.y - fieldBox!.y - fieldBox!.height)).toBeLessThanOrEqual(1);
        expect(await view.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (name === "Lesson") {
          await capture(view, `anchored-lesson-${view === mobile ? "mobile" : "desktop"}`);
          if (view === page) {
            const accessibility = await new AxeBuilder({ page: view }).include(".g1-discovery-form").analyze();
            expect(accessibility.violations).toEqual([]);
          }
          const acids = list.getByRole("option", { name: "Acids, bases and salts", exact: true });
          await (view === mobile ? acids.tap() : acids.click());
          await expect(field).toHaveText("Acids, bases and salts");
        } else {
          const heading = view.getByRole("heading", { level: 1 });
          await (view === mobile ? heading.tap() : heading.click());
        }
        await expect(list).toBeHidden();
      }
    }
  } finally {
    await mobile.close();
  }
});

test("role destinations render at desktop and mobile widths", async ({ browser, request }) => {
  test.skip(process.env.G1_ISOLATED_UPGRADE_QA !== "true", "Uses accounts from the isolated synthetic stack.");
  test.setTimeout(120_000);
  expect((await (await request.get("/api/health")).json()).localSyntheticMode).toBe(true);
  for (const [username, destinations] of [
    ["student.a@school-guntur-01.test", { "student-dashboard": "/student", "student-activity": "/student/activity" }],
    ["teacher.a@school-guntur-01.test", { "teacher-dashboard": "/teacher", "teacher-class-roster": "/teacher/classes/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
      "teacher-assignments": "/teacher/assignments", "teacher-reports": "/teacher/reports" }],
    ["state.ap@ap-edu.test", { "admin-overview": "/admin", "admin-creator-accounts": "/admin/creators", "admin-diagnostics": "/admin/diagnostics" }],
    ["editor@g1virtualabs.test", { "content-editor": "/content" }],
    ["reviewer@g1virtualabs.test", { "reviewer-queue": "/content" }],
  ] as const) {
    const page = await browser.newPage();
    try {
      await login(page, username);
      for (const [name, destination] of Object.entries(destinations)) {
        const response = await page.goto(destination);
        expect(response?.status()).toBe(200);
        await expect(page).toHaveURL(destination);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.locator("footer")).toHaveCount(0);
        await captureDesktopAndMobile(page, name);
      }
    } finally {
      await page.close();
    }
  }
});

test("creator, independent reviewer, gated learning and authoritative trial work together", async ({ page, browser }, testInfo) => {
  test.skip(process.env.G1_ISOLATED_UPGRADE_QA !== "true", "Creates an approved synthetic fixture only in the isolated QA stack.");
  test.setTimeout(210_000);

  const suffix = randomUUID().slice(0, 7);
  const username = "qa-creator-" + suffix;
  const password = randomBytes(24).toString("hex");
  await login(page, "state.ap@ap-edu.test");
  expect((await post(page, "/api/admin/creators", { username, password, displayName: "Synthetic QA Creator" })).status()).toBe(201);
  const clean = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: testInfo.outputPath("creator-recording"), size: { width: 1280, height: 800 } },
  });
  const creator = await clean.newPage();
  await login(creator, username, password, true);
  await expect(creator.getByRole("heading", { name: "Creator Workspace" })).toBeVisible();
  await captureDesktopAndMobile(creator, "creator-workspace");
  await creator.getByRole("link", { name: "Create experiment" }).click();
  await expect(creator).toHaveURL(/\/creator\?draft=new$/);
  await expect(creator.getByRole("navigation", { name: "Experiment authoring steps" })).toBeVisible();
  await captureResponsive(creator, "creator-editor");
  await creator.getByRole("button", { name: "2. Media" }).click();
  await creator.locator('input[type="file"]').setInputFiles(path.resolve("public/assets/labs/refraction.png"));
  const finish = creator.waitForResponse(response => response.url().endsWith("/api/creator/media") &&
    response.request().postDataJSON()?.operation === "finish");
  await creator.getByRole("button", { name: "Upload media" }).click();
  const uploaded = await finish;
  expect(uploaded.status(), await uploaded.text()).toBe(200);
  const { id: thumbnailId } = await uploaded.json();
  await expect(creator.getByRole("alert").filter({ hasText: "Upload" })).toHaveCount(0);
  await expect(creator.getByRole("button", { name: "2. Media" })).toHaveAttribute("aria-current", "step");
  await expect(creator.getByLabel("Verified thumbnail").locator(`option[value="${thumbnailId}"]`)).toHaveText("refraction.png");
  await captureDesktopAndMobile(creator, "creator-media");
  await creator.getByRole("button", { name: "3. Simulation" }).click();
  await expect(creator.getByText(/^Question [1-5]$/)).toHaveCount(5);
  await captureDesktopAndMobile(creator, "creator-assessment");
  await creator.getByRole("button", { name: "4. Lab binding" }).click();
  await captureDesktopAndMobile(creator, "creator-lab-binding");

  const mediaFile = testInfo.outputPath("synthetic-optics-video.mp4");
  await mkdir(path.dirname(mediaFile), { recursive: true });
  await promisify(execFile)("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i",
    "testsrc2=size=1920x1080:rate=30", "-t", "10", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "0",
    "-threads", "4", "-an", "-y", mediaFile], { timeout: 30000, windowsHide: true });
  const bytes = await readFile(mediaFile);
  const split = 8 * 1024 * 1024;
  expect(bytes.length).toBeGreaterThan(split);
  const upload = await post(creator, "/api/creator/media", { operation: "prepare", filename: "synthetic-optics-video.mp4",
    type: "video/mp4", bytes: bytes.length });
  expect(upload.status()).toBe(200);
  const { id: videoId, uploadUrl } = await upload.json();
  const origin = new URL(creator.url()).origin;
  const put = (url: string, data: Buffer, offset: number) => creator.request.put(url, {
    data, headers: { Origin: origin, "Content-Type": "application/octet-stream", "Upload-Offset": String(offset) },
  });
  expect((await put(uploadUrl, bytes.subarray(0, split), 0)).status()).toBe(204);
  expect((await post(creator, "/api/creator/media", { operation: "finish", id: videoId })).status()).toBe(409);
  const renewed = await post(creator, "/api/creator/media", { operation: "resume", id: videoId });
  expect(renewed.status()).toBe(200);
  const resumed = (await renewed.json()).uploadUrl;
  expect((await creator.request.head(resumed, { headers: { Origin: origin } })).headers()["upload-offset"]).toBe(String(split));
  for (let offset = split; offset < bytes.length; offset += split) {
    expect((await put(resumed, bytes.subarray(offset, offset + split), offset)).status()).toBe(204);
  }
  const videoReady = await post(creator, "/api/creator/media", { operation: "finish", id: videoId });
  expect(videoReady.status(), await videoReady.text()).toBe(200);
  const partial = await creator.request.get("/api/media/" + videoId, { headers: { Range: "bytes=0-19" } });
  expect(partial.status()).toBe(206);
  expect(await partial.body()).toEqual(bytes.subarray(0, 20));
  console.log("Verified resumable video upload and range download for " + bytes.length + " bytes.");

  const data = emptyCreatorDraft();
  const pair = (en: string, te: string) => ({ en, te });
  const slug = "qa-optics-" + suffix;
  const experimentId = "creator-" + slug;
  const version = data.version;
  const draftId = randomUUID();
  Object.assign(data, { slug, grade: 10, subject: "physics", lessonId: "light-reflection-refraction", activity: "QA.1",
    modelConfirmed: true, rightsConfirmed: true, keywords: "refraction optics synthetic", notes: "Synthetic QA fixture for the existing slab model." });
  const lesson = await post(creator, "/api/creator/drafts", { operation: "lesson", lesson: {
    code: "qa-" + suffix, subject: "physics", grade: 8, titleEn: "Synthetic QA optics chapter",
    titleTe: "పరీక్ష కాంతి పాఠం", order: 1,
  } });
  expect(lesson.status(), await lesson.text()).toBe(201);
  const extraLesson = (await lesson.json()).id;
  data.additionalLessons = [{ grade: 8, lessonId: extraLesson }];
  const base = (await (await creator.request.get("/api/v1/catalog?meta=1")).json()).items.find(
    (item: { experimentId: string }) => item.experimentId === "AP-PHYS-10-9.10",
  );
  data.labManifest = {
    engine: "physics", engineAbi: "lab@1", sourceExperimentId: "AP-PHYS-10-9.10", sourceVersion: "0.1.0-research",
    simulationEntry: "guided-player@1", experimentEntry: "inquiry-player@1", manifestSha256: base.manifestSha256,
  };
  const fields = data.learning;
  fields.title = pair("QA slab refraction " + suffix, "పరీక్ష గాజు వక్రీభవనం " + suffix);
  fields.description = pair("Explore the path of a ray through parallel glass.", "సమాంతర గాజులో కాంతి కిరణ మార్గాన్ని చూడండి.");
  fields.aim = pair("Trace a ray through a slab.", "గాజు ద్వారా కాంతి కిరణాన్ని గమనించండి.");
  fields.theory = pair("The direction can change at the boundary.", "సరిహద్దు వద్ద దిశ మారవచ్చు.");
  fields.procedure = [pair("Mount the slab in the guided lab and trace a ray.", "గాజు దిమ్మెను అమర్చి కాంతి కిరణాన్ని గమనించండి.")];
  fields.alternateMedia = pair("Read the description of the illustrated ray path.", "చిత్రంలో కాంతి కిరణ మార్గం వివరణ చదవండి.");
  fields.result = pair("The numerical output is an ideal model prediction.", "సంఖ్యాత్మక ఫలితం ఆదర్శ నమూనా అంచనా.");
  fields.thumbnailId = thumbnailId;
  fields.videoId = videoId;
  fields.captions = pair("WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nSynthetic test pattern.", "WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nపరీక్ష చిత్రం.");
  fields.thumbnailAlt = pair("Illustration of a ray through glass.", "గాజులో కాంతి కిరణం చిత్రం.");
  const prompts = [
    pair("What changes when light enters the glass?", "కాంతి గాజులోకి ప్రవేశించినప్పుడు ఏది మారుతుంది?"),
    pair("What do you trace in this lab?", "ఈ ప్రయోగంలో మీరు దేనిని గమనిస్తారు?"),
    pair("Which direction is used as a reference for angles?", "కోణాలకు ఏ దిశ ఆధారం?"),
    pair("How many variables should change in a fair comparison?", "సరైన పోలికలో ఎన్ని చరరాశులు మారాలి?"),
    pair("How should you classify a model’s numeric output?", "నమూనా సంఖ్యాత్మక ఫలితాన్ని ఎలా వర్గీకరించాలి?"),
  ];
  const correct = [
    pair("Ray direction", "కిరణ దిశ"),
    pair("The light ray", "కాంతి కిరణం"),
    pair("The normal", "అభిలంబం"),
    pair("One variable", "ఒక చరరాశి"),
    pair("A theoretical prediction", "సిద్ధాంతపరమైన అంచనా"),
  ];
  fields.questions.forEach((question, i) => {
    question.prompt = prompts[i];
    question.options = [correct[i], pair("A sound wave", "శబ్ద తరంగం"), pair("A colour label", "రంగు గుర్తు"), pair("A physical measurement", "భౌతిక కొలత")];
    question.correct = 0;
    question.feedback = pair("Use the model limits and the ray diagram to explain your choice.", "మీ ఎంపికను వివరించడానికి నమూనా పరిమితులు, కిరణ చిత్రాన్ని ఉపయోగించండి.");
  });

  const saved = await post(creator, "/api/creator/drafts", { operation: "save", id: draftId, revision: 0, body: data });
  expect(saved.status(), await saved.text()).toBe(200);
  await creator.goto("/creator?draft=" + draftId);
  await creator.getByRole("button", { name: "3. Simulation" }).click();
  for (let index = 0; index < fields.questions.length; index++) {
    const question = creator.locator(".g1-author-details").filter({
      has: creator.getByText("Question " + (index + 1), { exact: true }),
    });
    const summary = question.locator("summary");
    if (!await question.evaluate(element => (element as HTMLDetailsElement).open)) await summary.click();
    const prompt = question.getByRole("group", { name: "Question", exact: true });
    await prompt.getByLabel("English").fill(fields.questions[index].prompt.en + " ");
    await prompt.getByLabel("English").fill(fields.questions[index].prompt.en);
    await question.getByLabel(/Correct option/).selectOption("0");
  }
  await expect(creator.getByText("Draft saved", { exact: true })).toBeVisible();
  await creator.getByRole("button", { name: "Preview as student" }).click();
  await expect(creator.getByRole("heading", { name: "Student preview" })).toBeVisible();
  await captureDesktopAndMobile(creator, "creator-student-preview");
  await creator.getByRole("button", { name: "5. Review" }).click();
  await captureDesktopAndMobile(creator, "creator-review");
  const decision = creator.waitForResponse(response => response.url().endsWith("/api/creator/drafts") &&
    response.request().postDataJSON()?.operation === "submit");
  await creator.getByRole("button", { name: "Submit for review" }).click();
  const submitted = await decision;
  expect(submitted.status(), await submitted.text()).toBe(201);
  const { reviewId } = await submitted.json();
  await expect(creator.getByText("Submitted for independent review", { exact: true })).toBeVisible();
  expect((await post(creator, "/api/content/versions/" + reviewId + "/decision", { decision: "approved", notes: "Unauthorized creator" })).status()).toBe(403);
  expect((await page.request.get("/experiments/" + experimentId)).status()).toBe(404);
  const creatorVideo = creator.video();
  await clean.close();
  await creatorVideo?.saveAs(path.join(output, "creator-workflow.webm"));

  const reviewerContext = await browser.newContext();
  const reviewer = await reviewerContext.newPage();
  await login(reviewer, "reviewer@g1virtualabs.test");
  await reviewer.goto("/content/review/" + reviewId);
  await expect(reviewer.getByRole("heading", { level: 1 })).toHaveText(fields.title.en);
  await captureDesktopAndMobile(reviewer, "content-review-detail");
  const reviewed = await post(reviewer, "/api/content/versions/" + reviewId + "/decision",
    { decision: "approved", notes: "Independent synthetic QA fixture approval." });
  expect(reviewed.status(), await reviewed.text()).toBe(200);

  const studentContext = await browser.newContext();
  const student = await studentContext.newPage();
  await login(student, "student.b@school-vijayawada-02.test");
  expect((await student.request.get("/creator")).status()).toBe(404);
  await student.goto("/");
  await expect(student.getByTestId("education-stage-rail").locator("[aria-current]")).toHaveCount(0);
  await expect(student.getByRole("link", { name: "Student", exact: true })).toHaveAttribute("href", "/student/profile");
  await student.goto("/student");
  await capture(student, "student-dashboard-after-desktop");
  await student.goto("/laboratories/physics");
  await expect(student.getByRole("link", { name: "View experiment: " + fields.title.en }).first()).toBeVisible();
  await student.goto("/laboratories/physics?grade=8&from=class&lesson=" + extraLesson);
  await expect(student.getByTestId("fixed-class")).toHaveText("Class 8");
  const lessonFilter = student.getByRole("combobox", { name: "Lesson", exact: true });
  await lessonFilter.click();
  const publishedOption = student.getByRole("option", { name: "Synthetic QA optics chapter", exact: true });
  await expect(publishedOption).toHaveAttribute("aria-selected", "true");
  await expect(publishedOption).toHaveCSS("background-image", /linear-gradient/);
  await captureDesktopAndMobile(student, "published-lesson-fluid-glass");
  await lessonFilter.press("Escape");
  const secondary = student.getByRole("link", { name: "View experiment: " + fields.title.en });
  await expect(secondary).toBeVisible();
  await secondary.click();
  await expect(student.getByRole("heading", { level: 1 })).toHaveText(fields.title.en);
  await expect(student.getByText(/Class 8 · Physics/)).toBeVisible();
  await student.getByTestId("launch-simulation-btn").click();
  await expect(student).toHaveURL(/\/learn\//);
  expect(new URL(student.url()).searchParams.get("browseGrade")).toBe("8");
  await student.getByRole("link", { name: "Experiment overview" }).click();
  await student.getByRole("link", { name: "Back to laboratory" }).click();
  await expect(student).toHaveURL(new RegExp("grade=8&from=class&lesson=" + extraLesson));
  await expect(secondary).toBeVisible();

  const detail = "/experiments/" + experimentId;
  await student.goto(detail);
  await expect(student.getByRole("heading", { level: 1 })).toHaveText(fields.title.en);
  await expect(student.getByTestId("launch-experiment-btn")).toBeDisabled();
  await captureDesktopAndMobile(student, "experiment-locked");
  const catalogue = await (await student.request.get("/api/v1/catalog?meta=1")).json();
  const model = catalogue.items.find((item: { experimentId: string }) => item.experimentId === experimentId);
  expect(model).toBeTruthy();
  expect(JSON.stringify(model)).not.toContain(fields.questions[0].feedback.en);
  const launch = { experimentId, labId: "physics", contentVersion: version, assignmentId: null,
    locale: "en-IN", engineAbi: model.engineAbi, manifestSha256: model.manifestSha256, mode: "experiment" };
  expect((await post(student, "/api/v1/launch", launch)).status()).toBe(403);
  const stepApi = "/api/learning/" + experimentId + "/" + version;
  expect((await post(student, stepApi, { stage: 5, answers: [0, 0, 0, 0, 0] })).status()).toBe(409);

  await student.goto("/modes/experiment?practical=" + experimentId);
  await expect(student.getByTestId("launch-experiment-btn")).toBeDisabled();
  await expect(student.getByTestId("launch-simulation-btn")).toHaveCount(0);
  await student.goto("/modes/simulation?practical=" + experimentId);
  await student.getByTestId("launch-simulation-btn").click();
  await expect(student).toHaveURL(/\/learn\//);
  await expect(student.getByRole("heading", { name: "Aim" })).toBeVisible();
  await expect(student.getByRole("progressbar")).toBeVisible();
  await expect(student.getByRole("button", { name: "Run supported calculation" })).toHaveCount(0);
  await captureResponsive(student, "simulation-aim");
  await student.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(student.getByRole("heading", { name: "Theory & Procedure" })).toBeVisible();
  await captureDesktopAndMobile(student, "simulation-theory");
  expect((await post(student, stepApi, { stage: 2 })).status()).toBe(409);
  await student.getByRole("button", { name: "Open guided lab" }).click();
  await expect(student).toHaveURL(/\/player\//);
  await student.getByRole("button", { name: /Mount parallel glass slab/ }).click();
  await student.getByRole("button", { name: /Trace 45/ }).click();
  await expect(student.getByText(/Committed at revision 2/)).toBeVisible();
  await captureDesktopAndMobile(student, "simulation-guided-player");
  await student.getByRole("link", { name: "Exit lab" }).click();

  await expect(student.getByRole("heading", { name: "Theory & Procedure" })).toBeVisible();
  await student.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(student.getByRole("heading", { name: "Animation / Video" })).toBeVisible();
  await expect(student.locator("video track")).toHaveCount(2);
  await expect.poll(() => student.locator("video").evaluate(element => (element as HTMLVideoElement).duration > 0)).toBe(true);
  const captions = await student.request.get(stepApi + "/captions/en");
  expect(await captions.text()).toContain("Synthetic test pattern.");
  await captureDesktopAndMobile(student, "simulation-media");
  await student.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(student.getByRole("heading", { name: "Result & Explanation" })).toBeVisible();
  await captureDesktopAndMobile(student, "simulation-result");
  await student.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(student.getByRole("heading", { name: "Assessment" })).toBeVisible();
  await expect(student.getByRole("radio")).toHaveCount(4);
  await captureDesktopAndMobile(student, "simulation-assessment");
  for (let i = 0; i < 5; i++) {
    await student.getByRole("radio").first().check();
    if (i < 4) await student.getByRole("button", { name: "Next question" }).click();
  }
  await student.getByRole("button", { name: "Submit five answers" }).click();
  await expect(student.getByText("Submitted · 5/5")).toBeVisible();
  await expect(student.getByText(/^Correct answer/)).toHaveCount(5);
  await student.getByRole("link", { name: "Open Experiment Mode" }).click();
  await expect(student.getByTestId("launch-experiment-btn")).toBeEnabled();
  await captureDesktopAndMobile(student, "experiment-unlocked");
  await student.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(student).toHaveURL(/\/$/);
  await login(student, "student.b@school-vijayawada-02.test");
  await student.goto("/modes/experiment?practical=" + experimentId);
  await expect(student.getByTestId("launch-experiment-btn")).toBeEnabled();
  await student.getByTestId("launch-experiment-btn").click();
  await expect(student.getByRole("heading", { name: "Theory-only results" })).toBeVisible();
  await expect(student.getByRole("list", { name: "Simulation stages" })).toHaveCount(0);
  await expect(student.getByTestId("stage-hotspot-trace-45")).toHaveCount(0);
  await captureResponsive(student, "experiment-workspace");
  await student.getByRole("button", { name: "Run supported calculation" }).click();
  await expect(student.getByText("transverse_offset_theoretical", { exact: true })).toBeVisible();
  await student.getByTestId("exp-record-comparison-btn").click();
  await expect(student.getByText("Confirmed trial history (2)")).toBeVisible();
  await captureDesktopAndMobile(student, "experiment-inquiry");
  await student.goto("/");
  await student.getByRole("link", { name: "View all activity" }).click();
  await expect(student.getByRole("heading", { name: "My laboratory journey" })).toBeVisible();
  await expect(student.getByRole("heading", { name: fields.title.en }).first()).toBeVisible();
  await reviewerContext.close();
  await studentContext.close();
});
