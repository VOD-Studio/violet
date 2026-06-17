// Package settings 提供站点设置的领域模型。
//
// 站点设置以 key-value 表存储，本包定义配置读模型与更新入参，
// 并通过 SettingsStore 端口解耦基础设施实现。
package settings

import (
	"context"

	"blog-api/internal/domain/shared"
)

// SiteSettings 站点配置读模型（聚合全部配置项）
type SiteSettings struct {
	SiteName           string `json:"site_name"`
	SiteDescription    string `json:"site_description"`
	SiteURL            string `json:"site_url"`
	AdminEmail         string `json:"admin_email"`
	PostsPerPage       int    `json:"posts_per_page"`
	CommentsEnabled    bool   `json:"comments_enabled"`
	CommentsModeration bool   `json:"comments_moderation"`
	GitHubUsername     string `json:"github_username"`
	GitHubToken        string `json:"github_token"`
	TechStack          string `json:"tech_stack"`
	Bio                string `json:"bio"`
	FooterText         string `json:"footer_text"`
}

// UpdateInput 更新入参（指针字段表部分更新，nil 不更新）
type UpdateInput struct {
	SiteName           *string
	SiteDescription    *string
	SiteURL            *string
	AdminEmail         *string
	PostsPerPage       *int
	CommentsEnabled    *bool
	CommentsModeration *bool
	GitHubUsername     *string
	GitHubToken        *string
	TechStack          *string
	Bio                *string
	FooterText         *string
}

// SettingsStore 站点配置存储端口（infrastructure 层实现）
type SettingsStore interface {
	// GetAll 读取全部配置键值对
	GetAll(ctx context.Context) (map[string]string, error)
	// Upsert 写入或更新单个配置
	Upsert(ctx context.Context, key, value string) error
}

// MergeFrom 从键值对还原配置读模型
func (s SiteSettings) MergeFrom(m map[string]string) SiteSettings {
	return fromMap(m)
}

// 从 map 还原配置读模型
func fromMap(m map[string]string) SiteSettings {
	s := SiteSettings{PostsPerPage: 10}
	s.SiteName = m["site_name"]
	s.SiteDescription = m["site_description"]
	s.SiteURL = m["site_url"]
	s.AdminEmail = m["admin_email"]
	if v, ok := parseInt(m["posts_per_page"]); ok {
		s.PostsPerPage = v
	}
	s.CommentsEnabled = m["comments_enabled"] == "true"
	s.CommentsModeration = m["comments_moderation"] == "true"
	s.GitHubUsername = m["github_username"]
	s.GitHubToken = m["github_token"]
	s.TechStack = m["tech_stack"]
	s.Bio = m["bio"]
	s.FooterText = m["footer_text"]
	return s
}

func parseInt(s string) (int, bool) {
	if s == "" {
		return 0, false
	}
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0, false
		}
		n = n*10 + int(c-'0')
	}
	return n, true
}

// ErrInvalidSetting 无效配置
var ErrInvalidSetting = shared.BadRequest("无效的站点配置")
