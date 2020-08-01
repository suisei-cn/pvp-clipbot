import { setConfig, getIssueAndDo } from "./lib";

setConfig({
  YOUTUBE_DL_PATH: "/usr/bin/youtube-dl",
  YKDL_PATH: "/home/admin/.local/bin/ykdl",
  FFMPEG_PATH: "ffmpeg",
  GH_TOKEN: "TOKEN",
  BASEDIR: "/home/suisei/clips",
  WEBPAGE_ROOT: "https://suisei.outv.im/clips",
  TRUSTED_USERS: [],
  REPO_OWNER: "suisei-cn",
  REPO_NAME: "starbuttons",
  REPO_ISSUE_ID: 5,
});

getIssueAndDo(new Date(new Date() - 12000000).toISOString());
