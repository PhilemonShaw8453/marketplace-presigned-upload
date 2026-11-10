import { z } from "zod";
import { infrai } from "./infrai_client.ts";

export const assetRequest = z.object({ sellerId: z.string().min(1), productId: z.string().min(1), fileName: z.string().min(1), contentType: z.string().min(1), size: z.number().int().positive() });
export const buyerUpdate = z.object({ orderId: z.string().min(1), buyerNote: z.string().min(1) });
export type AssetInput = z.infer<typeof assetRequest>;
export type Handoff = { orderId: string; assetKey: string; buyerNote: string; uploadUrl: string };

const BUCKET = "marketplace-assets";
export async function prepareAsset(input: AssetInput, idempotencyKey = `asset-${input.sellerId}-${input.productId}`): Promise<{ assetKey: string; uploadUrl: string }> {
  const parsed = assetRequest.parse(input);
  await infrai.storage.bucket.create({ name: BUCKET });
  const assetKey = `${parsed.sellerId}/${parsed.productId}/${parsed.fileName}`;
  const { url } = await infrai.storage.object.presign(BUCKET, assetKey, { op: "put", expires_seconds: 900, content_type: parsed.contentType, max_bytes: parsed.size, idempotency_key: idempotencyKey });
  return { assetKey, uploadUrl: url };
}

export function handoffOrder(asset: { assetKey: string; uploadUrl: string }, update: unknown): Handoff {
  const parsed = buyerUpdate.parse(update);
  return { orderId: parsed.orderId, assetKey: asset.assetKey, buyerNote: parsed.buyerNote, uploadUrl: asset.uploadUrl };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const asset = await prepareAsset({ sellerId: "seller-42", productId: "lamp-7", fileName: "photo.jpg", contentType: "image/jpeg", size: 240000 });
  console.log(handoffOrder(asset, { orderId: "order-9", buyerNote: "Please include the care card." }));
}
