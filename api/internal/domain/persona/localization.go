package persona

import (
	"sort"
	"strings"
	"unicode/utf8"

	"golang.org/x/text/language"

	"blog-api/internal/domain/shared"
)

const (
	// DefaultLocale 新档案初始使用的 BCP 47 语言代码。
	DefaultLocale = "zh-CN"
	// MaxLocales 单份人设可维护的语言版本上限。
	MaxLocales = 8
	// MaxNameRunes 人设名称字符上限。
	MaxNameRunes = 120
	// MaxSubtitleRunes 人设副标题字符上限。
	MaxSubtitleRunes = 240
	// MaxSummaryRunes 人设简介字符上限。
	MaxSummaryRunes = 500
	// MaxFacts 单个语言版本资料项数量上限。
	MaxFacts = 24
	// MaxFactLabelRunes 资料项名称字符上限。
	MaxFactLabelRunes = 40
	// MaxFactValueRunes 资料项内容字符上限。
	MaxFactValueRunes = 300
	// MaxImages 单个语言版本设定图数量上限。
	MaxImages = 30
	// MaxCaptionRunes 单张设定图说明字符上限。
	MaxCaptionRunes = 500
	// MaxAltOverrideRunes 单张设定图无障碍文本覆盖字符上限。
	MaxAltOverrideRunes = 300
)

// Fact 是一个语言版本中的有序资料项。
type Fact struct {
	// position 在语言版本中的连续位置，从 0 开始。
	position int
	// label 资料项名称。
	label string
	// value 资料项内容。
	value string
}

// Image 是一个语言版本中的有序设定图引用。
type Image struct {
	// fileID 素材库文件 ID。
	fileID shared.ID
	// position 在语言版本中的连续位置，从 0 开始。
	position int
	// caption 当前语言语境下的图片说明。
	caption string
	// altTextOverride 当前语言语境下的无障碍文本覆盖；空串表示使用素材描述。
	altTextOverride string
}

// Localization 是一份完整或待补全的本地化人设文档。
type Localization struct {
	// locale BCP 47 语言代码。
	locale string
	// name 人设名称；草稿版本允许为空。
	name string
	// subtitle 一句话角色定位；允许为空。
	subtitle string
	// summary 主视觉旁的角色简介；草稿版本允许为空。
	summary string
	// contentMD 完整设定文档 Markdown 源；草稿版本允许为空。
	contentMD string
	// contentHTML 服务端从 contentMD 生成的阅读载体。
	contentHTML string
	// facts 按 position 升序保存的资料项。
	facts []*Fact
	// images 按 position 升序保存的设定图；第一项是该语言主视觉。
	images []*Image
}

// Document 是完整档案保存输入，包含跨语言头像与全部语言版本。
type Document struct {
	// DefaultLocale 默认公开语言，必须指向 Localizations 中的版本。
	DefaultLocale string
	// AvatarFileID 跨语言共用的头像素材；零值表示草稿尚未配置。
	AvatarFileID shared.ID
	// Localizations 全部语言版本，每个 BCP 47 代码只能出现一次。
	Localizations []LocalizationInput
}

// LocalizationInput 是完整保存中的一个语言版本，数组顺序是资料项与图片的排序权威。
type LocalizationInput struct {
	// Locale BCP 47 语言代码。
	Locale string
	// Name 人设名称；非默认草稿允许为空。
	Name string
	// Subtitle 一句话角色定位；允许为空。
	Subtitle string
	// Summary 主视觉旁的角色简介；非默认草稿允许为空。
	Summary string
	// ContentMD 完整设定文档 Markdown 源；非默认草稿允许为空。
	ContentMD string
	// ContentHTML 服务端从 ContentMD 生成的阅读载体。
	ContentHTML string
	// Facts 有序资料项。
	Facts []FactInput
	// Images 有序设定图。
	Images []ImageInput
}

// FactInput 是完整保存中的资料项输入。
type FactInput struct {
	// Label 资料项名称。
	Label string
	// Value 资料项内容。
	Value string
}

// ImageInput 是完整保存中的设定图输入。
type ImageInput struct {
	// FileID 素材库文件 ID。
	FileID shared.ID
	// Caption 当前语言语境下的图片说明。
	Caption string
	// AltTextOverride 当前语言语境下的无障碍文本覆盖。
	AltTextOverride string
}

type normalizedDocument struct {
	DefaultLocale string
	AvatarFileID  shared.ID
	localizations []*Localization
}

func normalizeDocument(document Document) (normalizedDocument, error) {
	_, defaultLocale, err := parseLocale(document.DefaultLocale)
	if err != nil {
		return normalizedDocument{}, err
	}
	if len(document.Localizations) == 0 {
		return normalizedDocument{}, shared.BadRequest("人设档案至少需要保留一个语言版本")
	}
	if len(document.Localizations) > MaxLocales {
		return normalizedDocument{}, shared.BadRequest("人设档案最多包含 8 个语言版本")
	}

	localizations := make([]*Localization, 0, len(document.Localizations))
	seenLocales := make(map[string]struct{}, len(document.Localizations))
	for _, input := range document.Localizations {
		localization, normalizeErr := normalizeLocalization(input)
		if normalizeErr != nil {
			return normalizedDocument{}, normalizeErr
		}
		if _, exists := seenLocales[localization.locale]; exists {
			return normalizedDocument{}, shared.BadRequest("同一人设不能包含重复的语言版本")
		}
		seenLocales[localization.locale] = struct{}{}
		localizations = append(localizations, localization)
	}
	if _, exists := seenLocales[defaultLocale]; !exists {
		return normalizedDocument{}, shared.BadRequest("默认语言必须对应一个已配置的语言版本")
	}
	sortLocalizations(localizations, defaultLocale)
	return normalizedDocument{
		DefaultLocale: defaultLocale,
		AvatarFileID:  document.AvatarFileID,
		localizations: localizations,
	}, nil
}

func normalizeLocalization(input LocalizationInput) (*Localization, error) {
	_, locale, err := parseLocale(input.Locale)
	if err != nil {
		return nil, err
	}
	result := &Localization{
		locale:      locale,
		name:        strings.TrimSpace(input.Name),
		subtitle:    strings.TrimSpace(input.Subtitle),
		summary:     strings.TrimSpace(input.Summary),
		contentMD:   strings.TrimSpace(input.ContentMD),
		contentHTML: strings.TrimSpace(input.ContentHTML),
	}
	if utf8.RuneCountInString(result.name) > MaxNameRunes {
		return nil, shared.BadRequest("人设名称不能超过 120 个字符")
	}
	if utf8.RuneCountInString(result.subtitle) > MaxSubtitleRunes {
		return nil, shared.BadRequest("人设副标题不能超过 240 个字符")
	}
	if utf8.RuneCountInString(result.summary) > MaxSummaryRunes {
		return nil, shared.BadRequest("人设简介不能超过 500 个字符")
	}
	if len(input.Facts) > MaxFacts {
		return nil, shared.BadRequest("单个语言版本的资料项最多包含 24 项")
	}
	if len(input.Images) > MaxImages {
		return nil, shared.BadRequest("单个语言版本最多包含 30 张设定图")
	}

	result.facts = make([]*Fact, 0, len(input.Facts))
	seenLabels := make(map[string]struct{}, len(input.Facts))
	for position, factInput := range input.Facts {
		label := strings.TrimSpace(factInput.Label)
		value := strings.TrimSpace(factInput.Value)
		if label == "" || value == "" {
			return nil, shared.BadRequest("人设资料项名称与内容不能为空")
		}
		if utf8.RuneCountInString(label) > MaxFactLabelRunes {
			return nil, shared.BadRequest("人设资料项名称不能超过 40 个字符")
		}
		if utf8.RuneCountInString(value) > MaxFactValueRunes {
			return nil, shared.BadRequest("人设资料项内容不能超过 300 个字符")
		}
		if _, exists := seenLabels[label]; exists {
			return nil, shared.BadRequest("同一语言版本不能包含重复的资料项名称")
		}
		seenLabels[label] = struct{}{}
		result.facts = append(result.facts, &Fact{position: position, label: label, value: value})
	}

	result.images = make([]*Image, 0, len(input.Images))
	seenFiles := make(map[shared.ID]struct{}, len(input.Images))
	for position, imageInput := range input.Images {
		if imageInput.FileID.IsZero() {
			return nil, shared.BadRequest("人设设定图 ID 不能为空")
		}
		if _, exists := seenFiles[imageInput.FileID]; exists {
			return nil, shared.BadRequest("同一素材不能在同一语言版本中重复出现")
		}
		seenFiles[imageInput.FileID] = struct{}{}
		caption := strings.TrimSpace(imageInput.Caption)
		alt := strings.TrimSpace(imageInput.AltTextOverride)
		if utf8.RuneCountInString(caption) > MaxCaptionRunes {
			return nil, shared.BadRequest("单张设定图说明不能超过 500 个字符")
		}
		if utf8.RuneCountInString(alt) > MaxAltOverrideRunes {
			return nil, shared.BadRequest("单张设定图无障碍文本不能超过 300 个字符")
		}
		result.images = append(result.images, &Image{
			fileID:          imageInput.FileID,
			position:        position,
			caption:         caption,
			altTextOverride: alt,
		})
	}
	return result, nil
}

func validateComplete(localization *Localization, avatarFileID shared.ID) error {
	if localization == nil {
		return shared.BadRequest("人设档案缺少默认语言版本")
	}
	if avatarFileID.IsZero() {
		return shared.BadRequest("激活人设前必须配置角色头像")
	}
	if localization.name == "" {
		return shared.BadRequest("激活人设前必须填写名称")
	}
	if localization.summary == "" {
		return shared.BadRequest("激活人设前必须填写简介")
	}
	if localization.contentMD == "" {
		return shared.BadRequest("激活人设前必须填写设定正文")
	}
	if len(localization.images) == 0 {
		return shared.BadRequest("激活人设前至少需要一张设定图")
	}
	return nil
}

func parseLocale(value string) (language.Tag, string, error) {
	raw := strings.TrimSpace(value)
	if raw == "" || len(raw) > 35 || strings.ContainsRune(raw, '_') {
		return language.Und, "", shared.BadRequest("语言代码必须是有效的 BCP 47 标识")
	}
	tag, err := language.Parse(raw)
	if err != nil || tag == language.Und {
		return language.Und, "", shared.BadRequest("语言代码必须是有效的 BCP 47 标识")
	}
	return tag, tag.String(), nil
}

func emptyLocalization(locale string) *Localization {
	return &Localization{locale: locale, facts: make([]*Fact, 0), images: make([]*Image, 0)}
}

// ReconstructLocalization 从持久化数据重建一个语言版本。
func ReconstructLocalization(
	locale, name, subtitle, summary, contentMD, contentHTML string,
	facts []*Fact,
	images []*Image,
) *Localization {
	if facts == nil {
		facts = make([]*Fact, 0)
	}
	if images == nil {
		images = make([]*Image, 0)
	}
	sort.Slice(facts, func(i, j int) bool { return facts[i].position < facts[j].position })
	sort.Slice(images, func(i, j int) bool { return images[i].position < images[j].position })
	return &Localization{
		locale: locale, name: name, subtitle: subtitle, summary: summary,
		contentMD: contentMD, contentHTML: contentHTML, facts: facts, images: images,
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

func (l *Localization) Locale() string      { return l.locale }
func (l *Localization) Name() string        { return l.name }
func (l *Localization) Subtitle() string    { return l.subtitle }
func (l *Localization) Summary() string     { return l.summary }
func (l *Localization) ContentMD() string   { return l.contentMD }
func (l *Localization) ContentHTML() string { return l.contentHTML }

// Facts 返回资料项切片副本。
func (l *Localization) Facts() []*Fact {
	result := make([]*Fact, len(l.facts))
	copy(result, l.facts)
	return result
}

// Images 返回设定图切片副本。
func (l *Localization) Images() []*Image {
	result := make([]*Image, len(l.images))
	copy(result, l.images)
	return result
}

func (f *Fact) Position() int            { return f.position }
func (f *Fact) Label() string            { return f.label }
func (f *Fact) Value() string            { return f.value }
func (i *Image) FileID() shared.ID       { return i.fileID }
func (i *Image) Position() int           { return i.position }
func (i *Image) Caption() string         { return i.caption }
func (i *Image) AltTextOverride() string { return i.altTextOverride }
