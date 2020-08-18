import { Interface } from '@ethersproject/abi';
import { Contract } from '@ethersproject/contracts';
import { Web3Provider } from '@ethersproject/providers';
import { formatEther } from '@ethersproject/units';
import { PoolPairData } from './types';
import * as bmath from './bmath';

// LEGACY FUNCTION - Keep Input/Output Format
export async function parsePoolDataOnChain(
    pools,
    tokenIn: string,
    tokenOut: string,
    multiAddress: string,
    provider: Web3Provider
): Promise<PoolPairData[]> {
    if (pools.length === 0)
        throw Error('There are no pools with selected tokens');

    const multiAbi = require('./abi/multicall.json');
    const bpoolAbi = require('./abi/bpool.json');

    const multi = new Contract(multiAddress, multiAbi, provider);

    const iface = new Interface(bpoolAbi);

    const promises: Promise<any>[] = [];

    let calls = [];

    let poolData: PoolPairData[] = [];
    pools.forEach(p => {
        calls.push([p.id, iface.encodeFunctionData('getBalance', [tokenIn])]);
        calls.push([p.id, iface.encodeFunctionData('getBalance', [tokenOut])]);
        calls.push([
            p.id,
            iface.encodeFunctionData('getNormalizedWeight', [tokenIn]),
        ]);
        calls.push([
            p.id,
            iface.encodeFunctionData('getNormalizedWeight', [tokenOut]),
        ]);
        calls.push([p.id, iface.encodeFunctionData('getSwapFee', [])]);
    });

    try {
        const [blockNumber, response] = await multi.aggregate(calls);
        let i = 0;
        let chunkResponse = [];
        let returnPools: PoolPairData[] = [];
        for (let i = 0; i < response.length; i += 5) {
            let chunk = response.slice(i, i + 5);
            chunkResponse.push(chunk);
        }

        chunkResponse.forEach((r, j) => {
            let obj = {
                id: pools[j].id,
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                balanceIn: bmath.bnum(r[0]),
                balanceOut: bmath.bnum(r[1]),
                weightIn: bmath.bnum(r[2]),
                weightOut: bmath.bnum(r[3]),
                swapFee: bmath.bnum(r[4]),
            };
            if (
                obj.balanceIn.gt(bmath.bnum(0)) &&
                obj.balanceOut.gt(bmath.bnum(0))
            ) {
                returnPools.push(obj);
            }
        });

        return returnPools;
    } catch (e) {
        console.error('Failure querying onchain balances', { error: e });
        return;
    }
}

export async function getAllPoolDataOnChain(
    pools,
    multiAddress: string,
    provider: Web3Provider
): Promise<any> {
    if (pools.pools.length === 0)
        throw Error('There are no pools with selected tokens');

    const multiAbi = require('./abi/multicall.json');
    const bpoolAbi = require('./abi/bpool.json');

    const multi = new Contract(multiAddress, multiAbi, provider);
    const iface = new Interface(bpoolAbi);

    const promises: Promise<any>[] = [];

    let calls = [];

    for (let i = 0; i < pools.pools.length; i++) {
        let p = pools.pools[i];

        calls.push([p.id, iface.encodeFunctionData('getSwapFee', [])]);

        // Checks all tokens for pool
        p.tokens.forEach(token => {
            calls.push([
                p.id,
                iface.encodeFunctionData('getBalance', [token.address]),
            ]);
            calls.push([
                p.id,
                iface.encodeFunctionData('getDenormalizedWeight', [
                    token.address,
                ]),
            ]);
        });
    }

    try {
        console.log(`Multicalls: ${calls.length}`);
        const [blockNumber, response] = await multi.aggregate(calls);

        let i = 0;
        let chunkResponse = [];
        let returnPools: PoolPairData[] = [];

        // let noCalls = pools.pools.reduce((acc, pool) => acc + (pool.tokensList.length), 0);
        // console.log(`noCalls ${noCalls}`)

        let j = 0;
        // Required otherwise we overwrite original argument
        let poolsCopy = JSON.parse(JSON.stringify(pools.pools));
        let onChainPools = { pools: [] };

        for (let i = 0; i < poolsCopy.length; i++) {
            let p = poolsCopy[i];
            p.swapFee = formatEther(bmath.bnum(response[j]).toString());
            j++;
            p.tokens.forEach(token => {
                let balance = bmath.scale(
                    bmath.bnum(response[j]),
                    -token.decimals
                );
                token.balance = balance.toString();
                j++;
                token.denormWeight = formatEther(
                    bmath.bnum(response[j]).toString()
                );
                j++;
            });

            onChainPools.pools.push(p);
        }

        return onChainPools;
    } catch (e) {
        console.error('Failure querying onchain balances', { error: e });
        return;
    }
}
