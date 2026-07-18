package songdl

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"os"
	"path/filepath"
	"testing"

	"github.com/bogem/id3v2"
	dhowden "github.com/dhowden/tag"
	"github.com/go-flac/flacvorbis"
	flac "github.com/go-flac/go-flac"
	"github.com/stretchr/testify/require"
)

// WriteMetadata 测试(从 internal/cli/song/metadata_test.go 迁入,逻辑不变,
// 仅 songFilename→SongFilename、writeMetadata→WriteMetadata、Metadata 已导出)。

// writeMP3Fixture 在临时目录生成一个最小合法 mp3(纯 ID3v2,无音频帧),
// 返回文件路径。bogem/dhowden 都能正确读写纯 ID3(探测验证过,74 字节起)。
func writeMP3Fixture(t *testing.T) string {
	t.Helper()
	tag := id3v2.NewEmptyTag()
	var buf bytes.Buffer
	if _, err := tag.WriteTo(&buf); err != nil {
		t.Fatalf("写 mp3 fixture 失败:%v", err)
	}
	path := filepath.Join(t.TempDir(), "test.mp3")
	if err := os.WriteFile(path, buf.Bytes(), 0o644); err != nil {
		t.Fatalf("落盘 mp3 fixture 失败:%v", err)
	}
	return path
}

// writeFLACFixture 在临时目录生成最小合法 flac:STREAMINFO(34B 占位)+ 空 vorbis comment +
// 一个最小 flac frame(sync code + 凑数字节)。
func writeFLACFixture(t *testing.T) string {
	t.Helper()
	streamInfo := flac.MetaDataBlock{
		Type: flac.StreamInfo,
		Data: make([]byte, 34),
	}
	vc := flacvorbis.New()
	vcBlock := vc.Marshal()
	fakeFrames := []byte{0xFF, 0xF8, 0x00, 0x00}
	f := &flac.File{Meta: []*flac.MetaDataBlock{&streamInfo, &vcBlock}, Frames: fakeFrames}
	path := filepath.Join(t.TempDir(), "test.flac")
	if err := os.WriteFile(path, f.Marshal(), 0o644); err != nil {
		t.Fatalf("落盘 flac fixture 失败:%v", err)
	}
	return path
}

func TestWriteMetadata_MP3(t *testing.T) {
	t.Parallel()
	path := writeMP3Fixture(t)
	info := Metadata{Title: "海阔天空", Artist: "Beyond", Album: "海阔天空"}
	require.NoError(t, WriteMetadata(path, info))

	f, err := os.Open(path)
	require.NoError(t, err)
	defer f.Close()
	m, err := dhowden.ReadFrom(f)
	require.NoError(t, err)
	require.Equal(t, "海阔天空", m.Title())
	require.Equal(t, "Beyond", m.Artist())
	require.Equal(t, "海阔天空", m.Album())
}

func TestWriteMetadata_FLAC(t *testing.T) {
	t.Parallel()
	path := writeFLACFixture(t)
	info := Metadata{Title: "浮夸", Artist: "陈奕迅", Album: "U87"}
	require.NoError(t, WriteMetadata(path, info))

	f, err := os.Open(path)
	require.NoError(t, err)
	defer f.Close()
	m, err := dhowden.ReadFrom(f)
	require.NoError(t, err)
	require.Equal(t, "浮夸", m.Title())
	require.Equal(t, "陈奕迅", m.Artist())
	require.Equal(t, "U87", m.Album())
}

// makeJPEGFixture 程序生成一个最小合法 jpg(1x1 红)用于测试封面写入。
func makeJPEGFixture(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 1, 1))
	img.Set(0, 0, color.RGBA{R: 255, G: 0, B: 0, A: 255})
	var buf bytes.Buffer
	require.NoError(t, jpeg.Encode(&buf, img, nil))
	return buf.Bytes()
}

func TestWriteMetadata_WithCover(t *testing.T) {
	t.Parallel()
	cover := makeJPEGFixture(t)

	t.Run("mp3_带封面", func(t *testing.T) {
		t.Parallel()
		path := writeMP3Fixture(t)
		info := Metadata{Title: "T", Artist: "A", Album: "Al", Cover: cover}
		require.NoError(t, WriteMetadata(path, info))

		f, _ := os.Open(path)
		defer f.Close()
		m, err := dhowden.ReadFrom(f)
		require.NoError(t, err)
		require.NotNil(t, m.Picture(), "mp3 封面应写入")
		require.Equal(t, "image/jpeg", m.Picture().MIMEType)
	})

	t.Run("flac_带封面", func(t *testing.T) {
		t.Parallel()
		path := writeFLACFixture(t)
		info := Metadata{Title: "T", Artist: "A", Album: "Al", Cover: cover}
		require.NoError(t, WriteMetadata(path, info))

		f, _ := os.Open(path)
		defer f.Close()
		m, err := dhowden.ReadFrom(f)
		require.NoError(t, err)
		require.NotNil(t, m.Picture(), "flac 封面应写入")
	})
}

func TestWriteMetadata_CoverNil(t *testing.T) {
	t.Parallel()
	t.Run("mp3_无封面照写文本", func(t *testing.T) {
		t.Parallel()
		path := writeMP3Fixture(t)
		info := Metadata{Title: "无封面歌", Artist: "无名", Album: "无专辑"}
		require.NoError(t, WriteMetadata(path, info))

		f, _ := os.Open(path)
		defer f.Close()
		m, err := dhowden.ReadFrom(f)
		require.NoError(t, err)
		require.Equal(t, "无封面歌", m.Title())
		require.Nil(t, m.Picture(), "cover=nil 时不写入封面")
	})

	t.Run("flac_无封面照写文本", func(t *testing.T) {
		t.Parallel()
		path := writeFLACFixture(t)
		info := Metadata{Title: "无封面歌", Artist: "无名", Album: "无专辑"}
		require.NoError(t, WriteMetadata(path, info))

		f, _ := os.Open(path)
		defer f.Close()
		m, err := dhowden.ReadFrom(f)
		require.NoError(t, err)
		require.Equal(t, "无封面歌", m.Title())
		require.Nil(t, m.Picture())
	})
}

func TestWriteMetadata_UnsupportedExt(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "test.wav")
	require.NoError(t, os.WriteFile(path, []byte("fake"), 0o644))

	err := WriteMetadata(path, Metadata{Title: "T"})
	require.Error(t, err)
	require.Contains(t, err.Error(), "不支持")
}
