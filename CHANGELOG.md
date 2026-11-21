# Changelog

## 0.2.1

- The package author email is now support@postdaily.app, so n8n's creator
  portal can send its ownership code there. No code changes.

## 0.2.0

- Talks to PostDaily's REST API (`https://api.postdaily.app/v1`) instead of
  its MCP endpoint. n8n verifies community nodes only against a vendor's REST
  API.
- The credential's address field is now **Base URL**
  (`https://api.postdaily.app/v1`). Existing 0.1.x credentials need it set
  again.
- An empty Post ID or Media ID fails the item with a clear message.

## 0.1.1

- First published release. 0.1.0 was tagged but never reached npm: a new package needs `publishConfig.access` set to public before npm will attach provenance.

## 0.1.0

- First release: Post (create, get, get many, update, delete, retry), Media (upload, import from URL) and Channel (get many), with the PostDaily API credential.
- The automatic idempotency key includes a fingerprint of what is sent, so each round of a Loop Over Items gets its own key.
- Add to Queue, Schedule and Publish Now fail the item when PostDaily keeps the post as a draft.
