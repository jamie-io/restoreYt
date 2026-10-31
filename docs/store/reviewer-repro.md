# Reviewer reproduction

YouTube translates titles and switches to dubbed audio when the interface language differs from the video's language.

1. Install restoreyt.
2. On YouTube, open the account menu and set **Language** to **Deutsch** (or any language other than English). No account is needed.
3. Search for `mrbeast`. Without restoreyt the titles appear in German; with restoreyt they appear in English, and the popup lists each change with the German version struck through.
4. Open any of those videos. The title, browser tab title and description are English, and the audio track (gear menu > Audio track) is "English (original)" instead of the German dub.
5. Switch **Titles** off in the popup: the German titles return immediately. Switch it on again: the English titles return.

Automated checks: `npm run verify` and `npm run test:e2e` (local fake YouTube, no network).
