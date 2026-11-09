package notification

import (
	"context"
	"fmt"

	"github.com/rs/zerolog"

	appshared "blog-api/internal/application/shared"
	domainapitoken "blog-api/internal/domain/api_token"
	domainchat "blog-api/internal/domain/chat"
	domaincomment "blog-api/internal/domain/comment"
	domainfriendlink "blog-api/internal/domain/friendlink"
	domainnotification "blog-api/internal/domain/notification"
	domainshared "blog-api/internal/domain/shared"
	domainsubscription "blog-api/internal/domain/subscription"
	domaintweet "blog-api/internal/domain/tweet"
	domainuser "blog-api/internal/domain/user"
	domainwindow "blog-api/internal/domain/window"
)

// --- 接收者解析端口（由 wiring 层适配现有仓储实现）---

// SubscriptionOwnerLookup 解析订阅所有者（订阅抓取失败通知用）。
type SubscriptionOwnerLookup interface {
	// FindOwnerID 返回订阅所有者的 userID。
	FindOwnerID(ctx context.Context, subscriptionID domainshared.ID) (domainshared.ID, error)
}

// CommentAuthorLookup 解析评论作者（评论审核通知用）。
type CommentAuthorLookup interface {
	// FindAuthorID 返回评论作者的 userID；nil 表示匿名评论（无通知接收者）。
	FindAuthorID(ctx context.Context, commentID domainshared.ID) (*domainshared.ID, error)
}

// CommentPostAuthorLookup 解析评论所属文章的作者（文章新评论通知用）。
type CommentPostAuthorLookup interface {
	// FindPostAuthorID 返回文章作者的 userID；nil 表示文章已删除等无接收者场景。
	FindPostAuthorID(ctx context.Context, commentID domainshared.ID) (*domainshared.ID, error)
}

// ActorLookup 解析行为人资料（互动通知标题与结构化行为人用）。
type ActorLookup interface {
	// FindActor 返回用户的展示名与头像；查不到时返回零值（调用方用兜底文案、不写行为人）。
	FindActor(ctx context.Context, userID domainshared.ID) Actor
}

// CommentContext 评论通知所需的评论与所属文章快照。
type CommentContext struct {
	// AuthorName 评论者昵称（登录态为资料快照，匿名为自填）
	AuthorName string
	// AuthorAvatarURL 评论者头像（匿名评论可为空）
	AuthorAvatarURL string
	// PostTitle 所属文章标题；文章已删除时为空
	PostTitle string
	// Content 评论正文
	Content string
}

// CommentContextLookup 解析评论正文与所属文章标题（评论通知的结构化字段用）。
type CommentContextLookup interface {
	FindCommentContext(ctx context.Context, commentID domainshared.ID) (CommentContext, error)
}

// AdminUserLookup 解析管理员用户（友链申请等 admin 通知用）。
type AdminUserLookup interface {
	// FindAdminIDs 返回应接收管理通知的用户 ID 列表。
	FindAdminIDs(ctx context.Context) ([]domainshared.ID, error)
}

// FriendLinkApplicantLookup 解析友链登录申请者（审核结果通知用）。
type FriendLinkApplicantLookup interface {
	// FindApplicantID 返回申请者的 userID；nil 表示匿名申请（无通知接收者）。
	FindApplicantID(ctx context.Context, friendlinkID domainshared.ID) (*domainshared.ID, error)
}

// Lookups 通知 subscriber 依赖的全部解析端口（由 wiring 层装配）。
//
// Actor / CommentContext 可为 nil：对应通知降级为不带结构化字段（行为人、评论上下文），
// 不影响其他类型。
type Lookups struct {
	SubscriptionOwner   SubscriptionOwnerLookup
	CommentAuthor       CommentAuthorLookup
	AdminUsers          AdminUserLookup
	FriendLinkApplicant FriendLinkApplicantLookup
	CommentPostAuthor   CommentPostAuthorLookup
	Actor               ActorLookup
	CommentContext      CommentContextLookup
}

// Subscriber 通知订阅者：消费领域事件 → 计算接收者 → 写通知。
//
// 镜像审计 subscriber 结构（通配订阅 + 按事件类型分发）。
// 写通知失败记降级日志（fail-safe），不阻断其他订阅者（EventBus 容错隔离）。
type Subscriber struct {
	store   domainnotification.NotificationRepository
	lookups Lookups
	log     zerolog.Logger
}

// NewSubscriber 构造通知订阅者。
func NewSubscriber(store domainnotification.NotificationRepository, lookups Lookups, log zerolog.Logger) *Subscriber {
	return &Subscriber{store: store, lookups: lookups, log: log}
}

// Subscribe 注册订阅者到事件总线（通配订阅，按事件类型分发）。
func (s *Subscriber) Subscribe(bus appshared.EventBus) {
	bus.Subscribe("", s.Handle)
}

// Handle 处理单个领域事件。
func (s *Subscriber) Handle(ctx context.Context, event domainshared.DomainEvent) error {
	s.persist(ctx, event)
	return nil
}

// persist 把事件映射为通知并逐行写库，返回成功写入的通知。
//
// 单行构造或写入失败只记日志并跳过该行，不影响同一事件的其他接收者。
func (s *Subscriber) persist(ctx context.Context, event domainshared.DomainEvent) []*domainnotification.Notification {
	actions, ok := s.mapEvent(ctx, event)
	if !ok || len(actions) == 0 {
		return nil
	}

	saved := make([]*domainnotification.Notification, 0, len(actions))
	for _, act := range actions {
		n, err := domainnotification.NewNotification(act.userID, domainshared.IDFromUUID(event.EventID()), act.sourceType, act.sourceID, act.title, act.body, act.fields.applyTo(act.payload))
		if err != nil {
			s.log.Error().Err(err).Str("event", event.EventName()).Msg("构造通知失败")
			continue
		}
		if err := s.store.Save(ctx, n); err != nil {
			s.log.Error().
				Err(err).
				Str("event", event.EventName()).
				Str("event_id", event.EventID().String()).
				Str("user_id", act.userID.String()).
				Msg("通知写入失败")
			continue
		}
		saved = append(saved, n)
	}
	return saved
}

// notifyAction 一次通知创建动作的中间数据。
type notifyAction struct {
	userID     domainshared.ID
	sourceType domainnotification.SourceType
	sourceID   domainshared.ID
	title      string
	body       string
	payload    map[string]any
	// fields 结构化字段，写入前合并进 payload 保留键
	fields structuredFields
}

// mapEvent 把领域事件映射为通知创建动作列表。
//
// 返回 ok=false 表示该事件类型不产生通知（静默跳过）。
func (s *Subscriber) mapEvent(ctx context.Context, event domainshared.DomainEvent) ([]notifyAction, bool) {
	switch e := event.(type) {
	case domainsubscription.SubscriptionFetched:
		return s.handleSubscriptionFetched(ctx, e)

	case domainfriendlink.FriendLinkCreated:
		return s.handleFriendlinkCreated(ctx, e)

	case domainfriendlink.FriendLinkApproved:
		return s.handleFriendlinkReviewed(ctx, e.AggregateID(), e.Name, e.Description, true)

	case domainfriendlink.FriendLinkRejected:
		return s.handleFriendlinkReviewed(ctx, e.AggregateID(), e.Name, e.Description, false)

	case domaincomment.CommentApproved:
		return s.handleCommentApproved(ctx, e)

	case domaincomment.CommentSpammed:
		return s.handleCommentSpammed(ctx, e)

	case domaincomment.CommentSubmitted:
		return s.handleCommentSubmitted(ctx, e)

	case domainuser.UserPasswordChanged:
		return s.handlePasswordChanged(e), true

	case domainuser.UserEmailChanged:
		return s.handleEmailChanged(e), true
	case domainapitoken.PATCreated:
		return s.handlePATCreated(e), true

	case domainapitoken.PATDeleted:
		return s.handlePATDeleted(e), true

	case domainuser.UserRoleChanged:
		return s.handleRoleChanged(e), true

	case domainuser.UserStatusChanged:
		return s.handleStatusChanged(e), true
	case domainuser.UserRegistered:
		return s.handleUserRegistered(ctx, e)

	case domaintweet.TweetLiked:
		return s.handleTweetLiked(ctx, e)

	case domaintweet.TweetQuoted:
		return s.handleTweetQuoted(ctx, e)

	case domaintweet.TweetCommented:
		return s.handleTweetCommented(ctx, e)

	case domainwindow.Knocked:
		return s.handleWindowKnocked(ctx, e)

	case domainchat.RoomInvited:
		return s.handleRoomInvited(ctx, e), true

	default:
		return nil, false
	}
}

// --- 账号安全通知（接收者即本人 = 聚合 ID，无需 lookup）---

func (s *Subscriber) selfSecurityAction(userID domainshared.ID, title, body string, payload map[string]any) []notifyAction {
	return []notifyAction{{
		userID:     userID,
		sourceType: domainnotification.SourceAccountSecurity,
		sourceID:   userID,
		title:      title,
		body:       body,
		payload:    payload,
	}}
}

func (s *Subscriber) handlePasswordChanged(e domainuser.UserPasswordChanged) []notifyAction {
	return s.selfSecurityAction(e.AggregateID(),
		"密码已修改",
		"如非本人操作，请立即重置密码并退出所有登录会话",
		map[string]any{"action": "password_changed"},
	)
}

func (s *Subscriber) handleEmailChanged(e domainuser.UserEmailChanged) []notifyAction {
	return s.selfSecurityAction(e.AggregateID(),
		"账号邮箱已修改",
		fmt.Sprintf("邮箱已由 %s 改为 %s。如非本人操作，请立即联系管理员", e.From, e.To),
		map[string]any{"action": "email_changed"},
	)
}
func (s *Subscriber) handlePATCreated(e domainapitoken.PATCreated) []notifyAction {
	return s.selfSecurityAction(e.AggregateID(),
		fmt.Sprintf("API Token「%s」已创建", e.Name),
		"如非本人操作，请立即删除该 Token 并修改密码",
		map[string]any{"action": "api_token_created", "name": e.Name},
	)
}

func (s *Subscriber) handlePATDeleted(e domainapitoken.PATDeleted) []notifyAction {
	return s.selfSecurityAction(e.AggregateID(),
		fmt.Sprintf("API Token「%s」已删除", e.Name),
		"",
		map[string]any{"action": "api_token_deleted", "name": e.Name},
	)
}

func (s *Subscriber) handleRoleChanged(e domainuser.UserRoleChanged) []notifyAction {
	return s.selfSecurityAction(e.AggregateID(),
		fmt.Sprintf("你的角色已变更为「%s」", e.To),
		fmt.Sprintf("原角色「%s」", e.From),
		map[string]any{"action": "role_changed", "from": string(e.From), "to": string(e.To), "username": e.UserName},
	)
}

func (s *Subscriber) handleStatusChanged(e domainuser.UserStatusChanged) []notifyAction {
	title := "你的账号已启用"
	if !e.To {
		title = "你的账号已被停用"
	}
	return s.selfSecurityAction(e.AggregateID(),
		title,
		"",
		map[string]any{"action": "status_changed", "active": e.To, "username": e.UserName},
	)
}

// --- 解析辅助 ---

// actorOf 取行为人资料；未装配或查不到时返回零值。
func (s *Subscriber) actorOf(ctx context.Context, userID domainshared.ID) Actor {
	if s.lookups.Actor == nil || userID.IsZero() {
		return Actor{}
	}
	return s.lookups.Actor.FindActor(ctx, userID)
}

// actorLabel 行为人在通知标题里的称呼；查不到时用兜底文案（标题不能出现空引号）。
func actorLabel(a Actor) string {
	if a.Name == "" {
		return "有人"
	}
	return a.Name
}

// commentContextOf 取评论上下文；失败只记日志——通知仍然发出，只是不带结构化字段。
func (s *Subscriber) commentContextOf(ctx context.Context, commentID domainshared.ID) CommentContext {
	if s.lookups.CommentContext == nil {
		return CommentContext{}
	}
	cc, err := s.lookups.CommentContext.FindCommentContext(ctx, commentID)
	if err != nil {
		s.log.Warn().Err(err).Str("comment_id", commentID.String()).Msg("解析评论上下文失败")
		return CommentContext{}
	}
	return cc
}

// commenterFields 评论类通知（给文章作者 / 管理员）：行为人是评论者。
func commenterFields(cc CommentContext) structuredFields {
	return structuredFields{
		actor:       Actor{Name: cc.AuthorName, AvatarURL: cc.AuthorAvatarURL},
		objectTitle: cc.PostTitle,
		quote:       cc.Content,
	}
}

// ownCommentFields 评论审核结果通知（给评论作者本人）：没有行为人，引用的是自己的评论。
func ownCommentFields(cc CommentContext) structuredFields {
	return structuredFields{objectTitle: cc.PostTitle, quote: cc.Content}
}

// --- 事件处理 ---

func (s *Subscriber) handleSubscriptionFetched(ctx context.Context, e domainsubscription.SubscriptionFetched) ([]notifyAction, bool) {
	// 通知规则：
	//   - 调度器自动（IsSystem=true）：仅失败通知
	//   - 手动触发（IsSystem=false）：成功/失败都通知（用户点了"立即抓取"，要等结果）
	if e.IsSystem && e.Error == "" {
		return nil, false
	}

	ownerID, err := s.lookups.SubscriptionOwner.FindOwnerID(ctx, e.AggregateID())
	if err != nil {
		s.log.Warn().Err(err).Str("subscription_id", e.AggregateID().String()).Msg("解析订阅所有者失败")
		return nil, false
	}

	var title, body string
	fields := structuredFields{objectTitle: e.Title}
	if e.Success {
		title = fmt.Sprintf("订阅「%s」抓取完成", e.Title)
		if e.Imported > 0 {
			body = fmt.Sprintf("新增 %d 篇文章", e.Imported)
		} else {
			body = "无新文章"
		}
	} else {
		title = fmt.Sprintf("订阅「%s」抓取失败", e.Title)
		body = e.Error
		fields.quote = e.Error
		if e.AutoPaused {
			body += "；已达失败阈值，订阅已自动暂停，恢复需到订阅管理手动操作"
		}
	}
	sourceType := domainnotification.SourceSubscriptionFailed
	if e.Success {
		sourceType = domainnotification.SourceSubscriptionSucceeded
	}
	return []notifyAction{{
		userID:     ownerID,
		sourceType: sourceType,
		sourceID:   e.AggregateID(),
		title:      title,
		body:       body,
		payload: map[string]any{
			"subscription_id": e.AggregateID().String(),
			"success":         e.Success,
			"imported":        e.Imported,
			"failed":          e.Failed,
		},
		fields: fields,
	}}, true
}

func (s *Subscriber) handleFriendlinkCreated(ctx context.Context, e domainfriendlink.FriendLinkCreated) ([]notifyAction, bool) {
	adminIDs, err := s.lookups.AdminUsers.FindAdminIDs(ctx)
	if err != nil {
		s.log.Warn().Err(err).Msg("解析管理员用户失败")
		return nil, false
	}

	actions := make([]notifyAction, 0, len(adminIDs))
	for _, adminID := range adminIDs {
		actions = append(actions, notifyAction{
			userID:     adminID,
			sourceType: domainnotification.SourceFriendLinkApplied,
			sourceID:   e.AggregateID(),
			title:      fmt.Sprintf("收到新友链申请「%s」", e.Name),
			body:       e.URL,
			payload:    map[string]any{"name": e.Name, "url": e.URL},
			fields:     structuredFields{objectTitle: e.Name, quote: e.Description},
		})
	}
	return actions, true
}

// handleFriendlinkReviewed 友链审核结果通知登录申请者；匿名申请无接收者跳过。
func (s *Subscriber) handleFriendlinkReviewed(ctx context.Context, linkID domainshared.ID, name, description string, approved bool) ([]notifyAction, bool) {
	applicantID, err := s.lookups.FriendLinkApplicant.FindApplicantID(ctx, linkID)
	if err != nil {
		s.log.Warn().Err(err).Str("friendlink_id", linkID.String()).Msg("解析友链申请者失败")
		return nil, false
	}
	if applicantID == nil {
		return nil, false
	}

	var title, body string
	if approved {
		title = fmt.Sprintf("你的友链申请「%s」已通过", name)
		body = "已上架到友链页"
	} else {
		title = fmt.Sprintf("你的友链申请「%s」未通过", name)
		body = "可调整站点信息后重新申请"
	}
	return []notifyAction{{
		userID:     *applicantID,
		sourceType: domainnotification.SourceFriendLinkReviewed,
		sourceID:   linkID,
		title:      title,
		body:       body,
		payload:    map[string]any{"name": name, "approved": approved},
		fields:     structuredFields{objectTitle: name, quote: description},
	}}, true
}

// handleCommentSpammed 评论被标垃圾 → 通知评论作者审核未通过；匿名评论跳过。
func (s *Subscriber) handleCommentSpammed(ctx context.Context, e domaincomment.CommentSpammed) ([]notifyAction, bool) {
	authorID, err := s.lookups.CommentAuthor.FindAuthorID(ctx, e.AggregateID())
	if err != nil {
		s.log.Warn().Err(err).Str("comment_id", e.AggregateID().String()).Msg("解析评论作者失败")
		return nil, false
	}
	if authorID == nil {
		return nil, false
	}

	return []notifyAction{{
		userID:     *authorID,
		sourceType: domainnotification.SourceCommentRejected,
		sourceID:   e.AggregateID(),
		title:      "你的评论未通过审核",
		body:       "",
		payload:    map[string]any{"comment_id": e.AggregateID().String()},
		fields:     ownCommentFields(s.commentContextOf(ctx, e.AggregateID())),
	}}, true
}

// handleCommentSubmitted 评论提交待审 → 通知管理员（与友链申请/新注册同通道）。
func (s *Subscriber) handleCommentSubmitted(ctx context.Context, e domaincomment.CommentSubmitted) ([]notifyAction, bool) {
	adminIDs, err := s.lookups.AdminUsers.FindAdminIDs(ctx)
	if err != nil {
		s.log.Warn().Err(err).Msg("解析管理员用户失败")
		return nil, false
	}

	fields := commenterFields(s.commentContextOf(ctx, e.AggregateID()))
	actions := make([]notifyAction, 0, len(adminIDs))
	for _, adminID := range adminIDs {
		actions = append(actions, notifyAction{
			userID:     adminID,
			sourceType: domainnotification.SourceCommentPending,
			sourceID:   e.AggregateID(),
			title:      "有新评论待审核",
			body:       "",
			payload:    map[string]any{"comment_id": e.AggregateID().String()},
			fields:     fields,
		})
	}
	return actions, true
}

// handleUserRegistered 新用户注册通知管理员（复用 adminLookup，与友链申请同通道）。
func (s *Subscriber) handleUserRegistered(ctx context.Context, e domainuser.UserRegistered) ([]notifyAction, bool) {
	adminIDs, err := s.lookups.AdminUsers.FindAdminIDs(ctx)
	if err != nil {
		s.log.Warn().Err(err).Msg("解析管理员用户失败")
		return nil, false
	}

	fields := structuredFields{actor: s.actorOf(ctx, e.AggregateID())}
	actions := make([]notifyAction, 0, len(adminIDs))
	for _, adminID := range adminIDs {
		actions = append(actions, notifyAction{
			userID:     adminID,
			sourceType: domainnotification.SourceUserRegistered,
			sourceID:   e.AggregateID(),
			title:      "新用户注册",
			body:       e.Email.String(),
			payload:    map[string]any{"user_id": e.AggregateID().String(), "email": e.Email.String()},
			fields:     fields,
		})
	}
	return actions, true
}

// handleWindowKnocked 访客敲窗 → 通知全部管理员（站长）；频率已在路由层按访客限制。
// 敲窗是匿名行为，事件不带访客身份，故没有结构化字段。
func (s *Subscriber) handleWindowKnocked(ctx context.Context, e domainwindow.Knocked) ([]notifyAction, bool) {
	adminIDs, err := s.lookups.AdminUsers.FindAdminIDs(ctx)
	if err != nil {
		s.log.Warn().Err(err).Msg("解析管理员用户失败")
		return nil, false
	}
	where := "首页"
	if e.Page != "/" {
		where = " " + e.Page
	}
	actions := make([]notifyAction, 0, len(adminIDs))
	for _, adminID := range adminIDs {
		actions = append(actions, notifyAction{
			userID:     adminID,
			sourceType: domainnotification.SourceWindowKnocked,
			sourceID:   e.AggregateID(),
			title:      "有人敲了敲窗",
			body:       "在" + where,
			payload:    map[string]any{"page": e.Page},
		})
	}
	return actions, true
}

// handleRoomInvited 私有房间邀请 → 通知被邀请人；行为人是邀请人。
func (s *Subscriber) handleRoomInvited(ctx context.Context, e domainchat.RoomInvited) []notifyAction {
	return []notifyAction{{
		userID:     e.InviteeID,
		sourceType: domainnotification.SourceChatRoomInvited,
		sourceID:   e.AggregateID(),
		title:      "新的聊天邀请",
		body:       fmt.Sprintf("你被邀请加入「%s」", e.Title),
		payload: map[string]any{
			"conversation_id": e.AggregateID().String(),
		},
		fields: structuredFields{actor: s.actorOf(ctx, e.InviterID), objectTitle: e.Title},
	}}
}

// handleCommentApproved 评论审核通过 → 双接收者：评论作者（comment_approved）
// 与文章作者（comment_created，自评跳过）。
// Auto（免审自动通过）跳过评论作者通知——刚发完就收到「已审核通过」是噪音；
// 文章作者的新评论通知不受影响。
func (s *Subscriber) handleCommentApproved(ctx context.Context, e domaincomment.CommentApproved) ([]notifyAction, bool) {
	commentID := e.AggregateID()

	authorID, err := s.lookups.CommentAuthor.FindAuthorID(ctx, commentID)
	if err != nil {
		s.log.Warn().Err(err).Str("comment_id", commentID.String()).Msg("解析评论作者失败")
		return nil, false
	}

	cc := s.commentContextOf(ctx, commentID)
	actions := make([]notifyAction, 0, 2)
	if authorID != nil && !e.Auto {
		actions = append(actions, notifyAction{
			userID:     *authorID,
			sourceType: domainnotification.SourceCommentApproved,
			sourceID:   commentID,
			title:      "你的评论已审核通过",
			body:       "",
			payload:    map[string]any{"comment_id": commentID.String()},
			fields:     ownCommentFields(cc),
		})
	}

	postAuthorID, err := s.lookups.CommentPostAuthor.FindPostAuthorID(ctx, commentID)
	if err != nil {
		s.log.Warn().Err(err).Str("comment_id", commentID.String()).Msg("解析文章作者失败")
	} else if postAuthorID != nil && (authorID == nil || *postAuthorID != *authorID) {
		actions = append(actions, notifyAction{
			userID:     *postAuthorID,
			sourceType: domainnotification.SourceCommentCreated,
			sourceID:   commentID,
			title:      "你的文章收到新评论",
			body:       "",
			payload:    map[string]any{"comment_id": commentID.String()},
			fields:     commenterFields(cc),
		})
	}

	return actions, len(actions) > 0
}

// --- 推文互动通知 ---

// handleTweetLiked 推文被点赞 → 通知推文作者；自赞跳过。
func (s *Subscriber) handleTweetLiked(ctx context.Context, e domaintweet.TweetLiked) ([]notifyAction, bool) {
	if e.AuthorID == e.ActorID {
		return nil, false
	}
	actor := s.actorOf(ctx, e.ActorID)
	return []notifyAction{{
		userID:     e.AuthorID,
		sourceType: domainnotification.SourceTweetLiked,
		sourceID:   e.AggregateID(),
		title:      fmt.Sprintf("%s 赞了你的推文", actorLabel(actor)),
		body:       e.Excerpt,
		payload: map[string]any{
			"tweet_id": e.AggregateID().String(),
			"actor_id": e.ActorID.String(),
		},
		fields: structuredFields{actor: actor, objectTitle: e.Excerpt},
	}}, true
}

// handleTweetQuoted 推文被引用转发 → 通知被引用推文的作者；自引跳过。
func (s *Subscriber) handleTweetQuoted(ctx context.Context, e domaintweet.TweetQuoted) ([]notifyAction, bool) {
	if e.AuthorID == e.ActorID {
		return nil, false
	}
	actor := s.actorOf(ctx, e.ActorID)
	return []notifyAction{{
		userID:     e.AuthorID,
		sourceType: domainnotification.SourceTweetQuoted,
		sourceID:   e.AggregateID(),
		title:      fmt.Sprintf("%s 转发了你的推文", actorLabel(actor)),
		body:       e.Excerpt,
		payload: map[string]any{
			"tweet_id":       e.AggregateID().String(),
			"quote_tweet_id": e.QuoteTweetID.String(),
			"actor_id":       e.ActorID.String(),
		},
		fields: structuredFields{actor: actor, objectTitle: e.Excerpt, quote: e.QuoteExcerpt},
	}}, true
}

// handleTweetCommented 推文收到评论/回复 → 最多两个接收者：
// 被回复的评论作者（tweet_comment_replied）与推文作者（tweet_commented）。
//
// 去重规则：自我互动跳过；回复自己推文下别人的评论时，推文作者与评论者同人只发一条。
func (s *Subscriber) handleTweetCommented(ctx context.Context, e domaintweet.TweetCommented) ([]notifyAction, bool) {
	actor := s.actorOf(ctx, e.ActorID)
	name := actorLabel(actor)
	payload := map[string]any{
		"tweet_id":   e.AggregateID().String(),
		"comment_id": e.CommentID.String(),
		"actor_id":   e.ActorID.String(),
	}
	fields := structuredFields{actor: actor, objectTitle: e.TweetExcerpt, quote: e.Excerpt}

	actions := make([]notifyAction, 0, 2)
	if e.RepliedToAuthorID != nil && *e.RepliedToAuthorID != e.ActorID {
		actions = append(actions, notifyAction{
			userID:     *e.RepliedToAuthorID,
			sourceType: domainnotification.SourceTweetCommentReplied,
			sourceID:   e.AggregateID(),
			title:      fmt.Sprintf("%s 回复了你的评论", name),
			body:       e.Excerpt,
			payload:    payload,
			fields:     fields,
		})
	}
	// 推文作者已因「评论被回复」收到通知时不再重复推送同一条评论
	alreadyNotified := len(actions) > 0 && actions[0].userID == e.TweetAuthorID
	if e.TweetAuthorID != e.ActorID && !alreadyNotified {
		actions = append(actions, notifyAction{
			userID:     e.TweetAuthorID,
			sourceType: domainnotification.SourceTweetCommented,
			sourceID:   e.AggregateID(),
			title:      fmt.Sprintf("%s 评论了你的推文", name),
			body:       e.Excerpt,
			payload:    payload,
			fields:     fields,
		})
	}
	return actions, len(actions) > 0
}
