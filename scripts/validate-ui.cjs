const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const WebSocket = require("ws");

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const outputDir = path.resolve("overleaf", "imgs");
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "tfg-ui-check-"));
const port = 9333;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function json(url) {
  const response = await fetch(url);
  return response.json();
}

async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });

  let id = 0;
  const pending = new Map();
  socket.on("message", (raw) => {
    const message = JSON.parse(raw);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });

  return {
    call(method, params = {}) {
      const callId = ++id;
      socket.send(JSON.stringify({ id: callId, method, params }));
      return new Promise((resolve, reject) => {
        pending.set(callId, { resolve, reject });
      });
    },
    close() {
      socket.close();
    },
  };
}

async function evaluate(cdp, expression) {
  const result = await cdp.call("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text);
  }
  return result.result.value;
}

async function screenshot(cdp, filename) {
  const result = await cdp.call("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  fs.writeFileSync(path.join(outputDir, filename), Buffer.from(result.data, "base64"));
}

async function clickText(cdp, text) {
  const clicked = await evaluate(
    cdp,
    `(() => {
      const target = [...document.querySelectorAll('button,[role="button"]')]
        .find((element) => element.textContent.trim() === ${JSON.stringify(text)});
      if (!target) return false;
      target.click();
      return true;
    })()`,
  );
  if (!clicked) throw new Error(`No s'ha trobat el control: ${text}`);
  await delay(700);
}

async function setViewport(cdp, width, height) {
  await cdp.call("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 600,
  });
  await delay(300);
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      "--window-size=1440,1000",
      "http://localhost:8000/",
    ],
    { stdio: "ignore", windowsHide: true },
  );

  try {
    let targets;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        targets = await json(`http://127.0.0.1:${port}/json`);
        break;
      } catch {
        await delay(250);
      }
    }
    const target = targets?.find((item) => item.type === "page");
    if (!target) throw new Error("Chrome no ha publicat cap pàgina");

    const cdp = await connect(target.webSocketDebuggerUrl);
    await cdp.call("Page.enable");
    await cdp.call("Runtime.enable");
    await delay(2500);

    const report = {};
    report.title = await evaluate(cdp, "document.title");
    report.bodyText = await evaluate(cdp, "document.body.innerText");
    report.consoleErrors = [];
    cdp.call("Log.enable").catch(() => {});

    await setViewport(cdp, 1440, 1000);
    await clickText(cdp, "Resum");
    await screenshot(cdp, "dashboard_actual.png");

    await clickText(cdp, "Historial");
    await screenshot(cdp, "analysis_history_actual.png");
    const firstRowClicked = await evaluate(
      cdp,
      `(() => {
        const row = document.querySelector('tbody tr');
        if (!row) return false;
        row.click();
        return true;
      })()`,
    );
    if (firstRowClicked) {
      await delay(700);
      await screenshot(cdp, "analysis_detail_summary.png");
      report.detailText = await evaluate(cdp, "document.body.innerText");
      await evaluate(
        cdp,
        `(() => {
          document.querySelectorAll('details').forEach((details) => {
            details.open = true;
          });
          const labels = [
            'Transacció descodificada',
            'Revisió de la IA',
            'Senyals d’adreces conegudes',
            'Veredicte complet',
            'Rendiment',
            'Metadades d’avaluació'
          ];
          [...document.querySelectorAll('button')].forEach((button) => {
            if (labels.some((label) => button.textContent.includes(label))) button.click();
          });
          return true;
        })()`,
      );
      await delay(400);
      await setViewport(cdp, 900, 1000);
      await evaluate(
        cdp,
        `[...document.querySelectorAll('summary,button')]
          .find((element) => element.textContent.includes('Transacció descodificada'))
          ?.scrollIntoView({ block: 'start' })`,
      );
      await delay(300);
      await screenshot(cdp, "analysis_detail_decoded.png");
      await evaluate(
        cdp,
        `[...document.querySelectorAll('summary,button')]
          .find((element) => element.textContent.includes('Veredicte complet'))
          ?.scrollIntoView({ block: 'start' })`,
      );
      await delay(300);
      await screenshot(cdp, "analysis_detail_verdict.png");
    }

    await clickText(cdp, "Adreces");
    await setViewport(cdp, 1440, 1000);
    await evaluate(cdp, "window.scrollTo(0, 0)");
    await delay(300);
    await screenshot(cdp, "known_addresses_dashboard.png");

    await clickText(cdp, "Proves");
    await evaluate(cdp, "window.scrollTo(0, 0)");
    await delay(300);
    await screenshot(cdp, "testing_tools_actual.png");

    await setViewport(cdp, 390, 844);
    await clickText(cdp, "Resum");
    await screenshot(cdp, "dashboard_mobile_check.png");
    report.mobileOverflow = await evaluate(
      cdp,
      `({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        offenders: [...document.querySelectorAll('body *')]
          .filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
          .slice(0, 10)
          .map((el) => ({ tag: el.tagName, text: el.textContent.trim().slice(0, 80) }))
      })`,
    );

    report.visibleEnglishHeadings = (report.bodyText.match(
      /\\b(Findings|Decoded|AI review|ALLOW|REVIEW|BLOCK)\\b/g,
    ) || []);
    report.hasRequiredTabs = ["Resum", "Historial", "Adreces", "Proves"].every(
      (tab) => report.bodyText.includes(tab),
    );
    console.log(JSON.stringify(report, null, 2));
    cdp.close();
  } finally {
    chrome.kill();
    await new Promise((resolve) => {
      chrome.once("exit", resolve);
      setTimeout(resolve, 2000);
    });
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch {
      // Chrome Crashpad can retain the temporary metrics file briefly on Windows.
    }
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
