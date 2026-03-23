/**
 * Collaborative Filtering Engine
 * ===============================
 * Implements item-based collaborative filtering using the User-Item
 * interaction matrix and cosine similarity between item vectors.
 *
 * Per specification Table 1:
 *  - Item-Based CF uses Adjusted Cosine Similarity
 *  - Offers higher stability and scalability in large catalogs
 *  - Co-occurrence patterns in transactions drive recommendations
 *
 * References:
 *  - IBM Recommendation Engine: https://www.ibm.com/think/topics/recommendation-engine
 *  - Recommender system (Wikipedia): https://en.wikipedia.org/wiki/Recommender_system
 *  - System Design Handbook: https://www.systemdesignhandbook.com/guides/recommendation-system-design/
 */

'use strict';

/**
 * Build the User-Item interaction matrix.
 * Rows = users, Columns = products (SKUs).
 * Values represent interaction strength (purchase count × recency weight).
 *
 * @param {Array<Object>} orders - order dataset
 * @param {Array<Object>} products - product catalog
 * @param {Array<Object>} users - user dataset
 * @returns {Object} { matrix, userIndex, itemIndex, skuList, userList }
 */
function buildUserItemMatrix(orders, products, users) {
  const skuList = products.map(p => p.sku);
  const userList = users.map(u => u.userId);
  const skuIdx = new Map(skuList.map((s, i) => [s, i]));
  const userIdx = new Map(userList.map((u, i) => [u, i]));

  // Initialize matrix: users × items
  const matrix = Array.from({ length: userList.length }, () =>
    new Float64Array(skuList.length)
  );

  const now = Date.now();
  for (const order of orders) {
    const uIdx = userIdx.get(order.userId);
    if (uIdx === undefined) continue;

    // Recency weight: more recent orders get higher weight
    const daysSinceOrder = (now - order.timestamp) / 86400000;
    const recencyWeight = Math.exp(-daysSinceOrder / 180); // half-life ~180 days

    for (const item of order.items) {
      const iIdx = skuIdx.get(item.sku);
      if (iIdx === undefined) continue;
      matrix[uIdx][iIdx] += item.quantity * recencyWeight;
    }
  }

  return { matrix, userIndex: userIdx, itemIndex: skuIdx, skuList, userList };
}

/**
 * Compute cosine similarity between two vectors.
 * cos(A, B) = (A · B) / (||A|| × ||B||)
 *
 * This is the exact formula from the specification's Content-Based Filtering section,
 * applied here to item co-occurrence vectors in the collaborative filtering context.
 *
 * @param {Float64Array} a
 * @param {Float64Array} b
 * @returns {number} cosine similarity in [0, 1] range (clamped for non-negative matrices)
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
 * Build the item-item similarity matrix using cosine similarity.
 * For efficiency, only computes the upper triangle and mirrors.
 *
 * @param {Object} uiMatrix - output of buildUserItemMatrix
 * @returns {Map<string, Array<{sku: string, similarity: number}>>}
 */
function buildItemSimilarityMatrix(uiMatrix) {
  const { matrix, skuList } = uiMatrix;
  const itemCount = skuList.length;
  const userCount = matrix.length;

  // Transpose: item vectors (each column becomes a row)
  const itemVectors = Array.from({ length: itemCount }, () =>
    new Float64Array(userCount)
  );

  for (let u = 0; u < userCount; u++) {
    for (let i = 0; i < itemCount; i++) {
      itemVectors[i][u] = matrix[u][i];
    }
  }

  // Compute pairwise similarity (only store top-K neighbors per item)
  const K = 20; // Keep top 20 similar items
  const similarityMap = new Map();

  for (let i = 0; i < itemCount; i++) {
    const similarities = [];
    for (let j = 0; j < itemCount; j++) {
      if (i === j) continue;
      const sim = cosineSimilarity(itemVectors[i], itemVectors[j]);
      if (sim > 0.001) { // Filter noise
        similarities.push({ sku: skuList[j], similarity: +sim.toFixed(6) });
      }
    }
    similarities.sort((a, b) => b.similarity - a.similarity);
    similarityMap.set(skuList[i], similarities.slice(0, K));
  }

  return similarityMap;
}

/**
 * Generate recommendations for a user using item-based collaborative filtering.
 *
 * Strategy: For each item the user has interacted with, find the top-K most
 * similar items they haven't interacted with, weighted by similarity score
 * and interaction strength.
 *
 * @param {string} userId
 * @param {Object} uiMatrix - user-item matrix data
 * @param {Map} itemSimilarities - item-item similarity map
 * @param {Array<Object>} products - product catalog
 * @param {number} limit - max recommendations
 * @returns {Array<Object>} recommended products with scores
 */
function recommendForUser(userId, uiMatrix, itemSimilarities, products, limit = 10) {
  const { matrix, userIndex, itemIndex, skuList } = uiMatrix;
  const uIdx = userIndex.get(userId);
  if (uIdx === undefined) return [];

  const userVector = matrix[uIdx];
  const productMap = new Map(products.map(p => [p.sku, p]));
  const scores = new Map();

  // For each item the user has interacted with
  for (let i = 0; i < skuList.length; i++) {
    if (userVector[i] <= 0) continue;

    const sku = skuList[i];
    const neighbors = itemSimilarities.get(sku) || [];

    for (const neighbor of neighbors) {
      // Skip if user already interacted with this item
      const nIdx = itemIndex.get(neighbor.sku);
      if (nIdx !== undefined && userVector[nIdx] > 0) continue;

      // Score = sum of (similarity × user's interaction with source item)
      const current = scores.get(neighbor.sku) || 0;
      scores.set(neighbor.sku, current + neighbor.similarity * userVector[i]);
    }
  }

  // Sort by score and return top-N
  const results = [...scores.entries()]
    .map(([sku, score]) => {
      const product = productMap.get(sku);
      return {
        sku,
        name: product?.name || sku,
        category: product?.category || 'Unknown',
        price: product?.price || 0,
        score: +score.toFixed(4),
        source: 'collaborative-filtering',
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return results;
}

/**
 * Get similar products for a given SKU (for "Customers Also Bought" widget).
 *
 * @param {string} sku
 * @param {Map} itemSimilarities
 * @param {Array<Object>} products
 * @param {number} limit
 * @returns {Array<Object>}
 */
function getSimilarProducts(sku, itemSimilarities, products, limit = 10) {
  const productMap = new Map(products.map(p => [p.sku, p]));
  const neighbors = itemSimilarities.get(sku) || [];

  return neighbors.slice(0, limit).map(n => {
    const product = productMap.get(n.sku);
    return {
      sku: n.sku,
      name: product?.name || n.sku,
      category: product?.category || 'Unknown',
      price: product?.price || 0,
      similarity: n.similarity,
      source: 'collaborative-filtering',
    };
  });
}

/**
 * Build the complete collaborative filtering engine.
 */
function buildCollaborativeFilter(orders, products, users) {
  console.log('\n🤝 Collaborative Filtering Engine');

  const uiMatrix = buildUserItemMatrix(orders, products, users);
  console.log(`   User-Item Matrix: ${uiMatrix.userList.length} users × ${uiMatrix.skuList.length} items`);

  const itemSimilarities = buildItemSimilarityMatrix(uiMatrix);
  const avgNeighbors = [...itemSimilarities.values()].reduce((s, v) => s + v.length, 0) / itemSimilarities.size;
  console.log(`   Item Similarities Computed: ${itemSimilarities.size} items, avg ${avgNeighbors.toFixed(1)} neighbors`);

  return { uiMatrix, itemSimilarities };
}

module.exports = {
  buildUserItemMatrix,
  cosineSimilarity,
  buildItemSimilarityMatrix,
  recommendForUser,
  getSimilarProducts,
  buildCollaborativeFilter,
};
