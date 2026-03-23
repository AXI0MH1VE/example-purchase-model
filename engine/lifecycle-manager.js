/**
 * Product Lifecycle Manager (PLM) — Axiom Hive Intelligence
 * =========================================================
 * Automates the dynamic calibration of the product catalog based on
 * "Trending Charts" and performance velocity.
 *
 * Core Functionality:
 *  - Trending Analysis: Calculates "Velocity Score" (change in sales/period).
 *  - Automated Removal: Identifies stagnant SKU's (Z-grade inventory) for decommissioning.
 *  - Automated Addition: Synthesizes new SKU data for high-demand white spaces.
 *
 * Per specification § "Dynamic Inventory Resilience":
 *  - Continuous catalog auditing prevents "Catalogue Bloat."
 *  - Trending-driven additions ensure the engine stays relevant to shifting markets.
 *
 * Developer: NMG
 * Version: 1.0
 */

'use strict';

/**
 * Perform a full lifecycle audit of the catalog.
 * 
 * @param {Array<Object>} products - Current catalog
 * @param {Array<Object>} orders - Historic transactions
 * @returns {Object} { removed, added, updatedCatalog }
 */
function auditProductLifecycle(products, orders) {
  const productMap = new Map(products.map(p => [p.sku, p]));
  
  // 1. Calculate Product Performance Velocity
  // We compare the last 20% of orders to the first 80% to find "Trending" vs "Stagnant"
  const splitIdx = Math.floor(orders.length * 0.8);
  const baselineOrders = orders.slice(0, splitIdx);
  const recentOrders = orders.slice(splitIdx);

  const freqBaseline = countFrequency(baselineOrders);
  const freqRecent = countFrequency(recentOrders);

  const velocityScores = new Map();
  for (const product of products) {
    const baseline = (freqBaseline.get(product.sku) || 0) / (baselineOrders.length || 1);
    const recent = (freqRecent.get(product.sku) || 0) / (recentOrders.length || 1);
    
    // Velocity: (Recent Frequency / Baseline Frequency)
    // > 1.0 means trending UP, < 1.0 means trending DOWN
    const velocity = baseline > 0 ? recent / baseline : (recent > 0 ? 2.0 : 1.0);
    velocityScores.set(product.sku, +velocity.toFixed(4));
  }

  // 2. Automated Removal (Identify Stagnant Items)
  // Logic: Bottom 10% by popularity AND low velocity
  const removalThreshold = 0.5; // Velocity < 0.5 (dropped by half)
  const removed = products
    .filter(p => velocityScores.get(p.sku) < removalThreshold && p.rating < 3.0)
    .map(p => p.sku);

  // 3. Automated Addition (Trending High-Category Injection)
  // Logic: Identify top 3 categories by revenue growth and add 1 "Synthetic New Arrival" to each.
  const categoryGrowth = analyzeCategoryGrowth(products, baselineOrders, recentOrders);
  const topCategories = categoryGrowth
    .sort((a, b) => b.growth - a.growth)
    .slice(0, 3);

  const added = [];
  for (const cat of topCategories) {
    const newSku = `NEW-${cat.name.substring(0, 3).toUpperCase()}-${Math.floor(Math.random() * 99999)}`;
    const prototype = products.find(p => p.category === cat.name) || products[0];
    
    added.push({
      sku: newSku,
      name: `Trending ${cat.name} ${prototype.name.split(' ').pop()}`,
      category: cat.name,
      price: +(prototype.price * (0.9 + Math.random() * 0.4)).toFixed(2),
      margin: +(0.3 + Math.random() * 0.4).toFixed(2),
      stock: 50,
      rating: 5.0, // New products start with high "Curated" rating
      reviewCount: 0,
      isNew: true,
      addedAt: new Date().toISOString()
    });
  }

  // 4. Construct Updated Catalog
  const updatedCatalog = products
    .filter(p => !removed.includes(p.sku))
    .concat(added);

  return {
    removedCount: removed.length,
    addedCount: added.length,
    removedSkus: removed,
    addedProducts: added,
    updatedCatalog,
    stats: {
      averageVelocity: +([...velocityScores.values()].reduce((s, v) => s + v, 0) / products.length).toFixed(2),
      topCategories: topCategories.map(c => c.name)
    }
  };
}

function countFrequency(orders) {
  const counts = new Map();
  for (const order of orders) {
    for (const item of order.items) {
      counts.set(item.sku, (counts.get(item.sku) || 0) + 1);
    }
  }
  return counts;
}

function analyzeCategoryGrowth(products, baseline, recent) {
  const pMap = new Map(products.map(p => [p.sku, p]));
  const categories = [...new Set(products.map(p => p.category))];
  
  return categories.map(cat => {
    const baseRev = baseline.reduce((s, o) => s + o.items.filter(i => i.category === cat).reduce((s2, i) => s2 + i.price, 0), 0);
    const recentRev = recent.reduce((s, o) => s + o.items.filter(i => i.category === cat).reduce((s2, i) => s2 + i.price, 0), 0);
    
    // Normalize by sample size
    const normBase = baseRev / (baseline.length || 1);
    const normRecent = recentRev / (recent.length || 1);
    
    return {
      name: cat,
      growth: normBase > 0 ? normRecent / normBase : 1.0
    };
  });
}

module.exports = {
  auditProductLifecycle
};
