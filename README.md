# bpc_client

This package is published on NPM: [https://www.npmjs.com/package/bpc_client](https://www.npmjs.com/package/bpc_client)

## Usage

Install via `npm install bpc_client`

Initiate a new client:

```
const bpc_client = require('bpc_client');

async function run(){

  await bpc_client.connect();

  const dako = await bpc_client.request({
    method: 'GET',
    path: `/users?email=${ encodeURIComponent('dako@berlingskemedia.dk') }`
  },
  null); // <-- Using the app ticket

  const profile = await bpc_client.request({
    method: 'GET',
    path: `/permissions/${dako.id}/profile?permission_sources.sap_orders=1`
  },
  null);  // <-- Using the app ticket
}

run();
```



## API

### (_async_) connect

### (_async_) request

### env

### events
