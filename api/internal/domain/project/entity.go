// Package project 定义项目聚合的领域模型。
package project

import (
	"time"

	"blog-api/internal/domain/shared"
)

// Project 项目聚合根
type Project struct {
	shared.AggregateRoot

	// id 项目 ID
	id shared.ID
	// title 项目标题（必填，不能为空）
	title string
	// description 项目简介
	description string
	// url 项目在线链接（可空）
	url string
	// githubURL 源码仓库链接（可空）
	githubURL string
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
	p := &Project{id: id, title: title, description: description, techStack: []string{}}
	return p, nil
}

// ReconstructProject 从持久化数据重建
func ReconstructProject(id shared.ID, title, description, url, githubURL, imageURL string, techStack []string, sortOrder int, createdAt, updatedAt time.Time) *Project {
	if techStack == nil {
		techStack = []string{}
	}
	return &Project{
		id: id, title: title, description: description,
		url: url, githubURL: githubURL, imageURL: imageURL,
		techStack: techStack, sortOrder: sortOrder,
		timestamps: shared.Timestamps{CreatedAt: createdAt, UpdatedAt: updatedAt},
	}
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
func (p *Project) Description() string  { return p.description }
func (p *Project) URL() string          { return p.url }
func (p *Project) GithubURL() string    { return p.githubURL }
func (p *Project) ImageURL() string     { return p.imageURL }
func (p *Project) TechStack() []string  { return p.techStack }
func (p *Project) SortOrder() int       { return p.sortOrder }
func (p *Project) CreatedAt() time.Time { return p.timestamps.CreatedAt }
func (p *Project) UpdatedAt() time.Time { return p.timestamps.UpdatedAt }
