package gorm

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"

	domainfriendlink "blog-api/internal/domain/friendlink"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// FriendLinkRepository 友链仓储 GORM 实现。
type FriendLinkRepository struct {
	db *gorm.DB
}

// NewFriendLinkRepository 构造仓储。
func NewFriendLinkRepository(db *gorm.DB) *FriendLinkRepository {
	return &FriendLinkRepository{db: db}
}

// Save 保存友链（按主键 upsert，创建与状态转换/编辑共用）。
func (r *FriendLinkRepository) Save(ctx context.Context, f *domainfriendlink.FriendLink) error {
	po := friendlinkToPO(f)
	if err := r.db.WithContext(ctx).Save(&po).Error; err != nil {
		return domainshared.Internal("保存友链失败", err)
	}
	return nil
}

// FindByID 按 ID 查找友链。
func (r *FriendLinkRepository) FindByID(ctx context.Context, id domainshared.ID) (*domainfriendlink.FriendLink, error) {
	var po model.FriendLink
	if err := r.db.WithContext(ctx).First(&po, "id = ?", id.UUID()).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domainfriendlink.ErrNotFound
		}
		return nil, domainshared.Internal("查询友链失败", err)
	}
	return friendlinkToDomain(po), nil
}

// FindApproved 前台公开列表：仅 approved，按 sort_order 升序（同权重 created_at DESC）。
func (r *FriendLinkRepository) FindApproved(ctx context.Context) ([]*domainfriendlink.FriendLink, error) {
	var pos []model.FriendLink
	if err := r.db.WithContext(ctx).
		Where("status = ?", domainfriendlink.StatusApproved).
		Order("sort_order ASC, created_at DESC").
		Find(&pos).Error; err != nil {
		return nil, domainshared.Internal("查询友链列表失败", err)
	}
	return friendlinkPOsToDomain(pos), nil
}

// FindPage 后台列表分页：按状态筛选（空串 = 全部），created_at DESC + id DESC tiebreaker。
func (r *FriendLinkRepository) FindPage(ctx context.Context, filter domainfriendlink.ListFilter, q domainshared.PageQuery) (domainshared.PageResult[*domainfriendlink.FriendLink], error) {
	q = q.Normalize()
	query := r.db.WithContext(ctx).Model(&model.FriendLink{})
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	var pos []model.FriendLink
	total, err := countAndFind(query.Order("created_at DESC, id DESC"), q, &pos, "友链")
	if err != nil {
		return domainshared.PageResult[*domainfriendlink.FriendLink]{}, err
	}
	return domainshared.NewPageResult(q, friendlinkPOsToDomain(pos), total), nil
}

// CountPending 待审核计数（后台菜单角标）。
func (r *FriendLinkRepository) CountPending(ctx context.Context) (int64, error) {
	var count int64
	if err := r.db.WithContext(ctx).Model(&model.FriendLink{}).
		Where("status = ?", domainfriendlink.StatusPending).
		Count(&count).Error; err != nil {
		return 0, domainshared.Internal("统计待审核友链失败", err)
	}
	return count, nil
}

// CountPendingByIdentity 业务配额：同一 (ip_hash, contact_email) 的 pending 申请数。
// 与迁移 076 的 uniq_friendlinks_pending_identity 部分唯一索引同语义（索引兜底并发）。
func (r *FriendLinkRepository) CountPendingByIdentity(ctx context.Context, ipHash, contactEmail string) (int64, error) {
	var count int64
	if err := r.db.WithContext(ctx).Model(&model.FriendLink{}).
		Where("status = ? AND ip_hash = ? AND contact_email = ?", domainfriendlink.StatusPending, ipHash, contactEmail).
		Count(&count).Error; err != nil {
		return 0, domainshared.Internal("统计友链申请配额失败", err)
	}
	return count, nil
}

// ExistsActiveByURL URL 占用检查：存在非 rejected 记录占用该 url 即返回 true。
// 与迁移 076 的 uniq_friendlinks_url_active 部分唯一索引同语义。
// excludeID 非零时排除自身（后台编辑场景）。
func (r *FriendLinkRepository) ExistsActiveByURL(ctx context.Context, url string, excludeID domainshared.ID) (bool, error) {
	query := r.db.WithContext(ctx).Model(&model.FriendLink{}).
		Where("url = ? AND status != ?", url, domainfriendlink.StatusRejected)
	if excludeID != (domainshared.ID{}) {
		query = query.Where("id != ?", excludeID.UUID())
	}
	var count int64
	if err := query.Count(&count).Error; err != nil {
		return false, domainshared.Internal("检查友链 URL 占用失败", err)
	}
	return count > 0, nil
}

// Delete 物理删除友链（任意状态可删；追溯靠审计事件，不留尸）。
func (r *FriendLinkRepository) Delete(ctx context.Context, id domainshared.ID) error {
	res := r.db.WithContext(ctx).Where("id = ?", id.UUID()).Delete(&model.FriendLink{})
	if res.Error != nil {
		return domainshared.Internal("删除友链失败", res.Error)
	}
	if res.RowsAffected == 0 {
		return domainfriendlink.ErrNotFound
	}
	return nil
}

// friendlinkToPO 领域实体 → 持久化模型。
func friendlinkToPO(f *domainfriendlink.FriendLink) model.FriendLink {
	po := model.FriendLink{
		ID:           f.ID().UUID(),
		Name:         f.Name(),
		URL:          f.URL(),
		AvatarURL:    f.AvatarURL(),
		Description:  f.Description(),
		OwnerName:    f.OwnerName(),
		LinkbackURL:  f.LinkbackURL(),
		ContactEmail: f.ContactEmail(),
		Status:       f.Status(),
		SortOrder:    f.SortOrder(),
		IPHash:       f.IPHash(),
	}
	// user_id 仅登录申请者有值；匿名申请与手动添加为 nil（DB 列允许 NULL）。
	if u := f.UserID(); u != nil {
		uid := u.UUID()
		po.UserID = &uid
	}
	if t := f.CreatedAt(); !t.IsZero() {
		po.CreatedAt = t
		po.UpdatedAt = f.UpdatedAt()
	} else {
		po.CreatedAt = time.Now()
		po.UpdatedAt = time.Now()
	}
	return po
}

// friendlinkToDomain 持久化模型 → 领域实体。
func friendlinkToDomain(po model.FriendLink) *domainfriendlink.FriendLink {
	var userID *domainshared.ID
	if po.UserID != nil {
		uid := domainshared.MustParseID(po.UserID.String())
		userID = &uid
	}
	return domainfriendlink.ReconstructFriendLink(
		domainshared.MustParseID(po.ID.String()),
		userID,
		po.Name, po.URL, po.AvatarURL, po.Description, po.OwnerName,
		po.LinkbackURL, po.ContactEmail, po.Status, po.SortOrder, po.IPHash,
		po.CreatedAt, po.UpdatedAt,
	)
}

// friendlinkPOsToDomain 批量转换。
func friendlinkPOsToDomain(pos []model.FriendLink) []*domainfriendlink.FriendLink {
	result := make([]*domainfriendlink.FriendLink, 0, len(pos))
	for _, po := range pos {
		result = append(result, friendlinkToDomain(po))
	}
	return result
}

// 编译期断言：仓储实现满足领域接口。
var _ domainfriendlink.FriendLinkRepository = (*FriendLinkRepository)(nil)
