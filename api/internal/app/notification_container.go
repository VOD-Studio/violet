package app

import (
	"context"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"

	appnotification "blog-api/internal/application/notification"
	appshared "blog-api/internal/application/shared"
	domaincomment "blog-api/internal/domain/comment"
	domainshared "blog-api/internal/domain/shared"
	domainsubscription "blog-api/internal/domain/subscription"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	notificationhttp "blog-api/internal/interfaces/http/handler/notification"
)

// NotificationContainer 通知模块容器。
type NotificationContainer struct {
	NotificationService *appnotification.Service
	NotificationHandler *notificationhttp.Handler
}

// NewNotificationContainer 装配通知模块（领域 + 仓储 + subscriber + handler）。
//
// subRepo / commentRepo 从 db 构造（GORM 仓储无状态，多实例安全）。
// subscriber 订阅 bus 消费领域事件 → 写通知，平行于审计 subscriber。
func NewNotificationContainer(db *gorm.DB, bus appshared.EventBus) *NotificationContainer {
	repo := gormrepo.NewNotificationRepository(db)
	svc := appnotification.NewService(repo, nil)
	handler := notificationhttp.NewHandler(svc)

	// 接收者解析适配器（实现 application/notification 的 lookup 接口）
	subLookup := &subscriptionOwnerAdapter{repo: gormrepo.NewSubscriptionRepository(db)}
	commentLookup := &commentAuthorAdapter{repo: gormrepo.NewCommentRepository(db)}
	adminLookup := &adminUserAdapter{db: db}

	// 通知 subscriber 订阅事件总线
	subscriber := appnotification.NewSubscriber(repo, subLookup, commentLookup, adminLookup, log.Logger)
	subscriber.Subscribe(bus)

	return &NotificationContainer{
		NotificationService: svc,
		NotificationHandler: handler,
	}
}

// --- lookup 适配器 ---

// subscriptionOwnerAdapter 用订阅仓储解析所有者。
type subscriptionOwnerAdapter struct {
	repo domainsubscription.SubscriptionRepository
}

func (a *subscriptionOwnerAdapter) FindOwnerID(ctx context.Context, subID domainshared.ID) (domainshared.ID, error) {
	sub, err := a.repo.FindByIDForSchedule(ctx, subID)
	if err != nil {
		return domainshared.ID{}, err
	}
	return sub.UserID(), nil
}

// commentAuthorAdapter 用评论仓储解析作者。
type commentAuthorAdapter struct {
	repo domaincomment.CommentRepository
}

func (a *commentAuthorAdapter) FindAuthorID(ctx context.Context, commentID domainshared.ID) (*domainshared.ID, error) {
	c, err := a.repo.FindByID(ctx, commentID)
	if err != nil {
		return nil, err
	}
	return c.UserID(), nil
}

// adminUserAdapter 查询管理员用户（root 或 admin/superadmin 角色）。
type adminUserAdapter struct {
	db *gorm.DB
}

func (a *adminUserAdapter) FindAdminIDs(ctx context.Context) ([]domainshared.ID, error) {
	var ids []string
	err := a.db.WithContext(ctx).
		Table("users").
		Select("id::text").
		Where("is_active = true AND (is_root = true OR role IN ('admin', 'superadmin'))").
		Pluck("id::text", &ids).Error
	if err != nil {
		return nil, domainshared.Internal("查询管理员用户失败", err)
	}
	result := make([]domainshared.ID, 0, len(ids))
	for _, idStr := range ids {
		id, err := domainshared.ParseID(idStr)
		if err != nil {
			continue
		}
		result = append(result, id)
	}
	return result, nil
}
