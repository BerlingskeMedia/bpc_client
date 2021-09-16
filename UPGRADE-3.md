# Upgrade from 2.x to 3.x

BPC client interface has changed:
- interface has been renamed to: `BpcClientInterface`
- client properties: `ticketBuffer`, `errorTimeout` has been made private but can be set using constructor parameters
- client properties: `boom`, `hawk`, `joi` has been removed
- `request` method signature changed
  - `fullResponse` parameter has been removed - use `requestFullResponse` method instead
  - use generics
- `requestFullResponse` method has been added
- `getRsvp`, `getUserTicket`, `getReissuedTicket` methods have been added

Additionally:
- `options.path` is deprecated, use `options.pathname` instead
