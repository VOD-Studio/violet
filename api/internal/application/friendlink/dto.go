package friendlink

import (
	"time"

	domain "blog-api/internal/domain/friendlink"
)

// FriendLinkDTO 公开读模型（GET /friend-links，仅 approved）。
//
// 刻意不含 contact_email / status / ip_hash / linkback_url / user_id ——
// 联系邮箱仅留存不公开，其余为审核与反垃圾内部字段。
type FriendLinkDTO struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	URL         string `json:"url"`
	AvatarURL   string `json:"avatar_url"`
	Description string `json:"description"`
	OwnerName   string `json:"owner_name"`
	SortOrder   int    `json:"sort_order"`
}

// FriendLinkAdminDTO 后台管理读模型（/admin/friend-links/*）。
//
// 公开字段 + 审核字段（status/contact_email/linkback_url/user_id/时间戳）。
type FriendLinkAdminDTO struct {
	FriendLinkDTO
	Status       string `json:"status"`
	ContactEmail string `json:"contact_email"`
	LinkbackURL  string `json:"linkback_url"`
	UserID       string `json:"user_id"` // 匿名申请与手动添加为空串
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
}

// toDTO 领域 → 公开读模型。
func toDTO(f *domain.FriendLink) FriendLinkDTO {
	return FriendLinkDTO{
		ID: f.ID().String(), Name: f.Name(), URL: f.URL(),
		AvatarURL: f.AvatarURL(), Description: f.Description(),
		OwnerName: f.OwnerName(), SortOrder: f.SortOrder(),
	}
}

// toAdminDTO 领域 → 后台读模型。
func toAdminDTO(f *domain.FriendLink) FriendLinkAdminDTO {
	dto := FriendLinkAdminDTO{
		FriendLinkDTO: toDTO(f),
		Status:        f.Status(),
		ContactEmail:  f.ContactEmail(),
		LinkbackURL:   f.LinkbackURL(),
		CreatedAt:     f.CreatedAt().UTC().Format(time.RFC3339),
		UpdatedAt:     f.UpdatedAt().UTC().Format(time.RFC3339),
	}
	if uid := f.UserID(); uid != nil {
		dto.UserID = uid.String()
	}
	return dto
}
