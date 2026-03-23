/**
 * Axiom Hive — Domain Schema Mapper
 * ===================================
 * Maps arbitrary domain datasets (e.g., Legal Cases, Movies) into
 * the generalized Smart Pairing Engine schema.
 */

'use strict';

/**
 * Maps any domain array into the Engine's format.
 * Expected internal Product Schema: { sku: string, category: string, ...attributes }
 * Expected internal Order Schema: { id: string, products: string[], user: string }
 * Expected internal User Schema: { id: string, ...attributes }
 */
const SchemaMapper = {
  
  /**
   * @param {Array} items - Raw domain items
   * @param {Object} mapping - { idKey, categoryKey }
   */
  mapProducts(items, mapping) {
    return items.map(item => ({
      ...item,
      sku: item[mapping.idKey],
      category: item[mapping.categoryKey] || 'Uncategorized'
    }));
  },

  /**
   * @param {Array} events - Raw domain transaction/viewing events
   * @param {Object} mapping - { idKey, itemsKey, userKey }
   */
  mapOrders(events, mapping) {
    return events.map(event => ({
      ...event,
      id: event[mapping.idKey],
      products: event[mapping.itemsKey],
      user: event[mapping.userKey]
    }));
  },

  /**
   * Utility to auto-detect and map a dataset.
   */
  mapDomainDataset(rawDataset, domainType) {
    if (domainType === 'LEGAL') {
      return {
        products: this.mapProducts(rawDataset.cases, { idKey: 'caseId', categoryKey: 'court' }),
        orders: this.mapOrders(rawDataset.citations, { idKey: 'citationId', itemsKey: 'citedCases', userKey: 'lawyerId' }),
        users: rawDataset.lawyers || []
      };
    }
    
    if (domainType === 'MEDIA') {
      return {
        products: this.mapProducts(rawDataset.content, { idKey: 'contentId', categoryKey: 'genre' }),
        orders: this.mapOrders(rawDataset.watchHistory, { idKey: 'sessionId', itemsKey: 'watchedContent', userKey: 'viewerId' }),
        users: rawDataset.viewers || []
      };
    }

    // Default assumes RETAIL/Engine native schema
    return rawDataset;
  }
};

module.exports = SchemaMapper;
