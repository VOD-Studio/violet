package publicprofile

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"time"

	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/user"
)

// Stats counts currently public content; received likes count tweet likes, not emoji reactions.
type Stats struct {
	Posts             int64 `json:"posts"`
	Tweets            int64 `json:"tweets"`
	Comments          int64 `json:"comments"`
	Annotations       int64 `json:"annotations"`
	ReceivedLikes     int64 `json:"received_likes"`
	ReceivedReactions int64 `json:"received_reactions"`
}

type Day struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

type Calendar struct {
	Timezone  string `json:"timezone"`
	StartDate string `json:"start_date"`
	EndDate   string `json:"end_date"`
	Total     int64  `json:"total"`
	Days      []Day  `json:"days"`
}

type Profile struct {
	ID                       string   `json:"id"`
	Username                 string   `json:"username"`
	DisplayName              string   `json:"display_name"`
	AvatarURL                string   `json:"avatar_url"`
	CoverURL                 string   `json:"cover_url"`
	Bio                      string   `json:"bio"`
	Location                 string   `json:"location"`
	Website                  string   `json:"website"`
	PublicReadingPreferences []string `json:"public_reading_preferences"`
	CreatedAt                string   `json:"created_at"`
	IsBot                    bool     `json:"is_bot"`
	Stats                    Stats    `json:"stats"`
	Activity                 Calendar `json:"activity"`
}

type Image struct {
	URL    string `json:"url"`
	Width  *int   `json:"width"`
	Height *int   `json:"height"`
}

// Activity contains a public preview and its canonical source URL, never private account metadata.
type Activity struct {
	ID           string    `json:"id"`
	Type         string    `json:"type"`
	Title        string    `json:"title"`
	Body         string    `json:"body"`
	SelectedText string    `json:"selected_text"`
	URL          string    `json:"url"`
	CoverImage   string    `json:"cover_image"`
	Images       []Image   `json:"images"`
	CreatedAt    time.Time `json:"created_at"`
	Order        int       `json:"-"`
}

// Position binds a cursor to its account, tab and first-page snapshot.
type Position struct {
	UserID   string    `json:"user"`
	Tab      string    `json:"tab"`
	Snapshot time.Time `json:"snapshot"`
	At       time.Time `json:"at"`
	Type     int       `json:"type"`
	ID       string    `json:"id"`
}

type Reader interface {
	Summary(context.Context, shared.ID, time.Time, time.Time) (Stats, []Day, error)
	Activities(context.Context, shared.ID, string, Position, int) ([]Activity, error)
}

type Service struct {
	users  user.UserRepository
	reader Reader
	now    func() time.Time
}

func NewService(users user.UserRepository, reader Reader) *Service {
	return &Service{users: users, reader: reader, now: time.Now}
}

func (s *Service) find(ctx context.Context, username string) (*user.User, error) {
	name, err := user.ParseUsername(username)
	if err != nil {
		return nil, shared.BadRequest("非法的用户名")
	}
	return s.users.FindByUsername(ctx, name)
}

func (s *Service) Get(ctx context.Context, username string) (Profile, error) {
	u, err := s.find(ctx, username)
	if err != nil {
		return Profile{}, err
	}
	now := s.now().UTC()
	end := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	startMonth := time.Date(end.Year(), end.Month()-6, 1, 0, 0, 0, 0, time.UTC)
	start := startMonth.AddDate(0, 0, min(end.Day(), startMonth.AddDate(0, 1, -1).Day())-1)
	stats, counts, err := s.reader.Summary(ctx, u.GetID(), start, end.AddDate(0, 0, 1))
	if err != nil {
		return Profile{}, err
	}
	calendar := Calendar{Timezone: "UTC", StartDate: start.Format(time.DateOnly), EndDate: end.Format(time.DateOnly), Days: make([]Day, 0, 185)}
	// Summary supplies nonempty dates in ascending UTC date order.
	countIndex := 0
	for date := start; !date.After(end); date = date.AddDate(0, 0, 1) {
		day := Day{Date: date.Format(time.DateOnly)}
		for countIndex < len(counts) && counts[countIndex].Date < day.Date {
			countIndex++
		}
		if countIndex < len(counts) && counts[countIndex].Date == day.Date {
			day.Count = counts[countIndex].Count
		}
		calendar.Days = append(calendar.Days, day)
		calendar.Total += day.Count
	}
	details := u.PublicDetails()
	return Profile{
		ID: u.GetID().String(), Username: u.Username().String(), DisplayName: u.DisplayName().String(),
		AvatarURL: u.AvatarURL(), CoverURL: u.CoverURL(), Bio: u.Bio(), CreatedAt: u.CreatedAt().Format(time.RFC3339), IsBot: u.IsBot(),
		Location: details.Location, Website: details.Website, PublicReadingPreferences: details.ReadingPreferences,
		Stats: stats, Activity: calendar,
	}, nil
}

func (s *Service) List(ctx context.Context, username, tab, cursor string, limit int) ([]Activity, string, error) {
	if tab == "" {
		tab = "all"
	}
	switch tab {
	case "all", "posts", "tweets", "comments", "annotations":
	default:
		return nil, "", shared.BadRequest("无效的动态分类")
	}
	u, err := s.find(ctx, username)
	if err != nil {
		return nil, "", err
	}
	if limit <= 0 {
		limit = 20
	}
	if limit > 50 {
		limit = 50
	}
	position := Position{UserID: u.GetID().String(), Tab: tab, Snapshot: s.now().UTC()}
	if cursor != "" {
		data, err := base64.RawURLEncoding.DecodeString(cursor)
		if err != nil || len(data) > 1024 {
			return nil, "", shared.BadRequest("无效的动态游标")
		}
		if err := json.Unmarshal(data, &position); err != nil || position.UserID != u.GetID().String() || position.Tab != tab || position.Snapshot.IsZero() || position.Snapshot.After(s.now().UTC()) || position.At.IsZero() || position.At.After(position.Snapshot) || position.Type < 1 || position.Type > 5 {
			return nil, "", shared.BadRequest("无效的动态游标")
		}
		if _, err := shared.ParseID(position.ID); err != nil {
			return nil, "", shared.BadRequest("无效的动态游标")
		}
	}
	items, err := s.reader.Activities(ctx, u.GetID(), tab, position, limit+1)
	if err != nil {
		return nil, "", err
	}
	if len(items) <= limit {
		return items, "", nil
	}
	items = items[:limit]
	last := items[len(items)-1]
	position.At, position.Type, position.ID = last.CreatedAt, last.Order, last.ID
	data, err := json.Marshal(position)
	if err != nil {
		return nil, "", shared.Internal("生成动态游标失败", err)
	}
	return items, base64.RawURLEncoding.EncodeToString(data), nil
}
