package linkpreview

import (
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"
)

var (
	httpPrefix             = regexp.MustCompile(`(?i)^https?://`)
	schemePrefix           = regexp.MustCompile(`(?i)^[a-z][a-z0-9+.-]*:`)
	linkAuthority          = regexp.MustCompile(`(?i)^[\p{L}\p{N}\p{M}.\-:\[\]@%_]+`)
	bareAuthority          = regexp.MustCompile(`(?i)^[a-z0-9.-]+(?::[0-9]+)?`)
	internationalAuthority = regexp.MustCompile(`^[\p{L}\p{N}\p{M}.-]+(?::[0-9]+)?`)
	asciiLetter            = regexp.MustCompile(`(?i)[a-z]`)
	fileSuffix             = regexp.MustCompile(`(?i)\.(?:md|js|ts|tsx|jsx|css|json|txt|html?|xml|pdf|png|jpe?g|gif|svg|webp|ya?ml|log)$`)
	emotePrefix            = regexp.MustCompile(`(?i)^\[[a-z0-9_\p{L}-]+\]`)
	topicPrefix            = regexp.MustCompile(`^#[^#\s/]+#`)
	userinfoPrefix         = regexp.MustCompile(`^[^/?#\s<>。，；：！？、（）【】《》「」『』“”‘’]*@`)
)

// LinkMatch offsets are UTF-8 byte offsets, unlike the frontend's UTF-16 offsets.
type LinkMatch struct {
	Start int
	End   int
	Href  string
	Text  string
	Key   string
}

// TokenizeLinks returns HTTP URLs and bare ICANN domains without consuming adjacent topics or emoji.
func TokenizeLinks(text string) []LinkMatch {
	matches := make([]LinkMatch, 0)
	for start := 0; start < len(text); {
		if start > 0 && strings.ContainsRune("abcdefghijklmnopqrstuvwxyz0123456789_@./:+-", rune(asciiLower(text[start-1]))) {
			_, size := utf8.DecodeRuneInString(text[start:])
			start += size
			continue
		}
		protocol := httpPrefix.FindString(text[start:])
		if protocol == "" {
			prefix := schemePrefix.FindString(text[start:])
			barePort := prefix != "" && knownDomain(strings.TrimSuffix(prefix, ":")) && start+len(prefix) < len(text) && text[start+len(prefix)] >= '0' && text[start+len(prefix)] <= '9'
			if prefix != "" && !barePort {
				start = skipTextToken(text, start)
				continue
			}
		}
		authorityStart := start + len(protocol)
		if protocol != "" && userinfoPrefix.MatchString(text[authorityStart:]) {
			start = skipTextToken(text, start)
			continue
		}
		pattern := bareAuthority
		if protocol != "" {
			pattern = linkAuthority
		}
		authority := pattern.FindString(text[authorityStart:])
		if protocol == "" {
			international := internationalAuthority.FindString(text[authorityStart:])
			host, _, _ := strings.Cut(international, ":")
			label, _, _ := strings.Cut(host, ".")
			if strings.IndexFunc(host, func(r rune) bool { return r > unicode.MaxASCII }) >= 0 && knownDomain(host) &&
				(host[0] < utf8.RuneSelf || !asciiLetter.MatchString(label)) {
				authority = international
			}
		}
		if authority == "" {
			_, size := utf8.DecodeRuneInString(text[start:])
			start += size
			continue
		}
		hostEnd := authorityStart + len(strings.TrimRight(authority, "."))
		if !knownDomain(text[authorityStart:hostEnd]) {
			for candidateEnd := hostEnd; candidateEnd > authorityStart; {
				r, size := utf8.DecodeLastRuneInString(text[authorityStart:candidateEnd])
				if r <= unicode.MaxASCII {
					break
				}
				candidateEnd -= size
				if knownDomain(text[authorityStart:candidateEnd]) {
					hostEnd = candidateEnd
					break
				}
			}
		}
		rawAuthority := text[authorityStart:hostEnd]
		end := hostEnd
		if hostEnd == authorityStart+len(authority) && hostEnd < len(text) && strings.ContainsRune("/?#", rune(text[hostEnd])) {
			end = scanLinkEnd(text, hostEnd)
		}
		end = trimLinkEnd(text, start, end)
		if end < len(text) && text[end] == '\\' {
			start = skipTextToken(text, end)
			continue
		}
		raw := text[start:end]
		href := raw
		if protocol == "" {
			href = "https://" + raw
		}
		host, _, _ := strings.Cut(rawAuthority, ":")
		key := NormalizeURL(href)
		if key != "" && (protocol != "" || knownDomain(host) && !fileSuffix.MatchString(host)) {
			matches = append(matches, LinkMatch{Start: start, End: end, Href: href, Text: raw, Key: key})
		}
		start = max(start+1, end)
	}
	return matches
}

func skipTextToken(text string, from int) int {
	end := from
	for end < len(text) {
		r, size := utf8.DecodeRuneInString(text[end:])
		if unicode.IsSpace(r) || strings.ContainsRune("<>。，；：！？、（）【】《》「」『』“”‘’", r) {
			break
		}
		end += size
	}
	return end
}

func asciiLower(c byte) byte {
	if c >= 'A' && c <= 'Z' {
		return c + ('a' - 'A')
	}
	return c
}

func scanLinkEnd(text string, from int) int {
	end := from
	query := false
	for end < len(text) {
		r, size := utf8.DecodeRuneInString(text[end:])
		if !unicode.IsLetter(r) && !unicode.IsNumber(r) && !unicode.IsMark(r) && !strings.ContainsRune("._~:/?#[]@!$&'()*+,;=%{}^-", r) || strings.ContainsRune("。，；：！？、（）【】《》「」『』“”‘’", r) {
			break
		}
		if r == '?' {
			query = true
		}
		if r == '#' && topicPrefix.MatchString(text[end:]) || r == '[' && !query && emotePrefix.MatchString(text[end:]) {
			break
		}
		end += size
	}
	return end
}

func trimLinkEnd(text string, start, end int) int {
	for end > start {
		last := text[end-1]
		if strings.ContainsRune(".,;:!?'\"`", rune(last)) {
			end--
			continue
		}
		var open byte
		switch last {
		case ')':
			open = '('
		case ']':
			open = '['
		case '}':
			open = '{'
		default:
			return end
		}
		balance := 0
		for i := start; i < end; i++ {
			if text[i] == open {
				balance++
			}
			if text[i] == last {
				balance--
			}
		}
		if balance >= 0 {
			return end
		}
		end--
	}
	return end
}
