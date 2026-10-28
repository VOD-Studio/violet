package linkpreview

import (
	"net/netip"
	"net/url"
	"strconv"
	"strings"
	"unicode"

	"golang.org/x/net/idna"
	"golang.org/x/net/publicsuffix"
)

// NormalizeURL returns the HTTP cache key without a fragment, or an empty string for invalid input.
func NormalizeURL(raw string) string {
	source := strings.TrimSpace(raw)
	separator := strings.Index(source, "://")
	if separator < 0 {
		authority := source
		if end := strings.IndexAny(authority, "/?#"); end >= 0 {
			authority = authority[:end]
		}
		host := authority
		if colon := strings.LastIndexByte(host, ':'); colon >= 0 {
			host = host[:colon]
		}
		if !knownDomain(host) {
			return ""
		}
		source = "https://" + source
		separator = 5
	}
	scheme := strings.ToLower(source[:separator])
	if scheme != "http" && scheme != "https" {
		return ""
	}
	for _, r := range source {
		if unicode.IsSpace(r) || unicode.IsControl(r) || r == '\\' {
			return ""
		}
	}
	for i := 0; i < len(source); i++ {
		if source[i] == '%' {
			if i+2 >= len(source) || !isHex(source[i+1]) || !isHex(source[i+2]) {
				return ""
			}
			i += 2
		}
	}
	parsed, err := url.Parse(scheme + source[separator:])
	if err != nil || parsed.Host == "" || parsed.User != nil || strings.ContainsAny(parsed.Host, "@%") {
		return ""
	}
	host := parsed.Hostname()
	if host == "" {
		return ""
	}
	if strings.HasPrefix(parsed.Host, "[") {
		address, err := netip.ParseAddr(host)
		if err != nil || !address.Is6() || address.Zone() != "" {
			return ""
		}
		host = address.String()
		if address.Is4In6() {
			bytes := address.As16()
			host = "::ffff:" + strconv.FormatUint(uint64(bytes[12])<<8|uint64(bytes[13]), 16) + ":" + strconv.FormatUint(uint64(bytes[14])<<8|uint64(bytes[15]), 16)
		}
		host = "[" + host + "]"
	} else {
		host, err = idna.Lookup.ToASCII(host)
		if err != nil || !validHostname(host) {
			return ""
		}
		host = strings.ToLower(host)
	}
	port := parsed.Port()
	if strings.HasSuffix(parsed.Host, ":") {
		return ""
	}
	if port != "" {
		number, err := strconv.ParseUint(port, 10, 16)
		if err != nil {
			return ""
		}
		if (scheme != "http" || number != 80) && (scheme != "https" || number != 443) {
			host += ":" + strconv.FormatUint(number, 10)
		}
	}
	suffix := source[separator+3:]
	if end := strings.IndexAny(suffix, "/?#"); end >= 0 {
		suffix = suffix[end:]
	} else {
		suffix = ""
	}
	if fragment := strings.IndexByte(suffix, '#'); fragment >= 0 {
		suffix = suffix[:fragment]
	}
	path, query, hasQuery := strings.Cut(suffix, "?")
	if path == "" {
		path = "/"
	}
	path = normalizePath(path)
	key := scheme + "://" + host + escapeURLPart(path, false)
	if hasQuery {
		key += "?" + escapeURLPart(query, true)
	}
	return key
}

func knownDomain(host string) bool {
	ascii, err := idna.Lookup.ToASCII(host)
	if err != nil {
		return false
	}
	ascii = strings.ToLower(ascii)
	suffix, icann := publicsuffix.PublicSuffix(ascii)
	return icann && len(ascii) > len(suffix)+1 && strings.HasSuffix(ascii, "."+suffix)
}

func validHostname(host string) bool {
	if len(host) > 253 {
		return false
	}
	numeric := true
	for _, c := range host {
		if (c < '0' || c > '9') && c != '.' {
			numeric = false
			break
		}
	}
	if numeric {
		address, err := netip.ParseAddr(host)
		return err == nil && address.Is4()
	}
	for _, label := range strings.Split(host, ".") {
		if label == "" || len(label) > 63 || label[0] == '-' || label[len(label)-1] == '-' {
			return false
		}
		for _, c := range label {
			if (c < 'a' || c > 'z') && (c < 'A' || c > 'Z') && (c < '0' || c > '9') && c != '-' {
				return false
			}
		}
	}
	// WHATWG treats a numeric final label as an IPv4 address, not a DNS name.
	last := host[strings.LastIndexByte(host, '.')+1:]
	if strings.TrimLeft(last, "0123456789") == "" {
		return false
	}
	if strings.HasPrefix(strings.ToLower(last), "0x") && strings.TrimLeft(strings.ToLower(last[2:]), "0123456789abcdef") == "" {
		return false
	}
	return true
}

func isHex(c byte) bool {
	return c >= '0' && c <= '9' || c >= 'a' && c <= 'f' || c >= 'A' && c <= 'F'
}

func normalizePath(path string) string {
	segments := strings.Split(path, "/")
	out := make([]string, 0, len(segments))
	for i, segment := range segments {
		dots := strings.ReplaceAll(strings.ToLower(segment), "%2e", ".")
		if dots == "." || dots == ".." {
			if dots == ".." && len(out) > 1 {
				out = out[:len(out)-1]
			}
			if i == len(segments)-1 {
				out = append(out, "")
			}
			continue
		}
		out = append(out, segment)
	}
	return strings.Join(out, "/")
}

func escapeURLPart(raw string, query bool) string {
	const hex = "0123456789ABCDEF"
	var out strings.Builder
	out.Grow(len(raw))
	for i := range len(raw) {
		c := raw[i]
		encode := c <= 0x20 || c > 0x7e || strings.ContainsRune("\"#<>", rune(c))
		if query {
			encode = encode || c == '\''
		} else {
			encode = encode || strings.ContainsRune("?^`{}", rune(c))
		}
		if encode {
			out.WriteByte('%')
			out.WriteByte(hex[c>>4])
			out.WriteByte(hex[c&15])
		} else {
			out.WriteByte(c)
		}
	}
	return out.String()
}

// NormalizeURLs filters invalid keys and removes duplicates in their original order.
func NormalizeURLs(raw []string) []string {
	seen := make(map[string]struct{}, len(raw))
	out := make([]string, 0, len(raw))
	for _, u := range raw {
		n := NormalizeURL(u)
		if n == "" {
			continue
		}
		if _, ok := seen[n]; ok {
			continue
		}
		seen[n] = struct{}{}
		out = append(out, n)
	}
	return out
}
