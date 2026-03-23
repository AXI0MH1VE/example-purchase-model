/**
 * Axiom Hive — Engine Domain Presets
 * ====================================
 * Pre-defined configurations for deploying the Smart Pairing Engine 
 * across divergent business domains.
 *
 * Each preset adjusts the weighted scoring and business logic thresholds
 * to align with domain-specific KPIs.
 *
 * Developer: NMG
 * Version: 1.0 (Integration Architecture)
 */

'use strict';

const PRESETS = {
  /**
   * E-Commerce / Retail Focus: 
   * High weight on Association Rules (co-purchases) and Behavioral Economics (AOV).
   */
  RETAIL: {
    weights: {
      associationRules: 0.40,
      collaborativeFiltering: 0.30,
      contentBased: 0.15,
      popularity: 0.15
    },
    businessLogic: {
      minMargin: 0.25,
      heroBoost: 1.5,
      heroMinRating: 4.5,
      heroMinMargin: 0.45
    }
  },

  /**
   * Legal / Knowledge Graphs:
   * High weight on Content-Based (attribute similarity) and Knowledge Association.
   */
  LEGAL_KNOWLEDGE: {
    weights: {
      associationRules: 0.20,
      collaborativeFiltering: 0.20,
      contentBased: 0.50, // Attributes (tags, citations, court) matter most
      popularity: 0.10
    },
    businessLogic: {
      minMargin: 0, // No margin for knowledge
      heroBoost: 2.0, // High weight on authoritative (Precedent) cases
      heroMinRating: 4.8, 
      heroMinMargin: 0
    }
  },

  /**
   * Digital Media / Streaming:
   * High weight on Collaborative Filtering (user similarity) and Popularity.
   */
  MEDIA_STREAMING: {
    weights: {
      associationRules: 0.15,
      collaborativeFiltering: 0.45, // "Users like you also watched"
      contentBased: 0.20,
      popularity: 0.20 // Trending metrics are high signal
    },
    businessLogic: {
      minMargin: 0.1,
      heroBoost: 1.2,
      heroMinRating: 4.0,
      heroMinMargin: 0.1
    }
  }
};

module.exports = PRESETS;
