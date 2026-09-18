package drawguess

import "strings"

func WordsForLocale(locale string) []string {
	if strings.HasPrefix(strings.ToLower(strings.TrimSpace(locale)), "zh") {
		return ChineseWords
	}
	return EnglishWords
}
