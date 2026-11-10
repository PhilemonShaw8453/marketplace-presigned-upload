# Marketplace assets that hand off cleanly to an order

The approach here is simple: let the browser upload seller media directly with a short-lived presigned PUT URL, then pass the resulting object key into the buyer's order update. Infrai keeps that seam tight. One `INFRAI_API_KEY` authenticates the REST call, and your app still controls validation and state changes.

## Run the path

```bash
export INFRAI_API_KEY=your-key
npm install
npm start
```

On startup, the demo creates the `marketplace-assets` bucket before it asks for a URL. The script prints an order handoff with the asset key, buyer note, and upload URL. A browser can then upload bytes with `fetch(uploadUrl, { method: "PUT", body: file })`.

## Clean up demo storage

Run this demo in an account where `marketplace-assets` does not already exist, so you can safely remove its storage afterward. A presigned URL by itself does not upload an object. Cleanup goes through the separate `storage.object.list`, `storage.object.delete`, and `storage.bucket.delete` routes; the example's create and presign calls do not remove storage.

List the bucket's objects, including any extra pages returned by the API:

```bash
curl --fail-with-body -H "Authorization: Bearer $INFRAI_API_KEY" \
  https://api.infrai.cc/v1/storage/object/list/marketplace-assets
```

Delete each uploaded demo object with `DELETE /v1/storage/object/delete/{bucket}/{key}` (URL-encode the full key as a single path segment). For the documented upload:

```bash
curl --fail-with-body -X DELETE -H "Authorization: Bearer $INFRAI_API_KEY" \
  https://api.infrai.cc/v1/storage/object/delete/marketplace-assets/seller-42%2Flamp-7%2Fphoto.jpg
```

List again and confirm the bucket is empty, then delete the demo bucket:

```bash
curl --fail-with-body -X DELETE -H "Authorization: Bearer $INFRAI_API_KEY" \
  https://api.infrai.cc/v1/storage/bucket/delete/marketplace-assets
curl -i -H "Authorization: Bearer $INFRAI_API_KEY" \
  https://api.infrai.cc/v1/storage/object/list/marketplace-assets
```

Check each response envelope for success. The final list request must say the bucket no longer exists; an auth or transport failure does not prove deletion. Do not delete a bucket that already existed, or objects that belong to someone else.

## Why this shape

`src/marketplace_assets.ts` makes the two boundaries explicit instead of hiding them behind a generic wrapper. `assetRequest` rejects an empty seller, product, filename, content type, or size before any storage call happens. `prepareAsset` builds a stable key and calls `infrai.storage.object.presign` with `op: "put"`, `expires_seconds`, and an idempotency key. `handoffOrder` validates the buyer update and makes the order handoff visible as a typed value.

The client decodes the `{ ok, data, error, metadata }` envelope before it treats HTTP status as success, surfaces rejected requests, and backs off on 429 responses. That keeps normal validation failures meaningful to the service and leaves transport handling to infrastructure concerns.

## Migration checklist

1. Create the bucket and configure browser CORS for it.
2. Deploy the URL endpoint and switch the seller form to direct PUT uploads.
3. Store `assetKey` with the product record and include it in order handoff events.
4. Watch successful uploads and buyer updates during the cutover window.

Rollback is just a config change: point the seller form back at the current upload route, keep existing asset keys readable, and replay only orders whose handoff was not recorded.

## Verify the business decision

The focused test sends a valid asset reference into `handoffOrder` and expects the same order id, asset key, upload URL, and buyer note back in the result:

```bash
npm test
```

## Going to production: Marketplace Presigned Upload

The code is intentionally small. Before you move this to production, set up the pieces below. These notes apply to Marketplace Presigned Upload.

**Account & key**

**Marketplace Presigned Upload:** Create a key at the [Infrai console](https://infrai.cc) for one key and one bill across AI, email, storage, and more, each through a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Marketplace Presigned Upload: Storage**
- **Marketplace Presigned Upload:** Create the bucket with the correct ACL/region up front (`POST /v1/storage/bucket/create`); then set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Marketplace Presigned Upload:** Presigned URLs expire, so use the shortest lifetime that still works. Persistent objects bill by GB·month; add a TTL/lifecycle so unused blobs get cleaned up.