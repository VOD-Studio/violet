package github

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	domainreleases "blog-api/internal/domain/releases"
	activity "blog-api/internal/domain/repositoryactivity"
)

const (
	activityAPI      = "https://api.github.com/repos/"
	activityPageSize = 100
	activityBodyMax  = 8 << 20
)

// ActivityAdapter 不读取凭据，也不跟随 GitHub 重定向。
type ActivityAdapter struct {
	client *http.Client
}

func NewActivityAdapter() *ActivityAdapter {
	return &ActivityAdapter{client: &http.Client{
		Timeout:       15 * time.Second,
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}}
}

func (a *ActivityAdapter) Inspect(ctx context.Context, key string) (activity.Remote, error) {
	var document struct {
		ID            int64  `json:"id"`
		FullName      string `json:"full_name"`
		Private       *bool  `json:"private"`
		Visibility    string `json:"visibility"`
		DefaultBranch string `json:"default_branch"`
	}
	if _, err := a.get(ctx, key, "", nil, &document); err != nil {
		return activity.Remote{}, err
	}
	if document.Private == nil || *document.Private || document.Visibility != "public" || !strings.EqualFold(document.FullName, key) {
		return activity.Remote{}, activity.ErrUnavailable
	}
	if document.ID <= 0 || document.DefaultBranch == "" {
		return activity.Remote{}, fmt.Errorf("GitHub 仓库缺少标识或默认分支")
	}
	return activity.Remote{ID: document.ID, Key: document.FullName, DefaultBranch: document.DefaultBranch}, nil
}

func (a *ActivityAdapter) Commits(ctx context.Context, remote activity.Remote, ref string, page int) (activity.Page, error) {
	query := pageQuery(page)
	query.Set("sha", ref)
	var document []struct {
		SHA    string `json:"sha"`
		Commit struct {
			Message   string `json:"message"`
			Committer struct {
				Date time.Time `json:"date"`
			} `json:"committer"`
		} `json:"commit"`
	}
	next, err := a.get(ctx, remote.Key, "/commits", query, &document)
	if err != nil {
		return activity.Page{}, err
	}
	if len(document) > activityPageSize {
		return activity.Page{}, fmt.Errorf("GitHub 提交超出单页限制")
	}
	result := activity.Page{Events: make([]activity.Event, 0, len(document)), HasNext: next}
	for _, item := range document {
		if !validSHA(item.SHA) || item.Commit.Committer.Date.IsZero() {
			return activity.Page{}, fmt.Errorf("GitHub 提交缺少有效的 SHA 或提交时间")
		}
		result.Events = append(result.Events, activity.Event{
			Kind: activity.KindCommit, ID: item.SHA, Title: publicTitle(item.Commit.Message, item.SHA[:7]),
			URL: "https://github.com/" + remote.Key + "/commit/" + item.SHA, OccurredAt: item.Commit.Committer.Date,
		})
	}
	return result, nil
}

func (a *ActivityAdapter) Releases(ctx context.Context, remote activity.Remote, page int) (activity.Page, error) {
	var document []struct {
		ID          int64     `json:"id"`
		Tag         string    `json:"tag_name"`
		Name        string    `json:"name"`
		Body        string    `json:"body"`
		Draft       *bool     `json:"draft"`
		PublishedAt time.Time `json:"published_at"`
	}
	next, err := a.get(ctx, remote.Key, "/releases", pageQuery(page), &document)
	if err != nil {
		return activity.Page{}, err
	}
	if len(document) > activityPageSize {
		return activity.Page{}, fmt.Errorf("GitHub 发布超出单页限制")
	}
	result := activity.Page{Events: make([]activity.Event, 0, len(document)), HasNext: next}
	for _, item := range document {
		if item.Draft == nil || *item.Draft || item.PublishedAt.IsZero() {
			continue
		}
		if item.ID <= 0 || item.Tag == "" {
			return activity.Page{}, fmt.Errorf("GitHub 发布缺少标识或版本标签")
		}
		title := publicTitle(item.Name, item.Tag)
		if title == item.Tag {
			title = publicTitle(domainreleases.FirstChangeSummary(item.Body), item.Tag)
		}
		result.Events = append(result.Events, activity.Event{
			Kind: activity.KindRelease, ID: strconv.FormatInt(item.ID, 10), Tag: item.Tag, Title: title,
			URL: "https://github.com/" + remote.Key + "/releases/tag/" + url.PathEscape(item.Tag), OccurredAt: item.PublishedAt,
		})
	}
	return result, nil
}

func pageQuery(page int) url.Values {
	return url.Values{"per_page": {strconv.Itoa(activityPageSize)}, "page": {strconv.Itoa(page)}}
}

func (a *ActivityAdapter) get(ctx context.Context, key, endpoint string, query url.Values, document any) (bool, error) {
	canonical, ok := activity.RepositoryKey("https://github.com/" + key)
	if !ok || !strings.EqualFold(key, canonical) {
		return false, activity.ErrUnavailable
	}
	address := activityAPI + key + endpoint
	if len(query) > 0 {
		address += "?" + query.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, address, nil)
	if err != nil {
		return false, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("User-Agent", "Violet-Repository-Activity")
	resp, err := a.client.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK:
		if err := json.NewDecoder(io.LimitReader(resp.Body, activityBodyMax)).Decode(document); err != nil {
			return false, fmt.Errorf("解析 GitHub 公开活动: %w", err)
		}
		return hasNextLink(resp.Header), nil
	case http.StatusConflict:
		if endpoint == "/commits" {
			return false, nil // GitHub 用 409 而非空数组表示 Git 仓库尚无提交。
		}
	case http.StatusTooManyRequests, http.StatusForbidden:
		if rate := rateLimit(resp, time.Now()); rate != nil {
			return false, rate
		}
		return false, activity.ErrUnavailable
	case http.StatusUnauthorized, http.StatusNotFound, http.StatusGone, http.StatusUnavailableForLegalReasons,
		http.StatusMovedPermanently, http.StatusFound, http.StatusSeeOther, http.StatusTemporaryRedirect, http.StatusPermanentRedirect:
		return false, activity.ErrUnavailable
	}
	return false, fmt.Errorf("GitHub API 返回 %d", resp.StatusCode)
}

func hasNextLink(header http.Header) bool {
	for _, value := range header.Values("Link") {
		for item := range strings.SplitSeq(value, ",") {
			_, relation, ok := strings.Cut(item, ">;")
			if ok && strings.TrimSpace(relation) == `rel="next"` {
				return true
			}
		}
	}
	return false
}

func rateLimit(resp *http.Response, now time.Time) *activity.RateLimitError {
	retry := resp.Header.Get("Retry-After")
	primary := resp.Header.Get("X-RateLimit-Remaining") == "0"
	if resp.StatusCode != http.StatusTooManyRequests && !primary && retry == "" {
		var document struct {
			Message string `json:"message"`
		}
		if err := json.NewDecoder(io.LimitReader(resp.Body, 8<<10)).Decode(&document); err != nil {
			return nil
		}
		message := strings.ToLower(document.Message)
		if !strings.Contains(message, "rate limit") && !strings.Contains(message, "abuse detection") {
			return nil
		}
	}

	var until time.Time
	if seconds, err := strconv.ParseInt(retry, 10, 64); err == nil && seconds >= 0 && seconds <= (1<<63-1)/int64(time.Second) {
		until = now.Add(time.Duration(seconds) * time.Second)
	} else if date, err := http.ParseTime(retry); err == nil {
		until = date
	}
	if primary {
		if reset, err := strconv.ParseInt(resp.Header.Get("X-RateLimit-Reset"), 10, 64); err == nil {
			at := time.Unix(reset, 0)
			if at.After(until) {
				until = at
			}
		}
	}
	if !until.After(now) {
		until = now.Add(time.Minute)
	}
	return &activity.RateLimitError{RetryAt: until}
}

func publicTitle(raw, fallback string) string {
	line, body, hasBody := strings.Cut(raw, "\n")
	line = strings.TrimSpace(line)
	remaining := 256
	for i := range line {
		if remaining == 0 {
			return line[:i] + "…"
		}
		remaining--
	}
	if line == "" {
		return fallback
	}
	if hasBody && len(body) > len(line) {
		return strings.Clone(line)
	}
	return line
}

func validSHA(sha string) bool {
	if len(sha) != 40 && len(sha) != 64 {
		return false
	}
	for i := range len(sha) {
		c := sha[i]
		if (c < '0' || c > '9') && (c < 'a' || c > 'f') {
			return false
		}
	}
	return true
}

var _ activity.Provider = (*ActivityAdapter)(nil)
