import { BigNumber, utils, providers } from 'ethers';
import { EventWithParsedArgs, queryLogs, snapshotQuery } from './helpers/blockchain';
import { loadJSON, persistOutput, readFromOutput } from './helpers/persistence';
import { APECOIN_STAKING_ADDRESS, APECOIN_POOLS } from './constants';

export type BigNumberish = BigNumber | string | number;

export interface PoolDeposit {
    user: string;
    amount: string | BigNumber;
    tokenId: string;
}

export interface PoolNftDeposit {
    user: string;
    amount: string | BigNumber;
    poolId: string;
    tokenId: string;
}

export interface PoolNftPairDeposit {
    user: string;
    mainTypePoolId: string;
    amount: BigNumber;
    poolId: string;
    tokenId: string;
    mainTokenId: string;
    bakcTokenId: string;
    pairAmount: BigNumber;
}

export type ApeCoinEvent = {
    event?: string;
    blockNumber: number;
    transactionHash: string;
    signature: string;
    args: EventWithParsedArgs<PoolDeposit | PoolNftDeposit | PoolNftPairDeposit>;
};
export type ApeCoinSDKParams = {
    provider: providers.WebSocketProvider;
}

export class ApeCoinSDK {
    private readonly _provider: providers.WebSocketProvider;

    constructor(params: ApeCoinSDKParams) {
        this._provider = params.provider;
    }

    // --- staking ---

    async backfill(from?: number, to?: number) {
        return this._backfillApeCoinStaking(from, to);
    }

    async getStakeTotals() {
        return this._getTotalStakes()
    }

    async getWalletStakes(address: string) {
        return this._getWalletStakes(address);
    }

    // --- snapshot ---

    /**
     * Backfill all proposal votes
     * 
     * @param proposal 
     * @param offset 
     * @param limit
     * @param space 
     */
    async backfillSnapshot(offset = 0, limit = 1, space = 'apecoin.eth') {

        const proposals = await this.getSnapshotProposals(offset, limit, space);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let all: any[] = [];
        for (let i = 0; i < proposals.length; i++) {
            // TODO use pLimit to get more than first 20
            const votes = await this.getSnapshotProposalVotes(proposals[i].id, 0, 20, space);
            if (votes) {
                console.log('indexing', votes.length, 'votes');
                const inserts = [];
                for (let k = 0; k < votes.length; k++) {
                    try {
                        inserts.push({
                            ...votes[k],
                            created: new Date(votes[k].created * 1000),
                            vp: votes[k].vp.toFixed(2),
                            address: (await this._provider.lookupAddress(votes[k].voter)) || votes[k].voter,
                            vote: votes[k].proposal.choices[votes[k].choice],
                            space,
                        });
                    } catch (err) {
                        console.log('failed to get ens', votes[k].voter);
                        inserts.push({
                            ...votes[k],
                            created: new Date(votes[k].created * 1000),
                            vp: votes[k].vp.toFixed(2),
                            address: votes[k].voter,
                            vote: votes[k].proposal.choices[votes[k].choice],
                            space,
                        });
                    }
                }

                if (inserts.length) {
                    // await bulkElasticInsert('votes', inserts);
                    console.log('indexed', inserts.length, 'votes');
                    await persistOutput(`Proposals_${offset}.json`, JSON.stringify(inserts));
                    all = all.concat(inserts);
                    return all;
                }
            }
        }
    }

    /**
     * Retrieve proposals in descending order
     * 
     * @param offset 
     * @param limit 
     * @param space 
     * @returns 
     */
    async getSnapshotProposals(offset = 0, limit = 5, space = 'apecoin.eth') {

        // get all proposals
        const query = `query Proposals {
            proposals(first: ${limit || 5}, skip: ${offset || 0}, where: {space_in: ["${space}"]}, orderBy: "created", orderDirection: desc) {
              id
              scores_total
              scores
              state
              title
              choices
              start
              end
              snapshot
              author
              scores_state
              space {
                id
                name
              }
            }
          }`;

        const response = await snapshotQuery(query);

        return response?.data?.proposals || [];
    }

    /**
     * Retrieve a proposals votes
     * 
     * @param proposalId 
     * @param offset 
     * @param limit 
     * @param space 
     * @returns 
     */
    async getSnapshotProposalVotes(proposalId: string, offset = 0, limit = 100, space = 'apecoin.eth') {
        // get votes for a proposal
        const query = `query Votes {
            votes(first: ${limit}, skip: ${offset}, where: {space_in: ["${space}"], proposal_in: ["${proposalId}"]}) {
              id
              proposal{
                id
                title
                choices
              }
              voter
              created
              choice,
              vp
            }
          }`;

        const response = await snapshotQuery(query);

        return response?.data?.votes || [];
    }

    // --- internals ---

    /**
     * backfill stakes
     * @param from 
     * @param to 
     * @param fromCache 
     * @returns 
     */
    private async _backfillApeCoinStaking(
        from = 16119150,
        to?: number,
        fromCache?: boolean
    ) {
        const APECOIN_ABI = await loadJSON('../abis/apecoin-staking.json');

        let events: ApeCoinEvent[];
        if (!fromCache) {
            // get logs
            const logs = await queryLogs(
                'ApeCoin_staking',
                () => [], // return all logs
                APECOIN_STAKING_ADDRESS,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                APECOIN_ABI as any,
                this._provider,
                from, // apecoin staking deploy date
                to
            );

            // parse logs
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            events = logs.map((l: any) => ({
                blockNumber: l.blockNumber,
                transactionHash: l.transactionHash,
                event: l.event,
                signature: l.eventSignature,
                args: l.args
            })
            );
            await persistOutput(`ApeCoin_staking_events_formatted.json`, JSON.stringify(events, null, 2));
        }

        // -- if loading from cache start here
        events = await readFromOutput('ApeCoin_staking_events_formatted.json');

        // calculate up to date staking results
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { stakes, pools, counts } = this._calculateApeCoinStakes(events as any);

        await persistOutput(`ApeCoin_staking_results.json`, JSON.stringify(stakes, null, 2));

        return { stakes, pools, counts };
    }

    /**
     * Calculate stakes
     * @param logs 
     * @returns 
     */
    private _calculateApeCoinStakes(logs: EventWithParsedArgs<{ event: string }>[]) {
        // determine current staking
        // -------------------------
        const stakes: Record<string, Record<string, {
            amount: string | BigNumber;
            pair: string | null;
            pairAmount: BigNumberish;
        }>> = {}

        const setup = (addr: string, pool: string, tokenId: string) => {
            if (!stakes[addr]) {
                stakes[addr] = {}
            }
            if (!stakes[addr][`${pool}_${tokenId}`]) {
                stakes[addr][`${pool}_${tokenId}`] = {
                    amount: '0',
                    pair: null,
                    pairAmount: '0',
                }
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handlers: any = {
            handleDeposit: (e: EventWithParsedArgs<PoolDeposit>) => {
                const amount = BigNumber.from(e.args.amount);
                const key = `0_`;

                setup(e.args.user, '0', '');

                // add amount
                const amt = BigNumber.from(stakes[e.args.user][key].amount)
                stakes[e.args.user][key].amount = amt.add(amount);
            },
            handleDepositNft: (e: EventWithParsedArgs<PoolNftDeposit>) => {
                const pool = BigNumber.from(e.args.poolId).toString();
                const amount = BigNumber.from(e.args.amount);
                const tokenId = BigNumber.from(e.args.tokenId).toString();
                const key = `${pool}_${tokenId}`;

                setup(e.args.user, pool, tokenId);

                // add amount
                const amt = BigNumber.from(stakes[e.args.user][key].amount)
                stakes[e.args.user][key].amount = amt.add(amount);
            },
            handleDepositPairNft: (e: EventWithParsedArgs<PoolNftPairDeposit>) => {
                const pool = BigNumber.from(e.args.mainTypePoolId).toString();
                const combined = BigNumber.from(e.args.amount);
                const tokenId = BigNumber.from(e.args.mainTokenId).toString();
                const bakcId = BigNumber.from(e.args.bakcTokenId).toString();
                const key = `${pool}_${tokenId}`;

                setup(e.args.user, pool, tokenId);

                // add amounts
                const PAIR_AMT = BigNumber.from(856).pow(18);
                const amount = BigNumber.from(stakes[e.args.user][key].amount);
                const pAmount = BigNumber.from(stakes[e.args.user][key].pairAmount);

                let pAmt = BigNumber.from(0);
                let amt = BigNumber.from(0);
                if (combined.gt(PAIR_AMT)) {
                    pAmt = BigNumber.from(PAIR_AMT);
                    amt = combined.sub(PAIR_AMT);
                } else {
                    pAmt = combined;
                }

                stakes[e.args.user][key].amount = amount.add(amt);
                stakes[e.args.user][key].pairAmount = pAmount.add(pAmt);
                stakes[e.args.user][key].pair = bakcId;
            },
            handleWithdraw: (e: EventWithParsedArgs<PoolDeposit>) => {
                const amount = BigNumber.from(e.args.amount);
                const key = `0_`;

                setup(e.args.user, '0', '');

                // sub amount
                const amt = BigNumber.from(stakes[e.args.user][key].amount)
                stakes[e.args.user][key].amount = amt.sub(amount);
            },
            handleWithdrawNft: (e: EventWithParsedArgs<PoolNftDeposit>) => {
                const pool = BigNumber.from(e.args.poolId).toString();
                const amount = BigNumber.from(e.args.amount);
                const tokenId = BigNumber.from(e.args.tokenId).toString();
                const key = `${pool}_${tokenId}`;

                setup(e.args.user, pool, tokenId);

                // sub amount
                const amt = BigNumber.from(stakes[e.args.user][key].amount)
                stakes[e.args.user][key].amount = amt.sub(amount);
            },
            handleWithdrawPairNft: (e: EventWithParsedArgs<PoolNftPairDeposit>) => {
                const pool = BigNumber.from(e.args.mainTypePoolId).toString();
                const combined = BigNumber.from(e.args.amount);
                const tokenId = BigNumber.from(e.args.mainTokenId).toString();
                const key = `${pool}_${tokenId}`;

                setup(e.args.user, pool, tokenId);

                // add amounts
                const PAIR_AMT = BigNumber.from(856).pow(18);
                const amount = BigNumber.from(stakes[e.args.user][key].amount);
                const pAmount = BigNumber.from(stakes[e.args.user][key].pairAmount);

                let pAmt = BigNumber.from(0);
                let amt = BigNumber.from(0);
                if (combined.gt(PAIR_AMT)) {
                    pAmt = BigNumber.from(PAIR_AMT);
                    amt = combined.sub(PAIR_AMT);
                } else {
                    pAmt = combined;
                }

                stakes[e.args.user][key].amount = amount.sub(amt);
                stakes[e.args.user][key].pairAmount = pAmount.sub(pAmt);
                stakes[e.args.user][key].pair = null;
            }
        }

        logs.filter(e => (~[
            'Deposit', 'Withdraw', 'DepositNft',
            'DepositPairNft', 'WithdrawNft', 'WithdrawPairNft'
        ].indexOf(e?.event || '')))
            .forEach(e => handlers[`handle${e.event}`](e, stakes));

        // format results
        // ------------------------
        const pools: Record<string, BigNumberish> = {
            '0': BigNumber.from(0), // $ape
            '1': BigNumber.from(0), // bayc
            '2': BigNumber.from(0), // mayc
            '3': BigNumber.from(0), // paired
        }
        const counts: Record<string, number> = {
            '0': 0,
            '1': 0,
            '2': 0,
            '3': 0
        }

        const results = Object.keys(stakes).map(a => {
            const tokens: {
                type: string;
                token: string;
                amount: number,
                pair: string | null;
                pairAmount: number;
            }[] = [];

            const p: Record<string, BigNumberish> = {
                '0': BigNumber.from(0), // $ape
                '1': BigNumber.from(0), // bayc
                '2': BigNumber.from(0), // mayc
                '3': BigNumber.from(0), // paired
            };

            Object.keys(stakes[a]).forEach(key => {
                const [pool, token] = key.split('_');
                const amount = stakes[a][key].amount;
                const pairAmount = stakes[a][key].pairAmount;

                tokens.push({
                    type: APECOIN_POOLS[pool],
                    token,
                    amount: Number(utils.formatEther(amount)),
                    pair: stakes[a][key].pair,
                    pairAmount: Number(utils.formatEther(pairAmount))
                });

                counts[pool] += 1;
                p[pool] = (p[pool] as BigNumber).add(amount);
                pools[pool] = (pools[pool] as BigNumber).add(amount);

                if (stakes[a][key].pair) {
                    p['3'] = (p['3'] as BigNumber).add(pairAmount);
                    pools['3'] = (pools['3'] as BigNumber).add(pairAmount);
                    counts['3'] += 1;
                }
            })

            // format eth
            Object.keys(p).forEach(
                k => (p[k] = Number(utils.formatEther(p[k])))
            );

            return {
                address: a,
                stakes: p,
                tokens
            }
        });

        // format eth
        Object.keys(pools).forEach(
            k => (pools[k] = utils.formatEther(pools[k]))
        );

        return {
            stakes: results,
            pools,
            counts
        };
    }

    private async _getTotalStakes() {
        try {
            const { counts, pools } = await this._backfillApeCoinStaking(0, 0, true);
            return { counts, pools };
        } catch (err) {
            throw new Error('Unable to retrieve stake data, have you run backfill?');
        }
    }

    private async _getWalletStakes(wallet: string) {
        try {
            const data = await this._backfillApeCoinStaking(0, 0, true);
            return data.stakes.find(s => s.address.toLowerCase() === wallet.toLowerCase());
        } catch (err) {
            throw new Error('Unable to retrieve wallet stakes, have you run backfill?');
        }
    }
}
