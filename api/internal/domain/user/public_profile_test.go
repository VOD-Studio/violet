package user

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPublicDetailsPartialUpdatesAndIsolation(t *testing.T) {
	u := &User{}
	topics := []string{" Go ", "Go", "Postgres"}
	require.NoError(t, u.UpdatePublicDetails(new("杭州"), new("https://example.com"), &topics))
	topics[0] = "mutated input"
	assert.Equal(t, []string{"Go", "Postgres"}, u.PublicDetails().ReadingPreferences)
	returned := u.PublicDetails()
	returned.ReadingPreferences[0] = "mutated output"
	assert.Equal(t, "Go", u.PublicDetails().ReadingPreferences[0])
	before := u.PublicDetails()
	assert.Error(t, u.UpdatePublicDetails(new("new location"), new("javascript:alert(1)"), nil))
	assert.Equal(t, before, u.PublicDetails())
	require.NoError(t, u.UpdatePublicDetails(nil, new(""), new([]string{})))
	assert.Equal(t, "杭州", u.PublicDetails().Location)
	assert.Empty(t, u.PublicDetails().Website)
	assert.Empty(t, u.PublicDetails().ReadingPreferences)
	assert.Error(t, u.UpdatePublicDetails(nil, nil, new([]string{""})))
	assert.Error(t, u.UpdatePublicDetails(nil, nil, new(make([]string, 9))))
}
