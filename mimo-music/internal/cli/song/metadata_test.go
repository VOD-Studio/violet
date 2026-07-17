// Package song 的下载相关 helper 测试(文件名构造 + 元数据写入)。
package song

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

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
)

// TestSongFilename_Normal 正常情况:首艺人 - 歌名.ext。
// 多艺人时只取首个(Artists[0])。
func TestSongFilename_Normal(t *testing.T) {
	t.Parallel()

	s := &mmpb.Song{
		Id:   347230,
		Name: "海阔天空",
		Artists: []*mmpb.Artist{
			{Name: "Beyond"},
			{Name: "黄家驹"},
		},
	}
	got := songFilename(s, "mp3")
	require.Equal(t, "Beyond - 海阔天空.mp3", got)
}

// TestSongFilename_SanitizePathChars 艺人/歌名含路径不安全字符时必须过滤。
// Windows/macOS/Linux 文件系统禁用:/ \ : * ? " < > |
// 过滤策略:替换为下划线(保留可读性,不直接删除避免名字粘连)。
func TestSongFilename_SanitizePathChars(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		artist string
		song   string
		want   string
	}{
		{"斜杠", "AC/DC", "Back in Black", "AC_DC - Back in Black.mp3"},
		{"反斜杠", "Jay\\Chou", "晴天", "Jay_Chou - 晴天.mp3"},
		{"冒号", "A:B", "C:D", "A_B - C_D.flac"},
		{"星号问号", "X*Y?", "Z", "X_Y_ - Z.mp3"},
		{"引号尖括号", `a"b<c>`, "song", `a_b_c_ - song.mp3`},
		{"竖线", "p|q", "r", "p_q - r.mp3"},
		{"组合", `a/b\c:d*e?f"g<h>i|j`, "t", `a_b_c_d_e_f_g_h_i_j - t.mp3`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			s := &mmpb.Song{Id: 1, Name: tt.song, Artists: []*mmpb.Artist{{Name: tt.artist}}}
			ext := "mp3"
			if tt.want[len(tt.want)-4:] == "flac" {
				ext = "flac"
			}
			got := songFilename(s, ext)
			require.Equal(t, tt.want, got)
		})
	}
}

// TestSongFilename_EmptyFallback 艺人/歌名为空时回退到歌曲 id。
// 避免产出 " - .mp3" 或 "artist - .mp3" 这种无意义文件名。
// 回退规则:id 替代缺失部分,严格保持「艺人 - 歌名」位置(id 占谁的位置就站谁那边)。
// 两者都缺时用 id 单独兜底(不再带 " - ")。
func TestSongFilename_EmptyFallback(t *testing.T) {
	t.Parallel()

	// 「歌名空,艺人有」→ id 占歌名位
	t.Run("歌名空_艺人有", func(t *testing.T) {
		t.Parallel()
		s := &mmpb.Song{Id: 347230, Name: "", Artists: []*mmpb.Artist{{Name: "Beyond"}}}
		require.Equal(t, "Beyond - 347230.mp3", songFilename(s, "mp3"))
	})

	// 「艺人空字符串,歌名有」→ id 占艺人位
	t.Run("艺人空字符串_歌名有", func(t *testing.T) {
		t.Parallel()
		s := &mmpb.Song{Id: 347230, Name: "海阔天空", Artists: []*mmpb.Artist{{Name: ""}}}
		require.Equal(t, "347230 - 海阔天空.mp3", songFilename(s, "mp3"))
	})

	// 「Artists 切片为 nil」(而非空字符串),同样回退 → id 占艺人位
	t.Run("Artists为nil", func(t *testing.T) {
		t.Parallel()
		s := &mmpb.Song{Id: 347230, Name: "海阔天空"} // Artists 未设
		require.Equal(t, "347230 - 海阔天空.mp3", songFilename(s, "mp3"))
	})

	// 两者都空:用 id 单独兜底,不产出 " - .mp3"
	t.Run("全空用id兜底", func(t *testing.T) {
		t.Parallel()
		s := &mmpb.Song{Id: 347230, Name: "", Artists: []*mmpb.Artist{{Name: ""}}}
		require.Equal(t, "347230.mp3", songFilename(s, "mp3"))
	})
}

// writeMP3Fixture 在临时目录生成一个最小合法 mp3(纯 ID3v2,无音频帧),
// 返回文件路径。bogem/dhowden 都能正确读写纯 ID3(探测验证过,74 字节起)。
// 用完调用方 os.Remove(path) 清理。
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
// 一个最小 flac frame(sync code + 凑数字节)。go-flac 的 ParseFile 会读音频帧
// (readFLACStream 要求首字节 0xFF + 第二字节 >>2 == 0x3E),fixture 必须含 sync code
// 才能被 ParseFile 读回。真实网易云 flac 自带完整帧,这里只占位。
func writeFLACFixture(t *testing.T) string {
	t.Helper()
	streamInfo := flac.MetaDataBlock{
		Type: flac.StreamInfo,
		Data: make([]byte, 34),
	}
	vc := flacvorbis.New()
	vcBlock := vc.Marshal()
	// 最小 flac frame:sync code 0xFFF8(0xFF, 0xF8; 0xF8>>2=0x3E ✓)+ 凑数字节。
	fakeFrames := []byte{0xFF, 0xF8, 0x00, 0x00}
	f := &flac.File{Meta: []*flac.MetaDataBlock{&streamInfo, &vcBlock}, Frames: fakeFrames}
	path := filepath.Join(t.TempDir(), "test.flac")
	if err := os.WriteFile(path, f.Marshal(), 0o644); err != nil {
		t.Fatalf("落盘 flac fixture 失败:%v", err)
	}
	return path
}

// TestWriteMetadata_MP3 mp3 写入:调用 writeMetadata 后用 dhowden/tag 重读,
// 验证 Title/Artist/Album 都正确写入。
func TestWriteMetadata_MP3(t *testing.T) {
	t.Parallel()

	path := writeMP3Fixture(t)

	info := Metadata{
		Title:  "海阔天空",
		Artist: "Beyond",
		Album:  "海阔天空",
	}
	require.NoError(t, writeMetadata(path, info))

	// 重读验证
	f, err := os.Open(path)
	require.NoError(t, err)
	defer f.Close()
	m, err := dhowden.ReadFrom(f)
	require.NoError(t, err)
	require.Equal(t, "海阔天空", m.Title())
	require.Equal(t, "Beyond", m.Artist())
	require.Equal(t, "海阔天空", m.Album())
}

// TestWriteMetadata_FLAC flac 写入:调用 writeMetadata 后用 dhowden/tag 重读,
// 验证 Title/Artist/Album 正确写入 flac vorbis comment。
func TestWriteMetadata_FLAC(t *testing.T) {
	t.Parallel()

	path := writeFLACFixture(t)

	info := Metadata{
		Title:  "浮夸",
		Artist: "陈奕迅",
		Album:  "U87",
	}
	require.NoError(t, writeMetadata(path, info))

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
// flacpicture.NewFromImageData 调 jpeg.Decode 验证,要求真实可解码。
func makeJPEGFixture(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 1, 1))
	img.Set(0, 0, color.RGBA{R: 255, G: 0, B: 0, A: 255})
	var buf bytes.Buffer
	require.NoError(t, jpeg.Encode(&buf, img, nil))
	return buf.Bytes()
}

// TestWriteMetadata_WithCover 封面写入:mp3 + flac 都测。
// 用程序生成的真实可解码 jpg(1x1)做封面,写入后用 dhowden 重读验证 Picture 非空。
func TestWriteMetadata_WithCover(t *testing.T) {
	t.Parallel()

	cover := makeJPEGFixture(t)

	t.Run("mp3_带封面", func(t *testing.T) {
		t.Parallel()
		path := writeMP3Fixture(t)
		info := Metadata{Title: "T", Artist: "A", Album: "Al", Cover: cover}
		require.NoError(t, writeMetadata(path, info))

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
		require.NoError(t, writeMetadata(path, info))

		f, _ := os.Open(path)
		defer f.Close()
		m, err := dhowden.ReadFrom(f)
		require.NoError(t, err)
		require.NotNil(t, m.Picture(), "flac 封面应写入")
	})
}

// TestWriteMetadata_CoverNil cover 为 nil 时:跳过封面,其他元数据照写。
func TestWriteMetadata_CoverNil(t *testing.T) {
	t.Parallel()

	t.Run("mp3_无封面照写文本", func(t *testing.T) {
		t.Parallel()
		path := writeMP3Fixture(t)
		info := Metadata{Title: "无封面歌", Artist: "无名", Album: "无专辑"} // Cover nil
		require.NoError(t, writeMetadata(path, info))

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
		require.NoError(t, writeMetadata(path, info))

		f, _ := os.Open(path)
		defer f.Close()
		m, err := dhowden.ReadFrom(f)
		require.NoError(t, err)
		require.Equal(t, "无封面歌", m.Title())
		require.Nil(t, m.Picture())
	})
}

// TestWriteMetadata_UnsupportedExt 未知扩展名 → 明确错误。
func TestWriteMetadata_UnsupportedExt(t *testing.T) {
	t.Parallel()

	path := filepath.Join(t.TempDir(), "test.wav")
	require.NoError(t, os.WriteFile(path, []byte("fake"), 0o644))

	err := writeMetadata(path, Metadata{Title: "T"})
	require.Error(t, err)
	require.Contains(t, err.Error(), "不支持")
}
