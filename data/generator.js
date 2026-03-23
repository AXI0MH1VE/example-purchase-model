/**
 * Synthetic E-Commerce Dataset Generator
 * =======================================
 * Generates realistic products, users, orders, and clickstream events
 * with built-in affinity rules so the ARL engine has discoverable patterns.
 *
 * References:
 *  - Association Rule Learning (Wikipedia): https://en.wikipedia.org/wiki/Association_rule_learning
 *  - IBM Recommendation Engine: https://www.ibm.com/think/topics/recommendation-engine
 *  - Syntora AI Recommendations: https://syntora.io/solutions/how-can-a-small-ecommerce-business-leverage-ai-for-personalized-product-recommen
 */

'use strict';

// ─── Deterministic Seeded PRNG (Mulberry32) ────────────────────────────────
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);

function randInt(min, max) { return Math.floor(rand() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Product Catalog ────────────────────────────────────────────────────────
const CATEGORIES = {
  Electronics: {
    brands: ['TechVolt', 'PixelPro', 'SonicWave', 'NovaTech', 'ClearView'],
    items: [
      { base: 'Mirrorless Camera Body', priceRange: [599, 799], margin: 0.28 },
      { base: '50mm Prime Lens', priceRange: [189, 349], margin: 0.35 },
      { base: 'Camera Tripod', priceRange: [49, 129], margin: 0.45 },
      { base: 'SD Memory Card 128GB', priceRange: [24, 59], margin: 0.55 },
      { base: 'Camera Bag', priceRange: [39, 89], margin: 0.50 },
      { base: 'Wireless Noise-Cancelling Headphones', priceRange: [149, 349], margin: 0.32 },
      { base: 'Bluetooth Speaker', priceRange: [49, 199], margin: 0.38 },
      { base: 'USB-C Hub 7-in-1', priceRange: [29, 69], margin: 0.48 },
      { base: '4K Monitor 27"', priceRange: [299, 549], margin: 0.22 },
      { base: 'Mechanical Keyboard', priceRange: [79, 179], margin: 0.40 },
    ],
  },
  Fashion: {
    brands: ['UrbanEdge', 'Luxara', 'TrailBound', 'EcoThread', 'VelvetStone'],
    items: [
      { base: 'Merino Wool Sweater', priceRange: [89, 189], margin: 0.52 },
      { base: 'Slim Fit Chinos', priceRange: [49, 99], margin: 0.55 },
      { base: 'Leather Belt', priceRange: [35, 79], margin: 0.60 },
      { base: 'Canvas Sneakers', priceRange: [59, 129], margin: 0.48 },
      { base: 'Aviator Sunglasses', priceRange: [79, 199], margin: 0.58 },
      { base: 'Cashmere Scarf', priceRange: [69, 149], margin: 0.55 },
    ],
  },
  Home: {
    brands: ['NestLux', 'AmbientCraft', 'PureAir', 'CozyNook', 'LumenHaus'],
    items: [
      { base: 'Aromatherapy Diffuser', priceRange: [29, 69], margin: 0.52 },
      { base: 'Essential Oil Set (6-pack)', priceRange: [19, 45], margin: 0.62 },
      { base: 'Weighted Blanket', priceRange: [59, 129], margin: 0.42 },
      { base: 'Smart LED Bulbs (4-pack)', priceRange: [29, 59], margin: 0.48 },
      { base: 'Ceramic Planter Set', priceRange: [25, 55], margin: 0.55 },
      { base: 'Scented Candle Collection', priceRange: [24, 49], margin: 0.65 },
    ],
  },
  Sports: {
    brands: ['ApexRun', 'IronGrip', 'FlexCore', 'SummitGear', 'AquaPulse'],
    items: [
      { base: 'Trail Running Shoes', priceRange: [99, 189], margin: 0.35 },
      { base: 'Moisture-Wicking Socks (3-pack)', priceRange: [15, 29], margin: 0.65 },
      { base: 'GPS Sports Watch', priceRange: [149, 399], margin: 0.30 },
      { base: 'Hydration Vest', priceRange: [59, 129], margin: 0.42 },
      { base: 'Resistance Bands Set', priceRange: [19, 45], margin: 0.60 },
      { base: 'Yoga Mat Premium', priceRange: [29, 69], margin: 0.50 },
    ],
  },
  Beauty: {
    brands: ['GlowLab', 'PureSkin', 'VitalDerm', 'AuraBlend', 'ZenGlow'],
    items: [
      { base: 'Vitamin C Serum', priceRange: [24, 59], margin: 0.68 },
      { base: 'Hyaluronic Acid Moisturizer', priceRange: [29, 69], margin: 0.65 },
      { base: 'Retinol Night Cream', priceRange: [34, 79], margin: 0.62 },
      { base: 'SPF 50 Sunscreen', priceRange: [15, 35], margin: 0.58 },
      { base: 'Jade Facial Roller', priceRange: [19, 45], margin: 0.70 },
      { base: 'Charcoal Clay Mask', priceRange: [12, 29], margin: 0.72 },
    ],
  },
  Kitchen: {
    brands: ['BrewMaster', 'ChefStone', 'GrindHaus', 'PureBrew', 'SliceCraft'],
    items: [
      { base: 'Pour-Over Coffee Maker', priceRange: [29, 69], margin: 0.48 },
      { base: 'Burr Coffee Grinder', priceRange: [49, 149], margin: 0.40 },
      { base: 'Artisan Coffee Beans 1kg', priceRange: [18, 39], margin: 0.55 },
      { base: 'Cast Iron Skillet 12"', priceRange: [34, 79], margin: 0.42 },
      { base: 'Chef Knife 8"', priceRange: [49, 149], margin: 0.38 },
      { base: 'Bamboo Cutting Board', priceRange: [19, 45], margin: 0.58 },
    ],
  },
  Books: {
    brands: ['Folio Press', 'Penguin Deluxe', 'Everyman', 'Vintage Classics', 'Oxford World'],
    items: [
      { base: 'Machine Learning Handbook', priceRange: [39, 79], margin: 0.55 },
      { base: 'Data Science Cookbook', priceRange: [34, 69], margin: 0.55 },
      { base: 'Business Strategy Guide', priceRange: [24, 49], margin: 0.60 },
      { base: 'UX Design Principles', priceRange: [29, 59], margin: 0.58 },
      { base: 'Creative Photography', priceRange: [34, 69], margin: 0.52 },
    ],
  },
  Outdoor: {
    brands: ['TrailForge', 'BaseLayer', 'NordPeak', 'TerraWild', 'CampZen'],
    items: [
      { base: 'Ultralight Tent 2P', priceRange: [149, 349], margin: 0.30 },
      { base: 'Down Sleeping Bag', priceRange: [99, 249], margin: 0.32 },
      { base: 'Trekking Poles (pair)', priceRange: [39, 89], margin: 0.45 },
      { base: 'Headlamp 600 Lumens', priceRange: [24, 59], margin: 0.50 },
      { base: 'Water Filter Portable', priceRange: [29, 69], margin: 0.48 },
      { base: 'Dry Bag 20L', priceRange: [15, 35], margin: 0.55 },
    ],
  },
};

// ─── Affinity Rules (built-in co-occurrence boosters) ───────────────────────
// These ensure the ARL engine discovers strong, realistic patterns.
// Each rule: [categoryA/indexA, categoryB/indexB, affinityStrength 0-1]
const AFFINITY_RULES = [
  // Camera ecosystem
  ['Electronics/0', 'Electronics/1', 0.70],  // Camera + Lens
  ['Electronics/0', 'Electronics/2', 0.55],  // Camera + Tripod
  ['Electronics/0', 'Electronics/3', 0.60],  // Camera + SD Card
  ['Electronics/0', 'Electronics/4', 0.50],  // Camera + Camera Bag
  ['Electronics/0', 'Books/4', 0.35],         // Camera + Photography Book

  // Audio pairing
  ['Electronics/5', 'Electronics/6', 0.45],  // Headphones + Speaker

  // Desk setup
  ['Electronics/8', 'Electronics/9', 0.50],  // Monitor + Keyboard
  ['Electronics/8', 'Electronics/7', 0.40],  // Monitor + USB Hub

  // Fashion ensemble
  ['Fashion/0', 'Fashion/1', 0.55],  // Sweater + Chinos
  ['Fashion/1', 'Fashion/2', 0.50],  // Chinos + Belt
  ['Fashion/1', 'Fashion/3', 0.45],  // Chinos + Sneakers
  ['Fashion/0', 'Fashion/5', 0.40],  // Sweater + Scarf

  // Home wellness
  ['Home/0', 'Home/1', 0.72],    // Diffuser + Essential Oils
  ['Home/2', 'Home/5', 0.40],    // Blanket + Candles
  ['Home/3', 'Home/4', 0.35],    // LED Bulbs + Planters

  // Running kit
  ['Sports/0', 'Sports/1', 0.68],  // Running Shoes + Socks
  ['Sports/0', 'Sports/2', 0.45],  // Running Shoes + GPS Watch
  ['Sports/0', 'Sports/3', 0.40],  // Running Shoes + Hydration Vest
  ['Sports/4', 'Sports/5', 0.50],  // Resistance Bands + Yoga Mat

  // Skincare routine
  ['Beauty/0', 'Beauty/1', 0.65],  // Vitamin C + Moisturizer
  ['Beauty/0', 'Beauty/3', 0.55],  // Vitamin C + SPF
  ['Beauty/1', 'Beauty/2', 0.50],  // Moisturizer + Retinol
  ['Beauty/4', 'Beauty/5', 0.45],  // Roller + Mask

  // Coffee ritual
  ['Kitchen/0', 'Kitchen/1', 0.70],  // Pour-Over + Grinder
  ['Kitchen/0', 'Kitchen/2', 0.65],  // Pour-Over + Coffee Beans
  ['Kitchen/1', 'Kitchen/2', 0.60],  // Grinder + Coffee Beans

  // Cooking
  ['Kitchen/3', 'Kitchen/4', 0.45],  // Skillet + Knife
  ['Kitchen/4', 'Kitchen/5', 0.40],  // Knife + Cutting Board

  // Camping kit
  ['Outdoor/0', 'Outdoor/1', 0.62],  // Tent + Sleeping Bag
  ['Outdoor/0', 'Outdoor/3', 0.50],  // Tent + Headlamp
  ['Outdoor/2', 'Outdoor/4', 0.42],  // Trekking Poles + Water Filter
  ['Outdoor/0', 'Outdoor/5', 0.38],  // Tent + Dry Bag

  // Cross-category
  ['Sports/0', 'Outdoor/2', 0.30],    // Running Shoes + Trekking Poles
  ['Books/0', 'Books/1', 0.50],       // ML Book + Data Science Book
  ['Books/2', 'Books/3', 0.40],       // Strategy + UX Design
];

// ─── Product Generation ────────────────────────────────────────────────────
function generateProducts() {
  const products = [];
  let skuCounter = 1000;

  for (const [category, config] of Object.entries(CATEGORIES)) {
    for (const item of config.items) {
      const brand = pick(config.brands);
      const price = +(randInt(item.priceRange[0] * 100, item.priceRange[1] * 100) / 100).toFixed(2);
      const stock = randInt(5, 200);

      products.push({
        sku: `SKU-${String(skuCounter++).padStart(5, '0')}`,
        name: `${brand} ${item.base}`,
        category,
        brand,
        price,
        margin: item.margin,
        profit: +(price * item.margin).toFixed(2),
        stock,
        features: [category.toLowerCase(), brand.toLowerCase(), item.base.toLowerCase()],
        rating: +(3.5 + rand() * 1.5).toFixed(1),
        reviewCount: randInt(12, 1200),
      });
    }
  }
  return products;
}

// ─── User Generation ───────────────────────────────────────────────────────
function generateUsers(count, products) {
  const categories = Object.keys(CATEGORIES);
  const users = [];
  for (let i = 0; i < count; i++) {
    // Each user has 1-3 preferred categories
    const prefCount = randInt(1, 3);
    const prefs = shuffle(categories).slice(0, prefCount);
    users.push({
      userId: `U-${String(i + 1).padStart(5, '0')}`,
      segment: pick(['new', 'returning', 'loyal', 'high-value']),
      preferredCategories: prefs,
      avgSessionDuration: randInt(60, 900), // seconds
      totalOrders: 0,
      totalSpend: 0,
    });
  }
  return users;
}

// ─── Affinity-Aware Order Generation ────────────────────────────────────────
function resolveAffinityProduct(key, products) {
  const [cat, idx] = key.split('/');
  const catProducts = products.filter(p => p.category === cat);
  return catProducts[parseInt(idx)] || null;
}

function generateOrders(count, users, products) {
  const orders = [];
  const affinityMap = new Map(); // sku -> [{sku, strength}]

  // Build affinity lookup
  for (const [keyA, keyB, strength] of AFFINITY_RULES) {
    const pA = resolveAffinityProduct(keyA, products);
    const pB = resolveAffinityProduct(keyB, products);
    if (!pA || !pB) continue;
    if (!affinityMap.has(pA.sku)) affinityMap.set(pA.sku, []);
    if (!affinityMap.has(pB.sku)) affinityMap.set(pB.sku, []);
    affinityMap.get(pA.sku).push({ sku: pB.sku, strength });
    affinityMap.get(pB.sku).push({ sku: pA.sku, strength });
  }

  for (let i = 0; i < count; i++) {
    const user = pick(users);
    const itemCount = randInt(2, 6);
    const basket = new Set();

    // Start with a product from user's preferred category
    const prefCat = pick(user.preferredCategories);
    const catProducts = products.filter(p => p.category === prefCat);
    const seed = pick(catProducts);
    basket.add(seed.sku);

    // Add affinity-driven items
    let current = seed;
    while (basket.size < itemCount) {
      const affinities = affinityMap.get(current.sku) || [];
      let added = false;

      for (const aff of affinities) {
        if (basket.has(aff.sku)) continue;
        if (rand() < aff.strength) {
          basket.add(aff.sku);
          current = products.find(p => p.sku === aff.sku);
          added = true;
          break;
        }
      }

      // Fallback: add random item from preferred categories
      if (!added) {
        const fallbackCat = pick(user.preferredCategories);
        const fallbackProducts = products.filter(p => p.category === fallbackCat && !basket.has(p.sku));
        if (fallbackProducts.length > 0) {
          const fp = pick(fallbackProducts);
          basket.add(fp.sku);
          current = fp;
        } else {
          // Any random product
          const anyProduct = pick(products);
          if (!basket.has(anyProduct.sku)) {
            basket.add(anyProduct.sku);
            current = anyProduct;
          } else {
            break;
          }
        }
      }
    }

    const items = [...basket].map(sku => {
      const p = products.find(pr => pr.sku === sku);
      const qty = rand() < 0.85 ? 1 : randInt(2, 3);
      return { sku, name: p.name, price: p.price, quantity: qty, category: p.category };
    });

    const total = items.reduce((s, it) => s + it.price * it.quantity, 0);
    user.totalOrders++;
    user.totalSpend += total;

    const daysAgo = randInt(0, 365);
    const orderDate = new Date(Date.now() - daysAgo * 86400000);

    orders.push({
      orderId: `ORD-${String(i + 1).padStart(6, '0')}`,
      userId: user.userId,
      items,
      total: +total.toFixed(2),
      itemCount: items.length,
      date: orderDate.toISOString().split('T')[0],
      timestamp: orderDate.getTime(),
    });
  }

  return orders;
}

// ─── Clickstream Event Generation ───────────────────────────────────────────
function generateClickstream(count, users, products) {
  const events = [];
  const eventTypes = ['page_view', 'product_view', 'add_to_cart', 'search', 'scroll', 'back_button', 'review_view', 'wishlist_add'];

  // Generate sessions
  const sessionCount = Math.ceil(count / 12);
  for (let s = 0; s < sessionCount; s++) {
    const user = pick(users);
    const sessionId = `SES-${String(s + 1).padStart(6, '0')}`;
    const eventsInSession = randInt(5, 20);
    const sessionStart = Date.now() - randInt(0, 30 * 86400000);
    let currentTime = sessionStart;
    const isHighIntent = rand() < 0.3; // 30% of sessions are high-intent

    for (let e = 0; e < eventsInSession && events.length < count; e++) {
      const product = pick(products);
      let eventType;

      if (isHighIntent) {
        // High-intent sessions have more product views and add-to-carts
        const weights = [0.10, 0.35, 0.25, 0.10, 0.05, 0.02, 0.08, 0.05];
        const r = rand();
        let cumulative = 0;
        let idx = 0;
        for (let w = 0; w < weights.length; w++) {
          cumulative += weights[w];
          if (r < cumulative) { idx = w; break; }
        }
        eventType = eventTypes[idx];
      } else {
        // Low-intent: more browsing, scrolling, back buttons
        const weights = [0.25, 0.20, 0.05, 0.15, 0.15, 0.10, 0.05, 0.05];
        const r = rand();
        let cumulative = 0;
        let idx = 0;
        for (let w = 0; w < weights.length; w++) {
          cumulative += weights[w];
          if (r < cumulative) { idx = w; break; }
        }
        eventType = eventTypes[idx];
      }

      currentTime += randInt(2000, 60000); // 2s to 60s between events

      events.push({
        eventId: `EVT-${String(events.length + 1).padStart(7, '0')}`,
        sessionId,
        userId: user.userId,
        eventType,
        productSku: ['page_view', 'search', 'scroll'].includes(eventType) ? null : product.sku,
        productCategory: product.category,
        timestamp: currentTime,
        dwellTime: eventType === 'product_view' ? randInt(3, 120) : null,
        scrollDepth: eventType === 'scroll' ? +(rand() * 100).toFixed(0) : null,
        searchQuery: eventType === 'search' ? pick([
          product.category.toLowerCase(),
          product.brand.toLowerCase(),
          product.name.split(' ').slice(1).join(' ').toLowerCase(),
          `${product.category.toLowerCase()} under $${Math.ceil(product.price / 50) * 50}`,
        ]) : null,
        isHighIntent,
      });
    }
  }

  return events.slice(0, count);
}

// ─── Main Generation Pipeline ──────────────────────────────────────────────
function generateDataset() {
  console.log('🏭 Generating synthetic e-commerce dataset...\n');

  const products = generateProducts();
  console.log(`  ✅ ${products.length} products across ${Object.keys(CATEGORIES).length} categories`);

  const users = generateUsers(500, products);
  console.log(`  ✅ ${users.length} users`);

  const orders = generateOrders(1500, users, products);
  console.log(`  ✅ ${orders.length} orders`);

  const clickstream = generateClickstream(10000, users, products);
  console.log(`  ✅ ${clickstream.length} clickstream events`);

  const avgOrderValue = orders.reduce((s, o) => s + o.total, 0) / orders.length;
  const maxOrderValue = Math.max(...orders.map(o => o.total));
  console.log(`\n📊 Dataset Statistics:`);
  console.log(`   Average Order Value: $${avgOrderValue.toFixed(2)}`);
  console.log(`   Max Order Value:     $${maxOrderValue.toFixed(2)}`);
  console.log(`   Total Revenue:       $${orders.reduce((s, o) => s + o.total, 0).toFixed(2)}`);

  return { products, users, orders, clickstream, affinityRules: AFFINITY_RULES };
}

// Export for use by other modules
module.exports = { generateDataset, CATEGORIES, AFFINITY_RULES };

// If run directly, output stats
if (require.main === module) {
  const data = generateDataset();
  console.log('\n✨ Dataset generation complete. Use require("./data/generator") to access.');
}
