package persona

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"blog-api/internal/domain/shared"
)

func TestPersonaAllowsIncompleteDraftButRejectsIncompleteActiveDocument(t *testing.T) {
	profile, err := NewPersona(shared.NewID(), shared.NewID())
	require.NoError(t, err)

	emptyDocument := Document{
		DefaultLocale: DefaultLocale,
		Localizations: []LocalizationInput{{Locale: DefaultLocale}},
	}
	err = profile.ReplaceDocument(1, emptyDocument, false)
	require.NoError(t, err)
	assert.Equal(t, int64(2), profile.Version())

	err = profile.ReplaceDocument(2, emptyDocument, true)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "必须配置角色头像")
	assert.Equal(t, int64(2), profile.Version(), "校验失败不得推进版本")
}

func TestPersonaNormalizesMultilingualDocumentAndTracksFileReferences(t *testing.T) {
	profile, err := NewPersona(shared.NewID(), shared.NewID())
	require.NoError(t, err)
	sharedImageID := shared.NewID()
	avatarID := shared.NewID()

	err = profile.ReplaceDocument(1, Document{
		DefaultLocale: " zh-cn ",
		AvatarFileID:  avatarID,
		Localizations: []LocalizationInput{
			{
				Locale: " ja-jp ", Name: " ヴァイオレット ", Subtitle: " 旅人 ", Summary: " 紹介 ",
				ContentMD: "\n# 設定\n", ContentHTML: " <h1>設定</h1> ",
				Facts:  []FactInput{{Label: " 身長 ", Value: " 168 cm "}},
				Images: []ImageInput{{FileID: sharedImageID, Caption: " 立ち絵 "}},
			},
			{
				Locale: "zh-CN", Name: " Violet ", Subtitle: " 旅人 ", Summary: " 简介 ",
				ContentMD: "\n# 设定\n", ContentHTML: " <h1>设定</h1> ",
				Facts:  []FactInput{{Label: " 身高 ", Value: " 168 cm "}},
				Images: []ImageInput{{FileID: sharedImageID, Caption: " 主视觉 ", AltTextOverride: " 全身设定 "}},
			},
		},
	}, false)
	require.NoError(t, err)
	require.NoError(t, profile.ValidateForActivation())

	assert.Equal(t, "zh-CN", profile.DefaultLocale())
	assert.True(t, profile.AvatarFileID().Equal(avatarID))
	localizations := profile.Localizations()
	require.Len(t, localizations, 2)
	assert.Equal(t, "zh-CN", localizations[0].Locale(), "默认语言始终排第一")
	assert.Equal(t, "Violet", localizations[0].Name())
	assert.Equal(t, "# 设定", localizations[0].ContentMD())
	assert.Equal(t, "身高", localizations[0].Facts()[0].Label())
	assert.Equal(t, "ja-JP", localizations[1].Locale())
	assert.Equal(t, 1, profile.FileReferenceCounts()[avatarID])
	assert.Equal(t, 2, profile.FileReferenceCounts()[sharedImageID], "同一素材跨语言复用时保留两个引用")
}

func TestPersonaResolvesCompleteLocaleAndFallsBackToDefault(t *testing.T) {
	profile, err := NewPersona(shared.NewID(), shared.NewID())
	require.NoError(t, err)
	avatarID := shared.NewID()
	imageID := shared.NewID()

	err = profile.ReplaceDocument(1, Document{
		DefaultLocale: "zh-CN",
		AvatarFileID:  avatarID,
		Localizations: []LocalizationInput{
			completeLocalization("zh-CN", "Violet", imageID),
			completeLocalization("ja-JP", "ヴァイオレット", imageID),
			{Locale: "en-US", Name: "Violet"},
		},
	}, false)
	require.NoError(t, err)

	assert.Equal(t, []string{"zh-CN", "ja-JP"}, profile.AvailableLocales(), "未完成草稿不得公开")
	japanese, err := profile.ResolveLocalization("ja")
	require.NoError(t, err)
	assert.Equal(t, "ja-JP", japanese.Locale())
	fallback, err := profile.ResolveLocalization("de-DE")
	require.NoError(t, err)
	assert.Equal(t, "zh-CN", fallback.Locale())
	_, err = profile.ResolveLocalization("not_a_locale")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "BCP 47")
}

func TestPersonaRejectsDuplicateLocalesFactsAndImages(t *testing.T) {
	profile, err := NewPersona(shared.NewID(), shared.NewID())
	require.NoError(t, err)
	imageID := shared.NewID()

	err = profile.ReplaceDocument(1, Document{
		DefaultLocale: "ja-JP",
		Localizations: []LocalizationInput{{Locale: "ja-jp"}, {Locale: "ja-JP"}},
	}, false)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "重复的语言版本")

	err = profile.ReplaceDocument(1, Document{
		DefaultLocale: "zh-CN",
		Localizations: []LocalizationInput{{
			Locale: "zh-CN",
			Facts:  []FactInput{{Label: "生日", Value: "1 月 1 日"}, {Label: " 生日 ", Value: "2 月 2 日"}},
		}},
	}, false)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "重复的资料项名称")

	err = profile.ReplaceDocument(1, Document{
		DefaultLocale: "zh-CN",
		Localizations: []LocalizationInput{{
			Locale: "zh-CN",
			Images: []ImageInput{{FileID: imageID}, {FileID: imageID}},
		}},
	}, false)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "同一语言版本中重复")
}

func TestPersonaRejectsMissingDefaultLocaleStaleVersionAndOversizedFields(t *testing.T) {
	profile, err := NewPersona(shared.NewID(), shared.NewID())
	require.NoError(t, err)

	err = profile.ReplaceDocument(1, Document{
		DefaultLocale: "ja-JP",
		Localizations: []LocalizationInput{{Locale: "zh-CN"}},
	}, false)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "默认语言必须对应")

	err = profile.ReplaceDocument(2, Document{
		DefaultLocale: "zh-CN",
		Localizations: []LocalizationInput{{Locale: "zh-CN"}},
	}, false)
	require.ErrorIs(t, err, ErrVersionConflict)

	err = profile.ReplaceDocument(1, Document{
		DefaultLocale: "zh-CN",
		Localizations: []LocalizationInput{{Locale: "zh-CN", Name: strings.Repeat("设", MaxNameRunes+1)}},
	}, false)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "名称不能超过")
	assert.Equal(t, int64(1), profile.Version())
}

func completeLocalization(locale, name string, imageID shared.ID) LocalizationInput {
	return LocalizationInput{
		Locale:      locale,
		Name:        name,
		Summary:     "summary",
		ContentMD:   "# Persona",
		ContentHTML: "<h1>Persona</h1>",
		Images:      []ImageInput{{FileID: imageID}},
	}
}
