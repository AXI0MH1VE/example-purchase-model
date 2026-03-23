'use strict';

/**
 * Axiom Hive - API Authentication & Multi-Tenant Middleware
 * Enforces API Key validation, maps tenant configuration, and handles tiers.
 */

// Simulated Tenant Registry (Database mock)
const VALID_TENANTS = {
  'demo_key_123': { tenantId: 'tenant_nmg_commercial', tier: 'enterprise', active: true },
  'test_key_456': { tenantId: 'tenant_test_sandbox', tier: 'starter', active: true }
};

const validateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid Bearer token' });
  }

  const token = authHeader.split(' ')[1];
  const tenant = VALID_TENANTS[token];
  
  if (!tenant) {
    return res.status(403).json({ error: 'Forbidden: Invalid or Suspended API Key' });
  }

  // Inject tenant context into request
  req.tenant = tenant;
  next();
};

const requireEnterprise = (req, res, next) => {
  if (req.tenant.tier !== 'enterprise') {
    return res.status(403).json({ error: 'Payment Required: Upgrade to Enterprise tier to access this route' });
  }
  next();
};

module.exports = { validateToken, requireEnterprise };
