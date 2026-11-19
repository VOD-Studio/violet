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
)

// SummarizePublicReleases 匿名遍历 GitHub 正式发布，不使用站点令牌或跟随重定向。
func (a *Adapter) SummarizePublicReleases(ctx context.Context, owner, repo string) (domainreleases.PublicSummary, error) {
	if owner == "" || repo == "" || owner == "." || owner == ".." || repo == "." || repo == ".." ||
		url.PathEscape(owner) != owner || url.PathEscape(repo) != repo {
		return domainreleases.PublicSummary{}, domainreleases.ErrReleasesAPI
	}
	endpoint := "https://api.github.com/repos/" + owner + "/" + repo + "/releases?per_page=100&page="
	client := *a.client
	client.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	var summary domainreleases.PublicSummary
	var latest time.Time
	for page := 1; ; page++ {
		releases, links, err := fetchPublicReleasePage(ctx, &client, endpoint+strconv.Itoa(page))
		if err != nil {
			return domainreleases.PublicSummary{}, err
		}
		for _, release := range releases {
			if release.Draft || release.Prerelease {
				continue
			}
			published, err := time.Parse(time.RFC3339, release.PublishedAt)
			if err != nil || release.TagName == "" || !trustedReleaseURL(release.HTMLURL, "github.com") {
				return domainreleases.PublicSummary{}, domainreleases.ErrReleasesAPI
			}
			summary.Count++
			if summary.Count == 1 || published.After(latest) {
				latest = published
				summary.TagName = release.TagName
				summary.PublishedAt = release.PublishedAt
				summary.HTMLURL = release.HTMLURL
			}
		}
		more, err := hasNextReleasePage(links, page+1)
		if err != nil {
			return domainreleases.PublicSummary{}, err
		}
		if !more {
			return summary, nil
		}
	}
}

type publicRelease struct {
	TagName     string `json:"tag_name"`
	PublishedAt string `json:"published_at"`
	HTMLURL     string `json:"html_url"`
	Draft       bool   `json:"draft"`
	Prerelease  bool   `json:"prerelease"`
}

func fetchPublicReleasePage(ctx context.Context, client *http.Client, endpoint string) ([]publicRelease, []string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, err := client.Do(req)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, nil, fmt.Errorf("GitHub public releases: HTTP %d", resp.StatusCode)
	}
	const maxPageBytes = 16 << 20
	body := &io.LimitedReader{R: resp.Body, N: maxPageBytes + 1}
	decoder := json.NewDecoder(body)
	var releases []publicRelease
	if decoder.Decode(&releases) != nil || releases == nil {
		return nil, nil, domainreleases.ErrReleasesAPI
	}
	if decoder.Decode(new(json.RawMessage)) != io.EOF || body.N == 0 {
		return nil, nil, domainreleases.ErrReleasesAPI
	}
	return releases, resp.Header.Values("Link"), nil
}

func trustedReleaseURL(raw, host string) bool {
	u, err := url.Parse(raw)
	return err == nil && u.Scheme == "https" && u.User == nil && strings.EqualFold(u.Host, host)
}

// GitHub 链接可指向数字仓库 ID。只读取 next 关系，实际 URL 始终由调用者生成。
func hasNextReleasePage(headers []string, expected int) (bool, error) {
	found := false
	for _, header := range headers {
		for link := range strings.SplitSeq(header, ",") {
			target, params, _ := strings.Cut(link, ";")
			for param := range strings.SplitSeq(params, ";") {
				name, value, _ := strings.Cut(strings.TrimSpace(param), "=")
				if strings.TrimSpace(name) != "rel" || !containsNextRelation(strings.TrimSpace(value)) {
					continue
				}
				target = strings.TrimSpace(target)
				if found || len(target) < 2 || target[0] != '<' || target[len(target)-1] != '>' {
					return false, domainreleases.ErrReleasesAPI
				}
				next, err := url.Parse(target[1 : len(target)-1])
				if err != nil || next.Scheme != "https" || next.User != nil || !strings.EqualFold(next.Host, "api.github.com") ||
					next.Fragment != "" || next.Query().Get("page") != strconv.Itoa(expected) {
					return false, domainreleases.ErrReleasesAPI
				}
				found = true
			}
		}
	}
	return found, nil
}

func containsNextRelation(value string) bool {
	for relation := range strings.FieldsSeq(strings.Trim(value, `"`)) {
		if relation == "next" {
			return true
		}
	}
	return false
}
