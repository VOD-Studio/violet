// Package handler 提供 HTTP 请求处理器，负责接收请求、验证参数、调用服务层并返回响应
package handler

import (
	"net/http"

	"github.com/rs/zerolog/log"

	"blog-api/internal/pkg/response"
	"blog-api/internal/service"
)

// GitHubHandler GitHub API 代理处理器
type GitHubHandler struct {
	githubService *service.GitHubService
}

// NewGitHubHandler 创建 GitHub 处理器实例
func NewGitHubHandler(githubService *service.GitHubService) *GitHubHandler {
	return &GitHubHandler{
		githubService: githubService,
	}
}

// GetContributions 获取 GitHub 贡献数据
// GET /api/v1/admin/github/contributions?username=xxx
func (h *GitHubHandler) GetContributions(w http.ResponseWriter, r *http.Request) {
	username := r.URL.Query().Get("username")
	if username == "" {
		response.BadRequest(w, "缺少 username 参数")
		return
	}

	data, err := h.githubService.GetContributions(r.Context(), username)
	if err != nil {
		log.Error().Err(err).Str("username", username).Msg("获取 GitHub 贡献数据失败")
		response.InternalServerError(w, "获取 GitHub 贡献数据失败")
		return
	}

	response.Success(w, data)
}

// GetRepos 获取 GitHub 仓库数据
// GET /api/v1/admin/github/repos?username=xxx
func (h *GitHubHandler) GetRepos(w http.ResponseWriter, r *http.Request) {
	username := r.URL.Query().Get("username")
	if username == "" {
		response.BadRequest(w, "缺少 username 参数")
		return
	}

	data, err := h.githubService.GetRepos(r.Context(), username)
	if err != nil {
		log.Error().Err(err).Str("username", username).Msg("获取 GitHub 仓库数据失败")
		response.InternalServerError(w, "获取 GitHub 仓库数据失败")
		return
	}

	response.Success(w, data)
}
