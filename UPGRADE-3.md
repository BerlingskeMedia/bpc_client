# Upgrade from 2.x to 3.x

BPC client interface has changed:
- interface has been renamed to: `BpcClientInterface`
- client properties: `events`, `app`, `appTicket` made private
- client properties: `ticketBuffer`, `errorTimeout` made private
  but can be set using constructor parameters
- client properties: `boom`, `hawk`, `joi` removed
- `url` string added as the first parameter of `request` method

Additionally:
- `options.path` will be ignored, use `options.pathname` instead
