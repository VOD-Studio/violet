package gorm

import (
	"context"
	"errors"
	"time"

	"github.com/lib/pq"
	"gorm.io/datatypes"
	"gorm.io/gorm"

	"blog-api/internal/domain/announcement"
	"blog-api/internal/domain/project"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// ============================================================
// AnnouncementRepository
// ============================================================

// AnnouncementRepository 公告仓储 GORM 实现
type AnnouncementRepository struct {
	db *gorm.DB
}

func NewAnnouncementRepository(db *gorm.DB) *AnnouncementRepository {
	return &AnnouncementRepository{db: db}
}

func announcementToPO(a *announcement.Announcement) model.Announcement {
	po := model.Announcement{
		ID: a.ID(), Title: a.Title(), Content: a.Content(),
		Type: a.Severity(), Display: a.Display(), IsActive: a.IsActive(),
		SortOrder: a.SortOrder(),
		ContentMD: a.ContentMD(), ContentHTML: a.ContentHTML(),
		CoverImage: a.CoverImage(), Excerpt: a.Excerpt(),
	}
	if s := a.StartTime(); s != nil {
		po.StartTime = s
	}
	if e := a.EndTime(); e != nil {
		po.EndTime = e
	}
	if affects := a.Affects(); len(affects) > 0 {
		po.Affects = datatypes.JSONSlice[string](affects)
	}
	if c := a.CreatedAt(); !c.IsZero() {
		po.CreatedAt = c
		po.UpdatedAt = a.UpdatedAt()
	} else {
		po.CreatedAt = time.Now()
		po.UpdatedAt = time.Now()
	}
	return po
}

func announcementToDomain(po model.Announcement) (*announcement.Announcement, error) {
	var createdBy *domainshared.ID // simplified: not tracking created_by in domain
	return announcement.ReconstructAnnouncement(
		po.ID, po.Title, po.Content, po.Type, po.Display, po.IsActive,
		po.StartTime, po.EndTime, po.SortOrder, []string(po.Affects),
		po.ContentMD, po.ContentHTML, po.CoverImage, po.Excerpt,
		createdBy, po.CreatedAt, po.UpdatedAt,
	), nil
}

func (r *AnnouncementRepository) FindByID(ctx context.Context, id int32) (*announcement.Announcement, error) {
	var po model.Announcement
	if err := r.db.WithContext(ctx).First(&po, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, announcement.ErrNotFound
		}
		return nil, domainshared.Internal("查询公告失败", err)
	}
	return announcementToDomain(po)
}

func (r *AnnouncementRepository) FindAll(ctx context.Context) ([]*announcement.Announcement, error) {
	var pos []model.Announcement
	if err := r.db.WithContext(ctx).Order("sort_order ASC, created_at DESC").Find(&pos).Error; err != nil {
		return nil, domainshared.Internal("查询公告列表失败", err)
	}
	result := make([]*announcement.Announcement, 0, len(pos))
	for _, po := range pos {
		a, _ := announcementToDomain(po)
		result = append(result, a)
	}
	return result, nil
}

func (r *AnnouncementRepository) FindPage(ctx context.Context, q domainshared.PageQuery) (domainshared.PageResult[*announcement.Announcement], error) {
	q = q.Normalize()
	query := r.db.WithContext(ctx).Model(&model.Announcement{}).
		Order("sort_order ASC, created_at DESC, id ASC")
	var pos []model.Announcement
	total, err := countAndFind(query, q, &pos, "公告")
	if err != nil {
		return domainshared.PageResult[*announcement.Announcement]{}, err
	}
	result := make([]*announcement.Announcement, 0, len(pos))
	for _, po := range pos {
		a, _ := announcementToDomain(po)
		result = append(result, a)
	}
	return domainshared.NewPageResult(q, result, total), nil
}

func (r *AnnouncementRepository) FindActive(ctx context.Context) ([]*announcement.Announcement, error) {
	var pos []model.Announcement
	now := time.Now()
	query := r.db.WithContext(ctx).Where("is_active = ?", true).
		Where("start_time IS NULL OR start_time <= ?", now).
		Where("end_time IS NULL OR end_time >= ?", now).
		Order("sort_order ASC, created_at DESC")
	if err := query.Find(&pos).Error; err != nil {
		return nil, domainshared.Internal("查询活跃公告失败", err)
	}
	result := make([]*announcement.Announcement, 0, len(pos))
	for _, po := range pos {
		a, _ := announcementToDomain(po)
		result = append(result, a)
	}
	return result, nil
}

func (r *AnnouncementRepository) Save(ctx context.Context, a *announcement.Announcement) (int32, error) {
	po := announcementToPO(a)
	if po.ID == 0 {
		if err := r.db.WithContext(ctx).Create(&po).Error; err != nil {
			return 0, domainshared.Internal("创建公告失败", err)
		}
	} else {
		if err := r.db.WithContext(ctx).Save(&po).Error; err != nil {
			return 0, domainshared.Internal("保存公告失败", err)
		}
	}
	return po.ID, nil
}

func (r *AnnouncementRepository) Delete(ctx context.Context, id int32) error {
	result := r.db.WithContext(ctx).Delete(&model.Announcement{}, id)
	if result.Error != nil {
		return domainshared.Internal("删除公告失败", result.Error)
	}
	if result.RowsAffected == 0 {
		return announcement.ErrNotFound
	}
	return nil
}

var _ announcement.AnnouncementRepository = (*AnnouncementRepository)(nil)

// ============================================================
// ProjectRepository
// ============================================================

// ProjectRepository 项目仓储 GORM 实现
type ProjectRepository struct {
	db *gorm.DB
}

func NewProjectRepository(db *gorm.DB) *ProjectRepository {
	return &ProjectRepository{db: db}
}

func projectToPO(p *project.Project) model.Project {
	po := model.Project{
		ID: p.ID().UUID(), Title: p.Title(), Description: p.Description(),
		URL: p.URL(), GithubURL: p.GithubURL(), ImageURL: p.ImageURL(),
		TechStack: pq.StringArray(p.TechStack()), SortOrder: p.SortOrder(),
	}
	if c := p.CreatedAt(); !c.IsZero() {
		po.CreatedAt = c
		po.UpdatedAt = p.UpdatedAt()
	} else {
		po.CreatedAt = time.Now()
		po.UpdatedAt = time.Now()
	}
	return po
}

func projectToDomain(po model.Project) (*project.Project, error) {
	return project.ReconstructProject(
		domainshared.MustParseID(po.ID.String()),
		po.Title, po.Description, po.URL, po.GithubURL, po.ImageURL,
		[]string(po.TechStack), po.SortOrder, po.CreatedAt, po.UpdatedAt,
	), nil
}

func (r *ProjectRepository) FindByID(ctx context.Context, id domainshared.ID) (*project.Project, error) {
	var po model.Project
	if err := r.db.WithContext(ctx).First(&po, "id = ?", id.UUID()).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, project.ErrNotFound
		}
		return nil, domainshared.Internal("查询项目失败", err)
	}
	return projectToDomain(po)
}

func (r *ProjectRepository) FindAll(ctx context.Context) ([]*project.Project, error) {
	var pos []model.Project
	if err := r.db.WithContext(ctx).Order("sort_order ASC, created_at DESC").Find(&pos).Error; err != nil {
		return nil, domainshared.Internal("查询项目列表失败", err)
	}
	result := make([]*project.Project, 0, len(pos))
	for _, po := range pos {
		p, _ := projectToDomain(po)
		result = append(result, p)
	}
	return result, nil
}

func (r *ProjectRepository) FindPage(ctx context.Context, q domainshared.PageQuery) (domainshared.PageResult[*project.Project], error) {
	q = q.Normalize()
	query := r.db.WithContext(ctx).Model(&model.Project{}).
		Order("sort_order ASC, created_at DESC, id ASC")
	var pos []model.Project
	total, err := countAndFind(query, q, &pos, "项目")
	if err != nil {
		return domainshared.PageResult[*project.Project]{}, err
	}
	result := make([]*project.Project, 0, len(pos))
	for _, po := range pos {
		p, _ := projectToDomain(po)
		result = append(result, p)
	}
	return domainshared.NewPageResult(q, result, total), nil
}

func (r *ProjectRepository) Save(ctx context.Context, p *project.Project) error {
	po := projectToPO(p)
	if err := r.db.WithContext(ctx).Save(&po).Error; err != nil {
		return domainshared.Internal("保存项目失败", err)
	}
	return nil
}

func (r *ProjectRepository) Delete(ctx context.Context, id domainshared.ID) error {
	result := r.db.WithContext(ctx).Where("id = ?", id.UUID()).Delete(&model.Project{})
	if result.Error != nil {
		return domainshared.Internal("删除项目失败", result.Error)
	}
	if result.RowsAffected == 0 {
		return project.ErrNotFound
	}
	return nil
}

var _ project.ProjectRepository = (*ProjectRepository)(nil)
