# bpc_client

This package is published on NPM: [https://www.npmjs.com/package/bpc_client](https://www.npmjs.com/package/bpc_client)

## Usage

Install via `npm install bpc_client`


Initiate a new client:

```
const bpc_client = require('bpc_client');

async function run(){

  // Optional use ENV vars. See below
  bpc_client.app = { id: <BPC_APP_ID> key: <BPC_APP_KEY> algorithm: <BPC_APP_ALGORITHM> };
  bpc_client.app = <URL>;

  bpc_client.on('ready', async () => {
    console.log('Connected to BPC');
  });

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

### [_async_] connect (app, url)

Argument `app` = `{id: <BPC_APP_ID>, key: <BPC_APP_KEY>, algorithm: <BPC_APP_ALGORITHM>}`.

Argument `url` = Full path to BPC. Optional parameter. Defaults to `https://bpc.berlingskemedia.net`

Both arguments `app` and `url` are optional and can be set using ENV vars.

Supported ENV vars: 
* BPC_APP_ID,
* BPC_APP_KEY,
* BPC_APP_ALGORITHM

Algoritm defaults to `sha256`.

### [_async_] request(options, credentials)

Makes HTTP requests to BPC.

Argument `options` are compatible to Nodes [http.request(options[, callback])](https://nodejs.org/dist/latest-v8.x/docs/api/http.html#http_http_request_options_callback)

Argument `credentials` = a BPC ticket.

### [_EventEmitter_]

* 'appticket' when succesful getting or reissuing the app ticket.
* 'ready' when client is initialized.
