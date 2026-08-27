package gallery

// --- 输入 DTO ---

// CreateInput 建图集入参。
type CreateInput struct {
	// OwnerID 创建者（当前登录用户 ID，handler 从 session ctx 提取）
	OwnerID string
	Title   string
	// Description 可空
	Description string
	// CoverFileID 封面文件 ID；空 = 取首项媒体当封面
	CoverFileID string
	// Items 有序媒体项（位置即展示顺序）
	Items []ItemInput
}

// ItemInput 媒体项入参。
type ItemInput struct {
	// FileID 引用 upload 域文件
	FileID string
	// Caption 图片说明（≤200 rune，可空）
	Caption string
}

// UpdateInput 编辑图集入参（PATCH 语义）。
type UpdateInput struct {
	Title       string
	Description string
	// CoverFileID 更换封面；空串配合 ClearCover=false 表示不修改
	CoverFileID string
	// ClearCover 显式清空封面（回退首项媒体）
	ClearCover bool
	// Items 媒体项全量替换；nil = 不改动媒体列表
	Items []ItemInput
}

// --- 输出 DTO ---

// AuthorDTO 作者资料卡（浏览流卡片展示用）。
type AuthorDTO struct {
	ID        string `json:"id"`
	Username  string `json:"username"`
	AvatarURL string `json:"avatar_url"`
}

// GalleryItemDTO 媒体项（含解析后的文件元数据）。
type GalleryItemDTO struct {
	FileID string `json:"file_id"`
	// URL 媒体访问地址（视频项为源文件，列表态用 Thumbnail）
	URL string `json:"url"`
	// Thumbnail 缩略图地址；视频项为 ffmpeg 首帧，无则空串
	Thumbnail string `json:"thumbnail"`
	MimeType  string `json:"mime_type"`
	// Width/Height 原始尺寸；非图片或未知为 null
	Width   *int   `json:"width"`
	Height  *int   `json:"height"`
	Caption string `json:"caption"`
}

// GalleryDTO 图集列表卡片。
type GalleryDTO struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	// CoverURL 封面访问地址（指定封面或首项媒体；文件缺失时为空串）
	CoverURL   string    `json:"cover_url"`
	ItemCount  int       `json:"item_count"`
	Status     string    `json:"status"`
	Author     AuthorDTO `json:"author"`
	// CreatedAt RFC3339 格式
	CreatedAt string `json:"created_at"`
	// UpdatedAt RFC3339 格式
	UpdatedAt string `json:"updated_at"`
}

// GalleryDetailDTO 图集详情（含全部媒体项）。
type GalleryDetailDTO struct {
	GalleryDTO
	Items []GalleryItemDTO `json:"items"`
}
