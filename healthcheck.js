const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/status',
    method: 'GET',
    timeout: 10000
};

const req = http.request(options, (res) => {
    if (res.statusCode === 200) {
        console.log('✅ Application is healthy');
        process.exit(0);
    } else {
        console.log(`❌ Application unhealthy (Status: ${res.statusCode})`);
        process.exit(1);
    }
});

req.on('timeout', () => {
    console.log('❌ Health check timeout');
    req.destroy();
    process.exit(1);
});

req.on('error', (error) => {
    console.log(`❌ Health check failed: ${error.message}`);
    process.exit(1);
});

req.end();