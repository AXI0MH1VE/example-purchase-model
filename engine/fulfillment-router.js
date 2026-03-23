/**
 * Headless Execution Layer — Fulfillment Optimization & Routing Engine
 */
const fs = require('fs');
const path = require('path');
const LOG_FILE = path.join(__dirname, '../data/fulfillment_logs.json');

class FulfillmentRouter {
  constructor() {
    this.configs = {
      prioritizeVendorA: false,
      minSavingsThreshold: 0.05,
      prioritizedVendorId: 'VENDOR_A'
    };
    this.logs = [];
    this.loadLogs();
  }

  loadLogs() {
    try {
      if (fs.existsSync(LOG_FILE)) {
        this.logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
      }
    } catch(e) { console.error('Failed to load fulfillment logs', e); }
  }

  saveLogs() {
    try {
      if (!fs.existsSync(path.dirname(LOG_FILE))) fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
      fs.writeFileSync(LOG_FILE, JSON.stringify(this.logs.slice(0, 1000), null, 2));
    } catch(e) { console.error('Failed to save fulfillment logs', e); }
  }

  updateConfig(newConfig) {
    this.configs = { ...this.configs, ...newConfig };
  }

  getLogs() {
    return this.logs; 
  }

  async processTransaction(productRequest, tenantId) {
    const { sku, currentPrice, availableVendors } = productRequest;
    await new Promise(resolve => setTimeout(resolve, 80));

    let selectedVendor = null, maxSavings = 0;

    for (const vendor of (availableVendors || [])) {
      const savings = (currentPrice - vendor.price) / currentPrice;
      if (this.configs.prioritizeVendorA && vendor.id === this.configs.prioritizedVendorId && savings > 0) {
        selectedVendor = vendor; maxSavings = savings; break; 
      }
      if (savings > this.configs.minSavingsThreshold && savings > maxSavings) {
        maxSavings = savings; selectedVendor = vendor;
      }
    }

    const baseLog = { timestamp: new Date().toISOString(), tenantId, sku };

    if (selectedVendor) {
      this.logs.unshift({ ...baseLog, status: 'SUCCESS', vendor: selectedVendor.id, savingsPct: (maxSavings * 100).toFixed(2) + '%'});
      this.saveLogs();
      return { success: true, swappedTo: selectedVendor.id, savings: maxSavings, finalPrice: selectedVendor.price };
    } else {
      this.logs.unshift({ ...baseLog, status: 'FAILED', reason: 'Thresholds not met' });
      this.saveLogs();
      return { success: false, reason: 'Config thresholds not met' };
    }
  }
}
module.exports = new FulfillmentRouter();
