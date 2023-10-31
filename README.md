# ApeCoin SDK

![Alt text](.github/images/banner.png?raw=true "ApeCoin SDK Banner")

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

**Retrieving ApeCoin Staking Data**

```typescript
// get the overall apecoin pool staking stats
const totals = await sdk.getStakeTotals();

/* Example result:
 {
    counts: { '0': 38, '1': 10, '2': 27, '3': 11 },
    pools: {
      '0': '73672.405488529540367431',
      '1': '73854.356349495086234771',
      '2': '52829.519134280342052984',
      '3': '8460.185468769419617483'
    }
  }
 */

// get a specific wallets staking data
const wallet = await sdk.getWalletStakes('0x44102F31554D54Bfc66DA909E607a8549A9F4E0A');

/* Example response:
{
      address: '0x44102F31554D54Bfc66DA909E607a8549A9F4E0A',
      stakes: { '0': 0, '1': 10094, '2': 8168, '3': 2568 },
      tokens: [
        {
          type: 'mayc',
          token: '8828',
          amount: 2042,
          pair: '7113',
          pairAmount: 856
        },
        {
          type: 'mayc',
          token: '9384',
          amount: 2042,
          pair: '573',
          pairAmount: 856
        },
        {
          type: 'mayc',
          token: '6418',
          amount: 2042,
          pair: null,
          pairAmount: 0
        },
        {
          type: 'mayc',
          token: '18582',
          amount: 2042,
          pair: null,
          pairAmount: 0
        },
        {
          type: 'bayc',
          token: '4291',
          amount: 10094,
          pair: '5255',
          pairAmount: 856
        }
      ]
    }
*/
```

## Additional Notes

* The SDK is in early stage, fixes, suggestions, and contributions are welcome.

* Backfill data is currently stored in the `helpers/.out` cache folder as a flat json file. In the future, an abstract `Persistence` class will be used to store data to a preferred data store e.g. Postgres, Elasticsearch, etc.

## Contributing

Nothing formal for now, feel free to submit a PR!