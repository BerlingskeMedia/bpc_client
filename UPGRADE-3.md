# Upgrade from 2.x to 3.x

- `url` string added as the first parameter of `request` method
- `options.path` will be ignored, use `options.pathname` instead
- client properties: `events`, `app`, `appTicket` made private
- client properties: `ticketBuffer`, `errorTimeout` made private
  but can be set using constructor parameters
- client properties: `boom`, `hawk`, `joi` removed
