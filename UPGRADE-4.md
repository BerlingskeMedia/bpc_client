# Upgrade from 3.x to 4.x

Method `request` of BpcClient can return undefined if response empty:
`request: <R = any>(options: BpcRequestOptions, credentials?: AppTicket) => Promise<R | undefined>;`

Additionally we can add custom headers to request options. It's not breaking change. It's just an extension. 
