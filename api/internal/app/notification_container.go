package app

import (
	"context"

	"github.com/google/uuid"
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
	StreamHandler       *notificationhttp.StreamHandler
}

// NewNotificationContainer 装配通知模块（领域 + 仓储 + subscriber + handler）。
//
// subRepo / commentRepo 从 db 构造（GORM 仓储无状态，多实例安全）。
// subscriber 订阅 bus 消费领域事件 → 写通知，平行于审计 subscriber。
func NewNotificationContainer(db *gorm.DB, bus appshared.EventBus) *NotificationContainer {
	repo := gormrepo.NewNotificationRepository(db)
	svc := appnotification.NewService(repo, nil)
	handler := notificationhttp.NewHandler(svc)

	// SSE 连接管理器 + 推送 subscriber
	connMgr := appnotification.NewConnectionManager(log.Logger)
	streamH := notificationhttp.NewStreamHandler(connMgr, svc)

	// 接收者解析适配器（实现 application/notification 的 lookup 接口）
	subLookup := &subscriptionOwnerAdapter{repo: gormrepo.NewSubscriptionRepository(db)}
	commentLookup := &commentAuthorAdapter{repo: gormrepo.NewCommentRepository(db)}
	adminLookup := &adminUserAdapter{db: db}
	friendlinkLookup := &friendlinkApplicantAdapter{db: db}
	postAuthorLookup := &commentPostAuthorAdapter{db: db}

	// 通知 subscriber 订阅事件总线（带 SSE 推送）
	subscriber := appnotification.NewPushingSubscriber(repo, subLookup, commentLookup, adminLookup, friendlinkLookup, postAuthorLookup, connMgr, log.Logger)
	subscriber.Subscribe(bus)

	return &NotificationContainer{
		NotificationService: svc,
		NotificationHandler: handler,
		StreamHandler:       streamH,
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

// friendlinkApplicantAdapter 查询友链登录申请者（匿名申请 user_id 为 NULL）。
type friendlinkApplicantAdapter struct {
	db *gorm.DB
}

func (a *friendlinkApplicantAdapter) FindApplicantID(ctx context.Context, linkID domainshared.ID) (*domainshared.ID, error) {
	var uid *uuid.UUID
	err := a.db.WithContext(ctx).
		Table("friendlinks").
		Select("user_id").
		Where("id = ?", linkID.UUID()).
		Limit(1).
		Scan(&uid).Error
	if err != nil {
		return nil, domainshared.Internal("查询友链申请者失败", err)
	}
	if uid == nil {
		return nil, nil
	}
	id := domainshared.IDFromUUID(*uid)
	return &id, nil
}

// commentPostAuthorAdapter 通过 comments JOIN posts 解析文章作者。
// 排除软删文章：评论挂在已删文章下时不该再通知作者。
type commentPostAuthorAdapter struct {
	db *gorm.DB
}

func (a *commentPostAuthorAdapter) FindPostAuthorID(ctx context.Context, commentID domainshared.ID) (*domainshared.ID, error) {
	var uid *uuid.UUID
	err := a.db.WithContext(ctx).
		Table("comments").
		Select("posts.author_id").
		Joins("JOIN posts ON posts.id = comments.post_id AND posts.deleted_at IS NULL").
		Where("comments.id = ?", commentID.UUID()).
		Limit(1).
		Scan(&uid).Error
	if err != nil {
		return nil, domainshared.Internal("查询文章作者失败", err)
	}
	if uid == nil {
		return nil, nil
	}
	id := domainshared.IDFromUUID(*uid)
	return &id, nil
}

// adminUserAdapter 查询管理员用户（root 或 admin/superadmin 角色）。
type adminUserAdapter struct {
	db *gorm.DB
}

func (a *adminUserAdapter) FindAdminIDs(ctx context.Context) ([]domainshared.ID, error) {
	var ids []uuid.UUID
	err := a.db.WithContext(ctx).
		Table("users").
		Where("is_active = true AND (is_root = true OR role IN ('admin', 'superadmin'))").
		Pluck("id", &ids).Error
	if err != nil {
		return nil, domainshared.Internal("查询管理员用户失败", err)
	}
	result := make([]domainshared.ID, 0, len(ids))
	for _, u := range ids {
		result = append(result, domainshared.IDFromUUID(u))
	}
	return result, nil
}
