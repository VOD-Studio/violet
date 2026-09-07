package persona

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"blog-api/internal/domain/shared"
)

func TestPersonaAllowsIncompleteDraftButRejectsIncompleteActiveDocument(t *testing.T) {
	persona, err := NewPersona(shared.NewID(), shared.NewID())
	require.NoError(t, err)

	err = persona.ReplaceDocument(1, Document{}, false)
	require.NoError(t, err)
	assert.Equal(t, int64(2), persona.Version())

	err = persona.ReplaceDocument(2, Document{}, true)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "必须填写名称")
	assert.Equal(t, int64(2), persona.Version(), "校验失败不得推进版本")
}

func TestPersonaNormalizesCompleteDocumentAndDerivesLeadingImage(t *testing.T) {
	persona, err := NewPersona(shared.NewID(), shared.NewID())
	require.NoError(t, err)
	firstImageID := shared.NewID()
	secondImageID := shared.NewID()

	err = persona.ReplaceDocument(1, Document{
		Name: "  Violet  ", Subtitle: "  旅人  ", Summary: "  简介  ",
		ContentMD: "\n# 设定\n", ContentHTML: " <h1>设定</h1> ",
		Facts: []FactInput{{Label: " 身高 ", Value: " 168 cm "}},
		Images: []ImageInput{
			{FileID: firstImageID, Caption: " 主视觉 ", AltTextOverride: " 全身设定 "},
			{FileID: secondImageID},
		},
	}, false)
	require.NoError(t, err)
	require.NoError(t, persona.ValidateForActivation())

	assert.Equal(t, "Violet", persona.Name())
	assert.Equal(t, "旅人", persona.Subtitle())
	assert.Equal(t, "简介", persona.Summary())
	assert.Equal(t, "# 设定", persona.ContentMD())
	require.Len(t, persona.Facts(), 1)
	assert.Equal(t, "身高", persona.Facts()[0].Label())
	require.Len(t, persona.Images(), 2)
	assert.True(t, persona.Images()[0].FileID().Equal(firstImageID), "第一张设定图就是公开主视觉")
	assert.Equal(t, 0, persona.Images()[0].Position())
	assert.Equal(t, 1, persona.Images()[1].Position())
}

func TestPersonaRejectsDuplicateFactLabelsAndImages(t *testing.T) {
	persona, err := NewPersona(shared.NewID(), shared.NewID())
	require.NoError(t, err)
	imageID := shared.NewID()

	err = persona.ReplaceDocument(1, Document{
		Facts: []FactInput{{Label: "生日", Value: "1 月 1 日"}, {Label: " 生日 ", Value: "2 月 2 日"}},
	}, false)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "重复的资料项名称")

	err = persona.ReplaceDocument(1, Document{
		Images: []ImageInput{{FileID: imageID}, {FileID: imageID}},
	}, false)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "不能在人设档案中重复")
}

func TestPersonaRejectsStaleVersionAndOversizedFields(t *testing.T) {
	persona, err := NewPersona(shared.NewID(), shared.NewID())
	require.NoError(t, err)

	err = persona.ReplaceDocument(2, Document{}, false)
	require.ErrorIs(t, err, ErrVersionConflict)

	err = persona.ReplaceDocument(1, Document{Name: strings.Repeat("设", MaxNameRunes+1)}, false)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "名称不能超过")
	assert.Equal(t, int64(1), persona.Version())
}
