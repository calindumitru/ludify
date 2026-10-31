// Read-aloud: the best voice the browser has for the deck's language, instead of its default.

export type Voice = { name: string; lang: string; default: boolean; localService: boolean };

const tag = (lang: string) => lang.toLowerCase().replace(/_/g, '-');
// Names browsers give their better voices (Apple's downloads, Chrome's and Edge's network voices).
const BETTER = /\b(premium|enhanced|natural|neural|online|google)\b/i;

/** The voice to read `lang` aloud with, or undefined when none speaks it. */
export function pickVoice<V extends Voice>(voices: readonly V[], lang: string): V | undefined {
  const want = tag(lang), primary = want.split('-')[0];
  const score = (v: V) => {
    const have = tag(v.lang);
    const match = have === want ? 2 : have.split('-')[0] === primary ? 1 : 0;
    return match && match * 100 + (BETTER.test(v.name) ? 10 : 0) + (v.default ? 1 : 0);
  };
  let best: V | undefined, top = 0;
  for (const v of voices) {
    const s = score(v);
    if (s > top) { best = v; top = s; }
  }
  return best;
}
