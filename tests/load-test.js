const request = require('supertest');
const express = require('express');
const SmartPairingEngine = require('../core/EngineService');
const PRESETS = require('../core/presets');
const { generateDataset } = require('../data/generator');

/**
 * Load & Performance Tests for Smart Pairing Engine
 * Simulates high query volumes. Minimum criteria: < 200ms
 */

describe('Performance under Synthetic Load', () => {
  let app;
  let engine;
  let data;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    data = generateDataset();
    // Simulate a large dataset by duplicating orders arbitrarily
    const expandedOrders = [];
    for(let i = 0; i < 50; i++) {
        expandedOrders.push(...data.orders);
    }
    data.orders = expandedOrders;

    engine = new SmartPairingEngine(data, PRESETS.RETAIL);

    app.get('/api/recommendations/:userId', (req, res) => {
      const recs = engine.getRecommendations(req.params.userId, null, 10);
      res.json(recs);
    });
  });

  test('Latency under 100 concurrent requests should average < 200ms', async () => {
    const promises = [];
    const NUM_REQS = 100;
    const startAll = Date.now();

    for (let i = 0; i < NUM_REQS; i++) {
      promises.push(request(app).get('/api/recommendations/USR-001'));
    }

    const responses = await Promise.all(promises);
    const endAll = Date.now();

    const avgLatency = (endAll - startAll) / NUM_REQS;
    
    // Verify all succeeded
    expect(responses.every(r => r.status === 200)).toBe(true);
    
    // Core benchmark constraint
    expect(avgLatency).toBeLessThan(200); 
    
    console.log(`\n[Load Test Benchmark] Average Latency: ${avgLatency.toFixed(2)}ms (Batch of ${NUM_REQS})`);
  });
});
