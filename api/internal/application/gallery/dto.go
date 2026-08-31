package gallery

import (
	"strconv"
	"time"

	domaingallery "blog-api/internal/domain/gallery"
	"blog-api/internal/domain/shared"
)

// GallerySummaryDTO 后台图集列表项。
type GallerySummaryDTO struct {
	ID       string `json:"id"`
	AuthorID string `json:"author_id"`
	// Slug nil 表示从未发布；撤回后仍保留原值。
	Slug    *string `json:"slug"`
	Title   string  `json:"title"`
	Summary string  `json:"summary"`
	// Status 为 draft、published、modified 或 unpublished。
	Status string `json:"status"`
	// Version 从 1 开始，每次保存或发布递增。
	Version   int64 `json:"version"`
	ItemCount int   `json:"item_count"`
	// PublishedAt nil 表示从未发布；非 nil 值为 RFC3339，撤回后仍保留。
	PublishedAt *string `json:"published_at"`
	// CreatedAt RFC3339 格式的创建时间。
	CreatedAt string `json:"created_at"`
	// UpdatedAt RFC3339 格式的最近修改时间。
	UpdatedAt string `json:"updated_at"`
}

// GalleryItemDTO 编辑器所需的有序图片投影。
type GalleryItemDTO struct {
	FileID string `json:"file_id"`
	// Position 从 0 开始且连续。
	Position  int    `json:"position"`
	URL       string `json:"url"`
	Thumbnail string `json:"thumbnail"`
	MimeType  string `json:"mime_type"`
	// Width 图片像素宽度；0 表示未知。
	Width int `json:"width"`
	// Height 图片像素高度；0 表示未知。
	Height          int    `json:"height"`
	AssetAltText    string `json:"asset_alt_text"`
	Caption         string `json:"caption"`
	AltTextOverride string `json:"alt_text_override"`
}

// GalleryDetailDTO 后台图集编辑详情。
type GalleryDetailDTO struct {
	GallerySummaryDTO
	Items []GalleryItemDTO `json:"items"`
}

// SaveItemInput 完整工作稿中的单张图片。
type SaveItemInput struct {
	FileID          string
	Caption         string
	AltTextOverride string
}

// SaveInput 完整工作稿保存输入。
type SaveInput struct {
	UserID    string
	GalleryID string
	// ExpectedVersion 必须大于 0，且与当前工作稿版本一致。
	ExpectedVersion int64
	Title           string
	Summary         string
	Items           []SaveItemInput
}

// VersionInput 是图集维护动作共用的乐观写输入。
type VersionInput struct {
	UserID    string
	GalleryID string
	// ExpectedVersion 必须大于 0，且与当前工作稿版本一致。
	ExpectedVersion int64
}

// PublishInput 发布或更新发布的乐观写输入。
type PublishInput = VersionInput

// PublicGalleryItemDTO 是公开版本中的有序图片投影。
type PublicGalleryItemDTO struct {
	FileID string `json:"file_id"`
	// Position 从 0 开始且连续。
	Position  int    `json:"position"`
	Thumbnail string `json:"thumbnail"`
	URL       string `json:"url"`
	// Width 图片像素宽度；0 表示未知。
	Width int `json:"width"`
	// Height 图片像素高度；0 表示未知。
	Height int `json:"height"`
	// AltText 已按图集覆盖、素材默认值、标题序号的顺序回退。
	AltText string `json:"alt_text"`
	Caption string `json:"caption"`
}

// PublicGalleryDTO 只投影当前公开 revision。
type PublicGalleryDTO struct {
	ID      string `json:"id"`
	Slug    string `json:"slug"`
	Title   string `json:"title"`
	Summary string `json:"summary"`
	// PublishedAt 首次发布时间，格式为 RFC3339。
	PublishedAt string                 `json:"published_at"`
	Items       []PublicGalleryItemDTO `json:"items"`
}

func toSummaryDTO(gallery *domaingallery.Gallery) GallerySummaryDTO {
	working := gallery.WorkingRevision()
	var slug *string
	if gallery.Slug() != "" {
		value := gallery.Slug()
		slug = &value
	}
	var publishedAt *string
	if gallery.PublishedAt() != nil {
		value := formatTime(*gallery.PublishedAt())
		publishedAt = &value
	}
	return GallerySummaryDTO{
		ID: gallery.ID().String(), AuthorID: gallery.AuthorID().String(),
		Slug: slug, Title: working.Title(), Summary: working.Summary(), Status: gallery.Status(),
		Version: gallery.Version(), ItemCount: len(working.Items()),
		PublishedAt: publishedAt, CreatedAt: formatTime(gallery.CreatedAt()), UpdatedAt: formatTime(gallery.UpdatedAt()),
	}
}

func toDetailDTO(gallery *domaingallery.Gallery, assets []Asset) (GalleryDetailDTO, error) {
	byID := make(map[shared.ID]Asset, len(assets))
	for _, asset := range assets {
		byID[asset.ID] = asset
	}
	dto := GalleryDetailDTO{GallerySummaryDTO: toSummaryDTO(gallery), Items: make([]GalleryItemDTO, 0, len(gallery.WorkingRevision().Items()))}
	for _, item := range gallery.WorkingRevision().Items() {
		asset, ok := byID[item.FileID()]
		if !ok {
			return GalleryDetailDTO{}, shared.Internal("图集引用的素材不存在", nil)
		}
		dto.Items = append(dto.Items, GalleryItemDTO{
			FileID: item.FileID().String(), Position: item.Position(), URL: asset.URL,
			Thumbnail: asset.Thumbnail, MimeType: asset.MimeType, Width: asset.Width, Height: asset.Height,
			AssetAltText: asset.AltText, Caption: item.Caption(), AltTextOverride: item.AltTextOverride(),
		})
	}
	return dto, nil
}

func formatTime(value time.Time) string { return value.UTC().Format(time.RFC3339) }

func toPublicDTO(gallery domaingallery.PublishedGallery, assets []Asset) (PublicGalleryDTO, error) {
	byID := make(map[shared.ID]Asset, len(assets))
	for _, asset := range assets {
		byID[asset.ID] = asset
	}
	dto := PublicGalleryDTO{
		ID: gallery.ID.String(), Slug: gallery.Slug, Title: gallery.Revision.Title(), Summary: gallery.Revision.Summary(),
		PublishedAt: formatTime(gallery.PublishedAt), Items: make([]PublicGalleryItemDTO, 0, len(gallery.Revision.Items())),
	}
	for _, item := range gallery.Revision.Items() {
		asset, ok := byID[item.FileID()]
		if !ok {
			return PublicGalleryDTO{}, shared.Internal("图集公开版本引用的素材不存在", nil)
		}
		alt := item.AltTextOverride()
		if alt == "" {
			alt = asset.AltText
		}
		if alt == "" {
			alt = gallery.Revision.Title() + " 第 " + strconv.Itoa(item.Position()+1) + " 张"
		}
		dto.Items = append(dto.Items, PublicGalleryItemDTO{
			FileID: item.FileID().String(), Position: item.Position(), Thumbnail: asset.Thumbnail,
			URL: asset.URL, Width: asset.Width, Height: asset.Height, AltText: alt, Caption: item.Caption(),
		})
	}
	return dto, nil
}
