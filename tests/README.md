## Proxy tests

### Setup

```bash
$ git clone https://github.com/Artrix9095/media-proxy
$ cd media-proxy
$ npm install
$ npm run build
```

### Starting up the test proxy server

To run the tests you need to spin up a test proxy server.

In a new terminal run the following

```bash
$ npm run test-proxy
```

### Running the tests

```bash
$ npm run test
```

### Criteria for Contribution

_Note: this extents our [Contribution Guidelines](../CONTRIBUTING.md)_

All tests _must_ be written in typescript.
ALl tests _must_ have clear names, descriptions, and comments.
ALl tests _must_ use [jest](https://jestjs.io/).
ALl tests _must_ pass.
