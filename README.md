# bpc_client

## Usage

Install via `npm install bpc_client`


```
const bpc_client = require('bpc_client');

async function findUserInBPC({email}) {
  return await bpc_client.request({
    method: 'GET',
    path: `/users?email=${ encodeURIComponent(email) }`
  },
  null);
}


async function getUserSapOrdersInBPC({id}) {
  return await bpc_client.request({
    method: 'GET',
    path: `/permissions/${id}/profile?permission_sources.sap_orders=1`
  },
  null);
}
```

## API

### request

### env

### events