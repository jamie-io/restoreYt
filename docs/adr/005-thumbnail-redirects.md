# ADR 005: Redirect swapped thumbnails with declarativeNetRequest

Status: Accepted (2026-10-31)

YouTube serves per-language thumbnails from `i.ytimg.com/vi_lc/<id>/<tier>_<lang>.jpg` and test-and-compare variants from `i.ytimg.com/vi/<id>/<tier>_custom_<n>.jpg`. Both carry signed query strings; the bare URLs return 404, while the bare original `i.ytimg.com/vi/<id>/<tier>.jpg` loads.

Two static redirect rules map each swapped URL to the original in the same size tier and drop the query string. Keeping the tier means the target exists whenever the swapped asset exists, which removes the reason ADR 002 avoided redirects. `_live` frames are never rewritten. Rules apply only to image requests initiated by YouTube pages.

Consequences: no flicker and no double download, coverage of CSS backgrounds and player posters, one extra host permission (`i.ytimg.com`). The ruleset is switched on and off with the setting by the background. Chrome compiles each regex under a 2 KB limit, so the rules use unbounded character classes instead of `{11}` repeats; a unit test guards this.
