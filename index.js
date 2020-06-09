#!/usr/bin/env node
const { exec } = require("child_process");
const { Octokit } = require("@octokit/rest");
const fs = require("fs");

const YOUTUBE_DL_PATH = "/usr/bin/youtube-dl";
const YKDL_PATH = "/home/admin/.local/bin/ykdl";
const FFMPEG_PATH = "ffmpeg";
// Config
const GH_TOKEN = "TOKEN";
const BASEDIR = "/home/suisei/clips";
const WEBPAGE_ROOT = "https://suisei.outv.im/clips";
const TRUSTED_USERS = [];
const REPO_OWNER = "suisei-cn";
const REPO_NAME = "starbuttons";
const REPO_ISSUE_ID = 5;

const octokit = new Octokit({
  auth: GH_TOKEN,
});

function findAndReturnJSON(text) {
  try {
    return JSON.parse(
      text.replace(/[\n\r ]+```[\n\r ]+/g, "```").match(/```([\w\W]*)```/)[1]
    );
  } catch (e) {
    return {};
  }
}

function prettify(obj) {
  return JSON.stringify(obj, null, 4);
}

function generateSoundInfo(job, originInfo, filename) {
  return Object.assign(originInfo, {
    file: filename,
    metadata: {
      site: job.platform,
      identifier: job.id,
      time: {
        from: job.parsedFrom,
        to: job.parsedTo,
      },
    },
  });
}

async function getIssueAndDo(since = "2020-01-01T00:00:00Z") {
  console.log(`-- Round Started: ${new Date().toLocaleString()} --`);
  let list = await octokit.issues
    .listComments({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      issue_number: REPO_ISSUE_ID,
      since,
    })
    .then((x) => x.data)
    .catch((x) => {
      console.error("Fail to fetch issue data:", x);
      return [];
    });
  for (const i of list) {
    if (!TRUSTED_USERS.includes(i.user.login.toLowerCase())) continue;
    if (i.body.includes("!noclip")) continue;
    let cmdline = i.body.split("\n")[0];
    let query = cmdline.replace(/ +/g, " ").split(" ");
    let do_pr = i.body.includes(" pr ");
    if (query[0] !== "/clip") continue;
    let job = getJob({
      platform: query[1],
      id: query[2],
      fromtime: query[3],
      totime: query[4],
    });
    if (job === false) {
      continue;
    }
    let shell = undefined;
    let finalFilename = `${job.id}--${job.parsedFrom}--${job.parsedTo}.mp3`;
    if (job.platform === "youtube") {
      shell = await getYoutubeCase(
        job.id,
        job.parsedFrom,
        job.parsedTo,
        finalFilename
      ).catch((x) => {
        console.error("Error getting YouTube video:", x);
      });
    } else if (job.platform === "bilibili") {
      shell = await getBilibiliCase(
        job.id,
        job.parsedFrom,
        job.parsedTo,
        finalFilename
      ).catch((x) => {
        console.error("Error getting Bilibili video:", x);
      });
    }
    if (!shell) {
      continue;
    }
    let originalBody = i.body;
    const givenInfo = findAndReturnJSON(i.body);
    const finalObjStr = prettify(
      generateSoundInfo(job, givenInfo, finalFilename)
    );
    console.log("Gonna give:", finalObjStr);
    console.log("-----------------------------------------");
    let fsExists = fs.existsSync(BASEDIR + "/" + finalFilename);
    if (fsExists && !cmdline.includes("force")) {
      console.log("Already done:", job);
      createComment(
        `@${i.user.login}, your clip of ${job.platform}:${job.id} is ready at [here](${WEBPAGE_ROOT}/${finalFilename}).\n\n\`\`\`\n${finalObjStr}\n\`\`\``,
        do_pr
      );
      editAndMarkNoclip(i.id, originalBody);
      continue;
    }
    if (fsExists) {
      fs.unlinkSync(BASEDIR + "/" + finalFilename);
    }
    (async () => {
      editAndMarkNoclip(
        i.id,
        `${originalBody}\n\n---\n\nWe are working on it. Hold tight...`
      );
      exec(
        shell,
        {
          timeout: 3600000,
        },
        (error, stdout, stderr) => {
          console.log("STDERR", stderr, "STDOUT", stdout);
          if (error !== null) {
            console.log(`Task by @${i.user.login} has errors:`, error);
            createComment(
              `@${i.user.login}, your clip of ${job.platform}:${job.id} is failed. Error logs:\n\`\`\`\n${stderr}\`\`\``
            );
            editAndMarkNoclip(i.id, originalBody);
          } else {
            console.log(`Task by @${i.user.login} is finished.`);
            createComment(
              `@${i.user.login}, your clip of ${job.platform}:${job.id} is ready at [here](${WEBPAGE_ROOT}/${finalFilename}).\n\n\`\`\`\n${finalObjStr}\n\`\`\``,
              do_pr
            );
            editAndMarkNoclip(i.id, originalBody);
          }
          console.log("-----------------------------------------");
        }
      );
    })();
  }
  console.log(`-- Round Finished: ${new Date().toLocaleString()} --`);
}

function createComment(body, pr = false) {
  octokit.issues.createComment({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    issue_number: REPO_ISSUE_ID,
    body: body + (pr ? "\n/actions pr this" : ""),
  });
}

function editAndMarkNoclip(comment_id, body) {
  octokit.issues.updateComment({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    comment_id,
    body: body + "\n<!-- !noclip -->",
  });
}

async function getStdoutOf(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error !== null) {
        reject(error, stderr);
        return;
      }
      resolve(stdout);
    });
  });
}

async function probeYTAudioFormat(vid) {
  const out = await getStdoutOf(
    `${YOUTUBE_DL_PATH} -F "https://www.youtube.com/watch?v=${vid}"`
  );
  return out.search(/^251/m) !== -1 ? "webm" : "m4a";
}

async function getBilibiliCase(videoId, fromValue, toValue, filename) {
  let randstr = String(Math.random());
  return `${YKDL_PATH} https://www.bilibili.com/video/${videoId} -O ${randstr} &&
    ${FFMPEG_PATH} -i ${randstr}.flv \
-ss ${fromValue} \
-to ${toValue} \
-acodec libmp3lame \
-ab 192k \
-af loudnorm=I=-16:TP=-2:LRA=11 \
${BASEDIR}/${filename} && rm ${randstr}.flv`;
}

async function getYoutubeCase(videoId, fromValue, toValue, filename) {
  let format = await probeYTAudioFormat(videoId);
  let formatid = format === "webm" ? 251 : 140;
  console.log(`Finding ${formatid}:${format} for ${videoId}`);
  let fn = `${videoId}--${fromValue}--${toValue}`;
  return `${FFMPEG_PATH} -i $(${YOUTUBE_DL_PATH} -f ${formatid} -g "https://www.youtube.com/watch?v=${videoId}") \
-ss ${fromValue} \
-to ${toValue} \
-c copy \
interm-${fn}.${format} && \
${FFMPEG_PATH} -i interm-${fn}.${format} \
-acodec libmp3lame \
-ab 192k \
-af loudnorm=I=-16:TP=-2:LRA=11 \
${BASEDIR}/${filename} && \
rm interm-${fn}.${format}`;
}

function parseTime(str) {
  if (!isNaN(Number(str))) return Number(str);
  let time = str.match(/([0-9]?)?:([0-9]+)(\.([0-9]+))?/);
  if (time === null) return -1;
  let ret =
    Number(time[1] || 0) * 60 + Number(time[2]) + Number(time[4] || 0) * 0.1;
  if (isNaN(ret)) return -1;
  return ret;
}

function getJob(obj) {
  let platform = obj.platform;
  let id = obj.id;
  let fromtime = obj.fromtime;
  let totime = obj.totime;
  if (["youtube", "bilibili"].includes(platform) === false) return false;
  let parsedFrom = parseTime(fromtime);
  let parsedTo = parseTime(totime);
  if (parsedFrom === -1 || parsedTo === -1) return false;
  return {
    platform,
    id,
    parsedFrom,
    parsedTo,
  };
}

getIssueAndDo(new Date(new Date() - 12000000).toISOString());
