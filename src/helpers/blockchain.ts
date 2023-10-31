import axios from 'axios';
import { providers, Contract, EventFilter, Event, ContractInterface } from 'ethers';
import { persistOutput } from './persistence';

export interface EventWithParsedArgs<T> extends Omit<Event, 'args'> {
    args: T
}

export type ContractFilters = { [ name: string ]: (...args: Array<unknown>) => EventFilter };

/**
 * Get logs for a specific filter
 * @param label 
 * @param filter 
 * @param address 
 * @param ABI 
 * @param provider 
 * @param sBlock 
 * @param eBlock 
 * @returns 
 */
export async function queryLogs(
    label: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filter: (filters?: ContractFilters) => any,
    address: string,
    ABI: ContractInterface,
    provider: providers.WebSocketProvider,
    sBlock?: number,
    eBlock?: number
) {
    // backfill logs
    const DEPLOY_BLOCK = sBlock || 14400533
    const END_BLOCK = eBlock || (await provider.getBlockNumber())

    // init contract
    const contract = new Contract(address, ABI, provider);

    // get filter
    const f = typeof filter === 'function' ? filter(contract.filters) : contract.filters[filter]()

    let startBlock = DEPLOY_BLOCK;
    let events: EventWithParsedArgs<unknown>[] = [];
    while (startBlock <= END_BLOCK) { // deploy block
        const filtered = await contract.queryFilter(f, startBlock, startBlock + 75) as EventWithParsedArgs<Record<string, unknown>>[];
        // o(n)^2 :(
        for (let i = 0; i < filtered.length; i++) {
            // fix annoying ethers args array
            const objs = Object.keys(filtered[i].args || {}).map(k => {
                if (Number.isNaN(Number(k))) {
                    return { [k]: filtered[i].args[k] }
                }
                return null
            }).filter(l => (l));

            filtered[i].args = Object.assign({}, ...(objs as []))
        }
        events = events.concat(filtered)
        startBlock = startBlock + 100
        console.log(`${startBlock} - ${label}: indexed ${events.length} events...`);
    }

    await persistOutput(`${label}_events.json`, JSON.stringify(events, null, 2));

    return events;
}

/**
 * Init a wallet provider
 * @returns
 */
export function initProviders(wsEndpoint: string) {
    return new providers.WebSocketProvider(wsEndpoint)
}

/**
 * Perform a snapshot query
 * @param {*} query 
 * @returns 
 */
export async function snapshotQuery(query: string) {
    const { data } = await axios.post(`https://hub.snapshot.org/graphql`, {
        query
    }, {
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        }
    })
    return data;
}