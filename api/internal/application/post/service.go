// Package post 提供 application 层用例。
package post

import (
	"context"
	"time"

	domain "blog-api/internal/domain/post"
	"blog-api/internal/domain/shared"
	userdomain "blog-api/internal/domain/user"
)

// PostDTO 文章读模型
type PostDTO struct {
	ID             string   `json:"id"`
	Title          string   `json:"title"`
	Slug           string   `json:"slug"`
	ContentMD      string   `json:"content_md"`
	ContentHTML    string   `json:"content_html"`
	Excerpt        string   `json:"excerpt"`
	CoverImage     string   `json:"cover_image"`
	Status         string   `json:"status"`
	AuthorID       string   `json:"author_id"`
	Author         *AuthorDTO `json:"author,omitempty"`
	ViewCount      int      `json:"view_count"`
	IsFeatured     bool     `json:"is_featured"`
	SEOTitle       string   `json:"seo_title"`
	SEODescription string   `json:"seo_description"`
	PublishedAt    string   `json:"published_at,omitempty"`
	Tags           []string `json:"tags"`
	CreatedAt      string   `json:"created_at"`
	UpdatedAt      string   `json:"updated_at"`
}

// AuthorDTO 文章作者信息，列表与详情按 author_id 批量/单个填充
type AuthorDTO struct {
	Username  string `json:"username"`
	AvatarURL string `json:"avatar_url"`
}

// ArchiveItemDTO 归档文章项（精简字段，不含正文，避免响应过大）。
// 归档页一次拉取某年全部文章，故仅携带展示所需字段。
type ArchiveItemDTO struct {
	ID          string   `json:"id"`          // 文章 ID
	Slug        string   `json:"slug"`        // URL slug（用于跳转详情）
	Title       string   `json:"title"`       // 标题
	Excerpt     string   `json:"excerpt"`     // 摘要
	CoverImage  string   `json:"cover_image"` // 封面图 URL
	Tags        []string `json:"tags"`        // 标签名列表
	PublishedAt string  `json:"published_at"` // 发布时间（RFC3339）
}

// ArchiveYearDTO 某年的归档数据。
// Items 为该年全部已发布文章的扁平倒序列表，月份分组由前端完成。
type ArchiveYearDTO struct {
	Year  int              `json:"year"`  // 年份
	Count int              `json:"count"` // 该年文章数
	Items []ArchiveItemDTO `json:"items"` // 该年全部文章（倒序）
}

// Service 文章用例服务
type Service struct {
	repo     domain.PostRepository
	userRepo userdomain.UserRepository
}

// NewService 构造文章用例服务
//
// userRepo 用于按 author_id 填充 PostDTO.Author，nil 时跳过填充。
func NewService(repo domain.PostRepository, userRepo userdomain.UserRepository) *Service {
	return &Service{repo: repo, userRepo: userRepo}
}

// GetBySlug 按 slug 获取已发布文章
func (s *Service) GetBySlug(ctx context.Context, slug string) (PostDTO, error) {
	p, err := s.repo.FindBySlug(ctx, slug)
	if err != nil {
		return PostDTO{}, err
	}
	dto := toDTO(p)
	s.fillAuthor(ctx, []PostDTO{dto})
	return dto, nil
}

// GetByID 按 ID 获取文章（后台）
func (s *Service) GetByID(ctx context.Context, id string) (PostDTO, error) {
	pid, err := shared.ParseID(id)
	if err != nil {
		return PostDTO{}, err
	}
	p, err := s.repo.FindByID(ctx, pid)
	if err != nil {
		return PostDTO{}, err
	}
	dto := toDTO(p)
	s.fillAuthor(ctx, []PostDTO{dto})
	return dto, nil
}

// ListPublished 列出已发布文章（前台）
func (s *Service) ListPublished(ctx context.Context, page, limit int, tag string) ([]PostDTO, int64, error) {
	items, total, err := s.repo.FindPublished(ctx, page, limit, tag)
	if err != nil {
		return nil, 0, err
	}
	dtos := toDTOs(items)
	s.fillAuthor(ctx, dtos)
	return dtos, total, nil
}

// ListAll 列出所有文章（后台）
func (s *Service) ListAll(ctx context.Context, page, limit int, status string) ([]PostDTO, int64, error) {
	items, total, err := s.repo.FindAll(ctx, page, limit, status)
	if err != nil {
		return nil, 0, err
	}
	dtos := toDTOs(items)
	s.fillAuthor(ctx, dtos)
	return dtos, total, nil
}

// CreateInput 创建文章入参
type CreateInput struct {
	AuthorID       string
	Title          string
	Slug           string
	ContentMD      string
	ContentHTML    string
	Excerpt        string
	CoverImage     string
	SEOTitle       string
	SEODescription string
	Tags           []string
}

// Create 创建文章
func (s *Service) Create(ctx context.Context, in CreateInput) (PostDTO, error) {
	authorID, err := shared.ParseID(in.AuthorID)
	if err != nil {
		return PostDTO{}, err
	}
	p, err := domain.NewPost(shared.NewID(), authorID, in.Title, in.Slug)
	if err != nil {
		return PostDTO{}, err
	}
	// slug 查重
	exists, err := s.repo.ExistsBySlug(ctx, in.Slug)
	if err != nil {
		return PostDTO{}, err
	}
	if exists {
		return PostDTO{}, domain.ErrSlugConflict
	}
	if err := p.UpdateContent(in.Title, in.ContentMD, in.ContentHTML, in.Excerpt, in.CoverImage); err != nil {
		return PostDTO{}, err
	}
	p.UpdateSEO(in.SEOTitle, in.SEODescription)
	p.SetTags(in.Tags)
	if err := s.repo.Save(ctx, p); err != nil {
		return PostDTO{}, err
	}
	return toDTO(p), nil
}

// UpdateInput 更新文章入参
type UpdateInput struct {
	ID             string
	Title          string
	Slug           string
	ContentMD      string
	ContentHTML    string
	Excerpt        string
	CoverImage     string
	SEOTitle       string
	SEODescription string
	Tags           []string
}

// Update 更新文章
func (s *Service) Update(ctx context.Context, in UpdateInput) error {
	pid, err := shared.ParseID(in.ID)
	if err != nil {
		return err
	}
	p, err := s.repo.FindByID(ctx, pid)
	if err != nil {
		return err
	}
	if in.Slug != "" && in.Slug != p.Slug() {
		exists, err := s.repo.ExistsBySlug(ctx, in.Slug)
		if err != nil {
			return err
		}
		if exists {
			return domain.ErrSlugConflict
		}
		if err := p.UpdateSlug(in.Slug); err != nil {
			return err
		}
	}
	if err := p.UpdateContent(in.Title, in.ContentMD, in.ContentHTML, in.Excerpt, in.CoverImage); err != nil {
		return err
	}
	p.UpdateSEO(in.SEOTitle, in.SEODescription)
	p.SetTags(in.Tags)
	return s.repo.Save(ctx, p)
}

// Publish 发布文章
func (s *Service) Publish(ctx context.Context, id string) error {
	pid, err := shared.ParseID(id)
	if err != nil {
		return err
	}
	p, err := s.repo.FindByID(ctx, pid)
	if err != nil {
		return err
	}
	p.Publish()
	return s.repo.Save(ctx, p)
}

// UpdateStatus 更新文章状态（draft/published/archived）
//
// 根据状态调用对应聚合根状态机方法，保证 published_at 等不变量一致。
func (s *Service) UpdateStatus(ctx context.Context, id, status string) (PostDTO, error) {
	pid, err := shared.ParseID(id)
	if err != nil {
		return PostDTO{}, err
	}
	if !domain.IsValidStatus(status) {
		return PostDTO{}, shared.BadRequest("无效的文章状态")
	}
	p, err := s.repo.FindByID(ctx, pid)
	if err != nil {
		return PostDTO{}, err
	}
	switch status {
	case domain.StatusPublished:
		p.Publish()
	case domain.StatusArchived:
		p.Archive()
	case domain.StatusDraft:
		p.RevertToDraft()
	}
	if err := s.repo.Save(ctx, p); err != nil {
		return PostDTO{}, err
	}
	return toDTO(p), nil
}

// IncrementView 浏览量 +1（含浏览事件记录，供 admin 趋势统计）
// 通过 IncrementViewAtomic 在 DB 内原子自增并记录事件（单事务），保证一致性与并发安全。
func (s *Service) IncrementView(ctx context.Context, id, ipAddress, userAgent string) error {
	pid, err := shared.ParseID(id)
	if err != nil {
		return err
	}
	return s.repo.IncrementViewAtomic(ctx, pid, ipAddress, userAgent)
}

// Delete 删除文章
func (s *Service) Delete(ctx context.Context, id string) error {
	pid, err := shared.ParseID(id)
	if err != nil {
		return err
	}
	return s.repo.Delete(ctx, pid)
}

// ListArchiveYears 返回归档年份索引（倒序）。
// 供公开归档页渲染年份导航，单独成接口以便前端懒加载各年文章。
func (s *Service) ListArchiveYears(ctx context.Context) ([]int, error) {
	return s.repo.FindArchiveYears(ctx)
}

// GetArchiveByYear 返回指定年份的归档数据（精简文章项，倒序）。
// year 合法性校验：排除明显非法值，避免无效查询。
func (s *Service) GetArchiveByYear(ctx context.Context, year int) (ArchiveYearDTO, error) {
	const minYear = 1900
	if year < minYear || year > time.Now().Year()+1 {
		return ArchiveYearDTO{}, shared.BadRequest("无效的年份")
	}
	posts, err := s.repo.FindPublishedByYear(ctx, year)
	if err != nil {
		return ArchiveYearDTO{}, err
	}
	items := make([]ArchiveItemDTO, 0, len(posts))
	for _, p := range posts {
		items = append(items, toArchiveItem(p))
	}
	return ArchiveYearDTO{
		Year:  year,
		Count: len(items),
		Items: items,
	}, nil
}

// fillAuthor 为 PostDTO 列表按 author_id 批量填充 Author。
//
// 收集去重后的 author_id → userRepo.FindByIDs 批量查 → 回填；
// 作者缺失时不报错，PostDTO.Author 保持 nil，列表正常返回。
func (s *Service) fillAuthor(ctx context.Context, dtos []PostDTO) {
	if len(dtos) == 0 || s.userRepo == nil {
		return
	}
	seen := make(map[string]struct{}, len(dtos))
	ids := make([]shared.ID, 0, len(dtos))
	for _, d := range dtos {
		if d.AuthorID == "" {
			continue
		}
		if _, ok := seen[d.AuthorID]; ok {
			continue
		}
		seen[d.AuthorID] = struct{}{}
		if id, err := shared.ParseID(d.AuthorID); err == nil {
			ids = append(ids, id)
		}
	}
	if len(ids) == 0 {
		return
	}
	users, err := s.userRepo.FindByIDs(ctx, ids)
	if err != nil {
		return // 作者信息缺失不阻塞文章列表
	}
	authors := make(map[string]*AuthorDTO, len(users))
	for _, u := range users {
		authors[u.GetID().String()] = &AuthorDTO{
			Username:  u.Username().String(),
			AvatarURL: u.AvatarURL(),
		}
	}
	for i := range dtos {
		if a, ok := authors[dtos[i].AuthorID]; ok {
			dtos[i].Author = a
		}
	}
}

func toDTO(p *domain.Post) PostDTO {
	dto := PostDTO{
		ID: p.ID().String(), Title: p.Title(), Slug: p.Slug(),
		ContentMD: p.ContentMD(), ContentHTML: p.ContentHTML(),
		Excerpt: p.Excerpt(), CoverImage: p.CoverImage(),
		Status: p.Status(), AuthorID: p.AuthorID().String(),
		ViewCount: p.ViewCount(), IsFeatured: p.IsFeatured(),
		SEOTitle: p.SEOTitle(), SEODescription: p.SEODescription(),
		Tags:      p.Tags(),
		CreatedAt: p.CreatedAt().Format(time.RFC3339),
		UpdatedAt: p.UpdatedAt().Format(time.RFC3339),
	}
	if p.PublishedAt() != nil {
		dto.PublishedAt = p.PublishedAt().Format(time.RFC3339)
	}
	return dto
}

// toArchiveItem 将领域 Post 转为精简归档项（不含正文）。
func toArchiveItem(p *domain.Post) ArchiveItemDTO {
	item := ArchiveItemDTO{
		ID:          p.ID().String(),
		Slug:        p.Slug(),
		Title:       p.Title(),
		Excerpt:     p.Excerpt(),
		CoverImage:  p.CoverImage(),
		Tags:        p.Tags(),
		PublishedAt: "", // 已发布文章必有 published_at，保险起见默认空串
	}
	if p.PublishedAt() != nil {
		item.PublishedAt = p.PublishedAt().Format(time.RFC3339)
	}
	return item
}

func toDTOs(items []*domain.Post) []PostDTO {
	dtos := make([]PostDTO, 0, len(items))
	for _, p := range items {
		dtos = append(dtos, toDTO(p))
	}
	return dtos
}
