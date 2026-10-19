package shared

import "regexp"

var slugPattern = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

// IsValidSlug 校验由单连字符分隔的小写 ASCII 字母数字词段。
func IsValidSlug(slug string) bool { return slugPattern.MatchString(slug) }
