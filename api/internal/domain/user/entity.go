package user

import (
	"time"

	"blog-api/internal/domain/shared"
)

// ============================================================
// 领域事件
// ============================================================

// UserRegistered 用户已注册事件
//
// 触发场景：新用户注册成功后。
// 订阅者：邮件服务（发送欢迎邮件）、审计服务（记录注册日志）。
type UserRegistered struct {
	shared.BaseEvent
	// Email 注册邮箱（供订阅者发送邮件）
	Email Email
}

// NewUserRegistered 构造用户注册事件
func NewUserRegistered(userID shared.ID, email Email) UserRegistered {
	return UserRegistered{
		BaseEvent: shared.NewBaseEvent("user.registered", userID),
		Email:     email,
	}
}

// UserPasswordChanged 用户密码已修改事件
type UserPasswordChanged struct {
	shared.BaseEvent
}

// NewUserPasswordChanged 构造密码修改事件
func NewUserPasswordChanged(userID shared.ID) UserPasswordChanged {
	return UserPasswordChanged{
		BaseEvent: shared.NewBaseEvent("user.password_changed", userID),
	}
}

// UserEmailVerified 用户邮箱已验证事件
type UserEmailVerified struct {
	shared.BaseEvent
}

// NewUserEmailVerified 构造邮箱验证事件
func NewUserEmailVerified(userID shared.ID) UserEmailVerified {
	return UserEmailVerified{
		BaseEvent: shared.NewBaseEvent("user.email_verified", userID),
	}
}

// ============================================================
// User 聚合根
// ============================================================

// Status 用户账户状态
type Status string

const (
	// StatusActive 已激活
	StatusActive Status = "active"
	// StatusInactive 已禁用
	StatusInactive Status = "inactive"
)

// User 用户聚合根
//
// 用户聚合的核心不变量（Invariants）：
//   - Email 全局唯一（由 repository 保证）
//   - Username 全局唯一（由 repository 保证）
//   - EmailVerified 仅能通过验证码流程置为 true（VerifyEmail 方法）
//   - 禁用用户不能登录（IsActive=false）
//
// 聚合根方法只做纯领域逻辑，不访问 DB；
// 持久化由应用层通过 UserRepository 完成。
type User struct {
	shared.AggregateRoot

	// email 邮箱（值对象）
	email Email
	// username 用户名（值对象）
	username Username
	// passwordHash 密码哈希
	passwordHash PasswordHash
	// avatarURL 头像地址
	avatarURL string
	// bio 个人简介
	bio string
	// role 角色
	role Role
	// googleID 绑定的 Google 账号 Subject
	googleID *string
	// isBuiltinSuperAdmin 是否为内置超级管理员
	//
	// 区分"内置超管"（系统初始化的唯一超管，通配符权限，靠标志位短路）
	// 与"被委派超管"（被内置超管授予 superadmin 角色的用户，按 role_permissions 表授权）。
	// 内置超管：拥有 user:assign-superadmin 语义、可授权他人、不可被任何人降级/删除。
	// 被委派超管：不能再授权第三人（授权链不可传递）。
	isBuiltinSuperAdmin bool
	// emailVerified 邮箱是否已验证
	emailVerified bool
	// isActive 是否启用
	isActive bool
	// timestamps 审计时间戳
	timestamps shared.Timestamps
}

// ============================================================
// 工厂方法（构造聚合，封装业务规则）
// ============================================================

// NewUser 创建新用户（注册场景）
//
// 此工厂方法封装了"新用户"的业务规则：
//   - 新用户默认角色为 user
//   - 邮箱默认未验证（需通过 VerifyEmail 流程）
//   - 账户默认启用
//   - 记录 UserRegistered 事件
//
// 注意：邮箱/用户名唯一性由应用层通过 repository 检查，
// 此处仅校验值对象本身的格式合法性。
func NewUser(id shared.ID, email Email, username Username, passwordHash PasswordHash) *User {
	u := &User{
		email:         email,
		username:      username,
		passwordHash:  passwordHash,
		role:          RoleUser,
		emailVerified: false,
		isActive:      true,
	}
	u.SetID(id)
	u.RecordEvent(NewUserRegistered(id, email))
	return u
}

// ReconstructUser 从持久化数据重建用户聚合
//
// 与 NewUser 不同：不触发事件、不设置默认值，
// 完全按存储的数据恢复聚合状态。供 repository 加载时使用。
func ReconstructUser(
	id shared.ID,
	email Email,
	username Username,
	passwordHash PasswordHash,
	avatarURL string,
	bio string,
	role Role,
	googleID *string,
	isBuiltinSuperAdmin bool,
	emailVerified bool,
	isActive bool,
	createdAt time.Time,
	updatedAt time.Time,
) *User {
	u := &User{
		email:               email,
		username:            username,
		passwordHash:        passwordHash,
		avatarURL:           avatarURL,
		bio:                 bio,
		role:                role,
		googleID:            googleID,
		isBuiltinSuperAdmin: isBuiltinSuperAdmin,
		emailVerified:       emailVerified,
		isActive:            isActive,
		timestamps: shared.Timestamps{
			CreatedAt: createdAt,
			UpdatedAt: updatedAt,
		},
	}
	u.SetID(id)
	return u
}

// ============================================================
// 业务方法（改变聚合状态，维护不变量）
// ============================================================

// VerifyEmail 标记邮箱已验证
//
// 仅在未验证状态下有效，重复调用幂等（不重复记录事件）。
func (u *User) VerifyEmail() {
	if u.emailVerified {
		return // 幂等
	}
	u.emailVerified = true
	u.RecordEvent(NewUserEmailVerified(u.GetID()))
}

// ChangePassword 修改密码
//
// 哈希计算由基础设施层完成，领域层只接收已哈希的新值。
func (u *User) ChangePassword(newHash PasswordHash) {
	u.passwordHash = newHash
	u.RecordEvent(NewUserPasswordChanged(u.GetID()))
}

// ChangeUsername 修改用户名
//
// 值对象校验由调用方在 ParseUsername 完成，此处仅赋值并更新时间戳。
func (u *User) ChangeUsername(name Username) {
	u.username = name
}

// ChangeRole 修改角色
//
// 校验角色合法性，保证聚合内 role 始终是有效枚举值。
func (u *User) ChangeRole(role Role) error {
	if !role.IsValid() {
		return shared.BadRequest("无效的角色")
	}
	u.role = role
	return nil
}

// MarkAsBuiltinSuperAdmin 标记为内置超级管理员
//
// 仅由 EnsureSuperAdmin（启动期幂等校正内置超管）调用。
// 内置超管拥有通配符权限（靠 JWT 标志位短路）、可授权他人、不可被任何人降级/删除。
func (u *User) MarkAsBuiltinSuperAdmin() {
	u.isBuiltinSuperAdmin = true
	// 内置超管必然是 superadmin 角色
	u.role = RoleSuperAdmin
}

// SetGoogleID 设置绑定的 Google ID
func (u *User) SetGoogleID(id string) {
	u.googleID = &id
}

// Activate 启用账户
func (u *User) Activate() { u.isActive = true }

// Deactivate 禁用账户
func (u *User) Deactivate() { u.isActive = false }

// UpdateProfile 更新个人资料（头像、简介）
func (u *User) UpdateProfile(avatarURL, bio string) {
	u.avatarURL = avatarURL
	u.bio = bio
}

// ReRegister 重新注册（覆盖未完成验证的注册信息）
//
// 业务规则：仅允许邮箱未验证（emailVerified=false）的用户被覆盖。
// 已验证用户无法被覆盖，避免注册信息被恶意重置。
// 覆盖字段：username、passwordHash（email 保持不变，因为就是用这个邮箱查到的）。
// 不记录领域事件——这是注册流程的一部分，由调用方在注册完成后统一发事件。
//
// 调用方应先通过 ExistsByUsername 校验新 username 未被其他已验证用户占用。
func (u *User) ReRegister(username Username, passwordHash PasswordHash) error {
	if u.emailVerified {
		return ErrEmailExists // 已验证用户不可覆盖，表现为邮箱已被注册
	}
	u.username = username
	u.passwordHash = passwordHash
	return nil
}

// CanLogin 是否满足登录条件
//
// 业务规则：禁用用户不能登录。
func (u *User) CanLogin() bool { return u.isActive }

// MatchPassword 比较明文密码是否匹配哈希
//
// 实际的 bcrypt 比较由基础设施层完成（领域层不依赖 bcrypt），
// 此方法仅为领域层提供语义化查询点。调用方应使用 AuthService 实现。
func (u *User) MatchPassword(_ string) bool {
	return false // 占位：实际比较在 infrastructure/auth 包
}

// ============================================================
// 访问器（只读，保证聚合状态不被外部随意修改）
// ============================================================

func (u *User) Email() Email { return u.email }

func (u *User) Username() Username { return u.username }

func (u *User) PasswordHash() PasswordHash { return u.passwordHash }

func (u *User) AvatarURL() string { return u.avatarURL }

func (u *User) Bio() string { return u.bio }

func (u *User) Role() Role { return u.role }

// GoogleID 获取绑定的 Google ID
func (u *User) GoogleID() *string { return u.googleID }

// IsSuperAdmin 是否为超级管理员（便捷方法，权限守卫常用）
func (u *User) IsSuperAdmin() bool { return u.role.IsSuperAdmin() }

// IsBuiltinSuperAdmin 是否为内置超级管理员
//
// 区别于 IsSuperAdmin：被委派超管也是 superadmin 角色，但 isBuiltinSuperAdmin=false。
// 通配符权限、授权权、不可降级/删除等"主权"都以此为准。
func (u *User) IsBuiltinSuperAdmin() bool { return u.isBuiltinSuperAdmin }

func (u *User) EmailVerified() bool { return u.emailVerified }

func (u *User) IsActive() bool { return u.isActive }

func (u *User) CreatedAt() time.Time { return u.timestamps.CreatedAt }

func (u *User) UpdatedAt() time.Time { return u.timestamps.UpdatedAt }
