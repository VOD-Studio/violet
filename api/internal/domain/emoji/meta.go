package emoji

// EmojiSize 表情尺寸（B站 meta.size 语义）。
// 用 int 基础类型而非强类型转换：B站未来可能新增取值，按「容错存储」原则未知值照存。
type EmojiSize int

// B站已知的表情尺寸取值。
const (
	SizeSmall EmojiSize = 1 // 小
	SizeLarge EmojiSize = 2 // 大
)

// IsValid 判断尺寸是否为已知取值。仅用于业务校验，不用于拉取过滤。
func (s EmojiSize) IsValid() bool {
	switch s {
	case SizeSmall, SizeLarge:
		return true
	}
	return false
}

// EmojiType 表情获取门槛类型（B站 emote.type 语义）。
// 用 int 基础类型而非强类型转换：未知值容错存储，不阻断重拉取。
type EmojiType int

// B站已知的表情门槛取值。
const (
	TypeNormal    EmojiType = 1 // 普通
	TypeVIP       EmojiType = 2 // 会员专属
	TypePurchased EmojiType = 3 // 购买所得
	TypeText      EmojiType = 4 // 颜文字
)

// IsValid 判断门槛类型是否为已知取值。仅用于业务校验，不用于拉取过滤。
func (t EmojiType) IsValid() bool {
	switch t {
	case TypeNormal, TypeVIP, TypePurchased, TypeText:
		return true
	}
	return false
}

// GroupType 表情分组类型（分组级，区别于单表情的 EmojiType）。
// 1=文字（颜文字组），2=图片。决定 EmojiPicker 的列数与渲染策略。
type GroupType int

// 分组类型已知取值。
const (
	GroupTypeText  GroupType = 1 // 文字组（颜文字）
	GroupTypeImage GroupType = 2 // 图片组
)

// IsValid 判断分组类型是否为已知取值。
func (g GroupType) IsValid() bool {
	switch g {
	case GroupTypeText, GroupTypeImage:
		return true
	}
	return false
}

// EmojiMeta 表情元数据值对象（不可变）。
// 源自 B站 emote 的 meta 子对象与顶层 type 字段，承载只读展示属性。
// 别名用于搜索/补全，尺寸/类型用于渲染与门槛展示；当前不参与过滤。
type EmojiMeta struct {
	alias string
	size  EmojiSize
	typ   EmojiType
}

// ReconstructEmojiMeta 从持久化或拉取数据重建表情元数据。
func ReconstructEmojiMeta(alias string, size EmojiSize, typ EmojiType) EmojiMeta {
	return EmojiMeta{alias: alias, size: size, typ: typ}
}

func (m EmojiMeta) Alias() string    { return m.alias }
func (m EmojiMeta) Size() EmojiSize  { return m.size }
func (m EmojiMeta) Type() EmojiType  { return m.typ }
