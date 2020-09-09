import { BigNumber } from './utils/bignumber';
export interface IndexedGraphPools {
    [id: string]: GraphPool;
}
export interface GraphToken {
    address: string;
    balance: string | 0;
    decimals: number;
    denormWeight: string;
    id: string;
    symbol: string;
}
export interface GraphPool {
    id: string;
    liquidity: string;
    publicSwap: boolean;
    swapFee: string;
    totalWeight: string;
    tokens: GraphToken[];
    tokensList: string[];
}
export interface PoolPairData {
    id: string;
    tokenIn: string;
    tokenOut: string;
    balanceIn: BigNumber;
    balanceOut: BigNumber;
    weightIn: BigNumber;
    weightOut: BigNumber;
    swapFee: BigNumber;
}
export interface Path {
    id: string;
    swaps: Swap[];
    spotPrice?: BigNumber;
    slippage?: BigNumber;
    limitAmount?: BigNumber;
}
export interface EffectivePrice {
    price?: BigNumber;
    id?: string;
    maxAmount?: string;
    swap?: string[];
    amounts?: BigNumber[];
    bestPools?: string[];
}
export interface Price {
    price?: BigNumber;
    id?: string;
    maxAmount?: string;
    swap?: string[];
    amounts?: BigNumber[];
    bestPathsIds?: string[];
}
export declare type Swap = {
    pool: string;
    tokenIn: string;
    tokenOut: string;
    swapAmount?: string;
    limitReturnAmount?: string;
    maxPrice?: string;
};
