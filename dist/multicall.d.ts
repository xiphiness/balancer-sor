import { Web3Provider } from 'ethers/providers';
import { PoolPairData, GraphPool } from './types';
export declare function parsePoolDataOnChain(pools: any, tokenIn: string, tokenOut: string, multiAddress: string, provider: Web3Provider): Promise<PoolPairData[]>;
export declare function getAllPoolDataOnChain(pools: {
    pools: GraphPool[];
}, multiAddress: string, provider: Web3Provider): Promise<{
    pools: GraphPool[];
}>;
