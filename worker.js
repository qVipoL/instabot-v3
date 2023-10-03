import { parentPort, workerData } from "worker_threads";
import { Instagram } from "./instagram.js";

const {
  username,
  password,
  maxLikesPerDay,
  maxSubsPerDay,
  maxStoriesPerDay,
  hashtags,
  proxy,
} = workerData;

(async () => {
  const ig = new Instagram(username);
  await ig.runBot({
    username,
    password,
    maxLikesPerDay,
    maxSubsPerDay,
    maxStoriesPerDay,
    hashtags,
    proxy,
  });
})();
