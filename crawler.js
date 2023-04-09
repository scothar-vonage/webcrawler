const puppeteer = require("puppeteer");
const fs = require("fs");

const TurndownService = require("turndown");
const turndownService = new TurndownService();


const startUrls = ["https://developer.vonage.com/en/voice/voice-api/overview"];
const path = __dirname + "/docs/markdown/";

const xpath =
  '//*[@id="single-spa-application:en-dev-portal"]/div/div/div/div/div[2]';

//This will save our history, so we don't process a page multiple times
const history = [];

async function savePageAsText(url, content) {
  const fileName = url.replace(/https?:\/\/|\/|www\./g, '') + '.md';
  
  const markdown = turndownService.turndown(content);
    
  fs.writeFileSync(path + fileName, markdown);
}

//Recursive function that crawls through all of the links on a page
async function crawl(url, browser) {
  console.log("Crawling:", url);

  const page = await browser.newPage();
  ``;
  await page.goto(url);

  //Wait until we see xpath...by then, the page will have loaded fully.
  await page.waitForXPath(xpath);

  // Get the page content
  const content = await page.content();

  // Extract all internal links from the page
  const links = await page.$$eval("a[href]", (anchors) =>
    anchors
      .map((a) => a.href)
      .filter((href) =>
        href.startsWith("https://developer.vonage.com/en/voice/")
      )
  );

  console.log(`Links: ${links}`);

  await savePageAsText(url, content);

  // Close the page
  await page.close();


  
  // Recursively crawl the extracted links
  for (const link of links) {

    //We hash each url and store them in history so we only process a page once.
    const hash = getHash(link);
    if (inHistory(hash)) {
      console.log(`Already visited ${link}`);
    } else {
      let v = [];
      v[0] = hash;
      v[1] = link;
      history.push(v);

      await crawl(link, browser);
      i++;
    }
  }
  
}

(async () => {
  const browser = await puppeteer.launch({ headless: false });
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
    console.log(`${history[i][0]} : ${hash}`);
    if (history[i][0] === hash) {
      console.log("Found");
      return true;
    }
  }

  return false;
}

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
