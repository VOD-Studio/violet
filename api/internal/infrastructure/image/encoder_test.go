package image

import (
	"bytes"
	"context"
	"encoding/binary"
	"image"
	"image/color"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	domainimage "blog-api/internal/domain/image"
	domainsettings "blog-api/internal/domain/settings"
)

func webPChunk(kind string, data []byte) []byte {
	chunk := make([]byte, 8, 8+len(data)+1)
	copy(chunk, kind)
	binary.LittleEndian.PutUint32(chunk[4:], uint32(len(data)))
	chunk = append(chunk, data...)
	if len(data)%2 != 0 {
		chunk = append(chunk, 0)
	}
	return chunk
}

func TestAnimatedWebPValidatesFramesAndPreservesBytes(t *testing.T) {
	policy := domainsettings.DefaultImagePolicy()
	img := image.NewNRGBA(image.Rect(0, 0, 16, 16))
	for y := range 16 {
		for x := range 16 {
			img.SetNRGBA(x, y, color.NRGBA{R: 127, G: 30, B: 9, A: 128})
		}
	}
	static, err := encodeWebP(context.Background(), img, policy)
	require.NoError(t, err)
	var payload []byte
	for pos := 12; pos < len(static); {
		size := int(binary.LittleEndian.Uint32(static[pos+4 : pos+8]))
		next := pos + 8 + size + (size & 1)
		kind := string(static[pos : pos+4])
		if kind == "VP8 " || kind == "VP8L" || kind == "ALPH" {
			payload = append(payload, static[pos:next]...)
		}
		pos = next
	}
	require.NotEmpty(t, payload)
	vp8x := make([]byte, 10)
	vp8x[0], vp8x[4], vp8x[7] = 18, 15, 15
	frame := make([]byte, 16, 16+len(payload))
	frame[6], frame[9], frame[12] = 15, 15, 100
	frame = append(frame, payload...)
	data := []byte("RIFF\x00\x00\x00\x00WEBP")
	data = append(data, webPChunk("VP8X", vp8x)...)
	data = append(data, webPChunk("ANIM", make([]byte, 6))...)
	data = append(data, webPChunk("ANMF", frame)...)
	data = append(data, webPChunk("ANMF", frame)...)
	binary.LittleEndian.PutUint32(data[4:8], uint32(len(data)-8))
	tr := NewTransformer(NewEncoder())
	result, err := tr.Transform(context.Background(), data, domainimage.TransformParams{Width: 1, Format: "jpeg"}, policy)
	require.NoError(t, err)
	require.Equal(t, "image/webp", result.MimeType)
	require.Equal(t, data, result.Bytes)
	policy.MaxSourcePixels = 300
	_, err = tr.Transform(context.Background(), data, domainimage.TransformParams{}, policy)
	require.ErrorContains(t, err, "累计像素")
	policy = domainsettings.DefaultImagePolicy()
	broken := bytes.Clone(data)
	position := bytes.Index(broken, []byte("VP8L"))
	require.Positive(t, position)
	broken[position+8] = 0
	_, err = tr.Transform(context.Background(), broken, domainimage.TransformParams{}, policy)
	require.Error(t, err)
}

func TestEncoderTerminatesProcessOnDeadline(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, "cwebp"), []byte("#!/bin/sh\nexec sleep 30\n"), 0o700))
	t.Setenv("PATH", dir+string(os.PathListSeparator)+os.Getenv("PATH"))
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	started := time.Now()
	_, err := encodeWebP(ctx, image.NewRGBA(image.Rect(0, 0, 2, 2)), domainsettings.DefaultImagePolicy())
	require.ErrorIs(t, err, context.DeadlineExceeded)
	require.Less(t, time.Since(started), 3*time.Second)
}

func TestValidatePolicyRejectsMissingOrWrongEncoder(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("PATH", dir)
	require.Error(t, ValidatePolicy(domainsettings.DefaultImagePolicy()))
	require.NoError(t, os.WriteFile(filepath.Join(dir, "cwebp"), []byte("#!/bin/sh\nprintf '0.0.0\\n'\n"), 0o700))
	require.ErrorContains(t, ValidatePolicy(domainsettings.DefaultImagePolicy()), "版本")
}

func TestValidatePolicyVersionOutputContract(t *testing.T) {
	for _, test := range []struct {
		name   string
		output string
		valid  bool
	}{
		{name: "仅主版本", output: "1.6.0\n", valid: true},
		{name: "附带编码库版本", output: "1.6.0\nlibsharpyuv: 0.4.2\n", valid: true},
		{name: "前置空行", output: "\n  \n1.6.0\nlibsharpyuv: 0.4.2\n", valid: true},
		{name: "主版本错误", output: "1.5.0\nlibsharpyuv: 0.4.2\n"},
		{name: "后续行不能冒充主版本", output: "0.0.0\n1.6.0\n"},
		{name: "空输出"},
	} {
		t.Run(test.name, func(t *testing.T) {
			err := validateEncoderVersion([]byte(test.output))
			if test.valid {
				require.NoError(t, err)
			} else {
				require.ErrorContains(t, err, "版本")
			}
		})
	}
}

func TestValidatePolicyRejectsVersionOnlyEncoder(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("PATH", dir)
	script := "#!/bin/sh\nif [ \"$1\" = '-version' ]; then printf '1.6.0\\nlibsharpyuv: 0.4.2\\n'; else printf 'not a webp'; fi\n"
	require.NoError(t, os.WriteFile(filepath.Join(dir, "cwebp"), []byte(script), 0o700))
	require.ErrorContains(t, ValidatePolicy(domainsettings.DefaultImagePolicy()), "有效的 WebP")
}
