const http = require('http');

async function testEndpoint(token, path, method = 'GET', bodyData = null) {
  return new Promise((resolve) => {
    const postData = bodyData ? JSON.stringify(bodyData) : '';
    const headers = {
      'Authorization': `Bearer ${token}`
    };
    if (bodyData) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: headers
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          path,
          method,
          status: res.statusCode,
          ok: res.statusCode >= 200 && res.statusCode < 300,
          data: data.slice(0, 150)
        });
      });
    });

    req.on('error', (e) => {
      resolve({ path, method, status: 0, ok: false, error: e.message });
    });

    req.setTimeout(12000, () => {
      req.destroy();
      resolve({ path, method, status: 408, ok: false, error: 'TIMEOUT' });
    });

    if (bodyData) {
      req.write(postData);
    }
    req.end();
  });
}

async function login() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ email: 'munokolive@gmail.com', password: '77916407@@Mu' });
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed.token);
        } catch(e) { reject(e); }
      });
    });
    req.write(data);
    req.end();
  });
}

async function run() {
  const token = await login();
  console.log('Got token for testing.');

  const tests = [
    { path: '/api/health', method: 'GET' },
    { path: '/api/auth/me', method: 'GET' },
    { path: '/api/dashboard/kpi', method: 'GET' },
    { path: '/api/dashboard/stats', method: 'GET' },
    { path: '/api/dashboard/revenus', method: 'GET' },
    { path: '/api/dashboard/retards', method: 'GET' },
    { path: '/api/dashboard/activites', method: 'GET' },
    { path: '/api/dashboard/etat-creances', method: 'GET' },
    { path: '/api/clients', method: 'GET' },
    { path: '/api/clients/stats', method: 'GET' },
    { path: '/api/clients?deletedAt=not.null', method: 'GET' },
    { path: '/api/biens', method: 'GET' },
    { path: '/api/contrats', method: 'GET' },
    { path: '/api/contrats/stats/overview', method: 'GET' },
    { path: '/api/leases', method: 'GET' },
    { path: '/api/leases/stats/overview', method: 'GET' },
    { path: '/api/leases?deletedAt=not.null', method: 'GET' },
    { path: '/api/payments', method: 'GET' },
    { path: '/api/payments/registre/caisse', method: 'GET' },
    { path: '/api/payments?deletedAt=not.null', method: 'GET' },
    { path: '/api/buildings', method: 'GET' },
    { path: '/api/buildings/stats/overview', method: 'GET' },
    { path: '/api/buildings?deletedAt=not.null', method: 'GET' },
    { path: '/api/visites', method: 'GET' },
    { path: '/api/visites?deletedAt=not.null', method: 'GET' },
    { path: '/api/visites/relances/en-attente', method: 'GET' },
    { path: '/api/alertes', method: 'GET' },
    { path: '/api/alertes/count', method: 'GET' },
    { path: '/api/alertes/non-lues/count', method: 'GET' },
    { path: '/api/alertes/dashboard/urgentes', method: 'GET' },
    { path: '/api/recouvrement/dashboard', method: 'GET' },
    { path: '/api/recouvrement/clients-retard', method: 'GET' },
    { path: '/api/recouvrement/droits-terre', method: 'GET' },
    { path: '/api/recouvrement/statistiques-mensuelles', method: 'GET' },
    { path: '/api/recouvrement/relance/22', method: 'POST', body: {} },
    { path: '/api/commissions', method: 'GET' },
    { path: '/api/commissions/referrers', method: 'GET' },
    { path: '/api/commissions/referrers/classement', method: 'GET' },
    { path: '/api/users', method: 'GET' },
    { path: '/api/users/profile/me', method: 'GET' },
    { path: '/api/admin/users', method: 'GET' },
    { path: '/api/admin/audit-logs', method: 'GET' },
    { path: '/api/admin/system-status', method: 'GET' },
    { path: '/api/admin/demo-stats', method: 'GET' }
  ];

  console.log(`Executing validation across ${tests.length} routes...\n`);
  const failures = [];
  const successes = [];

  for (const t of tests) {
    const res = await testEndpoint(token, t.path, t.method, t.body);
    if (res.ok) {
      successes.push(res);
      console.log(`✅ [${res.status}] ${t.method} ${res.path} -> ${res.data.slice(0, 70)}`);
    } else {
      failures.push(res);
      console.log(`❌ [${res.status}] ${t.method} ${res.path} -> ${res.data || res.error}`);
    }
  }

  console.log(`\n========================================`);
  console.log(`FINAL RESULT: ${successes.length} SUCCESS, ${failures.length} FAILED.`);
  console.log(`========================================`);

  // Test pagination total
  const clientsRes = await testEndpoint(token, '/api/clients');
  try {
    const parsed = JSON.parse(clientsRes.data);
    console.log(`Pagination Check /api/clients: total=${parsed.pagination?.total}, totalPages=${parsed.pagination?.totalPages}`);
  } catch(e) {}
}

run();
