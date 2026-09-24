# ADR 004: In-memory cache

Status: Accepted

An in-memory LRU avoids sharing quota with YouTube page storage and avoids cache key/type collisions. Positive values use normal TTL; negative values use short TTL. Failed requests are not cached.
