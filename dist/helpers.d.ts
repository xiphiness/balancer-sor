import { BigNumber } from './utils/bignumber';
import { PoolPairData, Path, GraphPool, IndexedGraphPools } from './types';
declare type SetHackType<v> = v extends Set<infer t> ? t : never;
declare class SetEx<v> extends Set<v> {
    flatten<t extends SetHackType<v>>(): SetEx<t>;
    filter(predicate: (v: v) => boolean): SetEx<v>;
    merge(set: Set<v>): void;
    union(set: Set<v>): SetEx<v>;
    except(set: Set<v>): SetEx<v>;
    intersection(set: Set<v>): SetEx<v>;
    isSubset(set: Set<v>): boolean;
    toArray(): v[];
}
export declare function toChecksum(address: any): string;
export declare function getLimitAmountSwap(poolPairData: PoolPairData, swapType: string): BigNumber;
export declare function getLimitAmountSwapPath(pools: IndexedGraphPools, path: Path, swapType: string): BigNumber;
export declare function getSpotPricePath(pools: IndexedGraphPools, path: Path): BigNumber;
export declare function getSpotPrice(poolPairData: PoolPairData): BigNumber;
export declare function getSlippageLinearizedSpotPriceAfterSwapPath(pools: IndexedGraphPools, path: Path, swapType: string): BigNumber;
export declare function getSlippageLinearizedSpotPriceAfterSwap(poolPairData: PoolPairData, swapType: string): BigNumber;
export declare function getReturnAmountSwapPath(pools: IndexedGraphPools, path: Path, swapType: string, amount: BigNumber): BigNumber;
export declare function getReturnAmountSwap(pools: IndexedGraphPools, poolPairData: PoolPairData, swapType: string, amount: BigNumber): BigNumber;
export declare function updateTokenBalanceForPool(pool: any, token: string, balance: BigNumber): any;
export declare function getNormalizedLiquidity(poolPairData: PoolPairData): BigNumber;
export declare const parsePoolData: (directPools: IndexedGraphPools, tokenIn: string, tokenOut: string, mostLiquidPoolsFirstHop?: GraphPool[], mostLiquidPoolsSecondHop?: GraphPool[], hopTokens?: any[]) => [IndexedGraphPools, Path[]];
export declare const parsePoolPairData: (p: any, tokenIn: string, tokenOut: string) => PoolPairData;
export declare function getTokenPairsMultiHop(token: string, poolsTokensListSet: SetEx<SetEx<string>>): [string[], string[]];
export declare function filterPoolsWithTokensDirect(allPools: GraphPool[], // The complete information of the pools
tokenIn: string, tokenOut: string): IndexedGraphPools;
export declare function filterPoolsWithoutMutualTokens(allPools: GraphPool[], tokenOne: string, tokenTwo: string): [IndexedGraphPools, SetEx<string>, IndexedGraphPools, SetEx<string>];
export declare function filterPoolsWithTokensMultihop(allPools: GraphPool[], // Just the list of pool tokens
tokenIn: string, tokenOut: string): [GraphPool[], GraphPool[], string[]];
export declare function filterAllPools(allPools: {
    pools: GraphPool[];
}): [SetEx<SetEx<string>>, GraphPool[]];
export {};
