# Article Generation Webhook Workflow

## Overview

The article generation workflow has been adjusted to push webhook data **directly to the Supabase database** instead of to the frontend. This provides better reliability and consistency.

## Workflow Steps

### 1. Frontend Sends Outline to n8n

**File:** `client/lib/webhook.ts`
**Function:** `sendOutlineToWebhook()`

The frontend sends the article outline to n8n with:

- `articleid`: Unique identifier for the article
- `keyword`: Target keyword
- `clientid`: Client identifier
- `sections`: Article sections with titles and descriptions
- `callbackUrl`: Points to `/api/webhook-callback`

```typescript
const callbackUrl = "https://meerkatv3.netlify.app/api/webhook-callback";
```

### 2. n8n Processes the Article

n8n receives the outline and:

- Generates article content based on the outline
- Creates SEO metadata (title, meta description)
- Validates the generated content
- Returns results via webhook callback

### 3. Webhook Callback - Direct Database Write

**Production Handler:** `netlify/functions/api/webhook-callback.js`
**Local Development Handler:** `server/index.ts` (POST `/api/webhook-callback`)

The webhook callback receives:

```json
{
  "articleid": "unique-id",
  "status": "completed" | "completed_with_warnings" | "validation_failed",
  "clientName": "Client Name",
  "keyword": "target keyword",
  "htmlContent": "<html>...</html>",
  "seoTitle": "SEO Title",
  "seoMetaDescription": "Meta description",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

**Key Action:** The handler **directly writes to Supabase**:

1. Finds the article by `article_id`
2. Updates the `received_article` column with:
   - Generated content
   - SEO title and meta description
   - Timestamp of when it was received
3. Returns success response to n8n

### 4. Frontend Polls Supabase for Updates

**Global Hook:** `client/hooks/use-article-updates.ts`

- Polls every 5 seconds
- Looks for articles with `received_article` data
- Shows toast notification when article arrives
- Tracks last seen time to avoid duplicate notifications

**Component Level:** `client/pages/EditOutline.tsx`

- Polls every 2 seconds
- Updates the outline display when new content arrives
- Enables the "Article Content" tab

### 5. User Sees Updated Content

The article content appears in:

1. **Article Content Tab** - Shows the generated HTML
2. **Toast Notification** - "✓ Article Generated" notification
3. **Status Indicator** - Green checkmark shows article is received

## Data Flow

```
Frontend (sendOutlineToWebhook)
    ↓
n8n (processes article)
    ↓
Webhook Callback Handler ← DIRECT DB WRITE
    ↓
Supabase (article_outlines.received_article)
    ↓
Frontend Polls (useArticleUpdates, EditOutline)
    ↓
User Sees Content
```

## Key Files

### Webhook Handlers

- `netlify/functions/api/webhook-callback.js` - Main production handler
- `netlify/functions/api.ts` - Alternative Netlify handler
- `server/index.ts` - Local development handler
- `netlify/functions/webhook-callback.js` - DEPRECATED, not used

### Frontend Integration

- `client/lib/webhook.ts` - Send outline function
- `client/hooks/use-article-updates.ts` - Poll for updates and show toasts
- `client/pages/EditOutline.tsx` - Display article content
- `client/components/AppLayout.tsx` - Initializes polling

### Utilities

- `client/lib/webhook-logger.ts` - Debug webhook attempts
- `client/lib/webhook-status.ts` - Track webhook status
- `client/lib/webhook-logging.ts` - Log webhook payloads

## Error Handling

The workflow handles these scenarios:

| Status                    | Action       | Response                 |
| ------------------------- | ------------ | ------------------------ |
| `validation_failed`       | Log error    | 200 OK with errors       |
| `completed`               | Save to DB   | 200 OK with saved status |
| `completed_with_warnings` | Save to DB   | 200 OK with saved status |
| `article_not_found`       | Return error | 404 error                |
| `db_update_error`         | Log error    | 500 error                |
| Unknown status            | Log warning  | 200 OK                   |

## Polling Strategy

### use-article-updates.ts (5 second interval)

- Polls all articles with received content
- Compares timestamps to avoid duplicate toasts
- Stores last seen time in localStorage
- Notifications appear once per article

### EditOutline.tsx (2 second interval)

- Polls specific article being edited
- Updates UI immediately when content arrives
- Enables the "Article Content" tab
- Switches to showing generated content

## Monitoring & Debugging

### Check Webhook Status

1. Open Settings → Webhook Status
2. See pending/received articles
3. View wait times for each article

### View Webhook Logs

1. Open Settings → Webhook Logs
2. See payload history
3. Review timestamps and errors

### Browser Console Debug

```javascript
// View last webhook attempt
window.exportWebhookDebugInfo();

// Copy to clipboard
window.copyWebhookDebugInfo();

// View full debug history
window.webhookDebugHistory;
```

## Notes

- **Direct Database Writes**: The webhook handler writes directly to Supabase, not to the frontend
- **Frontend Polling**: The frontend polls Supabase for updates, providing real-time feedback to users
- **Reliable Delivery**: If a webhook callback is missed, the data won't be in the database, so the frontend polling won't find it
- **Timeout**: If an article doesn't appear within 5 minutes, check the webhook logs for errors
- **Local Development**: Use `npm run dev` and test against local n8n instance

## Production Deployment

- Main webhook endpoint: `https://meerkatv3.netlify.app/api/webhook-callback`
- Uses Netlify Functions (no cold starts expected)
- Fallback to local Express server for development
- All webhook attempts logged to Supabase `webhook_logs` table
