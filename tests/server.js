const app = require('express')();

const proxy = new (require('../').Proxy)({ debug: true, minCacheSize: 0 });

app.use('/proxy', proxy.asRouter());

app.use('/api', (req, res) => {
    res.json({
        message: 'Hello World',
    });
});

app.listen(1337);
