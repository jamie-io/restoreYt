# Permission justifications

- `storage`: save the feature switches, a local cache of original titles (14 days at most) and restore counters.
- `declarativeNetRequest`: redirect localized and test-variant thumbnail requests on `i.ytimg.com` to the creator's original image in the same size.
- Host access to `www.youtube.com` and `www.youtube-nocookie.com`: run on YouTube pages and embedded players, and look up original titles through YouTube's oEmbed endpoint.
- Host access to `i.ytimg.com`: Chrome requires host access to the request URL for redirect rules.
