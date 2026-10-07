package xtweet

import (
	"context"
	"errors"
	"fmt"
	"image"
	"io"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	_ "golang.org/x/image/webp"
	"golang.org/x/sync/errgroup"

	apptweet "blog-api/internal/application/tweet"
	"blog-api/internal/domain/tweet"
	domainupload "blog-api/internal/domain/upload"
	"blog-api/internal/infrastructure/ssrf"
	"blog-api/internal/infrastructure/storage"
)

const (
	maxImageBytes  = 10 << 20
	maxImportBytes = 32 << 20
	maxImagePixels = 20000000
)

type MediaStore struct {
	client    *http.Client
	storage   *storage.LocalStorage
	processor domainupload.ImageProcessor
	root      string
	prefix    string
}

func NewMediaStore(root, prefix string, processor domainupload.ImageProcessor, client *http.Client) *MediaStore {
	mediaClient := safeClient(client, "pbs.twimg.com")
	mediaClient.Timeout = 15 * time.Second
	return &MediaStore{client: mediaClient, storage: storage.NewLocalStorage(root, prefix), processor: processor, root: root, prefix: strings.TrimSuffix(prefix, "/")}
}

func (s *MediaStore) Prepare(ctx context.Context, id, version string, snapshot *tweet.ExternalSnapshot, total *int64) (err error) {
	if _, err := uuid.Parse(id); err != nil {
		return err
	}
	if _, err := uuid.Parse(version); err != nil {
		return err
	}
	if len(snapshot.Media) > 8 {
		return &apptweet.ExternalFetchError{Kind: "media_failed"}
	}
	tmpRoot := filepath.Join(s.root, ".external-tmp")
	if err := s.storage.EnsureDir(tmpRoot); err != nil {
		return err
	}
	tmp, err := os.MkdirTemp(tmpRoot, id+"-")
	if err != nil {
		return err
	}
	defer func() { _ = s.storage.CleanupDir(tmp) }()
	group, groupCtx := errgroup.WithContext(ctx)
	group.SetLimit(3)
	for i := range snapshot.Media {
		group.Go(func() error {
			media := &snapshot.Media[i]
			url, err := mediaURL(media.SourceURL, media.Kind == "photo")
			if err != nil {
				return err
			}
			media.SourceURL = url
			fileID := uuid.NewString()
			name, width, height, err := s.download(groupCtx, url, tmp, fileID, total)
			if err != nil {
				return err
			}
			media.FileID, media.Width, media.Height = fileID, width, height
			media.URL = s.assetURL(id, version, name)
			return nil
		})
	}
	if err := group.Wait(); err != nil {
		return &apptweet.ExternalFetchError{Kind: "media_failed"}
	}
	if source := snapshot.Author.AvatarSourceURL; source != "" {
		avatarURL, avatarErr := mediaURL(source, false)
		if avatarErr == nil {
			var name string
			name, _, _, avatarErr = s.download(ctx, avatarURL, tmp, "avatar", total)
			if avatarErr == nil {
				snapshot.Author.AvatarSourceURL = avatarURL
				snapshot.Author.AvatarURL = s.assetURL(id, version, name)
			}
		}
		if avatarErr != nil {
			log.Warn().Err(avatarErr).Str("external_tweet_id", id).Msg("保存 X 原作者头像失败，使用姓名占位")
		}
	}
	if ctx.Err() != nil {
		return &apptweet.ExternalFetchError{Kind: "media_failed"}
	}
	if atomic.LoadInt64(total) > maxImportBytes {
		return &apptweet.ExternalFetchError{Kind: "media_failed"}
	}
	dest := filepath.Join(s.root, "external-tweets", id, version)
	if err := s.storage.Move(tmp, dest); err != nil {
		return err
	}
	for i := range snapshot.Media {
		media := &snapshot.Media[i]
		path := filepath.Join(dest, filepath.Base(media.URL))
		media.ThumbnailURL = s.processor.Thumbnail(path, media.FileID, filepath.Join("external-tweets", id, version), http.DetectContentType(mustReadHeader(path)))
	}
	if ctx.Err() != nil {
		_ = s.DeleteVersion(context.WithoutCancel(ctx), id, version)
		return &apptweet.ExternalFetchError{Kind: "media_failed"}
	}
	return nil
}

func mediaURL(raw string, original bool) (string, error) {
	u, err := url.Parse(raw)
	if err != nil || checkURL(u, "pbs.twimg.com") != nil {
		return "", errors.New("unsafe media URL")
	}
	u.Fragment = ""
	if original && strings.HasPrefix(u.Path, "/media/") {
		query := u.Query()
		query.Set("name", "orig")
		u.RawQuery = query.Encode()
	}
	return u.String(), nil
}

func (s *MediaStore) download(ctx context.Context, source, dir, fileID string, total *int64) (string, int, int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, source, nil)
	if err != nil {
		return "", 0, 0, err
	}
	res, err := s.client.Do(req)
	if err != nil {
		return "", 0, 0, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK || res.ContentLength > maxImageBytes {
		return "", 0, 0, errors.New("image response rejected")
	}
	path := filepath.Join(dir, fileID+".download")
	defer func() { _ = os.Remove(path) }()
	out, err := os.Create(path)
	if err != nil {
		return "", 0, 0, err
	}
	count, copyErr := io.Copy(out, ssrf.LimitBody(res.Body, maxImageBytes))
	closeErr := out.Close()
	if atomic.AddInt64(total, count) > maxImportBytes {
		return "", 0, 0, errors.New("import size limit")
	}
	if copyErr != nil {
		return "", 0, 0, copyErr
	}
	if closeErr != nil {
		return "", 0, 0, closeErr
	}
	file, err := os.Open(path)
	if err != nil {
		return "", 0, 0, err
	}
	config, format, decodeErr := image.DecodeConfig(file)
	_ = file.Close()
	if decodeErr != nil || config.Width <= 0 || config.Height <= 0 || int64(config.Width)*int64(config.Height) > maxImagePixels {
		return "", 0, 0, errors.New("image pixel limit or invalid image")
	}
	formats := map[string]string{"jpeg": ".jpg", "png": ".png", "gif": ".gif", "webp": ".webp"}
	ext, ok := formats[format]
	if !ok {
		return "", 0, 0, errors.New("image format rejected")
	}
	detected := http.DetectContentType(mustReadHeader(path))
	declared, _, err := mime.ParseMediaType(res.Header.Get("Content-Type"))
	if err != nil || detected != declared {
		return "", 0, 0, errors.New("image MIME mismatch")
	}
	if format == "webp" {
		file, err := os.Open(path)
		if err != nil {
			return "", 0, 0, err
		}
		_, _, decodeErr = image.Decode(file)
		_ = file.Close()
		if decodeErr != nil {
			return "", 0, 0, errors.New("invalid WebP image")
		}
	}
	if _, err := s.processor.Validate(path); err != nil {
		return "", 0, 0, err
	}
	name := fileID + ext
	if err := s.storage.Move(path, filepath.Join(dir, name)); err != nil {
		return "", 0, 0, err
	}
	width, height := s.processor.Dimensions(filepath.Join(dir, name))
	if width <= 0 || height <= 0 {
		return "", 0, 0, errors.New("invalid image dimensions")
	}
	return name, width, height, nil
}

func mustReadHeader(path string) []byte {
	file, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer file.Close()
	data := make([]byte, 512)
	n, _ := file.Read(data)
	return data[:n]
}

func (s *MediaStore) assetURL(id, version, name string) string {
	return s.prefix + "/external-tweets/" + id + "/" + version + "/" + name
}

func (s *MediaStore) DeleteVersion(_ context.Context, id, version string) error {
	if _, err := uuid.Parse(id); err != nil {
		return err
	}
	if _, err := uuid.Parse(version); err != nil {
		return err
	}
	return s.storage.CleanupDir(filepath.Join(s.root, "external-tweets", id, version))
}

func (s *MediaStore) DeleteAll(_ context.Context, id string) error {
	if _, err := uuid.Parse(id); err != nil {
		return err
	}
	return s.storage.CleanupDir(filepath.Join(s.root, "external-tweets", id))
}

func (s *MediaStore) Sweep(ctx context.Context, versions map[string]string, before time.Time) error {
	root := filepath.Join(s.root, "external-tweets")
	entries, err := os.ReadDir(root)
	if os.IsNotExist(err) {
		err = nil
	}
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if !entry.IsDir() {
			continue
		}
		if _, err := uuid.Parse(entry.Name()); err != nil {
			continue
		}
		items, err := os.ReadDir(filepath.Join(root, entry.Name()))
		if err != nil {
			return err
		}
		for _, item := range items {
			if !item.IsDir() || versions[entry.Name()] == item.Name() {
				continue
			}
			info, err := item.Info()
			if err != nil {
				return err
			}
			if info.ModTime().Before(before) {
				if err := s.DeleteVersion(ctx, entry.Name(), item.Name()); err != nil {
					return err
				}
			}
		}
	}
	tmpEntries, err := os.ReadDir(filepath.Join(s.root, ".external-tmp"))
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	for _, entry := range tmpEntries {
		info, err := entry.Info()
		if err != nil {
			return err
		}
		if info.ModTime().Before(before) {
			if err := s.storage.CleanupDir(filepath.Join(s.root, ".external-tmp", entry.Name())); err != nil {
				return fmt.Errorf("clean external staging files: %w", err)
			}
		}
	}
	return nil
}
