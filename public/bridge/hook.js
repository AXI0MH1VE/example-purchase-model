/**
 * Axiom Hive - Integration Bridge (Middleman Utility)
 * Drop-in script for Shopify, Squarespace, or custom storefronts.
 */
(function() {
  window.AxiomHive = {
    apiKey: null,
    endpoint: 'http://localhost:3000/api/v1/transaction/swap',

    init: function(apiKey, customEndpoint) {
      this.apiKey = apiKey;
      if (customEndpoint) this.endpoint = customEndpoint;
      console.log('[Axiom Hive] SaaS Hub Integration Bridge Initialized.');
    },

    evaluateSwap: async function(cartItem) {
      if (!this.apiKey) {
        console.error('[Axiom Hive] SDK not initialized. Call init(apiKey).');
        return { success: false };
      }

      try {
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${this.apiKey}` 
          },
          body: JSON.stringify(cartItem)
        });
        
        const data = await response.json();
        if(data.success) {
            console.log(`[Axiom Hive Swap Executed] Savings captured: ${data.savingsPct}`);
        }
        return data;
      } catch (err) {
        console.error('[Axiom Hive] Hook Execution Failed:', err);
        return { success: false, reason: 'Network failure' };
      }
    }
  };
})();
