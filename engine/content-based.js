/**
 * Content-Based Filtering Engine
 * ================================
 * Recommends products based on intrinsic item properties (features, metadata)
 * using cosine similarity between product feature vectors.
 *
 * Per specification § "Content-Based Filtering and Feature Engineering":
 *  - Products are represented as vectors in a feature space defined by metadata
 *    (price, category, color, brand)
 *  - Cosine similarity determines the affinity between user profile and item vectors
 *  - Mitigates the cold-start problem for new users
 *
 * References:
 *  - IBM Recommendation Engine: https://www.ibm.com/think/topics/recommendation-engine
 *  - Recommender system (Wikipedia): https://en.wikipedia.org/wiki/Recommender_system
 */

'use strict';

/**
 * Build a feature vector for a product.
 * Encodes: category (one-hot), price tier, margin tier, brand cluster, rating tier.
 *
 * @param {Object} product
 * @param {Array<string>} allCategories
 * @param {Array<string>} allBrands
 * @returns {Float64Array}
 */
function buildProductVector(product, allCategories, allBrands) {
  const catFeatures = allCategories.map(c => c === product.category ? 1.0 : 0.0);

  // Price tier: normalized to 0-1 (assuming max price ~$800)
  const priceTier = Math.min(product.price / 800, 1.0);

  // Margin tier
  const marginTier = product.margin;

  // Brand cluster: one-hot (truncated to top brands)
  const brandFeatures = allBrands.map(b => b === product.brand ? 1.0 : 0.0);

  // Rating normalized
  const ratingNorm = (product.rating - 1) / 4; // 1-5 → 0-1

  // Review popularity (log-normalized)
  const reviewPop = Math.min(Math.log(product.reviewCount + 1) / Math.log(1201), 1.0);

  return new Float64Array([
    ...catFeatures,
    priceTier,
    marginTier,
    ...brandFeatures,
    ratingNorm,
    reviewPop,
  ]);
}

/**
 * Cosine similarity between two float vectors.
 * cos(u, p) = (u · p) / (||u|| × ||p||)
 */
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Build a user profile vector by averaging the feature vectors
 * of products they've interacted with (weighted by recency).
 *
 * @param {string} userId
 * @param {Array<Object>} orders
 * @param {Map<string, Float64Array>} productVectors
 * @returns {Float64Array | null}
 */
function buildUserProfile(userId, orders, productVectors) {
  const userOrders = orders.filter(o => o.userId === userId);
  if (userOrders.length === 0) return null;

  const dim = [...productVectors.values()][0].length;
  const profile = new Float64Array(dim);
  let totalWeight = 0;

  const now = Date.now();
  for (const order of userOrders) {
    const daysSince = (now - order.timestamp) / 86400000;
    const recencyWeight = Math.exp(-daysSince / 180);

    for (const item of order.items) {
      const vec = productVectors.get(item.sku);
      if (!vec) continue;
      const weight = item.quantity * recencyWeight;
      for (let i = 0; i < dim; i++) {
        profile[i] += vec[i] * weight;
      }
      totalWeight += weight;
    }
  }

  // Normalize to average
  if (totalWeight > 0) {
    for (let i = 0; i < dim; i++) {
      profile[i] /= totalWeight;
    }
  }

  return profile;
}

/**
 * Build the content-based filtering engine.
 *
 * @param {Array<Object>} products
 * @param {Array<Object>} orders
 * @returns {Object} { productVectors, allCategories, allBrands, findSimilar, recommendForUser }
 */
function buildContentBasedFilter(products, orders) {
  console.log('\n📋 Content-Based Filtering Engine');

  const allCategories = [...new Set(products.map(p => p.category))].sort();
  const allBrands = [...new Set(products.map(p => p.brand))].sort();

  // Build product vectors
  const productVectors = new Map();
  for (const product of products) {
    productVectors.set(product.sku, buildProductVector(product, allCategories, allBrands));
  }

  const vectorDim = [...productVectors.values()][0].length;
  console.log(`   Product Vectors: ${productVectors.size} items × ${vectorDim} features`);
  console.log(`   Categories: ${allCategories.length} | Brands: ${allBrands.length}`);

  // Pre-compute product-product similarity (top-K for each)
  const K = 15;
  const productSimilarities = new Map();
  const productMap = new Map(products.map(p => [p.sku, p]));

  for (const [skuA, vecA] of productVectors) {
    const similarities = [];
    for (const [skuB, vecB] of productVectors) {
      if (skuA === skuB) continue;
      const sim = cosineSimilarity(vecA, vecB);
      if (sim > 0.5) { // Only keep meaningfully similar products
        similarities.push({ sku: skuB, similarity: +sim.toFixed(6) });
      }
    }
    similarities.sort((a, b) => b.similarity - a.similarity);
    productSimilarities.set(skuA, similarities.slice(0, K));
  }

  console.log(`   Product Similarities Computed: ${productSimilarities.size} items`);

  /**
   * Find products similar to a given SKU based on content features.
   */
  function findSimilar(sku, limit = 10) {
    const neighbors = productSimilarities.get(sku) || [];
    return neighbors.slice(0, limit).map(n => {
      const product = productMap.get(n.sku);
      return {
        sku: n.sku,
        name: product?.name || n.sku,
        category: product?.category || 'Unknown',
        price: product?.price || 0,
        similarity: n.similarity,
        source: 'content-based',
      };
    });
  }

  /**
   * Recommend products for a user based on their profile vector.
   * Critical for cold-start mitigation (§ spec).
   */
  function recommendForUser(userId, limit = 10) {
    const userProfile = buildUserProfile(userId, orders, productVectors);
    if (!userProfile) return [];

    // Find products the user has already interacted with
    const interactedSkus = new Set();
    for (const order of orders) {
      if (order.userId === userId) {
        for (const item of order.items) {
          interactedSkus.add(item.sku);
        }
      }
    }

    const scored = [];
    for (const [sku, vec] of productVectors) {
      if (interactedSkus.has(sku)) continue;
      const sim = cosineSimilarity(userProfile, vec);
      if (sim > 0.3) {
        const product = productMap.get(sku);
        scored.push({
          sku,
          name: product?.name || sku,
          category: product?.category || 'Unknown',
          price: product?.price || 0,
          score: +sim.toFixed(4),
          source: 'content-based',
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  return { productVectors, productSimilarities, findSimilar, recommendForUser };
}

module.exports = {
  buildProductVector,
  cosineSimilarity,
  buildUserProfile,
  buildContentBasedFilter,
};
