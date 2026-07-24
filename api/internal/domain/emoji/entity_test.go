package emoji

import "testing"

// TestEmojiSize_Valid 覆盖 EmojiSize 枚举合法性校验。
// B站 meta.size 语义：1=小，2=大。
func TestEmojiSize_Valid(t *testing.T) {
	cases := []struct {
		size EmojiSize
		want bool
	}{
		{SizeSmall, true},
		{SizeLarge, true},
		{0, false},
		{3, false},
		{99, false},
		{-1, false},
	}
	for _, tc := range cases {
		got := tc.size.IsValid()
		if got != tc.want {
			t.Errorf("EmojiSize(%d).IsValid() = %v, want %v", tc.size, got, tc.want)
		}
	}
}

// TestEmojiType_Valid 覆盖 EmojiType 枚举合法性校验。
// B站 emote.type 语义：1=普通，2=会员专属，3=购买所得，4=颜文字。
func TestEmojiType_Valid(t *testing.T) {
	cases := []struct {
		typ  EmojiType
		want bool
	}{
		{TypeNormal, true},
		{TypeVIP, true},
		{TypePurchased, true},
		{TypeText, true},
		{0, false},
		{5, false},
		{99, false},
		{-1, false},
	}
	for _, tc := range cases {
		got := tc.typ.IsValid()
		if got != tc.want {
			t.Errorf("EmojiType(%d).IsValid() = %v, want %v", tc.typ, got, tc.want)
		}
	}
}

// TestGroupType_Valid 覆盖 GroupType 枚举合法性校验。
// 分组级类型语义：1=文字（颜文字组），2=图片。
func TestGroupType_Valid(t *testing.T) {
	cases := []struct {
		gt   GroupType
		want bool
	}{
		{GroupTypeText, true},
		{GroupTypeImage, true},
		{0, false},
		{3, false},
		{99, false},
	}
	for _, tc := range cases {
		got := tc.gt.IsValid()
		if got != tc.want {
			t.Errorf("GroupType(%d).IsValid() = %v, want %v", tc.gt, got, tc.want)
		}
	}
}
