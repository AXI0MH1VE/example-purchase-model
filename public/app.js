/**
 * Smart Pairing Engine — Dashboard Application
 * ===============================================
 * Client-side logic for the NMG Axiom Hive recommendation engine dashboard.
 * Functional Minimalism: every element serves a specific purpose.
 *
 * Developer: NMG
 * Version: 1.0
 */

'use strict';

const API_BASE = '';

// ─── State ──────────────────────────────────────────────────────────────────
let metricsData = null;
let rulesData = null;
let productsData = null;
let usersData = null;
let sessionsData = null;
let selectedProductSku = null;

// ─── Initialization ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await Promise.all([
      loadMetrics(),
      loadRules(),
      loadProducts(),
      loadUsers(),
      loadSessions(),
    ]);

    renderMetrics();
    renderAOVComparison();
    renderRulesTable();
    renderHeatmap();
    renderSessionList();
    populateProductSelect();
    populateUserSelect();

  } catch (err) {
    console.error('Dashboard initialization failed:', err);
  }
});

// ─── Sidebar Navigation ────────────────────────────────────────────────────
const sectionNames = {
  overview: 'Dashboard',
  pairings: 'Product Pairings',
  rules: 'Association Rules',
  heatmap: 'Affinity Heatmap',
  intent: 'Intent Monitor',
  bundles: 'Bundle Builder',
  recommendations: 'User Recommendations',
  lifecycle: 'Lifecycle Sync',
};


window.navigateTo = function (section) {
  // Update breadcrumb
  const bc = document.getElementById('breadcrumb-current');
  bc.textContent = sectionNames[section] || 'Dashboard';

  // Show/Hide sections
  document.querySelectorAll('.section').forEach(el => {
    if (el.id === `section-${section}`) {
      el.style.display = 'grid'; // Re-enable grid display
    } else {
      el.style.display = 'none';
    }
  });

  // Scroll to section
  const target = document.getElementById(`section-${section}`);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};


// ─── Data Loading ───────────────────────────────────────────────────────────
async function loadMetrics() {
  const res = await fetch(`${API_BASE}/api/metrics`);
  metricsData = await res.json();
}

async function loadRules() {
  const res = await fetch(`${API_BASE}/api/rules?limit=50`);
  rulesData = await res.json();
}

async function loadProducts() {
  const res = await fetch(`${API_BASE}/api/products`);
  productsData = await res.json();
}

async function loadUsers() {
  const res = await fetch(`${API_BASE}/api/users?limit=50`);
  usersData = await res.json();
}

async function loadSessions() {
  const res = await fetch(`${API_BASE}/api/sessions?limit=20`);
  sessionsData = await res.json();
}

// ─── Metrics Rendering ─────────────────────────────────────────────────────
function renderMetrics() {
  if (!metricsData) return;
  const { aov, associations, clickstream } = metricsData;

  animateCounter('metric-baseline-aov', aov.baseline, '$');
  animateCounter('metric-engine-aov', aov.withEngine, '$');
  animateCounter('metric-rules', associations.totalRules, '', 0);
  animateCounter('metric-intent', clickstream.highIntentRate * 100, '', 1, '%');

  document.getElementById('metric-uplift').textContent = `↑ +${aov.upliftPercent}% uplift`;
}

function animateCounter(elementId, target, prefix = '', decimals = 2, suffix = '') {
  const el = document.getElementById(elementId);
  if (!el) return;

  const duration = 1200;
  const startTime = performance.now();

  function update(currentTime) {
    const progress = Math.min((currentTime - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = target * eased;
    el.textContent = `${prefix}${current.toFixed(decimals)}${suffix}`;
    if (progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

// ─── AOV Comparison ─────────────────────────────────────────────────────────
function renderAOVComparison() {
  if (!metricsData) return;
  const { aov } = metricsData;
  const maxHeight = 180;

  setTimeout(() => {
    document.getElementById('aov-baseline-bar').style.height =
      `${(aov.baseline / aov.withEngine) * maxHeight}px`;
  }, 300);

  setTimeout(() => {
    document.getElementById('aov-engine-bar').style.height = `${maxHeight}px`;
  }, 500);

  document.getElementById('aov-baseline-value').textContent = `$${aov.baseline.toFixed(0)}`;
  document.getElementById('aov-engine-value').textContent = `$${aov.withEngine.toFixed(0)}`;
  document.getElementById('aov-uplift-label').textContent = `+${aov.upliftPercent}%`;
}

// ─── Rules Table ────────────────────────────────────────────────────────────
function renderRulesTable() {
  if (!rulesData) return;

  document.getElementById('rules-count-badge').textContent = `${rulesData.totalRules} rules`;

  const tbody = document.getElementById('rules-tbody');
  tbody.innerHTML = '';

  for (const rule of rulesData.rules.slice(0, 20)) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="product-name">${truncate(rule.antecedentNames.join(', '), 28)}</span></td>
      <td><span class="rule-arrow">→</span></td>
      <td><span class="product-name">${truncate(rule.consequentNames.join(', '), 28)}</span></td>
      <td><span class="rule-metric">${rule.lift.toFixed(2)}</span></td>
      <td><span class="rule-metric">${(rule.confidence * 100).toFixed(0)}%</span></td>
      <td><span class="rule-metric">${(rule.support * 100).toFixed(2)}%</span></td>
    `;
    tbody.appendChild(tr);
  }
}

// ─── Heatmap ────────────────────────────────────────────────────────────────
function renderHeatmap() {
  if (!rulesData || !rulesData.affinityMatrix) return;

  const container = document.getElementById('heatmap-container');
  const { categories, matrix } = rulesData.affinityMatrix;

  let maxVal = 0;
  for (const catA of categories) {
    for (const catB of categories) {
      if (matrix[catA][catB] > maxVal) maxVal = matrix[catA][catB];
    }
  }

  let html = '<table class="heatmap-table"><thead><tr><th class="row-label"></th>';
  for (const cat of categories) {
    html += `<th>${cat.slice(0, 5)}</th>`;
  }
  html += '</tr></thead><tbody>';

  for (const catA of categories) {
    html += `<tr><th class="row-label">${catA}</th>`;
    for (const catB of categories) {
      const value = matrix[catA][catB];
      const normalized = maxVal > 0 ? value / maxVal : 0;
      const color = getHeatmapColor(normalized);
      const display = value > 0 ? value.toFixed(1) : '—';
      html += `<td class="heatmap-cell" style="background: ${color};" title="${catA} → ${catB}: ${display}">${display}</td>`;
    }
    html += '</tr>';
  }

  html += '</tbody></table>';
  container.innerHTML = html;
}

function getHeatmapColor(normalized) {
  if (normalized === 0) return '#F2F2F2';
  // Grayscale: white to black
  const lightness = Math.round(95 - normalized * 75);
  return `hsl(0, 0%, ${lightness}%)`;
}

// ─── Product Pairing Explorer ───────────────────────────────────────────────
function populateProductSelect() {
  if (!productsData) return;

  const select = document.getElementById('product-select');
  const categories = [...new Set(productsData.products.map(p => p.category))].sort();

  for (const cat of categories) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = cat;

    const catProducts = productsData.products
      .filter(p => p.category === cat)
      .sort((a, b) => b.price - a.price);

    for (const product of catProducts) {
      const option = document.createElement('option');
      option.value = product.sku;
      option.textContent = `${product.name} — $${product.price.toFixed(2)}`;
      optgroup.appendChild(option);
    }

    select.appendChild(optgroup);
  }

  select.addEventListener('change', (e) => {
    if (e.target.value) {
      selectedProductSku = e.target.value;
      loadProductPairings(e.target.value);
      loadBundleData(e.target.value);
    }
  });
}

async function loadProductPairings(sku) {
  const container = document.getElementById('pairing-results');
  container.innerHTML = renderLoadingSkeleton(5);

  try {
    const res = await fetch(`${API_BASE}/api/pairings/${sku}`);
    const data = await res.json();

    const allRecs = [];
    const seen = new Set();

    for (const rule of data.associationRules) {
      for (const consequentSku of rule.consequent) {
        if (seen.has(consequentSku)) continue;
        seen.add(consequentSku);
        allRecs.push({
          sku: consequentSku,
          name: rule.consequentNames[rule.consequent.indexOf(consequentSku)],
          lift: rule.lift, confidence: rule.confidence, support: rule.support,
          source: 'ARL', price: null, category: null,
        });
      }
    }

    for (const item of data.collaborativeFiltering) {
      if (seen.has(item.sku)) continue;
      seen.add(item.sku);
      allRecs.push({ ...item, source: 'CF', lift: null, confidence: null, support: null });
    }

    for (const item of data.contentBased) {
      if (seen.has(item.sku)) continue;
      seen.add(item.sku);
      allRecs.push({ ...item, source: 'CB', lift: null, confidence: null, support: null });
    }

    if (productsData) {
      const prodMap = new Map(productsData.products.map(p => [p.sku, p]));
      for (const rec of allRecs) {
        const prod = prodMap.get(rec.sku);
        if (prod) {
          rec.name = rec.name || prod.name;
          rec.price = rec.price || prod.price;
          rec.category = rec.category || prod.category;
        }
      }
    }

    if (allRecs.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No pairings found</p></div>';
      return;
    }

    container.innerHTML = allRecs.slice(0, 12).map((rec, i) => `
      <div class="product-item">
        <div class="product-rank ${i < 3 ? 'gold' : ''}">${String(i + 1).padStart(2, '0')}</div>
        <div class="product-info">
          <div class="product-name">${rec.name || rec.sku}</div>
          <div class="product-meta">
            <span class="product-category">${rec.category || '—'}</span>
            <span class="product-category">${rec.source}</span>
          </div>
          <div class="score-badges">
            ${rec.lift ? `<span class="score-badge">Lift ${rec.lift.toFixed(2)}</span>` : ''}
            ${rec.confidence ? `<span class="score-badge">Conf ${(rec.confidence * 100).toFixed(0)}%</span>` : ''}
            ${rec.similarity ? `<span class="score-badge">Sim ${rec.similarity.toFixed(3)}</span>` : ''}
          </div>
        </div>
        <div class="product-price">${rec.price ? '$' + rec.price.toFixed(2) : ''}</div>
      </div>
    `).join('');

    document.getElementById('behavioral-section').style.display = 'grid';

  } catch (err) {
    container.innerHTML = '<div class="empty-state"><p>Error loading pairings</p></div>';
  }
}

// ─── User Recommendations ───────────────────────────────────────────────────
function populateUserSelect() {
  if (!usersData) return;

  const select = document.getElementById('user-select');
  const segments = [...new Set(usersData.users.map(u => u.segment))].sort();

  for (const seg of segments) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = seg.charAt(0).toUpperCase() + seg.slice(1);

    for (const user of usersData.users.filter(u => u.segment === seg).slice(0, 10)) {
      const option = document.createElement('option');
      option.value = user.userId;
      option.textContent = `${user.userId} — ${seg} — $${user.totalSpend.toFixed(0)}`;
      optgroup.appendChild(option);
    }

    select.appendChild(optgroup);
  }

  select.addEventListener('change', (e) => {
    if (e.target.value) loadUserRecommendations(e.target.value);
  });
}

async function loadUserRecommendations(userId) {
  const container = document.getElementById('user-recommendations');
  container.innerHTML = renderLoadingSkeleton(5);

  try {
    const productParam = selectedProductSku ? `&product=${selectedProductSku}` : '';
    const res = await fetch(`${API_BASE}/api/recommendations/${userId}?limit=10${productParam}`);
    const data = await res.json();

    if (data.recommendations.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No recommendations</p></div>';
      return;
    }

    const latency = data.metadata?.latencyMs || 0;

    container.innerHTML = `
      ${latency > 0 ? `<div class="social-proof-bar" style="margin-bottom: 8px;">
        Generated in <strong>${latency}ms</strong> — AOV uplift: +${data.metadata?.aovUplift || 0}%
      </div>` : ''}
      ${data.recommendations.map((rec, i) => `
        <div class="product-item">
          <div class="product-rank ${i < 3 ? 'gold' : ''}">${String(i + 1).padStart(2, '0')}</div>
          <div class="product-info">
            <div class="product-name">${rec.name}</div>
            <div class="product-meta">
              <span class="product-category">${rec.category}</span>
              ${rec.isHero ? '<span class="score-badge hero">HERO</span>' : ''}
            </div>
            <div class="score-badges">
              <span class="score-badge">Score ${rec.score.toFixed(3)}</span>
              ${rec.sourceCount ? `<span class="score-badge">${rec.sourceCount} src</span>` : ''}
            </div>
          </div>
          <div class="product-price">$${rec.price.toFixed(2)}</div>
        </div>
      `).join('')}
    `;

  } catch (err) {
    container.innerHTML = '<div class="empty-state"><p>Error loading recommendations</p></div>';
  }
}

// ─── Bundle Builder ─────────────────────────────────────────────────────────
async function loadBundleData(sku) {
  const container = document.getElementById('bundle-section');
  const socialBody = document.getElementById('social-proof-body');
  const scarcityBody = document.getElementById('scarcity-body');

  container.innerHTML = renderLoadingSkeleton(3);

  try {
    const res = await fetch(`${API_BASE}/api/bundles/${sku}`);
    const data = await res.json();

    if (data.behavioral?.decoyPricing?.tiers?.length > 0) {
      const tiers = data.behavioral.decoyPricing.tiers;
      container.innerHTML = `
        <div class="bundle-tiers">
          ${tiers.map(tier => `
            <div class="bundle-tier ${tier.isTarget ? 'target' : ''} ${tier.isDecoy ? 'decoy' : ''}">
              ${tier.badge ? `<div class="tier-badge">${tier.badge}</div>` : ''}
              <div class="tier-name">${tier.label}</div>
              <div class="tier-price">$${tier.total.toFixed(2)}</div>
              <div class="tier-items">${tier.items?.length || tier.itemCount || 1} item${(tier.items?.length || tier.itemCount || 1) > 1 ? 's' : ''}</div>
              ${tier.savings ? `<div class="tier-savings">Save $${tier.savings.toFixed(2)}</div>` : ''}
            </div>
          `).join('')}
        </div>
        <div class="social-proof-bar" style="margin-top: 16px;">
          Decoy pricing steers 73% of customers toward the target tier
        </div>
      `;
    } else {
      container.innerHTML = '<div class="empty-state"><p>No bundle data available</p></div>';
    }

    if (data.behavioral?.socialProof) {
      const sp = data.behavioral.socialProof;
      socialBody.innerHTML = `
        <div class="social-proof-bar" style="margin-bottom: 12px;">
          ${sp.trustBadge} — ${sp.totalBuyers} customers purchased ${sp.heroProduct}
        </div>
        <div class="product-list">
          ${sp.coPurchases.slice(0, 6).map((cp, i) => `
            <div class="product-item">
              <div class="product-rank ${i < 2 ? 'gold' : ''}">${String(i + 1).padStart(2, '0')}</div>
              <div class="product-info">
                <div class="product-name">${cp.name}</div>
                <div class="product-meta">
                  <span class="product-category">${cp.message}</span>
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 0.85rem; font-weight: 700; font-family: var(--font-mono);">${cp.coPurchaseRate}%</div>
                <div style="font-size: 0.65rem; color: var(--text-tertiary);">co-purchase</div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (data.behavioral?.scarcity) {
      const signals = data.behavioral.scarcity.filter(s => s.signals.length > 0);
      if (signals.length > 0) {
        scarcityBody.innerHTML = `
          <div class="product-list">
            ${signals.slice(0, 8).map(item => `
              <div class="product-item" style="flex-direction: column; align-items: flex-start; gap: 8px;">
                <div class="product-name">${item.name}</div>
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                  ${item.signals.map(sig => `
                    <span class="scarcity-tag ${sig.severity}">${sig.message}</span>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        scarcityBody.innerHTML = '<div class="empty-state"><p>All items well-stocked</p></div>';
      }
    }

  } catch (err) {
    container.innerHTML = '<div class="empty-state"><p>Error loading bundle data</p></div>';
  }
}

// ─── Clickstream Intent ─────────────────────────────────────────────────────
function renderSessionList() {
  if (!sessionsData) return;

  document.getElementById('intent-stats-badge').textContent =
    `${sessionsData.stats.totalSessions} sessions`;

  const container = document.getElementById('session-list');
  const sessions = sessionsData.sessions.slice(0, 12);

  if (sessions.length > 0) renderIntentGauge(sessions[0]);

  container.innerHTML = sessions.map(session => `
    <div class="session-item" data-session-id="${session.sessionId}"
         onclick="selectSession('${session.sessionId}')">
      <div class="intent-dot ${session.prediction.intentLevel}"></div>
      <div class="session-info">
        <div class="session-id">${session.sessionId}</div>
        <div class="session-meta">
          ${session.eventCount} events · ${session.prediction.intentLevel}
          ${session.features.addToCarts > 0 ? ' · cart: ' + session.features.addToCarts : ''}
        </div>
      </div>
      <div class="session-score">${(session.prediction.intentScore * 100).toFixed(0)}%</div>
    </div>
  `).join('');
}

function renderIntentGauge(session) {
  const gaugeRing = document.getElementById('gauge-ring');
  const interventionDisplay = document.getElementById('intervention-display');

  const score = session.prediction.intentScore;
  const level = session.prediction.intentLevel;
  const percentage = score * 100;
  const circumference = 2 * Math.PI * 60;
  const offset = circumference - (percentage / 100) * circumference;

  // Monochrome gauge: black stroke, clean typography
  const strokeColor = level === 'high' ? '#1A8754' : level === 'medium' ? '#B8860B' : '#CCCCCC';

  gaugeRing.innerHTML = `
    <svg width="140" height="140" viewBox="0 0 140 140" style="position: absolute; transform: rotate(-90deg);">
      <circle cx="70" cy="70" r="60" fill="none" stroke="#F2F2F2" stroke-width="6" />
      <circle cx="70" cy="70" r="60" fill="none" stroke="${strokeColor}" stroke-width="6"
        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
        stroke-linecap="butt" style="transition: stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1);" />
    </svg>
    <div style="text-align: center; z-index: 1;">
      <div style="font-size: 1.75rem; font-weight: 800; font-family: var(--font-mono); letter-spacing: -0.02em;">
        ${percentage.toFixed(0)}%
      </div>
      <div style="font-size: 10px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.1em; font-family: var(--font-mono);">
        ${level} intent
      </div>
    </div>
  `;

  const intv = session.intervention;
  interventionDisplay.innerHTML = `
    <div class="intervention-banner">
      <div class="intervention-strategy">${intv.strategy.replace(/_/g, ' ')}</div>
      <div class="intervention-action">${intv.action}</div>
      ${intv.message ? `<div style="margin-top: 6px; font-size: 0.8rem; font-weight: 500;">"${intv.message}"</div>` : ''}
    </div>
    ${session.prediction.factors.length > 0 ? `
      <div class="intent-factors">
        ${session.prediction.factors.map(f => `
          <div class="factor-item">
            <div class="factor-icon ${f.impact}"></div>
            <span>${f.factor}</span>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;
}

window.selectSession = function (sessionId) {
  if (!sessionsData) return;
  const session = sessionsData.sessions.find(s => s.sessionId === sessionId);
  if (session) {
    document.querySelectorAll('.session-item').forEach(el => el.classList.remove('active'));
    document.querySelector(`[data-session-id="${sessionId}"]`)?.classList.add('active');
    renderIntentGauge(session);
  }
};

// ─── Utilities ──────────────────────────────────────────────────────────────
function truncate(str, max) {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function renderLoadingSkeleton(lines) {
  return Array.from({ length: lines }, (_, i) =>
    `<div class="loading-skeleton skeleton-line" style="width: ${90 - i * 6}%; height: 40px; margin-bottom: 6px;"></div>`
  ).join('');
}

// ─── Lifecycle Sync ──────────────────────────────────────────────────────────
window.triggerLifecycleSync = async function() {
  const btn = document.getElementById('lifecycle-sync-btn');
  const results = document.getElementById('lifecycle-results');
  
  btn.disabled = true;
  btn.innerHTML = '<span class="icon">⌛</span> Analyzing Trending Charts...';
  results.innerHTML = renderLoadingSkeleton(4);

  try {
    const res = await fetch(`${API_BASE}/api/lifecycle/sync`);
    const data = await res.json();

    // Reload catalog data
    await loadProducts();
    await loadMetrics();
    
    // Update UI elements
    populateProductSelect();
    renderMetrics();
    
    renderLifecycleResults(data);
    
    btn.disabled = false;
    btn.innerHTML = '<span class="icon">✅</span> Sync Complete';
    setTimeout(() => {
      btn.innerHTML = '<span class="icon">🔄</span> Sync Catalog with Trending Charts';
    }, 3000);

  } catch (err) {
    console.error('Lifecycle sync failed:', err);
    results.innerHTML = '<div class="empty-state"><p>Error synchronizing lifecycle data</p></div>';
    btn.disabled = false;
  }
};

function renderLifecycleResults(data) {
  const container = document.getElementById('lifecycle-results');
  
  container.innerHTML = `
    <div class="audit-grid">
      <div class="audit-block">
        <h4>Synthesized New Products</h4>
        ${data.addedProducts.length > 0 ? data.addedProducts.map(p => `
          <div class="added-item">
            <div style="font-weight: 700;">${p.name}</div>
            <div class="product-meta">
              <span class="product-category">${p.category}</span>
              <span class="sku">${p.sku}</span>
            </div>
          </div>
        `).join('') : '<p style="font-size: 0.8rem; color: var(--text-tertiary);">No new products added.</p>'}
      </div>
      
      <div class="audit-block">
        <h4>Stagnant SKUs Removed</h4>
        <div style="max-height: 150px; overflow-y: auto;">
          ${data.removedSkus.length > 0 ? data.removedSkus.map(sku => `
            <div class="removed-item">${sku}</div>
          `).join('') : '<p style="font-size: 0.8rem; color: var(--text-tertiary);">No products removed.</p>'}
        </div>
      </div>
    </div>
    
    <div style="margin-top: 20px; border-top: 1px dashed var(--border-strong); padding-top: 10px;">
      <div class="audit-stat">
        <span>Analytics Sample Period</span>
        <span>Axiom Hive Real-Time</span>
      </div>
      <div class="audit-stat">
        <span>Average Inventory Velocity</span>
        <span>${data.stats.averageVelocity}x</span>
      </div>
      <div class="audit-stat">
        <span>High-Growth Threshold</span>
        <span>${data.stats.topCategories.join(', ')}</span>
      </div>
    </div>
  `;
}

