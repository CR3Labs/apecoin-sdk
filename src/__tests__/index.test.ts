/* eslint-disable jest/no-done-callback */
import { providers } from 'ethers';

import { ApeCoinSDK } from '../index';

describe('ApeCoin SDK', () => {
  let sdk: ApeCoinSDK;

  test('should init', () => {
    sdk = new ApeCoinSDK({
      provider: new providers.WebSocketProvider(`wss://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`)
    });

    expect(sdk).toBeTruthy();
  });

  test('should backfill logs', async () => {
    const r = await sdk.backfill(16119150, 16119800);
    expect(r.counts[0]).toBe(38);
  });

  test('should get cached stakes', async () => {
    const t = await sdk.getStakeTotals();
    expect(t.counts[0]).toBe(38);
    expect(t.pools['0']).toBe('73672.405488529540367431');
  });

  test('should get a wallets cached apecoin stakes', async () => {
    const d = await sdk.getWalletStakes('0x499D979069c7aD373226cC61AA15ABB32bF07Ec6');
    expect(d?.tokens?.[0]?.amount).toBe(10.29);
  });

  test('should get a wallets cached nft stakes', async () => {
    const d = await sdk.getWalletStakes('0x44102F31554D54Bfc66DA909E607a8549A9F4E0A');
    console.log(d);
    expect(d?.tokens?.length).toBe(5);
    expect(d?.tokens?.[0]).toEqual({
      type: 'mayc',
      token: '8828',
      amount: 2042,
      pair: '7113',
      pairAmount: 856
    });
  });

  test('should backfill snapshot proposals', async () => {
    const p = await sdk.backfillSnapshot();
    expect(p?.length).toBe(20);
  });
});
