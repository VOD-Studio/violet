// Package github 提供 GitHub 数据的基础设施适配器。
//
// 实现 domain/github.GitHubProvider 端口，封装 GitHub GraphQL + REST API 调用。
// token 由 application 层从站点配置注入，adapter 本身无状态。
package github

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	domaingithub "blog-api/internal/domain/github"
)

// Adapter GitHub API 适配器
type Adapter struct {
	client *http.Client
}

// NewAdapter 创建 GitHub 适配器
func NewAdapter() *Adapter {
	return &Adapter{client: &http.Client{Timeout: 15 * time.Second}}
}

// GetContributions 获取贡献日历（GraphQL）
func (a *Adapter) GetContributions(ctx context.Context, username, token string) (*domaingithub.ContributionData, error) {
	if token == "" {
		return &domaingithub.ContributionData{Username: username}, nil
	}
	now := time.Now()
	from := now.AddDate(-1, 0, 0)
	query := `query($username: String!, $from: DateTime!, $to: DateTime!) {
		user(login: $username) {
			contributionsCollection(from: $from, to: $to) {
				contributionCalendar {
					totalContributions
					weeks { contributionDays { date contributionCount color } }
				}
			}
		}
	}`
	payload, _ := json.Marshal(map[string]any{
		"query": query,
		"variables": map[string]string{
			"username": username,
			"from":     from.Format(time.RFC3339),
			"to":       now.Format(time.RFC3339),
		},
	})
	body, err := a.graphql(ctx, token, payload)
	if err != nil {
		return nil, err
	}
	var result struct {
		Errors []struct{ Message string `json:"message"` } `json:"errors"`
		Data struct {
			User struct {
				ContributionsCollection struct {
					ContributionCalendar struct {
						TotalContributions int `json:"totalContributions"`
						Weeks []struct {
							ContributionDays []struct {
								Date              string `json:"date"`
								ContributionCount int    `json:"contributionCount"`
							} `json:"contributionDays"`
						} `json:"weeks"`
					} `json:"contributionCalendar"`
				} `json:"contributionsCollection"`
			} `json:"user"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("解析贡献数据失败: %w", err)
	}
	if len(result.Errors) > 0 {
		return nil, fmt.Errorf("GraphQL 错误: %s", result.Errors[0].Message)
	}
	cal := result.Data.User.ContributionsCollection.ContributionCalendar
	days := make([]domaingithub.Contribution, 0)
	for _, week := range cal.Weeks {
		for _, day := range week.ContributionDays {
			days = append(days, domaingithub.Contribution{Date: day.Date, Count: day.ContributionCount})
		}
	}
	return &domaingithub.ContributionData{
		Username: username, TotalContributions: cal.TotalContributions, Contributions: days,
	}, nil
}

// GetRepos 获取仓库列表（含 pinned）
func (a *Adapter) GetRepos(ctx context.Context, username, token string) ([]domaingithub.RepoData, error) {
	if token == "" {
		return []domaingithub.RepoData{}, nil
	}
	pinnedNames, _ := a.fetchPinnedNames(ctx, username, token)
	apiURL := fmt.Sprintf("https://api.github.com/users/%s/repos?sort=stars&per_page=100&type=owner", username)
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Authorization", "bearer "+token)
	resp, err := a.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求 GitHub API 失败: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub API 返回 %d", resp.StatusCode)
	}
	var repos []struct {
		Name            string  `json:"name"`
		Description     *string `json:"description"`
		Language        *string `json:"language"`
		StargazersCount int     `json:"stargazers_count"`
		ForksCount      int     `json:"forks_count"`
		HTMLURL         string  `json:"html_url"`
		Fork            bool    `json:"fork"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&repos); err != nil {
		return nil, fmt.Errorf("解析仓库数据失败: %w", err)
	}
	var filtered []domaingithub.RepoData
	if len(pinnedNames) > 0 {
		pinnedSet := make(map[string]bool, len(pinnedNames))
		for _, n := range pinnedNames {
			pinnedSet[n] = true
		}
		for _, r := range repos {
			if pinnedSet[r.Name] {
				filtered = append(filtered, repoToDomain(r.Name, r.Description, r.Language, r.StargazersCount, r.ForksCount, r.HTMLURL, r.Fork, true))
			}
		}
	} else {
		count := 0
		for _, r := range repos {
			if r.Fork {
				continue
			}
			filtered = append(filtered, repoToDomain(r.Name, r.Description, r.Language, r.StargazersCount, r.ForksCount, r.HTMLURL, r.Fork, false))
			count++
			if count >= 6 {
				break
			}
		}
	}
	return filtered, nil
}

func repoToDomain(name string, desc, lang *string, stars, forks int, url string, isFork, pinned bool) domaingithub.RepoData {
	dto := domaingithub.RepoData{Name: name, Stars: stars, Forks: forks, URL: url, Pinned: pinned}
	if desc != nil {
		dto.Description = *desc
	}
	if lang != nil {
		dto.Language = *lang
	}
	return dto
}

func (a *Adapter) fetchPinnedNames(ctx context.Context, username, token string) ([]string, error) {
	query := `query($username: String!) {
		user(login: $username) {
			pinnedItems(first: 6) {
				nodes { ... on Repository { name } }
			}
		}
	}`
	payload, _ := json.Marshal(map[string]any{
		"query": query, "variables": map[string]string{"username": username},
	})
	body, err := a.graphql(ctx, token, payload)
	if err != nil {
		return nil, err
	}
	var result struct {
		Data struct {
			User struct {
				PinnedItems struct {
					Nodes []struct{ Name string `json:"name"` } `json:"nodes"`
				} `json:"pinnedItems"`
			} `json:"user"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	names := make([]string, 0, len(result.Data.User.PinnedItems.Nodes))
	for _, n := range result.Data.User.PinnedItems.Nodes {
		if n.Name != "" {
			names = append(names, n.Name)
		}
	}
	return names, nil
}

func (a *Adapter) graphql(ctx context.Context, token string, payload []byte) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.github.com/graphql", bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "bearer "+token)
	resp, err := a.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求 GitHub API 失败: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub API 返回 %d: %s", resp.StatusCode, string(body))
	}
	return body, nil
}

var _ domaingithub.GitHubProvider = (*Adapter)(nil)
