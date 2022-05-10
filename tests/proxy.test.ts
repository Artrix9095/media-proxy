import axios from 'axios';

test('Test Proxy Server', async () => {
    const options = {
        url: 'http://localhost:1337/api',
    };
    const proxyResponse = await axios.get(
        `http://localhost:1337/proxy/default/${Buffer.from(JSON.stringify(options)).toString('base64url')}`
    );
    const originalResponse = await axios.get(options.url);

    expect(originalResponse.status).toBe(200);
    expect(proxyResponse.status).toBe(200);
    expect(proxyResponse.data).toEqual(originalResponse.data);
}, 10000);

/*
NOTES:
It appears that the proxy server will actually respond *faster* than the original request if it was cached,
this is due to the fact that the proxy server will not actually make a request to the original url, but instead
will use the cached response from the original request. Since the website has to go through some sort of
Backend SSR (Server Side Rendering) to get the data, it will take some time to get the data.
But with the proxy, it already has it prefetched, so it will be instant. If the proxy server is not cached,
It can take a extra 30-100ms to get the data.
*/
test('Compare Proxy server speed to original server speed', async () => {
    const url = 'https://stackoverflow.com';
    const options = {
        url,
    };
    const start = Date.now();
    const response = await axios.get(
        `http://localhost:1337/proxy/default/${Buffer.from(JSON.stringify(options)).toString('base64url')}`,
        {
            headers: {
                // Run with no cache so we can get the true proxy speed
                'Cache-Control': 'no-cache',
            },
        }
    );
    // Proxied Request
    const end = Date.now();
    expect(response.status).toBe(200);
    expect(response.data).toBeTruthy();
    console.log(`Proxy server speed: ${end - start}ms`);

    // Original Request
    const start2 = Date.now();
    const response2 = await axios.get(url);
    const end2 = Date.now();
    expect(response2.status).toBe(200);
    expect(response2.data).toBeTruthy();

    console.log(`Original server speed: ${end2 - start2}ms`);
});
