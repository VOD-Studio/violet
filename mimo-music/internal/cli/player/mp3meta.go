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
	// 读到 b[i+2] 为止,故边界是 i+2 < len。
	for i := off; i+2 < len(b); i++ {
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

// findFrameSync 在 b 中从 from 起扫描第一个合法 Layer III 帧头的位置,找不到返回 -1。
//
// 用途:seek 的估算字节落点(Range 重建 / 内存切片)几乎从不落在帧边界,
// 而 go-mp3 的帧头扫描只校验同步位不校验 Layer——音频数据里的伪同步
// (0xFF Ex + layer≠3)会让 NewDecoder 直接报「only layer3」错。
// 双帧验证(下一帧头恰好出现在 p+frameSize)把伪同步概率压到可忽略。
func findFrameSync(b []byte, from int) int {
	for i := max(from, 0); i+3 < len(b); i++ {
		if b[i] != 0xFF || b[i+1]&0xE0 != 0xE0 {
			continue
		}
		size := validFrameSize(b[i], b[i+1], b[i+2])
		if size <= 0 {
			continue
		}
		j := i + size
		switch {
		case j+1 < len(b) && b[j] == 0xFF && b[j+1]&0xE0 == 0xE0:
			return i // 双帧验证通过
		case j >= len(b):
			return i // 尾帧(快照末端没有下一帧可验)
		}
	}
	return -1
}

// validFrameSize 校验 3 字节帧头(version/layer/bitrate/采样率索引全合法)
// 并返回帧长(含 padding);不合法返回 0。
func validFrameSize(b1, b2, b3 byte) int {
	_ = b1
	version := (b2 >> 3) & 0x03 // 3=MPEG1, 2=MPEG2, 0=MPEG2.5, 1=保留
	layer := (b2 >> 1) & 0x03   // 1=Layer III
	if version == 1 || layer != 1 {
		return 0
	}
	idx := (b3 >> 4) & 0x0F
	srIdx := (b3 >> 2) & 0x03
	if srIdx == 3 {
		return 0
	}
	var br int
	if version == 3 {
		br = mpeg1Layer3Bitrate[idx]
	} else {
		br = mpeg2Layer3Bitrate[idx]
	}
	sr := sampleRateOf(version, srIdx)
	if br == 0 || sr == 0 {
		return 0
	}
	coef := 144 // MPEG1 Layer III: 144 * bitrate / sampleRate
	if version != 3 {
		coef = 72 // MPEG2/2.5 每帧样本数减半
	}
	return coef*br*1000/sr + int((b3>>1)&0x01)
}

// sampleRateOf 帧头采样率索引 → Hz(version 决定基频挡位)。
func sampleRateOf(version, idx byte) int {
	base := [3]int{44100, 48000, 32000}[idx]
	switch version {
	case 3:
		return base
	case 2:
		return base / 2
	case 0:
		return base / 4
	}
	return 0
}
