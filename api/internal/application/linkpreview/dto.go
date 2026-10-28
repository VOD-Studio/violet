package linkpreview

import domainlink "blog-api/internal/domain/linkpreview"

// LinkCardDTO 链接卡片读模型（推文 DTO 内嵌与通用 lookup 端点共用）。
//
// 仅暴露可展示字段；抓取状态、错误与退避信息留在服务端。
type LinkCardDTO struct {
	// URL 规范化后的原文链接（卡片点击目标）
	URL string `json:"url"`
	// Title 卡片标题（og:title 等逐级回退），空串时前端用域名兜底
	Title string `json:"title"`
	// Description 摘要，可空
	Description string `json:"description"`
	// SiteName 来源站点名（og:site_name），可空
	SiteName string `json:"site_name"`
	// ImageURL 封面本站访问路径（/uploads/link-previews/...），无封面为空串
	ImageURL string `json:"image_url"`
}

func toDTO(c *domainlink.LinkCard) *LinkCardDTO {
	return &LinkCardDTO{
		URL:         c.URL(),
		Title:       c.Title(),
		Description: c.Description(),
		SiteName:    c.SiteName(),
		ImageURL:    c.ImageURL(),
	}
}

// FetchResult 页面元数据抓取结果（PageFetcher 端口的返回契约，
// 由 infrastructure 实现；字段全部可空，兜底由领域/应用层决定）。
type FetchResult struct {
	// Title og:title / twitter:title / <title> 逐级回退
	Title string
	// Description og:description / twitter:description / meta description 回退
	Description string
	// SiteName og:site_name
	SiteName string
	// ImageURL 封面地址，可能为相对路径（应用层按页面 URL 解析）
	ImageURL string
}
