# Upgrade from 2.x to 3.x

BPC client interface has changed:
- interface has been renamed to: `BpcClientInterface`
- client properties: `ticketBuffer`, `errorTimeout` made private
  but can be set using constructor parameters
- client properties: `boom`, `hawk`, `joi` removed

Additionally:
- `options.path` is deprecated, use `options.pathname` instead
