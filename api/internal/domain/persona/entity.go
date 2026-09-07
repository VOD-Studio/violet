// Package persona 定义人设档案的领域模型。
package persona

import (
	"strings"
	"time"
	"unicode/utf8"

	"blog-api/internal/domain/shared"
)

const (
	// MaxNameRunes 人设名称字符上限。
	MaxNameRunes = 120
	// MaxSubtitleRunes 人设副标题字符上限。
	MaxSubtitleRunes = 240
	// MaxSummaryRunes 人设简介字符上限。
	MaxSummaryRunes = 500
	// MaxFacts 人设资料项数量上限。
	MaxFacts = 24
	// MaxFactLabelRunes 资料项名称字符上限。
	MaxFactLabelRunes = 40
	// MaxFactValueRunes 资料项内容字符上限。
	MaxFactValueRunes = 300
	// MaxImages 设定图数量上限。
	MaxImages = 30
	// MaxCaptionRunes 单张设定图说明字符上限。
	MaxCaptionRunes = 500
	// MaxAltOverrideRunes 单张设定图无障碍文本覆盖字符上限。
	MaxAltOverrideRunes = 300
)

// Fact 是人设档案中的有序资料项。
type Fact struct {
	// position 在档案中的连续位置，从 0 开始。
	position int
	// label 资料项名称。
	label string
	// value 资料项内容。
	value string
}

// Image 是人设档案中的有序设定图引用。
type Image struct {
	// fileID 素材库文件 ID。
	fileID shared.ID
	// position 在档案中的连续位置，从 0 开始。
	position int
	// caption 当前人设语境下的图片说明。
	caption string
	// altTextOverride 当前人设语境下的无障碍文本覆盖；空串表示使用素材描述。
	altTextOverride string
}

// Document 是完整档案保存输入，数组顺序是唯一排序权威。
type Document struct {
	// Name 人设名称；非当前档案允许为空。
	Name string
	// Subtitle 一句话角色定位；允许为空。
	Subtitle string
	// Summary 主视觉旁的角色简介；非当前档案允许为空。
	Summary string
	// ContentMD 完整设定文档 Markdown 源；非当前档案允许为空。
	ContentMD string
	// ContentHTML 服务端从 ContentMD 生成的安全阅读载体。
	ContentHTML string
	// Facts 有序资料项。
	Facts []FactInput
	// Images 有序设定图。
	Images []ImageInput
}

// FactInput 是完整档案保存中的资料项输入。
type FactInput struct {
	// Label 资料项名称。
	Label string
	// Value 资料项内容。
	Value string
}

// ImageInput 是完整档案保存中的设定图输入。
type ImageInput struct {
	// FileID 素材库文件 ID。
	FileID shared.ID
	// Caption 当前人设语境下的图片说明。
	Caption string
	// AltTextOverride 当前人设语境下的无障碍文本覆盖。
	AltTextOverride string
}

// Persona 是一份可长期编辑的人设档案。
type Persona struct {
	shared.AggregateRoot

	// id 人设档案唯一标识。
	id shared.ID
	// createdBy 创建档案的管理员 ID，创建后不可变。
	createdBy shared.ID
	// name 人设名称；非当前档案允许为空。
	name string
	// subtitle 一句话角色定位；允许为空。
	subtitle string
	// summary 主视觉旁的角色简介；非当前档案允许为空。
	summary string
	// contentMD 完整设定文档 Markdown 源；非当前档案允许为空。
	contentMD string
	// contentHTML 服务端生成的安全阅读载体。
	contentHTML string
	// facts 按 position 升序保存的资料项。
	facts []*Fact
	// images 按 position 升序保存的设定图；第一项是公开主视觉。
	images []*Image
	// version 乐观锁版本，从 1 开始，每次保存加 1。
	version int64
	// timestamps 档案创建与最近保存时间。
	timestamps shared.Timestamps
}

// NewPersona 创建空的人设档案。
func NewPersona(id, createdBy shared.ID) (*Persona, error) {
	if id.IsZero() || createdBy.IsZero() {
		return nil, shared.BadRequest("人设档案与创建者 ID 不能为空")
	}
	now := time.Now()
	return &Persona{
		id: id, createdBy: createdBy,
		facts: make([]*Fact, 0), images: make([]*Image, 0), version: 1,
		timestamps: shared.Timestamps{CreatedAt: now, UpdatedAt: now},
	}, nil
}

// Reconstruct 从持久化数据重建人设档案，不触发校验。
func Reconstruct(
	id, createdBy shared.ID,
	name, subtitle, summary, contentMD, contentHTML string,
	facts []*Fact,
	images []*Image,
	version int64,
	createdAt, updatedAt time.Time,
) *Persona {
	if facts == nil {
		facts = make([]*Fact, 0)
	}
	if images == nil {
		images = make([]*Image, 0)
	}
	return &Persona{
		id: id, createdBy: createdBy, name: name, subtitle: subtitle, summary: summary,
		contentMD: contentMD, contentHTML: contentHTML, facts: facts, images: images,
		version: version, timestamps: shared.Timestamps{CreatedAt: createdAt, UpdatedAt: updatedAt},
	}
}

// ReconstructFact 从持久化数据重建资料项。
func ReconstructFact(position int, label, value string) *Fact {
	return &Fact{position: position, label: label, value: value}
}

// ReconstructImage 从持久化数据重建设定图。
func ReconstructImage(fileID shared.ID, position int, caption, altTextOverride string) *Image {
	return &Image{fileID: fileID, position: position, caption: caption, altTextOverride: altTextOverride}
}

// EnsureVersion 校验乐观锁版本。
func (p *Persona) EnsureVersion(expected int64) error {
	if expected < 1 || expected != p.version {
		return ErrVersionConflict
	}
	return nil
}

// ReplaceDocument 用完整文档替换档案；当前档案必须继续满足公开完整性。
func (p *Persona) ReplaceDocument(expected int64, document Document, requireComplete bool) error {
	if err := p.EnsureVersion(expected); err != nil {
		return err
	}

	normalized, err := normalizeDocument(document)
	if err != nil {
		return err
	}
	if requireComplete {
		if err := validateComplete(normalized); err != nil {
			return err
		}
	}

	p.name = normalized.Name
	p.subtitle = normalized.Subtitle
	p.summary = normalized.Summary
	p.contentMD = normalized.ContentMD
	p.contentHTML = normalized.ContentHTML
	p.facts = normalized.facts
	p.images = normalized.images
	p.version++
	p.timestamps.UpdatedAt = time.Now()
	return nil
}

// ValidateForActivation 校验档案能否成为当前人设。
func (p *Persona) ValidateForActivation() error {
	return validateComplete(normalizedDocument{
		Name: p.name, Summary: p.summary, ContentMD: p.contentMD, images: p.images,
	})
}

type normalizedDocument struct {
	Name        string
	Subtitle    string
	Summary     string
	ContentMD   string
	ContentHTML string
	facts       []*Fact
	images      []*Image
}

func normalizeDocument(document Document) (normalizedDocument, error) {
	result := normalizedDocument{
		Name: strings.TrimSpace(document.Name), Subtitle: strings.TrimSpace(document.Subtitle),
		Summary: strings.TrimSpace(document.Summary), ContentMD: strings.TrimSpace(document.ContentMD),
		ContentHTML: strings.TrimSpace(document.ContentHTML),
	}
	if utf8.RuneCountInString(result.Name) > MaxNameRunes {
		return normalizedDocument{}, shared.BadRequest("人设名称不能超过 120 个字符")
	}
	if utf8.RuneCountInString(result.Subtitle) > MaxSubtitleRunes {
		return normalizedDocument{}, shared.BadRequest("人设副标题不能超过 240 个字符")
	}
	if utf8.RuneCountInString(result.Summary) > MaxSummaryRunes {
		return normalizedDocument{}, shared.BadRequest("人设简介不能超过 500 个字符")
	}
	if len(document.Facts) > MaxFacts {
		return normalizedDocument{}, shared.BadRequest("人设资料项最多包含 24 项")
	}
	if len(document.Images) > MaxImages {
		return normalizedDocument{}, shared.BadRequest("人设最多包含 30 张设定图")
	}

	result.facts = make([]*Fact, 0, len(document.Facts))
	seenLabels := make(map[string]struct{}, len(document.Facts))
	for position, input := range document.Facts {
		label := strings.TrimSpace(input.Label)
		value := strings.TrimSpace(input.Value)
		if label == "" || value == "" {
			return normalizedDocument{}, shared.BadRequest("人设资料项名称与内容不能为空")
		}
		if utf8.RuneCountInString(label) > MaxFactLabelRunes {
			return normalizedDocument{}, shared.BadRequest("人设资料项名称不能超过 40 个字符")
		}
		if utf8.RuneCountInString(value) > MaxFactValueRunes {
			return normalizedDocument{}, shared.BadRequest("人设资料项内容不能超过 300 个字符")
		}
		if _, exists := seenLabels[label]; exists {
			return normalizedDocument{}, shared.BadRequest("同一人设不能包含重复的资料项名称")
		}
		seenLabels[label] = struct{}{}
		result.facts = append(result.facts, &Fact{position: position, label: label, value: value})
	}

	result.images = make([]*Image, 0, len(document.Images))
	seenFiles := make(map[shared.ID]struct{}, len(document.Images))
	for position, input := range document.Images {
		if input.FileID.IsZero() {
			return normalizedDocument{}, shared.BadRequest("人设设定图 ID 不能为空")
		}
		if _, exists := seenFiles[input.FileID]; exists {
			return normalizedDocument{}, shared.BadRequest("同一素材不能在人设档案中重复出现")
		}
		seenFiles[input.FileID] = struct{}{}
		caption := strings.TrimSpace(input.Caption)
		alt := strings.TrimSpace(input.AltTextOverride)
		if utf8.RuneCountInString(caption) > MaxCaptionRunes {
			return normalizedDocument{}, shared.BadRequest("单张设定图说明不能超过 500 个字符")
		}
		if utf8.RuneCountInString(alt) > MaxAltOverrideRunes {
			return normalizedDocument{}, shared.BadRequest("单张设定图无障碍文本不能超过 300 个字符")
		}
		result.images = append(result.images, &Image{
			fileID: input.FileID, position: position, caption: caption, altTextOverride: alt,
		})
	}
	return result, nil
}

func validateComplete(document normalizedDocument) error {
	if document.Name == "" {
		return shared.BadRequest("激活人设前必须填写名称")
	}
	if document.Summary == "" {
		return shared.BadRequest("激活人设前必须填写简介")
	}
	if document.ContentMD == "" {
		return shared.BadRequest("激活人设前必须填写设定正文")
	}
	if len(document.images) == 0 {
		return shared.BadRequest("激活人设前至少需要一张设定图")
	}
	return nil
}

func (p *Persona) ID() shared.ID        { return p.id }
func (p *Persona) CreatedBy() shared.ID { return p.createdBy }
func (p *Persona) Name() string         { return p.name }
func (p *Persona) Subtitle() string     { return p.subtitle }
func (p *Persona) Summary() string      { return p.summary }
func (p *Persona) ContentMD() string    { return p.contentMD }
func (p *Persona) ContentHTML() string  { return p.contentHTML }
func (p *Persona) Version() int64       { return p.version }
func (p *Persona) CreatedAt() time.Time { return p.timestamps.CreatedAt }
func (p *Persona) UpdatedAt() time.Time { return p.timestamps.UpdatedAt }

// Facts 返回资料项切片副本。
func (p *Persona) Facts() []*Fact {
	result := make([]*Fact, len(p.facts))
	copy(result, p.facts)
	return result
}

// Images 返回设定图切片副本。
func (p *Persona) Images() []*Image {
	result := make([]*Image, len(p.images))
	copy(result, p.images)
	return result
}

// FileReferenceCounts 返回档案按素材汇总的引用次数。
func (p *Persona) FileReferenceCounts() map[shared.ID]int {
	counts := make(map[shared.ID]int, len(p.images))
	for _, image := range p.images {
		counts[image.fileID]++
	}
	return counts
}

func (f *Fact) Position() int            { return f.position }
func (f *Fact) Label() string            { return f.label }
func (f *Fact) Value() string            { return f.value }
func (i *Image) FileID() shared.ID       { return i.fileID }
func (i *Image) Position() int           { return i.position }
func (i *Image) Caption() string         { return i.caption }
func (i *Image) AltTextOverride() string { return i.altTextOverride }
