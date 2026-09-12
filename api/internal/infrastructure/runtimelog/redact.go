package runtimelog

import (
	"regexp"
	"strings"
	"unicode/utf8"
)

var (
	credentialLine  = regexp.MustCompile(`(?im)\b(?:cookie|set-cookie|authorization|proxy-authorization)\s*[:=]\s*[^\r\n]+`)
	credentialValue = regexp.MustCompile(`(?i)(?:\b(?:password|passwd|secret|token|otp|api(?:[_ -]?key)|session[_-]?id|(?:client|access|refresh)[_-]?(?:secret|token)|csrf[_-]?token|verification[_-]?code|code)\b|密码|口令|验证码|令牌|密钥)\s*(?:[:=：]\s*|\s+)(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s,;&]+)`)
	connectionUser  = regexp.MustCompile(`([a-zA-Z][a-zA-Z0-9+.-]*://)[^\s/@]+@`)
	sqlWords        = regexp.MustCompile(`(?i)\b(?:select|insert|update|delete|merge|alter|create|drop|explain|with)\b`)
)

// redact 丢弃自由文本中的凭据和引号内容；持久化入口不接收任意字段集合。
func redact(text string, limit int) string {
	text = strings.ToValidUTF8(text, "�")
	text = credentialLine.ReplaceAllString(text, "[redacted credential]")
	text = credentialValue.ReplaceAllString(text, "[redacted credential]")
	text = connectionUser.ReplaceAllString(text, "${1}[redacted]@")
	isSQL := sqlWords.MatchString(text)
	var out strings.Builder
	out.Grow(min(len(text), limit))
	for i := 0; i < len(text) && out.Len() < limit; {
		if text[i] == '\'' || text[i] == '"' || text[i] == '`' {
			quote := text[i]
			escapeBackslash := !isSQL || quote == '`' || isPostgresEscapeString(text, i)
			i++
			for i < len(text) {
				if escapeBackslash && text[i] == '\\' {
					i = min(i+2, len(text))
					continue
				}
				if text[i] == quote {
					i++
					if i < len(text) && text[i] == quote {
						i++
						continue
					}
					break
				}
				i++
			}
			out.WriteString("[redacted]")
			continue
		}
		if text[i] == '$' {
			end := i + 1
			for end < len(text) && end-i <= 64 && ((text[end] >= 'a' && text[end] <= 'z') || (text[end] >= 'A' && text[end] <= 'Z') || (text[end] >= '0' && text[end] <= '9') || text[end] == '_') {
				end++
			}
			if end < len(text) && text[end] == '$' {
				delimiter := text[i : end+1]
				closing := strings.Index(text[end+1:], delimiter)
				out.WriteString("[redacted]")
				if closing < 0 {
					break
				}
				i = end + 1 + closing + len(delimiter)
				continue
			}
		}
		r, size := utf8.DecodeRuneInString(text[i:])
		if r == '\n' || r == '\t' || r >= 32 {
			out.WriteRune(r)
		}
		i += size
	}
	result := out.String()
	if isSQL {
		result = redactPostgresNumbers(result)
	}
	if len(result) > limit {
		result = result[:limit]
		for !utf8.ValidString(result) {
			result = result[:len(result)-1]
		}
	}
	return result
}

func isPostgresEscapeString(text string, quoteAt int) bool {
	if text[quoteAt] != '\'' || quoteAt == 0 || (text[quoteAt-1] != 'e' && text[quoteAt-1] != 'E') {
		return false
	}
	return quoteAt == 1 || !isPostgresIdentifierByte(text[quoteAt-2])
}

func redactPostgresNumbers(text string) string {
	var out strings.Builder
	out.Grow(len(text))
	for i := 0; i < len(text); {
		if isPostgresNumberStart(text, i) {
			end := scanPostgresNumber(text, i)
			if end == len(text) || !isPostgresIdentifierByte(text[end]) {
				out.WriteByte('?')
				i = end
				continue
			}
		}
		out.WriteByte(text[i])
		i++
	}
	return out.String()
}

func isPostgresNumberStart(text string, at int) bool {
	if at > 0 && isPostgresIdentifierByte(text[at-1]) {
		return false
	}
	return isASCIIDigit(text[at]) || (text[at] == '.' && at+1 < len(text) && isASCIIDigit(text[at+1]))
}

func scanPostgresNumber(text string, at int) int {
	if text[at] == '.' {
		return scanPostgresExponent(text, scanPostgresDigits(text, at+1))
	}
	if at+2 < len(text) && text[at] == '0' {
		var valid func(byte) bool
		switch text[at+1] {
		case 'b', 'B':
			valid = func(value byte) bool { return value == '0' || value == '1' }
		case 'o', 'O':
			valid = func(value byte) bool { return value >= '0' && value <= '7' }
		case 'x', 'X':
			valid = func(value byte) bool {
				return isASCIIDigit(value) || value >= 'a' && value <= 'f' || value >= 'A' && value <= 'F'
			}
		}
		digitAt := at + 2
		if valid != nil && text[digitAt] == '_' {
			digitAt++
		}
		if valid != nil && digitAt < len(text) && valid(text[digitAt]) {
			end := digitAt + 1
			for end < len(text) && (valid(text[end]) || text[end] == '_') {
				end++
			}
			return end
		}
	}
	end := scanPostgresDigits(text, at)
	if end < len(text) && text[end] == '.' {
		end = scanPostgresDigits(text, end+1)
	}
	return scanPostgresExponent(text, end)
}

func scanPostgresDigits(text string, at int) int {
	for at < len(text) && (isASCIIDigit(text[at]) || text[at] == '_') {
		at++
	}
	return at
}

func scanPostgresExponent(text string, at int) int {
	if at >= len(text) || (text[at] != 'e' && text[at] != 'E') {
		return at
	}
	end := at + 1
	if end < len(text) && (text[end] == '+' || text[end] == '-') {
		end++
	}
	if end >= len(text) || !isASCIIDigit(text[end]) {
		return at
	}
	return scanPostgresDigits(text, end)
}

func isPostgresIdentifierByte(value byte) bool {
	return value >= 'a' && value <= 'z' ||
		value >= 'A' && value <= 'Z' ||
		isASCIIDigit(value) ||
		value == '_' ||
		value == '$' ||
		value >= utf8.RuneSelf
}

func isASCIIDigit(value byte) bool {
	return value >= '0' && value <= '9'
}
