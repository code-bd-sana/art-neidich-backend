const fs = require("fs");
const path = require("path");

const ejs = require("ejs");
const puppeteer = require("puppeteer");

/* ---------------- Browser Singleton ---------------- */

let browser = null;

async function getBrowser() {
  if (browser) return browser;

  browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  console.log("✅ Puppeteer browser launched");

  return browser;
}

/* ---------------- EJS Compile Once ---------------- */

const templatePath = path.join(__dirname, "..", "templates", "report.ejs");
const templateString = fs.readFileSync(templatePath, "utf8");
const renderTemplate = ejs.compile(templateString);

/* ---------------- PDF Generator ---------------- */

async function generateReportPdf(report) {
  const html = renderTemplate({ report });

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1200, height: 1600 });

    await page.setContent(html, {
      waitUntil: "domcontentloaded",
    });

    // ✅ Fast image wait (critical fix)
    await page.waitForFunction(() => {
      const imgs = Array.from(document.images || []);
      return imgs.length === 0 || imgs.every((img) => img.complete);
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "20mm",
        bottom: "20mm",
        left: "15mm",
        right: "15mm",
      },
    });

    await page.close();
    return pdfBuffer;
  } catch (err) {
    await page.close().catch(() => {});
    throw err;
  }
}

module.exports = { generateReportPdf };
