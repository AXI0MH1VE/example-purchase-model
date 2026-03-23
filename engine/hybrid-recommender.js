/**
 * Hybrid Recommender Orchestrator — Smart Pairing Engine
 * =======================================================
 * Combines Association Rule Learning, Collaborative Filtering, and
 * Content-Based Filtering with weighted scoring and business logic overlays.
 *
 * Per specification § "Hybridization as an Enterprise Utility":
 *  - Hybrid systems combine behavioral insights (CF) with attribute-driven
 *    precision (content-based) for high accuracy across all surfaces.
 *  - Business logic: suppress out-of-stock, boost hero products, enforce
 *    margin thresholds, and anti-cannibalization filtering.
 *
 * Developer: NMG
 * References:
 *  - IBM Recommendation Engine: https://www.ibm.com/think/topics/recommendation-engine
 *  - Algonomy Personalized Search: https://algonomy.com/digital-experience-personalization/personalized-search-and-discovery/
 *  - RBMSoft AI Recommendations: https://rbmsoft.com/blogs/ai-powered-product-recommendations/
 */

'use strict';

// ─── Default Hybrid Weights ─────────────────────────────────────────────────
// These can be tuned per-store via the API configuration.
const DEFAULT_WEIGHTS = {
  associationRules: 0.35,   // Highest weight: direct co-purchase evidence
  collaborativeFiltering: 0.30, // Peer-behavior patterns
  contentBased: 0.20,        // Feature similarity (cold-start safety net)
  popularity: 0.15,          // Global trending / review momentum
};

/**
 * Compute a global popularity score for each product.
 * Based on order frequency, review count, and rating — all normalized.
 *
 * @param {Array<Object>} products
 * @param {Array<Object>} orders
 * @returns {Map<string, number>} sku → popularity score (0-1)
 */
function computePopularityScores(products, orders) {
  const orderFreq = new Map();
  for (const order of orders) {
    for (const item of order.items) {
      orderFreq.set(item.sku, (orderFreq.get(item.sku) || 0) + 1);
    }
  }

  const maxFreq = Math.max(...orderFreq.values(), 1);
  const scores = new Map();

  for (const product of products) {
    const freq = (orderFreq.get(product.sku) || 0) / maxFreq;
    const ratingNorm = (product.rating - 1) / 4;
    const reviewNorm = Math.min(Math.log(product.reviewCount + 1) / Math.log(1201), 1.0);

    // Weighted popularity: frequency matters most
    const score = freq * 0.5 + ratingNorm * 0.25 + reviewNorm * 0.25;
    scores.set(product.sku, +score.toFixed(4));
  }

  return scores;
}

/**
 * Anti-Cannibalization Filter
 * ============================
 * Per specification § "Portfolio Management: Mitigating Product Cannibalization":
 *  - Prioritize complementary products over interchangeable ones
 *  - Prevent recommendations that steal sales from higher-margin items
 *
 * Two products are "interchangeable" if they share the same category
 * AND are in the same price tier (within 30% of each other).
 *
 * @param {Array<Object>} recommendations
 * @param {Object} sourceProduct - the product being viewed
 * @param {Array<Object>} products - full catalog
 * @returns {Array<Object>} filtered recommendations
 */
function antiCannibalizationFilter(recommendations, sourceProduct, products) {
  if (!sourceProduct) return recommendations;

  const productMap = new Map(products.map(p => [p.sku, p]));

  return recommendations.filter(rec => {
    const recProduct = productMap.get(rec.sku);
    if (!recProduct) return true;

    // Same category AND similar price = interchangeable (cannibalize risk)
    if (recProduct.category === sourceProduct.category) {
      const priceRatio = recProduct.price / sourceProduct.price;
      if (priceRatio > 0.7 && priceRatio < 1.3) {
        // Allow if the recommended product has a HIGHER margin
        return recProduct.margin > sourceProduct.margin;
      }
    }

    return true; // Different category = complementary → keep
  });
}

/**
 * Business Logic Overlay
 * =======================
 * Applies store-level constraints:
 *  - Suppress out-of-stock items (stock ≤ 0)
 *  - Boost hero products (high margin + high rating)
 *  - Enforce minimum margin threshold
 *
 * @param {Array<Object>} recommendations
 * @param {Array<Object>} products
 * @param {Object} config
 * @returns {Array<Object>}
 */
function applyBusinessLogic(recommendations, products, config = {}) {
  const {
    minMargin = 0.25,      // Minimum 25% margin
    heroBoost = 1.5,        // 1.5x score multiplier for hero products
    heroMinRating = 4.3,    // Rating threshold for hero status
    heroMinMargin = 0.45,   // Margin threshold for hero status
  } = config;

  const productMap = new Map(products.map(p => [p.sku, p]));

  return recommendations
    .map(rec => {
      const product = productMap.get(rec.sku);
      if (!product) return null;

      // Suppress out-of-stock
      if (product.stock <= 0) return null;

      // Suppress below minimum margin
      if (product.margin < minMargin) return null;

      // Hero product boost
      let boostedScore = rec.score;
      if (product.rating >= heroMinRating && product.margin >= heroMinMargin) {
        boostedScore *= heroBoost;
        rec.isHero = true;
      }

      return { ...rec, score: +boostedScore.toFixed(4) };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
}

/**
 * Merge and de-duplicate recommendations from multiple sources.
 * Applies weighted scoring per the hybrid model.
 *
 * @param {Object} sources - { arl: [], cf: [], cb: [], popularity: Map }
 * @param {Object} weights - scoring weights per source
 * @param {Array<Object>} products
 * @returns {Array<Object>} merged recommendations
 */
function mergeRecommendations(sources, weights = DEFAULT_WEIGHTS, products = []) {
  const productMap = new Map(products.map(p => [p.sku, p]));
  const merged = new Map();

  // ARL-sourced recommendations
  for (const rec of (sources.arl || [])) {
    const existing = merged.get(rec.sku) || createEmptyRec(rec, productMap);
    existing.score += (rec.lift || rec.score || 1) * weights.associationRules;
    existing.sources.push('arl');
    if (rec.lift) existing.lift = rec.lift;
    if (rec.confidence) existing.confidence = rec.confidence;
    if (rec.support) existing.support = rec.support;
    merged.set(rec.sku, existing);
  }

  // Collaborative Filtering
  for (const rec of (sources.cf || [])) {
    const existing = merged.get(rec.sku) || createEmptyRec(rec, productMap);
    existing.score += (rec.score || rec.similarity || 0.5) * weights.collaborativeFiltering;
    existing.sources.push('cf');
    if (rec.similarity) existing.similarity = rec.similarity;
    merged.set(rec.sku, existing);
  }

  // Content-Based Filtering
  for (const rec of (sources.cb || [])) {
    const existing = merged.get(rec.sku) || createEmptyRec(rec, productMap);
    existing.score += (rec.score || rec.similarity || 0.5) * weights.contentBased;
    existing.sources.push('cb');
    merged.set(rec.sku, existing);
  }

  // Popularity baseline
  if (sources.popularity) {
    for (const [sku, popScore] of sources.popularity) {
      const existing = merged.get(sku);
      if (existing) {
        existing.score += popScore * weights.popularity;
      }
    }
  }

  // Normalize scores and sort
  const results = [...merged.values()];
  const maxScore = Math.max(...results.map(r => r.score), 0.001);
  for (const r of results) {
    r.score = +(r.score / maxScore).toFixed(4);
    r.sourceCount = new Set(r.sources).size;
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

function createEmptyRec(rec, productMap) {
  const product = productMap.get(rec.sku);
  return {
    sku: rec.sku,
    name: product?.name || rec.name || rec.sku,
    category: product?.category || rec.category || 'Unknown',
    price: product?.price || rec.price || 0,
    margin: product?.margin || 0,
    profit: product?.profit || 0,
    rating: product?.rating || 0,
    score: 0,
    sources: [],
    isHero: false,
  };
}

/**
 * Smart Pairing Engine — Main Recommendation Pipeline
 * =====================================================
 * Full hybrid pipeline for a given context (user + optional product).
 *
 * @param {Object} params
 * @param {string} params.userId - target user
 * @param {string} [params.productSku] - optional: product currently being viewed
 * @param {Object} params.engines - { arlEngine, cfEngine, cbEngine }
 * @param {Array<Object>} params.products
 * @param {Array<Object>} params.orders
 * @param {Object} [params.weights]
 * @param {number} [params.limit]
 * @returns {Object} { recommendations, metadata }
 */
function generateSmartPairings(params) {
  const {
    userId,
    productSku,
    engines,
    products,
    orders,
    weights = DEFAULT_WEIGHTS,
    limit = 10,
  } = params;

  const startTime = Date.now();
  const productMap = new Map(products.map(p => [p.sku, p]));
  const sourceProduct = productSku ? productMap.get(productSku) : null;

  // ── Gather recommendations from each engine ──
  const sources = { arl: [], cf: [], cb: [], popularity: null };

  // 1. Association Rules — "Customers who bought X also bought Y"
  if (engines.arlEngine && productSku) {
    const arlRules = engines.arlEngine.rules
      .filter(r => r.antecedent.includes(productSku))
      .slice(0, 20);

    for (const rule of arlRules) {
      for (const sku of rule.consequent) {
        sources.arl.push({
          sku,
          name: productMap.get(sku)?.name || sku,
          lift: rule.lift,
          confidence: rule.confidence,
          support: rule.support,
          score: rule.profitScore || rule.lift,
        });
      }
    }
  }

  // 2. Collaborative Filtering — peer-based
  if (engines.cfEngine && userId) {
    const { uiMatrix, itemSimilarities } = engines.cfEngine;
    const cfModule = require('./collaborative-filtering');
    sources.cf = cfModule.recommendForUser(userId, uiMatrix, itemSimilarities, products, 20);
  }

  // 3. Content-Based — feature similarity
  if (engines.cbEngine) {
    if (productSku) {
      sources.cb = engines.cbEngine.findSimilar(productSku, 20);
    } else if (userId) {
      sources.cb = engines.cbEngine.recommendForUser(userId, 20);
    }
  }

  // 4. Popularity scores
  sources.popularity = computePopularityScores(products, orders);

  // ── Merge, filter, and rank ──
  let recommendations = mergeRecommendations(sources, weights, products);

  // Anti-cannibalization
  if (sourceProduct) {
    recommendations = antiCannibalizationFilter(recommendations, sourceProduct, products);
  }

  // Business logic overlay
  recommendations = applyBusinessLogic(recommendations, products);

  // Exclude the source product itself
  if (productSku) {
    recommendations = recommendations.filter(r => r.sku !== productSku);
  }

  // Limit results
  recommendations = recommendations.slice(0, limit);

  const latencyMs = Date.now() - startTime;

  // ── Compute potential AOV ──
  const basePrice = sourceProduct?.price || 0;
  const bundleTotal = basePrice + recommendations.reduce((s, r) => s + r.price, 0);

  return {
    recommendations,
    metadata: {
      engine: 'Smart Pairing Engine v1.0',
      developer: 'NMG',
      userId,
      productSku,
      sourceCount: {
        arl: sources.arl.length,
        cf: sources.cf.length,
        cb: sources.cb.length,
      },
      latencyMs,
      basePrice,
      bundleTotal: +bundleTotal.toFixed(2),
      aovUplift: basePrice > 0 ? +((bundleTotal / basePrice - 1) * 100).toFixed(1) : 0,
      weights,
    },
  };
}

module.exports = {
  DEFAULT_WEIGHTS,
  computePopularityScores,
  antiCannibalizationFilter,
  applyBusinessLogic,
  mergeRecommendations,
  generateSmartPairings,
};
