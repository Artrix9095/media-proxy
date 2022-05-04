
# Node Media Proxy

A simplistic yet flexible way to proxy your media.


## Features

- 🔴 Simple HLS Integration.
- 🧩 Express compatable.
- 🔌 Plugin-based Ecosystem.
- 🍃 Lightweight.
- ⚡ Easy to set up.


## Installation

Install with npm

```bash
  npm install media-proxy
```

Install with yarn

```bash
yarn add media-proxy
```
    
## Usage/Examples


### Server

#### Standalone
```js
const { Proxy } = require('media-proxy');
const proxy = new Proxy({
    port: 8080
}); // Server listens by default
```

#### Express

```js
const app = require('express')();

const { Proxy } = require('media-proxy');

const proxy = new Proxy();

app.use('/proxy', proxy.asRouter());

app.listen(8080);
```

### Client

#### Browser
```js
const video = document.getElementById('#my-video');

const options = {
    url: 'https://example.com/example.mp4',
    headers: {
        referrer: 'https://example.com'
    }
};

const base64 = window.btoa(JSON.stringify(options));

const url = `http://localhost:8080/mpeg/${base64}`;

video.src = url;

```

#### Node
```js
const options = {
    url: 'https://example.com/example.mp4',
    headers: {
        referrer: 'https://example.com'
    }
};

const base64 = Buffer
    .from(JSON.stringify(options))
    .toString('base64url'); // Use base64url and not base64

const url = `http://localhost:8080/mpeg/${base64}`;
...
```







## API Reference

WIP