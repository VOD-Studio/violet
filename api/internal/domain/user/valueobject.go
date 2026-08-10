package user

import (
	"net/mail"
	"regexp"
	"strings"

	"blog-api/internal/domain/shared"
)

// ============================================================
// Email 值对象
// ============================================================

// Email 邮箱地址值对象
//
// 值对象（Value Object）没有身份标识，由属性值定义相等性。
// 封装邮箱格式校验，避免在 service/handler 各处重复校验逻辑。
type Email struct {
	// value 规范化后的邮箱地址（小写、去首尾空白），构造后不可变
	value string
}

// ParseEmail 解析并校验邮箱地址
func ParseEmail(s string) (Email, error) {
	addr, err := mail.ParseAddress(strings.TrimSpace(s))
	if err != nil {
		return Email{}, shared.BadRequest("邮箱格式无效")
	}
	return Email{value: strings.ToLower(addr.Address)}, nil
}

// String 返回邮箱字符串
func (e Email) String() string { return e.value }

// Equal 比较两个邮箱是否相同（大小写不敏感，已规范化）
func (e Email) Equal(other Email) bool { return e.value == other.value }

// ============================================================
// Username 值对象
// ============================================================

// usernamePattern 用户名正则：3-32 位字母、数字、下划线或连字符
//
// 纯 ASCII 技术标识符（登录、@寻址、URL slug），不含中文/空格/emoji——
// 展示性内容交给 DisplayName。参照 GitHub/Discord 的 username 规则。
var usernamePattern = regexp.MustCompile(`^[a-zA-Z0-9_-]{3,32}$`)

// Username 用户名值对象
type Username struct {
	// value 校验通过的用户名（满足 usernamePattern：3-32 位字母、数字、下划线或连字符）
	value string
}

// ParseUsername 解析并校验用户名
func ParseUsername(s string) (Username, error) {
	s = strings.TrimSpace(s)
	if !usernamePattern.MatchString(s) {
		return Username{}, shared.BadRequest("用户名须为 3-32 位字母、数字、下划线或连字符")
	}
	return Username{value: s}, nil
}

// String 返回用户名字符串
func (u Username) String() string { return u.value }

// Equal 比较两个用户名是否相同
func (u Username) Equal(other Username) bool { return u.value == other.value }

// ============================================================
// DisplayName 值对象
// ============================================================

// displayNameMaxLength 显示名最大长度（与 username 一致，32 字符）
const displayNameMaxLength = 32

// DisplayName 显示名值对象（可空）
//
// 与 Username 的区别：纯展示用途，允许重复、允许空格/emoji/任意 Unicode，
// 可随时修改，不参与登录/寻址。空值合法——前端展示时空回退到 username。
type DisplayName struct {
	// value 显示名原文（已 trim）；空串表示未设置
	value string
}

// ParseDisplayName 解析并校验显示名
//
// 空串合法（返回零值，表示未设置）；非空则 trim 后校验长度 ≤32。
// 不做字符集限制——展示名允许空格、emoji、任意语言文字。
func ParseDisplayName(s string) (DisplayName, error) {
	s = strings.TrimSpace(s)
	if len([]rune(s)) > displayNameMaxLength {
		return DisplayName{}, shared.BadRequest("显示名最多 32 个字符")
	}
	return DisplayName{value: s}, nil
}

// String 返回显示名；未设置时返回空串
func (d DisplayName) String() string { return d.value }

// IsEmpty 是否未设置显示名
func (d DisplayName) IsEmpty() bool { return d.value == "" }

// ============================================================
// PasswordHash 值对象
// ============================================================

// PasswordHash 密码哈希值对象
//
// 仅存储哈希值，明文密码不进入领域层。
// 哈希算法（bcrypt）与 cost 配置由基础设施层 AuthService 实现，
// 领域层只持有已哈希的结果。
type PasswordHash struct {
	// value 密码哈希字符串（bcrypt 输出）；明文密码从不进入领域层
	value string
}

// NewPasswordHash 从已有的哈希字符串构造（从 DB 重建用户时使用）
func NewPasswordHash(hash string) PasswordHash {
	return PasswordHash{value: hash}
}

// String 返回哈希字符串
func (p PasswordHash) String() string { return p.value }

// ============================================================
// Role 值对象
// ============================================================

// Role 角色值对象
type Role string

const (
	// RoleUser 普通用户
	RoleUser Role = "user"
	// RoleAuthor 作者（内容创作者，权限介于 user 与 admin 之间）
	RoleAuthor Role = "author"
	// RoleAdmin 管理员
	RoleAdmin Role = "admin"
	// RoleSuperAdmin 超级管理员
	RoleSuperAdmin Role = "superadmin"
)

// IsValid 是否为合法角色
func (r Role) IsValid() bool {
	switch r {
	case RoleUser, RoleAuthor, RoleAdmin, RoleSuperAdmin:
		return true
	}
	return false
}

// IsAdmin 是否为管理类角色（admin 或 superadmin）
//
// author 不属于管理类角色，无用户/角色/设置等管理权限。
func (r Role) IsAdmin() bool {
	return r == RoleAdmin || r == RoleSuperAdmin
}

// IsSuperAdmin 是否为超级管理员
//
// 用于权限守卫：superadmin 拥有所有权限、不可被普通管理员降级/删除。
func (r Role) IsSuperAdmin() bool {
	return r == RoleSuperAdmin
}
