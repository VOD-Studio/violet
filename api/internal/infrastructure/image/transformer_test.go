package image

import (
	"bytes"
	"context"
	"encoding/binary"
	"hash/crc32"
	"image"
	"image/color"
	"image/gif"
	"image/png"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/disintegration/imaging"
	"github.com/stretchr/testify/require"

	domainimage "blog-api/internal/domain/image"
	domainsettings "blog-api/internal/domain/settings"
)

func fixture(t *testing.T, name string) []byte {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("testdata", name))
	require.NoError(t, err)
	return data
}

func TestTransformGeometry(t *testing.T) {
	for _, test := range []struct {
		name          string
		params        domainimage.TransformParams
		width, height int
	}{
		{"缩放", domainimage.TransformParams{Width: 50, Format: "jpeg", Quality: 80}, 50, 37},
		{"裁剪", domainimage.TransformParams{ThumbW: 40, ThumbH: 40, Format: "jpeg"}, 40, 40},
		{"旋转", domainimage.TransformParams{Rotate: 90, Format: "jpeg"}, 150, 200},
	} {
		t.Run(test.name, func(t *testing.T) {
			result, err := NewTransformer(NewEncoder()).Transform(context.Background(), fixture(t, "sample.jpg"), test.params, domainsettings.DefaultImagePolicy())
			require.NoError(t, err)
			require.Equal(t, "image/jpeg", result.MimeType)
			require.NotEmpty(t, result.ETag)
			img, err := imaging.Decode(bytes.NewReader(result.Bytes))
			require.NoError(t, err)
			require.Equal(t, test.width, img.Bounds().Dx())
			require.Equal(t, test.height, img.Bounds().Dy())
		})
	}
}

func TestTransformRealLossyQualityAndAlpha(t *testing.T) {
	policy := domainsettings.DefaultImagePolicy()
	require.NoError(t, ValidatePolicy(policy))
	img := image.NewNRGBA(image.Rect(0, 0, 128, 128))
	for y := range 128 {
		for x := range 128 {
			img.SetNRGBA(x, y, color.NRGBA{R: byte(x*17 + y*3), G: byte(y*11 + x*5), B: byte(x * y), A: byte(x * 2)})
		}
	}
	var source bytes.Buffer
	require.NoError(t, png.Encode(&source, img))
	tr := NewTransformer(NewEncoder())
	params := domainimage.TransformParams{Format: "webp"}
	lossless, err := tr.Transform(context.Background(), source.Bytes(), params, policy)
	require.NoError(t, err)
	require.Equal(t, "image/webp", lossless.MimeType)
	policy.WebPMode, policy.WebPQuality, policy.WebPMethod = "lossy", 25, 0
	low, err := tr.Transform(context.Background(), source.Bytes(), params, policy)
	require.NoError(t, err)
	policy.WebPQuality, policy.WebPMethod = 95, 6
	high, err := tr.Transform(context.Background(), source.Bytes(), params, policy)
	require.NoError(t, err)
	require.NotEqual(t, low.Bytes, high.Bytes)
	require.NotEqual(t, lossless.Bytes, high.Bytes)
	for _, output := range [][]byte{lossless.Bytes, low.Bytes, high.Bytes} {
		decoded, _, err := image.Decode(bytes.NewReader(output))
		require.NoError(t, err)
		_, _, _, alpha := decoded.At(32, 64).RGBA()
		require.Equal(t, uint32(64*257), alpha)
	}
	transparent, err := tr.Transform(context.Background(), source.Bytes(), domainimage.TransformParams{Format: "jpeg"}, policy)
	require.NoError(t, err)
	require.Equal(t, "image/png", transparent.MimeType)
}

func TestTransformRejectsUnsafeSourceAndOutput(t *testing.T) {
	tr := NewTransformer(NewEncoder())
	policy := domainsettings.DefaultImagePolicy()
	for _, data := range [][]byte{[]byte("not an image"), []byte("RIFF1234WEBPVP8X...")} {
		_, err := tr.Transform(context.Background(), data, domainimage.TransformParams{}, policy)
		require.Error(t, err)
	}
	data := fixture(t, "sample.jpg")
	policy.MaxSourceDimension = 100
	_, err := tr.Transform(context.Background(), data, domainimage.TransformParams{}, policy)
	require.ErrorContains(t, err, "尺寸或像素")
	policy = domainsettings.DefaultImagePolicy()
	policy.MaxSourcePixels = 100
	_, err = tr.Transform(context.Background(), data, domainimage.TransformParams{}, policy)
	require.ErrorContains(t, err, "尺寸或像素")
	policy = domainsettings.DefaultImagePolicy()
	policy.MaxInputBytes = 1
	_, err = tr.Transform(context.Background(), data, domainimage.TransformParams{}, policy)
	require.ErrorContains(t, err, "输入字节")
	policy = domainsettings.DefaultImagePolicy()
	policy.MaxOutputBytes = 1
	_, err = tr.Transform(context.Background(), data, domainimage.TransformParams{Format: "png"}, policy)
	require.ErrorContains(t, err, "输出")
	_, err = tr.Transform(context.Background(), data, domainimage.TransformParams{Format: "webp"}, policy)
	require.ErrorContains(t, err, "输出")
}

func TestHugePNGHeaderRejectedBeforeFullDecode(t *testing.T) {
	data := bytes.Clone(fixture(t, "sample.png")[:33])
	binary.BigEndian.PutUint32(data[16:20], 100000)
	binary.BigEndian.PutUint32(data[20:24], 100000)
	binary.BigEndian.PutUint32(data[29:33], crc32.ChecksumIEEE(data[12:29]))
	policy := domainsettings.DefaultImagePolicy()
	_, err := NewTransformer(NewEncoder()).Transform(context.Background(), data, domainimage.TransformParams{}, policy)
	require.ErrorContains(t, err, "尺寸或像素")
	path := filepath.Join(t.TempDir(), "huge.png")
	require.NoError(t, os.WriteFile(path, data, 0o600))
	_, err = NewProcessor(t.TempDir(), "/uploads/", nil, NewEncoder()).Validate(path)
	require.ErrorContains(t, err, "尺寸或像素")
}

func TestAnimatedGIFPreservedAndCumulativePixelsBounded(t *testing.T) {
	palette := color.Palette{color.Black, color.White}
	frame := image.NewPaletted(image.Rect(0, 0, 10, 10), palette)
	var data bytes.Buffer
	require.NoError(t, gif.EncodeAll(&data, &gif.GIF{Image: []*image.Paletted{frame, frame}, Delay: []int{1, 1}}))
	policy := domainsettings.DefaultImagePolicy()
	tr := NewTransformer(NewEncoder())
	result, err := tr.Transform(context.Background(), data.Bytes(), domainimage.TransformParams{Width: 1, Format: "webp"}, policy)
	require.NoError(t, err)
	require.Equal(t, data.Bytes(), result.Bytes)
	require.Equal(t, "image/gif", result.MimeType)
	policy.MaxSourcePixels = 150
	_, err = tr.Transform(context.Background(), data.Bytes(), domainimage.TransformParams{}, policy)
	require.ErrorContains(t, err, "累计像素")
}

func TestEncoderAdmissionHonorsCancellationAndNewLimit(t *testing.T) {
	encoder := NewEncoder()
	release, err := encoder.acquire(context.Background(), 1)
	require.NoError(t, err)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()
	_, err = encoder.acquire(ctx, 1)
	require.ErrorIs(t, err, context.DeadlineExceeded)
	releaseSecond, err := encoder.acquire(context.Background(), 2)
	require.NoError(t, err)
	releaseSecond()
	release()
	release, err = encoder.acquire(context.Background(), 1)
	require.NoError(t, err)
	release()
}
