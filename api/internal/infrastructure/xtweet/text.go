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

func normalizeText(raw string, displayRange []int, facets []facet) (string, []tweet.ExternalSegment, error) {
	units := utf16.Encode([]rune(raw))
	start, end := 0, len(units)
	if len(displayRange) > 0 {
		if len(displayRange) != 2 {
			return "", nil, fmt.Errorf("invalid text range")
		}
		start, end = displayRange[0], displayRange[1]
	}
	boundary := func(i int) bool {
		return i >= 0 && i <= len(units) && (i == 0 || i == len(units) || units[i] < 0xdc00 || units[i] > 0xdfff)
	}
	if start > end || !boundary(start) || !boundary(end) {
		return "", nil, fmt.Errorf("invalid UTF-16 boundary")
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
		appendText(string(utf16.Decode(units[pos:a])))
		pos = b
		if f.Type == "media" {
			continue
		}
		text := html.UnescapeString(string(utf16.Decode(units[a:b])))
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
	appendText(string(utf16.Decode(units[pos:end])))
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
