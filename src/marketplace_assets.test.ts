import { strict as assert } from "node:assert";
import { handoffOrder } from "./marketplace_assets.ts";

const result = handoffOrder({ assetKey: "seller-1/item-1/front.png", uploadUrl: "https://signed.example/upload" }, { orderId: "order-1", buyerNote: "Gift wrap" });
assert.deepEqual(result, { orderId: "order-1", assetKey: "seller-1/item-1/front.png", buyerNote: "Gift wrap", uploadUrl: "https://signed.example/upload" });
console.log("handoff decision test passed");
