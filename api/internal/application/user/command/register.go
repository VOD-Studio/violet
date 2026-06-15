// Package command 提供用户聚合的写操作用例（CQRS 的 Command 侧）。
//
// 每个用例对应一个 Handler 结构体，封装业务编排逻辑：
// 1. 调用领域层校验（值对象构造、聚合方法）
// 2. 通过 repository 持久化
// 3. 收集并发布领域事件
//
// 用例层不感知 HTTP/GORM 等技术细节，只依赖领域接口与应用层端口。
package command

import (
	"context"

	"golang.org/x/crypto/bcrypt"

	appshared "blog-api/internal/application/shared"
	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/user"
)

// RegisterUserInput 注册用户命令入参（DTO）
type RegisterUserInput struct {
	Email    string
	Username string
	Password string
}

// RegisterUserOutput 注册用户命令出参（DTO）
type RegisterUserOutput struct {
	// UserID 新用户的 ID
	UserID shared.ID
}

// RegisterUserHandler 用户注册用例
//
// 编排流程：
// 1. 校验邮箱/用户名查重（领域规则：全局唯一）
// 2. 构造值对象（Email/Username，含格式校验）
// 3. 哈希密码（基础设施关注点，注入 PasswordHasher）
// 4. 调用 NewUser 工厂创建聚合（记录 UserRegistered 事件）
// 5. 持久化
// 6. 发布领域事件
type RegisterUserHandler struct {
	userRepo        user.UserRepository
	eventBus        appshared.EventBus
	passwordHasher  PasswordHasher
}

// PasswordHasher 密码哈希端口（基础设施层实现 bcrypt）
//
// 领域层不依赖 bcrypt，通过此接口解耦。
type PasswordHasher interface {
	// Hash 对明文密码哈希
	Hash(plain string) (user.PasswordHash, error)
}

// NewRegisterUserHandler 创建注册用例处理器
func NewRegisterUserHandler(
	repo user.UserRepository,
	bus appshared.EventBus,
	hasher PasswordHasher,
) *RegisterUserHandler {
	return &RegisterUserHandler{
		userRepo:       repo,
		eventBus:       bus,
		passwordHasher: hasher,
	}
}

// Handle 执行用户注册
func (h *RegisterUserHandler) Handle(ctx context.Context, in RegisterUserInput) (RegisterUserOutput, error) {
	// 1. 构造并校验值对象（格式合法性）
	email, err := user.ParseEmail(in.Email)
	if err != nil {
		return RegisterUserOutput{}, err
	}
	username, err := user.ParseUsername(in.Username)
	if err != nil {
		return RegisterUserOutput{}, err
	}

	// 2. 业务规则校验：邮箱/用户名全局唯一
	emailExists, err := h.userRepo.ExistsByEmail(ctx, email)
	if err != nil {
		return RegisterUserOutput{}, err
	}
	if emailExists {
		return RegisterUserOutput{}, user.ErrEmailExists
	}
	usernameExists, err := h.userRepo.ExistsByUsername(ctx, username)
	if err != nil {
		return RegisterUserOutput{}, err
	}
	if usernameExists {
		return RegisterUserOutput{}, user.ErrUsernameExists
	}

	// 3. 哈希密码（基础设施关注点）
	hash, err := h.passwordHasher.Hash(in.Password)
	if err != nil {
		return RegisterUserOutput{}, shared.Internal("密码哈希失败", err)
	}

	// 4. 调用聚合工厂创建用户（记录 UserRegistered 事件）
	u := user.NewUser(shared.NewID(), email, username, hash)

	// 5. 持久化
	if err := h.userRepo.Save(ctx, u); err != nil {
		return RegisterUserOutput{}, err
	}

	// 6. 收集并发布领域事件
	if events := u.PullEvents(); len(events) > 0 {
		if err := h.eventBus.Publish(ctx, events); err != nil {
			// 事件发布失败不回滚已提交的状态变更（已持久化）
			// 仅记录错误，由调用方决定是否补偿（P3 阶段可引入 outbox 模式）
			_ = err // TODO: 接入日志
		}
	}

	return RegisterUserOutput{UserID: u.GetID()}, nil
}

// BcryptHasher bcrypt 密码哈希实现
//
// 实现应用层 PasswordHasher 端口，使用 bcrypt.DefaultCost。
type BcryptHasher struct{}

// NewBcryptHasher 创建 bcrypt 哈希器
func NewBcryptHasher() *BcryptHasher { return &BcryptHasher{} }

// Hash 使用 bcrypt 哈希明文密码
func (BcryptHasher) Hash(plain string) (user.PasswordHash, error) {
	hashed, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	if err != nil {
		return user.PasswordHash{}, err
	}
	return user.NewPasswordHash(string(hashed)), nil
}
