package user

import (
	"net/url"
	"slices"
	"strings"
	"unicode/utf8"

	"blog-api/internal/domain/shared"
)

// PublicProfileDetails 保存本人主动公开的资料，不包含私有阅读记录。
type PublicProfileDetails struct {
	// Location 为本人填写的公开所在地。
	Location string
	// Website 只接受 HTTP(S) 公开主页。
	Website string
	// ReadingPreferences 为本人选择公开的主题。
	ReadingPreferences []string
}

func (u *User) PublicDetails() PublicProfileDetails {
	details := u.publicDetails
	details.ReadingPreferences = append([]string{}, details.ReadingPreferences...)
	return details
}

// UpdatePublicDetails nil 保留字段，空串或空数组清除；验证失败不修改聚合。
func (u *User) UpdatePublicDetails(location, website *string, preferences *[]string) error {
	details := u.publicDetails
	if location != nil {
		details.Location = strings.TrimSpace(*location)
		if utf8.RuneCountInString(details.Location) > 100 {
			return shared.BadRequest("所在地最多 100 字")
		}
	}
	if website != nil {
		details.Website = strings.TrimSpace(*website)
		if details.Website != "" {
			parsed, err := url.Parse(details.Website)
			if err != nil || len(details.Website) > 2048 || parsed.Host == "" || parsed.User != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
				return shared.BadRequest("网站须为完整的 HTTP 或 HTTPS 地址")
			}
		}
	}
	if preferences != nil {
		if len(*preferences) > 8 {
			return shared.BadRequest("最多公开 8 个常读主题")
		}
		details.ReadingPreferences = make([]string, 0, len(*preferences))
		for _, raw := range *preferences {
			value := strings.TrimSpace(raw)
			if value == "" || utf8.RuneCountInString(value) > 30 {
				return shared.BadRequest("常读主题须为 1 至 30 字")
			}
			if !slices.Contains(details.ReadingPreferences, value) {
				details.ReadingPreferences = append(details.ReadingPreferences, value)
			}
		}
	}
	u.publicDetails = details
	return nil
}
