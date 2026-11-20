# n8n-nodes-postdaily

An [n8n](https://n8n.io) community node for [PostDaily](https://www.postdaily.app).
Use it to draft, queue and schedule social media posts from your workflows.
It posts to Instagram, Facebook, TikTok, YouTube, LinkedIn, X, Threads,
Pinterest, Bluesky and Mastodon.

PostDaily checks each post against each network's rules before it goes out. It
retries failed publishes and tells you when a channel needs reconnecting.

[Installation](#installation) · [Credentials](#credentials) · [Operations](#operations) · [Using it safely](#using-it-safely) · [Example workflows](#example-workflows) · [Compatibility](#compatibility) · [Resources](#resources)

## Installation

Follow the [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/)
and install `n8n-nodes-postdaily`.

## Credentials

The node uses a **PostDaily API key**.

1. In PostDaily, open **Settings → AI agents** and select **API key**.
2. Name the key after the workflow, for example "n8n blog to drafts".
3. Choose what the key can do:
   - **Drafts only**: create and edit drafts. It can never schedule or
     publish. Best for anything that runs with nobody watching.
   - **Full access**: also add to the queue, schedule, publish, delete and
     retry.
   - **Read only**: list channels and posts.
4. Pick the workspace the workflow should use.
5. Copy the key. PostDaily shows it only once.
6. In n8n, create a **PostDaily API** credential and paste the key. Leave
   **Server URL** as it is.

When you save the credential, n8n tests it by listing your workspaces. To
revoke a key, go to **Settings → AI agents** in PostDaily. A key also stops
working when it expires, or when you change your PostDaily password.

## Operations

| Resource | Operation | What it does |
|---|---|---|
| Post | Create | Creates a post on one or more channels: as a draft, added to the queue, scheduled, or published now. Each channel becomes its own post. |
| Post | Get | Gets a post with each channel's status and link. |
| Post | Get Many | Finds posts by status, channel, text or date. |
| Post | Update | Edits a draft's text, title, media, channels or tags. |
| Post | Delete | Deletes a post from PostDaily. A published post stays live on the network. |
| Post | Retry | Publishes the failed channels of a post again. |
| Media | Upload | Uploads a file from an earlier step (binary data) to your media library. |
| Media | Import From URL | Adds an image, video or PDF from a public URL. |
| Channel | Get Many | Lists connected channels, their limits, and whether each can post now. |

To attach media to a post, use either way:
- put the `media.mediaId` from **Upload** or **Import From URL** in **Media IDs**;
- put public URLs in **Media URLs**.

## Using it safely

A workflow runs with nobody checking each post, so the node is careful by
default:

- **Mode** defaults to **Draft**.
  - **Publish Now** does nothing unless you also turn on **Confirm Publish
    Now**.
  - **Retry** publishes again only with **Confirm Retry** on. Without it, it
    lists the channels it would retry.
- **Warnings stop the item.** If PostDaily warns about a post (for example
  Instagram with no image), nothing is saved and the item fails with the
  warning. To save anyway, turn on **Continue Despite Warnings**.
- **No double posts.** Every create sends an idempotency key. By default the
  key is built from the execution, node and item, so a retried step returns
  the first result. For a key that holds across executions, set
  **Idempotency Key** to something stable, such as an article URL.
- **Use one key per workflow, for one workspace.** A key that covers several
  workspaces may be asked to confirm before it writes in a second one. The
  node never sends that confirmation itself.

To keep going past a failed item, use n8n's **On Error → Continue** setting.
PostDaily's message ends up in the item's `error` field.

## Example workflows

- **Blog post to drafts:**
  1. **RSS Feed Trigger**.
  2. **PostDaily: Post → Create**, with **Mode** set to Draft.
  3. In the Create step, set **Media URLs** to the article image and
     **Idempotency Key** to `{{ $json.link }}`.

  A ready-made version of this workflow, with images and duplicate checks, is
  linked from [PostDaily's n8n guide](https://www.postdaily.app/help/connect-with-an-api-key#start-from-a-ready-made-n8n-workflow).
- **Video folder to TikTok and YouTube:**
  1. **Google Drive Trigger**, then **Google Drive: Download**.
  2. **PostDaily: Media → Upload**.
  3. **PostDaily: Post → Create** with **Media IDs** set to `{{ $json.media.mediaId }}`.
- **Spreadsheet to queue:**
  1. **Google Sheets** rows.
  2. **PostDaily: Post → Create**, with **Mode** set to Add to Queue. This
     needs a Full access key.
- **Failed post alert:**
  1. **Schedule Trigger**.
  2. **PostDaily: Post → Get Many**, with Statuses set to Failed.
  3. **Slack**.

## Compatibility

Tested with n8n 2.48.7, the current stable release.

How it talks to PostDaily:
- It calls PostDaily's API-key endpoint (`https://mcp.postdaily.app/key/mcp`)
  with one request per action.
- It has no runtime dependencies.
- It sends `User-Agent: n8n-nodes-postdaily/<version>`.

## Resources

- [PostDaily](https://www.postdaily.app)
- [Connect n8n with an API key](https://www.postdaily.app/help/connect-with-an-api-key)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)

## Licence

[MIT](LICENSE)
