# bpc_client

This package is published on NPM: [https://www.npmjs.com/package/bpc_client](https://www.npmjs.com/package/bpc_client)

## Usage

Install via `npm install bpc_client`


Initiate a new client:

```
const bpc_client = require('bpc_client');

async function run(){

  // Optional use ENV vars. See below.
  bpc_client.app = { id: <BPC_APP_ID> key: <BPC_APP_KEY> algorithm: <BPC_APP_ALGORITHM> };
  bpc_client.url = <BPC_URL>;

  bpc_client.events.on('ready', async () => {
    console.log('Connected to BPC');
  });

  await bpc_client.connect();
}

run();

```


Making requests using app ticket.

```
  const dako = await bpc_client.request({
    method: 'GET',
    path: `/users?email=${ encodeURIComponent('dako@berlingskemedia.dk') }`
  }); // <-- Using the app ticket

  const profile = await bpc_client.request({
    method: 'GET',
    path: `/permissions/${dako.id}/profile?permission_sources.sap_orders=1`
  });  // <-- Using the app ticket

```

Making requests using a user ticket.
The user ticket if retrieved by using BPC endpoint `/rsvp` and `/ticket/user`.

```

  const userTicket = {
    "exp":1557316417598,
    "app":"console",
    "scope":
      [
        "berlingske",
        "profile",
      ],
    "grant":"jhfgs294723ijsdhfsdfhskjh329423798wspige",
    "user":"7ad5c568620c8ee33ecb5a3b",
    "key":"LOx4dYMaRIecwJGjSOITKmOe-Efoj1cS",
    "algorithm":"sha256",
    "id":"Fe26.2***N0z-_gEqmXchuHCKiTubjw*..[SHORTENED]..2fbb7b775254ca002*73Um8V2ycQbU3-OSSnrRgErXDPujuWiVL3xsvJGh938"
  };

  const profile = await bpc_client.request({
    method: 'GET',
    path: `/permissions/profile?permission_sources.sap_orders=1`
  },
  userTicket);

```



## API

 Supported ENV vars: 
* BPC_APP_ID,
* BPC_APP_KEY,
* BPC_APP_ALGORITHM
* BPC_URL


### [Property:Object] *app*

The app crentials object containing:

* `id`: App id. Will use ENV var `BPC_APP_ID` if present.
* `key`: App secret key. Will use ENV var `BPC_APP_KEY` if present.
* `algorithm`: Will use ENV var `BPC_APP_ALGORITHM` if present. Defaults to `sha256`.

### [Property:String] *url*

Full path to BPC. Will use ENV var `BPC_URL` if present. Defaults to `https://bpc.berlingskemedia.net`.

### [_async_] *connect* (app, url)

Both arguments `app` and `url` are optional and can be set beforehand using ENV vars or the corresponding property. See above.

### [_async_] *request* (options, credentials)

Makes HTTP requests to BPC.

Argument `options` are compatible to Nodes [http.request(options[, callback])](https://nodejs.org/dist/latest-v8.x/docs/api/http.html#http_http_request_options_callback)

Argument `credentials` [OPTIONAL] = a BPC ticket. If not provided, the app ticket will used.

### [_EventEmitter_] *events*

* 'appticket' when succesful getting or reissuing the app ticket.
* 'ready' when client is initialized.
