import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import winston from "winston";

puppeteer.use(StealthPlugin());

const BASE_URL = "https://www.instagram.com";
const TAG_URL = (tag) => `https://www.instagram.com/explore/tags/${tag}/`;
const USER_URL = (username) => `https://www.instagram.com/${username}/`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const FIVE_MINUTES = 300000;
const TEN_MINUTES = 600000;
const TEN_HOURS = 36000000;

export class Instagram {
  constructor(botName = "testBot") {
    this.browser = null;
    this.page = null;
    this.totalLike = 0;
    this.totalSubs = 0;
    this.totalStory = 0;
    this.logger = winston.createLogger({
      level: "info",
      format: winston.format.json(),
      defaultMeta: { service: "bot-service" },
      transports: [
        new winston.transports.File({
          filename: `./${botName}/${new Date().toISOString()}-info.log`,
          level: "error",
        }),
        new winston.transports.File({
          filename: `./${botName}/${new Date().toISOString()}-info.log`,
        }),
      ],
    });
  }

  // PRIVATE //

  async handlePopup() {
    const dialogContainer = await this.page.$('div[role="dialog"]');

    if (dialogContainer) {
      await this.page.click('div[role="dialog"] button');
    }
  }

  async gotoUserPageAndFollow(username) {
    await this.page.goto(USER_URL(username), { waitUntil: "networkidle2" });
    await sleep(1000);
    await this.handlePopup();

    const followButton = await this.page.$("section button");

    if (followButton) {
      const followButtonText = await (
        await followButton.getProperty("textContent")
      ).jsonValue();

      if (followButtonText === "Follow") {
        await followButton.click();
        return true;
      }
    }

    return false;
  }

  // PUBLIC //

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: true,
    });
    this.page = await this.browser.newPage();

    await this.page.setViewport({ width: 1280, height: 720 });

    this.logger.info("Bot initialized");
  }

  async login(username, password) {
    await this.page.goto(BASE_URL, { waitUntil: "networkidle2" });
    await sleep(1000);

    const loginButton = await this.page.$x(
      '//*[@id="loginForm"]/div/div[3]/button'
    );

    await this.page.type('input[name="username"]', username, { delay: 50 });
    await this.page.type('input[name="password"]', password, { delay: 50 });

    await loginButton[0].click();

    await this.page.waitForSelector('svg[aria-label="Search"]', {
      timeout: 10000,
    });

    this.logger.info("Bot Logged In");
  }

  async searchByHashtagAndLike(hashtag, amount = 3) {
    await this.page.goto(TAG_URL(hashtag), { waitUntil: "networkidle2" });
    await sleep(3000);
    await this.handlePopup();

    const images = await this.page.$$("article > div > div:nth-child(2) img");
    let likedImages = 0;

    for (const image of images) {
      if (likedImages >= amount) {
        break;
      }

      await image.click();
      await sleep(2000);

      const isLikable = await this.page.$('svg[aria-label="Like"]');

      if (isLikable) {
        await this.page.click('svg[aria-label="Like"]');
        likedImages++;
        this.totalLike++;
      }

      this.logger.info("Bot liked " + this.totalLike + " posts");

      await sleep(1000);

      await this.page.click('svg[aria-label="Close"]');
      await sleep(3528);
    }
  }

  async searchByHashtagAndSub(hashtag, amount = 3) {
    await this.page.goto(BASE_URL, { waitUntil: "networkidle2" });
    await sleep(1000);
    await this.handlePopup();

    await this.page.waitForSelector('svg[aria-label="Search"]', {
      timeout: 10000,
    });

    await this.page.click('svg[aria-label="Search"]');
    await this.page.type('input[placeholder="Search"]', hashtag, { delay: 87 });
    await sleep(5000);

    const usernameNodes = await this.page.$$(
      'span[style="line-height: var(--base-line-clamp-line-height); --base-line-clamp-line-height: 18px;"]'
    );

    const usernames = await Promise.all(
      usernameNodes.map(async (node) => {
        const username = await (
          await node.getProperty("textContent")
        ).jsonValue();
        return username;
      })
    );

    const filteredUsernames = usernames.filter(
      (u) => typeof u === "string" && !u.includes(" ")
    );

    let currentSubs = 0;

    for (const username of filteredUsernames) {
      if (currentSubs >= amount) {
        break;
      }

      if (username.startsWith("#")) {
        continue;
      }

      const didFollow = await this.gotoUserPageAndFollow(username);

      if (didFollow) {
        this.totalSubs++;
        currentSubs++;
      }

      this.logger.info("Bot followed " + this.totalSubs + " users");

      await sleep(3954);
    }
  }

  async runBot({
    username,
    password,
    maxLikesPerDay,
    maxSubsPerDay,
    maxStoriesPerDay,
    hashtags,
    proxy,
  }) {
    await this.initialize();
    await this.login(username, password);

    while (true) {
      if (
        this.totalLike >= maxLikesPerDay &&
        this.totalSubs >= maxSubsPerDay &&
        this.totalStory >= maxStoriesPerDay
      ) {
        this.logger.info("Bot finished for today");
        await sleep(TEN_HOURS);
        this.totalLike = 0;
        this.totalStory = 0;
        this.totalSubs = 0;
      }

      const randomHashtag =
        hashtags[Math.floor(Math.random() * hashtags.length)];

      await this.searchByHashtagAndLike(randomHashtag);
      await sleep(FIVE_MINUTES);
      await this.searchByHashtagAndSub(randomHashtag);
      await sleep(TEN_MINUTES);
    }
  }
}
