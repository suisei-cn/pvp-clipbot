#!/usr/bin/env node
const { exec } = require("child_process");
const { Octokit } = require("@octokit/rest");
const fs = require("fs");
const yaml = require("js-yaml");
const unified = require("unified");
const markdown = require("remark-parse");
const processor = unified().use(markdown, { gfm: true });

let globalConfig = {
  YOUTUBE_DL_PATH: "/usr/bin/youtube-dl",
  YKDL_PATH: "/usr/bin/ykdl",
  FFMPEG_PATH: "/usr/bin/ffmpeg",
  GH_TOKEN: "TOKEN",
  BASEDIR: "/home/user/clips",
  WEBPAGE_ROOT: "http://localhost/clips",
  TRUSTED_USERS: [],
  REPO_OWNER: "org",
  REPO_NAME: "repo",
  REPO_ISSUE_ID: 1,
};

let octokit = new Octokit({
  auth: "",
});

function getFirstCodeBlockText(md) {
  try {
    const blk = processor.parse(md);
    return blk.children.filter((x) => x.type === "code")[0].value;
  } catch (_) {
    return "";
  }
}

function findAndReturnMeta(text) {
  const data = getFirstCodeBlockText(text);
  try {
    return JSON.parse(data);
  } catch (_) {
    //
  }
  try {
    return yaml.safeLoad(data);
  } catch (_) {
    //
  }
  return {};
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
      owner: globalConfig.REPO_OWNER,
      repo: globalConfig.REPO_NAME,
      issue_number: globalConfig.REPO_ISSUE_ID,
      since,
    })
    .then((x) => x.data)
    .catch((x) => {
      console.error("Fail to fetch issue data:", x);
      return [];
    });
  for (const i of list) {
    if (!globalConfig.TRUSTED_USERS.includes(i.user.login.toLowerCase()))
      continue;
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
    const givenInfo = findAndReturnMeta(i.body);
    const finalObjStr = prettify(
      generateSoundInfo(job, givenInfo, finalFilename)
    );
    console.log("Gonna give:", finalObjStr);
    console.log("-----------------------------------------");
    let fsExists = fs.existsSync(globalConfig.BASEDIR + "/" + finalFilename);
    if (fsExists && !cmdline.includes("force")) {
      console.log("Already done:", job);
      createComment(
        `@${i.user.login}, your clip of ${job.platform}:${job.id} is ready at [here](${globalConfig.WEBPAGE_ROOT}/${finalFilename}).\n\n\`\`\`\n${finalObjStr}\n\`\`\``,
        do_pr
      );
      editAndMarkNoclip(i.id, originalBody);
      continue;
    }
    if (fsExists) {
      fs.unlinkSync(globalConfig.BASEDIR + "/" + finalFilename);
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
              `@${i.user.login}, your clip of ${job.platform}:${job.id} is ready at [here](${globalConfig.WEBPAGE_ROOT}/${finalFilename}).\n\n\`\`\`\n${finalObjStr}\n\`\`\``,
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
    owner: globalConfig.REPO_OWNER,
    repo: globalConfig.REPO_NAME,
    issue_number: globalConfig.REPO_ISSUE_ID,
    body: body + (pr ? "\n/actions pr this" : ""),
  });
}

function editAndMarkNoclip(comment_id, body) {
  octokit.issues.updateComment({
    owner: globalConfig.REPO_OWNER,
    repo: globalConfig.REPO_NAME,
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
    `${globalConfig.YOUTUBE_DL_PATH} -F "https://www.youtube.com/watch?v=${vid}"`
  );
  return out.search(/^251/m) !== -1 ? "webm" : "m4a";
}

async function getBilibiliCase(videoId, fromValue, toValue, filename) {
  let randstr = String(Math.random());
  return `${globalConfig.YKDL_PATH} https://www.bilibili.com/video/${videoId} -O ${randstr} &&
    ${globalConfig.FFMPEG_PATH} -i ${randstr}.flv \
-ss ${fromValue} \
-to ${toValue} \
-acodec libmp3lame \
-ab 192k \
-af loudnorm=I=-16:TP=-2:LRA=11 \
${globalConfig.BASEDIR}/${filename} && rm ${randstr}.flv`;
}

async function getYoutubeCase(videoId, fromValue, toValue, filename) {
  let format = await probeYTAudioFormat(videoId);
  let formatid = format === "webm" ? 251 : 140;
  console.log(`Finding ${formatid}:${format} for ${videoId}`);
  let fn = `${videoId}--${fromValue}--${toValue}`;
  return `${globalConfig.FFMPEG_PATH} -i $(${globalConfig.YOUTUBE_DL_PATH} -f ${formatid} -g "https://www.youtube.com/watch?v=${videoId}") \
-ss ${fromValue} \
-to ${toValue} \
-c copy \
interm-${fn}.${format} && \
${globalConfig.FFMPEG_PATH} -i interm-${fn}.${format} \
-acodec libmp3lame \
-ab 192k \
-af loudnorm=I=-16:TP=-2:LRA=11 \
${globalConfig.BASEDIR}/${filename} && \
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

function setConfig(obj) {
  globalConfig = Object.assign(globalConfig, obj);
  console.info("Config set to:", globalConfig);
  octokit = new Octokit({
    auth: globalConfig.GH_TOKEN,
  });
}

module.exports = {
  setConfig,
  getIssueAndDo,
  findAndReturnMeta,
};
