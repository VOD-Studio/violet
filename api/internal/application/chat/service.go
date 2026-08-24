package chat

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/rs/zerolog/log"

	appcustomemoji "blog-api/internal/application/customemoji"
	appshared "blog-api/internal/application/shared"
	domainchat "blog-api/internal/domain/chat"
	domainchatreaction "blog-api/internal/domain/chatreaction"
	domainshared "blog-api/internal/domain/shared"
	domaintweet "blog-api/internal/domain/tweet"
	domainupload "blog-api/internal/domain/upload"
	domainuser "blog-api/internal/domain/user"
)

const (
	defaultLimit = 20
	maxLimit     = 50
	cursorSep    = "|"
)

// Service 聊天用例服务。
type Service struct {
	repo         domainchat.ConversationRepository
	users        UserRepository
	files        FileRepository
	tweets       TweetRepository
	reactions    domainchatreaction.Store
	notifier     EventNotifier
	push         PushSender
	bus          appshared.EventBus
	now          func() time.Time
	publicKey    string
	customEmojis CustomEmojiResolver
}

// NewService 构造聊天服务。
// customEmojis 为 nil 时跳过消息正文中 [name:uuid] 自定义表情占位符的解析
// （仅限测试场景；生产容器必须注入，见 PRD-0020）。
func NewService(repo domainchat.ConversationRepository, users UserRepository, files FileRepository, notifier EventNotifier, push PushSender, publicKey string, now func() time.Time, bus appshared.EventBus, reactions domainchatreaction.Store, tweets TweetRepository, customEmojis CustomEmojiResolver) *Service {
	if now == nil {
		now = time.Now
	}
	if push == nil {
		push = NoopPushSender{}
	}
	return &Service{repo: repo, users: users, files: files, tweets: tweets, reactions: reactions, notifier: notifier, push: push, bus: bus, publicKey: publicKey, now: now, customEmojis: customEmojis}
}

// CreateConversationInput 创建会话入参。
type CreateConversationInput struct {
	// UserID 当前用户 ID。
	UserID domainshared.ID
	// Kind 会话形态。
	Kind domainchat.ConversationKind
	// Title 房间名称；私聊忽略。
	Title string
	// ParticipantIDs 其他参与者 ID。
	ParticipantIDs []domainshared.ID
}

// RenameConversationInput 修改房间名称入参。
type RenameConversationInput struct {
	// UserID 操作者 ID。
	UserID domainshared.ID
	// ConversationID 会话 ID。
	ConversationID domainshared.ID
	// Title 新房间名称。
	Title string
}

// SendMessageInput 发送消息入参。
type SendMessageInput struct {
	// UserID 当前用户 ID。
	UserID domainshared.ID
	// ConversationID 会话 ID。
	ConversationID domainshared.ID
	// Type 消息类型。
	Type domainchat.MessageType
	// Content 文本内容。
	Content string
	// MediaID 图片媒体 ID。
	MediaID domainshared.ID
	// SharedTweetID 分享消息引用的推文 ID；零值表示不分享推文。
	SharedTweetID domainshared.ID
	// ReplyToID 被引用的同会话消息 ID；零值表示不引用消息。
	ReplyToID domainshared.ID
	// IdempotencyKey 客户端发送幂等键。
	IdempotencyKey string
}

// AddMessageReactionInput 添加聊天消息反应入参。
type AddMessageReactionInput struct {
	// UserID 当前用户 ID。
	UserID domainshared.ID
	// ConversationID 所属会话 ID。
	ConversationID domainshared.ID
	// MessageID 目标消息 ID。
	MessageID domainshared.ID
	// EmojiID 表情 ID。
	EmojiID int32
}

// RemoveMessageReactionInput 移除聊天消息反应入参。
type RemoveMessageReactionInput struct {
	// UserID 当前用户 ID。
	UserID domainshared.ID
	// ConversationID 所属会话 ID。
	ConversationID domainshared.ID
	// MessageID 目标消息 ID。
	MessageID domainshared.ID
	// EmojiID 表情 ID。
	EmojiID int32
}

// MessageReactionDTO 消息反应聚合读模型。
type MessageReactionDTO struct {
	// EmojiID 表情 ID。
	EmojiID int32 `json:"emoji_id"`
	// EmojiName 表情名称。
	EmojiName string `json:"emoji_name"`
	// EmojiURL 表情静态图 URL。
	EmojiURL string `json:"emoji_url"`
	// GifURL 表情动图 URL；无动图时为空。
	GifURL string `json:"gif_url"`
	// Count 该表情的反应数量。
	Count int64 `json:"count"`
	// Self 当前用户是否已添加该表情。
	Self bool `json:"self"`
}

// UserDTO 用户公开资料读模型。
type UserDTO struct {
	// ID 用户 ID。
	ID string `json:"id"`
	// Username 用户名，用于寻址。
	Username string `json:"username"`
	// DisplayName 展示名，未设置时回退用户名。
	DisplayName string `json:"display_name"`
	// AvatarURL 头像地址。
	AvatarURL string `json:"avatar_url"`
}

// MediaDTO 图片媒体读模型。
type MediaDTO struct {
	// ID 媒体文件 ID。
	ID string `json:"id"`
	// URL 原图访问地址。
	URL string `json:"url"`
	// Thumbnail 缩略图地址。
	Thumbnail string `json:"thumbnail,omitempty"`
	// MIMEType 实际媒体类型。
	MIMEType string `json:"mime_type"`
	// Size 文件字节数。
	Size int64 `json:"size"`
	// Width 图片宽度。
	Width *int `json:"width,omitempty"`
	// Height 图片高度。
	Height *int `json:"height,omitempty"`
}

// SharedTweetDTO 分享到聊天的推文快照读模型。
//
// 不建外键：Author/Content/Images/CreatedAt 均在被分享推文物理删除后清空，仅保留 IsDeleted 占位标记
// （与 tweets.quote_of 对已删除被引用推文的处理同构，见 CONTEXT.md「推文分享消息」词条）。
type SharedTweetDTO struct {
	// ID 推文 ID。
	ID string `json:"id"`
	// Author 推文作者资料；推文已删除时为空。
	Author *UserDTO `json:"author,omitempty"`
	// Content 推文正文；推文已删除时为空。
	Content string `json:"content,omitempty"`
	// Images 推文图片 URL 列表；推文已删除时为空。
	Images []string `json:"images,omitempty"`
	// CreatedAt 推文创建时间；推文已删除时为空。
	CreatedAt string `json:"created_at,omitempty"`
	// IsDeleted 被分享的推文是否已被物理删除。
	IsDeleted bool `json:"is_deleted"`
}

// MemberDTO 会话成员读模型。
type MemberDTO struct {
	// User 成员用户资料。
	User UserDTO `json:"user"`
	// Role 成员角色。
	Role string `json:"role"`
	// JoinedAt 加入时间。
	JoinedAt string `json:"joined_at"`
	// IsMuted 当前用户是否静音该会话。
	IsMuted bool `json:"is_muted"`
}

// MessageDTO 消息读模型。
type MessageDTO struct {
	// ID 消息 ID。
	ID string `json:"id"`
	// ConversationID 所属会话 ID。
	ConversationID string `json:"conversation_id"`
	// Sender 发送者资料。
	Sender UserDTO `json:"sender"`
	// Type 消息类型。
	Type string `json:"type"`
	// Content 文本内容；删除消息为空。
	Content string `json:"content,omitempty"`
	// CustomEmote 正文中 [name:uuid] 自定义表情占位符的解析结果，key 为完整占位符
	// （含方括号，如 "[mycat:<uuid>]"）。命名/含义镜像评论域 Emote；系统表情
	// [name] 不在此列，继续走客户端全局 GET /emojis 路径解析（PRD-0020）。
	CustomEmote map[string]CustomEmojiRefDTO `json:"custom_emote,omitempty"`
	// Media 图片媒体；文本消息为空。
	Media *MediaDTO `json:"media,omitempty"`
	// SharedTweet 分享推文的动态快照；被分享推文物理删除后为已删除占位。
	SharedTweet *SharedTweetDTO `json:"shared_tweet,omitempty"`
	// ReplyTo 被引用消息的动态预览；原消息物理清理后为空。
	ReplyTo *MessageReferenceDTO `json:"reply_to,omitempty"`
	// Reactions 消息的聚合表情反应。
	Reactions []MessageReactionDTO `json:"reactions"`
	// IsDeleted 是否已被管理员删除。
	IsDeleted bool `json:"is_deleted"`
	// DeletedAt 删除时间。
	DeletedAt *string `json:"deleted_at,omitempty"`
	// CreatedAt 消息创建时间。
	CreatedAt string `json:"created_at"`
}

// MessageReferenceDTO 引用消息的紧凑读模型。
type MessageReferenceDTO struct {
	// ID 被引用消息 ID。
	ID string `json:"id"`
	// Sender 被引用消息发送者资料。
	Sender UserDTO `json:"sender"`
	// Type 被引用消息类型。
	Type string `json:"type"`
	// Content 被引用文本的最多 120 个 Unicode 字符预览。
	Content string `json:"content,omitempty"`
	// Media 被引用图片的媒体预览。
	Media *MediaDTO `json:"media,omitempty"`
	// IsDeleted 原消息是否已被管理员删除。
	IsDeleted bool `json:"is_deleted"`
}

// ConversationDTO 会话读模型。
type ConversationDTO struct {
	// ID 会话 ID。
	ID string `json:"id"`
	// Kind 会话形态。
	Kind string `json:"kind"`
	// Title 房间名称；私聊为空。
	Title string `json:"title"`
	// Owner 房主资料。
	Owner UserDTO `json:"owner"`
	// Members 当前有效成员。
	Members []MemberDTO `json:"members,omitempty"`
	// LastMessage 最近一条消息。
	LastMessage *MessageDTO `json:"last_message,omitempty"`
	// UnreadCount 当前用户未读数。
	UnreadCount int64 `json:"unread_count"`
	// CreatedAt 创建时间。
	CreatedAt string `json:"created_at"`
	// UpdatedAt 最近更新时间。
	UpdatedAt string `json:"updated_at"`
}

// EventDTO SSE 聊天事件信封。
type EventDTO struct {
	// ID 单调递增事件序号。
	ID string `json:"id"`
	// Type 事件类型。
	Type string `json:"type"`
	// Version 事件契约版本。
	Version int `json:"version"`
	// OccurredAt 事件发生时间。
	OccurredAt string `json:"occurred_at"`
	// Data 事件数据。
	Data map[string]any `json:"data"`
	// CustomEmote 新消息正文中自定义表情占位符的解析结果，key 为完整 token。
	// 关系按事件接收者计算；系统表情继续由客户端全局表情目录解析。
	CustomEmote map[string]CustomEmojiRefDTO `json:"custom_emote,omitempty"`
}

// ListResult 聊天列表 cursor 结果。
type ListResult[T any] struct {
	// Items 当前页数据。
	Items []T `json:"items"`
	// HasMore 是否还有下一页。
	HasMore bool `json:"has_more"`
	// NextCursor 下一页游标。
	NextCursor string `json:"next_cursor,omitempty"`
}

// ListConversations 列出当前用户会话。
func (s *Service) ListConversations(ctx context.Context, userID domainshared.ID, cursorValue string, limit int) (ListResult[ConversationDTO], error) {
	cursor, err := decodeConversationCursor(cursorValue)
	if err != nil {
		return ListResult[ConversationDTO]{}, err
	}
	limit = clampLimit(limit)
	rows, err := s.repo.ListForMember(ctx, userID, cursor, limit+1)
	if err != nil {
		return ListResult[ConversationDTO]{}, err
	}
	result := ListResult[ConversationDTO]{Items: make([]ConversationDTO, 0, min(len(rows), limit))}
	if len(rows) > limit {
		result.HasMore = true
		rows = rows[:limit]
	}
	for _, conversation := range rows {
		dto, err := s.conversationDTO(ctx, conversation, userID, true)
		if err != nil {
			return ListResult[ConversationDTO]{}, err
		}
		result.Items = append(result.Items, dto)
	}
	if result.HasMore && len(rows) > 0 {
		last := rows[len(rows)-1]
		result.NextCursor = encodeConversationCursor(domainchat.ConversationCursor{UpdatedAt: last.UpdatedAt, ID: last.ID()})
	}
	return result, nil
}

// CreateConversation 创建私聊或私有房间。
func (s *Service) CreateConversation(ctx context.Context, in CreateConversationInput) (ConversationDTO, error) {
	if in.UserID.IsZero() {
		return ConversationDTO{}, domainshared.Unauthorized("请先登录")
	}
	participants := uniqueIDs(in.ParticipantIDs)
	participants = withoutID(participants, in.UserID)
	now := s.now()
	if in.Kind == domainchat.ConversationDirect {
		if len(participants) != 1 {
			return ConversationDTO{}, domainshared.BadRequest("私聊必须指定一个其他用户")
		}
		if _, err := s.users.FindByID(ctx, participants[0]); err != nil {
			return ConversationDTO{}, err
		}
		if existing, err := s.repo.FindDirect(ctx, in.UserID, participants[0]); err == nil {
			_ = s.repo.SaveMember(ctx, mustMember(existing.ID(), in.UserID, domainchat.MemberMember, now))
			_ = s.repo.SaveMember(ctx, mustMember(existing.ID(), participants[0], domainchat.MemberMember, now))
			return s.conversationDTO(ctx, existing, in.UserID, true)
		} else if !errors.Is(err, domainchat.ErrConversationNotFound) {
			return ConversationDTO{}, err
		}
	} else if in.Kind == domainchat.ConversationRoom {
		if len(participants) == 0 {
			return ConversationDTO{}, domainshared.BadRequest("房间至少需要一名其他成员")
		}
	} else {
		return ConversationDTO{}, domainshared.BadRequest("非法会话类型")
	}
	participantUsers := make([]*domainuser.User, 0, len(participants))
	for _, participantID := range participants {
		user, err := s.users.FindByID(ctx, participantID)
		if err != nil {
			return ConversationDTO{}, err
		}
		participantUsers = append(participantUsers, user)
	}
	if in.Kind == domainchat.ConversationRoom && strings.TrimSpace(in.Title) == "" {
		names := make([]string, 0, len(participantUsers))
		for _, user := range participantUsers {
			displayName := user.DisplayName().String()
			if displayName == "" {
				displayName = user.Username().String()
			}
			names = append(names, displayName)
		}
		in.Title = generatedRoomTitle(names)
	}
	conversation, err := domainchat.NewConversation(in.Kind, in.UserID, in.Title, now)
	if err != nil {
		return ConversationDTO{}, err
	}
	members := make([]*domainchat.Member, 0, len(participants)+1)
	ownerRole := domainchat.MemberMember
	if in.Kind == domainchat.ConversationRoom {
		ownerRole = domainchat.MemberOwner
	}
	members = append(members, mustMember(conversation.ID(), in.UserID, ownerRole, now))
	for _, participantID := range participants {
		members = append(members, mustMember(conversation.ID(), participantID, domainchat.MemberMember, now))
	}
	if err := s.repo.SaveConversation(ctx, conversation, members); err != nil {
		return ConversationDTO{}, err
	}
	if in.Kind == domainchat.ConversationRoom {
		events, err := s.repo.SaveEvent(ctx, participants, domainchat.EventRoomInvited, map[string]any{"conversation_id": conversation.ID().String()})
		if err != nil {
			return ConversationDTO{}, err
		}
		s.publishRoomInvites(ctx, conversation, participants)
		s.notifyEvents(ctx, events)
	}
	return s.conversationDTO(ctx, conversation, in.UserID, true)
}

// GetConversation 获取当前用户可见的会话详情。
func (s *Service) GetConversation(ctx context.Context, userID, conversationID domainshared.ID) (ConversationDTO, error) {
	conversation, err := s.repo.FindByIDForMember(ctx, conversationID, userID)
	if err != nil {
		return ConversationDTO{}, err
	}
	return s.conversationDTO(ctx, conversation, userID, true)
}

// RenameConversation 修改房间名称。
func (s *Service) RenameConversation(ctx context.Context, in RenameConversationInput) (ConversationDTO, error) {
	conversation, err := s.repo.FindByIDForMember(ctx, in.ConversationID, in.UserID)
	if err != nil {
		return ConversationDTO{}, err
	}
	member, err := s.repo.FindMember(ctx, in.ConversationID, in.UserID)
	if err != nil || member.Role() != domainchat.MemberOwner {
		return ConversationDTO{}, domainshared.Forbidden("只有房主可以修改房间")
	}
	if err := conversation.Rename(in.Title, s.now()); err != nil {
		return ConversationDTO{}, err
	}
	if err := s.repo.RenameConversation(ctx, conversation); err != nil {
		return ConversationDTO{}, err
	}
	if err := s.saveSystemMessage(ctx, in.ConversationID, in.UserID, "群聊名称已修改为「"+conversation.Title()+"」"); err != nil {
		return ConversationDTO{}, err
	}
	return s.conversationDTO(ctx, conversation, in.UserID, true)
}

// InviteMember 邀请成员加入房间；邀请成功即加入，通知作为提醒。
func (s *Service) InviteMember(ctx context.Context, userID, conversationID, inviteeID domainshared.ID) error {
	conversation, err := s.repo.FindByIDForMember(ctx, conversationID, userID)
	if err != nil {
		return err
	}
	if conversation.Kind() != domainchat.ConversationRoom {
		return domainshared.BadRequest("私聊不能邀请成员")
	}
	if _, err := s.repo.FindMember(ctx, conversationID, userID); err != nil {
		return err
	}
	invitee, err := s.users.FindByID(ctx, inviteeID)
	if err != nil {
		return err
	}
	if inviteeID.Equal(userID) {
		return domainshared.BadRequest("不能邀请自己")
	}
	if err := s.repo.SaveMember(ctx, mustMember(conversationID, inviteeID, domainchat.MemberMember, s.now())); err != nil {
		return err
	}
	if err := s.saveSystemMessage(ctx, conversationID, userID, userToDTO(invitee).DisplayName+"已加入群聊"); err != nil {
		return err
	}
	members, err := s.repo.ListMembers(ctx, conversationID, false)
	if err != nil {
		return err
	}
	recipients := memberIDs(members)
	events, err := s.repo.SaveEvent(ctx, []domainshared.ID{inviteeID}, domainchat.EventRoomInvited, map[string]any{"conversation_id": conversationID.String()})
	if err != nil {
		return err
	}
	s.publishRoomInvites(ctx, conversation, []domainshared.ID{inviteeID})
	changed, err := s.repo.SaveEvent(ctx, recipients, domainchat.EventMemberChanged, map[string]any{"conversation_id": conversationID.String(), "user_id": inviteeID.String()})
	if err != nil {
		return err
	}
	s.notifyEvents(ctx, append(events, changed...))
	return nil
}

func (s *Service) publishRoomInvites(ctx context.Context, conversation *domainchat.Conversation, inviteeIDs []domainshared.ID) {
	if s.bus == nil {
		return
	}
	events := make([]domainshared.DomainEvent, 0, len(inviteeIDs))
	for _, inviteeID := range inviteeIDs {
		events = append(events, domainchat.NewRoomInvited(conversation.ID(), inviteeID, conversation.Title()))
	}
	if len(events) > 0 {
		_ = s.bus.Publish(ctx, events)
	}
}

// RemoveMember 房主移除成员。
func (s *Service) RemoveMember(ctx context.Context, userID, conversationID, targetID domainshared.ID) error {
	conversation, err := s.repo.FindByIDForMember(ctx, conversationID, userID)
	if err != nil {
		return err
	}
	if conversation.Kind() != domainchat.ConversationRoom {
		return domainshared.BadRequest("私聊没有成员管理")
	}
	owner, err := s.repo.FindMember(ctx, conversationID, userID)
	if err != nil || owner.Role() != domainchat.MemberOwner {
		return domainshared.Forbidden("只有房主可以移除成员")
	}
	if targetID.Equal(userID) {
		return domainshared.BadRequest("房主不能移除自己")
	}
	target, err := s.users.FindByID(ctx, targetID)
	if err != nil {
		return err
	}
	if err := s.repo.RemoveMember(ctx, conversationID, targetID, s.now()); err != nil {
		return err
	}
	if err := s.saveSystemMessage(ctx, conversationID, userID, userToDTO(target).DisplayName+"已被移出群聊"); err != nil {
		return err
	}
	members, err := s.repo.ListMembers(ctx, conversationID, false)
	if err != nil {
		return err
	}
	recipients := append(memberIDs(members), targetID)
	events, err := s.repo.SaveEvent(ctx, recipients, domainchat.EventMemberChanged, map[string]any{"conversation_id": conversationID.String(), "user_id": targetID.String()})
	if err != nil {
		return err
	}
	s.notifyEvents(ctx, events)
	return nil
}

// LeaveConversation 当前用户离开会话；房主离开时先把房主职责转给最早加入的成员。
func (s *Service) LeaveConversation(ctx context.Context, userID, conversationID domainshared.ID) error {
	conversation, err := s.repo.FindByIDForMember(ctx, conversationID, userID)
	if err != nil {
		return err
	}
	member, err := s.repo.FindMember(ctx, conversationID, userID)
	if err != nil {
		return err
	}
	leaver, err := s.users.FindByID(ctx, userID)
	if err != nil {
		return err
	}
	now := s.now()
	ownerLeft := conversation.Kind() == domainchat.ConversationRoom && member.Role() == domainchat.MemberOwner
	members, err := s.repo.ListMembers(ctx, conversationID, false)
	if err != nil {
		return err
	}
	recipients := memberIDs(members)
	if ownerLeft {
		var nextOwner *domainchat.Member
		for _, candidate := range members {
			if !candidate.UserID().Equal(userID) {
				nextOwner = candidate
				break
			}
		}
		if nextOwner == nil {
			return s.repo.DeleteConversation(ctx, conversationID)
		}
		if err := conversation.TransferOwnership(nextOwner.UserID(), now); err != nil {
			return err
		}
		if err := s.repo.TransferOwnership(ctx, conversationID, userID, nextOwner.UserID(), now); err != nil {
			return err
		}
	}
	if err := s.repo.LeaveMember(ctx, conversationID, userID, now); err != nil {
		return err
	}
	leaverName := userToDTO(leaver).DisplayName
	systemContent := leaverName + "已离开群聊"
	if ownerLeft {
		systemContent += "，房主已转交"
	}
	if conversation.Kind() == domainchat.ConversationRoom {
		if err := s.saveSystemMessage(ctx, conversationID, userID, systemContent); err != nil {
			return err
		}
	}
	recipients = withoutID(recipients, userID)
	events, err := s.repo.SaveEvent(ctx, recipients, domainchat.EventMemberChanged, map[string]any{
		"conversation_id": conversationID.String(),
		"user_id":         userID.String(),
	})
	if err != nil {
		return err
	}
	s.notifyEvents(ctx, events)
	return nil
}

// ListMembers 列出当前会话成员。
func (s *Service) ListMembers(ctx context.Context, userID, conversationID domainshared.ID) ([]MemberDTO, error) {
	if _, err := s.repo.FindByIDForMember(ctx, conversationID, userID); err != nil {
		return nil, err
	}
	members, err := s.repo.ListMembers(ctx, conversationID, false)
	if err != nil {
		return nil, err
	}
	return s.membersToDTO(ctx, members)
}

// SetConversationMuted 设置当前用户的会话通知静音状态。
func (s *Service) SetConversationMuted(ctx context.Context, userID, conversationID domainshared.ID, muted bool) error {
	if _, err := s.repo.FindByIDForMember(ctx, conversationID, userID); err != nil {
		return err
	}
	return s.repo.SetMemberMuted(ctx, conversationID, userID, muted)
}

// ListMessageReactions 查询当前会话成员可见的消息反应。
func (s *Service) ListMessageReactions(ctx context.Context, userID, conversationID, messageID domainshared.ID) ([]MessageReactionDTO, error) {
	message, err := s.validateMessageReactionTarget(ctx, userID, conversationID, messageID)
	if err != nil {
		return nil, err
	}
	reactions, err := s.reactions.ListByMessages(ctx, []domainshared.ID{message.ID()}, userID)
	if err != nil {
		return nil, err
	}
	return messageReactionDTOs(reactions[message.ID().String()]), nil
}

// AddMessageReaction 添加聊天消息反应，并向会话成员广播变化事件。
func (s *Service) AddMessageReaction(ctx context.Context, in AddMessageReactionInput) error {
	message, err := s.validateMessageReactionTarget(ctx, in.UserID, in.ConversationID, in.MessageID)
	if err != nil {
		return err
	}
	if in.EmojiID <= 0 {
		return domainshared.BadRequest("表情 ID 无效")
	}
	if err := s.reactions.Add(ctx, message.ID(), in.UserID, in.EmojiID); err != nil {
		return err
	}
	return s.publishMessageReactionUpdated(ctx, in.ConversationID, message.ID())
}

// RemoveMessageReaction 移除当前用户对聊天消息的指定反应。
func (s *Service) RemoveMessageReaction(ctx context.Context, in RemoveMessageReactionInput) error {
	message, err := s.validateMessageReactionTarget(ctx, in.UserID, in.ConversationID, in.MessageID)
	if err != nil {
		return err
	}
	if in.EmojiID <= 0 {
		return domainshared.BadRequest("表情 ID 无效")
	}
	if err := s.reactions.Remove(ctx, message.ID(), in.UserID, in.EmojiID); err != nil {
		return err
	}
	return s.publishMessageReactionUpdated(ctx, in.ConversationID, message.ID())
}

func (s *Service) validateMessageReactionTarget(ctx context.Context, userID, conversationID, messageID domainshared.ID) (*domainchat.Message, error) {
	if s.reactions == nil {
		return nil, domainshared.Internal("聊天消息反应未配置", nil)
	}
	if _, err := s.repo.FindByIDForMember(ctx, conversationID, userID); err != nil {
		return nil, err
	}
	message, err := s.repo.FindMessage(ctx, conversationID, messageID)
	if err != nil {
		return nil, err
	}
	if message.DeletedAt() != nil || message.Type() == domainchat.MessageSystem {
		return nil, domainshared.BadRequest("该消息不支持表情")
	}
	return message, nil
}

func (s *Service) publishMessageReactionUpdated(ctx context.Context, conversationID, messageID domainshared.ID) error {
	members, err := s.repo.ListMembers(ctx, conversationID, false)
	if err != nil {
		return err
	}
	events, err := s.repo.SaveEvent(ctx, memberIDs(members), domainchat.EventMessageReactionUpdated, map[string]any{
		"conversation_id": conversationID.String(),
		"message_id":      messageID.String(),
	})
	if err != nil {
		return err
	}
	s.notifyEvents(ctx, events)
	return nil
}

// ListMessages 列出消息历史。
func (s *Service) ListMessages(ctx context.Context, userID, conversationID domainshared.ID, cursorValue string, limit int) (ListResult[MessageDTO], error) {
	if _, err := s.repo.FindByIDForMember(ctx, conversationID, userID); err != nil {
		return ListResult[MessageDTO]{}, err
	}
	cursor, err := decodeMessageCursor(cursorValue)
	if err != nil {
		return ListResult[MessageDTO]{}, err
	}
	limit = clampLimit(limit)
	rows, err := s.repo.ListMessages(ctx, conversationID, cursor, limit+1)
	if err != nil {
		return ListResult[MessageDTO]{}, err
	}
	result := ListResult[MessageDTO]{Items: make([]MessageDTO, 0, min(len(rows), limit))}
	if len(rows) > limit {
		result.HasMore = true
		rows = rows[:limit]
	}
	reactions, err := s.listMessageReactions(ctx, rows, userID)
	if err != nil {
		return ListResult[MessageDTO]{}, err
	}
	for _, row := range rows {
		dto, err := s.messageDTOWithReactions(ctx, row, reactions[row.ID().String()], userID)
		if err != nil {
			return ListResult[MessageDTO]{}, err
		}
		result.Items = append(result.Items, dto)
	}
	if result.HasMore && len(rows) > 0 {
		last := rows[len(rows)-1]
		result.NextCursor = encodeMessageCursor(domainchat.MessageCursor{CreatedAt: last.CreatedAt(), ID: last.ID()})
	}
	return result, nil
}

// SendMessage 发送文本或图片消息。
func (s *Service) SendMessage(ctx context.Context, in SendMessageInput) (MessageDTO, error) {
	if _, err := s.repo.FindByIDForMember(ctx, in.ConversationID, in.UserID); err != nil {
		return MessageDTO{}, err
	}
	if existing, err := s.repo.FindMessageByIdempotency(ctx, in.ConversationID, in.UserID, in.IdempotencyKey); err == nil {
		return s.messageDTO(ctx, existing, in.UserID)
	} else if !errors.Is(err, domainchat.ErrMessageNotFound) {
		return MessageDTO{}, err
	}
	var replyToID *domainshared.ID
	if !in.ReplyToID.IsZero() {
		target, err := s.repo.FindMessage(ctx, in.ConversationID, in.ReplyToID)
		if err != nil {
			return MessageDTO{}, err
		}
		if target.DeletedAt() != nil || target.Type() == domainchat.MessageSystem {
			return MessageDTO{}, domainshared.BadRequest("消息不可引用")
		}
		replyToID = &in.ReplyToID
	}
	now := s.now()
	var message *domainchat.Message
	var file *domainupload.File
	var err error
	switch in.Type {
	case domainchat.MessageText:
		message, err = domainchat.NewTextMessage(in.ConversationID, in.UserID, in.Content, in.IdempotencyKey, now, replyToID)
	case domainchat.MessageImage:
		file, err = s.chatImage(ctx, in.MediaID, in.UserID)
		if err == nil {
			message, err = domainchat.NewImageMessage(in.ConversationID, in.UserID, in.MediaID, in.Content, in.IdempotencyKey, now, replyToID)
		}
	case domainchat.MessageTweetShare:
		if _, err = s.tweets.FindByID(ctx, in.SharedTweetID); err == nil {
			message, err = domainchat.NewTweetShareMessage(in.ConversationID, in.UserID, in.SharedTweetID, in.Content, in.IdempotencyKey, now, replyToID)
		}
	default:
		err = domainshared.BadRequest("非法消息类型")
	}
	if err != nil {
		return MessageDTO{}, err
	}
	members, err := s.repo.ListMembers(ctx, in.ConversationID, false)
	if err != nil {
		return MessageDTO{}, err
	}
	recipients := memberIDs(members)
	if file != nil {
		if err := s.files.UpdateRefCount(ctx, file.ID(), 1); err != nil {
			return MessageDTO{}, err
		}
	}
	preview := "发送了一张图片"
	switch message.Type() {
	case domainchat.MessageText:
		preview = truncatePreview(message.Content(), 120)
	case domainchat.MessageTweetShare:
		preview = "分享了一条推文"
	}
	events, err := s.repo.SaveMessage(ctx, message, recipients, map[string]any{"preview": preview})
	if err != nil {
		if file != nil {
			_ = s.files.UpdateRefCount(ctx, file.ID(), -1)
		}
		if existing, findErr := s.repo.FindMessageByIdempotency(ctx, in.ConversationID, in.UserID, in.IdempotencyKey); findErr == nil {
			return s.messageDTO(ctx, existing, in.UserID)
		}
		return MessageDTO{}, err
	}
	s.notifyEvents(ctx, events)
	return s.messageDTO(ctx, message, in.UserID)
}

// MarkRead 更新用户在会话中的阅读位置。
func (s *Service) MarkRead(ctx context.Context, userID, conversationID, messageID domainshared.ID) (int64, error) {
	if _, err := s.repo.FindByIDForMember(ctx, conversationID, userID); err != nil {
		return 0, err
	}
	var last *domainshared.ID
	if !messageID.IsZero() {
		message, err := s.repo.FindMessage(ctx, conversationID, messageID)
		if err != nil {
			return 0, err
		}
		last = &messageID
		if message.DeletedAt() != nil {
			last = &messageID
		}
	} else {
		messages, err := s.repo.ListMessages(ctx, conversationID, nil, 1)
		if err != nil {
			return 0, err
		}
		if len(messages) > 0 {
			id := messages[0].ID()
			last = &id
		}
	}
	readAt := new(time.Time)
	*readAt = s.now()
	position := domainchat.ReconstructReadPosition(conversationID, userID, last, readAt)
	if err := s.repo.SaveReadPosition(ctx, position); err != nil {
		return 0, err
	}
	return s.repo.CountUnread(ctx, conversationID, userID)
}

// UnreadCount 返回当前用户全部未读数。
func (s *Service) UnreadCount(ctx context.Context, userID domainshared.ID) (int64, error) {
	return s.repo.CountAllUnread(ctx, userID)
}

// DeleteMessage 管理员删除违规消息。
func (s *Service) DeleteMessage(ctx context.Context, adminID, conversationID, messageID domainshared.ID) error {
	message, err := s.repo.FindMessage(ctx, conversationID, messageID)
	if err != nil {
		return err
	}
	if err := message.Delete(adminID, s.now()); err != nil {
		return err
	}
	if err := s.repo.DeleteMessage(ctx, message); err != nil {
		return err
	}
	if s.reactions != nil {
		if err := s.reactions.RemoveByMessage(ctx, message.ID()); err != nil {
			return err
		}
	}
	if message.MediaID() != nil {
		_ = s.files.UpdateRefCount(ctx, *message.MediaID(), -1)
	}
	members, err := s.repo.ListMembers(ctx, conversationID, false)
	if err != nil {
		return err
	}
	events, err := s.repo.SaveEvent(ctx, memberIDs(members), domainchat.EventMessageDeleted, map[string]any{"conversation_id": conversationID.String(), "message_id": messageID.String()})
	if err != nil {
		return err
	}
	s.notifyEvents(ctx, events)
	return nil
}

// FindUserByUsername 按用户名精确查询可聊天用户。
func (s *Service) FindUserByUsername(ctx context.Context, username string) (UserDTO, error) {
	name, err := domainuser.ParseUsername(strings.TrimSpace(username))
	if err != nil {
		return UserDTO{}, err
	}
	user, err := s.users.FindByUsername(ctx, name)
	if err != nil {
		return UserDTO{}, err
	}
	return userToDTO(user), nil
}

// ListContacts 按用户名或展示名查找可发起私聊的用户。
func (s *Service) ListContacts(ctx context.Context, userID domainshared.ID, query, cursorValue string, limit int) (ListResult[UserDTO], error) {
	if userID.IsZero() {
		return ListResult[UserDTO]{}, domainshared.Unauthorized("请先登录")
	}
	cursor, err := decodeContactCursor(cursorValue)
	if err != nil {
		return ListResult[UserDTO]{}, err
	}
	limit = clampLimit(limit)
	var afterUsername string
	var afterID domainshared.ID
	if cursor != nil {
		afterUsername = cursor.Username
		afterID = cursor.ID
	}
	users, err := s.users.ListContacts(ctx, strings.TrimSpace(query), userID, afterUsername, afterID, limit+1)
	if err != nil {
		return ListResult[UserDTO]{}, err
	}
	result := ListResult[UserDTO]{Items: make([]UserDTO, 0, min(len(users), limit))}
	if len(users) > limit {
		result.HasMore = true
		users = users[:limit]
	}
	for _, user := range users {
		result.Items = append(result.Items, userToDTO(user))
	}
	if result.HasMore && len(users) > 0 {
		last := users[len(users)-1]
		result.NextCursor = encodeContactCursor(last.Username().String(), last.GetID())
	}
	return result, nil
}

// EventsAfter 返回指定序号之后的 SSE 事件。
func (s *Service) EventsAfter(ctx context.Context, userID domainshared.ID, afterSequence int64, limit int) ([]EventDTO, error) {
	if limit <= 0 || limit > 100 {
		limit = 100
	}
	events, err := s.repo.FindEventsAfter(ctx, userID, afterSequence, limit)
	if err != nil {
		return nil, err
	}
	out := make([]EventDTO, 0, len(events))
	for _, event := range events {
		dto, err := s.eventToDTO(ctx, event)
		if err != nil {
			log.Warn().Err(err).Str("event_type", string(event.Type)).Msg("聊天事件自定义表情解析失败")
			dto = eventEnvelope(event)
		}
		out = append(out, dto)
	}
	return out, nil
}

// PushPublicKey 返回当前 VAPID 公钥；未配置时为空。
func (s *Service) PushPublicKey() string { return s.publicKey }

// SavePushSubscription 注册当前浏览器推送订阅。
func (s *Service) SavePushSubscription(ctx context.Context, userID domainshared.ID, endpoint, p256dh, auth, userAgent string, showPreview bool) error {
	if strings.TrimSpace(endpoint) == "" || strings.TrimSpace(p256dh) == "" || strings.TrimSpace(auth) == "" {
		return domainshared.BadRequest("推送订阅参数不完整")
	}
	now := s.now()
	return s.repo.SavePushSubscription(ctx, &domainchat.PushSubscription{UserID: userID, Endpoint: endpoint, P256DH: p256dh, Auth: auth, UserAgent: userAgent, ShowPreview: showPreview, CreatedAt: now, UpdatedAt: now})
}

// DeletePushSubscription 删除当前用户浏览器推送订阅。
func (s *Service) DeletePushSubscription(ctx context.Context, userID domainshared.ID, endpoint string) error {
	return s.repo.DeletePushSubscription(ctx, userID, endpoint)
}

func (s *Service) conversationDTO(ctx context.Context, conversation *domainchat.Conversation, userID domainshared.ID, includeMembers bool) (ConversationDTO, error) {
	owner, err := s.users.FindByID(ctx, conversation.OwnerID())
	if err != nil {
		return ConversationDTO{}, err
	}
	dto := ConversationDTO{ID: conversation.ID().String(), Kind: string(conversation.Kind()), Title: conversation.Title(), Owner: userToDTO(owner), CreatedAt: conversation.CreatedAt.Format(time.RFC3339Nano), UpdatedAt: conversation.UpdatedAt.Format(time.RFC3339Nano)}
	unread, err := s.repo.CountUnread(ctx, conversation.ID(), userID)
	if err != nil {
		return ConversationDTO{}, err
	}
	dto.UnreadCount = unread
	latest, err := s.repo.ListMessages(ctx, conversation.ID(), nil, 1)
	if err != nil {
		return ConversationDTO{}, err
	}
	if len(latest) > 0 {
		last, err := s.messageDTO(ctx, latest[0], userID)
		if err != nil {
			return ConversationDTO{}, err
		}
		dto.LastMessage = &last
	}
	if includeMembers {
		members, err := s.repo.ListMembers(ctx, conversation.ID(), false)
		if err != nil {
			return ConversationDTO{}, err
		}
		dto.Members, err = s.membersToDTO(ctx, members)
		if err != nil {
			return ConversationDTO{}, err
		}
	}
	return dto, nil
}

func (s *Service) membersToDTO(ctx context.Context, members []*domainchat.Member) ([]MemberDTO, error) {
	ids := memberIDs(members)
	users, err := s.users.FindByIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	byID := make(map[string]*domainuser.User, len(users))
	for _, user := range users {
		byID[user.GetID().String()] = user
	}
	out := make([]MemberDTO, 0, len(members))
	for _, member := range members {
		user := byID[member.UserID().String()]
		if user == nil {
			continue
		}
		out = append(out, MemberDTO{User: userToDTO(user), Role: string(member.Role()), JoinedAt: member.JoinedAt().Format(time.RFC3339Nano), IsMuted: member.IsMuted()})
	}
	return out, nil
}

func (s *Service) messageDTO(ctx context.Context, message *domainchat.Message, viewerUserID domainshared.ID) (MessageDTO, error) {
	var reactions []domainchatreaction.AggregatedReaction
	if message.DeletedAt() == nil {
		byMessage, err := s.listMessageReactions(ctx, []*domainchat.Message{message}, viewerUserID)
		if err != nil {
			return MessageDTO{}, err
		}
		reactions = byMessage[message.ID().String()]
	}
	return s.messageDTOWithReactions(ctx, message, reactions, viewerUserID)
}

func (s *Service) listMessageReactions(ctx context.Context, messages []*domainchat.Message, viewerUserID domainshared.ID) (map[string][]domainchatreaction.AggregatedReaction, error) {
	if s.reactions == nil || len(messages) == 0 {
		return map[string][]domainchatreaction.AggregatedReaction{}, nil
	}
	ids := make([]domainshared.ID, 0, len(messages))
	for _, message := range messages {
		ids = append(ids, message.ID())
	}
	return s.reactions.ListByMessages(ctx, ids, viewerUserID)
}

func (s *Service) messageDTOWithReactions(ctx context.Context, message *domainchat.Message, reactions []domainchatreaction.AggregatedReaction, viewerUserID domainshared.ID) (MessageDTO, error) {
	sender, err := s.users.FindByID(ctx, message.SenderID())
	if err != nil {
		return MessageDTO{}, err
	}
	dto := MessageDTO{
		ID:             message.ID().String(),
		ConversationID: message.ConversationID().String(),
		Sender:         userToDTO(sender),
		Type:           string(message.Type()),
		Reactions:      messageReactionDTOs(reactions),
		CreatedAt:      message.CreatedAt().Format(time.RFC3339Nano),
	}
	if message.DeletedAt() != nil {
		dto.IsDeleted = true
		deletedAt := message.DeletedAt().Format(time.RFC3339Nano)
		dto.DeletedAt = &deletedAt
		dto.Reactions = []MessageReactionDTO{}
		return dto, nil
	}
	if message.HasTextContent() {
		dto.Content = message.Content()
		dto.CustomEmote, err = s.resolveCustomEmote(ctx, dto.Content, viewerUserID)
		if err != nil {
			return MessageDTO{}, err
		}
	}
	if message.SharedTweetID() != nil {
		dto.SharedTweet, err = s.sharedTweetDTO(ctx, *message.SharedTweetID())
		if err != nil {
			return MessageDTO{}, err
		}
	}
	if message.MediaID() != nil {
		dto.Media, err = s.mediaDTO(ctx, *message.MediaID())
		if err != nil {
			return MessageDTO{}, err
		}
	}
	if message.ReplyToID() != nil {
		target, err := s.repo.FindMessage(ctx, message.ConversationID(), *message.ReplyToID())
		if err != nil {
			if !errors.Is(err, domainchat.ErrMessageNotFound) {
				return MessageDTO{}, err
			}
		} else {
			dto.ReplyTo, err = s.messageReferenceDTO(ctx, target)
			if err != nil {
				return MessageDTO{}, err
			}
		}
	}
	return dto, nil
}

// customEmojiBodyPattern 匹配正文中的 [xxx] 占位符（含方括号）；与评论/推文域的
// emojiBodyPattern 同构。是否为自定义表情 token（冒号后段是合法 UUID）由
// appcustomemoji.ParseToken 判定；聊天没有系统表情按名解析分支，故此处只收集
// 自定义表情 ID，普通 [name] 系统表情占位符原样忽略（客户端全局 map 解析）。
var customEmojiBodyPattern = regexp.MustCompile(`\[([^\]]+)\]`)

// resolveCustomEmote 解析正文中的自定义表情占位符，返回 token → 解析结果映射。
// s.customEmojis 为 nil（未注入）或正文不含合法 token 时返回 nil（JSON 省略）。
func (s *Service) resolveCustomEmote(ctx context.Context, content string, viewerUserID domainshared.ID) (map[string]CustomEmojiRefDTO, error) {
	if s.customEmojis == nil || content == "" {
		return nil, nil
	}
	var ids []domainshared.ID
	tokenByID := make(map[domainshared.ID][]string)
	seenIDs := make(map[domainshared.ID]struct{})
	for _, m := range customEmojiBodyPattern.FindAllString(content, -1) {
		if len(m) < 2 {
			continue
		}
		if id, ok := appcustomemoji.ParseToken(m[1 : len(m)-1]); ok {
			tokenByID[id] = append(tokenByID[id], m)
			if _, seen := seenIDs[id]; !seen {
				seenIDs[id] = struct{}{}
				ids = append(ids, id)
			}
		}
	}
	if len(ids) == 0 {
		return nil, nil
	}
	refs, err := s.customEmojis.ResolveByIDs(ctx, ids, viewerUserID)
	if err != nil {
		return nil, err
	}
	if len(refs) == 0 {
		return nil, nil
	}
	result := make(map[string]CustomEmojiRefDTO, len(refs))
	for id, ref := range refs {
		ref.CustomEmojiID = id.String()
		for _, token := range tokenByID[id] {
			result[token] = ref
		}
	}
	return result, nil
}

func messageReactionDTOs(reactions []domainchatreaction.AggregatedReaction) []MessageReactionDTO {
	result := make([]MessageReactionDTO, 0, len(reactions))
	for _, reaction := range reactions {
		result = append(result, MessageReactionDTO{
			EmojiID: reaction.EmojiID, EmojiName: reaction.EmojiName, EmojiURL: reaction.EmojiURL,
			GifURL: reaction.GifURL, Count: reaction.Count, Self: reaction.Self,
		})
	}
	return result
}

func (s *Service) messageReferenceDTO(ctx context.Context, message *domainchat.Message) (*MessageReferenceDTO, error) {
	sender, err := s.users.FindByID(ctx, message.SenderID())
	if err != nil {
		return nil, err
	}
	dto := &MessageReferenceDTO{ID: message.ID().String(), Sender: userToDTO(sender), Type: string(message.Type())}
	if message.DeletedAt() != nil {
		dto.IsDeleted = true
		return dto, nil
	}
	if message.HasTextContent() {
		dto.Content = truncatePreview(message.Content(), 120)
	}
	if message.MediaID() != nil {
		dto.Media, err = s.mediaDTO(ctx, *message.MediaID())
		if err != nil {
			return nil, err
		}
	}
	return dto, nil
}

func (s *Service) mediaDTO(ctx context.Context, mediaID domainshared.ID) (*MediaDTO, error) {
	file, err := s.files.FindByID(ctx, mediaID)
	if err != nil {
		return nil, err
	}
	return &MediaDTO{ID: file.ID().String(), URL: file.URL(), Thumbnail: file.Thumbnail(), MIMEType: file.MimeType(), Size: file.Size(), Width: file.Width(), Height: file.Height()}, nil
}

func (s *Service) sharedTweetDTO(ctx context.Context, tweetID domainshared.ID) (*SharedTweetDTO, error) {
	t, err := s.tweets.FindByID(ctx, tweetID)
	if err != nil {
		if errors.Is(err, domaintweet.ErrNotFound) {
			return &SharedTweetDTO{ID: tweetID.String(), IsDeleted: true}, nil
		}
		return nil, err
	}
	author, err := s.users.FindByID(ctx, t.AuthorID())
	if err != nil {
		return nil, err
	}
	authorDTO := userToDTO(author)
	return &SharedTweetDTO{
		ID: t.ID().String(), Author: &authorDTO, Content: t.Content(), Images: t.Images(),
		CreatedAt: t.CreatedAt().Format(time.RFC3339Nano),
	}, nil
}

func truncatePreview(content string, maxRunes int) string {
	runes := []rune(content)
	if len(runes) <= maxRunes {
		return content
	}
	return string(runes[:maxRunes]) + "…"
}

func (s *Service) chatImage(ctx context.Context, mediaID, userID domainshared.ID) (*domainupload.File, error) {
	if mediaID.IsZero() {
		return nil, domainshared.BadRequest("图片媒体不能为空")
	}
	file, err := s.files.FindByID(ctx, mediaID)
	if err != nil {
		return nil, err
	}
	if !file.OwnerID().Equal(userID) || file.Status() != domainupload.StatusReady || !strings.HasPrefix(file.MimeType(), "image/") || !isAllowedChatImagePurpose(file.Purpose()) {
		return nil, domainshared.Forbidden("图片媒体不可用于聊天")
	}
	return file, nil
}

func isAllowedChatImagePurpose(purpose string) bool {
	switch purpose {
	case domainupload.PurposeChat,
		domainupload.PurposeMaterial,
		domainupload.PurposePost,
		domainupload.PurposeTweet,
		"comment",
		domainupload.PurposeEmoji:
		return true
	default:
		return false
	}
}

func (s *Service) notifyEvents(ctx context.Context, events []domainchat.Event) {
	for _, event := range events {
		dto, err := s.eventToDTO(ctx, event)
		if err != nil {
			log.Warn().Err(err).Str("event_type", string(event.Type)).Msg("聊天事件自定义表情解析失败")
			dto = eventEnvelope(event)
		}
		if s.notifier != nil {
			s.notifier.Push(event.UserID, dto)
		}
		if event.Type != domainchat.EventMessageCreated && event.Type != domainchat.EventRoomInvited {
			continue
		}
		if event.Type == domainchat.EventMessageCreated {
			if senderID, ok := event.Payload["sender_id"].(string); ok && senderID == event.UserID.String() {
				continue
			}
		}
		conversationID, err := eventConversationID(event)
		if err != nil {
			continue
		}
		member, err := s.repo.FindMember(ctx, conversationID, event.UserID)
		if err != nil || member.IsMuted() {
			continue
		}
		subs, err := s.repo.ListPushSubscriptions(ctx, event.UserID)
		payload := PushPayload{Title: "Violet 聊天", Body: "收到一条新消息", URL: "/chat", Tag: "violet-chat"}
		if event.Type == domainchat.EventRoomInvited {
			payload.Title = "新的聊天邀请"
			payload.Body = "你被邀请加入一个私有房间"
			payload.Tag = "violet-chat-invite"
		}
		for _, subscription := range subs {
			notification := payload
			if event.Type == domainchat.EventMessageCreated && subscription.ShowPreview {
				if preview, ok := event.Payload["preview"].(string); ok && preview != "" {
					notification.Body = preview
				}
			}
			if err := s.push.Send(ctx, subscription, notification); err != nil {
				_ = s.repo.DeletePushSubscription(ctx, event.UserID, subscription.Endpoint)
			}
		}
	}
}
func (s *Service) saveSystemMessage(ctx context.Context, conversationID, senderID domainshared.ID, content string) error {
	message, err := domainchat.NewSystemMessage(
		conversationID,
		senderID,
		content,
		"system:"+domainshared.NewID().String(),
		s.now(),
	)
	if err != nil {
		return err
	}
	members, err := s.repo.ListMembers(ctx, conversationID, false)
	if err != nil {
		return err
	}
	events, err := s.repo.SaveMessage(ctx, message, memberIDs(members), map[string]any{
		"preview": message.Content(),
	})
	if err != nil {
		return err
	}
	s.notifyEvents(ctx, events)
	return nil
}

func eventConversationID(event domainchat.Event) (domainshared.ID, error) {
	value, ok := event.Payload["conversation_id"].(string)
	if !ok {
		return domainshared.ID{}, domainshared.BadRequest("聊天事件缺少会话 ID")
	}
	return domainshared.ParseID(value)
}

func (s *Service) eventToDTO(ctx context.Context, event domainchat.Event) (EventDTO, error) {
	dto := eventEnvelope(event)
	if event.Type != domainchat.EventMessageCreated || s.customEmojis == nil {
		return dto, nil
	}
	conversationID, err := eventConversationID(event)
	if err != nil {
		return dto, nil
	}
	messageIDValue, ok := event.Payload["message_id"].(string)
	if !ok {
		return dto, nil
	}
	messageID, err := domainshared.ParseID(messageIDValue)
	if err != nil {
		return dto, nil
	}
	message, err := s.repo.FindMessage(ctx, conversationID, messageID)
	if err != nil {
		if errors.Is(err, domainchat.ErrMessageNotFound) {
			return dto, nil
		}
		return EventDTO{}, err
	}
	if message == nil {
		return dto, nil
	}
	if !message.HasTextContent() {
		return dto, nil
	}
	dto.CustomEmote, err = s.resolveCustomEmote(ctx, message.Content(), event.UserID)
	if err != nil {
		return EventDTO{}, err
	}
	return dto, nil
}

func eventEnvelope(event domainchat.Event) EventDTO {
	data := make(map[string]any, len(event.Payload))
	for key, value := range event.Payload {
		data[key] = value
	}
	return EventDTO{
		ID:         fmt.Sprint(event.Sequence),
		Type:       string(event.Type),
		Version:    1,
		OccurredAt: event.CreatedAt.Format(time.RFC3339Nano),
		Data:       data,
	}
}

func userToDTO(user *domainuser.User) UserDTO {
	username := user.Username().String()
	displayName := user.DisplayName().String()
	if displayName == "" {
		displayName = username
	}
	return UserDTO{ID: user.GetID().String(), Username: username, DisplayName: displayName, AvatarURL: user.AvatarURL()}
}

func memberIDs(members []*domainchat.Member) []domainshared.ID {
	ids := make([]domainshared.ID, 0, len(members))
	for _, member := range members {
		if member.IsActive() {
			ids = append(ids, member.UserID())
		}
	}
	return ids
}

func generatedRoomTitle(names []string) string {
	title := strings.Join(names, "、")
	runes := []rune(title)
	if len(runes) <= domainchat.MaxRoomTitleLength {
		return title
	}
	return string(runes[:domainchat.MaxRoomTitleLength-1]) + "…"
}
func uniqueIDs(ids []domainshared.ID) []domainshared.ID {
	seen := make(map[string]struct{}, len(ids))
	out := make([]domainshared.ID, 0, len(ids))
	for _, id := range ids {
		if id.IsZero() {
			continue
		}
		if _, ok := seen[id.String()]; ok {
			continue
		}
		seen[id.String()] = struct{}{}
		out = append(out, id)
	}
	return out
}

func withoutID(ids []domainshared.ID, excluded domainshared.ID) []domainshared.ID {
	out := ids[:0]
	for _, id := range ids {
		if !id.Equal(excluded) {
			out = append(out, id)
		}
	}
	return out
}

func mustMember(conversationID, userID domainshared.ID, role domainchat.MemberRole, now time.Time) *domainchat.Member {
	member, _ := domainchat.NewMember(conversationID, userID, role, now)
	return member
}

func clampLimit(limit int) int {
	if limit <= 0 {
		return defaultLimit
	}
	if limit > maxLimit {
		return maxLimit
	}
	return limit
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func encodeConversationCursor(cursor domainchat.ConversationCursor) string {
	raw := cursor.UpdatedAt.UTC().Format(time.RFC3339Nano) + cursorSep + cursor.ID.String()
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

func decodeConversationCursor(value string) (*domainchat.ConversationCursor, error) {
	if value == "" {
		return nil, nil
	}
	raw, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		return nil, domainshared.BadRequest("非法的分页游标")
	}
	parts := strings.Split(string(raw), cursorSep)
	if len(parts) != 2 {
		return nil, domainshared.BadRequest("非法的分页游标")
	}
	updatedAt, err := time.Parse(time.RFC3339Nano, parts[0])
	if err != nil {
		return nil, domainshared.BadRequest("非法的分页游标")
	}
	id, err := domainshared.ParseID(parts[1])
	if err != nil {
		return nil, domainshared.BadRequest("非法的分页游标")
	}
	return &domainchat.ConversationCursor{UpdatedAt: updatedAt, ID: id}, nil
}

type contactCursor struct {
	Username string
	ID       domainshared.ID
}

func encodeContactCursor(username string, id domainshared.ID) string {
	raw := username + cursorSep + id.String()
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

func decodeContactCursor(value string) (*contactCursor, error) {
	if value == "" {
		return nil, nil
	}
	raw, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		return nil, domainshared.BadRequest("非法的分页游标")
	}
	parts := strings.Split(string(raw), cursorSep)
	if len(parts) != 2 || parts[0] == "" {
		return nil, domainshared.BadRequest("非法的分页游标")
	}
	id, err := domainshared.ParseID(parts[1])
	if err != nil {
		return nil, domainshared.BadRequest("非法的分页游标")
	}
	return &contactCursor{Username: parts[0], ID: id}, nil
}

func encodeMessageCursor(cursor domainchat.MessageCursor) string {
	raw := cursor.CreatedAt.UTC().Format(time.RFC3339Nano) + cursorSep + cursor.ID.String()
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

func decodeMessageCursor(value string) (*domainchat.MessageCursor, error) {
	if value == "" {
		return nil, nil
	}
	raw, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		return nil, domainshared.BadRequest("非法的分页游标")
	}
	parts := strings.Split(string(raw), cursorSep)
	if len(parts) != 2 {
		return nil, domainshared.BadRequest("非法的分页游标")
	}
	createdAt, err := time.Parse(time.RFC3339Nano, parts[0])
	if err != nil {
		return nil, domainshared.BadRequest("非法的分页游标")
	}
	id, err := domainshared.ParseID(parts[1])
	if err != nil {
		return nil, domainshared.BadRequest("非法的分页游标")
	}
	return &domainchat.MessageCursor{CreatedAt: createdAt, ID: id}, nil
}
