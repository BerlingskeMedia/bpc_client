# bpc_client

This package is published on NPM: [https://www.npmjs.com/package/bpc_client](https://www.npmjs.com/package/bpc_client)

## Usage

Install via `npm install bpc_client`


Initiate a new client:

```
const bpc_client = require('bpc_client');

// Optional use ENV vars. See below.
bpc_client.app = { id: <BPC_APP_ID> key: <BPC_APP_KEY> algorithm: <BPC_ALGORITHM> };
bpc_client.url = <BPC_URL>; // Defaults to https://bpc.berlingskemedia.net


async function run(){

  bpc_client.events.on('ready', async () => {
    console.log('Connected to BPC');
  });

  await bpc_client.connect();


  // Making requests using app ticket.
  const dako = await bpc_client.request({
    method: 'GET',
    path: `/users?email=${ encodeURIComponent('dako@berlingskemedia.dk') }`
  }); // <-- Using the app ticket

  const profile = await bpc_client.request({
    method: 'GET',
    path: `/permissions/${dako.id}/profile?permission_sources.sap_orders=1`
  });  // <-- Using the app ticket


}

run();

```



You can also use `bpc_client` to make requests to other APIs, when they are secured by BPC authorization (e.g. when using [https://www.npmjs.com/package/hapi-bpc](https://www.npmjs.com/package/hapi-bpc) on the API.)

```
const bpc_client = require('bpc_client');

// Optional use ENV vars. See below.
bpc_client.app = { id: <BPC_APP_ID> key: <BPC_APP_KEY> algorithm: <BPC_ALGORITHM> };
bpc_client.url = <BPC_URL>; // Defaults to https://bpc.berlingskemedia.net


async function run(){

  // This will get the app ticket from BPC
  await bpc_client.connect();


  const url_of_other_API = require('url').parse('https://profil.berlingskemedia.dk');

  // Making authorized requests to the other API.
  const dako = await bpc_client.request({
    hostname: url_of_other_API.hostname,
    path: `/api/users?email=${ encodeURIComponent('dako@berlingskemedia.dk') }`
  });
}

run();

```






Making requests using a user ticket.
The user ticket if retrieved by using BPC endpoint `/rsvp` and `/ticket/user`.

```

  const userTicket = {
    "exp":1557316417598,
    "app":"test_app",
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

If you only need to make requests using a user ticket - and not the app ticket, like in the example above, do not run the `connect()`.


## API

 Supported ENV vars: 
* BPC_APP_ID,
* BPC_APP_KEY,
* BPC_ALGORITHM
* BPC_URL


### [Property:Object] *app*

The app crentials object containing:

* `id`: App id. Will use ENV var `BPC_APP_ID` if present.
* `key`: App secret key. Will use ENV var `BPC_APP_KEY` if present.
* `algorithm`: Will use ENV var `BPC_ALGORITHM` if present. Defaults to `sha256`.

### [Property:String] *url*

Full path to BPC. Will use ENV var `BPC_URL` if present. Defaults to `https://bpc.berlingskemedia.net`.

### [_async_] *connect* (app, url)

Both arguments `app` and `url` are optional and can be set beforehand using ENV vars or the corresponding property. See above.

### [_async_] *request* (options, credentials)

Makes HTTP requests to BPC and returns JSON.

Argument `options` - check the interface: [BpcRequestOptions](./lib/index.ts#L55)

Argument `credentials` [OPTIONAL] = a BPC ticket. If not provided, the app ticket will used.

### [_async_] *requestFullResponse* (options, credentials)

The same as above but returns full response object.

### [_async_] *getRsvp* (payload)

Makes https request to BPC [/rsvp](https://github.com/BerlingskeMedia/bpc/blob/master/doc/API.md#post-rsvp)

### [_async_] *getUserTicket* (payload)

Makes https request to BPC [/ticket/user](https://github.com/BerlingskeMedia/bpc/blob/master/doc/API.md#post-ticketuser)

### [_async_] *getReissuedTicket* (oldTicket)

Makes https request to BPC [/ticket/reissue](https://github.com/BerlingskeMedia/bpc/blob/master/doc/API.md#post-ticketreissue)

### [_EventEmitter_] *events*

* 'appticket' when succesful getting or reissuing the app ticket.
* 'ready' when client is initialized.


# Publish to NPM

Before you can publish, you need to be maintainer and run `npm login`.

Do this:

1. Commit/merge your change to master branch.
2  Run `npm run build`.
3. Run `npm version major|minor|patch` to increase the semver version in package.json file.
4. Run `npm publish`.
5. Run `git push`.
