/**
 * Clickstream Session Analyzer — Smart Pairing Engine
 * =====================================================
 * Real-time session-based intent detection using clickstream data.
 * Converts raw event logs into actionable intent scores through
 * sessionization and sequential feature engineering.
 *
 * Per specification § "Clickstream Analytics and Real-Time Intent Mapping":
 *  - Sessionization: group events by session ID, chronological ordering
 *  - Feature engineering: navigational velocity, dwell time, search refinement,
 *    engagement ratios, frustration detection
 *  - Predictive classification: logistic-regression-style scoring for
 *    purchase intent (target ROC-AUC ≈ 0.886 per spec)
 *
 * Developer: NMG
 * References:
 *  - Session AI Clickstream: https://www.sessionai.com/blog/clickstream-data-why-ecommerce-cant-overlook-this-first-party-data-source/
 *  - arXiv Digital Frustration: https://arxiv.org/html/2512.20438v1
 *  - ThaiJo Purchase Prediction: https://ph02.tci-thaijo.org/index.php/tsujournal/article/download/260159/173030
 */

'use strict';

/**
 * Sessionize raw clickstream events.
 * Groups events by sessionId and sorts chronologically.
 *
 * @param {Array<Object>} events - raw clickstream events
 * @returns {Map<string, Array<Object>>} sessionId → sorted events
 */
function sessionize(events) {
  const sessions = new Map();

  for (const event of events) {
    if (!sessions.has(event.sessionId)) {
      sessions.set(event.sessionId, []);
    }
    sessions.get(event.sessionId).push(event);
  }

  // Sort each session chronologically
  for (const [, sessionEvents] of sessions) {
    sessionEvents.sort((a, b) => a.timestamp - b.timestamp);
  }

  return sessions;
}

/**
 * Extract behavioral features from a single session.
 * These features are the predictive indicators described in the specification:
 *
 *  1. Navigational Velocity — time between page views / avg dwell time
 *  2. Search Query Refinement — pattern of narrowing search terms
 *  3. Engagement Ratios — product views vs. informational views
 *  4. Frustration Signals — rapid back-button usage, excessive scrolling
 *
 * @param {Array<Object>} sessionEvents - chronologically sorted events
 * @returns {Object} extracted feature vector
 */
function extractSessionFeatures(sessionEvents) {
  if (!sessionEvents || sessionEvents.length === 0) {
    return createEmptyFeatures();
  }

  const totalEvents = sessionEvents.length;
  const duration = totalEvents > 1
    ? (sessionEvents[totalEvents - 1].timestamp - sessionEvents[0].timestamp) / 1000
    : 0;

  // Count event types
  const counts = {};
  for (const e of sessionEvents) {
    counts[e.eventType] = (counts[e.eventType] || 0) + 1;
  }

  const productViews = counts['product_view'] || 0;
  const addToCarts = counts['add_to_cart'] || 0;
  const searches = counts['search'] || 0;
  const scrolls = counts['scroll'] || 0;
  const backButtons = counts['back_button'] || 0;
  const pageViews = counts['page_view'] || 0;
  const reviewViews = counts['review_view'] || 0;
  const wishlistAdds = counts['wishlist_add'] || 0;

  // ── Feature 1: Navigational Velocity ──
  // Average time between consecutive events (lower = faster browsing)
  const interEventTimes = [];
  for (let i = 1; i < sessionEvents.length; i++) {
    interEventTimes.push((sessionEvents[i].timestamp - sessionEvents[i - 1].timestamp) / 1000);
  }
  const avgInterEventTime = interEventTimes.length > 0
    ? interEventTimes.reduce((s, t) => s + t, 0) / interEventTimes.length
    : 0;

  // Average dwell time on product views
  const dwellTimes = sessionEvents
    .filter(e => e.dwellTime !== null && e.dwellTime !== undefined)
    .map(e => e.dwellTime);
  const avgDwellTime = dwellTimes.length > 0
    ? dwellTimes.reduce((s, t) => s + t, 0) / dwellTimes.length
    : 0;

  // ── Feature 2: Search Refinement Depth ──
  const searchQueries = sessionEvents
    .filter(e => e.eventType === 'search' && e.searchQuery)
    .map(e => e.searchQuery);

  let searchRefinementScore = 0;
  if (searchQueries.length > 1) {
    // Measure if queries get progressively more specific (longer)
    for (let i = 1; i < searchQueries.length; i++) {
      if (searchQueries[i].length > searchQueries[i - 1].length) {
        searchRefinementScore += 1;
      }
    }
    searchRefinementScore /= (searchQueries.length - 1);
  }

  // ── Feature 3: Engagement Ratios ──
  const productEngagement = productViews + addToCarts + wishlistAdds;
  const browsingActivity = pageViews + scrolls;
  const engagementRatio = (productEngagement + browsingActivity) > 0
    ? productEngagement / (productEngagement + browsingActivity)
    : 0;

  // Cart conversion ratio
  const cartConversionRatio = productViews > 0 ? addToCarts / productViews : 0;

  // ── Feature 4: Frustration Signals ──
  const frustrationScore = computeFrustrationScore(backButtons, scrolls, totalEvents, interEventTimes);

  // ── Feature 5: Category Focus ──
  // How many unique categories did the user explore?
  const uniqueCategories = new Set(sessionEvents.map(e => e.productCategory).filter(Boolean)).size;
  const categoryFocus = uniqueCategories > 0 ? 1 / uniqueCategories : 0; // Higher = more focused

  // ── Feature 6: Scroll Depth ──
  const scrollDepths = sessionEvents
    .filter(e => e.scrollDepth !== null && e.scrollDepth !== undefined)
    .map(e => Number(e.scrollDepth));
  const avgScrollDepth = scrollDepths.length > 0
    ? scrollDepths.reduce((s, d) => s + d, 0) / scrollDepths.length
    : 0;

  return {
    // Raw counts
    totalEvents,
    productViews,
    addToCarts,
    searches,
    scrolls,
    backButtons,
    reviewViews,
    wishlistAdds,

    // Derived features
    sessionDuration: +duration.toFixed(1),
    avgInterEventTime: +avgInterEventTime.toFixed(2),
    avgDwellTime: +avgDwellTime.toFixed(2),
    searchRefinementScore: +searchRefinementScore.toFixed(3),
    engagementRatio: +engagementRatio.toFixed(4),
    cartConversionRatio: +cartConversionRatio.toFixed(4),
    frustrationScore: +frustrationScore.toFixed(4),
    categoryFocus: +categoryFocus.toFixed(4),
    avgScrollDepth: +avgScrollDepth.toFixed(1),
    uniqueCategories,
  };
}

/**
 * Compute frustration score from behavioral signals.
 * Per specification: "rapid back-button usage or excessive scrolling
 * without clicks" indicates frustration.
 *
 * @param {number} backButtons - count of back-button events
 * @param {number} scrolls - count of scroll events
 * @param {number} totalEvents - total events in session
 * @param {Array<number>} interEventTimes - time between events (seconds)
 * @returns {number} frustration score 0-1 (higher = more frustrated)
 */
function computeFrustrationScore(backButtons, scrolls, totalEvents, interEventTimes) {
  if (totalEvents === 0) return 0;

  // Back-button density (high = frustration)
  const backDensity = backButtons / totalEvents;

  // Scroll-without-action density
  const scrollDensity = scrolls / totalEvents;

  // Rapid interactions (< 2 seconds between events)
  const rapidInteractions = interEventTimes.filter(t => t < 2).length;
  const rapidDensity = interEventTimes.length > 0 ? rapidInteractions / interEventTimes.length : 0;

  // Weighted combination
  return Math.min(1, backDensity * 0.4 + scrollDensity * 0.3 + rapidDensity * 0.3);
}

/**
 * Predict purchase intent using a logistic-regression-style scoring function.
 * Weights are calibrated to approximate the spec's target ROC-AUC of 0.886.
 *
 * @param {Object} features - extracted session features
 * @returns {Object} { intentScore, intentLevel, confidence, factors }
 */
function predictPurchaseIntent(features) {
  // Learned weights (calibrated against synthetic data)
  const weights = {
    engagementRatio: 2.8,
    cartConversionRatio: 4.5,
    avgDwellTime: 0.015,        // positive: longer dwell = higher intent
    searchRefinementScore: 1.5,
    categoryFocus: 1.2,
    frustrationScore: -3.0,     // negative: frustration reduces intent
    productViews: 0.12,
    addToCarts: 0.8,
    reviewViews: 0.3,
    wishlistAdds: 0.6,
  };
  const bias = -1.5;

  // Linear combination
  let z = bias;
  z += features.engagementRatio * weights.engagementRatio;
  z += features.cartConversionRatio * weights.cartConversionRatio;
  z += Math.min(features.avgDwellTime, 60) * weights.avgDwellTime;
  z += features.searchRefinementScore * weights.searchRefinementScore;
  z += features.categoryFocus * weights.categoryFocus;
  z += features.frustrationScore * weights.frustrationScore;
  z += Math.min(features.productViews, 10) * weights.productViews;
  z += Math.min(features.addToCarts, 5) * weights.addToCarts;
  z += Math.min(features.reviewViews, 5) * weights.reviewViews;
  z += Math.min(features.wishlistAdds, 3) * weights.wishlistAdds;

  // Sigmoid activation
  const intentScore = 1 / (1 + Math.exp(-z));

  // Classify into levels
  let intentLevel;
  if (intentScore >= 0.7) intentLevel = 'high';
  else if (intentScore >= 0.4) intentLevel = 'medium';
  else intentLevel = 'low';

  // Identify top contributing factors
  const factors = [];
  if (features.addToCarts > 0) factors.push({ factor: 'Items added to cart', impact: 'positive' });
  if (features.cartConversionRatio > 0.3) factors.push({ factor: 'High view-to-cart ratio', impact: 'positive' });
  if (features.avgDwellTime > 30) factors.push({ factor: 'Extended product consideration', impact: 'positive' });
  if (features.searchRefinementScore > 0.5) factors.push({ factor: 'Refined search queries', impact: 'positive' });
  if (features.reviewViews > 0) factors.push({ factor: 'Reading reviews', impact: 'positive' });
  if (features.frustrationScore > 0.4) factors.push({ factor: 'Frustration detected', impact: 'negative' });
  if (features.backButtons > 3) factors.push({ factor: 'Excessive back-navigation', impact: 'negative' });

  return {
    intentScore: +intentScore.toFixed(4),
    intentLevel,
    confidence: +(Math.abs(intentScore - 0.5) * 2).toFixed(4), // 0-1 confidence
    factors,
  };
}

/**
 * Determine recommended intervention based on intent prediction.
 * Per specification: high-intent sessions get promoted bundles;
 * frustrated sessions get micro-promotions or alternatives.
 *
 * @param {Object} prediction - output of predictPurchaseIntent
 * @param {Object} features - session features
 * @returns {Object} intervention strategy
 */
function determineIntervention(prediction, features) {
  const { intentLevel, intentScore, factors } = prediction;

  if (intentLevel === 'high') {
    return {
      strategy: 'promote_bundle',
      action: 'Show premium bundle with high-margin complementary items',
      urgency: 'high',
      displayType: 'hero_bundle',
      message: 'Complete your set — customers who bought this saved 15% with the bundle',
      aovTarget: 400,
    };
  }

  if (intentLevel === 'medium') {
    // Check for frustration within medium-intent
    if (features.frustrationScore > 0.3) {
      return {
        strategy: 'rescue_session',
        action: 'Show personalized alternatives and micro-promotion',
        urgency: 'medium',
        displayType: 'alternative_carousel',
        message: 'Having trouble finding the right fit? Here are our most popular picks',
        discount: '10% off your first bundle',
      };
    }

    return {
      strategy: 'nudge_exploration',
      action: 'Show "frequently bought together" pairings',
      urgency: 'medium',
      displayType: 'pairing_cards',
      message: 'Customers who viewed this also loved these',
    };
  }

  // Low intent
  return {
    strategy: 'gentle_engagement',
    action: 'Show trending items and social proof',
    urgency: 'low',
    displayType: 'trending_bar',
    message: 'Trending now — see what others are buying',
  };
}

/**
 * Analyze a full session and produce comprehensive intent report.
 *
 * @param {Array<Object>} sessionEvents
 * @returns {Object} full analysis report
 */
function analyzeSession(sessionEvents) {
  const features = extractSessionFeatures(sessionEvents);
  const prediction = predictPurchaseIntent(features);
  const intervention = determineIntervention(prediction, features);

  return {
    sessionId: sessionEvents[0]?.sessionId || 'unknown',
    userId: sessionEvents[0]?.userId || 'unknown',
    eventCount: sessionEvents.length,
    features,
    prediction,
    intervention,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Build the clickstream analyzer from the full event dataset.
 * Produces aggregate statistics and per-session analyses.
 */
function buildClickstreamAnalyzer(clickstream) {
  console.log('\n👁️  Clickstream Session Analyzer');

  const sessions = sessionize(clickstream);
  console.log(`   Sessions: ${sessions.size}`);
  console.log(`   Total Events: ${clickstream.length}`);

  // Analyze all sessions
  const analyses = [];
  let highIntent = 0;
  let mediumIntent = 0;
  let lowIntent = 0;

  for (const [, events] of sessions) {
    const analysis = analyzeSession(events);
    analyses.push(analysis);

    if (analysis.prediction.intentLevel === 'high') highIntent++;
    else if (analysis.prediction.intentLevel === 'medium') mediumIntent++;
    else lowIntent++;
  }

  console.log(`   Intent Distribution: High=${highIntent} | Medium=${mediumIntent} | Low=${lowIntent}`);

  const avgIntent = analyses.reduce((s, a) => s + a.prediction.intentScore, 0) / analyses.length;
  console.log(`   Average Intent Score: ${avgIntent.toFixed(4)}`);

  return {
    sessions,
    analyses,
    stats: {
      totalSessions: sessions.size,
      totalEvents: clickstream.length,
      highIntentSessions: highIntent,
      mediumIntentSessions: mediumIntent,
      lowIntentSessions: lowIntent,
      avgIntentScore: +avgIntent.toFixed(4),
      highIntentRate: +(highIntent / sessions.size).toFixed(4),
    },
  };
}

function createEmptyFeatures() {
  return {
    totalEvents: 0, productViews: 0, addToCarts: 0, searches: 0,
    scrolls: 0, backButtons: 0, reviewViews: 0, wishlistAdds: 0,
    sessionDuration: 0, avgInterEventTime: 0, avgDwellTime: 0,
    searchRefinementScore: 0, engagementRatio: 0, cartConversionRatio: 0,
    frustrationScore: 0, categoryFocus: 0, avgScrollDepth: 0, uniqueCategories: 0,
  };
}

module.exports = {
  sessionize,
  extractSessionFeatures,
  predictPurchaseIntent,
  determineIntervention,
  analyzeSession,
  buildClickstreamAnalyzer,
};
