/**
 * Scalability & Benchmarking Plan
 * =================================
 * Product: Smart Pairing Engine v2.0
 */

'use strict';

const ScalabilityPlan = `
# Scalability Planning

1. **Horizontal Pod Autoscaling**:
   - The Gateway Controller (Node.js/Express) is stateless. 
   - Deploy multiple EngineService instances across a Kubernetes cluster.
   - Use a Redis Cache layer to store finalized recommendations avoiding frequent full recalculations.

2. **Asynchronous Hot-Rebuilds**:
   - \`syncLifecycle()\` handles large dataset rebuilds. Move this compute to a specialized Background Worker context using BullMQ or AWS SQS.
   
3. **Benchmarking Presets against Industry Standards**:
   - **Retail Profile**: ARL Weight (0.40) typically drives +30% co-purchase uplift. Benchmarks aim for < 200ms latency.
   - **Legal Profile**: CB Weight (0.50) relies heavily on vector similarity. As catalog size grows, switch from in-memory exact match to HNSW (Hierarchical Navigable Small World) graphs for < 50ms latency search.
`;

module.exports = ScalabilityPlan;
