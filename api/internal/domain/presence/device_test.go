package presence

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewDeviceStoresOnlyTokenHash(t *testing.T) {
	device, token, err := NewDevice("  MacBook Pro  ", time.Now())
	require.NoError(t, err)
	assert.Equal(t, "MacBook Pro", device.DisplayName())
	assert.True(t, strings.HasPrefix(token, DeviceTokenPrefix))
	assert.Equal(t, HashToken(token), device.TokenHash())
	assert.NotContains(t, device.TokenHash(), token)
	assert.Equal(t, byte('4'), device.ID().String()[14], "设备 ID 必须是随机 UUID v4")
}

func TestNormalizeDisplayNameRejectsUnsafeNames(t *testing.T) {
	for name, raw := range map[string]string{
		"blank":            "   ",
		"too long":         strings.Repeat("字", 129),
		"control":          "Mac\nmini",
		"invisible format": "Mac\u200bmini",
	} {
		t.Run(name, func(t *testing.T) {
			_, err := NormalizeDisplayName(raw)
			assert.Error(t, err)
		})
	}
	name, err := NormalizeDisplayName(strings.Repeat("字", 128))
	require.NoError(t, err)
	assert.Len(t, []rune(name), 128)
}
