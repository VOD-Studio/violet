// 颜文字数据 - Bilibili 风格分类

export interface KaomojiItem {
  shortcode: string;
  text: string;
  name: string;
}

export interface KaomojiCategory {
  name: string;
  slug: string;
  kaomojis: KaomojiItem[];
}

export const kaomojiCategories: KaomojiCategory[] = [
  {
    name: "开心",
    slug: "happy",
    kaomojis: [
      { shortcode: "kaomoji_happy", text: "(ﾟ∀ﾟ)", name: "开心" },
      { shortcode: "kaomoji_excited", text: "(≧▽≦)", name: "兴奋" },
      { shortcode: "kaomoji_joy", text: "(≧◡≦)", name: "快乐" },
      { shortcode: "kaomoji_cheer", text: "(✧ω✧)", name: "欢呼" },
      { shortcode: "kaomoji_laugh", text: "(≧ω≦)", name: "大笑" },
      { shortcode: "kaomoji_giggle", text: "(o゜▽゜)o☆", name: "咯咯笑" },
      { shortcode: "kaomoji_yay", text: "٩(๑>◡<๑)۶", name: "耶" },
      { shortcode: "kaomoji_party", text: "٩(๑❛ᴗ❛๑)۶", name: "庆祝" },
      { shortcode: "kaomoji_yes", text: "(๑•̀ㅂ•́)و✧", name: "好耶" },
      { shortcode: "kaomoji_wow", text: "(ﾟдﾟ)", name: "哇" },
    ],
  },
  {
    name: "可爱",
    slug: "cute",
    kaomojis: [
      { shortcode: "kaomoji_cute", text: "(｡◕‿◕｡)", name: "可爱" },
      { shortcode: "kaomoji_lovely", text: "(◕‿◕✿)", name: "可爱花" },
      { shortcode: "kaomoji_blush", text: "(✿◡‿◡)", name: "害羞" },
      { shortcode: "kaomoji_sweet", text: "(◕ᴗ◕✿)", name: "甜蜜" },
      { shortcode: "kaomoji_angel", text: "(◠‿◠✿)", name: "天使" },
      { shortcode: "kaomoji_flower", text: "(✿╹◡╹)", name: "花仙子" },
      { shortcode: "kaomoji_heart", text: "(♡ω♡)", name: "爱心" },
      { shortcode: "kaomoji_love", text: "(๑♡⌓♡๑)", name: "喜欢" },
      { shortcode: "kaomoji_kiss", text: "( ˘ ³˘)♥", name: "亲亲" },
      { shortcode: "kaomoji_cat", text: "(=^･ω･^=)", name: "猫猫" },
    ],
  },
  {
    name: "难过",
    slug: "sad",
    kaomojis: [
      { shortcode: "kaomoji_sad", text: "(╥﹏╥)", name: "难过" },
      { shortcode: "kaomoji_cry", text: "(´；ω；`)", name: "哭泣" },
      { shortcode: "kaomoji_sob", text: "(；´Д`)", name: "大哭" },
      { shortcode: "kaomoji_tears", text: "(T＿T)", name: "流泪" },
      { shortcode: "kaomoji_heartbreak", text: "(´༎ຶ༎ຶ)", name: "心碎" },
      { shortcode: "kaomoji_sorrow", text: "(´д｀)", name: "悲伤" },
      { shortcode: "kaomoji_despair", text: "(；ω；)", name: "绝望" },
      { shortcode: "kaomoji_lonely", text: "(´・ω・`)", name: "孤单" },
      { shortcode: "kaomoji_disappointed", text: "(´・ω・)σ", name: "失望" },
      { shortcode: "kaomoji_miss", text: "(´∀｀)σ", name: "想念" },
    ],
  },
  {
    name: "惊讶",
    slug: "surprised",
    kaomojis: [
      { shortcode: "kaomoji_surprise", text: "(ﾟДﾟ)", name: "惊讶" },
      { shortcode: "kaomoji_shocked", text: "(ﾟДﾟ≡ﾟДﾟ)", name: "震惊" },
      { shortcode: "kaomoji_wow", text: "(°o°)", name: "哇" },
      { shortcode: "kaomoji_what", text: "( WHAT? )", name: "什么" },
      { shortcode: "kaomoji_omg", text: "(⊙_⊙)", name: "天哪" },
      { shortcode: "kaomoji_stare", text: "( O_O)", name: "瞪眼" },
      { shortcode: "kaomoji_blink", text: "(◎_◎)", name: "眨眼" },
      { shortcode: "kaomoji_question", text: "(？o？)", name: "疑问" },
      { shortcode: "kaomoji_confused", text: "(゜-゜)", name: "困惑" },
      { shortcode: "kaomoji_dizzy", text: "(×_×;）", name: "晕" },
    ],
  },
  {
    name: "无奈",
    slug: "helpless",
    kaomojis: [
      { shortcode: "kaomoji_sigh", text: "(´_ゝ`)", name: "叹气" },
      { shortcode: "kaomoji_shrug", text: "╮(╯_╰)╭", name: "摊手" },
      { shortcode: "kaomoji_facepalm", text: "(－_－)", name: "无语" },
      { shortcode: "kaomoji_tired", text: "(ー_ー)!!", name: "疲惫" },
      { shortcode: "kaomoji_bored", text: "(ーー゛)", name: "无聊" },
      { shortcode: "kaomoji_done", text: "(>_>)", name: "算了" },
      { shortcode: "kaomoji_whatever", text: "ε=ε=ε=(┌○_○)┘", name: "无所谓" },
      { shortcode: "kaomoji_giveup", text: "(´∀｀*)", name: "放弃" },
    ],
  },
  {
    name: "愤怒",
    slug: "angry",
    kaomojis: [
      { shortcode: "kaomoji_angry", text: "(╬ Ò﹏Ó)", name: "生气" },
      { shortcode: "kaomoji_rage", text: "(╬ﾟДﾟ)", name: "暴怒" },
      { shortcode: "kaomoji_furious", text: "ヽ(｀Д´)ﾉ", name: "愤怒" },
      { shortcode: "kaomoji_mad", text: "(｀Д´)", name: "抓狂" },
      { shortcode: "kaomoji_grumpy", text: "(｀ε´)", name: "不满" },
      { shortcode: "kaomoji_annoyed", text: "(－ω－)", name: "烦躁" },
      { shortcode: "kaomoji_fight", text: "o(￣ヘ￣o＃)", name: "打架" },
      { shortcode: "kaomoji_no", text: "(O_O)(", name: "不行" },
    ],
  },
  {
    name: "得意",
    slug: "smug",
    kaomojis: [
      { shortcode: "kaomoji_smug", text: "(￣▽￣)", name: "得意" },
      { shortcode: "kaomoji_proud", text: "(￣ω￣)", name: "自豪" },
      { shortcode: "kaomoji_cool", text: "(￣ー￣)", name: "酷" },
      { shortcode: "kaomoji_confident", text: "( •̀ω•́ )✧", name: "自信" },
      { shortcode: "kaomoji_win", text: "(๑˃̵ᴗ˂̵)و", name: "胜利" },
      { shortcode: "kaomoji_yeah", text: "(✧ㅂ✧)", name: "耶" },
      { shortcode: "kaomoji_showoff", text: "ψ(｀∇´)ψ", name: "炫耀" },
      { shortcode: "kaomoji_mine", text: "(๑˙❥˙๑)", name: "我的" },
    ],
  },
  {
    name: "道歉",
    slug: "apology",
    kaomojis: [
      { shortcode: "kaomoji_sorry", text: "(´；ω；`)", name: "对不起" },
      { shortcode: "kaomoji_apologize", text: "(。・ω・。)", name: "道歉" },
      { shortcode: "kaomoji_beg", text: "(人 •͈ᴗ•͈)", name: "求求" },
      { shortcode: "kaomoji_plz", text: "(人ω・*)", name: "拜托" },
      { shortcode: "kaomoji_please", text: "( ﾟдﾟ)", name: "请" },
      { shortcode: "kaomoji_bow", text: "(。・ω・)ノ゙", name: "鞠躬" },
      { shortcode: "kaomoji_gomen", text: "(´・ω・)gan", name: "抱歉" },
    ],
  },
  {
    name: "动物",
    slug: "animals",
    kaomojis: [
      { shortcode: "kaomoji_cat_face", text: "(=^･ω･^=)", name: "猫脸" },
      { shortcode: "kaomoji_cat_sleep", text: "(=｀ω´=)", name: "猫睡" },
      { shortcode: "kaomoji_cat_happy", text: "(=①ω①=)", name: "猫开心" },
      { shortcode: "kaomoji_dog", text: "(U・ω・)", name: "狗" },
      { shortcode: "kaomoji_dog_happy", text: "(U・x・U)", name: "狗开心" },
      { shortcode: "kaomoji_bunny", text: "(・ω・)", name: "兔子" },
      { shortcode: "kaomoji_bunny_hop", text: "(o・ω・o)", name: "兔跳" },
      { shortcode: "kaomoji_pig", text: "(￣(工)￣)", name: "猪" },
      { shortcode: "kaomoji_fish", text: "∮(・⊝・)∫", name: "鱼" },
      { shortcode: "kaomoji_bird", text: "(ˆ▽ˆ)", name: "鸟" },
    ],
  },
  {
    name: "动作",
    slug: "actions",
    kaomojis: [
      { shortcode: "kaomoji_run", text: "ε=ε=ε=┌( >_<)┘", name: "逃跑" },
      { shortcode: "kaomoji_jump", text: "ヾ(≧▽≦*)o", name: "跳跃" },
      { shortcode: "kaomoji_wave", text: "( ﾟ∀ﾟ)ﾉ", name: "挥手" },
      { shortcode: "kaomoji_clap", text: "(ノ´▽`)ノ♪", name: "鼓掌" },
      { shortcode: "kaomoji_cheer2", text: "ヾ(≧▽≦*)ゝ", name: "欢呼" },
      { shortcode: "kaomoji_thumbs", text: "(b^_^)b", name: "点赞" },
      { shortcode: "kaomoji_ok", text: "(✪ω✪)", name: "OK" },
      { shortcode: "kaomoji_punch", text: "(o_ _)ﾉ彡☆", name: "击拳" },
      { shortcode: "kaomoji_pat", text: "(・ω・)ノ", name: "摸摸" },
      { shortcode: "kaomoji_hug", text: "(づ￣ ³￣)づ", name: "抱抱" },
    ],
  },
];

// 快捷映射：shortcode -> text
export const kaomojiMap: Record<string, string> = {};
kaomojiCategories.forEach((cat) => {
  cat.kaomojis.forEach((kaomoji) => {
    kaomojiMap[kaomoji.shortcode] = kaomoji.text;
  });
});

// 获取所有颜文字列表（用于搜索）
export const allKaomojis: KaomojiItem[] = kaomojiCategories.flatMap(
  (cat) => cat.kaomojis,
);
