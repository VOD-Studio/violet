package player

// mp3 头解析纯函数。流式播放时 go-mp3 拿不到总时长(非 Seeker 源 Length=-1),
// 这里从流开头探测 ID3v2 头长与首帧码率,用于:
//   - 估算总时长:totalMs ≈ (ContentLength - id3Size) * 8 / bitrate
//   - 水位换算:bytesPerMs = bitrate / 8
//   - Range seek 的字节偏移:absByte = id3Size + targetMs * bytesPerMs
//
// CBR(网易 320k 档)下估算精确;VBR 下是近似值,仅影响进度条总时长与 seek 落点。

// parseID3v2Size 返回 ID3v2 标签总长度(含 10 字节头);无标签返回 0。
// b 不足 10 字节时返回 0(等更多数据再试)。
func parseID3v2Size(b []byte) int {
	if len(b) < 10 || string(b[:3]) != "ID3" {
		return 0
	}
	// 尺寸是 4 字节 syncsafe:每字节只用低 7 位。
	size := int(b[6]&0x7f)<<21 | int(b[7]&0x7f)<<14 | int(b[8]&0x7f)<<7 | int(b[9]&0x7f)
	return 10 + size
}

// MPEG Layer III bitrate 表(kbps),索引来自帧头第 3 字节高 4 位;0/15 非法。
var (
	mpeg1Layer3Bitrate = [16]int{0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0}
	mpeg2Layer3Bitrate = [16]int{0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0}
)

// parseMP3Bitrate 从流开头(可先过 ID3v2)扫描第一个合法 Layer III 帧头,
// 返回码率 kbps;扫描窗口内找不到返回 0。
// 帧头布局:11 位同步 0xFFE + 2 位 version + 2 位 layer + ... + 4 位 bitrate 索引。
func parseMP3Bitrate(b []byte) int {
	off := parseID3v2Size(b)
	for i := off; i+3 < len(b); i++ {
		if b[i] != 0xFF || b[i+1]&0xE0 != 0xE0 {
			continue
		}
		version := (b[i+1] >> 3) & 0x03 // 3=MPEG1, 2=MPEG2, 0=MPEG2.5, 1=保留
		layer := (b[i+1] >> 1) & 0x03   // 1=Layer III
		if version == 1 || layer != 1 {
			continue
		}
		idx := (b[i+2] >> 4) & 0x0F
		if version == 3 {
			return mpeg1Layer3Bitrate[idx]
		}
		return mpeg2Layer3Bitrate[idx]
	}
	return 0
}
