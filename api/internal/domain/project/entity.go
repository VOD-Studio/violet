// Package project 定义项目聚合的领域模型。
package project

import (
	"net/url"
	"strings"
	"time"
	"unicode"

	"blog-api/internal/domain/shared"
)

// Status 项目维护状态，与路线图条目的阶段独立。
type Status string

const (
	StatusActive   Status = "active"
	StatusStable   Status = "stable"
	StatusArchived Status = "archived"
)

// Project 项目聚合根
type Project struct {
	shared.AggregateRoot

	// id 项目 ID
	id shared.ID
	// title 项目标题（必填，不能为空）
	title string
	// slug 全局唯一的网址标识，只含小写字母、数字与单连字符
	slug string
	// description 项目简介
	description string
	// url 项目在线链接（可空）
	url string
	// githubURL 源码仓库链接（可空）
	githubURL string
	// docsURL 已可访问的项目文档地址（可空），站内地址从根路径起。
	docsURL string
	// status 归档不影响项目与路线图的公开可见性。
	status Status
	// imageURL 封面图链接（可空）
	imageURL string
	// techStack 技术栈标签列表（永不 nil，空为 []string{}）
	techStack []string
	// sortOrder 排序值（越小越靠前）
	sortOrder int
	// timestamps 创建/更新时间戳
	timestamps shared.Timestamps
}

// NewProject 创建新项目
func NewProject(id shared.ID, title, description string) (*Project, error) {
	if title == "" {
		return nil, shared.BadRequest("项目标题不能为空")
	}
	return &Project{
		id: id, title: title, slug: GenerateSlug(title, id), description: description,
		status: StatusActive, techStack: []string{},
	}, nil
}

// ReconstructProject 从持久化数据重建
func ReconstructProject(id shared.ID, title, slug, description, url, githubURL, imageURL, docsURL string, status Status, techStack []string, sortOrder int, createdAt, updatedAt time.Time) *Project {
	if techStack == nil {
		techStack = []string{}
	}
	return &Project{
		id: id, title: title, slug: slug, description: description,
		url: url, githubURL: githubURL, imageURL: imageURL, docsURL: docsURL, status: status,
		techStack: techStack, sortOrder: sortOrder,
		timestamps: shared.Timestamps{CreatedAt: createdAt, UpdatedAt: updatedAt},
	}
}

// SetSlug 校验网址标识格式；唯一性由仓储约束保证。
func (p *Project) SetSlug(slug string) error {
	if !IsValidSlug(slug) {
		return shared.BadRequest("项目 slug 须为 1–255 字符的小写字母数字，并以单连字符分隔")
	}
	p.slug = slug
	return nil
}

// Update 更新项目信息
func (p *Project) Update(title, description, url, githubURL, imageURL string) error {
	if title == "" {
		return shared.BadRequest("项目标题不能为空")
	}
	p.title = title
	p.description = description
	p.url = url
	p.githubURL = githubURL
	p.imageURL = imageURL
	return nil
}

// SetStatus 只接受项目维护状态枚举，不从标题、发布或路线图推断。
func (p *Project) SetStatus(status Status) error {
	switch status {
	case StatusActive, StatusStable, StatusArchived:
		p.status = status
		return nil
	default:
		return shared.BadRequest("无效的项目状态")
	}
}

// SetDocsURL 接受单斜线开头的站内路径或 HTTP(S) 绝对地址；空串移除入口。
func (p *Project) SetDocsURL(address string) error {
	address = strings.TrimSpace(address)
	if address != "" && !validDocsURL(address) {
		return shared.BadRequest("文档地址须为站内路径或完整的 http/https 地址")
	}
	p.docsURL = address
	return nil
}

func validDocsURL(raw string) bool {
	if strings.ContainsFunc(raw, unicode.IsSpace) {
		return false
	}
	decoded, err := url.PathUnescape(raw)
	if err != nil || strings.ContainsRune(decoded, '\\') || strings.ContainsFunc(decoded, unicode.IsControl) {
		return false
	}
	u, err := url.Parse(raw)
	if err != nil || u.User != nil {
		return false
	}
	if strings.HasPrefix(raw, "//") {
		return false
	}
	if strings.HasPrefix(raw, "/") {
		return u.Host == "" && !strings.HasPrefix(u.Path, "//")
	}
	return (u.Scheme == "http" || u.Scheme == "https") && u.Hostname() != ""
}

// SetTechStack 设置技术栈
func (p *Project) SetTechStack(stack []string) {
	if stack == nil {
		stack = []string{}
	}
	p.techStack = stack
}

// SetSortOrder 设置排序
func (p *Project) SetSortOrder(order int) { p.sortOrder = order }

// 访问器
func (p *Project) ID() shared.ID        { return p.id }
func (p *Project) Title() string        { return p.title }
func (p *Project) Slug() string         { return p.slug }
func (p *Project) Description() string  { return p.description }
func (p *Project) URL() string          { return p.url }
func (p *Project) GithubURL() string    { return p.githubURL }
func (p *Project) DocsURL() string      { return p.docsURL }
func (p *Project) Status() Status       { return p.status }
func (p *Project) ImageURL() string     { return p.imageURL }
func (p *Project) TechStack() []string  { return p.techStack }
func (p *Project) SortOrder() int       { return p.sortOrder }
func (p *Project) CreatedAt() time.Time { return p.timestamps.CreatedAt }
func (p *Project) UpdatedAt() time.Time { return p.timestamps.UpdatedAt }
