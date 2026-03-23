/**
 * Behavioral Economics Layer — Smart Pairing Engine
 * ===================================================
 * Implements psychological pricing and positioning strategies to
 * maximize Average Order Value through cognitive bias exploitation.
 *
 * Per specification § "Behavioral Economics: The Psychology of the $400 Basket":
 *  - Decoy Effect: three-tier pricing to steer toward target option
 *  - Anchoring: first price sets reference point for all comparisons
 *  - Scarcity / Loss Aversion: FOMO triggers via limited stock messaging
 *  - Social Proof: bandwagon effect through peer purchase data
 *  - Endowment Effect: "Build Your Own Bundle" configurator
 *
 * Developer: NMG
 * References:
 *  - Kensium Behavioral Economics: https://www.kensium.com/blog/behavioral-economics-in-ecommerce
 *  - Forbes E-Commerce Conversions: https://www.forbes.com/councils/forbesbusinessdevelopmentcouncil/2024/09/23/using-behavioral-economics-to-boost-e-commerce-conversions/
 *  - Recharge Cross-Selling Psychology: https://getrecharge.com/blog/the-psychology-of-cross-selling-how-to-influence-customer-behavior/
 *  - IMD Behavioral Economics: https://www.imd.org/research-knowledge/marketing/articles/behavior-economics-in-the-digital-world/
 */

'use strict';

/**
 * Generate a Decoy Pricing Tier for a product bundle.
 *
 * The Decoy Effect (asymmetric dominance) works by introducing a third
 * option that makes the target option appear more rational:
 *  - Option A: Base product only ($200)
 *  - Option B (Decoy): Base + partial bundle ($380 — poor value/feature ratio)
 *  - Option C (Target): Base + full bundle ($400 — clearly superior to B)
 *
 * @param {Object} heroProduct - the anchor/primary product
 * @param {Array<Object>} pairings - recommended complementary products
 * @param {Object} [config]
 * @returns {Object} { tiers: [base, decoy, target], selectedTier, savings }
 */
function generateDecoyPricing(heroProduct, pairings, config = {}) {
  const {
    targetAOV = 400,
    decoyDiscount = 0.05,   // Decoy is only 5% cheaper than target
  } = config;

  if (!heroProduct || pairings.length === 0) {
    return { tiers: [], selectedTier: null, savings: 0 };
  }

  // Sort pairings by profit descending
  const sortedPairings = [...pairings].sort((a, b) => (b.profit || b.price * 0.4) - (a.profit || a.price * 0.4));

  // Base tier: hero product only
  const baseTier = {
    id: 'base',
    label: 'Single Item',
    items: [{ ...heroProduct, quantity: 1 }],
    total: heroProduct.price,
    perItemValue: heroProduct.price,
    isDecoy: false,
    isTarget: false,
    badge: null,
  };

  // Target tier: hero + top complementary items (aiming near $400)
  const targetItems = [{ ...heroProduct, quantity: 1 }];
  let targetTotal = heroProduct.price;

  for (const pairing of sortedPairings) {
    if (targetTotal + pairing.price > targetAOV * 1.2) continue; // Don't exceed target too much
    targetItems.push({ ...pairing, quantity: 1 });
    targetTotal += pairing.price;
    if (targetTotal >= targetAOV * 0.85) break; // Close enough to target
  }

  // Apply a small bundle discount to target (makes it feel even better)
  const bundleDiscount = targetTotal * 0.08;
  const targetFinalPrice = +(targetTotal - bundleDiscount).toFixed(2);

  const targetTier = {
    id: 'target',
    label: 'Complete Bundle',
    items: targetItems,
    originalTotal: +targetTotal.toFixed(2),
    total: targetFinalPrice,
    savings: +bundleDiscount.toFixed(2),
    perItemValue: +(targetFinalPrice / targetItems.length).toFixed(2),
    isDecoy: false,
    isTarget: true,
    badge: 'BEST VALUE',
    itemCount: targetItems.length,
  };

  // Decoy tier: hero + fewer items at nearly the same price (poor value)
  const decoyItems = [{ ...heroProduct, quantity: 1 }];
  let decoyTotal = heroProduct.price;

  // Add only 1-2 items (fewer than target)
  const decoyPairings = sortedPairings.slice(0, Math.max(1, Math.floor(targetItems.length / 2) - 1));
  for (const pairing of decoyPairings) {
    decoyItems.push({ ...pairing, quantity: 1 });
    decoyTotal += pairing.price;
  }

  // Price the decoy close to the target (only slightly cheaper)
  const decoyFinalPrice = +(targetFinalPrice * (1 - decoyDiscount)).toFixed(2);

  const decoyTier = {
    id: 'decoy',
    label: 'Starter Bundle',
    items: decoyItems,
    total: decoyFinalPrice,
    perItemValue: +(decoyFinalPrice / decoyItems.length).toFixed(2),
    isDecoy: true,
    isTarget: false,
    badge: null,
    itemCount: decoyItems.length,
  };

  return {
    tiers: [baseTier, decoyTier, targetTier],
    selectedTier: 'target', // The target tier is the one we want the user to choose
    targetAOV,
    savingsVsIndividual: +bundleDiscount.toFixed(2),
  };
}

/**
 * Generate Anchoring Signals for a product context.
 *
 * Per specification: "The first price a customer sees — the anchor —
 * sets the reference point for all subsequent comparisons."
 *
 * @param {Object} heroProduct - primary product (the anchor)
 * @param {Array<Object>} pairings - recommended products
 * @returns {Object} anchoring data for UI rendering
 */
function generateAnchoringSignals(heroProduct, pairings) {
  if (!heroProduct) return null;

  // The anchor is the hero product's price
  const anchorPrice = heroProduct.price;

  // Show how incremental each pairing feels relative to the anchor
  const incrementalItems = pairings.map(p => ({
    sku: p.sku,
    name: p.name,
    price: p.price,
    incrementalPercentage: +((p.price / anchorPrice) * 100).toFixed(1),
    framing: p.price < anchorPrice * 0.15
      ? `Add for just $${p.price.toFixed(2)} — only ${((p.price / anchorPrice) * 100).toFixed(0)}% of your main item`
      : p.price < anchorPrice * 0.30
        ? `Complete your setup for $${p.price.toFixed(2)} more`
        : `Premium upgrade: $${p.price.toFixed(2)}`,
  }));

  return {
    anchorProduct: heroProduct.name,
    anchorPrice,
    incrementalItems,
    totalWithAll: +(anchorPrice + pairings.reduce((s, p) => s + p.price, 0)).toFixed(2),
  };
}

/**
 * Generate Scarcity and Loss Aversion Signals.
 *
 * Per specification: "'Only 3 left at this price!' or 'Don't miss out —
 * offer ends in 20 minutes!' triggers FOMO. Humans are wired to prefer
 * avoiding losses over acquiring equivalent gains."
 *
 * @param {Array<Object>} products - products to generate scarcity for
 * @returns {Array<Object>} scarcity signals
 */
function generateScarcitySignals(products) {
  return products.map(product => {
    const signals = [];

    // Low stock warning
    if (product.stock <= 10) {
      signals.push({
        type: 'low_stock',
        severity: product.stock <= 3 ? 'critical' : 'warning',
        message: product.stock <= 3
          ? `Only ${product.stock} left — selling fast!`
          : `Only ${product.stock} remaining at this price`,
        icon: '🔥',
      });
    }

    // High demand indicator (based on review count as proxy)
    if (product.reviewCount > 500) {
      signals.push({
        type: 'high_demand',
        severity: 'info',
        message: `${product.reviewCount.toLocaleString()}+ customers chose this`,
        icon: '⚡',
      });
    }

    // Time-limited framing (simulated)
    if (product.margin > 0.45) {
      signals.push({
        type: 'time_limited',
        severity: 'warning',
        message: 'Bundle pricing ends soon',
        icon: '⏰',
      });
    }

    return {
      sku: product.sku,
      name: product.name,
      signals,
      urgencyScore: signals.reduce((s, sig) =>
        s + (sig.severity === 'critical' ? 3 : sig.severity === 'warning' ? 2 : 1), 0
      ),
    };
  });
}

/**
 * Generate Social Proof Data.
 *
 * Per specification: "Highlighting that 'Others also bought these together'
 * or '10,000+ customers chose this bundle' creates a bandwagon effect."
 *
 * @param {Object} heroProduct
 * @param {Array<Object>} pairings
 * @param {Array<Object>} orders - order history for co-purchase counting
 * @returns {Object} social proof signals
 */
function generateSocialProof(heroProduct, pairings, orders) {
  if (!heroProduct) return null;

  // Count how many orders contain the hero product
  const heroOrders = orders.filter(o =>
    o.items.some(i => i.sku === heroProduct.sku)
  );

  // Count co-purchases for each pairing
  const coPurchases = pairings.map(pairing => {
    const coCount = heroOrders.filter(o =>
      o.items.some(i => i.sku === pairing.sku)
    ).length;

    return {
      sku: pairing.sku,
      name: pairing.name,
      coPurchaseCount: coCount,
      coPurchaseRate: heroOrders.length > 0
        ? +((coCount / heroOrders.length) * 100).toFixed(1)
        : 0,
      message: coCount > 5
        ? `${coCount} customers bought these together`
        : coCount > 0
          ? 'Frequently purchased together'
          : 'Recommended pairing',
    };
  });

  return {
    heroProduct: heroProduct.name,
    totalBuyers: heroOrders.length,
    averageRating: heroProduct.rating,
    reviewCount: heroProduct.reviewCount,
    coPurchases: coPurchases.sort((a, b) => b.coPurchaseCount - a.coPurchaseCount),
    trustBadge: heroProduct.rating >= 4.5
      ? 'Top Rated'
      : heroProduct.reviewCount >= 500
        ? 'Customer Favorite'
        : 'Verified Quality',
  };
}

/**
 * Generate "Build Your Own Bundle" Configurator Data.
 *
 * Per specification § "Endowment Effect and Personalization":
 * "Once a user has spent time interacting with a personalized set of
 * paired objects, they develop an emotional investment that makes them
 * reluctant to abandon the cart."
 *
 * @param {Object} heroProduct
 * @param {Array<Object>} pairings - available add-on products
 * @param {Object} [config]
 * @returns {Object} configurator data structure
 */
function generateBundleConfigurator(heroProduct, pairings, config = {}) {
  const { maxAddOns = 5, discountTiers = [3, 5, 8] } = config;

  if (!heroProduct) return null;

  // Group pairings by category
  const categories = {};
  for (const p of pairings.slice(0, maxAddOns * 2)) {
    const cat = p.category || 'Other';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push({
      sku: p.sku,
      name: p.name,
      price: p.price,
      margin: p.margin || 0,
      selected: false,
    });
  }

  // Discount tiers: more items = bigger discount (endowment effect reinforcement)
  const tiers = [
    { minItems: discountTiers[0] || 3, discount: 0.05, label: 'Save 5%' },
    { minItems: discountTiers[1] || 5, discount: 0.10, label: 'Save 10%' },
    { minItems: discountTiers[2] || 8, discount: 0.15, label: 'Save 15%' },
  ];

  return {
    heroProduct: {
      sku: heroProduct.sku,
      name: heroProduct.name,
      price: heroProduct.price,
      isRequired: true,
    },
    availableAddOns: categories,
    discountTiers: tiers,
    currentSelection: [heroProduct.sku],
    currentTotal: heroProduct.price,
    currentDiscount: 0,
    maxAddOns,
  };
}

/**
 * Generate the complete Behavioral Economics package for a product context.
 *
 * @param {Object} heroProduct
 * @param {Array<Object>} pairings
 * @param {Array<Object>} orders
 * @param {Array<Object>} products
 * @returns {Object} complete behavioral economics data
 */
function generateBehavioralPackage(heroProduct, pairings, orders, products) {
  const productMap = new Map(products.map(p => [p.sku, p]));

  // Enrich pairings with full product data
  const enrichedPairings = pairings.map(p => ({
    ...p,
    ...(productMap.get(p.sku) || {}),
  }));

  return {
    decoyPricing: generateDecoyPricing(heroProduct, enrichedPairings),
    anchoring: generateAnchoringSignals(heroProduct, enrichedPairings),
    scarcity: generateScarcitySignals([heroProduct, ...enrichedPairings]),
    socialProof: generateSocialProof(heroProduct, enrichedPairings, orders),
    bundleConfigurator: generateBundleConfigurator(heroProduct, enrichedPairings),
    engineLabel: 'Smart Pairing Engine — Behavioral Economics Layer',
    developer: 'NMG',
  };
}

module.exports = {
  generateDecoyPricing,
  generateAnchoringSignals,
  generateScarcitySignals,
  generateSocialProof,
  generateBundleConfigurator,
  generateBehavioralPackage,
};
