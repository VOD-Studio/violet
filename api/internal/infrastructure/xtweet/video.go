package xtweet

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"time"

	apptweet "blog-api/internal/application/tweet"
)

// videoHeaderTimeout 只限制等待响应头；正文随客户端请求的上下文流式传输，不设总时长。
const videoHeaderTimeout = 10 * time.Second

var singleRange = regexp.MustCompile(`^bytes=\d*-\d*$`)

type VideoSource struct {
	client *http.Client
}

func NewVideoSource(client *http.Client) *VideoSource {
	c := safeClient(client, "video.twimg.com")
	c.Timeout = 0
	return &VideoSource{client: c}
}

func (s *VideoSource) Open(ctx context.Context, rawURL, byteRange string) (*apptweet.ExternalVideoStream, error) {
	if videoSourceURL(rawURL) != rawURL {
		return nil, errors.New("unsafe video URL")
	}
	ctx, cancel := context.WithCancel(ctx)
	timer := time.AfterFunc(videoHeaderTimeout, cancel)
	// 不设置 Referer：video.twimg.com 对站外 Referer 返回 403。
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		cancel()
		return nil, err
	}
	if singleRange.MatchString(byteRange) && byteRange != "bytes=-" {
		req.Header.Set("Range", byteRange)
	}
	res, err := s.client.Do(req)
	if !timer.Stop() && err == nil {
		// 计时器已在返回前触发，上下文随时会中断正文。
		_ = res.Body.Close()
		err = context.DeadlineExceeded
	}
	if err != nil {
		cancel()
		return nil, err
	}
	switch res.StatusCode {
	case http.StatusOK, http.StatusPartialContent, http.StatusRequestedRangeNotSatisfiable:
	default:
		_ = res.Body.Close()
		cancel()
		return nil, fmt.Errorf("video upstream status %d", res.StatusCode)
	}
	return &apptweet.ExternalVideoStream{
		Status:        res.StatusCode,
		ContentType:   res.Header.Get("Content-Type"),
		ContentLength: res.Header.Get("Content-Length"),
		ContentRange:  res.Header.Get("Content-Range"),
		ETag:          res.Header.Get("ETag"),
		LastModified:  res.Header.Get("Last-Modified"),
		Body:          cancelOnClose{ReadCloser: res.Body, cancel: cancel},
	}, nil
}

type cancelOnClose struct {
	io.ReadCloser
	cancel context.CancelFunc
}

func (c cancelOnClose) Close() error {
	err := c.ReadCloser.Close()
	c.cancel()
	return err
}
