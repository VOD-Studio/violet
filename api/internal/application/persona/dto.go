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

// PublicImageDTO 是公开页需要的设定图投影，不暴露素材 ID。
type PublicImageDTO struct {
	URL       string `json:"url"`
	Thumbnail string `json:"thumbnail"`
	Width     int    `json:"width"`
	Height    int    `json:"height"`
	Caption   string `json:"caption"`
	AltText   string `json:"alt_text"`
}

// DetailDTO 是后台完整人设档案。
type DetailDTO struct {
	ID          string          `json:"id"`
	CreatedBy   string          `json:"created_by"`
	Name        string          `json:"name"`
	Subtitle    string          `json:"subtitle"`
	Summary     string          `json:"summary"`
	ContentMD   string          `json:"content_md"`
	ContentHTML string          `json:"content_html"`
	Facts       []FactDTO       `json:"facts"`
	Images      []AdminImageDTO `json:"images"`
	IsActive    bool            `json:"is_active"`
	IsComplete  bool            `json:"is_complete"`
	Version     int64           `json:"version"`
	// CreatedAt / UpdatedAt 为 RFC3339。
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// SummaryDTO 是后台列表项，不含正文与图片详情。
type SummaryDTO struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Subtitle   string `json:"subtitle"`
	Summary    string `json:"summary"`
	FactCount  int    `json:"fact_count"`
	ImageCount int    `json:"image_count"`
	IsActive   bool   `json:"is_active"`
	IsComplete bool   `json:"is_complete"`
	Version    int64  `json:"version"`
	// CreatedAt / UpdatedAt 为 RFC3339。
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// PublicPersonaDTO 是 `/persona` 的唯一公开人设投影。
type PublicPersonaDTO struct {
	Name        string           `json:"name"`
	Subtitle    string           `json:"subtitle"`
	Summary     string           `json:"summary"`
	ContentHTML string           `json:"content_html"`
	Facts       []FactDTO        `json:"facts"`
	Images      []PublicImageDTO `json:"images"`
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

// SaveInput 是人设完整文档保存输入。
type SaveInput struct {
	PersonaID       string
	ExpectedVersion int64
	Name            string
	Subtitle        string
	Summary         string
	ContentMD       string
	Facts           []FactInput
	Images          []ImageInput
}

// VersionInput 是激活与删除动作的乐观版本输入。
type VersionInput struct {
	PersonaID       string
	ExpectedVersion int64
}

func toSummaryDTO(persona *domainpersona.Persona, isActive bool) SummaryDTO {
	return SummaryDTO{
		ID: persona.ID().String(), Name: persona.Name(), Subtitle: persona.Subtitle(), Summary: persona.Summary(),
		FactCount: len(persona.Facts()), ImageCount: len(persona.Images()), IsActive: isActive,
		IsComplete: persona.ValidateForActivation() == nil, Version: persona.Version(),
		CreatedAt: formatTime(persona.CreatedAt()), UpdatedAt: formatTime(persona.UpdatedAt()),
	}
}

func factsToDTO(persona *domainpersona.Persona) []FactDTO {
	facts := persona.Facts()
	result := make([]FactDTO, 0, len(facts))
	for _, fact := range facts {
		result = append(result, FactDTO{Label: fact.Label(), Value: fact.Value()})
	}
	return result
}

func formatTime(value time.Time) string { return value.UTC().Format(time.RFC3339) }
