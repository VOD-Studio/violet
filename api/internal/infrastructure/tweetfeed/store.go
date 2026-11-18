package tweetfeed

import (
	"context"
	"errors"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	apptweet "blog-api/internal/application/tweet"
	"blog-api/internal/domain/shared"
)

const (
	rankingTTL = 15 * time.Minute
	viewTTL    = 30 * time.Minute
	idBytes    = 16
)

var deleteIfOwned = redis.NewScript(`
if redis.call('GET', KEYS[1]) == ARGV[1] then
	return redis.call('DEL', KEYS[1])
end
return 0
`)

type Store struct {
	redis *redis.Client
}

func NewStore(client *redis.Client) *Store { return &Store{redis: client} }

func rankingKey(id shared.ID) string { return "tweet:hot:ranking:" + id.String() }

func (s *Store) CurrentRanking(ctx context.Context, cutoff time.Time, build func() ([]shared.ID, error)) (shared.ID, error) {
	currentKey := "tweet:hot:minute:" + strconv.FormatInt(cutoff.Unix(), 10)
	key, err := s.redis.Get(ctx, currentKey).Result()
	if err == nil {
		return shared.ParseID(key)
	}
	if !errors.Is(err, redis.Nil) {
		return shared.ID{}, shared.Internal("读取热门推文快照失败", err)
	}
	ids, err := build()
	if err != nil {
		return shared.ID{}, err
	}
	id := shared.NewID()
	// Fixed-width IDs let later pages fetch only the requested ranks. The zero UUID marks
	// an empty ranking or its end, which must be distinguishable from an expired Redis key.
	packed := make([]byte, (len(ids)+1)*idBytes)
	for i, row := range ids {
		value := row.UUID()
		copy(packed[i*idBytes:], value[:])
	}
	if err := s.redis.Set(ctx, rankingKey(id), packed, rankingTTL).Err(); err != nil {
		return shared.ID{}, shared.Internal("保存热门推文快照失败", err)
	}
	won, err := s.redis.SetNX(ctx, currentKey, id.String(), time.Minute).Result()
	if err != nil {
		return shared.ID{}, shared.Internal("登记热门推文快照失败", err)
	}
	if won {
		return id, nil
	}
	_ = s.redis.Del(ctx, rankingKey(id)).Err() // A competing request won; the unused key also has a TTL.
	key, err = s.redis.Get(ctx, currentKey).Result()
	if err != nil {
		return shared.ID{}, shared.Internal("读取热门推文快照失败", err)
	}
	return shared.ParseID(key)
}

func (s *Store) ReadRanking(ctx context.Context, id shared.ID, offset, limit int) ([]shared.ID, bool, error) {
	start := int64(offset) * idBytes
	packed, err := s.redis.GetRange(ctx, rankingKey(id), start, start+int64(limit)*idBytes-1).Result()
	if err != nil {
		return nil, false, shared.Internal("读取热门推文分页失败", err)
	}
	if packed == "" {
		return nil, false, nil
	}
	if len(packed)%idBytes != 0 {
		return nil, false, shared.Internal("热门推文快照损坏", nil)
	}
	ids := make([]shared.ID, 0, len(packed)/idBytes)
	for i := 0; i < len(packed); i += idBytes {
		var value uuid.UUID
		copy(value[:], packed[i:i+idBytes])
		if value == uuid.Nil {
			break
		}
		ids = append(ids, shared.IDFromUUID(value))
	}
	return ids, true, nil
}

func (s *Store) ReserveView(ctx context.Context, id shared.ID, visitor string) (func(context.Context) error, error) {
	key := "tweet:view:" + id.String() + ":" + visitor
	owner := shared.NewID().String()
	reserved, err := s.redis.SetNX(ctx, key, owner, viewTTL).Result()
	if err != nil {
		return nil, shared.Internal("预留推文浏览去重键失败", err)
	}
	if !reserved {
		return nil, nil
	}
	return func(ctx context.Context) error {
		return deleteIfOwned.Run(ctx, s.redis, []string{key}, owner).Err()
	}, nil
}

var _ apptweet.FeedStore = (*Store)(nil)
