# pvp-clipbot
Monitor issue comments and clip the audio.

## Usage

`npm install` first. Then update the config in `main.js`:

``` js
setConfig({
  YOUTUBE_DL_PATH: "/usr/bin/youtube-dl",        # youtube-dl path (for YouTube)
  YKDL_PATH: "/home/admin/.local/bin/ykdl",      # ykdl path (for Bilibili)
  FFMPEG_PATH: "ffmpeg",                         # ffmpeg path
  GH_TOKEN: "TOKEN",                             # Personal access token
  BASEDIR: "/home/suisei/clips",                 # Clip destination directory
  WEBPAGE_ROOT: "https://suisei.outv.im/clips",  # Public URL of BASEDIR
  TRUSTED_USERS: [],                             # Allowed user list (username in all lowercase)
  REPO_OWNER: "suisei-cn",                       # Issue user/organization name
  REPO_NAME: "starbuttons",                      # Issue repository name
  REPO_ISSUE_ID: 5,                              # Issue number
});
```

Also tweak this in `main.js` if you want to change the filter settings:

``` js
# Ignore comments older than 200 minutes (200 * 60 * 1000 = 12,000,000 ms)
getIssueAndDo(new Date(new Date() - 12000000).toISOString());
```

Then run this periodically (e.g. put it in `crontab`).

## License
MIT
