package gallery

import (
	"time"

	domaingallery "blog-api/internal/domain/gallery"
	"blog-api/internal/domain/shared"
)

// GallerySummaryDTO 后台图集列表项。
type GallerySummaryDTO struct {
	ID        string `json:"id"`
	AuthorID  string `json:"author_id"`
	Title     string `json:"title"`
	Summary   string `json:"summary"`
	Status    string `json:"status"`
	Version   int64  `json:"version"`
	ItemCount int    `json:"item_count"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// GalleryItemDTO 编辑器所需的有序图片投影。
type GalleryItemDTO struct {
	FileID          string `json:"file_id"`
	Position        int    `json:"position"`
	URL             string `json:"url"`
	Thumbnail       string `json:"thumbnail"`
	MimeType        string `json:"mime_type"`
	Width           int    `json:"width"`
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
	UserID          string
	GalleryID       string
	ExpectedVersion int64
	Title           string
	Summary         string
	Items           []SaveItemInput
}

func toSummaryDTO(gallery *domaingallery.Gallery) GallerySummaryDTO {
	working := gallery.WorkingRevision()
	return GallerySummaryDTO{
		ID: gallery.ID().String(), AuthorID: gallery.AuthorID().String(),
		Title: working.Title(), Summary: working.Summary(), Status: gallery.Status(),
		Version: gallery.Version(), ItemCount: len(working.Items()),
		CreatedAt: formatTime(gallery.CreatedAt()), UpdatedAt: formatTime(gallery.UpdatedAt()),
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
