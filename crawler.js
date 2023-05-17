const puppeteer = require("puppeteer");
const fs = require("fs");
const winston = require("winston");
const dotenv = require("dotenv");

dotenv.config();
//URL for voice-api & SMS overiew
const startUrls = process.env.START_URLS.split(",");

//we only care about urls that start with this:
const wallUrl = process.env.WALL_URL;

//Directory where we'll place the output files
const path = __dirname + process.env.OUTPUT_PATH;

const xpath = process.env.XPATH;

const historyLog = "history.log";

//This will save our history, so we don't process a page multiple times
const history = [];

//The length of time in milliseconds we'll wait for a page to load
const pageTimeout = 5000;

//initialize logger
const logger = winston.createLogger({
  level: "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, error }) => {
      const errorMessage = error && error.stack ? `\n${error.stack}` : "";
      return `[${timestamp}] ${level.toUpperCase()}: ${message}${errorMessage}`;
    })
  ),
  transports: [
    new winston.transports.File({ filename: "crawl.log" }),
    new winston.transports.Console(),
  ],
});

function log(level, message, error = null) {
  logger.log({ level, message, error });
}

// Read the file and convert its content to a 2-dimensional array
function loadHistoryFromLog() {
  if (!fs.existsSync(historyLog)) {
    return;
  }

  const fileContent = fs.readFileSync(historyLog, "utf-8");
  const lines = fileContent.split("\n");
  return lines.map((line) => {
    if (line === "") {
      return;
    }
    const [hash, link] = line.split(",");
    addHistory(hash, link, true);
  });
}

async function savePageAsText(url, page) {
  const textContent = await page.evaluate(() => {
    return document.documentElement.innerText;
  });

  const fileName = url.replace(/https?:\/\/|\/|www\./g, "") + ".txt";

  fs.writeFileSync(path + fileName, textContent);
}

//Recursive function that crawls through all of the links on a page
async function crawl(url, browser) {
  log("debug", `Crawling: ${url}`);
  const pageRefsRegex = /^(.*?)#/;

  const page = await browser.newPage();

  await page.goto(url);

  //Wait until we see xpath...by then, the page will have loaded fully.
  try {
    page.setDefaultTimeout(pageTimeout);

    await page.waitForXPath(xpath);

    // Get the page content
    const content = await page.content();

    const links = await page.$$eval(
      "a[href]",
      (anchors, wallUrl) =>
        anchors.map((a) => a.href).filter((href) => href.startsWith(wallUrl)),
      wallUrl
    );
    await savePageAsText(url, page);

    // Close the page
    await page.close();
    addHistory(getHash(url), url);

    // Recursively crawl the extracted links
    for (const link of links) {
      log("debug", `--->Found link: ${link}`);
      //We hash each url and store them in history so we only process a page once.
      let hash;

      //We don't need to crawl the page ref links
      const match = link.match(pageRefsRegex);

      if (match) {
        hash = getHash(match[1]);
      } else {
        hash = getHash(link);
      }

      if (inHistory(hash)) {
        log("debug", `Already visited ${link}`);
      } else {
        addHistory(hash, link);
        await crawl(link, browser);
      }
    }
  } catch (e) {
    addHistory(getHash(url), url);
    log("debug", `Error crawling ${url}`, e);
  }
}

function addHistory(hash, link, skipSave = false) {
  if (inHistory(hash)) {
    return;
  }

  log("debug", `Adding ${hash}, ${link} to history list`);
  let v = [];
  v[0] = hash;
  v[1] = link;
  history.push(v);

  if (!skipSave) {
    writeHistoryToFile(hash, link);
  }
}

(async () => {
  log("debug", `Starting crawler with ${startUrls.toString()}`);
  log("debug", `Wall URL: ${wallUrl}`);
  const browser = await puppeteer.launch({});
  loadHistoryFromLog();
  log("debug", `History has ${history.length} entries`);
  for (const url of startUrls) {
    await crawl(url, browser);
  }
  await browser.close();
})();

function inHistory(hash) {
  if (history.length < 1) {
    return false;
  }

  for (var i = 0; i < history.length; i++) {
    if (history[i][0] === hash) {
      return true;
    }
  }

  return false;
}

//Simple hash function
function getHash(s) {
  var a = 1,
    c = 0,
    h,
    o;
  if (s) {
    a = 0;
    for (h = s.length - 1; h >= 0; h--) {
      o = s.charCodeAt(h);
      a = ((a << 6) & 268435455) + o + (o << 14);
      c = a & 266338304;
      a = c !== 0 ? a ^ (c >> 21) : a;
    }
  }
  return String(a);
}

function writeHistoryToFile(hash, link) {
  const formattedString = `${hash},${link}\n`;

  fs.appendFile("history.log", formattedString, (e) => {
    if (e) {
      log("error", "Error writing history to log", e);
    }
  });
}
