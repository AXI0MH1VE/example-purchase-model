const SmartPairingEngine = require('../core/EngineService');
const PRESETS = require('../core/presets');
const { generateDataset } = require('../data/generator');

describe('Smart Pairing Engine Core & Algorithms', () => {
  let data;
  let engine;

  beforeAll(() => {
    // Generate synthetic data for testing
    data = generateDataset();
  });

  beforeEach(() => {
    // Re-initialize for isolated tests
    engine = new SmartPairingEngine(data, PRESETS.RETAIL);
  });

  test('should initialize successfully with RETAIL preset', () => {
    expect(engine.isInitialized).toBe(true);
    expect(engine.config.weights.associationRules).toBe(0.40);
  });

  test('getRecommendations should return 10 items by default', () => {
    const userId = data.users[0].id;
    const recs = engine.getRecommendations(userId, null, 10);
    expect(recs.recommendations.length).toBeLessThanOrEqual(10);
    expect(recs.metadata).toBeDefined();
  });

  test('should correctly apply LEGAL_KNOWLEDGE preset', () => {
    const legalEngine = new SmartPairingEngine(data, PRESETS.LEGAL_KNOWLEDGE);
    expect(legalEngine.config.weights.contentBased).toBe(0.50);
    expect(legalEngine.config.businessLogic.minMargin).toBe(0);
  });

  test('should hot-rebuild via syncLifecycle', () => {
    const initialStats = engine.getStats();
    engine.syncLifecycle();
    const newStats = engine.getStats();
    expect(newStats.productCount).toBeGreaterThan(0);
    expect(engine.isInitialized).toBe(true);
  });

  test('updateConfig should successfully dynamically swap weights', () => {
    engine.updateConfig(PRESETS.MEDIA_STREAMING);
    expect(engine.config.weights.collaborativeFiltering).toBe(0.45);
  });
});
