# Smart Pairing Engine v2.0 API Guide 

The Gateway API Controller provides RESTful endpoints to consume hybrid recommendations, configure domain presets dynamically, and fetch granular engine metrics.

## `POST /api/gateway/configure`
Dynamically switch the domain logic and mapping of the underlying Smart Engine.

**Body:**
```json
{
  "domainKey": "LEGAL_KNOWLEDGE",
  "dataset": { // Optional: map entirely new raw datasets
    "cases": [],
    "citations": []
  }
}
```
**Response:** `200 OK` (Outputs reconfiguration matrix and current stats).

---

## `GET /api/recommendations/:userId?limit=10&product=PROD-SKU`
Compute hybrid recommendations combining Association Rules, Collaborative Filtering, and Content-Based matrices according to the active domain preset weightings.

**Response:** `200 OK`
```json
{
  "recommendations": [
    {
       "product": { "sku": "PROD-1", "category": "Retail" },
       "score": 34.2
    }
  ],
  "metadata": {
    "poolSize": 80,
    "latencyMs": 14 
  }
}
```

---

## `GET /api/lifecycle/sync`
Trigger a hot-rebuild. Computes the life-cycles of all active products and drops obsolete ones, recalculating vector matrices in the background.

**Response:** `200 OK`
```json
{
  "removed": 14,
  "flaggedDeclining": 5,
  "latencyMs": 85,
  "message": "Modular Catalog Sync Successful."
}
```
