package app

import (
	"context"

	appmcp "blog-api/internal/application/mcp"
	domainshared "blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
)

// userFinder 解析操作者只需要按 ID 查用户。
type userFinder interface {
	FindByID(ctx context.Context, id domainshared.ID) (*domainuser.User, error)
}

// mcpOperatorResolver 按用户 ID 取 PAT 持有人的角色与账号状态，
// 让路线图服务能按持有人真实的 project:update 权限放行或拒绝。
type mcpOperatorResolver struct {
	users userFinder
}

func newMCPOperatorResolver(users userFinder) appmcp.OperatorResolver {
	return mcpOperatorResolver{users: users}
}

func (r mcpOperatorResolver) Resolve(ctx context.Context, userID string) (appmcp.Operator, error) {
	id, err := domainshared.ParseID(userID)
	if err != nil {
		return appmcp.Operator{}, err
	}
	user, err := r.users.FindByID(ctx, id)
	if err != nil {
		return appmcp.Operator{}, err
	}
	return appmcp.Operator{Role: string(user.Role()), IsRoot: user.IsRoot(), Active: user.IsActive()}, nil
}
