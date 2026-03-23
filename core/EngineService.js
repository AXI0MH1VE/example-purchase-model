/**
 * Axiom Hive — Smart Pairing Engine Service
 * =========================================
 * A modular, domain-agnostic recommendation service that translates
 * raw behavioral and attribute data into high-accuracy pairings.
 *
 * Design Pattern: Strategy & Factory
 * This service can be instantiated with custom configurations to serve
 * divergent domains (Retail, Legal, Media, etc.).
 *
 * Developer: NMG
 * Version: 2.0 (Integration Refactor)
 */

'use strict';

const { buildAssociationRules } = require('../engine/association-rules');
const { buildCollaborativeFilter } = require('../engine/collaborative-filtering');
const { buildContentBasedFilter } = require('../engine/content-based');
const { buildClickstreamAnalyzer } = require('../engine/clickstream-analyzer');
const { generateSmartPairings, computePopularityScores } = require('../engine/hybrid-recommender');
const { auditProductLifecycle } = require('../engine/lifecycle-manager');
const salesOptimizationEngine = require('../engine/sales-optimization');

class SmartPairingEngine {
  /**
   * Initialize the engine with domain-specific data and configuration.
   * @param {Object} data - { products, users, orders, clickstream }
   * @param {Object} config - Weighted scoring and business logic thresholds
   */
  constructor(data, config = {}) {
    this.rawData = data;
    this.config = Object.assign({
      weights: {
        associationRules: 0.35,
        collaborativeFiltering: 0.30,
        contentBased: 0.20,
        popularity: 0.15
      },
      businessLogic: {
        minMargin: 0.25,
        heroBoost: 1.5,
        heroMinRating: 4.3,
        heroMinMargin: 0.45
      }
    }, config);

    this.initialize();
  }

  /**
   * Build/Rebuild the algorithmic layers.
   */
  initialize() {
    console.log(`[Engine] Initializing Modular Core...`);
    const { products, users, orders, clickstream } = this.rawData;

    this.arlEngine = buildAssociationRules(orders, products);
    this.cfEngine = buildCollaborativeFilter(orders, products, users);
    this.cbEngine = buildContentBasedFilter(products, orders);
    this.clickstreamEngine = buildClickstreamAnalyzer(clickstream);
    this.popularityScores = computePopularityScores(products, orders);
    
    // Internal Lookups
    this.productMap = new Map(products.map(p => [p.sku, p]));
    this.isInitialized = true;
  }

  /**
   * Main Recommendation Entry Point.
   * Leverages the core proven operational algorithm, strategically
   * augmenting the output with the proprietary sales optimization engine.
   */
  getRecommendations(userId, productSku = null, limit = 10) {
    if (!this.isInitialized) throw new Error('Engine not initialized');

    const baselineRecommendations = generateSmartPairings({
      userId,
      productSku,
      engines: { 
        arlEngine: this.arlEngine, 
        cfEngine: this.cfEngine, 
        cbEngine: this.cbEngine 
      },
      products: this.rawData.products,
      orders: this.rawData.orders,
      weights: this.config.weights,
      limit
    });

    // Isolate interaction pathways and flag refinement areas
    const sessionContext = this.rawData.clickstream ? this.rawData.clickstream.filter(e => e.userId === userId) : [];
    const pathwayAnalysis = salesOptimizationEngine.analyzeInteractionPathway(sessionContext);
    const enhancementFlags = salesOptimizationEngine.flagRefinementOpportunities(pathwayAnalysis);

    // Integrate enhancements organically without replacing core functionality
    return salesOptimizationEngine.integrateEnhancements(baselineRecommendations, enhancementFlags);
  }

  /**
   * Execute Lifecycle Synchronization.
   */
  syncLifecycle() {
    const results = auditProductLifecycle(this.rawData.products, this.rawData.orders);
    this.rawData.products = results.updatedCatalog;
    this.initialize(); // Hot-rebuild engines
    return results;
  }

  /**
   * Update Configuration Dynamically.
   */
  updateConfig(newConfig) {
    this.config = Object.assign(this.config, newConfig);
    return this.config;
  }

  /**
   * Get Catalog Statistics.
   */
  getStats() {
    return {
      productCount: this.rawData.products.length,
      userCount: this.rawData.users.length,
      orderCount: this.rawData.orders.length,
      rulesCount: this.arlEngine.rules.length
    };
  }
}

module.exports = SmartPairingEngine;
