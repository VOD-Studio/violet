package roadmap

import (
	"context"
	"time"

	appproject "blog-api/internal/application/project"
	appshared "blog-api/internal/application/shared"
	"blog-api/internal/domain/permission"
	domainproject "blog-api/internal/domain/project"
	domain "blog-api/internal/domain/roadmap"
	"blog-api/internal/domain/shared"
	"blog-api/internal/middleware"

	"github.com/rs/zerolog/log"
)

var siteLocation = time.FixedZone("Asia/Shanghai", 8*60*60)

type Service struct {
	repo     domain.Repository
	projects domainproject.ProjectRepository
	checker  PermissionChecker
	bus      appshared.EventBus
	now      func() time.Time
}

func NewService(repo domain.Repository, projects domainproject.ProjectRepository, checker PermissionChecker, bus appshared.EventBus) *Service {
	return &Service{repo: repo, projects: projects, checker: checker, bus: bus, now: time.Now}
}

// GetBySlug 公开读取项目、全部未删除条目与同一口径的进度概览。
func (s *Service) GetBySlug(ctx context.Context, slug string) (DetailDTO, error) {
	if !domainproject.IsValidSlug(slug) {
		return DetailDTO{}, domainproject.ErrNotFound
	}
	project, err := s.projects.FindBySlug(ctx, slug)
	if err != nil {
		return DetailDTO{}, err
	}
	items, err := s.repo.FindByProject(ctx, project.ID())
	if err != nil {
		return DetailDTO{}, err
	}
	dtos := make([]ItemDTO, 0, len(items))
	for _, item := range items {
		dtos = append(dtos, toDTO(item))
	}
	return DetailDTO{Project: appproject.ToDTO(project), Items: dtos, Progress: progressOf(items)}, nil
}

func (s *Service) Create(ctx context.Context, projectID string, in CreateInput) (ItemDTO, error) {
	if err := requireProjectUpdate(ctx, s.checker); err != nil {
		return ItemDTO{}, err
	}
	pid, err := parseID(projectID)
	if err != nil {
		return ItemDTO{}, err
	}
	stage := domain.Stage(in.Stage)
	if stage == "" {
		stage = domain.Planned
	}
	content, err := makeContent(in.Title, in.Description, in.Tags, in.Links, in.CompletionDate, in.DeliveredVersion)
	if err != nil {
		return ItemDTO{}, err
	}
	var item *domain.Item
	err = s.repo.WithinProject(ctx, pid, func(repo domain.Repository) error {
		items, err := repo.FindByProject(ctx, pid)
		if err != nil {
			return err
		}
		position, err := domain.PositionBetween(lastPosition(items, stage, shared.ID{}), "")
		if err != nil {
			return err
		}
		number, err := repo.NextNumber(ctx, pid)
		if err != nil {
			return err
		}
		item, err = domain.NewItem(shared.NewID(), pid, number, content, stage, position, s.now().In(siteLocation))
		if err != nil {
			return err
		}
		return repo.Save(ctx, item)
	})
	if err != nil {
		return ItemDTO{}, err
	}
	s.publishEvents(ctx, item)
	return toDTO(item), nil
}

// Update 全量替换内容；未传完成日期时保留旧值，阶段与排序不受影响。
func (s *Service) Update(ctx context.Context, projectID, itemID string, in UpdateInput) (ItemDTO, error) {
	if err := requireProjectUpdate(ctx, s.checker); err != nil {
		return ItemDTO{}, err
	}
	pid, id, err := parseIDs(projectID, itemID)
	if err != nil {
		return ItemDTO{}, err
	}
	content, err := makeContent(in.Title, in.Description, in.Tags, in.Links, in.CompletionDate, in.DeliveredVersion)
	if err != nil {
		return ItemDTO{}, err
	}
	var item *domain.Item
	err = s.repo.WithinProject(ctx, pid, func(repo domain.Repository) error {
		item, err = findProjectItem(ctx, repo, pid, id, false)
		if err != nil {
			return err
		}
		if in.CompletionDate == nil {
			content.CompletionDate = item.CompletionDate()
		}
		if err := item.UpdateContent(content, s.now().In(siteLocation)); err != nil {
			return err
		}
		if !item.HasEvents() {
			return nil
		}
		return repo.Save(ctx, item)
	})
	if err != nil {
		return ItemDTO{}, err
	}
	s.publishEvents(ctx, item)
	return toDTO(item), nil
}

func requireProjectUpdate(ctx context.Context, checker PermissionChecker) error {
	if middleware.GetUserID(ctx) == "" {
		return shared.Unauthorized("请先登录")
	}
	if checker == nil || !checker.HasPermission(middleware.GetUserRole(ctx), middleware.GetUserIsRoot(ctx), permission.ProjectUpdate.String()) {
		return shared.Forbidden("需要项目更新权限")
	}
	return nil
}

func parseID(raw string) (shared.ID, error) {
	id, err := shared.ParseID(raw)
	if err != nil || id.IsZero() {
		return shared.ID{}, shared.BadRequest("路线图标识格式无效")
	}
	return id, nil
}

func parseIDs(projectID, itemID string) (shared.ID, shared.ID, error) {
	pid, err := parseID(projectID)
	if err != nil {
		return shared.ID{}, shared.ID{}, err
	}
	id, err := parseID(itemID)
	return pid, id, err
}

func makeContent(title, description string, tags []string, links []LinkDTO, date *string, version string) (domain.Content, error) {
	content := domain.Content{Title: title, Description: description, Tags: tags, DeliveredVersion: version,
		Links: make([]domain.Link, 0, len(links))}
	for _, link := range links {
		content.Links = append(content.Links, domain.Link{Label: link.Label, URL: link.URL})
	}
	if date != nil {
		parsed, err := time.Parse(time.DateOnly, *date)
		if err != nil {
			return domain.Content{}, shared.BadRequest("完成日期必须为 YYYY-MM-DD")
		}
		content.CompletionDate = &parsed
	}
	return content, nil
}

func findProjectItem(ctx context.Context, repo domain.Repository, projectID, itemID shared.ID, includeDeleted bool) (*domain.Item, error) {
	item, err := repo.FindByID(ctx, itemID, includeDeleted)
	if err != nil {
		return nil, err
	}
	if !item.ProjectID().Equal(projectID) {
		return nil, domain.ErrNotFound
	}
	return item, nil
}

func lastPosition(items []*domain.Item, stage domain.Stage, excluding shared.ID) string {
	last := ""
	for _, item := range items {
		if item.Stage() == stage && !item.ID().Equal(excluding) && item.Position() > last {
			last = item.Position()
		}
	}
	return last
}

func (s *Service) publishEvents(ctx context.Context, item *domain.Item) {
	events := item.PullEvents()
	if len(events) == 0 || s.bus == nil {
		return
	}
	if err := s.bus.Publish(ctx, events); err != nil {
		log.Warn().Err(err).Msg("发布路线图事件失败")
	}
}
