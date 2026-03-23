/**
 * Axiom Hive - Automation Script: Domain Swap
 * ===========================================
 * Executes a live domain swap, validating Gateway Controller resilience.
 */

const http = require('http');

const payload = JSON.stringify({ domainKey: 'LEGAL_KNOWLEDGE' });

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/gateway/configure',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': payload.length
  }
};

console.log('🔄 Initiating Domain Swap to LEGAL_KNOWLEDGE...');

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ Swap Successful:', JSON.parse(data).message);
    } else {
      console.log('❌ Swap Failed:', data);
    }
  });
});

req.on('error', error => console.error('Connection Error:', error.message));
req.write(payload);
req.end();
