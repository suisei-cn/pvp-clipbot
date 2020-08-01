const { findAndReturnMeta } = require("./lib");
const { expect } = require("chai");

expect(
  findAndReturnMeta(`test
\`\`\`
{
    "name": "Today Sui-chan is still kawaii! (Lovely and quietly)",
    "name_l10n": {
      "zh": "彗酱今天也很卡哇伊～！（奶声奶气）",
      "ja": "すいちゃんは、今日もかわいい〜！（愛らしい、ひそやかに）"
    }
}
\`\`\``)
).to.deep.equal({
  name: "Today Sui-chan is still kawaii! (Lovely and quietly)",
  name_l10n: {
    zh: "彗酱今天也很卡哇伊～！（奶声奶气）",
    ja: "すいちゃんは、今日もかわいい〜！（愛らしい、ひそやかに）",
  },
});

expect(
  findAndReturnMeta(`test fjafle
\`\`\`
name: Today Sui-chan is still kawaii! (Lovely and quietly)
name_l10n:
  zh: 彗酱今天也很卡哇伊～！（奶声奶气）
  ja: すいちゃんは、今日もかわいい〜！（愛らしい、ひそやかに）
\`\`\``)
).to.deep.equal({
  name: "Today Sui-chan is still kawaii! (Lovely and quietly)",
  name_l10n: {
    zh: "彗酱今天也很卡哇伊～！（奶声奶气）",
    ja: "すいちゃんは、今日もかわいい〜！（愛らしい、ひそやかに）",
  },
});

expect(
  findAndReturnMeta(`
/clip youtube mXOF0_qy8vI 2986 2988.36 this pr is a test of new workflow

\`\`\` yaml
name: Chuu... will never happen! (angry)
name_l10n:
      zh: "啾⋯⋯ 怎么可能呢! (怒)"
      ja: "ちゅうしてするをけ無いだろう！(怒)"
\`\`\`
`)
).to.deep.equal({
  name: "Chuu... will never happen! (angry)",
  name_l10n: {
    zh: "啾⋯⋯ 怎么可能呢! (怒)",
    ja: "ちゅうしてするをけ無いだろう！(怒)",
  },
});
