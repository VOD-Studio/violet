package command

// OAuthCredentials OAuth 凭据：纯 env 只读。
//
// 登录链路与公开 client_id 下发共享同一实例；凭据经环境变量配置，
// 无后台写入路径。
type OAuthCredentials struct {
	googleClientID string
	githubClientID string
	githubSecret   string
}

// NewOAuthCredentials 构造，值来自启动环境
func NewOAuthCredentials(googleClientID, githubClientID, githubClientSecret string) *OAuthCredentials {
	return &OAuthCredentials{
		googleClientID: googleClientID,
		githubClientID: githubClientID,
		githubSecret:   githubClientSecret,
	}
}

// GoogleClientID 当前生效的 Google client_id
func (c *OAuthCredentials) GoogleClientID() string { return c.googleClientID }

// GithubClientID 当前生效的 GitHub client_id
func (c *OAuthCredentials) GithubClientID() string { return c.githubClientID }

// GithubClientSecret 当前生效的 GitHub client_secret
func (c *OAuthCredentials) GithubClientSecret() string { return c.githubSecret }
