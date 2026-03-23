const request = require('supertest');
const express = require('express');
const SmartPairingEngine = require('../core/EngineService');
const PRESETS = require('../core/presets');
const { generateDataset } = require('../data/generator');

describe('API Gateway Integration Tests', () => {
  let app;
  let engine;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Inject mock route matching the server.js architecture
    // We mock the endpoints to test gateway functionality without spinning up the full server.js
    // to avoid listening port conflicts during tests.
    
    const data = generateDataset();
    engine = new SmartPairingEngine(data, PRESETS.RETAIL);

    app.get('/api/recommendations/:userId', (req, res) => {
      const recs = engine.getRecommendations(req.params.userId, null, 10);
      res.json(recs);
    });

    app.get('/api/metrics', (req, res) => {
      res.json(engine.getStats());
    });

    // Mock Versioned API for Swap
    const fulfillmentRouter = require('../engine/fulfillment-router');
    app.post('/api/v1/transaction/swap', (req, res) => {
      fulfillmentRouter.processTransaction(req.body, 'TENANT-001').then(result => res.json(result));
    });
  });

  test('GET /api/recommendations/:userId returns 200 and JSON', async () => {
    const response = await request(app).get('/api/recommendations/USR-001');
    expect(response.status).toBe(200);
    expect(response.body.recommendations).toBeDefined();
    expect(response.body.metadata).toBeDefined();
  });

  test('GET /api/metrics returns correct engine stats', async () => {
    const response = await request(app).get('/api/metrics');
    expect(response.status).toBe(200);
    expect(response.body.productCount).toBeGreaterThan(0);
  });

  test('POST /api/v1/transaction/swap identifies margin efficiency', async () => {
    const payload = {
      sku: 'SKU-001',
      currentPrice: 200,
      supplierNetwork: [
        { id: 'SUPPLIER_A', wholesaleCost: 150 },
        { id: 'SUPPLIER_B', wholesaleCost: 120 }
      ]
    };
    const response = await request(app).post('/api/v1/transaction/swap').send(payload);
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.routedTo).toBe('SUPPLIER_B');
    expect(response.body.marginEfficiency).toBeGreaterThan(0.3); // 1 - 120/200 = 0.4
  });
});
