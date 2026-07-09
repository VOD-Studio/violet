package mocks

import (
	"context"

	"github.com/stretchr/testify/mock"

	domainemoji "blog-api/internal/domain/emoji"
)

// MockEmojiGroupRepository emoji.EmojiGroupRepository 的 mock 实现
type MockEmojiGroupRepository struct{ mock.Mock }

func (m *MockEmojiGroupRepository) FindByID(ctx context.Context, id int32) (*domainemoji.EmojiGroup, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domainemoji.EmojiGroup), args.Error(1)
}

func (m *MockEmojiGroupRepository) FindAll(ctx context.Context, enabledOnly bool) ([]*domainemoji.EmojiGroup, error) {
	args := m.Called(ctx, enabledOnly)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*domainemoji.EmojiGroup), args.Error(1)
}

func (m *MockEmojiGroupRepository) FindByName(ctx context.Context, name string) (*domainemoji.EmojiGroup, error) {
	args := m.Called(ctx, name)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domainemoji.EmojiGroup), args.Error(1)
}

func (m *MockEmojiGroupRepository) Save(ctx context.Context, g *domainemoji.EmojiGroup) (int32, error) {
	args := m.Called(ctx, g)
	return int32(args.Int(0)), args.Error(1)
}

func (m *MockEmojiGroupRepository) Delete(ctx context.Context, id int32) error {
	return m.Called(ctx, id).Error(0)
}

func (m *MockEmojiGroupRepository) UpdateEnabled(ctx context.Context, id int32, enabled bool) error {
	return m.Called(ctx, id, enabled).Error(0)
}

func (m *MockEmojiGroupRepository) BatchUpdateEnabled(ctx context.Context, ids []int32, enabled bool) (int64, error) {
	args := m.Called(ctx, ids, enabled)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockEmojiGroupRepository) ExistsByName(ctx context.Context, name string, excludeID int32) (bool, error) {
	args := m.Called(ctx, name, excludeID)
	return args.Bool(0), args.Error(1)
}

func (m *MockEmojiGroupRepository) FindEmojisByGroup(ctx context.Context, groupID int32) ([]domainemoji.Emoji, error) {
	args := m.Called(ctx, groupID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]domainemoji.Emoji), args.Error(1)
}

func (m *MockEmojiGroupRepository) FindEmojiByID(ctx context.Context, id int32) (domainemoji.Emoji, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return domainemoji.Emoji{}, args.Error(1)
	}
	return args.Get(0).(domainemoji.Emoji), args.Error(1)
}

func (m *MockEmojiGroupRepository) SaveEmoji(ctx context.Context, e domainemoji.Emoji) (int32, error) {
	args := m.Called(ctx, e)
	return int32(args.Int(0)), args.Error(1)
}

func (m *MockEmojiGroupRepository) DeleteEmoji(ctx context.Context, id int32) error {
	return m.Called(ctx, id).Error(0)
}

func (m *MockEmojiGroupRepository) Count(ctx context.Context) (int64, error) {
	args := m.Called(ctx)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockEmojiGroupRepository) FindGroupsNeedingCover(ctx context.Context, source string) ([]*domainemoji.EmojiGroup, error) {
	args := m.Called(ctx, source)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*domainemoji.EmojiGroup), args.Error(1)
}

func (m *MockEmojiGroupRepository) UpdateCoverURL(ctx context.Context, id int32, coverURL string) error {
	return m.Called(ctx, id, coverURL).Error(0)
}

func (m *MockEmojiGroupRepository) UpsertByName(ctx context.Context, g *domainemoji.EmojiGroup) (int32, error) {
	args := m.Called(ctx, g)
	return int32(args.Int(0)), args.Error(1)
}

func (m *MockEmojiGroupRepository) UpsertEmojiByName(ctx context.Context, e domainemoji.Emoji) (int32, error) {
	args := m.Called(ctx, e)
	return int32(args.Int(0)), args.Error(1)
}
