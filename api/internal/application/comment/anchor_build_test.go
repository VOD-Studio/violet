package comment

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestComputeBlockID_MatchesFrontendContract(t *testing.T) {
	id, err := ComputeBlockID("hello world")
	require.NoError(t, err)
	assert.Regexp(t, "^[0-9a-f]{8}$", id)

	id2, err := ComputeBlockID("  hello world  \n")
	require.NoError(t, err)
	assert.Equal(t, id, id2, "TrimSpace 后应与未 trim 同 id")

	_, err = ComputeBlockID("   \t\n")
	assert.Error(t, err, "纯空白应拒绝")
}

func TestBuildFullBlockAnchor_CoversWholeBlock(t *testing.T) {
	text := "这是一段中文段落"
	a, err := BuildFullBlockAnchor(text)
	require.NoError(t, err)
	assert.Equal(t, 0, a.StartOffset)
	assert.Equal(t, utf16Len(text), a.EndOffset)
	assert.Equal(t, text, a.SelectedText)
	assert.Equal(t, a.BlockID, a.BlockHashSync)
	assert.NoError(t, a.Validate())
}

func TestResolveAnnotationAnchor_FillsHashesFromBlockText(t *testing.T) {
	a, err := ResolveAnnotationAnchor("", 0, 5, "hello", "", "hello world")
	require.NoError(t, err)
	id, err := ComputeBlockID("hello world")
	require.NoError(t, err)
	assert.Equal(t, id, a.BlockID)
	assert.Equal(t, id, a.BlockHashSync)
	assert.Equal(t, "hello", a.SelectedText)
}

func TestResolveAnnotationAnchor_RequiresSelectedText(t *testing.T) {
	_, err := ResolveAnnotationAnchor("abc12345", 0, 5, "", "abc12345", "")
	assert.Error(t, err)
}
