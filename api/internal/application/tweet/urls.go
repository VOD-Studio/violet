package tweet

import domainlink "blog-api/internal/domain/linkpreview"

// ExtractURLs returns unique, normalized HTTP cache keys in their original order.
func ExtractURLs(content string) []string {
	matches := domainlink.TokenizeLinks(content)
	keys := make([]string, 0, len(matches))
	seen := make(map[string]struct{}, len(matches))
	for _, match := range matches {
		if _, exists := seen[match.Key]; !exists {
			keys = append(keys, match.Key)
			seen[match.Key] = struct{}{}
		}
	}
	return keys
}
