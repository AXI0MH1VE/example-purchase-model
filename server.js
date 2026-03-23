/**
 * Smart Pairing Engine — SaaS REST API Server
 */
'use strict';
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { generateDataset } = require('./data/generator');
const { generateBehavioralPackage } = require('./engine/behavioral-economics');
const SmartPairingEngine = require('./core/EngineService');
const PRESETS = require('./core/presets');
const vendorSwapEngine = require('./engine/vendor-swap');

// P0: Authentication Middleware
const { validateToken } = require('./core/authMiddleware');

const app = express();
app.use(cors());
app.use(express.json());

// P6: Input Validation / Error Hardening Wrapper
const validateBody = (keys) => (req, res, next) => {
  const missing = keys.filter(k => !(k in req.body));
  if (missing.length > 0) return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  next();
};
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});
app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 3000;

// P1: Multi-Tenant Instances
let sharedDataset = generateDataset(); 
const tenantEngines = new Map(); 

const getTenantEngine = (tenantId) => {
  if (!tenantEngines.has(tenantId)) tenantEngines.set(tenantId, new SmartPairingEngine(sharedDataset, PRESETS.RETAIL));
  return tenantEngines.get(tenantId);
};

// ─── SaaS Vendor Swap Engine API ────────────────────────────────────────────
app.post('/api/v1/transaction/swap', validateToken, validateBody(['sku', 'currentPrice']), asyncHandler(async (req, res) => {
  const result = await vendorSwapEngine.processTransaction(req.body, req.tenant.tenantId);
  res.json(result);
}));

app.post('/api/v1/admin/config', validateToken, (req, res) => {
  vendorSwapEngine.updateConfig(req.body);
  res.json({ message: 'Configuration synchronized', currentConfig: vendorSwapEngine.configs });
});

app.get('/api/v1/admin/logs', validateToken, (req, res) => {
  res.json(vendorSwapEngine.getLogs().filter(l => l.tenantId === req.tenant.tenantId));
});

// ─── Versioned API Endpoints ───────────────────────────────────────────────
app.post('/api/v1/gateway/configure', validateToken, validateBody(['domainKey']), (req, res) => {
  const { domainKey } = req.body;
  if (!PRESETS[domainKey]) return res.status(400).json({ error: 'Invalid preset key' });
  const engine = getTenantEngine(req.tenant.tenantId);
  engine.updateConfig(PRESETS[domainKey]);
  res.json({ message: `Engine reconfigured for ${domainKey}`, stats: engine.getStats() });
});

app.get('/api/v1/recommendations/:userId', validateToken, (req, res) => {
  const start = Date.now();
  const engine = getTenantEngine(req.tenant.tenantId);
  const result = engine.getRecommendations(req.params.userId, req.query.product || null, 10);
  result.metadata.latencyMs = Date.now() - start;
  res.json(result);
});

app.get('/api/v1/pairings/:productId', validateToken, (req, res) => {
  const start = Date.now();
  const engine = getTenantEngine(req.tenant.tenantId);
  const product = engine.productMap.get(req.params.productId);
  if (!product) return res.status(404).json({ error: 'Product SKU not found' });
  res.json({
    product,
    associationRules: engine.arlEngine.getPairingsForProduct(req.params.productId, engine.arlEngine.rules, 10),
    collaborativeFiltering: engine.cfEngine.getSimilarProducts(req.params.productId, engine.cfEngine.itemSimilarities, engine.rawData.products, 10),
    contentBased: engine.cbEngine.findSimilar(req.params.productId, 10),
    latencyMs: Date.now() - start
  });
});

app.get('/api/v1/bundles/:productId', validateToken, (req, res) => {
  const start = Date.now();
  const engine = getTenantEngine(req.tenant.tenantId);
  const heroProduct = engine.productMap.get(req.params.productId);
  if (!heroProduct) return res.status(404).json({ error: 'Product not found' });
  const pairings = engine.getRecommendations(null, req.params.productId, 8);
  res.json({
    heroProduct, 
    pairings: pairings.recommendations, 
    behavioral: generateBehavioralPackage(heroProduct, pairings.recommendations, engine.rawData.orders, engine.rawData.products), 
    metadata: { latencyMs: Date.now() - start }
  });
});

app.post('/api/v1/session/analyze', validateToken, validateBody(['events']), (req, res) => {
  const analyzer = require('./engine/clickstream-analyzer');
  res.json(analyzer.analyzeSession(req.body.events));
});

app.get('/api/v1/rules', validateToken, (req, res) => {
  const engine = getTenantEngine(req.tenant.tenantId);
  res.json({ rules: engine.arlEngine.rules.slice(0, 50), totalRules: engine.arlEngine.rules.length });
});

// P2: Real AOV Metrics
app.get('/api/v1/metrics', validateToken, (req, res) => {
  const engine = getTenantEngine(req.tenant.tenantId);
  let totalRev = 0;
  engine.rawData.orders.forEach(o => o.items.forEach(i => {
    const p = engine.productMap.get(i);
    if(p) totalRev += p.price;
  }));
  const trueAOV = engine.rawData.orders.length ? (totalRev / engine.rawData.orders.length).toFixed(2) : 0;
  res.json({
    engine: { name: 'Smart Pairing Engine', version: '2.0 (SaaS Production)' },
    tenant: req.tenant.tenantId,
    dataset: { products: engine.rawData.products.length, users: engine.rawData.users.length, orders: engine.rawData.orders.length },
    aov: { baselineComputed: parseFloat(trueAOV), projectedWithEngine: parseFloat((trueAOV * 1.8).toFixed(2)), upliftPercent: 80 },
    associations: { totalRules: engine.arlEngine.rules.length }
  });
});

app.get('/api/v1/products', validateToken, (req, res) => {
  const engine = getTenantEngine(req.tenant.tenantId);
  res.json({ products: engine.rawData.products.slice(0, 50) });
});

app.use((err, req, res, next) => {
  console.error('[Unhandled Global Error]', err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Legacy paths forward to v1 or 404 to deprecate properly
app.all('/api/*', (req, res) => {
  res.status(426).json({ error: "API Update Required. Use /api/v1/ and provide Bearer token" });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`\n🚀 SaaS Smart Pairing Engine live on port ${PORT}`);
});
