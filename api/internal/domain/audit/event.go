// Package audit 提供操作日志的领域模型与存储端口。
//
// 设计原则：审计日志按定义不可变（append-only），因此领域层只暴露
// Append/FindPage 写入与读取能力，不提供 Update/Delete 方法。
//
// 事件由 EventBus 订阅者写入，而非 service 层手工注入——覆盖范围
// 由聚合根 RecordEvent 决定，新增业务自动覆盖。
package audit

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"

	"blog-api/internal/domain/shared"
)

// Action 操作类型。
//
// 受控枚举：一旦发布不可改名，新增操作类型需在此处扩展，
// 并通过 Parse/MustParse 校验，避免散落的字符串字面量进入存储。
type Action struct {
	// value 操作类型原始字符串，经 Parse 校验后封装
	value string
}

// ActionMaxLength 操作类型字符串最大长度
const ActionMaxLength = 50

// Parse 解析并校验操作类型
func Parse(s string) (Action, error) {
	if s == "" {
		return Action{}, shared.BadRequest("操作类型不能为空")
	}
	if len(s) > ActionMaxLength {
		return Action{}, shared.BadRequest("操作类型长度不能超过 50 字符")
	}
	return Action{value: s}, nil
}

// MustParse 解析操作类型，非法时 panic（仅用于预定义常量）
func MustParse(s string) Action {
	a, err := Parse(s)
	if err != nil {
		panic(err)
	}
	return a
}

func (a Action) String() string { return a.value }

func (a Action) Equal(other Action) bool { return a.value == other.value }

// MarshalJSON 序列化为字符串（而非默认的 {"value":...} 结构）
func (a Action) MarshalJSON() ([]byte, error) {
	return json.Marshal(a.value)
}

// UnmarshalJSON 从字符串反序列化（读路径容错：非法值降级为空 Action）
func (a *Action) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	a.value = s
	return nil
}

// 预定义操作类型常量（覆盖全站核心操作）
//
// 命名规范：动词原形祈使句描述「执行了什么操作」，与领域事件的过去分词命名区分。
// CRUD 动词（create/update/delete）仅保留给纯粹的 CRUD 操作（如创建用户、删除角色）。
// 业务动词（fetch_feed/change_password 等）描述具体的业务操作，信噪比更高。
var (
	// --- CRUD 泛动词（纯 CRUD 操作保留） ---
	ActionCreate = MustParse("create") // 创建资源
	ActionUpdate = MustParse("update") // 更新资源（无更具体业务动词时的兜底）
	ActionDelete = MustParse("delete") // 删除资源

	// --- 文章 ---
	ActionPublish   = MustParse("publish")   // 文章发布
	ActionUnpublish = MustParse("unpublish") // 文章取消发布
	ActionArchive   = MustParse("archive")   // 文章归档

	// --- 用户 ---
	ActionChangePassword = MustParse("change_password") // 修改密码
	ActionVerifyEmail    = MustParse("verify_email")    // 邮箱验证
	ActionChangeUsername = MustParse("change_username") // 修改用户名
	ActionUpdateRole     = MustParse("update_role")     // 用户角色变更
	ActionUpdateStatus   = MustParse("update_status")   // 用户状态变更
	ActionBatchUpdate    = MustParse("batch_update")    // 批量更新

	// --- 角色权限 ---
	ActionUpdatePerms = MustParse("update_perms") // 角色权限变更

	// --- 配置 ---
	ActionUpdateConfig = MustParse("update_config") // 更新配置（站点设置等）

	// --- 认证 ---
	ActionLogin       = MustParse("login")        // 登录成功
	ActionLogout      = MustParse("logout")       // 登出
	ActionLoginFailed = MustParse("login_failed") // 登录失败

	// --- 审核 ---
	ActionApprove  = MustParse("approve")  // 审核通过
	ActionReject   = MustParse("reject")   // 标记垃圾/拒绝
	ActionModerate = MustParse("moderate") // 审核处置他人资源（撤回/删除他人作品）

	// --- 订阅 ---
	ActionFetchFeed  = MustParse("fetch_feed")  // 拉取订阅源
	ActionPauseFeed  = MustParse("pause_feed")  // 暂停订阅
	ActionResumeFeed = MustParse("resume_feed") // 恢复订阅
)

// ActorType 操作者类型（区分真人操作与系统自动化）。
//
// 业界共识（AppMaster / Cloudflare Audit Log）：审计日志须区分 user 与 system，
// 让管理员能分辨「张三删的」vs「定时任务自动删的」。
type ActorType string

const (
	// ActorTypeUser 真人操作（admin 后台点击、agent 经 MCP 调用）
	ActorTypeUser ActorType = "user"
	// ActorTypeSystem 系统自动化（定时调度器、后台 job），无真人操作
	ActorTypeSystem ActorType = "system"
)

// Actor 操作人
//
// UserID/UserName/IPAddress/UserAgent 全部为写入时快照（用户删除后仍可追溯）。
// ActorType 区分真人与系统自动化：user 从 session 取身份，system 用作业名作标识。
type Actor struct {
	// Type 操作者类型（user/system）
	Type ActorType `json:"actor_type"`
	// UserID 操作人 UUID。
	// user 类型必填；system 类型无真人，留空。
	UserID string `json:"user_id"`
	// UserName 操作人可读标识快照。
	// user 类型存用户名（冗余存储，用户删除后仍可追溯）；
	// system 类型无用户名，借用此字段存作业名（如 subscription_job），
	// 让日志活动流能显示「subscription_job 抓取了订阅 X」而非空标识。
	UserName string `json:"user_name"`
	// IPAddress 来源 IP
	IPAddress string `json:"ip_address"`
	// UserAgent User-Agent 字符串
	UserAgent string `json:"user_agent"`
}

// ResourceRef 资源引用
//
// Type/ID/Name 全部为写入时快照，避免后续实体变更影响审计追溯。
type ResourceRef struct {
	// Type 资源类型（如 post/user/role/announcement）
	Type string `json:"type"`
	// ID 资源 ID
	ID string `json:"id"`
	// Name 资源名称快照（文章标题/用户名等，可空）
	Name string `json:"name,omitempty"`
}

// FieldChange 单字段 before/after 变更
//
// 一等公民：update 类事件必填，审计的灵魂——没有变更内容等于残废。
type FieldChange struct {
	// Field 字段名（如 role/is_active/username）
	Field string `json:"field"`
	// From 变更前值（任意可序列化类型）
	From any `json:"from"`
	// To 变更后值（任意可序列化类型）
	To any `json:"to"`
}

// AuditEvent 操作日志事件（领域模型）
//
// 五要素一等公民：谁（Actor）+ 何时（OccurredAt）+ 做了什么（Action）+ 对哪个资源（Resource）+ 变更了什么（Changes）。
//
// Changes 对 update 类事件是必填；对 create/delete/login 等只描述事实的事件可为空。
// Metadata 是兜底字段，承载无法结构化的额外信息。
type AuditEvent struct {
	// EventID 事件唯一标识（UUID，用于幂等去重）
	EventID uuid.UUID `json:"event_id"`
	// Action 操作类型（受控枚举）
	Action Action `json:"action"`
	// Actor 操作人
	Actor Actor `json:"actor"`
	// Resource 资源引用
	Resource ResourceRef `json:"resource"`
	// Summary 人话摘要（后端写入时生成的中文可读描述）
	//
	// 衍生字段，真相源是 Action + Resource + Changes + Metadata。
	// 存量旧记录此字段为空串，前端降级到 action + resource 拼接展示。
	Summary string `json:"summary,omitempty"`
	// Changes 字段变更列表（update 类事件必填）
	Changes []FieldChange `json:"changes,omitempty"`
	// Metadata 兜底元数据（无法结构化的额外信息）
	Metadata map[string]any `json:"metadata,omitempty"`
	// OccurredAt 发生时间
	OccurredAt time.Time `json:"occurred_at"`
}

// ListFilter 审计事件查询筛选条件（FindPage 入参，nil 字段不筛）
type ListFilter struct {
	// Action 操作类型过滤（精确匹配，nil=不过滤）
	Action *string
	// ResourceType 资源类型过滤（精确匹配，nil=不过滤）
	ResourceType *string
	// ActorUserID 操作人过滤（精确匹配，nil=不过滤）
	ActorUserID *string
}

// EventStore 操作日志存储端口
//
// 实现应保证：Append 失败返回 error，不静默；FindPage 仅做查询，不应修改存储。
type EventStore interface {
	// Append 写入一条审计事件（append-only，不可变更存储中的记录）
	Append(ctx context.Context, event AuditEvent) error
	// FindPage 分页查询审计事件（occurred_at DESC + id DESC tiebreaker）。
	// filter 为零值时查全部；ListFilter.ActorUserID 非 nil 即指定操作人视角。
	FindPage(ctx context.Context, filter ListFilter, q shared.PageQuery) (shared.PageResult[AuditEvent], error)
}
