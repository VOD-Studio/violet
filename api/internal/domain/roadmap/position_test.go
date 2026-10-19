package roadmap

import (
	"math/rand/v2"
	"slices"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPositionBetweenKeepsLexicalOrderUnderRepeatedInsertion(t *testing.T) {
	keys := []string{}
	random := rand.New(rand.NewPCG(42, 99))
	for range 5000 {
		at := random.IntN(len(keys) + 1)
		before, after := "", ""
		if at > 0 {
			before = keys[at-1]
		}
		if at < len(keys) {
			after = keys[at]
		}
		key, err := PositionBetween(before, after)
		require.NoError(t, err)
		require.True(t, ValidPosition(key))
		require.Greater(t, key, before)
		if after != "" {
			require.Less(t, key, after)
		}
		keys = slices.Insert(keys, at, key)
	}
	assert.True(t, slices.IsSorted(keys))
}

func TestPositionBetweenSupportsBoundariesAndRejectsInvalidKeys(t *testing.T) {
	for _, boundary := range []struct{ before, after string }{{"", "1"}, {"", "0001"}, {"z", ""}, {"V", "V1"}, {"Vzz", "W"}} {
		key, err := PositionBetween(boundary.before, boundary.after)
		require.NoError(t, err)
		assert.Greater(t, key, boundary.before)
		if boundary.after != "" {
			assert.Less(t, key, boundary.after)
		}
	}
	for _, boundary := range []struct{ before, after string }{{"V", "V"}, {"W", "V"}, {"V0", "W"}, {"a/b", ""}, {"", "0"}} {
		_, err := PositionBetween(boundary.before, boundary.after)
		assert.Error(t, err)
	}
}
