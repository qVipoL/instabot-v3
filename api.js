import express from "express";
import { Worker } from "worker_threads";

const app = express();
const port = 5987;
const activeThreads = {};

app.use(express.json());

app.post("/bot/start", (req, res) => {
  const {
    username,
    password,
    proxy,
    max_likes_day,
    max_follows_day,
    max_stories_day,
    min_time_between_cycles_secs,
    max_time_between_cycles_secs,
    min_time_between_actions_secs,
    max_time_between_actions_secs,
    posts_hashtag_list,
    follow_hashtag_list,
    stories_hashtag_list,
  } = req.body;

  if (activeThreads[username]) {
    activeThreads[username].terminate();
    delete activeThreads[username];
  }

  const worker = new Worker("./worker.js", {
    workerData: {
      username,
      password,
      maxLikesPerDay: max_likes_day,
      maxSubsPerDay: max_follows_day,
      maxStoriesPerDay: max_stories_day,
      hashtags: posts_hashtag_list,
      proxy,
    },
  });

  worker.on("error", (err) => {
    console.error(`Bot for ${username} encountered an error: ${err.message}`);
  });

  worker.on("exit", (code) => {
    console.log(`Bot for ${username} has exited with code ${code}`);
    delete activeThreads[username];
  });

  activeThreads[username] = worker;

  return res.status(200).json({
    message: "Bot started!",
    total_bots: Object.keys(activeThreads).length,
  });
});

app.get("/bot/:username", (req, res) => {
  const { username } = req.params;

  if (activeThreads[username] && activeThreads[username].isRunning()) {
    return res.status(200).json({
      bot_status: "ACTIVE",
    });
  }

  return res.status(200).json({
    bot_status: "STOPPED",
  });
});

app.post("/bot/stop/:username", (req, res) => {
  const { username } = req.params;

  const worker = activeThreads[username];

  if (worker) {
    worker.terminate();
    delete activeThreads[username];
  }

  return res.status(200).json({
    message: "Bot stopped!",
    total_bots: Object.keys(activeThreads).length,
  });
});

app.listen(port, () => {
  console.log(`Bot API listening at http://localhost:${port}`);
});
