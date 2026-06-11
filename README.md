# DESLOPIFY - Remove slop auto-translations for YouTube thumbnails and titles
Always show the thumbnail and title choosen by the creator. No AI modified versions were slop ai translations are used.

## What needs to be done
- intercept network requests for titles and thumbnails
- replace the slop-request with a proper one

### proper requests 
- URL: [https://img.youtube.com/vi/7ZsZ0G98E38/maxresdefault.jpg]
- Qualities:
  - maxresdefault
  - sddefault
  - hqdefault
  - mqdefault
  - default
  + ".jpg" 

### Slop Requests
- Url: [https://i.ytimg.com/vi/7ZsZ0G98E38/hq720.jpg?sqp=-oaymwEnCNAFEJQDSFryq4qpAxkIARUAAIhCGAHYAQHiAQoIGBACGAY4AUAB&rs=AOn4CLDAXZ7JMsLxRSJcNuejq3d0WK8oRg]
- Qualities: hq720 and other

## Ressources
- Official Chrome extension get started [https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world]

