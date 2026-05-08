// Package service 提供业务逻辑层，封装数据访问和业务规则
package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/rs/zerolog/log"
)

// GitHubService GitHub API 代理服务
// 封装 GitHub GraphQL 和 REST API 调用，使用后台配置的 token
type GitHubService struct {
	client         *http.Client
	settingsService *SettingsService
}

// NewGitHubService 创建 GitHub 服务实例
func NewGitHubService(settingsService *SettingsService) *GitHubService {
	return &GitHubService{
		client: &http.Client{
			Timeout: 15 * time.Second,
		},
		settingsService: settingsService,
	}
}

// ContributionDay 贡献数据中每一天的信息
type ContributionDay struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
	Level int    `json:"level"`
}

// ContributionData 贡献数据响应
type ContributionData struct {
	TotalContributions int              `json:"totalContributions"`
	Days               []ContributionDay `json:"days"`
}

// RepoData 仓库信息
type RepoData struct {
	Name          string  `json:"name"`
	Description   *string `json:"description"`
	Language      *string `json:"language"`
	StargazerCount int    `json:"stargazerCount"`
	ForkCount     int     `json:"forkCount"`
	URL           string  `json:"url"`
	IsFork        bool    `json:"isFork"`
	LanguageColor *string `json:"languageColor"`
}

// GetContributions 获取 GitHub 贡献数据
func (s *GitHubService) GetContributions(ctx context.Context, username string) (*ContributionData, error) {
	settings, err := s.settingsService.GetAllSettings(ctx)
	if err != nil {
		return nil, fmt.Errorf("获取设置失败: %w", err)
	}
	token := settings.GitHubToken
	if token == "" {
		return &ContributionData{}, nil
	}

	now := time.Now()
	from := now.AddDate(-1, 0, 0)

	query := `
		query($username: String!, $from: DateTime!, $to: DateTime!) {
			user(login: $username) {
				contributionsCollection(from: $from, to: $to) {
					contributionCalendar {
						totalContributions
						weeks {
							contributionDays {
								date
								contributionCount
								color
							}
						}
					}
				}
			}
		}
	`

	payload := map[string]interface{}{
		"query": query,
		"variables": map[string]string{
			"username": username,
			"from":     from.Format(time.RFC3339),
			"to":       now.Format(time.RFC3339),
		},
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.github.com/graphql", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "bearer "+token)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求 GitHub API 失败: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub API 返回 %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
		Data struct {
			User struct {
				ContributionsCollection struct {
					ContributionCalendar struct {
						TotalContributions int `json:"totalContributions"`
						Weeks []struct {
							ContributionDays []struct {
								Date              string `json:"date"`
								ContributionCount int    `json:"contributionCount"`
								Color             string `json:"color"`
							} `json:"contributionDays"`
						} `json:"weeks"`
					} `json:"contributionCalendar"`
				} `json:"contributionsCollection"`
			} `json:"user"`
		} `json:"data"`
	}

	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("解析响应失败: %w", err)
	}

	if len(result.Errors) > 0 {
		return nil, fmt.Errorf("GraphQL 错误: %s", result.Errors[0].Message)
	}

	calendar := result.Data.User.ContributionsCollection.ContributionCalendar
	days := make([]ContributionDay, 0)
	for _, week := range calendar.Weeks {
		for _, day := range week.ContributionDays {
			days = append(days, ContributionDay{
				Date:  day.Date,
				Count: day.ContributionCount,
				Level: getLevelFromCount(day.ContributionCount),
			})
		}
	}

	return &ContributionData{
		TotalContributions: calendar.TotalContributions,
		Days:               days,
	}, nil
}

// GetRepos 获取 GitHub 仓库数据（含 pinned 仓库）
func (s *GitHubService) GetRepos(ctx context.Context, username string) ([]RepoData, error) {
	settings, err := s.settingsService.GetAllSettings(ctx)
	if err != nil {
		return nil, fmt.Errorf("获取设置失败: %w", err)
	}
	token := settings.GitHubToken
	if token == "" {
		return []RepoData{}, nil
	}

	// 获取 pinned 仓库名称
	pinnedNames, err := s.fetchPinnedRepoNames(ctx, username, token)
	if err != nil {
		log.Warn().Err(err).Msg("获取 pinned 仓库失败，降级为按 star 排序")
	}

	// 获取用户仓库列表
	apiURL := fmt.Sprintf("https://api.github.com/users/%s/repos?sort=stars&per_page=100&type=owner", username)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Authorization", "bearer "+token)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求 GitHub API 失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub API 返回 %d", resp.StatusCode)
	}

	var repos []struct {
		Name          string  `json:"name"`
		Description   *string `json:"description"`
		Language      *string `json:"language"`
		StargazersCount int   `json:"stargazers_count"`
		ForksCount    int     `json:"forks_count"`
		HTMLURL       string  `json:"html_url"`
		Fork          bool    `json:"fork"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&repos); err != nil {
		return nil, fmt.Errorf("解析响应失败: %w", err)
	}

	// 过滤仓库
	var filtered []RepoData
	if len(pinnedNames) > 0 {
		pinnedSet := make(map[string]bool, len(pinnedNames))
		for _, n := range pinnedNames {
			pinnedSet[n] = true
		}
		for _, r := range repos {
			if pinnedSet[r.Name] {
				lang := r.Language
				filtered = append(filtered, RepoData{
					Name:           r.Name,
					Description:    r.Description,
					Language:       lang,
					StargazerCount: r.StargazersCount,
					ForkCount:      r.ForksCount,
					URL:            r.HTMLURL,
					IsFork:         r.Fork,
					LanguageColor:  getLanguageColor(lang),
				})
			}
		}
	} else {
		// 降级：取 star 最多的前 6 个非 fork 仓库
		count := 0
		for _, r := range repos {
			if r.Fork {
				continue
			}
			lang := r.Language
			filtered = append(filtered, RepoData{
				Name:           r.Name,
				Description:    r.Description,
				Language:       lang,
				StargazerCount: r.StargazersCount,
				ForkCount:      r.ForksCount,
				URL:            r.HTMLURL,
				IsFork:         r.Fork,
				LanguageColor:  getLanguageColor(lang),
			})
			count++
			if count >= 6 {
				break
			}
		}
	}

	return filtered, nil
}

func (s *GitHubService) fetchPinnedRepoNames(ctx context.Context, username, token string) ([]string, error) {
	query := `
		query($username: String!) {
			user(login: $username) {
				pinnedItems(first: 6) {
					nodes {
						... on Repository {
							name
						}
					}
				}
			}
		}
	`

	payload := map[string]interface{}{
		"query":     query,
		"variables": map[string]string{"username": username},
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.github.com/graphql", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "bearer "+token)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub API 返回 %d", resp.StatusCode)
	}

	var result struct {
		Data struct {
			User struct {
				PinnedItems struct {
					Nodes []struct {
						Name string `json:"name"`
					} `json:"nodes"`
				} `json:"pinnedItems"`
			} `json:"user"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
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

func getLevelFromCount(count int) int {
	if count == 0 {
		return 0
	}
	if count <= 3 {
		return 1
	}
	if count <= 6 {
		return 2
	}
	if count <= 9 {
		return 3
	}
	return 4
}

var languageColors = map[string]string{
	"TypeScript": "#3178c6",
	"JavaScript": "#f1e05a",
	"Python":     "#3572A5",
	"Go":         "#00ADD8",
	"Rust":       "#dea584",
	"Java":       "#b07219",
	"C++":        "#f34b7d",
	"C":          "#555555",
	"Ruby":       "#701516",
	"PHP":        "#4F5D95",
	"Swift":      "#F05138",
	"Kotlin":     "#A97BFF",
	"Dart":       "#00B4AB",
	"Vue":        "#41b883",
	"CSS":        "#563d7c",
	"HTML":       "#e34c26",
	"Shell":      "#89e051",
	"Lua":        "#000080",
	"Zig":        "#ec915c",
}

func getLanguageColor(lang *string) *string {
	if lang == nil {
		return nil
	}
	color, ok := languageColors[*lang]
	if !ok {
		return nil
	}
	return &color
}
