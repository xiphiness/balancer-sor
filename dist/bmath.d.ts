import { BigNumber } from './utils/bignumber';
export declare const BONE: BigNumber;
export declare const TWOBONE: BigNumber;
export declare const MAX_IN_RATIO: BigNumber;
export declare const MAX_OUT_RATIO: BigNumber;
export declare function scale(
    input: BigNumber,
    decimalPlaces: number
): BigNumber;
export declare function bnum(val: string | number | BigNumber): BigNumber;
export declare function calcOutGivenIn(
    tokenBalanceIn: BigNumber,
    tokenWeightIn: BigNumber,
    tokenBalanceOut: BigNumber,
    tokenWeightOut: BigNumber,
    tokenAmountIn: BigNumber,
    swapFee: BigNumber
): BigNumber;
export declare function calcInGivenOut(
    tokenBalanceIn: BigNumber,
    tokenWeightIn: BigNumber,
    tokenBalanceOut: BigNumber,
    tokenWeightOut: BigNumber,
    tokenAmountOut: BigNumber,
    swapFee: BigNumber
): BigNumber;
export declare function calcSpotPrice(
    tokenBalanceIn: BigNumber,
    tokenWeightIn: BigNumber,
    tokenBalanceOut: BigNumber,
    tokenWeightOut: BigNumber,
    swapFee: BigNumber
): BigNumber;
export declare function bmul(a: BigNumber, b: BigNumber): BigNumber;
export declare function bdiv(a: BigNumber, b: BigNumber): BigNumber;
export declare function btoi(a: BigNumber): BigNumber;
export declare function bfloor(a: BigNumber): BigNumber;
export declare function bsubSign(
    a: BigNumber,
    b: BigNumber
): {
    res: BigNumber;
    bool: boolean;
};
export declare function bpow(base: BigNumber, exp: BigNumber): BigNumber;
