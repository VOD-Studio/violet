package persona

import (
	"time"

	domainpersona "blog-api/internal/domain/persona"
)

// FactDTO 是一条有序人设资料。
type FactDTO struct {
	Label string `json:"label"`
	Value string `json:"value"`
}

// AdminAssetDTO 是后台可继续编辑的头像素材投影。
type AdminAssetDTO struct {
	FileID    string `json:"file_id"`
	URL       string `json:"url"`
	Thumbnail string `json:"thumbnail"`
	MimeType  string `json:"mime_type"`
	Width     int    `json:"width"`
	Height    int    `json:"height"`
	AltText   string `json:"alt_text"`
}

// AdminImageDTO 是后台设定图投影。
type AdminImageDTO struct {
	FileID          string `json:"file_id"`
	URL             string `json:"url"`
	Thumbnail       string `json:"thumbnail"`
	MimeType        string `json:"mime_type"`
	Width           int    `json:"width"`
	Height          int    `json:"height"`
	Caption         string `json:"caption"`
	AltText         string `json:"alt_text"`
	AltTextOverride string `json:"alt_text_override"`
}

// PublicAssetDTO 是公开头像投影，不暴露素材 ID。
type PublicAssetDTO struct {
	URL       string `json:"url"`
	Thumbnail string `json:"thumbnail"`
	Width     int    `json:"width"`
	Height    int    `json:"height"`
	AltText   string `json:"alt_text"`
}

// PublicImageDTO 是公开设定图投影，不暴露素材 ID。
type PublicImageDTO struct {
	URL       string `json:"url"`
	Thumbnail string `json:"thumbnail"`
	Width     int    `json:"width"`
	Height    int    `json:"height"`
	Caption   string `json:"caption"`
	AltText   string `json:"alt_text"`
}

// LocalizationDTO 是后台可编辑的一个完整语言版本。
type LocalizationDTO struct {
	Locale      string          `json:"locale"`
	Name        string          `json:"name"`
	Subtitle    string          `json:"subtitle"`
	Summary     string          `json:"summary"`
	ContentMD   string          `json:"content_md"`
	ContentHTML string          `json:"content_html"`
	Facts       []FactDTO       `json:"facts"`
	Images      []AdminImageDTO `json:"images"`
	IsComplete  bool            `json:"is_complete"`
}

// DetailDTO 是后台完整人设档案。
type DetailDTO struct {
	ID            string            `json:"id"`
	CreatedBy     string            `json:"created_by"`
	DefaultLocale string            `json:"default_locale"`
	Avatar        *AdminAssetDTO    `json:"avatar"`
	Localizations []LocalizationDTO `json:"localizations"`
	IsActive      bool              `json:"is_active"`
	IsComplete    bool              `json:"is_complete"`
	Version       int64             `json:"version"`
	// CreatedAt / UpdatedAt 为 RFC3339。
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// SummaryDTO 是后台列表项，名称与计数取默认语言版本。
type SummaryDTO struct {
	ID         string   `json:"id"`
	Name       string   `json:"name"`
	Subtitle   string   `json:"subtitle"`
	Summary    string   `json:"summary"`
	Locales    []string `json:"locales"`
	FactCount  int      `json:"fact_count"`
	ImageCount int      `json:"image_count"`
	IsActive   bool     `json:"is_active"`
	IsComplete bool     `json:"is_complete"`
	Version    int64    `json:"version"`
	// CreatedAt / UpdatedAt 为 RFC3339。
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// PublicPersonaDTO 是 `/persona` 的当前语言公开投影。
type PublicPersonaDTO struct {
	Locale           string           `json:"locale"`
	DefaultLocale    string           `json:"default_locale"`
	AvailableLocales []string         `json:"available_locales"`
	Avatar           PublicAssetDTO   `json:"avatar"`
	Name             string           `json:"name"`
	Subtitle         string           `json:"subtitle"`
	Summary          string           `json:"summary"`
	ContentHTML      string           `json:"content_html"`
	Facts            []FactDTO        `json:"facts"`
	Images           []PublicImageDTO `json:"images"`
}

// ListQuery 是后台档案列表查询。
type ListQuery struct {
	Search string
	Page   int
	Limit  int
}

// FactInput 是完整保存中的资料项输入。
type FactInput struct {
	Label string
	Value string
}

// ImageInput 是完整保存中的设定图输入。
type ImageInput struct {
	FileID          string
	Caption         string
	AltTextOverride string
}

// LocalizationInput 是完整保存中的一个语言版本。
type LocalizationInput struct {
	Locale    string
	Name      string
	Subtitle  string
	Summary   string
	ContentMD string
	Facts     []FactInput
	Images    []ImageInput
}

// SaveInput 是人设完整文档保存输入。
type SaveInput struct {
	PersonaID       string
	ExpectedVersion int64
	DefaultLocale   string
	// AvatarFileID 空串表示清除草稿头像。
	AvatarFileID  string
	Localizations []LocalizationInput
}

// VersionInput 是激活与删除动作的乐观版本输入。
type VersionInput struct {
	PersonaID       string
	ExpectedVersion int64
}

func toSummaryDTO(persona *domainpersona.Persona, isActive bool) SummaryDTO {
	localization := persona.DefaultLocalization()
	name, subtitle, summary, factCount, imageCount := "", "", "", 0, 0
	if localization != nil {
		name = localization.Name()
		subtitle = localization.Subtitle()
		summary = localization.Summary()
		factCount = len(localization.Facts())
		imageCount = len(localization.Images())
	}
	locales := make([]string, 0, len(persona.Localizations()))
	for _, item := range persona.Localizations() {
		locales = append(locales, item.Locale())
	}
	return SummaryDTO{
		ID: persona.ID().String(), Name: name, Subtitle: subtitle, Summary: summary,
		Locales: locales, FactCount: factCount, ImageCount: imageCount, IsActive: isActive,
		IsComplete: persona.ValidateForActivation() == nil, Version: persona.Version(),
		CreatedAt: formatTime(persona.CreatedAt()), UpdatedAt: formatTime(persona.UpdatedAt()),
	}
}

func factsToDTO(localization *domainpersona.Localization) []FactDTO {
	facts := localization.Facts()
	result := make([]FactDTO, 0, len(facts))
	for _, fact := range facts {
		result = append(result, FactDTO{Label: fact.Label(), Value: fact.Value()})
	}
	return result
}

func formatTime(value time.Time) string { return value.UTC().Format(time.RFC3339) }
