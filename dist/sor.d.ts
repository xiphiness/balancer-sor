import { BigNumber } from './utils/bignumber';
import { Path, Swap, EffectivePrice, IndexedGraphPools } from './types';
import { ethers } from 'ethers';
export declare const MAX_UINT: ethers.utils.BigNumber;
export declare const smartOrderRouterMultiHop: (pools: IndexedGraphPools, paths: Path[], swapType: string, totalSwapAmount: BigNumber, maxPools: number, costReturnToken: BigNumber) => [Swap[][], BigNumber];
export declare function processPaths(paths: Path[], pools: IndexedGraphPools, swapType: string): Path[];
export declare function processEpsOfInterestMultiHop(sortedPaths: Path[], swapType: string, maxPools: number): EffectivePrice[];
export declare const smartOrderRouterMultiHopEpsOfInterest: (pools: IndexedGraphPools, paths: Path[], swapType: string, totalSwapAmount: BigNumber, maxPools: number, costReturnToken: BigNumber, pricesOfInterest: EffectivePrice[]) => [Swap[][], BigNumber];
export declare const calcTotalReturn: (pools: IndexedGraphPools, paths: Path[], swapType: string, pathIds: string[], swapAmounts: BigNumber[]) => BigNumber;
