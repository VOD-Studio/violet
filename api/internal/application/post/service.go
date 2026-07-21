// Package post 提供 application 层用例。
package post

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	readability "codeberg.org/readeck/go-readability/v2"
	"golang.org/x/net/html"

	domain "blog-api/internal/domain/post"
	"blog-api/internal/domain/shared"
	userdomain "blog-api/internal/domain/user"
	"blog-api/internal/middleware"
)

// PostPermissionChecker 权限检查端口（避免直接依赖 service 包）
type PostPermissionChecker interface {
	HasPermission(role string, isBuiltinSuperAdmin bool, codes ...string) bool
}

// PostDTO 文章读模型
type PostDTO struct {
	ID             string       `json:"id"`
	Title          string       `json:"title"`
	Slug           string       `json:"slug"`
	ContentMD      string       `json:"content_md"`
	ContentHTML    string       `json:"content_html"`
	Excerpt        string       `json:"excerpt"`
	CoverImage     string       `json:"cover_image"`
	Status         string       `json:"status"`
	AuthorID       string       `json:"author_id"`
	Author         *AuthorDTO   `json:"author,omitempty"`               // 文章所有者（Owner）
	Collaborators  []*AuthorDTO `json:"collaborators,omitempty"`        // 协同者列表（编辑过但非所有者），按首次编辑时间排序
	ViewCount      int          `json:"view_count"`
	IsFeatured     bool         `json:"is_featured"`
	SEOTitle       string       `json:"seo_title"`
	SEODescription string       `json:"seo_description"`
	PublishedAt    string       `json:"published_at,omitempty"`
	Tags           []string     `json:"tags"`
	CreatedAt      string       `json:"created_at"`
	UpdatedAt      string       `json:"updated_at"`
}

// PostVersionDTO 文章版本 DTO
type PostVersionDTO struct {
	ID        string     `json:"id"`
	PostID    string     `json:"post_id"`
	Title     string     `json:"title"`
	ContentMD string     `json:"content_md,omitempty"` // 列表时不返回长文本
	Tags      []string   `json:"tags"`
	EditorID  string     `json:"editor_id"`            // 编辑这一版的操作人 ID
	Editor    *AuthorDTO `json:"editor,omitempty"`     // 编辑者信息（用户名+头像），按 editor_id 批量填充
	Summary   string     `json:"summary"`
	CreatedAt string     `json:"created_at"`
}

// AuthorDTO 文章作者信息，列表与详情按 author_id 批量/单个填充
type AuthorDTO struct {
	Username  string `json:"username"`
	AvatarURL string `json:"avatar_url"`
}

// PostListItemDTO 文章列表项，不含正文，避免响应过大。
// ListPublished 与 ListAll 共用；详情接口仍返回完整 PostDTO。
type PostListItemDTO struct {
	ID            string       `json:"id"`
	Slug          string       `json:"slug"`
	Title         string       `json:"title"`
	Excerpt       string       `json:"excerpt"`
	CoverImage    string       `json:"cover_image"`
	Status        string       `json:"status"`
	IsFeatured    bool         `json:"is_featured"`
	ViewCount     int          `json:"view_count"`
	PublishedAt   string       `json:"published_at,omitempty"`
	Tags          []string     `json:"tags"`
	AuthorID      string       `json:"author_id"` // 文章作者 ID（前端判断所有权，控制操作按钮）
	Author        *AuthorDTO   `json:"author,omitempty"`
	Collaborators []*AuthorDTO `json:"collaborators,omitempty"` // 协同者列表（编辑过但非所有者），按首次编辑时间排序
}

// ArchiveItemDTO 归档文章项（精简字段，不含正文，避免响应过大）。
// 归档页一次拉取某年全部文章，故仅携带展示所需字段。
type ArchiveItemDTO struct {
	ID          string   `json:"id"`           // 文章 ID
	Slug        string   `json:"slug"`         // URL slug（用于跳转详情）
	Title       string   `json:"title"`        // 标题
	Excerpt     string   `json:"excerpt"`      // 摘要
	CoverImage  string   `json:"cover_image"`  // 封面图 URL
	Tags        []string `json:"tags"`         // 标签名列表
	PublishedAt string   `json:"published_at"` // 发布时间（RFC3339）
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
	perm     PostPermissionChecker
}

// NewService 构造文章用例服务
//
// userRepo 用于按 author_id 填充 PostDTO.Author，nil 时跳过填充。
// perm 用于所有权鉴权：操作他人文章需对应权限码，操作自己的靠所有权放行。
func NewService(repo domain.PostRepository, userRepo userdomain.UserRepository, perm PostPermissionChecker) *Service {
	return &Service{repo: repo, userRepo: userRepo, perm: perm}
}

// canModify 判断操作者是否有权修改指定文章
//
// 放行规则（任一满足）：
//   - 内置超管（通配短路）
//   - 操作者是文章作者（所有权放行）
//   - 操作者拥有指定权限码
func (s *Service) canModify(ctx context.Context, p *domain.Post, code string) bool {
	opID := middleware.GetUserID(ctx)
	role := middleware.GetUserRole(ctx)
	isBuiltin := middleware.GetUserIsBuiltinSuperAdmin(ctx)
	if isBuiltin {
		return true
	}
	if opID != "" && opID == p.AuthorID().String() {
		return true
	}
	if s.perm == nil {
		return false
	}
	return s.perm.HasPermission(role, isBuiltin, code)
}

// GetBySlug 按 slug 获取已发布文章
func (s *Service) GetBySlug(ctx context.Context, slug string) (PostDTO, error) {
	p, err := s.repo.FindBySlug(ctx, slug)
	if err != nil {
		return PostDTO{}, err
	}
	dto := toDTO(p)
	s.fillAuthor(ctx, []PostDTO{dto})
	s.fillCollaborators(ctx, &dto)
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
	s.fillCollaborators(ctx, &dto)
	return dto, nil
}

// ListPublished 列出已发布文章（前台），返回不含正文的列表项，避免响应过大
func (s *Service) ListPublished(ctx context.Context, page, limit int, tag string) ([]PostListItemDTO, int64, error) {
	items, total, err := s.repo.FindPublished(ctx, page, limit, tag)
	if err != nil {
		return nil, 0, err
	}
	dtos := toListItemDTOs(items)
	s.fillListItemAuthor(ctx, dtos)
	s.fillListItemCollaborators(ctx, dtos)
	return dtos, total, nil
}

// ListAll 列出所有文章（后台），返回不含正文的列表项，避免响应过大
func (s *Service) ListAll(ctx context.Context, page, limit int, status string) ([]PostListItemDTO, int64, error) {
	items, total, err := s.repo.FindAll(ctx, page, limit, status)
	if err != nil {
		return nil, 0, err
	}
	dtos := toListItemDTOs(items)
	s.fillListItemAuthor(ctx, dtos)
	s.fillListItemCollaborators(ctx, dtos)
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
	IsFeatured     bool
}

// Create 创建文章
func (s *Service) Create(ctx context.Context, in CreateInput) (PostDTO, error) {
	authorID, err := shared.ParseID(in.AuthorID)
	if err != nil {
		return PostDTO{}, err
	}
	// slug 冲突时自动追加 -2/-3/… 直到不冲突(上限 99),不再直接报错
	// 让用户手改。多篇文章同标题(如多篇「随笔」)能各自拿到可用 slug。
	slug, err := s.resolveSlugConflict(ctx, in.Slug)
	if err != nil {
		return PostDTO{}, err
	}
	p, err := domain.NewPost(shared.NewID(), authorID, in.Title, slug)
	if err != nil {
		return PostDTO{}, err
	}
	if err := p.UpdateContent(in.Title, in.ContentMD, in.ContentHTML, in.Excerpt, in.CoverImage); err != nil {
		return PostDTO{}, err
	}
	p.UpdateSEO(in.SEOTitle, in.SEODescription)
	p.SetTags(in.Tags)
	p.SetFeatured(in.IsFeatured)
	if err := s.repo.Save(ctx, p); err != nil {
		return PostDTO{}, err
	}
	// 创建初始版本快照
	v := domain.NewPostVersion(p, authorID, "初始版本")
	_ = s.repo.SaveVersion(ctx, v) // 快照失败不阻塞创建
	return toDTO(p), nil
}

// resolveSlugConflict 当 slug 已被占用时,循环追加 -2/-3/-4… 直到不冲突。
// 上限 99(避免极端情况死循环);超过仍冲突则返回 ErrSlugConflict。
//
// 注意:ExistsBySlug 不排除当前编辑文章自身,调用方需在 slug 未变时
// 短路(Update 的 in.Slug != p.Slug() 判断),避免误判自身冲突。
func (s *Service) resolveSlugConflict(ctx context.Context, slug string) (string, error) {
	exists, err := s.repo.ExistsBySlug(ctx, slug)
	if err != nil {
		return "", err
	}
	if !exists {
		return slug, nil
	}
	for i := 2; i <= 99; i++ {
		candidate := fmt.Sprintf("%s-%d", slug, i)
		exists, err := s.repo.ExistsBySlug(ctx, candidate)
		if err != nil {
			return "", err
		}
		if !exists {
			return candidate, nil
		}
	}
	return "", domain.ErrSlugConflict
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
	IsFeatured     bool
}

// Update 更新文章
func (s *Service) Update(ctx context.Context, in UpdateInput, operatorID string) error {
	pid, err := shared.ParseID(in.ID)
	if err != nil {
		return err
	}
	opID, err := shared.ParseID(operatorID)
	if err != nil {
		return err
	}
	p, err := s.repo.FindByID(ctx, pid)
	if err != nil {
		return err
	}
	// 所有权鉴权：自己的文章放行，他人的需 post:update
	if !s.canModify(ctx, p, "post:update") {
		return shared.Forbidden("无权编辑他人文章")
	}
	if in.Slug != "" && in.Slug != p.Slug() {
		// slug 冲突时自动追加 -2/-3…,与 Create 行为一致
		slug, err := s.resolveSlugConflict(ctx, in.Slug)
		if err != nil {
			return err
		}
		if err := p.UpdateSlug(slug); err != nil {
			return err
		}
	}
	oldContent := p.ContentMD()
	oldTitle := p.Title()

	if err := p.UpdateContent(in.Title, in.ContentMD, in.ContentHTML, in.Excerpt, in.CoverImage); err != nil {
		return err
	}
	p.UpdateSEO(in.SEOTitle, in.SEODescription)
	p.SetTags(in.Tags)
	p.SetFeatured(in.IsFeatured)

	if err := s.repo.Save(ctx, p); err != nil {
		return err
	}
	
	// 如果内容或标题发生实质性变化，则自动保存快照
	if oldContent != in.ContentMD || oldTitle != in.Title {
		v := domain.NewPostVersion(p, opID, "自动保存")
		_ = s.repo.SaveVersion(ctx, v)
	}
	return nil
}

// SetFeatured 设置文章精选标记（后台）
func (s *Service) SetFeatured(ctx context.Context, id string, featured bool) (PostDTO, error) {
	pid, err := shared.ParseID(id)
	if err != nil {
		return PostDTO{}, err
	}
	p, err := s.repo.FindByID(ctx, pid)
	if err != nil {
		return PostDTO{}, err
	}
	// 加精是运营动作，仅权限码控制，不放行所有权
	role := middleware.GetUserRole(ctx)
	isBuiltin := middleware.GetUserIsBuiltinSuperAdmin(ctx)
	if !isBuiltin && (s.perm == nil || !s.perm.HasPermission(role, isBuiltin, "post:publish")) {
		return PostDTO{}, shared.Forbidden("无权设置精选")
	}
	p.SetFeatured(featured)
	if err := s.repo.Save(ctx, p); err != nil {
		return PostDTO{}, err
	}
	return toDTO(p), nil
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
	// 所有权鉴权：自己的文章放行，他人的需 post:publish
	if !s.canModify(ctx, p, "post:publish") {
		return shared.Forbidden("无权发布他人文章")
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
	// 所有权鉴权：自己的文章放行，他人的需 post:publish
	if !s.canModify(ctx, p, "post:publish") {
		return PostDTO{}, shared.Forbidden("无权修改他人文章状态")
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

// Delete 删除文章 (软删除)
func (s *Service) Delete(ctx context.Context, id string) error {
	pid, err := shared.ParseID(id)
	if err != nil {
		return err
	}
	p, err := s.repo.FindByID(ctx, pid)
	if err != nil {
		return err
	}
	// 所有权鉴权：自己的文章放行，他人的需 post:delete
	if !s.canModify(ctx, p, "post:delete") {
		return shared.Forbidden("无权删除他人文章")
	}
	return s.repo.Delete(ctx, pid)
}

// Restore 恢复已删除的文章
func (s *Service) Restore(ctx context.Context, id string) error {
	pid, err := shared.ParseID(id)
	if err != nil {
		return err
	}
	p, err := s.repo.FindByID(ctx, pid)
	if err != nil {
		return err
	}
	// 所有权鉴权：自己的文章放行，他人的需 post:delete
	if !s.canModify(ctx, p, "post:delete") {
		return shared.Forbidden("无权恢复他人文章")
	}
	return s.repo.Restore(ctx, pid)
}

// HardDelete 彻底删除文章
func (s *Service) HardDelete(ctx context.Context, id string) error {
	pid, err := shared.ParseID(id)
	if err != nil {
		return err
	}
	p, err := s.repo.FindByID(ctx, pid)
	if err != nil {
		return err
	}
	_ = p // 仅验证文章存在；彻底删除不可恢复，仅权限码控制，不放行所有权
	role := middleware.GetUserRole(ctx)
	isBuiltin := middleware.GetUserIsBuiltinSuperAdmin(ctx)
	if !isBuiltin && (s.perm == nil || !s.perm.HasPermission(role, isBuiltin, "post:delete")) {
		return shared.Forbidden("无权彻底删除文章")
	}
	return s.repo.HardDelete(ctx, pid)
}


// ListVersions 列出文章的历史版本（不含正文）
func (s *Service) ListVersions(ctx context.Context, postID string) ([]PostVersionDTO, error) {
	pid, err := shared.ParseID(postID)
	if err != nil {
		return nil, err
	}
	versions, err := s.repo.FindVersionsByPostID(ctx, pid)
	if err != nil {
		return nil, err
	}
	dtos := make([]PostVersionDTO, 0, len(versions))
	for _, v := range versions {
		dtos = append(dtos, toVersionDTO(v, false))
	}
	s.fillVersionEditor(ctx, dtos)
	return dtos, nil
}

// GetVersion 获取指定历史版本的详情
func (s *Service) GetVersion(ctx context.Context, versionID string) (PostVersionDTO, error) {
	vid, err := shared.ParseID(versionID)
	if err != nil {
		return PostVersionDTO{}, err
	}
	v, err := s.repo.GetVersionByID(ctx, vid)
	if err != nil {
		return PostVersionDTO{}, err
	}
	dto := toVersionDTO(v, true)
	s.fillVersionEditor(ctx, []PostVersionDTO{dto})
	return dto, nil
}

// RestoreVersion 回滚文章到指定版本
func (s *Service) RestoreVersion(ctx context.Context, postID, versionID, operatorID string) error {
	pid, err := shared.ParseID(postID)
	if err != nil {
		return err
	}
	vid, err := shared.ParseID(versionID)
	if err != nil {
		return err
	}
	opID, err := shared.ParseID(operatorID)
	if err != nil {
		return err
	}

	// 1. 查找当前文章
	p, err := s.repo.FindByID(ctx, pid)
	if err != nil {
		return err
	}
	// 所有权鉴权：自己的文章放行，他人的需 post:update
	if !s.canModify(ctx, p, "post:update") {
		return shared.Forbidden("无权恢复他人文章版本")
	}
	// 2. 查找历史版本
	v, err := s.repo.GetVersionByID(ctx, vid)
	if err != nil {
		return err
	}
	if v.PostID() != p.ID() {
		return shared.BadRequest("历史版本不属于该文章")
	}

	// 3. 覆盖文章内容
	if err := p.UpdateContent(v.Title(), v.ContentMD(), v.ContentHTML(), v.Excerpt(), v.CoverImage()); err != nil {
		return err
	}
	p.SetTags(v.Tags())

	if err := s.repo.Save(ctx, p); err != nil {
		return err
	}

	// 4. 为回滚操作生成一个新的快照
	newV := domain.NewPostVersion(p, opID, "回滚至历史版本 "+v.CreatedAt().Format(time.RFC3339))
	_ = s.repo.SaveVersion(ctx, newV)

	return nil
}

// ImportResult 远程文档解析结果
type ImportResult struct {
	Title          string `json:"title"`           // 文章正文标题
	HTML           string `json:"html"`            // 正文 HTML
	Excerpt        string `json:"excerpt"`         // 摘要
	SeoTitle       string `json:"seo_title"`       // SEO 标题（社交分享用，可与正文不同）
	SeoDescription string `json:"seo_description"` // SEO 描述
}

// ImportURL 抓取远程网页并提取正文 HTML，供编辑器「导入链接」使用。
// 限定 http/https、15s 超时；接口仅管理员可调，SSRF 风险可控。
//
// 自行 fetch 而非用 readability.FromURL：后者内部用默认 Parser 会剥离所有 class，
// 导致代码块 language-*、公式 katex 等语义 class 全丢，前端无法识别语言与公式。
// 开启 KeepClasses 保留全部 class（多余装饰 class 不进 prosemirror schema，不影响存储）。
func (s *Service) ImportURL(ctx context.Context, rawURL string) (ImportResult, error) {
	parsed, err := url.ParseRequestURI(rawURL)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return ImportResult{}, shared.BadRequest("无效的 URL")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return ImportResult{}, shared.BadRequest("仅支持 http/https 链接")
	}

	resp, err := fetchHTML(rawURL, 15*time.Second)
	if err != nil {
		return ImportResult{}, shared.BadRequest("抓取远程文档失败：" + err.Error())
	}
	defer resp.Body.Close()

	doc, err := html.Parse(resp.Body)
	if err != nil {
		return ImportResult{}, shared.BadRequest("解析远程文档 HTML 失败：" + err.Error())
	}

	// 元信息提取必须在 readability 处理前：article.Title() 经常返回站点名，
	// readability 还会把 H1 降级删除，故自行从原始 doc 提取真实标题。
	title := extractArticleTitle(doc)
	seoTitle := extractSeoTitle(doc)
	seoDescription := extractSeoDescription(doc)

	// MathJax 源码藏在 <script type="math/tex"> 里，readability 的 removeScripts 会删。
	// 必须在 ParseDocument 之前替换成占位 span，否则源码和位置一起丢失。
	preserveMathJaxScripts(doc)
	// KaTeX 块级公式外层 .katex-display wrapper 会被 readability 压平，块级标识丢失。
	// 在 ParseDocument 之前给内层 .katex 节点打 data-katex-display 标记保留块级信息。
	markBlockKaTeX(doc)

	parser := readability.NewParser()
	parser.KeepClasses = true
	article, err := parser.ParseDocument(doc, parsed)
	if err != nil {
		return ImportResult{}, shared.BadRequest("解析远程文档失败：" + err.Error())
	}

	// readability 处理后，把 KaTeX 渲染 DOM 与 MathJax 占位 span 还原成 LaTeX 源码。
	// 有源码（标准 KaTeX / MathJax）→ $...$，无源码（如 rua.plus 关了 mathml）→ 空 $ $ 占位。
	if article.Node != nil {
		restoreMathNodes(article.Node)
	}

	// 摘要优先用 SEO description（用户视角更准确），其次回退 readability 的 Excerpt
	// （它已走了 meta description → og:description → 正文首段的回退链）。
	excerpt := seoDescription
	if excerpt == "" {
		excerpt = article.Excerpt()
	}

	var buf bytes.Buffer
	if err := article.RenderHTML(&buf); err != nil {
		return ImportResult{}, shared.BadRequest("未能从该链接提取到正文")
	}
	if strings.TrimSpace(buf.String()) == "" {
		return ImportResult{}, shared.BadRequest("未能从该链接提取到正文")
	}
	return ImportResult{
		Title:          title,
		HTML:           buf.String(),
		Excerpt:        excerpt,
		SeoTitle:       seoTitle,
		SeoDescription: seoDescription,
	}, nil
}

// fetchHTML 抓取远程 HTML 文档，校验 Content-Type 必须为 text/html。
// UA 伪装为桌面浏览器避免被某些站点拦截。
func fetchHTML(rawURL string, timeout time.Duration) (*http.Response, error) {
	client := &http.Client{Timeout: timeout}
	req, err := http.NewRequest("GET", rawURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; mimo-blog-importer/1.0)")
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	if ct := resp.Header.Get("Content-Type"); !strings.Contains(ct, "text/html") {
		resp.Body.Close()
		return nil, fmt.Errorf("目标链接不是 HTML 文档（Content-Type: %s）", ct)
	}
	return resp, nil
}

// SlugResult slug 生成结果
type SlugResult struct {
	Slug string `json:"slug"`
}

// Slugify 根据标题生成 ASCII slug(中文走无声调全拼)。
// 纯计算,不查 DB,不解析冲突——前端写完标题调此接口预填 slug 输入框;
// 冲突解析在 Create/Update 时由 resolveSlugConflict 处理。
func (s *Service) Slugify(_ context.Context, title string) (SlugResult, error) {
	return SlugResult{Slug: domain.GenerateSlug(title)}, nil
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

// fillVersionEditor 为 PostVersionDTO 列表按 editor_id 批量填充 Editor。
//
// 逻辑与 fillAuthor 一致：收集去重后的 editor_id → userRepo.FindByIDs 批量查 → 回填；
// 编辑者缺失时不报错，PostVersionDTO.Editor 保持 nil，列表正常返回。
func (s *Service) fillVersionEditor(ctx context.Context, dtos []PostVersionDTO) {
	if len(dtos) == 0 || s.userRepo == nil {
		return
	}
	seen := make(map[string]struct{}, len(dtos))
	ids := make([]shared.ID, 0, len(dtos))
	for _, d := range dtos {
		if d.EditorID == "" {
			continue
		}
		if _, ok := seen[d.EditorID]; ok {
			continue
		}
		seen[d.EditorID] = struct{}{}
		if id, err := shared.ParseID(d.EditorID); err == nil {
			ids = append(ids, id)
		}
	}
	if len(ids) == 0 {
		return
	}
	users, err := s.userRepo.FindByIDs(ctx, ids)
	if err != nil {
		return // 编辑者信息缺失不阻塞版本列表
	}
	editors := make(map[string]*AuthorDTO, len(users))
	for _, u := range users {
		editors[u.GetID().String()] = &AuthorDTO{
			Username:  u.Username().String(),
			AvatarURL: u.AvatarURL(),
		}
	}
	for i := range dtos {
		if e, ok := editors[dtos[i].EditorID]; ok {
			dtos[i].Editor = e
		}
	}
}

// fillCollaborators 为单篇 PostDTO 填充 Collaborators（编辑过但非 owner 的用户列表）。
//
// 从版本历史按 editor_id 去重衍生（排除 owner，按首次编辑时间升序），
// 再用 userRepo.FindByIDs 批量取用户信息。协同者缺失时不报错，列表正常返回。
func (s *Service) fillCollaborators(ctx context.Context, dto *PostDTO) {
	if dto == nil || s.userRepo == nil {
		return
	}
	pid, err := shared.ParseID(dto.ID)
	if err != nil {
		return
	}
	ids, err := s.repo.FindCollaboratorIDsByPostID(ctx, pid)
	if err != nil || len(ids) == 0 {
		return
	}
	users, err := s.userRepo.FindByIDs(ctx, ids)
	if err != nil {
		return // 协同者信息缺失不阻塞文章详情
	}
	if collaborators := buildCollaboratorsFromUserMap(ids, usersToAuthorMap(users)); len(collaborators) > 0 {
		dto.Collaborators = collaborators
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

func toVersionDTO(v *domain.PostVersion, includeContent bool) PostVersionDTO {
	dto := PostVersionDTO{
		ID:        v.ID().String(),
		PostID:    v.PostID().String(),
		Title:     v.Title(),
		Tags:      v.Tags(),
		EditorID:  v.EditorID().String(),
		Summary:   v.Summary(),
		CreatedAt: v.CreatedAt().Format(time.RFC3339),
	}
	if includeContent {
		dto.ContentMD = v.ContentMD()
	}
	return dto
}

// toListItemDTO 将领域 Post 转为不含正文的列表项。
func toListItemDTO(p *domain.Post) PostListItemDTO {
	dto := PostListItemDTO{
		ID: p.ID().String(), Slug: p.Slug(), Title: p.Title(),
		Excerpt: p.Excerpt(), CoverImage: p.CoverImage(),
		Status: p.Status(), IsFeatured: p.IsFeatured(),
		ViewCount: p.ViewCount(), Tags: p.Tags(),
		AuthorID: p.AuthorID().String(),
	}
	if p.PublishedAt() != nil {
		dto.PublishedAt = p.PublishedAt().Format(time.RFC3339)
	}
	return dto
}

func toListItemDTOs(items []*domain.Post) []PostListItemDTO {
	dtos := make([]PostListItemDTO, 0, len(items))
	for _, p := range items {
		dtos = append(dtos, toListItemDTO(p))
	}
	return dtos
}

// fillListItemAuthor 为列表项批量填充 Author，逻辑与 fillAuthor 一致。
func (s *Service) fillListItemAuthor(ctx context.Context, dtos []PostListItemDTO) {
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

// fillListItemCollaborators 为列表项批量填充 Collaborators（编辑过但非 owner 的用户列表）。
//
// 先批量查询各文章的协同者 ID，再批量查询用户信息，最后按 ID 顺序回填。
// 协同者缺失时不报错，列表正常返回。
func (s *Service) fillListItemCollaborators(ctx context.Context, dtos []PostListItemDTO) {
	if len(dtos) == 0 || s.userRepo == nil {
		return
	}
	ids := make([]shared.ID, 0, len(dtos))
	for _, d := range dtos {
		if id, err := shared.ParseID(d.ID); err == nil {
			ids = append(ids, id)
		}
	}
	if len(ids) == 0 {
		return
	}
	groups, err := s.repo.FindCollaboratorIDsByPostIDs(ctx, ids)
	if err != nil {
		return // 协同者 ID 查询失败不阻塞文章列表
	}

	// 收集所有协同者 ID 用于批量查用户信息
	seen := make(map[string]struct{})
	allIDs := make([]shared.ID, 0)
	for _, cids := range groups {
		for _, cid := range cids {
			key := cid.String()
			if _, ok := seen[key]; ok {
				continue
			}
			seen[key] = struct{}{}
			allIDs = append(allIDs, cid)
		}
	}
	if len(allIDs) == 0 {
		return
	}

	users, err := s.userRepo.FindByIDs(ctx, allIDs)
	if err != nil {
		return // 协同者信息缺失不阻塞文章列表
	}
	userMap := usersToAuthorMap(users)

	for i := range dtos {
		cids, ok := groups[dtos[i].ID]
		if !ok || len(cids) == 0 {
			continue
		}
		if collaborators := buildCollaboratorsFromUserMap(cids, userMap); len(collaborators) > 0 {
			dtos[i].Collaborators = collaborators
		}
	}
}

// usersToAuthorMap 将 user 列表转为按 ID 索引的 AuthorDTO map。
func usersToAuthorMap(users []*userdomain.User) map[string]*AuthorDTO {
	authors := make(map[string]*AuthorDTO, len(users))
	for _, u := range users {
		authors[u.GetID().String()] = &AuthorDTO{
			Username:  u.Username().String(),
			AvatarURL: u.AvatarURL(),
		}
	}
	return authors
}

// buildCollaboratorsFromUserMap 按 ids 顺序从 userMap 中提取协同者 DTO。
// 调用方已批量查询好用户信息；本 helper 只负责按 ID 顺序组装并过滤缺失用户。
func buildCollaboratorsFromUserMap(ids []shared.ID, userMap map[string]*AuthorDTO) []*AuthorDTO {
	collaborators := make([]*AuthorDTO, 0, len(ids))
	for _, id := range ids {
		if u, ok := userMap[id.String()]; ok {
			collaborators = append(collaborators, u)
		}
	}
	return collaborators
}
