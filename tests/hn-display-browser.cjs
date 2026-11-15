// Local, synthetic demo only. No Supabase credentials or patient data are used.
/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, execFileSync } = require("node:child_process");
const { chromium, devices } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const port = Number(process.env.HN_BROWSER_PORT || 3116);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid local test port");
const base = `http://127.0.0.1:${port}`;
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "wardflow-hn-browser-"));
const storePath = path.join(fixture, "store.json");
let logs = "";
const server = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: path.resolve(__dirname, ".."), windowsHide: true,
  env: { ...process.env, NODE_ENV: "development", NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_APP_URL: base,
    NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    SUPABASE_SERVICE_ROLE_KEY: "", WARDFLOW_DEMO_STORE_PATH: storePath,
    GOOGLE_SERVICE_ACCOUNT_EMAIL: "", GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "", GOOGLE_DRIVE_FOLDER_ID: "" },
  stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.on("data", chunk => { logs = (logs + chunk.toString()).slice(-20000); process.stdout.write(chunk); });
server.stderr.on("data", chunk => { logs = (logs + chunk.toString()).slice(-20000); process.stderr.write(chunk); });

(async () => {
  let browser;
  try {
    const deadline = Date.now() + 120000;
    let ready = false;
    while (Date.now() < deadline) {
      if (server.exitCode !== null) throw new Error(`Local server exited: ${logs}`);
      try { if ((await fetch(base + "/login", { signal: AbortSignal.timeout(3000) })).ok) { ready = true; break; } } catch { /* Wait for local compilation. */ }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert(ready, "Local fixture server did not become ready");
    browser = await chromium.launch({ channel: "chrome", headless: true });
    let patientPath;
    for (const [label, options] of [["desktop", { viewport: { width: 1440, height: 1000 } }], ["mobile", devices["Pixel 7"]]]) {
      const context = await browser.newContext({ ...options, permissions: ["clipboard-read", "clipboard-write"] });
      await context.addCookies([{ name: "wardflow-demo", value: "1", domain: "127.0.0.1", path: "/" }]);
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      if (!patientPath) {
        await page.goto(base + "/wards");
        await page.getByRole("button", { name: "Admit patient", exact: true }).first().click();
        const admit = page.locator("form:visible").filter({ has: page.locator('input[name="hospitalNumber"]') }).first();
        await admit.locator('input[name="hospitalNumber"]').fill("1234567");
        await admit.locator('input[name="bed"]').fill("HN-TEST");
        await admit.locator('input[name="displayName"]').fill("ผู้ป่วยสมมติ ทดสอบ HN");
        await admit.locator('input[name="diagnosis"]').fill("Synthetic browser fixture");
        await admit.getByRole("button", { name: "Admit patient", exact: true }).click();
        await page.getByText("HN 34567-12", { exact: true }).waitFor();
        const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
        const patient = store.patients.find(row => row.displayName === "ผู้ป่วยสมมติ ทดสอบ HN");
        assert.equal(patient.hospitalNumber, "1234567");
        patientPath = `/patients/${patient.id}`;
      }
      await page.goto(base + patientPath);
      await page.getByText("HN 34567-12", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Copy HN", exact: true }).click();
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "1234567");
      await page.getByRole("button", { name: "Edit patient detail", exact: true }).click();
      const editor = page.locator('form:visible').filter({ has: page.locator('input[name="hospitalNumber"]') }).first();
      assert.equal(await editor.locator('input[name="hospitalNumber"]').inputValue(), "1234567");
      await editor.locator('input[name="hospitalNumber"]').fill("0012345");
      await editor.getByRole("button", { name: "Update patient detail", exact: true }).click();
      await page.getByText("HN 12345-00", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Copy HN", exact: true }).click();
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "0012345");
      await page.goto(base + patientPath + "/summary-note");
      assert((await page.locator("article").innerText()).includes("0012345"));
      assert(!(await page.locator("article").innerText()).includes("12345-00"));
      await page.getByRole("button", { name: "Copy text", exact: true }).first().click();
      const summary = await page.evaluate(() => navigator.clipboard.readText());
      assert(summary.includes("0012345"));
      assert(!summary.includes("12345-00"));
      assert(summary.includes("ผู้ป่วยสมมติ ทดสอบ HN"));
      await page.goto(base + patientPath);
      await page.getByRole("button", { name: "Edit patient detail", exact: true }).click();
      const prefixed = page.locator('form:visible').filter({ has: page.locator('input[name="hospitalNumber"]') }).first();
      await prefixed.locator('input[name="hospitalNumber"]').fill("HN6600012");
      await prefixed.getByRole("button", { name: "Update patient detail", exact: true }).click();
      await page.getByText("HN 6600012-HN", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Copy HN", exact: true }).click();
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "HN6600012");
      if (process.env.TEST_ARTIFACT_DIR) {
        fs.mkdirSync(process.env.TEST_ARTIFACT_DIR, { recursive: true });
        await page.screenshot({ path: path.join(process.env.TEST_ARTIFACT_DIR, `hn-${label}.png`), fullPage: true });
      }
      // Return the fixture to the starting HN for the next viewport through the real form.
      await page.getByRole("button", { name: "Edit patient detail", exact: true }).click();
      const reset = page.locator('form:visible').filter({ has: page.locator('input[name="hospitalNumber"]') }).first();
      await reset.locator('input[name="hospitalNumber"]').fill("1234567");
      await reset.getByRole("button", { name: "Update patient detail", exact: true }).click();
      await page.getByText("HN 34567-12", { exact: true }).waitFor();
      assert.deepEqual(errors, []);
      console.log(`PASS ${label}: admit/edit preserve HN; display rotates; Copy HN and Summary Note copy return originals; no browser errors`);
      await context.close();
    }
  } catch (error) {
    console.error(error);
    console.error(logs);
    process.exitCode = 1;
  } finally {
    await browser?.close();
    if (server.exitCode === null) {
      if (process.platform === "win32") {
        try { execFileSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { windowsHide: true, stdio: "ignore" }); } catch { /* Already stopped. */ }
      } else server.kill("SIGTERM");
    }
    const resolved = path.resolve(fixture);
    assert(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith("wardflow-hn-browser-"));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
})();
