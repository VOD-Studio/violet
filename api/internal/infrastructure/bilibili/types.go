// Package bilibili 封装 B站表情 API 调用与图片下载的基础设施能力。
package bilibili

// B站表情 API 端点
const (
	// APIUser 用户收藏表情面板（需登录态，business=reply）
	APIUser = "https://api.bilibili.com/x/emote/user/panel/web?business=reply&web_location=333.1369"
	// APIOfficial 官方表情面板（business=reply）
	APIOfficial = "https://api.bilibili.com/x/emote/setting/panel?business=reply"
)

// Response B站表情 API 响应
type Response struct {
	Code int    `json:"code"`
	Data Data   `json:"data"`
	Msg  string `json:"message"`
}

// Data B站表情数据（兼容用户 API 与官方 API 两种响应结构）
type Data struct {
	Packages          []Package `json:"packages"`            // 用户 API
	UserPanelPackages []Package `json:"user_panel_packages"` // 官方 API（已添加）
	AllPackages       []Package `json:"all_packages"`        // 官方 API（全部）
}

// Package B站表情包
type Package struct {
	ID    int        `json:"id"`
	Text  string     `json:"text"`
	URL   string     `json:"url"` // 表情包封面图
	Emote []Emote    `json:"emote"`
	Type  int        `json:"type"` // 13=收藏特殊包，1=普通表情包
	Meta  PackageMeta `json:"meta"`
}

// PackageMeta B站表情包的 meta 子对象（分组级）。
// size 决定 picker 中该分组的渲染尺寸（与单个 emote 的 meta.size 区分）。
type PackageMeta struct {
	Size   int `json:"size"`
	ItemID int `json:"item_id"` // 付费/会员包的商店资源 ID，博客场景不使用
}

// Emote B站单个表情
type Emote struct {
	Text   string `json:"text"`
	URL    string `json:"url"`
	GifURL string `json:"gif_url"`
	Type   int    `json:"type"` // 表情门槛：1=普通 2=会员专属 3=购买所得 4=颜文字（区别于 Package.Type）
	Meta   EmoteMeta `json:"meta"`
}

// EmoteMeta B站表情 meta 子对象（只读展示属性）。
type EmoteMeta struct {
	Size  int    `json:"size"`  // 尺寸：1=小 2=大
	Alias string `json:"alias"` // 简写名/别名，无则 B站不返回此项
}
