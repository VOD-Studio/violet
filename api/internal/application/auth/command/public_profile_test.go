package command

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"blog-api/internal/application/mocks"
	domainuser "blog-api/internal/domain/user"
)

func TestUpdateProfile_PublicPreferencesAreExplicitPartialUpdates(t *testing.T) {
	u := testUser()
	u.UpdateBio("original bio")
	topics := []string{"Go"}
	require.NoError(t, u.UpdatePublicDetails(new("杭州"), new("https://example.com"), &topics))
	repo := new(mocks.MockUserRepository)
	repo.On("FindByID", mock.Anything, u.GetID()).Return(u, nil)
	repo.On("Save", mock.Anything, mock.AnythingOfType("*user.User")).Return(nil).Twice()
	h := NewUpdateProfileHandler(repo)
	_, err := h.Handle(context.Background(), UpdateProfileInput{UserID: testUserID, Bio: new("new bio")})
	require.NoError(t, err)
	assert.Equal(t, []string{"Go"}, u.PublicDetails().ReadingPreferences)
	empty := []string{}
	_, err = h.Handle(context.Background(), UpdateProfileInput{UserID: testUserID, PublicReadingPreferences: &empty})
	require.NoError(t, err)
	assert.Empty(t, u.PublicDetails().ReadingPreferences)
	assert.Equal(t, "new bio", u.Bio())
	assert.Equal(t, "杭州", u.PublicDetails().Location)
	repo.AssertExpectations(t)
}

func TestUpdateProfile_RejectsUnsafePublicWebsiteBeforeSaving(t *testing.T) {
	u := testUser()
	repo := new(mocks.MockUserRepository)
	repo.On("FindByID", mock.Anything, u.GetID()).Return(u, nil)
	_, err := NewUpdateProfileHandler(repo).Handle(context.Background(), UpdateProfileInput{UserID: testUserID, Website: new("javascript:alert(1)")})
	require.Error(t, err)
	repo.AssertNotCalled(t, "Save", mock.Anything, mock.AnythingOfType("*user.User"))
	assert.Equal(t, domainuser.PublicProfileDetails{ReadingPreferences: []string{}}, u.PublicDetails())
}
