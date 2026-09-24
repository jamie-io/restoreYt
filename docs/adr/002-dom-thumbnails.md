# ADR 002: Restore thumbnails in DOM

Status: Accepted

restoreyt does not use declarative network redirects. DOM restoration can retain the original element state when max-resolution assets do not exist, avoiding broken thumbnails and unnecessary image host permissions.
