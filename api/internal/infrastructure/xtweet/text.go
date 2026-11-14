package xtweet

import (
	"fmt"
	"html"
	"net/url"
	"sort"
	"strings"
	"unicode/utf16"

	"blog-api/internal/domain/tweet"
)

type facet struct {
	Type        string `json:"type"`
	Indices     []int  `json:"indices"`
	Original    string `json:"original"`
	Replacement string `json:"replacement"`
	Display     string `json:"display"`
}

// normalizeText 按码点切分正文：X 的实体索引与普通推文的显示范围均以 Unicode 码点计数，
// 只有长推文（note tweet）的显示范围是 UTF-16 偏移，由 utf16Range 指明。
func normalizeText(raw string, displayRange []int, facets []facet, utf16Range bool) (string, []tweet.ExternalSegment, error) {
	runes := []rune(raw)
	start, end := 0, len(runes)
	if len(displayRange) > 0 {
		if len(displayRange) != 2 {
			return "", nil, fmt.Errorf("invalid text range")
		}
		start, end = displayRange[0], displayRange[1]
		if utf16Range {
			start, end = runeIndexOfUTF16(runes, start), runeIndexOfUTF16(runes, end)
		}
	}
	boundary := func(i int) bool { return i >= 0 && i <= len(runes) }
	if start > end || !boundary(start) || !boundary(end) {
		return "", nil, fmt.Errorf("invalid text range")
	}
	relevant := make([]facet, 0, len(facets))
	for _, f := range facets {
		switch f.Type {
		case "url", "mention", "hashtag", "media":
			if len(f.Indices) != 2 || f.Indices[0] >= f.Indices[1] || !boundary(f.Indices[0]) || !boundary(f.Indices[1]) {
				return "", nil, fmt.Errorf("invalid facet")
			}
			if f.Indices[1] <= start || f.Indices[0] >= end {
				continue
			}
			if f.Indices[0] < start || f.Indices[1] > end {
				return "", nil, fmt.Errorf("facet crosses text range")
			}
			relevant = append(relevant, f)
		}
	}
	sort.SliceStable(relevant, func(i, j int) bool {
		if relevant[i].Indices[0] == relevant[j].Indices[0] {
			return relevant[i].Type == "media" && relevant[j].Type != "media"
		}
		return relevant[i].Indices[0] < relevant[j].Indices[0]
	})
	segments := make([]tweet.ExternalSegment, 0, len(relevant)*2+1)
	appendText := func(text string) {
		if text != "" {
			segments = append(segments, tweet.ExternalSegment{Kind: "text", Text: html.UnescapeString(text)})
		}
	}
	pos := start
	for _, f := range relevant {
		a, b := f.Indices[0], f.Indices[1]
		if a < pos {
			continue
		}
		appendText(string(runes[pos:a]))
		pos = b
		if f.Type == "media" {
			continue
		}
		text := html.UnescapeString(string(runes[a:b]))
		kind, href := f.Type, ""
		switch f.Type {
		case "url":
			href = safeLink(f.Replacement)
			if href == "" {
				href = safeLink(f.Original)
			}
			if f.Display != "" && href != "" {
				text = html.UnescapeString(f.Display)
			}
			kind = "link"
		case "mention":
			handle := strings.TrimPrefix(text, "@")
			if tweet.ValidXHandle(handle) {
				href = "https://x.com/" + handle
			}
		case "hashtag":
			href = "https://x.com/hashtag/" + url.PathEscape(strings.TrimPrefix(text, "#"))
		}
		if href == "" {
			kind = "text"
		}
		segments = append(segments, tweet.ExternalSegment{Kind: kind, Text: text, URL: href})
	}
	appendText(string(runes[pos:end]))
	if len(segments) > 0 {
		segments[0].Text = strings.TrimLeft(segments[0].Text, " \r\n\t")
		segments[len(segments)-1].Text = strings.TrimRight(segments[len(segments)-1].Text, " \r\n\t")
	}
	var text strings.Builder
	for _, segment := range segments {
		text.WriteString(segment.Text)
	}
	return text.String(), segments, nil
}

func safeLink(raw string) string {
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Hostname() == "" || u.User != nil {
		return ""
	}
	return u.String()
}

// runeIndexOfUTF16 把 UTF-16 偏移换算为码点下标；落在代理对中间或越界时返回 -1。
func runeIndexOfUTF16(runes []rune, offset int) int {
	if offset < 0 {
		return -1
	}
	units := 0
	for i, r := range runes {
		if units == offset {
			return i
		}
		if units > offset {
			return -1
		}
		units += utf16.RuneLen(r)
	}
	if units == offset {
		return len(runes)
	}
	return -1
}
