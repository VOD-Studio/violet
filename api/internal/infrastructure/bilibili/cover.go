package bilibili

// PackageCoverURL 返回表情包封面 URL。
// B站返回的 package.url 为空时，退回到分组内第一个非文字表情的图片，避免封面为空。
func PackageCoverURL(pkg Package) string {
	if pkg.URL != "" {
		return pkg.URL
	}
	for _, e := range pkg.Emote {
		if e.URL != "" && e.URL != e.Text {
			return e.URL
		}
	}
	return ""
}
