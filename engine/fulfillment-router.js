/**
 * Axiom Hive — Dynamic Fulfillment Router
 * =========================================
 * This engine elevates the platform from a recommendation tool to a strategic 
 * fulfillment orchestrator. It identifies superior wholesale terms in real-time
 * and routes orders to preferred suppliers to maximize "Contribution Margin."
 * 
 * Objectives:
 * 1. High-velocity routing of checkout requests.
 * 2. Protection of Profit/Margin via procurement efficiency.
 * 3. Logging for transparency and "Success Fee" auditing.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const LOG_FILE = path.join(__dirname, '../data/swap_logs.json');

class FulfillmentRouter {
  constructor() {
    this.configs = {
      prioritizePreferredSupplier: true,
      minMarginImprovementThreshold: 0.05, // 5% efficiency minimum
      preferredSupplierId: 'SUPPLIER_NORTH_AMERICA'
    };
    this.logs = [];
    this.loadLogs();
  }

  loadLogs() {
    try {
      if (fs.existsSync(LOG_FILE)) {
        this.logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
      }
    } catch(e) { console.error('[Fulfillment Router] Failed to load logs', e); }
  }

  saveLogs() {
    try {
      if (!fs.existsSync(path.dirname(LOG_FILE))) fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
      fs.writeFileSync(LOG_FILE, JSON.stringify(this.logs.slice(0, 1000), null, 2));
    } catch(e) { console.error('[Fulfillment Router] Failed to save logs', e); }
  }

  updateConfig(newConfig) {
    this.configs = Object.assign(this.configs, newConfig);
  }

  getLogs() {
    return this.logs; 
  }

  /**
   * Process a checkout transaction and identify superior fulfillment terms.
   * @param {Object} orderRequest - { sku, currentPrice, supplierNetwork }
   * @param {string} tenantId - The SaaS client ID
   */
  async processTransaction(orderRequest, tenantId) {
    const { sku, currentPrice, supplierNetwork } = orderRequest;
    
    // Simulate API latency for integrated wholesale networks (TopDawg, Spocket, etc.)
    await new Promise(resolve => setTimeout(resolve, 80));

    let selectedSupplier = null;
    let marginGain = 0;

    for (const supplier of (supplierNetwork || [])) {
      const improvement = (currentPrice - supplier.wholesaleCost) / currentPrice;
      
      // Check for Preferred Supplier status
      if (this.configs.prioritizePreferredSupplier && supplier.id === this.configs.preferredSupplierId && improvement > 0) {
        selectedSupplier = supplier; 
        marginGain = improvement; 
        break; 
      }

      // Check for Maximum Margin Optimization
      if (improvement > this.configs.minMarginImprovementThreshold && improvement > marginGain) {
        marginGain = improvement; 
        selectedSupplier = supplier;
      }
    }

    const auditEntry = { timestamp: new Date().toISOString(), tenantId, sku };

    if (selectedSupplier) {
      const entry = { 
        ...auditEntry, 
        status: 'Fulfillment Optimized', 
        supplier: selectedSupplier.id, 
        contributionMarginGain: (marginGain * 100).toFixed(2) + '%'
      };
      this.logs.unshift(entry);
      this.saveLogs();
      
      return { 
        success: true, 
        routedTo: selectedSupplier.id, 
        marginEfficiency: marginGain, 
        finalProcurementCost: selectedSupplier.wholesaleCost 
      };
    } else {
      this.logs.unshift({ ...auditEntry, status: 'No Enhancement Identified', reason: 'Thresholds not met' });
      this.saveLogs();
      return { success: false, reason: 'Procurement thresholds not met' };
    }
  }
}

module.exports = new FulfillmentRouter();
