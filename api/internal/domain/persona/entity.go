// Package persona 定义人设档案的领域模型。
package persona

import (
	"sort"
	"strings"
	"time"

	"golang.org/x/text/language"

	"blog-api/internal/domain/shared"
)

// Persona 是一份可长期编辑、包含多个语言版本的人设档案。
type Persona struct {
	shared.AggregateRoot

	// id 人设档案唯一标识。
	id shared.ID
	// createdBy 创建档案的管理员 ID，创建后不可变。
	createdBy shared.ID
	// defaultLocale 未指定语言或匹配失败时使用的语言版本。
	defaultLocale string
	// avatarFileID 跨语言共用的角色头像素材；零值表示草稿尚未配置。
	avatarFileID shared.ID
	// localizations 按默认语言优先、其余语言代码升序保存的本地化文档。
	localizations []*Localization
	// version 乐观锁版本，从 1 开始，每次保存加 1。
	version int64
	// timestamps 档案创建与最近保存时间。
	timestamps shared.Timestamps
}

// NewPersona 创建带一个空默认语言版本的人设档案。
func NewPersona(id, createdBy shared.ID) (*Persona, error) {
	if id.IsZero() || createdBy.IsZero() {
		return nil, shared.BadRequest("人设档案与创建者 ID 不能为空")
	}
	now := time.Now()
	return &Persona{
		id: id, createdBy: createdBy, defaultLocale: DefaultLocale,
		localizations: []*Localization{emptyLocalization(DefaultLocale)}, version: 1,
		timestamps: shared.Timestamps{CreatedAt: now, UpdatedAt: now},
	}, nil
}

// Reconstruct 从持久化数据重建人设档案，不触发业务校验。
func Reconstruct(
	id, createdBy shared.ID,
	defaultLocale string,
	avatarFileID shared.ID,
	localizations []*Localization,
	version int64,
	createdAt, updatedAt time.Time,
) *Persona {
	if localizations == nil {
		localizations = make([]*Localization, 0)
	}
	sortLocalizations(localizations, defaultLocale)
	return &Persona{
		id: id, createdBy: createdBy, defaultLocale: defaultLocale,
		avatarFileID: avatarFileID, localizations: localizations, version: version,
		timestamps: shared.Timestamps{CreatedAt: createdAt, UpdatedAt: updatedAt},
	}
}

// EnsureVersion 校验乐观锁版本。
func (p *Persona) EnsureVersion(expected int64) error {
	if expected < 1 || expected != p.version {
		return ErrVersionConflict
	}
	return nil
}

// ReplaceDocument 全量替换头像、默认语言与所有语言版本；当前档案必须继续可公开。
func (p *Persona) ReplaceDocument(expected int64, document Document, requireComplete bool) error {
	if err := p.EnsureVersion(expected); err != nil {
		return err
	}
	normalized, err := normalizeDocument(document)
	if err != nil {
		return err
	}
	if requireComplete {
		defaultLocalization := findLocalization(normalized.localizations, normalized.DefaultLocale)
		if err := validateComplete(defaultLocalization, normalized.AvatarFileID); err != nil {
			return err
		}
	}

	p.defaultLocale = normalized.DefaultLocale
	p.avatarFileID = normalized.AvatarFileID
	p.localizations = normalized.localizations
	p.version++
	p.timestamps.UpdatedAt = time.Now()
	return nil
}

// ValidateForActivation 校验默认语言版本与头像能否公开。
func (p *Persona) ValidateForActivation() error {
	return validateComplete(p.DefaultLocalization(), p.avatarFileID)
}

// ResolveLocalization 按 BCP 47 语言代码选择完整版本；无匹配时回退默认语言。
func (p *Persona) ResolveLocalization(requested string) (*Localization, error) {
	fallback := p.DefaultLocalization()
	if fallback == nil {
		return nil, shared.BadRequest("人设档案缺少默认语言版本")
	}
	if strings.TrimSpace(requested) == "" {
		return fallback, nil
	}
	requestedTag, canonical, err := parseLocale(requested)
	if err != nil {
		return nil, err
	}

	complete := p.completeLocalizations()
	for _, localization := range complete {
		if localization.locale == canonical {
			return localization, nil
		}
	}
	if len(complete) == 0 {
		return fallback, nil
	}
	tags := make([]language.Tag, 0, len(complete))
	for _, localization := range complete {
		tag, _, parseErr := parseLocale(localization.locale)
		if parseErr != nil {
			continue
		}
		tags = append(tags, tag)
	}
	if len(tags) != len(complete) {
		return fallback, nil
	}
	_, index, confidence := language.NewMatcher(tags).Match(requestedTag)
	if confidence >= language.High {
		return complete[index], nil
	}
	return fallback, nil
}

// AvailableLocales 返回公开可切换的完整语言版本，默认语言始终排第一。
func (p *Persona) AvailableLocales() []string {
	complete := p.completeLocalizations()
	locales := make([]string, 0, len(complete))
	for _, localization := range complete {
		locales = append(locales, localization.locale)
	}
	return locales
}

func (p *Persona) completeLocalizations() []*Localization {
	result := make([]*Localization, 0, len(p.localizations))
	for _, localization := range p.localizations {
		if validateComplete(localization, p.avatarFileID) == nil {
			result = append(result, localization)
		}
	}
	sortLocalizations(result, p.defaultLocale)
	return result
}

// DefaultLocalization 返回默认语言版本；持久化数据损坏时返回 nil。
func (p *Persona) DefaultLocalization() *Localization {
	return findLocalization(p.localizations, p.defaultLocale)
}

// IsLocalizationComplete 返回指定语言版本是否具备全部公开资料。
func (p *Persona) IsLocalizationComplete(locale string) bool {
	return validateComplete(findLocalization(p.localizations, locale), p.avatarFileID) == nil
}

func findLocalization(localizations []*Localization, locale string) *Localization {
	for _, localization := range localizations {
		if localization.locale == locale {
			return localization
		}
	}
	return nil
}

func sortLocalizations(localizations []*Localization, defaultLocale string) {
	sort.Slice(localizations, func(i, j int) bool {
		if localizations[i].locale == defaultLocale {
			return true
		}
		if localizations[j].locale == defaultLocale {
			return false
		}
		return localizations[i].locale < localizations[j].locale
	})
}

func (p *Persona) ID() shared.ID           { return p.id }
func (p *Persona) CreatedBy() shared.ID    { return p.createdBy }
func (p *Persona) DefaultLocale() string   { return p.defaultLocale }
func (p *Persona) AvatarFileID() shared.ID { return p.avatarFileID }
func (p *Persona) Version() int64          { return p.version }
func (p *Persona) CreatedAt() time.Time    { return p.timestamps.CreatedAt }
func (p *Persona) UpdatedAt() time.Time    { return p.timestamps.UpdatedAt }

// Localizations 返回语言版本切片副本。
func (p *Persona) Localizations() []*Localization {
	result := make([]*Localization, len(p.localizations))
	copy(result, p.localizations)
	return result
}

// FileReferenceCounts 返回头像与所有语言设定图按素材汇总的引用次数。
func (p *Persona) FileReferenceCounts() map[shared.ID]int {
	counts := make(map[shared.ID]int)
	if !p.avatarFileID.IsZero() {
		counts[p.avatarFileID] = 1
	}
	for _, localization := range p.localizations {
		for _, image := range localization.images {
			counts[image.fileID]++
		}
	}
	return counts
}
