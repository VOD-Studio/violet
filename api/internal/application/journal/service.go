// Package journal 编排手写手记与仓库进展的公开时间线。
package journal

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
	"golang.org/x/sync/errgroup"

	appnote "blog-api/internal/application/note"
	appactivity "blog-api/internal/application/repositoryactivity"
	domainnote "blog-api/internal/domain/note"
	"blog-api/internal/domain/releases"
	activity "blog-api/internal/domain/repositoryactivity"
	"blog-api/internal/domain/shared"
)

const progressType = "progress"

// NoteReader 只读已发布的手写手记。
type NoteReader interface {
	BrowsePublished(context.Context, appnote.BrowseQuery) ([]appnote.PublicNoteDTO, string, error)
}

// ProgressReader 只读后台同步的公开快照，不在读请求触发 GitHub 同步。
type ProgressReader interface {
	Browse(context.Context, *shared.ID, *activity.Cursor, int) ([]activity.Day, activity.Health, error)
	GetDay(context.Context, shared.ID, string) (activity.Day, error)
	Growth(context.Context, string) (appactivity.Growth, error)
}

type growthSettingsReader interface {
	GetAll(context.Context) (map[string]string, error)
}

type Service struct {
	notes    NoteReader
	progress ProgressReader
	settings growthSettingsReader
}

func NewService(notes NoteReader, progress ProgressReader, settings growthSettingsReader) *Service {
	return &Service{notes: notes, progress: progress, settings: settings}
}

// Growth 只允许站点配置的发布仓库作为关于页的数据来源。
func (s *Service) Growth(ctx context.Context) (appactivity.Growth, error) {
	values, err := s.settings.GetAll(ctx)
	if err != nil {
		return appactivity.Growth{}, err
	}
	owner, repo := releases.RepositoryTarget(values["github_username"], values["releases_repo"])
	key, _ := activity.RepositoryKey("https://github.com/" + owner + "/" + repo)
	return s.progress.Growth(ctx, key)
}

type Query struct {
	Cursor    string
	Type      string
	Tag       string
	ProjectID string
	Limit     int
}

// Entry 由 kind 判别，且只含一个来源的数据。
type Entry struct {
	Kind     string                 `json:"kind"`
	Note     *appnote.PublicNoteDTO `json:"note,omitempty"`
	Progress *activity.Day          `json:"progress,omitempty"`
}

type Page struct {
	Entries    []Entry          `json:"entries"`
	NextCursor *string          `json:"next_cursor"`
	Progress   *activity.Health `json:"progress"` // 仅查询手写内容时为 nil。
}

// Browse 按上海日历日倒序；同一天的进展先于手写手记。
func (s *Service) Browse(ctx context.Context, query Query) (Page, error) {
	if query.Type != "" && query.Type != progressType && !domainnote.Type(query.Type).IsValid() {
		return Page{}, shared.BadRequest("手记类型无效")
	}
	project, err := parseProjectID(query.ProjectID)
	if err != nil {
		return Page{}, err
	}
	noteCursor, progressCursor, err := decodeCursor(query.Cursor)
	if err != nil {
		return Page{}, err
	}
	limit := query.Limit
	if limit <= 0 {
		limit = 24
	}
	limit = min(limit, 50)
	query.Tag = strings.TrimSpace(query.Tag)
	var notes []appnote.PublicNoteDTO
	var noteNext string
	var days []activity.Day
	var health *activity.Health
	group, readCtx := errgroup.WithContext(ctx)
	if query.Type != progressType {
		group.Go(func() error {
			var err error
			notes, noteNext, err = s.notes.BrowsePublished(readCtx, appnote.BrowseQuery{
				Cursor: noteCursor, Limit: limit, TagSlug: query.Tag,
				Type: domainnote.Type(query.Type), ProjectID: query.ProjectID,
			})
			return err
		})
	}
	if query.Tag == "" && (query.Type == "" || query.Type == progressType) {
		group.Go(func() error {
			progressCtx, cancel := context.WithTimeout(readCtx, 750*time.Millisecond)
			defer cancel()
			result, status, err := s.progress.Browse(progressCtx, project, progressCursor, limit+1)
			if err != nil {
				if readCtx.Err() == nil {
					log.Warn().Err(err).Msg("读取仓库进展失败")
				}
				reason := activity.ReasonFailed
				health = &activity.Health{State: activity.StateFailed, Reason: &reason}
				return nil
			}
			days, health = result, &status
			return nil
		})
	}
	if err := group.Wait(); err != nil {
		return Page{}, err
	}
	return mergePage(notes, noteNext, days, health, limit)
}

func (s *Service) GetDay(ctx context.Context, projectID, day string) (activity.Day, error) {
	project, err := parseProjectID(projectID)
	if err != nil {
		return activity.Day{}, err
	}
	if project == nil {
		return activity.Day{}, shared.BadRequest("项目 ID 无效")
	}
	if _, err := time.Parse(time.DateOnly, day); err != nil {
		return activity.Day{}, shared.BadRequest("进展日期无效")
	}
	return s.progress.GetDay(ctx, *project, day)
}

func mergePage(notes []appnote.PublicNoteDTO, noteNext string, days []activity.Day, health *activity.Health, limit int) (Page, error) {
	page := Page{Entries: make([]Entry, 0, min(len(notes)+len(days), limit)), Progress: health}
	var last position
	var i, j int
	var noteDay string
	for len(page.Entries) < limit && (i < len(notes) || j < len(days)) {
		if noteDay == "" && i < len(notes) {
			at, err := time.Parse(time.RFC3339Nano, notes[i].PublishedAt)
			if err != nil {
				return Page{}, shared.Internal("读取手记发布时间失败", err)
			}
			noteDay = at.In(activity.Location).Format(time.DateOnly)
		}
		if j < len(days) && days[j].Day >= noteDay {
			d := &days[j]
			page.Entries = append(page.Entries, Entry{Kind: progressType, Progress: d})
			last = position{Day: d.Day, ID: d.Project.ID}
			j++
			continue
		}
		n := &notes[i]
		page.Entries = append(page.Entries, Entry{Kind: "note", Note: n})
		last = position{Day: noteDay, ID: n.ID, NoteAt: n.PublishedAt}
		i++
		noteDay = ""
	}
	if i < len(notes) || j < len(days) || noteNext != "" {
		body, _ := json.Marshal(last)
		encoded := base64.RawURLEncoding.EncodeToString(body)
		page.NextCursor = &encoded
	}
	return page, nil
}

// position 记录整个流的边界，不让恢复的进展倒插进已经翻过的日期。
type position struct {
	Day    string `json:"day"`
	ID     string `json:"id"`
	NoteAt string `json:"note_at,omitempty"`
}

func decodeCursor(encoded string) (string, *activity.Cursor, error) {
	if encoded == "" {
		return "", nil, nil
	}
	if len(encoded) > 256 {
		return "", nil, shared.BadRequest("手记分页游标无效")
	}
	body, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return "", nil, shared.BadRequest("手记分页游标无效")
	}
	var last position
	if err := json.Unmarshal(body, &last); err != nil {
		return "", nil, shared.BadRequest("手记分页游标无效")
	}
	day, dayErr := time.ParseInLocation(time.DateOnly, last.Day, activity.Location)
	id, idErr := shared.ParseID(last.ID)
	if dayErr != nil || idErr != nil || id.IsZero() {
		return "", nil, shared.BadRequest("手记分页游标无效")
	}
	before := &activity.Cursor{Day: last.Day}
	if last.NoteAt == "" {
		before.ProjectID = id
		return appnote.EncodePublishedCursor(domainnote.PublishedCursor{
			PublishedAt: day.AddDate(0, 0, 1),
		}), before, nil
	}
	at, err := time.Parse(time.RFC3339Nano, last.NoteAt)
	if err != nil || at.In(activity.Location).Format(time.DateOnly) != last.Day {
		return "", nil, shared.BadRequest("手记分页游标无效")
	}
	return appnote.EncodePublishedCursor(domainnote.PublishedCursor{PublishedAt: at, ID: id}), before, nil
}

func parseProjectID(raw string) (*shared.ID, error) {
	if raw == "" {
		return nil, nil
	}
	id, err := shared.ParseID(raw)
	if err != nil || id.IsZero() {
		return nil, shared.BadRequest("项目 ID 无效")
	}
	return &id, nil
}
