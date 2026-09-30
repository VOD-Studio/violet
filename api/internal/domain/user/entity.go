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

// UserEmailChanged 用户邮箱已修改事件
//
// From/To 为变更前后邮箱（审计 before/after 字段）。
type UserEmailChanged struct {
	shared.BaseEvent
	// From 变更前邮箱
	From string
	// To 变更后邮箱
	To string
}

// NewUserEmailChanged 构造邮箱修改事件
func NewUserEmailChanged(userID shared.ID, from, to string) UserEmailChanged {
	return UserEmailChanged{
		BaseEvent: shared.NewBaseEvent("user.email_changed", userID),
		From:      from,
		To:        to,
	}
}

// UserSoftDeleted 用户已注销（软删除）事件
//
// 注销后内容保留（作者展示为占位）、身份释放、session/PAT 全部吊销。
type UserSoftDeleted struct {
	shared.BaseEvent
	// UserName 注销前用户名快照
	UserName string
}

// NewUserSoftDeleted 构造注销事件
func NewUserSoftDeleted(userID shared.ID, userName string) UserSoftDeleted {
	return UserSoftDeleted{
		BaseEvent: shared.NewBaseEvent("user.soft_deleted", userID),
		UserName:  userName,
	}
}

// UserRestored 注销账号已恢复事件
type UserRestored struct {
	shared.BaseEvent
	// UserName 用户名快照
	UserName string
}

// NewUserRestored 构造恢复事件
func NewUserRestored(userID shared.ID, userName string) UserRestored {
	return UserRestored{
		BaseEvent: shared.NewBaseEvent("user.restored", userID),
		UserName:  userName,
	}
}

// UserRoleChanged 用户角色已变更事件
//
// From/To 为变更前后角色（审计 before/after 字段）；UserName 为资源名快照。
type UserRoleChanged struct {
	shared.BaseEvent
	// From 变更前角色
	From Role
	// To 变更后角色
	To Role
	// UserName 用户名字快照
	UserName string
}

// NewUserRoleChanged 构造角色变更事件
func NewUserRoleChanged(userID shared.ID, from, to Role, userName string) UserRoleChanged {
	return UserRoleChanged{
		BaseEvent: shared.NewBaseEvent("user.role_changed", userID),
		From:      from,
		To:        to,
		UserName:  userName,
	}
}

// UserStatusChanged 用户账户状态已变更事件
//
// From/To 为变更前后激活状态（审计 before/after 字段）；UserName 为资源名快照。
type UserStatusChanged struct {
	shared.BaseEvent
	// From 变更前状态
	From bool
	// To 变更后状态
	To bool
	// UserName 用户名字快照
	UserName string
}

// NewUserStatusChanged 构造状态变更事件
func NewUserStatusChanged(userID shared.ID, from, to bool, userName string) UserStatusChanged {
	return UserStatusChanged{
		BaseEvent: shared.NewBaseEvent("user.status_changed", userID),
		From:      from,
		To:        to,
		UserName:  userName,
	}
}

// UserUsernameChanged 用户名已变更事件
//
// From/To 为变更前后用户名（审计 before/after 字段）。
type UserUsernameChanged struct {
	shared.BaseEvent
	// From 变更前用户名
	From string
	// To 变更后用户名
	To string
}

// NewUserUsernameChanged 构造用户名变更事件
func NewUserUsernameChanged(userID shared.ID, from, to string) UserUsernameChanged {
	return UserUsernameChanged{
		BaseEvent: shared.NewBaseEvent("user.username_changed", userID),
		From:      from,
		To:        to,
	}
}

// UserDeleted 用户已删除事件
//
// 删除是破坏性操作，聚合根不可继续存在，事件由应用层手动构造发布。
// UserName 为删除前的用户名快照。
type UserDeleted struct {
	shared.BaseEvent
	// UserName 删除前用户名快照
	UserName string
}

// NewUserDeleted 构造用户删除事件
func NewUserDeleted(userID shared.ID, userName string) UserDeleted {
	return UserDeleted{
		BaseEvent: shared.NewBaseEvent("user.deleted", userID),
		UserName:  userName,
	}
}

// BatchUserStatusChanged 批量用户状态变更事件
//
// 批量 SQL 不经聚合根，事件由应用层构造：只记录受影响数量与目标状态。
type BatchUserStatusChanged struct {
	shared.BaseEvent
	// Affected 受影响用户数
	Affected int64
	// IsActive 目标状态
	IsActive bool
}

// NewBatchUserStatusChanged 构造批量状态变更事件
func NewBatchUserStatusChanged(affected int64, isActive bool) BatchUserStatusChanged {
	return BatchUserStatusChanged{
		BaseEvent: shared.NewBaseEvent("user.batch_status_changed", shared.ID{}),
		Affected:  affected,
		IsActive:  isActive,
	}
}

// BatchUserRoleChanged 批量用户角色变更事件
//
// 批量 SQL 不经聚合根，事件由应用层构造：只记录受影响数量与目标角色。
type BatchUserRoleChanged struct {
	shared.BaseEvent
	// Affected 受影响用户数
	Affected int64
	// Role 目标角色
	Role string
}

// NewBatchUserRoleChanged 构造批量角色变更事件
func NewBatchUserRoleChanged(affected int64, role string) BatchUserRoleChanged {
	return BatchUserRoleChanged{
		BaseEvent: shared.NewBaseEvent("user.batch_role_changed", shared.ID{}),
		Affected:  affected,
		Role:      role,
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
//   - EmailVerified 由可信创建入口或验证码流程置为 true
//   - 禁用用户不能登录（IsActive=false）
// 聚合根方法只做纯领域逻辑，不访问 DB；
// 持久化由应用层通过 UserRepository 完成。
type User struct {
	shared.AggregateRoot

	// email 邮箱（值对象）
	email Email
	// username 用户名（值对象，唯一登录标识）
	username Username
	// displayName 显示名（值对象，可空）。纯展示用途，空时回退 username
	displayName DisplayName
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
	// githubID 绑定的 Github 账号 ID
	githubID *string
	// githubLogin 绑定的 GitHub 用户名（login）
	//
	// 与 githubID（数字 ID，绑定判定凭证）互补：login 用于拼
	// https://github.com/<login> 主页链接。GitHub 用户可改名，每次登录刷新；
	// 存量账号在下次 GitHub 登录时回填，回填前 login 为 nil（角标只显图标不可跳转）。
	githubLogin *string
	// isRoot 是否为 root 用户
	//
	// 区分 root 与被委派超管：root 靠标志位短路通配放行、持有授权与自救主权；
	// 被委派超管由 root 授予 superadmin 角色，按角色语义通配，不能再授权第三人。
	// root 可授权他人、不可被任何人降级/删除。
	isRoot bool
	// emailVerified 邮箱是否已验证
	emailVerified bool
	// isActive 是否启用
	isActive bool
	// deletedAt 软删除（注销）时间。零值=活跃；非零=已注销：
	// 不可登录、不可被 OAuth 匹配、身份（email/username/provider id）释放可被新用户占用。
	deletedAt time.Time
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
	displayName DisplayName,
	passwordHash PasswordHash,
	avatarURL string,
	bio string,
	role Role,
	googleID *string,
	githubID *string,
	githubLogin *string,
	isRoot bool,
	emailVerified bool,
	isActive bool,
	deletedAt time.Time,
	createdAt time.Time,
	updatedAt time.Time,
) *User {
	u := &User{
		email:          email,
		username:       username,
		displayName:    displayName,
		passwordHash:   passwordHash,
		avatarURL:      avatarURL,
		bio:            bio,
		role:           role,
		googleID:       googleID,
		githubID:       githubID,
		githubLogin:    githubLogin,
		isRoot:         isRoot,
		emailVerified:  emailVerified,
		isActive:       isActive,
		deletedAt:      deletedAt,
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
	if u.username.String() == name.String() {
		return // 无实际变更不记事件
	}
	old := u.username.String()
	u.username = name
	u.RecordEvent(NewUserUsernameChanged(u.GetID(), old, name.String()))
}

// ChangeEmail 修改邮箱
//
// 值对象校验由调用方在 ParseEmail 完成，此处仅赋值并更新时间戳。
// 管理员侧互信操作：保持既有 emailVerified 状态不变（与后台建号直接已验证同语义），
// 不回退为未验证——emailVerified 是登录前置条件，回退会把用户锁在门外。
func (u *User) ChangeEmail(email Email) {
	if u.email.String() == email.String() {
		return // 无实际变更不记事件
	}
	old := u.email.String()
	u.email = email
	u.RecordEvent(NewUserEmailChanged(u.GetID(), old, email.String()))
}
// ChangeRole 修改角色
//
// 校验角色合法性，保证聚合内 role 始终是有效枚举值。
func (u *User) ChangeRole(role Role) error {
	if !role.IsValid() {
		return shared.BadRequest("无效的角色")
	}
	if u.role == role {
		return nil // 无实际变更不记事件
	}
	old := u.role
	u.role = role
	u.RecordEvent(NewUserRoleChanged(u.GetID(), old, role, u.username.String()))
	return nil
}

// MarkAsRoot 标记为 root 用户
//
// 仅由 EnsureSuperAdmin 启动期调用，幂等校正 root 账户。
// root 拥有通配权限、可授权他人、不可被任何人降级/删除。
func (u *User) MarkAsRoot() {
	u.isRoot = true
	u.role = RoleSuperAdmin
}

// SetGoogleID 设置绑定的 Google ID
func (u *User) SetGoogleID(id string) {
	u.googleID = &id
}

// SetGithubID 设置绑定的 Github ID
func (u *User) SetGithubID(id string) {
	u.githubID = &id
}

// SetGithubLogin 设置绑定的 GitHub 用户名（GitHub 登录时刷新，用户可能在 GitHub 改名）
func (u *User) SetGithubLogin(login string) {
	u.githubLogin = &login
}

// ClearGoogleID 解绑 Google 登录（置 nil，列恢复可空语义）。
func (u *User) ClearGoogleID() {
	u.googleID = nil
}

// ClearGithubID 解绑 GitHub 登录（同时清 login 快照，防悬挂的半绑定状态）。
func (u *User) ClearGithubID() {
	u.githubID = nil
	u.githubLogin = nil
}

// Delete 注销（软删除）账号。
//
// 置 deletedAt：登录/OAuth 匹配/注册查重路径全部排除（部分唯一索引同时
// 释放身份），历史内容的作者展示走「含已删」查询后由 DTO 层占位。
// root 不可注销（应用层守卫，同不可删除）。
func (u *User) Delete(now time.Time) {
	if !u.deletedAt.IsZero() {
		return // 幂等
	}
	u.deletedAt = now
	u.RecordEvent(NewUserSoftDeleted(u.GetID(), u.username.String()))
}

// Restore 恢复注销账号。
// 身份占用（email/username/provider id 被新用户持有）由应用层预检，
// 此处只清时间戳；isActive 保持原值语义（注销不改启用位）。
func (u *User) Restore() {
	u.deletedAt = time.Time{}
	u.RecordEvent(NewUserRestored(u.GetID(), u.username.String()))
}

// IsDeleted 是否已注销（软删除）。
func (u *User) IsDeleted() bool { return !u.deletedAt.IsZero() }

// DeletedAt 注销时间（零值=活跃），持久化用。
func (u *User) DeletedAt() time.Time { return u.deletedAt }

// Activate 启用账户
func (u *User) Activate() {
	if u.isActive {
		return // 无实际变更不记事件
	}
	u.isActive = true
	u.RecordEvent(NewUserStatusChanged(u.GetID(), false, true, u.username.String()))
}

// Deactivate 禁用账户
func (u *User) Deactivate() {
	if !u.isActive {
		return // 无实际变更不记事件
	}
	u.isActive = false
	u.RecordEvent(NewUserStatusChanged(u.GetID(), true, false, u.username.String()))
}

// UpdateProfile 更新个人资料（头像、简介）
//
// 无条件覆盖两个字段。OAuth 登录等需要同时设置 avatar+bio 的场景使用此方法。
// 部分更新场景请使用 UpdateAvatarURL / UpdateBio。
func (u *User) UpdateProfile(avatarURL, bio string) {
	u.avatarURL = avatarURL
	u.bio = bio
}

// UpdateDisplayName 更新显示名
//
// 值对象校验由调用方在 ParseDisplayName 完成，此处仅赋值。
// DisplayName 可空（零值表示清除显示名，回退显示 username）。
func (u *User) UpdateDisplayName(displayName DisplayName) {
	u.displayName = displayName
}

// UpdateAvatarURL 仅更新头像地址
func (u *User) UpdateAvatarURL(url string) {
	u.avatarURL = url
}

// UpdateBio 仅更新个人简介
func (u *User) UpdateBio(bio string) {
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
// 业务规则：禁用或已注销（软删除）用户不能登录。
func (u *User) CanLogin() bool { return u.isActive && u.deletedAt.IsZero() }

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

func (u *User) DisplayName() DisplayName { return u.displayName }

func (u *User) PasswordHash() PasswordHash { return u.passwordHash }

func (u *User) AvatarURL() string { return u.avatarURL }

func (u *User) Bio() string { return u.bio }

func (u *User) Role() Role { return u.role }

// GoogleID 获取绑定的 Google ID
func (u *User) GoogleID() *string { return u.googleID }

// GithubID 获取绑定的 Github ID
func (u *User) GithubID() *string { return u.githubID }

// GithubLogin 获取绑定的 GitHub 用户名；未绑定或存量未回填时为 nil
func (u *User) GithubLogin() *string { return u.githubLogin }

// OAuthIdentity 返回第三方登录身份标识，供头像角标等公开展示。
//
// provider 取 "github" / "google" / ""（未绑定）；profileURL 仅 GitHub 有
// （https://github.com/<login>），Google 无公开个人主页故恒为空串。
// 双绑定（Google 建号后绑 GitHub）时 GitHub 优先：角标可跳转主页，信息量更大。
func (u *User) OAuthIdentity() (provider, profileURL string) {
	if u.githubID != nil {
		if u.githubLogin != nil {
			return "github", "https://github.com/" + *u.githubLogin
		}
		return "github", ""
	}
	if u.googleID != nil {
		return "google", ""
	}
	return "", ""
}

// IsSuperAdmin 是否为超级管理员（便捷方法，权限守卫常用）
func (u *User) IsSuperAdmin() bool { return u.role.IsSuperAdmin() }

// IsRoot 是否为 root 用户
//
// 区别于 IsSuperAdmin：被委派超管也是 superadmin 角色，但 isRoot=false。
// 授权权、不可降级/删除等主权都以此为准。
func (u *User) IsRoot() bool { return u.isRoot }
func (u *User) EmailVerified() bool { return u.emailVerified }

func (u *User) IsActive() bool { return u.isActive }

func (u *User) CreatedAt() time.Time { return u.timestamps.CreatedAt }

func (u *User) UpdatedAt() time.Time { return u.timestamps.UpdatedAt }
