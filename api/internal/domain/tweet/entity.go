// Package tweet 定义推文聚合的领域模型（PRD-0013）。
//
// 推文是多用户微博的短内容单元：纯文本（≤500 rune）+ 最多 4 张图，两者至少其一。
// 三条领域规则：
//   - 即发即出：无先审后发状态机，创建即对公众可见
//   - 不可编辑：聚合根无 Update 路径，反悔 = 删除重发
//   - 物理删除：无软删，删除后点赞/评论由 DB 级联清理
package tweet

import (
	"strings"
	"time"
	"unicode/utf8"

	"blog-api/internal/domain/shared"
)

// 内容不变量上限
const (
	// MaxContentRunes 正文上限（rune 计，非字节）
	MaxContentRunes = 500
	// MaxImages 图片数量上限
	MaxImages = 4
)

// TweetCreated 推文已创建事件
//
// 订阅者：审计服务。Excerpt 供审计列表可读展示（截断的前缀，非全文）。
type TweetCreated struct {
	shared.BaseEvent
	AuthorID shared.ID
	Excerpt  string
}

// NewTweetCreated 构造推文创建事件
func NewTweetCreated(t *Tweet) TweetCreated {
	return TweetCreated{
		BaseEvent: shared.NewBaseEvent("tweet.created", t.id),
		AuthorID:  t.authorID,
		Excerpt:   excerpt(t.content),
	}
}

// TweetDeleted 推文已删除事件
//
// 物理删除后聚合根不复存在，事件由应用层手动构造发布。
// AuthorID 记录原作者（管理员删他人推文时与操作者不同），Excerpt 供审计追溯。
type TweetDeleted struct {
	shared.BaseEvent
	AuthorID shared.ID
	Excerpt  string
}

// NewTweetDeleted 构造推文删除事件
func NewTweetDeleted(t *Tweet) TweetDeleted {
	return TweetDeleted{
		BaseEvent: shared.NewBaseEvent("tweet.deleted", t.id),
		AuthorID:  t.authorID,
		Excerpt:   excerpt(t.content),
	}
}

// excerptLen 审计快照的正文截断长度（rune）
const excerptLen = 50

// excerpt 取正文前缀快照（rune 安全截断）
func excerpt(content string) string {
	runes := []rune(content)
	if len(runes) <= excerptLen {
		return content
	}
	return string(runes[:excerptLen]) + "…"
}

// Tweet 推文聚合根。
//
// 不变量：
//   - content trim 后 ≤500 rune；与 images 至少其一非空
//   - images ≤4 张，元素为上传文件的访问 URL（/uploads/...）
//   - authorID 创建时固定，无 setter（无变更路径）
//   - 无 Update 方法：不可编辑由聚合根层面保证（编译期无法改内容）
type Tweet struct {
	shared.AggregateRoot
	// id 推文唯一标识
	id shared.ID
	// authorID 作者用户 ID（创建时固定，不可变）
	authorID shared.ID
	// content 纯文本正文（trim 后存储；可与 images 其一为空，不同为空）
	content string
	// images 图片访问 URL 列表（≤4 张；发布时由应用层校验归属作者）
	images []string
	// likeCount 点赞冗余计数（tweet_likes 表是唯一数据源，此列服务列表性能）
	likeCount int
	// timestamps 创建/更新时间（无 Update 路径，updated_at 实际恒等于 created_at）
	timestamps shared.Timestamps
}

// NewTweet 创建新推文。
//
// content 先 trim 再校验：纯空白正文视为空，与空图片列表组合时拒绝。
// 创建成功记录 TweetCreated 事件（应用层 Save 后发布）。
func NewTweet(authorID shared.ID, content string, images []string) (*Tweet, error) {
	content = strings.TrimSpace(content)
	if content == "" && len(images) == 0 {
		return nil, shared.Validation("推文内容与图片至少填写其一")
	}
	if utf8.RuneCountInString(content) > MaxContentRunes {
		return nil, shared.Validation("推文内容不能超过 500 字")
	}
	if len(images) > MaxImages {
		return nil, shared.Validation("推文图片最多 4 张")
	}
	for _, img := range images {
		if strings.TrimSpace(img) == "" {
			return nil, shared.Validation("推文图片 URL 不能为空")
		}
	}
	if images == nil {
		images = []string{}
	}

	now := time.Now()
	t := &Tweet{
		id:         shared.NewID(),
		authorID:   authorID,
		content:    content,
		images:     images,
		timestamps: shared.Timestamps{CreatedAt: now, UpdatedAt: now},
	}
	t.RecordEvent(NewTweetCreated(t))
	return t, nil
}

// ReconstructTweet 从持久化数据重建推文（无校验、无副作用、不记录事件）。
func ReconstructTweet(
	id, authorID shared.ID,
	content string,
	images []string,
	likeCount int,
	createdAt, updatedAt time.Time,
) *Tweet {
	if images == nil {
		images = []string{}
	}
	return &Tweet{
		id:         id,
		authorID:   authorID,
		content:    content,
		images:     images,
		likeCount:  likeCount,
		timestamps: shared.Timestamps{CreatedAt: createdAt, UpdatedAt: updatedAt},
	}
}

// 访问器（无 setter：不可编辑）
func (t *Tweet) ID() shared.ID        { return t.id }
func (t *Tweet) AuthorID() shared.ID  { return t.authorID }
func (t *Tweet) Content() string      { return t.content }
func (t *Tweet) Images() []string     { return t.images }
func (t *Tweet) LikeCount() int       { return t.likeCount }
func (t *Tweet) CreatedAt() time.Time { return t.timestamps.CreatedAt }
func (t *Tweet) UpdatedAt() time.Time { return t.timestamps.UpdatedAt }
