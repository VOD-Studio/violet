// 下载相关 helper:文件名构造 + 元数据写入。
// 这两个 helper 供 song download / playlist download 命令消费(PRD-0013)。
package song

import (
	"fmt"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/bogem/id3v2"
	"github.com/go-flac/flacpicture"
	"github.com/go-flac/flacvorbis"
	flac "github.com/go-flac/go-flac"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
)

// unsafeFilenameChars 是 Windows/macOS/Linux 文件系统都禁用的路径字符。
// 出现在艺人/歌名里会破坏落盘,必须过滤。
const unsafeFilenameChars = `/\:*?"<>|`

// sanitizeFilename 把路径不安全字符替换为下划线(保留可读,不删除避免名字粘连)。
func sanitizeFilename(s string) string {
	return strings.Map(func(r rune) rune {
		if strings.ContainsRune(unsafeFilenameChars, r) {
			return '_'
		}
		return r
	}, s)
}

// songFilename 构造单曲下载的默认文件名:{首艺人} - {歌名}.{ext}。
// 多艺人取首个(Artists[0]);过滤路径不安全字符。
// 艺人/歌名为空时用 id 替代缺失部分;两者都空用 id 兜底(避免 " - .ext")。
// 不处理冲突回退(那是命令层策略,见 PRD-0013 文件名冲突处理)。
func songFilename(s *mmpb.Song, ext string) string {
	artist := ""
	if len(s.Artists) > 0 {
		artist = s.Artists[0].Name
	}
	title := s.Name
	idStr := strconv.FormatInt(s.Id, 10)

	// 缺失部分用 id 替代;两者都缺用 id 兜底。
	switch {
	case artist == "" && title == "":
		return idStr + "." + ext
	case artist == "":
		artist = idStr
	case title == "":
		title = idStr
	}
	return sanitizeFilename(artist) + " - " + sanitizeFilename(title) + "." + ext
}

// Metadata 是要写入音频文件的元数据。
// Cover 为 nil 表示无封面(其他字段照写)。
type Metadata struct {
	Title  string
	Artist string
	Album  string
	Cover  []byte // 可为 nil
}

// writeMetadata 把 Metadata 写入 path 指向的音频文件。
// 按扩展名分派:mp3 用 bogem/id3v2,flac 用 go-flac 三件套。
// 调用方必须保证文件已落盘(本函数只读写元数据,不动音频流)。
// 写入失败返回 error,但调用方应按 PRD-0013 约定当作非阻塞警告处理。
func writeMetadata(path string, info Metadata) error {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".mp3":
		return writeMP3Metadata(path, info)
	case ".flac":
		return writeFLACMetadata(path, info)
	default:
		return fmt.Errorf("writeMetadata: 不支持的扩展名 %q(仅支持 .mp3/.flac)", ext)
	}
}

// writeMP3Metadata 用 bogem/id3v2 写 ID3v2 tag(Title/Artist/Album,可选封面)。
func writeMP3Metadata(path string, info Metadata) error {
	tag, err := id3v2.Open(path, id3v2.Options{Parse: true})
	if err != nil {
		return fmt.Errorf("打开 mp3 写元数据:%w", err)
	}
	defer tag.Close()

	tag.SetTitle(info.Title)
	tag.SetArtist(info.Artist)
	tag.SetAlbum(info.Album)

	// 封面:仅在有数据时写入。MIME 从图片头嗅探(jpg/png)。
	if len(info.Cover) > 0 {
		mime := sniffImageMIME(info.Cover)
		tag.AddAttachedPicture(id3v2.PictureFrame{
			Encoding:    id3v2.EncodingUTF8,
			MimeType:    mime,
			PictureType: id3v2.PTFrontCover,
			Description: "cover",
			Picture:     info.Cover,
		})
	}

	if err := tag.Save(); err != nil {
		return fmt.Errorf("保存 mp3 元数据:%w", err)
	}
	return nil
}

// writeFLACMetadata 用 go-flac 三件套写 vorbis comment + 封面。
// 策略:若已有 vorbis comment block 则替换;否则新建并置于 Meta 首位。
// 封面:仅在有数据时,作为独立 PICTURE block 追加(go-flac 不支持原地替换)。
func writeFLACMetadata(path string, info Metadata) error {
	f, err := flac.ParseFile(path)
	if err != nil {
		return fmt.Errorf("解析 flac 写元数据:%w", err)
	}

	// 构造新的 vorbis comment block。
	vc := flacvorbis.New()
	if info.Title != "" {
		_ = vc.Add("TITLE", info.Title)
	}
	if info.Artist != "" {
		_ = vc.Add("ARTIST", info.Artist)
	}
	if info.Album != "" {
		_ = vc.Add("ALBUM", info.Album)
	}
	newVCBlock := vc.Marshal()

	// 在已有 Meta 里找 vorbis comment block 替换;找不到则前置插入。
	// flac.VorbisComment 是 go-flac 导出的类型常量(= 4,flac 规范的 METADATA_BLOCK_VORBIS_COMMENT)。
	replaced := false
	for i, mb := range f.Meta {
		if mb.Type == flac.VorbisComment {
			f.Meta[i] = &newVCBlock
			replaced = true
			break
		}
	}
	if !replaced {
		// vorbis comment 必须在 STREAMINFO 之后、其他 block 之前(flac 规范)。
		// 插到首位之后(Meta[1] 位置,Meta[0] 通常是 STREAMINFO)。
		if len(f.Meta) > 0 {
			f.Meta = append([]*flac.MetaDataBlock{f.Meta[0], &newVCBlock}, f.Meta[1:]...)
		} else {
			f.Meta = []*flac.MetaDataBlock{&newVCBlock}
		}
	}

	// 封面:追加 PICTURE block。不去重已有封面(简化;网易云下载场景文件本就干净)。
	if len(info.Cover) > 0 {
		mime := sniffImageMIME(info.Cover)
		pic, err := flacpicture.NewFromImageData(flacpicture.PictureTypeFrontCover, "cover", info.Cover, mime)
		if err != nil {
			return fmt.Errorf("构造 flac 封面 block:%w", err)
		}
		picBlock := pic.Marshal()
		f.Meta = append(f.Meta, &picBlock)
	}

	if err := f.Save(path); err != nil {
		return fmt.Errorf("保存 flac 元数据:%w", err)
	}
	return nil
}

// sniffImageMIME 从图片字节头嗅探 MIME 类型(jpg/png 二选一,默认 jpg)。
// 网易云封面绝大多数是 jpg,默认值兜底未知格式。
func sniffImageMIME(b []byte) string {
	if len(b) >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF {
		return "image/jpeg"
	}
	if len(b) >= 8 && b[0] == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G' {
		return "image/png"
	}
	return "image/jpeg"
}
