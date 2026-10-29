package linkpreview

import (
	"testing"
	"unicode/utf16"
	"unicode/utf8"
)

func TestTokenizeLinks_SharedFixtures(t *testing.T) {
	for _, sample := range readSharedURLFixtures(t).Tokenization {
		t.Run(sample.Name, func(t *testing.T) {
			matches := TokenizeLinks(sample.Input)
			if len(matches) != len(sample.Matches) {
				t.Fatalf("TokenizeLinks(%q) = %+v, want %d matches", sample.Input, matches, len(sample.Matches))
			}
			for index, match := range matches {
				expected := sample.Matches[index]
				want := LinkMatch{Start: expected.StartByte, End: expected.EndByte, Href: expected.Href, Text: expected.Text, Key: expected.Key}
				if match != want {
					t.Errorf("match %d = %+v, want %+v", index, match, want)
				}
				if key := NormalizeURL(match.Href); key != expected.Key {
					t.Errorf("match %d key = %q, want %q", index, key, expected.Key)
				}
				if sample.Input[match.Start:match.End] != match.Text {
					t.Errorf("match %d offsets do not select the original text", index)
				}
				startPrefix, endPrefix := sample.Input[:match.Start], sample.Input[:match.End]
				if utf8.RuneCountInString(startPrefix) != expected.StartRune || utf8.RuneCountInString(endPrefix) != expected.EndRune {
					t.Errorf("match %d rune offsets differ from the shared fixture", index)
				}
				if len(utf16.Encode([]rune(startPrefix))) != expected.StartUTF16 || len(utf16.Encode([]rune(endPrefix))) != expected.EndUTF16 {
					t.Errorf("match %d UTF-16 offsets differ from the shared fixture", index)
				}
			}
		})
	}
}
