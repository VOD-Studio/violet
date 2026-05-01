package service

import (
	"bytes"
	"regexp"
	"strings"

	"github.com/yuin/goldmark"

	"blog-api/internal/repository/generated"
)

// Emoji shortcode 到 Unicode 的映射
var emojiMap = map[string]string{
	// 笑脸
	"smile":      "😄",
	"grin":       "😀",
	"laugh":      "😂",
	"rofl":       "🤣",
	"wink":       "😉",
	"blush":      "😊",
	"heart_eyes": "😍",
	"star_eyes":  "🥰",
	"kiss":       "😘",
	"happy_cry":  "🥲",
	"savor":      "😋",
	"tongue":     "😜",
	"crazy":      "🤪",
	"innocent":   "😇",
	// 悲伤
	"sad":           "😢",
	"cry":           "😭",
	"sob":           "😭",
	"disappointed":  "😞",
	"tired":         "😩",
	"weary":         "😩",
	"pleading":      "🥺",
	"broken_heart":  "💔",
	// 愤怒
	"angry":         "😠",
	"rage":          "😡",
	"curse":         "🤬",
	"no_good":       "🙅",
	"middle_finger": "🖕",
	// 惊讶
	"surprise":       "😲",
	"shocked":        "😱",
	"flushed":        "😳",
	"dizzy":          "😵",
	"exploding_head": "🤯",
	"cold_face":      "🥶",
	"hot_face":       "🥵",
	// 思考
	"thinking":       "🤔",
	"confused":       "😕",
	"hmm":            "🤨",
	"neutral":        "😐",
	"expressionless": "😑",
	"eyeroll":        "🙄",
	"zip_mouth":      "🤐",
	// 动作
	"clap":        "👏",
	"thumbs_up":   "👍",
	"thumbs_down": "👎",
	"fist":        "👊",
	"handshake":   "🤝",
	"ok":          "👌",
	"pray":        "🙏",
	"write":       "✍",
	"strong":      "💪",
	// 动物
	"cat":     "🐱",
	"dog":     "🐶",
	"mouse":   "🐭",
	"hamster": "🐹",
	"rabbit":  "🐰",
	"fox":     "🦊",
	"bear":    "🐻",
	"panda":   "🐼",
	"koala":   "🐨",
	"lion":    "🦁",
	"pig":     "🐷",
	"cow":     "🐮",
	"monkey":  "🐒",
	"chicken": "🐔",
	// 食物
	"watermelon":  "🍉",
	"apple":       "🍎",
	"banana":      "🍌",
	"grapes":      "🍇",
	"strawberry":  "🍓",
	"pizza":       "🍕",
	"burger":      "汉堡",
	"noodles":     "🍜",
	"rice":        "🍚",
	"bento":       "🍱",
	"coffee":      "☕",
	"tea":         "🍵",
	"beer":        "🍺",
	"cake":        "🎂",
	// 符号
	"heart":        "❤",
	"orange_heart": "🧡",
	"yellow_heart": "💛",
	"green_heart":  "💚",
	"blue_heart":   "💙",
	"purple_heart": "💜",
	"black_heart":  "🖤",
	"sparkles":     "✨",
	"star":         "⭐",
	"fire":         "🔥",
	"lightning":    "⚡",
	"check":        "✅",
	"cross":        "❌",
	"question":     "❓",
	"exclamation":  "❗",
}

// 颜文字 shortcode 到文本的映射
var kaomojiMap = map[string]string{
	// 开心
	"kaomoji_happy":    "(ﾟ∀ﾟ)",
	"kaomoji_excited":  "(≧▽≦)",
	"kaomoji_joy":      "(≧◡≦)",
	"kaomoji_cheer":    "(✧ω✧)",
	"kaomoji_laugh":    "(≧ω≦)",
	"kaomoji_giggle":   "(o゜▽゜)o☆",
	"kaomoji_yay":      "٩(๑>◡<๑)۶",
	"kaomoji_party":    "٩(๑❛ᴗ❛๑)۶",
	"kaomoji_yes":      "(๑•̀ㅂ•́)و✧",
	"kaomoji_wow":      "(ﾟдﾟ)",
	// 可爱
	"kaomoji_cute":     "(｡◕‿◕｡)",
	"kaomoji_lovely":   "(◕‿◕✿)",
	"kaomoji_blush":    "(✿◡‿◡)",
	"kaomoji_sweet":    "(◕ᴗ◕✿)",
	"kaomoji_angel":    "(◠‿◠✿)",
	"kaomoji_flower":   "(✿╹◡╹)",
	"kaomoji_heart":    "(♡ω♡)",
	"kaomoji_love":     "(๑♡⌓♡๑)",
	"kaomoji_kiss":     "( ˘ ³˘)♥",
	"kaomoji_cat":      "(=^･ω･^=)",
	// 难过
	"kaomoji_sad":          "(╥﹏╥)",
	"kaomoji_cry":          "(´；ω；`)",
	"kaomoji_sob":          "(；´Д`)",
	"kaomoji_tears":        "(T＿T)",
	"kaomoji_heartbreak":   "(´༎ຶ༎ຶ)",
	"kaomoji_sorrow":       "(´д｀)",
	"kaomoji_despair":      "(；ω；)",
	"kaomoji_lonely":       "(´・ω・`)",
	"kaomoji_disappointed": "(´・ω・)σ",
	"kaomoji_miss":         "(´∀｀)σ",
	// 惊讶
	"kaomoji_surprise":  "(ﾟДﾟ)",
	"kaomoji_shocked":   "(ﾟДﾟ≡ﾟДﾟ)",
	"kaomoji_wow2":      "(°o°)",
	"kaomoji_what":      "( WHAT? )",
	"kaomoji_omg":       "(⊙_⊙)",
	"kaomoji_stare":     "( O_O)",
	"kaomoji_blink":     "(◎_◎)",
	"kaomoji_question":  "(？o？)",
	"kaomoji_confused":  "(゜-゜)",
	"kaomoji_dizzy":     "(×_×;）",
	// 无奈
	"kaomoji_sigh":      "(´_ゝ`)",
	"kaomoji_shrug":     "╮(╯_╰)╭",
	"kaomoji_facepalm":  "(－_－)",
	"kaomoji_tired2":    "(ー_ー)!!",
	"kaomoji_bored":     "(ーー゛)",
	"kaomoji_done":      "(>_>)",
	"kaomoji_whatever":  "ε=ε=ε=(┌○_○)┘",
	"kaomoji_giveup":    "(´∀｀*)",
	// 愤怒
	"kaomoji_angry":    "(╬ Ò﹏Ó)",
	"kaomoji_rage":     "(╬ﾟДﾟ)",
	"kaomoji_furious":  "ヽ(｀Д´)ﾉ",
	"kaomoji_mad":      "(｀Д´)",
	"kaomoji_grumpy":   "(｀ε´)",
	"kaomoji_annoyed":  "(－ω－)",
	"kaomoji_fight":    "o(￣ヘ￣o＃)",
	"kaomoji_no":       "(O_O)(", // 这个颜文字在原文有问题，简化处理
	// 得意
	"kaomoji_smug":       "(￣▽￣)",
	"kaomoji_proud":      "(￣ω￣)",
	"kaomoji_cool":       "(￣ー￣)",
	"kaomoji_confident":  "( •̀ω•́ )✧",
	"kaomoji_win":        "(๑˃̵ᴗ˂̵)و",
	"kaomoji_yeah":       "(✧ㅂ✧)",
	"kaomoji_showoff":    "ψ(｀∇´)ψ",
	"kaomoji_mine":       "(๑˙❥˙๑)",
	// 道歉
	"kaomoji_sorry":     "(´；ω；`)",
	"kaomoji_apologize": "(。・ω・。)",
	"kaomoji_beg":       "(人 •͈ᴗ•͈)",
	"kaomoji_plz":       "(人ω・*)",
	"kaomoji_please":    "( ﾟдﾟ)",
	"kaomoji_bow":       "(。・ω・)ノ゙",
	"kaomoji_gomen":     "(´・ω・)gan",
	// 动物
	"kaomoji_cat_face":   "(=^･ω･^=)",
	"kaomoji_cat_sleep":  "(=｀ω´=)",
	"kaomoji_cat_happy":  "(=①ω①=)",
	"kaomoji_dog":        "(U・ω・)",
	"kaomoji_dog_happy":  "(U・x・U)",
	"kaomoji_bunny":      "(・ω・)",
	"kaomoji_bunny_hop":  "(o・ω・o)",
	"kaomoji_pig":        "(￣(工)￣)",
	"kaomoji_fish":       "∮(・⊝・)∫",
	"kaomoji_bird":       "(ˆ▽ˆ)",
	// 动作
	"kaomoji_run":    "ε=ε=ε=┌( >_<)┘",
	"kaomoji_jump":   "ヾ(≧▽≦*)o",
	"kaomoji_wave":   "( ﾟ∀ﾟ)ﾉ",
	"kaomoji_clap2":  "(ノ´▽`)ノ♪",
	"kaomoji_cheer2": "ヾ(≧▽≦*)ゝ",
	"kaomoji_thumbs": "(b^_^)b",
	"kaomoji_ok2":    "(✪ω✪)",
	"kaomoji_punch":  "(o_ _)ﾉ彡☆",
	"kaomoji_pat":    "(・ω・)ノ",
	"kaomoji_hug":    "(づ￣ ³￣)づ",
}

// StickerCache 表情包缓存接口
type StickerCache interface {
	Get(groupSlug, stickerSlug string) *StickerInfo
}

// StickerInfo 表情包信息
type StickerInfo struct {
	ImageURL string
	Name     string
	Width    int16
	Height   int16
}

// ExtendedMarkdownRenderer 扩展的 Markdown 渲染器
type ExtendedMarkdownRenderer struct {
	markdown      goldmark.Markdown
	stickerCache  StickerCache
	emojiRegex    *regexp.Regexp
	kaomojiRegex  *regexp.Regexp
	stickerRegex  *regexp.Regexp
}

// NewExtendedMarkdownRenderer 创建扩展的 Markdown 渲染器
func NewExtendedMarkdownRenderer(stickerCache StickerCache) *ExtendedMarkdownRenderer {
	return &ExtendedMarkdownRenderer{
		markdown:     goldmark.New(),
		stickerCache: stickerCache,
		emojiRegex:   regexp.MustCompile(`:([a-zA-Z0-9_]+):`),
		kaomojiRegex: regexp.MustCompile(`:kaomoji_[a-zA-Z0-9_]+:`),
		stickerRegex: regexp.MustCompile(`\[sticker:([a-zA-Z0-9_-]+)/([a-zA-Z0-9_-]+)\]`),
	}
}

// Render 渲染 Markdown，处理 emoji、颜文字和表情包
func (r *ExtendedMarkdownRenderer) Render(md string) (string, error) {
	// 1. 替换表情包 shortcode
	md = r.replaceStickers(md)

	// 2. 替换 emoji shortcode
	md = r.replaceEmojis(md)

	// 3. 替换颜文字 shortcode
	md = r.replaceKaomojis(md)

	// 4. 使用 goldmark 渲染 Markdown
	var buf bytes.Buffer
	if err := r.markdown.Convert([]byte(md), &buf); err != nil {
		return "", err
	}

	return buf.String(), nil
}

// replaceStickers 替换表情包 shortcode 为 HTML img 标签
func (r *ExtendedMarkdownRenderer) replaceStickers(md string) string {
	return r.stickerRegex.ReplaceAllStringFunc(md, func(match string) string {
		parts := r.stickerRegex.FindStringSubmatch(match)
		if len(parts) != 3 {
			return match
		}

		groupSlug := parts[1]
		stickerSlug := parts[2]

		if r.stickerCache != nil {
			sticker := r.stickerCache.Get(groupSlug, stickerSlug)
			if sticker != nil {
				return formatStickerHTML(sticker)
			}
		}

		// 找不到表情包，保留原文
		return match
	})
}

// formatStickerHTML 生成表情包 HTML
func formatStickerHTML(sticker *StickerInfo) string {
	width := sticker.Width
	height := sticker.Height
	if width <= 0 {
		width = 24
	}
	if height <= 0 {
		height = 24
	}

	return strings.ReplaceAll(
		`<img src="$URL" alt="$NAME" class="sticker-in-comment" width="$W" height="$H" loading="lazy" />`,
		"$URL", sticker.ImageURL,
	) + strings.ReplaceAll(
		`<img src="$URL" alt="$NAME" class="sticker-in-comment" width="$W" height="$H" loading="lazy" />`,
		"$NAME", sticker.Name,
	) + strings.ReplaceAll(
		`<img src="$URL" alt="$NAME" class="sticker-in-comment" width="$W" height="$H" loading="lazy" />`,
		"$W", string(rune(width)),
	) + strings.ReplaceAll(
		`<img src="$URL" alt="$NAME" class="sticker-in-comment" width="$W" height="$H" loading="lazy" />`,
		"$H", string(rune(height)),
	)

	// 直接拼接更可靠
	// return fmt.Sprintf(`<img src="%s" alt="%s" class="sticker-in-comment" width="%d" height="%d" loading="lazy" />`,
	// 	sticker.ImageURL, sticker.Name, width, height)
}

// replaceEmojis 替换 emoji shortcode 为 Unicode 字符
func (r *ExtendedMarkdownRenderer) replaceEmojis(md string) string {
	return r.emojiRegex.ReplaceAllStringFunc(md, func(match string) string {
		// 提取 shortcode（去掉两边的冒号）
		shortcode := match[1:len(match)-1]

		// 排除颜文字的 shortcode
		if strings.HasPrefix(shortcode, "kaomoji_") {
			return match
		}

		if emoji, ok := emojiMap[shortcode]; ok {
			return emoji
		}

		// 未找到，保留原文
		return match
	})
}

// replaceKaomojis 替换颜文字 shortcode 为颜文字文本
func (r *ExtendedMarkdownRenderer) replaceKaomojis(md string) string {
	return r.kaomojiRegex.ReplaceAllStringFunc(md, func(match string) string {
		// 提取 shortcode（去掉两边的冒号）
		shortcode := match[1:len(match)-1]

		if kaomoji, ok := kaomojiMap[shortcode]; ok {
			return kaomoji
		}

		// 未找到，保留原文
		return match
	})
}

// SimpleStickerCache 简单的表情包缓存实现
type SimpleStickerCache struct {
	stickers map[string]*StickerInfo // key: "groupSlug/stickerSlug"
}

// NewSimpleStickerCache 创建简单缓存
func NewSimpleStickerCache(stickers []*generated.ListAllStickersWithGroupRow) *SimpleStickerCache {
	cache := &SimpleStickerCache{
		stickers: make(map[string]*StickerInfo),
	}

	for _, s := range stickers {
		key := s.GroupSlug + "/" + s.Slug
		width := int16(0)
		height := int16(0)
		if s.Width.Valid {
			width = s.Width.Int16
		}
		if s.Height.Valid {
			height = s.Height.Int16
		}
		cache.stickers[key] = &StickerInfo{
			ImageURL: s.ImageUrl,
			Name:     s.Name,
			Width:    width,
			Height:   height,
		}
	}

	return cache
}

// Get 获取表情包信息
func (c *SimpleStickerCache) Get(groupSlug, stickerSlug string) *StickerInfo {
	key := groupSlug + "/" + stickerSlug
	return c.stickers[key]
}