package service

import (
	"context"
	"fmt"
	"strconv"

	"blog-api/internal/repository/generated"
)

// SettingsService 站点设置业务服务
type SettingsService struct {
	queries *generated.Queries
}

// NewSettingsService 创建站点设置服务实例
func NewSettingsService(queries *generated.Queries) *SettingsService {
	return &SettingsService{queries: queries}
}

// SiteSettings 站点设置响应结构，所有字段以 map 形式返回
type SiteSettings struct {
	SiteName           string `json:"site_name"`
	SiteDescription    string `json:"site_description"`
	SiteURL            string `json:"site_url"`
	AdminEmail         string `json:"admin_email"`
	PostsPerPage       int    `json:"posts_per_page"`
	CommentsEnabled    bool   `json:"comments_enabled"`
	CommentsModeration bool   `json:"comments_moderation"`
	GitHubUsername      string `json:"github_username"`
	FooterText         string `json:"footer_text"`
}

// UpdateSettingsRequest 更新设置请求
type UpdateSettingsRequest struct {
	SiteName           *string `json:"site_name"`
	SiteDescription    *string `json:"site_description"`
	SiteURL            *string `json:"site_url"`
	AdminEmail         *string `json:"admin_email"`
	PostsPerPage       *int    `json:"posts_per_page"`
	CommentsEnabled    *bool   `json:"comments_enabled"`
	CommentsModeration *bool   `json:"comments_moderation"`
	GitHubUsername     *string `json:"github_username"`
	FooterText         *string `json:"footer_text"`
}

// GetAllSettings 获取所有站点设置
func (s *SettingsService) GetAllSettings(ctx context.Context) (*SiteSettings, error) {
	settings, err := s.queries.GetAllSettings(ctx)
	if err != nil {
		return nil, fmt.Errorf("查询站点设置失败: %w", err)
	}

	// 将键值对列表转换为结构体
	result := &SiteSettings{
		PostsPerPage: 10,
	}
	for _, setting := range settings {
		switch setting.Key {
		case "site_name":
			result.SiteName = setting.Value
		case "site_description":
			result.SiteDescription = setting.Value
		case "site_url":
			result.SiteURL = setting.Value
		case "admin_email":
			result.AdminEmail = setting.Value
		case "posts_per_page":
			if v, err := strconv.Atoi(setting.Value); err == nil {
				result.PostsPerPage = v
			}
		case "comments_enabled":
			result.CommentsEnabled = setting.Value == "true"
		case "comments_moderation":
			result.CommentsModeration = setting.Value == "true"
		case "github_username":
			result.GitHubUsername = setting.Value
		case "footer_text":
			result.FooterText = setting.Value
		}
	}

	return result, nil
}

// UpdateSettings 更新站点设置
// 只更新请求中非 nil 的字段
func (s *SettingsService) UpdateSettings(ctx context.Context, req UpdateSettingsRequest) (*SiteSettings, error) {
	// 逐个更新提供的字段
	if req.SiteName != nil {
		if _, err := s.queries.UpsertSetting(ctx, generated.UpsertSettingParams{
			Key:   "site_name",
			Value: *req.SiteName,
		}); err != nil {
			return nil, fmt.Errorf("更新 site_name 失败: %w", err)
		}
	}
	if req.SiteDescription != nil {
		if _, err := s.queries.UpsertSetting(ctx, generated.UpsertSettingParams{
			Key:   "site_description",
			Value: *req.SiteDescription,
		}); err != nil {
			return nil, fmt.Errorf("更新 site_description 失败: %w", err)
		}
	}
	if req.SiteURL != nil {
		if _, err := s.queries.UpsertSetting(ctx, generated.UpsertSettingParams{
			Key:   "site_url",
			Value: *req.SiteURL,
		}); err != nil {
			return nil, fmt.Errorf("更新 site_url 失败: %w", err)
		}
	}
	if req.AdminEmail != nil {
		if _, err := s.queries.UpsertSetting(ctx, generated.UpsertSettingParams{
			Key:   "admin_email",
			Value: *req.AdminEmail,
		}); err != nil {
			return nil, fmt.Errorf("更新 admin_email 失败: %w", err)
		}
	}
	if req.PostsPerPage != nil {
		if _, err := s.queries.UpsertSetting(ctx, generated.UpsertSettingParams{
			Key:   "posts_per_page",
			Value: strconv.Itoa(*req.PostsPerPage),
		}); err != nil {
			return nil, fmt.Errorf("更新 posts_per_page 失败: %w", err)
		}
	}
	if req.CommentsEnabled != nil {
		val := "false"
		if *req.CommentsEnabled {
			val = "true"
		}
		if _, err := s.queries.UpsertSetting(ctx, generated.UpsertSettingParams{
			Key:   "comments_enabled",
			Value: val,
		}); err != nil {
			return nil, fmt.Errorf("更新 comments_enabled 失败: %w", err)
		}
	}
	if req.CommentsModeration != nil {
		val := "false"
		if *req.CommentsModeration {
			val = "true"
		}
		if _, err := s.queries.UpsertSetting(ctx, generated.UpsertSettingParams{
			Key:   "comments_moderation",
			Value: val,
		}); err != nil {
			return nil, fmt.Errorf("更新 comments_moderation 失败: %w", err)
		}
	}
	if req.GitHubUsername != nil {
		if _, err := s.queries.UpsertSetting(ctx, generated.UpsertSettingParams{
			Key:   "github_username",
			Value: *req.GitHubUsername,
		}); err != nil {
			return nil, fmt.Errorf("更新 github_username 失败: %w", err)
		}
	}
	if req.FooterText != nil {
		if _, err := s.queries.UpsertSetting(ctx, generated.UpsertSettingParams{
			Key:   "footer_text",
			Value: *req.FooterText,
		}); err != nil {
			return nil, fmt.Errorf("更新 footer_text 失败: %w", err)
		}
	}

	// 返回更新后的完整设置
	return s.GetAllSettings(ctx)
}
