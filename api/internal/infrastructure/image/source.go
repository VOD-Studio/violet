package image

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"image"
	"image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"os"

	_ "golang.org/x/image/webp"

	domainsettings "blog-api/internal/domain/settings"
)

type sourceImage struct {
	image         image.Image
	mime          string
	width, height int
	animated      bool
}

func opaque(img image.Image) bool {
	value, ok := img.(interface{ Opaque() bool })
	return ok && value.Opaque()
}

func readSource(path string, policy domainsettings.ImagePolicy) ([]byte, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return nil, err
	}
	if !info.Mode().IsRegular() || info.Size() > policy.MaxInputBytes {
		return nil, fmt.Errorf("图片超过输入字节限制")
	}
	data, err := io.ReadAll(io.LimitReader(file, policy.MaxInputBytes+1))
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > policy.MaxInputBytes {
		return nil, fmt.Errorf("图片超过输入字节限制")
	}
	return data, nil
}

func checkDimensions(width, height int, policy domainsettings.ImagePolicy) error {
	if width <= 0 || height <= 0 || width > policy.MaxSourceDimension || height > policy.MaxSourceDimension || int64(width) > policy.MaxSourcePixels/int64(height) {
		return fmt.Errorf("图片尺寸或像素数超过限制")
	}
	return nil
}

func decodeSource(data []byte, policy domainsettings.ImagePolicy) (sourceImage, error) {
	var result sourceImage
	if int64(len(data)) > policy.MaxInputBytes {
		return result, fmt.Errorf("图片超过输入字节限制")
	}
	result.mime = http.DetectContentType(data)
	if result.mime == "image/webp" {
		if err := validateWebPContainer(data); err != nil {
			return result, err
		}
		if len(data) >= 30 && string(data[12:16]) == "VP8X" && data[20]&2 != 0 {
			result.width, result.height = 1+uint24(data[24:27]), 1+uint24(data[27:30])
			if err := checkDimensions(result.width, result.height, policy); err != nil {
				return result, err
			}
			if err := validateWebPFrames(data, result.width, result.height, policy); err != nil {
				return result, err
			}
			result.animated = true
			return result, nil
		}
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return result, fmt.Errorf("图片头部损坏: %w", err)
	}
	result.width, result.height = config.Width, config.Height
	if err := checkDimensions(config.Width, config.Height, policy); err != nil {
		return result, err
	}
	if format == "gif" {
		frames, err := checkGIFFrames(data, policy)
		if err != nil {
			return result, err
		}
		decoded, err := gif.DecodeAll(bytes.NewReader(data))
		if err != nil {
			return result, fmt.Errorf("GIF 内容损坏: %w", err)
		}
		result.animated = frames > 1
		result.image = decoded.Image[0]
		return result, nil
	}
	if format == "png" {
		for pos := 8; pos+12 <= len(data); {
			size := int64(binary.BigEndian.Uint32(data[pos : pos+4]))
			if size > int64(len(data)-pos-12) {
				return result, fmt.Errorf("PNG 数据块损坏")
			}
			if string(data[pos+4:pos+8]) == "acTL" {
				return result, fmt.Errorf("暂不支持动画 PNG，请上传 GIF 或动画 WebP")
			}
			pos += int(size) + 12
		}
	}
	result.image, _, err = image.Decode(bytes.NewReader(data))
	if err != nil {
		return result, fmt.Errorf("图片内容损坏: %w", err)
	}
	return result, nil
}

func uint24(data []byte) int { return int(data[0]) | int(data[1])<<8 | int(data[2])<<16 }

func validateWebPContainer(data []byte) error {
	if len(data) < 20 || string(data[:4]) != "RIFF" || string(data[8:12]) != "WEBP" || uint64(binary.LittleEndian.Uint32(data[4:8]))+8 != uint64(len(data)) {
		return fmt.Errorf("WebP 容器损坏")
	}
	for pos := 12; pos < len(data); {
		if len(data)-pos < 8 {
			return fmt.Errorf("WebP 数据块损坏")
		}
		size := uint64(binary.LittleEndian.Uint32(data[pos+4 : pos+8]))
		next := uint64(pos) + 8 + size + (size & 1)
		if next > uint64(len(data)) {
			return fmt.Errorf("WebP 数据块越界")
		}
		pos = int(next)
	}
	return nil
}

func validateWebPFrames(data []byte, canvasW, canvasH int, policy domainsettings.ImagePolicy) error {
	var pixels int64
	frames, animationHeaders := 0, 0
	for pos := 12; pos < len(data); {
		size := int(binary.LittleEndian.Uint32(data[pos+4 : pos+8]))
		chunk := data[pos+8 : pos+8+size]
		switch string(data[pos : pos+4]) {
		case "ANIM":
			if size != 6 {
				return fmt.Errorf("WebP 动画头损坏")
			}
			animationHeaders++
		case "ANMF":
			if size < 24 {
				return fmt.Errorf("WebP 动画帧损坏")
			}
			w, h := uint24(chunk[6:9])+1, uint24(chunk[9:12])+1
			if err := checkDimensions(w, h, policy); err != nil {
				return err
			}
			if uint24(chunk[:3])*2+w > canvasW || uint24(chunk[3:6])*2+h > canvasH {
				return fmt.Errorf("WebP 动画帧超出画布")
			}
			pixels += int64(w) * int64(h)
			if pixels > policy.MaxSourcePixels {
				return fmt.Errorf("动画累计像素数超过限制")
			}
			// 为独立帧构造静态容器，让解码器验证压缩数据而非仅信任 RIFF 标记。
			frame := make([]byte, 30, 30+len(chunk)-16)
			copy(frame, "RIFF")
			copy(frame[8:], "WEBPVP8X")
			binary.LittleEndian.PutUint32(frame[16:20], 10)
			frame[20] = 16
			for i := range 3 {
				frame[24+i] = byte((w - 1) >> (8 * i))
				frame[27+i] = byte((h - 1) >> (8 * i))
			}
			frame = append(frame, chunk[16:]...)
			binary.LittleEndian.PutUint32(frame[4:8], uint32(len(frame)-8))
			if err := validateWebPContainer(frame); err != nil {
				return err
			}
			config, _, err := image.DecodeConfig(bytes.NewReader(frame))
			if err != nil || config.Width != w || config.Height != h {
				return fmt.Errorf("WebP 动画帧尺寸不一致")
			}
			if _, _, err := image.Decode(bytes.NewReader(frame)); err != nil {
				return fmt.Errorf("WebP 动画帧损坏: %w", err)
			}
			frames++
		}
		pos += 8 + size + (size & 1)
	}
	if frames == 0 || animationHeaders != 1 {
		return fmt.Errorf("WebP 动画缺少帧或动画头")
	}
	return nil
}

// checkGIFFrames 在 DecodeAll 分配帧之前约束累计像素和帧矩形。
func checkGIFFrames(data []byte, policy domainsettings.ImagePolicy) (int, error) {
	if len(data) < 13 {
		return 0, fmt.Errorf("GIF 头部损坏")
	}
	pos := 13
	if data[10]&128 != 0 {
		pos += 3 << (uint(data[10]&7) + 1)
	}
	frames := 0
	var pixels int64
	skipBlocks := func() bool {
		for pos < len(data) {
			n := int(data[pos])
			pos++
			if n == 0 {
				return true
			}
			if n > len(data)-pos {
				return false
			}
			pos += n
		}
		return false
	}
	for pos < len(data) {
		kind := data[pos]
		pos++
		switch kind {
		case 0x3b:
			if frames == 0 {
				return 0, fmt.Errorf("GIF 缺少图像帧")
			}
			return frames, nil
		case 0x21:
			if pos >= len(data) {
				return 0, fmt.Errorf("GIF 扩展损坏")
			}
			pos++
			if !skipBlocks() {
				return 0, fmt.Errorf("GIF 扩展损坏")
			}
		case 0x2c:
			if len(data)-pos < 9 {
				return 0, fmt.Errorf("GIF 帧损坏")
			}
			w, h := int(binary.LittleEndian.Uint16(data[pos+4:pos+6])), int(binary.LittleEndian.Uint16(data[pos+6:pos+8]))
			if err := checkDimensions(w, h, policy); err != nil {
				return 0, err
			}
			x, y := int(binary.LittleEndian.Uint16(data[pos:pos+2])), int(binary.LittleEndian.Uint16(data[pos+2:pos+4]))
			if x+w > int(binary.LittleEndian.Uint16(data[6:8])) || y+h > int(binary.LittleEndian.Uint16(data[8:10])) {
				return 0, fmt.Errorf("GIF 帧超出画布")
			}
			pixels += int64(w) * int64(h)
			if pixels > policy.MaxSourcePixels {
				return 0, fmt.Errorf("动画累计像素数超过限制")
			}
			flags := data[pos+8]
			pos += 9
			if flags&128 != 0 {
				pos += 3 << (uint(flags&7) + 1)
			}
			if pos >= len(data) {
				return 0, fmt.Errorf("GIF 帧数据缺失")
			}
			pos++
			if !skipBlocks() {
				return 0, fmt.Errorf("GIF 帧数据损坏")
			}
			frames++
		default:
			return 0, fmt.Errorf("GIF 数据块无效")
		}
	}
	return 0, fmt.Errorf("GIF 未正常结束")
}
