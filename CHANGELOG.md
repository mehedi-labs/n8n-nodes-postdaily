# Changelog

## 0.1.0

- First release: Post (create, get, get many, update, delete, retry), Media (upload, import from URL) and Channel (get many), with the PostDaily API credential.
- The automatic idempotency key includes a fingerprint of what is sent, so each round of a Loop Over Items gets its own key.
- Add to Queue, Schedule and Publish Now fail the item when PostDaily keeps the post as a draft.
