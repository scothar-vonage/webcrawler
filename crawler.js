const puppeteer = require("puppeteer");
const fs = require("fs");
const winston = require("winston");

//URL for voice-api & SMS overiew
const startUrls1 = [
  "https://developer.vonage.com/en/messaging/sms/overview",
  "https://developer.vonage.com/en/messages/overview",
  "https://developer.vonage.com/en/dispatch/overview",
  "https://developer.vonage.com/en/meetings/overview",
  "https://developer.vonage.com/en/client-sdk/in-app-messaging/overview",
  "https://developer.vonage.com/en/client-sdk/in-app-voice/overview",
  "https://developer.vonage.com/en/verify/overview",
  "https://developer.vonage.com/en/number-insight/overview",
  "https://developer.vonage.com/en/application/overview",
  "https://developer.vonage.com/en/redact/overview",
  "https://developer.vonage.com/en/numbers/overview",
  "https://developer.vonage.com/en/reports/overview",
  "https://developer.vonage.com/en/account/overview",
  "https://developer.vonage.com/en/conversation/overview",
  "https://developer.vonage.com/en/client-sdk/overview",
  "https://developer.vonage.com/en/audit/overview",
];
const startUrls = ["https://developer.vonage.com/en/messaging/sms/overview"];

//URL for Voice API v2
//const startUrls = ["https://developer.vonage.com/en/api/voice.v2"];

//we only care about urls that start with this:
const wallUrl = "https://developer.vonage.com/en";

//Directory where we'll place the output files
const path = __dirname + "/docs/text/";

//For Guides
const xpath =
  '//*[@id="single-spa-application:en-dev-portal"]/div/div/div/div/div[2]';

//For API Reference Docs
// const xpath =
//      '//*[@id="single-spa-application:en-dev-portal"]/div/div/div/div[2]';

//This will save our history, so we don't process a page multiple times
const history = [];

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
    page.setDefaultTimeout(7000);
    await page.waitForXPath(xpath);
    // Get the page content
    const content = await page.content();

    // Extract all internal links from the page
    const links = await page.$$eval("a[href]", (anchors) =>
      anchors
        .map((a) => a.href)
        .filter((href) => href.startsWith("https://developer.vonage.com/en"))
    );

    //console.log(`Links in page: ${links}`);

    await savePageAsText(url, page);

    // Close the page
    await page.close();

    // Recursively crawl the extracted links
    for (const link of links) {
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
    //console.log(e);
  }
}

function addHistory(hash, link) {
  log("debug", `Adding ${link} to history list`);
  let v = [];
  v[0] = hash;
  v[1] = link;
  history.push(v);
}

(async () => {
  const browser = await puppeteer.launch({});
  for (const url of startUrls) {
    await crawl(url, browser);
  }
  await browser.close();
  log("debug", "Links visited:", history);
})();

function inHistory(hash) {
  if (history.length < 1) {
    return false;
  }

  for (var i = 0; i < history.length; i++) {
    //console.log(`${history[i][0]} : ${hash}`);
    if (history[i][0] === hash) {
      // log(
      //   "debug",
      //   `Found ${history[i][1]} in history. Will not process again.`
      // );
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
