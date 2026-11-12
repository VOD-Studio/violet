package shared

// ParseCommentSort 解析顶层评论排序；空值为 latest，回复的 asc/desc 不使用此规则。
func ParseCommentSort(value string) (string, error) {
	switch value {
	case "", "latest":
		return "latest", nil
	case "hot":
		return "hot", nil
	default:
		return "", BadRequest("评论排序必须为 latest 或 hot")
	}
}
