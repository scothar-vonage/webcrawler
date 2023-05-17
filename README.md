# webcrawler

This simple web crawler will crawl through the configured pages and process all of the `<a> href` links on each of those pages. The script will create a text file (with no HTML) in the configured `OUTPUT_PATH` location for each page. It produces a `history.log` file which contains the hash and url of each processed page. This log will be read before any pages are crawled, so you can skip over pages that have already been processed. Empty history.log if you want to re-crawl those URLs.

The log info is contained `crawl.log`.

# Installation

Download this repository and then run the following in the project directory:

```
npm install
```

# Running the Webcrawler

Make a copy of the `.env.sample` file

```
$cp .env.sample .env
```

Edit the `.env` file for your environment.

Once you have configured the `.env` file, you can run the code:

```
node crawler.js
```

# Configuring Timeout

By default, the script will wait 5 seconds to find the configured XPATH element. After the timeout expires, it will move on to the next link. You can change this timeout value in `crawler.js`:

```
const pageTimeout = 5000;
```
