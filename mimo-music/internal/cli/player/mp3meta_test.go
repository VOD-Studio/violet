package player

import (
	"bytes"
	"testing"
)

func TestParseID3v2Size(t *testing.T) {
	tests := []struct {
		name string
		b    []byte
		want int
	}{
		{"无标签", []byte("not an id3 header at all"), 0},
		{"太短", []byte("ID3"), 0},
		{"空标签", []byte{'I', 'D', '3', 4, 0, 0, 0, 0, 0, 0}, 10},
		// syncsafe: 0x21 → 33,总长 43。
		{"小标签", []byte{'I', 'D', '3', 4, 0, 0, 0, 0, 0, 0x21}, 43},
		// syncsafe 多字节: b8=4 → 4<<7=512,总长 522。
		{"大标签", []byte{'I', 'D', '3', 4, 0, 0, 0, 0, 4, 0}, 522},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := parseID3v2Size(tt.b); got != tt.want {
				t.Errorf("parseID3v2Size = %d, want %d", got, tt.want)
			}
		})
	}
}

// mp3Frame 构造一个最小 MPEG Layer III 帧头前缀。
// version: 3=MPEG1, 2=MPEG2;bitrateIdx 查表。
func mp3Frame(version, bitrateIdx byte) []byte {
	// byte1: 同步低 3 位 + version(2) + layer(2, 固定 01=LayerIII) + 1
	b1 := byte(0xE0) | version<<3 | 0x01<<1 | 1
	b2 := bitrateIdx << 4
	return []byte{0xFF, b1, b2, 0x00}
}

func TestParseMP3Bitrate(t *testing.T) {
	tests := []struct {
		name string
		b    []byte
		want int
	}{
		{"MPEG1 128k", mp3Frame(3, 9), 128},
		{"MPEG1 320k", mp3Frame(3, 14), 320},
		{"MPEG1 192k", mp3Frame(3, 11), 192},
		{"MPEG2 80k", mp3Frame(2, 9), 80},
		{"无帧同步", []byte("plain garbage, no frame here"), 0},
		{"空输入", nil, 0},
		{
			"跳过 ID3v2 标签",
			append([]byte{'I', 'D', '3', 4, 0, 0, 0, 0, 0, 0x05, 'x', 'x', 'x', 'x', 'x'}, mp3Frame(3, 14)...),
			320,
		},
		{
			"帧头前有垃圾字节",
			append([]byte{0x00, 0x01, 0x02}, mp3Frame(3, 9)...),
			128,
		},
		{
			"保留 version 跳过",
			// version=1(保留)不合法,继续扫描到后面的真帧。
			append([]byte{0xFF, byte(0xE0) | 1<<3 | 0x03, 0x90, 0x00}, mp3Frame(3, 9)...),
			128,
		},
		{
			"非 Layer III 跳过",
			// layer=2(Layer II)不合法。
			append([]byte{0xFF, byte(0xE0) | 3<<3 | 0x02<<1 | 1, 0x90, 0x00}, mp3Frame(3, 9)...),
			128,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := parseMP3Bitrate(tt.b); got != tt.want {
				t.Errorf("parseMP3Bitrate = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestParseMP3BitrateRealWorldPrefix(t *testing.T) {
	// 模拟真实流:ID3v2(43 字节) + 填充 + 320k 帧。
	buf := bytes.Repeat([]byte{0}, 43)
	copy(buf, []byte{'I', 'D', '3', 4, 0, 0, 0, 0, 0, 0x21})
	buf = append(buf, mp3Frame(3, 14)...)
	if got := parseMP3Bitrate(buf); got != 320 {
		t.Fatalf("got %d, want 320", got)
	}
	if got := parseID3v2Size(buf); got != 43 {
		t.Fatalf("id3 size = %d, want 43", got)
	}
}
