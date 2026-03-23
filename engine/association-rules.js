/**
 * Association Rule Learning (ARL) Engine
 * =======================================
 * Implements the Apriori algorithm for discovering product co-occurrence
 * patterns, computing Support, Confidence, and Lift metrics.
 *
 * Mathematical Foundations (per specification):
 *  - Support(A∪B) = freq(A∪B) / N
 *  - Confidence(A→B) = Support(A∪B) / Support(A)
 *  - Lift(A→B) = Confidence(A→B) / Support(B)
 *
 * References:
 *  - Association rule learning: https://en.wikipedia.org/wiki/Association_rule_learning
 *  - Affinity Analysis: https://www.optimizely.com/optimization-glossary/affinity-analysis/
 *  - DSFOR ARL: https://dsfor.com/association-rule-learning/
 */

'use strict';

/**
 * Apriori Algorithm — Level-wise frequent itemset mining.
 * Uses downward closure (anti-monotone) property for pruning:
 * if an itemset is infrequent, all its supersets are also infrequent.
 *
 * @param {Array<Array<string>>} transactions – array of baskets (each basket is an array of SKUs)
 * @param {number} minSupport – minimum support threshold (0–1)
 * @param {number} maxSize – maximum itemset size (default 3 for pairs/triples)
 * @returns {Map<string, number>} frequentItemsets – key is sorted SKU string, value is support count
 */
function apriori(transactions, minSupport = 0.01, maxSize = 3) {
  const N = transactions.length;
  const minCount = Math.ceil(minSupport * N);
  const frequentItemsets = new Map();

  // ── Pass 1: Count single items ──
  const itemCounts = new Map();
  for (const basket of transactions) {
    for (const item of basket) {
      itemCounts.set(item, (itemCounts.get(item) || 0) + 1);
    }
  }

  // Filter to frequent 1-itemsets
  let currentLevel = [];
  for (const [item, count] of itemCounts) {
    if (count >= minCount) {
      const key = item;
      frequentItemsets.set(key, count);
      currentLevel.push([item]);
    }
  }

  // ── Passes 2..maxSize: Generate candidates and count ──
  for (let k = 2; k <= maxSize && currentLevel.length > 0; k++) {
    const candidates = generateCandidates(currentLevel);
    const candidateCounts = new Map();

    for (const basket of transactions) {
      const basketSet = new Set(basket);
      for (const candidate of candidates) {
        if (candidate.every(item => basketSet.has(item))) {
          const key = candidate.join('|');
          candidateCounts.set(key, (candidateCounts.get(key) || 0) + 1);
        }
      }
    }

    currentLevel = [];
    for (const [key, count] of candidateCounts) {
      if (count >= minCount) {
        frequentItemsets.set(key, count);
        currentLevel.push(key.split('|'));
      }
    }
  }

  return frequentItemsets;
}

/**
 * Generate candidate itemsets of size k+1 from frequent itemsets of size k.
 * Uses the Apriori candidate generation strategy (join + prune).
 */
function generateCandidates(prevLevel) {
  const candidates = [];
  for (let i = 0; i < prevLevel.length; i++) {
    for (let j = i + 1; j < prevLevel.length; j++) {
      const a = prevLevel[i];
      const b = prevLevel[j];

      // Check if first k-2 elements are identical (sorted order)
      let canJoin = true;
      for (let x = 0; x < a.length - 1; x++) {
        if (a[x] !== b[x]) { canJoin = false; break; }
      }
      if (canJoin && a[a.length - 1] < b[b.length - 1]) {
        candidates.push([...a, b[b.length - 1]]);
      }
    }
  }
  return candidates;
}

/**
 * Generate association rules from frequent itemsets.
 *
 * @param {Map<string, number>} frequentItemsets
 * @param {number} N – total transaction count
 * @param {number} minConfidence – minimum confidence threshold
 * @param {Array<Object>} products – product catalog for profit data
 * @param {number} minLift – minimum lift threshold (default 1.0)
 * @returns {Array<Object>} rules sorted by lift descending
 */
function generateRules(frequentItemsets, N, minConfidence = 0.3, products = [], minLift = 1.0) {
  const rules = [];
  const productMap = new Map(products.map(p => [p.sku, p]));

  for (const [key, count] of frequentItemsets) {
    const items = key.split('|');
    if (items.length < 2) continue;

    // Generate all non-empty subsets as antecedents
    const subsets = getAllSubsets(items);
    for (const antecedent of subsets) {
      if (antecedent.length === 0 || antecedent.length === items.length) continue;

      const consequent = items.filter(i => !antecedent.includes(i));
      const antecedentKey = antecedent.length === 1 ? antecedent[0] : antecedent.join('|');
      const consequentKey = consequent.length === 1 ? consequent[0] : consequent.join('|');

      const supportAB = count / N;
      const supportA = (frequentItemsets.get(antecedentKey) || 0) / N;
      const supportB = (frequentItemsets.get(consequentKey) || 0) / N;

      if (supportA === 0 || supportB === 0) continue;

      const confidence = supportAB / supportA;
      const lift = confidence / supportB;

      if (confidence < minConfidence || lift < minLift) continue;

      // Compute average profit margin for the consequent items
      let avgProfit = 0;
      let profitCount = 0;
      for (const sku of consequent) {
        const prod = productMap.get(sku);
        if (prod) { avgProfit += prod.profit; profitCount++; }
      }
      avgProfit = profitCount > 0 ? avgProfit / profitCount : 0;

      rules.push({
        antecedent,
        consequent,
        antecedentNames: antecedent.map(s => productMap.get(s)?.name || s),
        consequentNames: consequent.map(s => productMap.get(s)?.name || s),
        support: +supportAB.toFixed(6),
        confidence: +confidence.toFixed(4),
        lift: +lift.toFixed(4),
        count,
        avgProfit: +avgProfit.toFixed(2),
        profitScore: +(lift * avgProfit).toFixed(2), // Lift × Profit composite
      });
    }
  }

  // Sort by lift descending (highest affinity first)
  rules.sort((a, b) => b.lift - a.lift);
  return rules;
}

/**
 * Get all non-empty proper subsets of an array.
 */
function getAllSubsets(arr) {
  const subsets = [];
  const total = 1 << arr.length;
  for (let mask = 1; mask < total - 1; mask++) {
    const subset = [];
    for (let i = 0; i < arr.length; i++) {
      if (mask & (1 << i)) subset.push(arr[i]);
    }
    subsets.push(subset.sort());
  }
  return subsets;
}

/**
 * Build the ARL engine from order data.
 *
 * @param {Array<Object>} orders – order dataset
 * @param {Array<Object>} products – product catalog
 * @param {Object} opts – { minSupport, minConfidence, minLift, maxSize }
 * @returns {Object} { rules, frequentItemsets, transactionCount }
 */
function buildAssociationRules(orders, products, opts = {}) {
  const {
    minSupport = 0.008,
    minConfidence = 0.25,
    minLift = 1.0,
    maxSize = 3,
  } = opts;

  // Convert orders to transaction baskets (arrays of SKUs)
  const transactions = orders.map(o => o.items.map(i => i.sku));
  const N = transactions.length;

  console.log(`\n🔍 Association Rule Learning`);
  console.log(`   Transactions: ${N}`);
  console.log(`   Min Support:  ${minSupport} (${Math.ceil(minSupport * N)} transactions)`);
  console.log(`   Min Confidence: ${minConfidence}`);
  console.log(`   Min Lift:     ${minLift}`);

  const frequentItemsets = apriori(transactions, minSupport, maxSize);
  console.log(`   Frequent Itemsets Found: ${frequentItemsets.size}`);

  const rules = generateRules(frequentItemsets, N, minConfidence, products, minLift);
  console.log(`   Association Rules Generated: ${rules.length}`);

  if (rules.length > 0) {
    console.log(`   Top Rule: ${rules[0].antecedentNames.join(' + ')} → ${rules[0].consequentNames.join(' + ')}`);
    console.log(`     Lift: ${rules[0].lift} | Confidence: ${rules[0].confidence} | Support: ${rules[0].support}`);
  }

  return { rules, frequentItemsets, transactionCount: N };
}

/**
 * Get top pairings for a given product SKU.
 */
function getPairingsForProduct(sku, rules, limit = 10) {
  return rules
    .filter(r => r.antecedent.includes(sku))
    .sort((a, b) => b.profitScore - a.profitScore)
    .slice(0, limit);
}

/**
 * Get category-level affinity matrix (for heatmap visualization).
 */
function getCategoryAffinityMatrix(rules, products) {
  const productMap = new Map(products.map(p => [p.sku, p]));
  const categories = [...new Set(products.map(p => p.category))];
  const matrix = {};

  for (const catA of categories) {
    matrix[catA] = {};
    for (const catB of categories) {
      matrix[catA][catB] = 0;
    }
  }

  for (const rule of rules) {
    const antCats = rule.antecedent.map(s => productMap.get(s)?.category).filter(Boolean);
    const conCats = rule.consequent.map(s => productMap.get(s)?.category).filter(Boolean);

    for (const a of antCats) {
      for (const c of conCats) {
        matrix[a][c] += rule.lift;
      }
    }
  }

  return { categories, matrix };
}

module.exports = {
  apriori,
  generateRules,
  buildAssociationRules,
  getPairingsForProduct,
  getCategoryAffinityMatrix,
};
