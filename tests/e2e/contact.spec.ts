import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const sample = () => ({
  name: "Synthetic Contact Visitor",
  email: `contact-${randomUUID()}@example.test`,
  phone: "",
  institution: "",
  visitor: "teacher",
  category: "technical",
  subject: "Synthetic inquiry " + randomUUID(),
  message: "Synthetic inquiry about opening a classroom demonstration.",
  consent: true,
  website: "",
});

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in?next=/admin/inquiries");
  await page.locator("#signin-email").fill(email);
  await page.locator("#signin-password").fill("G1LocalTest!2026");
  await page.getByTestId("signin-submit").click();
  await expect(page).toHaveURL(/\/admin\/inquiries$/);
}

test("Contact Us navigation, bilingual fluid-glass controls and persisted form", async ({ page, request, baseURL }) => {
  test.skip(process.env.G1_ISOLATED_UPGRADE_QA !== "true", "Writes synthetic inquiries to the isolated database only.");
  await page.goto("/help");
  const navigation = page.getByRole("navigation", { name: "Primary navigation", exact: true });
  const contact = navigation.getByRole("link", { name: "Contact Us", exact: true });
  await expect(navigation.getByRole("link", { name: "Help" })).toHaveAttribute("aria-current", "page");
  await contact.click();
  await expect(page).toHaveURL(/\/contact$/);
  await expect(contact).toHaveAttribute("aria-current", "page");
  await expect(navigation.getByRole("link", { name: "Help" })).not.toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: /^Email Us/ })).toHaveAttribute("href", "mailto:yuvaratna06101997@gmail.com");
  await expect(page.getByRole("link", { name: /^Call Us/ })).toHaveAttribute("href", "tel:+919494054316");
  await expect(page.getByRole("link", { name: /^WhatsApp/ })).toHaveAttribute("href", "https://wa.me/919494054316");
  await expect(page.getByRole("link", { name: "G1 Virtual Labs — Home" })).toBeVisible();

  const violations = (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze())
    .violations.filter(entry => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map(entry => entry.id)).toEqual([]);

  const data = sample();
  const submit = page.getByRole("button", { name: "Send Message" });
  await submit.click();
  const form = page.getByRole("form", { name: "Send an inquiry" });
  await expect(form.getByRole("alert")).toContainText("Check the highlighted fields");
  await expect(page.getByLabel("Full name")).toBeFocused();
  await page.getByLabel("Full name").fill(data.name);
  await page.getByLabel("Email address").fill(data.email);
  await page.getByLabel("Subject", { exact: true }).fill(data.subject);
  await page.getByLabel("Message", { exact: true }).fill(data.message);
  const visitor = page.getByRole("combobox", { name: "Visitor type" });
  await visitor.press("ArrowDown");
  await visitor.press("t");
  await visitor.press("Enter");
  await expect(visitor).toHaveText(/Teacher/);
  await page.getByRole("combobox", { name: "Inquiry category" }).click();
  await page.getByRole("option", { name: "Technical Support", exact: true }).click();
  await page.getByRole("checkbox").check();
  const accepted = page.waitForResponse(response => response.url().endsWith("/api/contact"));
  await submit.click();
  expect((await accepted).status()).toBe(201);
  await expect(form.getByRole("status")).toContainText("Your inquiry has been recorded.");
  const duplicate = await request.post("/api/contact", { headers: { Origin: baseURL! }, data });
  expect(duplicate.status()).toBe(200);
  expect(await duplicate.json()).toEqual({ code: "duplicate" });

  await page.getByTestId("locale-toggle").first().click();
  await expect(page.locator("html")).toHaveAttribute("lang", "te");
  await expect(page.getByRole("link", { name: "మమ్మల్ని సంప్రదించండి", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "సందేశం పంపండి" })).toBeVisible();
  await page.getByRole("link", { name: "ముఖపుటకు తిరిగి" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("Contact endpoint rejects invalid and abusive submissions and keeps the inbox private", async ({ page, browser, request, baseURL }) => {
  test.skip(process.env.G1_ISOLATED_UPGRADE_QA !== "true", "Writes synthetic inquiries to the isolated database only.");
  const headers = { Origin: baseURL! };
  const data = sample();
  expect((await request.get("/api/contact")).status()).toBe(405);
  expect((await request.post("/api/contact", { headers: { Origin: "https://example.test" }, data })).status()).toBe(403);
  for (const invalid of [
    { consent: false },
    { email: "visitor@example.test\r\nBcc: another@example.test" },
    { message: "x".repeat(3001) },
    { website: "spam" },
    { visitor: "invalid" },
  ]) {
    expect((await request.post("/api/contact", { headers, data: { ...data, ...invalid } })).status()).toBe(400);
  }
  const textMessage = "<script>synthetic plain text</script>";
  const submits = await Promise.all([1, 2].map(() => request.post("/api/contact", { headers, data: { ...data, message: textMessage } })));
  expect(submits.map(response => response.status()).sort()).toEqual([200, 201]);
  for (let index = 2; index < 5; index++) {
    expect((await request.post("/api/contact", { headers, data: { ...data, subject: `${data.subject} ${index}` } })).status()).toBe(201);
  }
  const throttled = await request.post("/api/contact", { headers, data });
  expect(throttled.status()).toBe(429);
  expect(throttled.headers()["retry-after"]).toBe("900");

  await page.goto("/admin/inquiries");
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  await signIn(page, "state.ap@ap-edu.test");
  await expect(page.getByRole("heading", { name: "Contact inquiries", exact: true })).toHaveCount(0);
  await expect(page.getByText(textMessage, { exact: true })).toHaveCount(0);

  const operator = await browser.newContext();
  try {
    const inbox = await operator.newPage();
    await signIn(inbox, "operator@g1virtualabs.test");
    await expect(inbox.getByRole("heading", { name: "Contact inquiries", exact: true })).toBeVisible();
    const record = inbox.getByRole("article").filter({ has: inbox.getByRole("heading", { name: data.subject, exact: true }) });
    await expect(record).toHaveCount(1);
    await expect(record.getByText(textMessage, { exact: true })).toBeVisible();
    await expect(record.locator("script")).toHaveCount(0);
    await expect(record.getByText(/Email notifications off/)).toBeVisible();
  } finally {
    await operator.close();
  }
});
