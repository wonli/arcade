package drawguess

import (
	"strings"
	"testing"
)

func TestWordBanksContainAtLeastOneHundredUniqueEntries(t *testing.T) {
	for locale, words := range map[string][]string{
		"en": EnglishWords,
		"zh-CN": ChineseWords,
	} {
		if len(words) < 100 {
			t.Fatalf("%s word bank has %d entries, want at least 100", locale, len(words))
		}
		seen := map[string]bool{}
		for _, raw := range words {
			word := strings.TrimSpace(raw)
			if word == "" {
				t.Fatalf("%s word bank contains an empty entry", locale)
			}
			key := strings.ToLower(word)
			if seen[key] {
				t.Fatalf("%s word bank contains duplicate %q", locale, word)
			}
			seen[key] = true
		}
	}
}

func TestWordsForLocaleDefaultsToEnglish(t *testing.T) {
	if got := WordsForLocale(""); len(got) != len(EnglishWords) || got[0] != EnglishWords[0] {
		t.Fatalf("default word bank should be English")
	}
	if got := WordsForLocale("zh-TW"); len(got) != len(ChineseWords) || got[0] != ChineseWords[0] {
		t.Fatalf("Chinese locale should use Chinese words")
	}
}
