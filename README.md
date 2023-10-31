# ApeCoin SDK

Better insight into ApeCoin data is critical for a healthy functioning DAO. 

Existing dashboards and tools (such as Dune Analytics) are fairly restrictive in how they can be used and they typically cost money to make personal use of the data.

This code provides a free, open source, simple to use SDK, it empowers all of the developers in the ApeCoin community to create beneficial dashboards and tools that can go far beyond simple on-chain analytics.

Data obtainable with the SDK includes: $APE Holders, $APE Staking (with pool breakdown), Top NFT collection holdings intersection, ApeCoin DAO Snapshot proposal data and voters, voters + ApeCoin holdings.

## Usage

**Install dependencies**

`npm i`

**Import the SDK class**

```typescript
import { ApeCoinSDk } from '.';
```

**Instantiate the SDK with your preferred RPC provider**

```typescript
  sdk = new ApeCoinSDK({
    provider: new providers.WebSocketProvider('wss://eth-mainnet.g.alchemy.com/v2/{your-api-key}')
  });
```

**Run the backfill functions for the required data**

NOTE: backfilling for data can take a long time. Preferably, this is only done once, with incremental updates starting from the block you left off at once the initial backfill is caught up to the current block.

```typescript
// backfill ApeCoin staking data
await sdk.backfill(startBlock, endBlock);

/*
output will look like this:
 16119750 - ApeCoin_staking: indexed 15 events...
 16119850 - ApeCoin_staking: indexed 93 events...
 ...
*/

// backfill snapshot proposal votes
await sdk.backfillSnapshot(offset, limit);

```

## Additional Notes

* The SDK is in early stage, fixes, suggestions, and contributions are welcome.

* Backfill data is currently stored in the `helpers/.out` cache folder as a flat json file. In the future, an abstract `Persistence` class will be used to store data to a preferred data store e.g. Postgres, Elasticsearch, etc.

## Contributing

Nothing formal for now, feel free to submit a PR!