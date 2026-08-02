// Package audit 提供操作日志的领域模型与存储端口。
//
// 设计原则：审计日志按定义不可变（append-only），因此领域层只暴露
// Append/List 写入与读取能力，不提供 Update/Delete 方法。
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
// 命名规范：动词过去时描述「事实已发生」，与领域事件命名风格一致。
var (
	ActionCreate         = MustParse("create")          // 创建资源
	ActionUpdate         = MustParse("update")          // 更新资源
	ActionDelete         = MustParse("delete")          // 删除资源
	ActionPublish        = MustParse("publish")         // 文章发布
	ActionUnpublish      = MustParse("unpublish")       // 文章取消发布
	ActionArchive        = MustParse("archive")         // 文章归档
	ActionUpdateRole     = MustParse("update_role")     // 用户角色变更
	ActionUpdateStatus   = MustParse("update_status")   // 用户状态变更
	ActionBatchUpdate    = MustParse("batch_update")    // 批量更新
	ActionUpdatePerms    = MustParse("update_perms")    // 角色权限变更
	ActionLogin          = MustParse("login")           // 登录成功
	ActionLogout         = MustParse("logout")          // 登出
	ActionLoginFailed    = MustParse("login_failed")    // 登录失败
)

// Actor 操作人
//
// UserID/UserName/IPAddress/UserAgent 全部为写入时快照（用户删除后仍可追溯）。
type Actor struct {
	// UserID 操作人 UUID（匿名操作时为空）
	UserID string `json:"user_id"`
	// UserName 操作人用户名快照（冗余存储，用户删除后仍可追溯）
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
	// Changes 字段变更列表（update 类事件必填）
	Changes []FieldChange `json:"changes,omitempty"`
	// Metadata 兜底元数据（无法结构化的额外信息）
	Metadata map[string]any `json:"metadata,omitempty"`
	// OccurredAt 发生时间
	OccurredAt time.Time `json:"occurred_at"`
}

// ListResult 日志列表结果（含分页）
type ListResult struct {
	// Events 当前页的事件列表
	Events []AuditEvent
	// Total 符合筛选条件的总条数（供分页计算总页数）
	Total int64
}

// ListFilter 审计事件查询筛选条件（nil 字段不筛）
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
// 实现应保证：Append 失败返回 error，不静默；List/ListByActor 仅做查询，不应修改存储。
type EventStore interface {
	// Append 写入一条审计事件（append-only，不可变更存储中的记录）
	Append(ctx context.Context, event AuditEvent) error
	// List 分页查询全部事件（按 OccurredAt DESC）
	List(ctx context.Context, page, limit int) (ListResult, error)
	// ListByActor 分页查询指定操作人的事件
	ListByActor(ctx context.Context, userID string, page, limit int) (ListResult, error)
	// ListFiltered 按筛选条件分页查询（action/resource_type/actor 可选）
	ListFiltered(ctx context.Context, filter ListFilter, page, limit int) (ListResult, error)
}
