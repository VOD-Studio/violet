package post

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"blog-api/internal/domain/shared"
)

type orderRepoStub struct {
	expected []shared.ID
	ordered  []shared.ID
	err      error
}

func (r *orderRepoStub) Reorder(_ context.Context, expected, ordered []shared.ID) error {
	r.expected, r.ordered = expected, ordered
	return r.err
}

type orderPermissionStub struct {
	allowed bool
	codes   []string
}

func (p *orderPermissionStub) HasPermission(_ string, _ bool, codes ...string) bool {
	p.codes = codes
	return p.allowed
}

func TestOrderServicePermissionAndValidation(t *testing.T) {
	a, b := shared.NewID().String(), shared.NewID().String()
	valid := ReorderInput{ExpectedIDs: []string{a, b}, IDs: []string{b, a}}
	for _, tc := range []struct {
		name    string
		in      ReorderInput
		allowed bool
	}{
		{"no permission", valid, false},
		{"empty", ReorderInput{}, true},
		{"duplicate", ReorderInput{ExpectedIDs: []string{a, a}, IDs: []string{a, a}}, true},
		{"different set", ReorderInput{ExpectedIDs: []string{a, b}, IDs: []string{a, a}}, true},
		{"invalid uuid", ReorderInput{ExpectedIDs: []string{a, "bad"}, IDs: []string{"bad", a}}, true},
		{"different length", ReorderInput{ExpectedIDs: []string{a}, IDs: []string{a, b}}, true},
		{"too many", ReorderInput{ExpectedIDs: make([]string, 101), IDs: make([]string, 101)}, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			repo := &orderRepoStub{}
			perm := &orderPermissionStub{allowed: tc.allowed}
			err := NewOrderService(repo, perm).Reorder(context.Background(), tc.in)
			require.Error(t, err)
			assert.Nil(t, repo.ordered)
			assert.Equal(t, []string{"post:publish"}, perm.codes)
		})
	}
}

func TestOrderServicePropagatesPersistenceFailure(t *testing.T) {
	a, b := shared.NewID(), shared.NewID()
	failure := errors.New("transaction failed")
	repo := &orderRepoStub{err: failure}
	svc := NewOrderService(repo, &orderPermissionStub{allowed: true})
	err := svc.Reorder(context.Background(), ReorderInput{
		ExpectedIDs: []string{a.String(), b.String()}, IDs: []string{b.String(), a.String()},
	})
	assert.ErrorIs(t, err, failure)
	assert.Equal(t, []shared.ID{a, b}, repo.expected)
	assert.Equal(t, []shared.ID{b, a}, repo.ordered)
}
