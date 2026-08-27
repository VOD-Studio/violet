package command

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"sync"

	"github.com/rs/zerolog/log"

	"blog-api/internal/brand"
	domainsettings "blog-api/internal/domain/settings"
	"blog-api/internal/domain/shared"
)

// OAuthCredentials OAuth 凭据的运行时可变存储。
//
// 初始值来自进程环境（config.Load）；后台写入后内存立即生效（登录链路
// 每次调用实时读取），并尽力持久化到 .env（容器内 /app/.env，生产经
// compose 挂载即宿主机 .env），使重建容器后新值成为初始环境。
// 不落库：client_secret 属敏感凭据，与 site_settings（可公开读取的
// 运行配置）隔离，与 env 密钥同一信任域。
type OAuthCredentials struct {
	mu              sync.RWMutex
	googleClientID  string
	githubClientID  string
	githubSecret    string
	dotenvPersisted bool // 最近一次写入是否成功落盘（status 端点展示）
}

// NewOAuthCredentials 构造，初始值来自启动环境
func NewOAuthCredentials(googleClientID, githubClientID, githubClientSecret string) *OAuthCredentials {
	return &OAuthCredentials{
		googleClientID: googleClientID,
		githubClientID: githubClientID,
		githubSecret:   githubClientSecret,
	}
}

// GoogleClientID 当前生效的 Google client_id
func (c *OAuthCredentials) GoogleClientID() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.googleClientID
}

// GithubClientID 当前生效的 GitHub client_id
func (c *OAuthCredentials) GithubClientID() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.githubClientID
}

// GithubClientSecret 当前生效的 GitHub client_secret
func (c *OAuthCredentials) GithubClientSecret() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.githubSecret
}

// OAuthCredentialUpdate OAuth 凭据写入入参（指针表部分更新，nil 不更新）
type OAuthCredentialUpdate struct {
	GoogleClientID     *string
	GithubClientID     *string
	GithubClientSecret *string
}

// Update 更新内存凭据并持久化 .env。
// 内存更新成功即返回 nil（登录链路立即用新值）；.env 落盘失败仅记日志，
// 由 Status 的 persisted 字段暴露给后台提示「重启后失效」。
func (c *OAuthCredentials) Update(in OAuthCredentialUpdate) error {
	c.mu.Lock()
	if in.GoogleClientID != nil {
		c.googleClientID = strings.TrimSpace(*in.GoogleClientID)
	}
	if in.GithubClientID != nil {
		c.githubClientID = strings.TrimSpace(*in.GithubClientID)
	}
	if in.GithubClientSecret != nil {
		c.githubSecret = strings.TrimSpace(*in.GithubClientSecret)
	}
	c.mu.Unlock()
	c.dotenvPersisted = persistOAuthDotenv(c)
	return nil
}

// ProviderStatus 单个 provider 的凭据状态
type ProviderStatus struct {
	// Configured 凭据是否齐全（登录链路可用）
	Configured bool `json:"configured"`
	// ClientIDPreview client_id 脱敏预览（公开值，仅截断展示；secret 绝不外泄）
	ClientIDPreview string `json:"client_id_preview"`
	// Issue 不可用原因（空串=正常）
	Issue string `json:"issue"`
}

// OAuthStatusOutput 凭据状态查询输出
type OAuthStatusOutput struct {
	Google ProviderStatus `json:"google"`
	Github ProviderStatus `json:"github"`
	// Persisted 最近一次写入是否成功落盘 .env（false=重启后失效）
	Persisted bool `json:"persisted"`
}

// Status 检测两个 provider 的凭据配置状态。
// Google 只需 client_id（ID token 校验方向）；GitHub 需 id + secret 成对。
func (c *OAuthCredentials) Status() OAuthStatusOutput {
	c.mu.RLock()
	defer c.mu.RUnlock()

	g := ProviderStatus{ClientIDPreview: preview(c.googleClientID)}
	switch {
	case c.googleClientID == "":
		g.Issue = "未配置 client_id"
	case !strings.HasSuffix(c.googleClientID, ".apps.googleusercontent.com"):
		g.Issue = "client_id 格式异常（应以 .apps.googleusercontent.com 结尾）"
	default:
		g.Configured = true
	}

	gh := ProviderStatus{ClientIDPreview: preview(c.githubClientID)}
	switch {
	case c.githubClientID == "" && c.githubSecret == "":
		gh.Issue = "未配置 client_id 与 client_secret"
	case c.githubClientID == "":
		gh.Issue = "未配置 client_id"
	case c.githubSecret == "":
		gh.Issue = "未配置 client_secret"
	default:
		gh.Configured = true
	}

	return OAuthStatusOutput{Google: g, Github: gh, Persisted: c.dotenvPersisted}
}

// preview 脱敏预览：保留前 8 后 6 字符，过短则全掩码
func preview(s string) string {
	if s == "" {
		return ""
	}
	if len(s) <= 14 {
		return s[:2] + "****"
	}
	return s[:8] + "..." + s[len(s)-6:]
}

// dotenvCandidates .env 候选路径，与 config.Load 的 godotenv.Load 对齐：
// 容器内 /app/.env（compose 挂载宿主机 .env）；本地开发 api/(go run) 的 ../.env
// 与仓库根 .env。取第一个「存在或可创建」的。
func dotenvCandidates() []string {
	return []string{".env", "../.env"}
}

// persistOAuthDotenv 把凭据 upsert 进 .env。
//
// 读-改-写整文件：保留既有键序与注释，仅替换/追加三个 OAuth 键。
// 首个候选路径均不存在时在 cwd 创建 .env（容器 WORKDIR /app）。
func persistOAuthDotenv(c *OAuthCredentials) bool {
	c.mu.RLock()
	kvs := map[string]string{
		"GOOGLE_CLIENT_ID":     c.googleClientID,
		"GITHUB_CLIENT_ID":     c.githubClientID,
		"GITHUB_CLIENT_SECRET": c.githubSecret,
	}
	c.mu.RUnlock()

	var path string
	for _, p := range dotenvCandidates() {
		if _, err := os.Stat(p); err == nil {
			path = p
			break
		}
	}
	if path == "" {
		path = dotenvCandidates()[0]
	}

	data, err := os.ReadFile(path)
	if err != nil && !os.IsNotExist(err) {
		log.Warn().Str("path", path).Err(err).Msg("读取 .env 失败，OAuth 凭据仅内存生效")
		return false
	}

	lines := upsertDotenvKeys(strings.Split(string(data), "\n"), kvs)
	out := strings.Join(lines, "\n")
	if !strings.HasSuffix(out, "\n") {
		out += "\n"
	}
	if err := os.WriteFile(path, []byte(out), 0o600); err != nil {
		log.Warn().Str("path", path).Err(err).Msg("写入 .env 失败，OAuth 凭据仅内存生效（容器重建后丢失）")
		return false
	}
	return true
}

var dotenvKeyOrder = [...]string{"GOOGLE_CLIENT_ID", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"}

// upsertDotenvKeys 在 .env 行数组里替换或追加键值（保留注释与顺序）
func upsertDotenvKeys(lines []string, kvs map[string]string) []string {
	done := make(map[string]bool, len(kvs))
	out := make([]string, 0, len(lines)+len(kvs))
	for _, ln := range lines {
		replaced := ln
		for k, v := range kvs {
			if strings.HasPrefix(strings.TrimLeft(ln, " \t"), k+"=") {
				replaced = fmt.Sprintf("%s=%s", k, v)
				done[k] = true
				break
			}
		}
		out = append(out, replaced)
	}
	for _, key := range dotenvKeyOrder {
		if value, ok := kvs[key]; ok && !done[key] {
			out = append(out, fmt.Sprintf("%s=%s", key, value))
			done[key] = true
		}
	}
	extraKeys := make([]string, 0, len(kvs))
	for key := range kvs {
		if !done[key] {
			extraKeys = append(extraKeys, key)
		}
	}
	sort.Strings(extraKeys)
	for _, key := range extraKeys {
		out = append(out, fmt.Sprintf("%s=%s", key, kvs[key]))
	}
	return out
}

// VerifyResult 单 provider 凭据有效性探测结果
type VerifyResult struct {
	// Valid 凭据在 provider 侧有效（token 端点确认 client 存在且 secret 匹配）
	Valid bool `json:"valid"`
	// Detail 探测详情（有效时给确认语，无效时给 provider 侧原因）
	Detail string `json:"detail"`
}

// verifyProbeCode 探测用的一次性 code：永远无效，仅用于把 provider 推进到
// 凭据校验环节——OAuth 无公开的 client 查询端点（防枚举），token 端点的
// 错误码是唯一可程序化区分「凭据被删/被改」与「code 无效」的信号。
const verifyProbeCode = "violet-oauth-verify-probe"

// VerifyProvider 探测 provider 侧凭据有效性（手动触发，勿自动轮询——
// 高频探测会被 provider 限流）。
//
// 判读矩阵（token 端点对假 code 的响应）：
//
//	GitHub: 404 → App 已删；incorrect_client_credentials → secret 错；
//	        bad_verification_code → 凭据有效
//	Google: invalid_client → client 已删；其余（invalid_request 等）→ 存在
func (c *OAuthCredentials) VerifyProvider(ctx context.Context, provider string) (VerifyResult, error) {
	switch provider {
	case "google":
		return c.verifyGoogle(ctx)
	case "github":
		return c.verifyGithub(ctx)
	default:
		return VerifyResult{}, shared.BadRequest("未知 provider: " + provider)
	}
}

func (c *OAuthCredentials) verifyGoogle(ctx context.Context) (VerifyResult, error) {
	id := c.GoogleClientID()
	if id == "" {
		return VerifyResult{}, domainsettings.ErrOAuthNotConfigured
	}
	form := url.Values{
		"client_id":  {id},
		"grant_type": {"authorization_code"},
		"code":       {verifyProbeCode},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://oauth2.googleapis.com/token", strings.NewReader(form.Encode()))
	if err != nil {
		return VerifyResult{}, shared.Internal("构建 Google 探测请求失败", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return VerifyResult{}, shared.Internal("Google 探测请求失败（检查服务器出网/代理）", err)
	}
	defer resp.Body.Close()

	var body struct {
		Error            string `json:"error"`
		ErrorDescription string `json:"error_description"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&body)

	// invalid_client → App 已删；其余错误（invalid_request 缺 secret 校验 /
	// invalid_grant 假 code）都说明走过了 client 存在性检查
	if body.Error == "invalid_client" {
		return VerifyResult{Valid: false, Detail: "Google 侧不存在此 client_id（App 可能已删除）: " + body.ErrorDescription}, nil
	}
	return VerifyResult{Valid: true, Detail: "client_id 在 Google 侧有效"}, nil
}

func (c *OAuthCredentials) verifyGithub(ctx context.Context) (VerifyResult, error) {
	id, secret := c.GithubClientID(), c.GithubClientSecret()
	if id == "" || secret == "" {
		return VerifyResult{}, domainsettings.ErrOAuthNotConfigured
	}
	form := url.Values{
		"client_id":     {id},
		"client_secret": {secret},
		"code":          {verifyProbeCode},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://github.com/login/oauth/access_token", strings.NewReader(form.Encode()))
	if err != nil {
		return VerifyResult{}, shared.Internal("构建 GitHub 探测请求失败", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", brand.GitHubOAuthUA)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return VerifyResult{}, shared.Internal("GitHub 探测请求失败（检查服务器出网/代理）", err)
	}
	defer resp.Body.Close()

	var body struct {
		Error            string `json:"error"`
		ErrorDescription string `json:"error_description"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&body)

	switch {
	case resp.StatusCode == http.StatusNotFound:
		return VerifyResult{Valid: false, Detail: "GitHub 侧不存在此 client_id（OAuth App 可能已删除）"}, nil
	case body.Error == "incorrect_client_credentials":
		return VerifyResult{Valid: false, Detail: "client_secret 与 GitHub 侧不匹配（可能已被重置）"}, nil
	case body.Error == "bad_verification_code":
		// 走到了 code 校验环节：id 与 secret 均被 GitHub 接受
		return VerifyResult{Valid: true, Detail: "凭据在 GitHub 侧有效"}, nil
	case body.Error != "":
		return VerifyResult{Valid: false, Detail: body.Error + ": " + body.ErrorDescription}, nil
	default:
		return VerifyResult{}, shared.Internal("GitHub 探测返回未预期的成功响应", errors.New("probe code accepted"))
	}
}
