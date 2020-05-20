import {
    getSpotPrice,
    getSlippageLinearizedSpotPriceAfterSwap,
    getLimitAmountSwap,
    getSpotPricePath,
    getSlippageLinearizedSpotPriceAfterSwapPath,
    getLimitAmountSwapPath,
    getNormalizedLiquidity,
    getReturnAmountSwap,
    getReturnAmountSwapPath,
} from './helpers';
import {
    bmul,
    bdiv,
    bnum,
    BONE,
    calcOutGivenIn,
    calcInGivenOut,
} from './bmath';
import { BigNumber } from './utils/bignumber';
import { PoolPairData, Path, Swap, Price } from './types';

// TODO give the option to choose a % of slippage beyond current price?
const MAX_UINT = new BigNumber(
    115792089237316195423570985008687907853269984665640564039457584007913129639935
);
const minAmountOut = 0;
const maxAmountIn = MAX_UINT;
const maxPrice = MAX_UINT;

export const smartOrderRouterMultiHop = (
    paths: Path[],
    swapType: string,
    totalSwapAmount: BigNumber,
    maxPools: number,
    costReturnToken: BigNumber
): [Swap[][], BigNumber] => {
    console.time('smartOrderRouterMultiHop');

    paths.forEach(b => {
        b.spotPrice = getSpotPricePath(b);
        b.slippage = getSlippageLinearizedSpotPriceAfterSwapPath(b, swapType);
        b.limitAmount = getLimitAmountSwapPath(b, swapType);
    });

    let sortedPaths = paths.sort((a, b) => {
        return a.spotPrice.minus(b.spotPrice).toNumber();
    });

    // console.log("sortedPaths");
    // sortedPaths.forEach((path, i) => {
    //      console.log(path);
    //      console.log("path.spotPrice");
    //      console.log(path.spotPrice.toString());
    //      console.log("path.slippage");
    //      console.log(path.slippage.toString());
    // });

    let pricesOfInterest = getPricesOfInterest(sortedPaths, swapType).sort(
        (a, b) => {
            return a.price.minus(b.price).toNumber();
        }
    );

    // console.log("getPricesOfInterest");
    // pricesOfInterest.forEach((poi, i) => {
    //      console.log(poi);
    //      console.log("poi.spotPrice");
    //      console.log(poi.spotPrice.toString());
    //      console.log("poi.slippage");
    //      console.log(poi.slippage.toString());
    // });

    pricesOfInterest = calculateBestPathsForPricesOfInterest(
        sortedPaths,
        pricesOfInterest
    );

    pricesOfInterest.forEach(poi => {
        let selectedPaths = poi.bestPaths;
        let price = poi.price;
        poi.amounts = getSwapAmountsForPriceOfInterest(selectedPaths, price);
    });

    // console.log("pricesOfInterest");
    // console.log(pricesOfInterest);

    let bestTotalReturn: BigNumber = new BigNumber(0);
    let highestPoiNotEnough: boolean = true;
    let selectedPaths, totalReturn;
    let bestSwapAmounts, bestPaths, swapAmounts;

    let bmin = paths.length + 1;
    for (let b = 1; b <= bmin; b++) {
        totalReturn = 0;

        let price,
            priceAfter,
            priceBefore,
            swapAmountsPriceBefore,
            swapAmountsPriceAfter;
        for (let i = 0; i < pricesOfInterest.length; i++) {
            price = pricesOfInterest[i];

            priceAfter = price;

            if (i === 0) {
                priceBefore = priceAfter;
                continue;
            }

            let swapAmountsAfter = priceAfter.amounts;
            let totalInputAmountAfter = swapAmountsAfter
                .slice(0, b)
                .reduce((a, b) => a.plus(b));

            if (totalInputAmountAfter.isGreaterThan(totalSwapAmount)) {
                selectedPaths = priceBefore.bestPaths.slice(0, b);
                swapAmountsPriceBefore = priceBefore.amounts.slice(0, b);
                swapAmountsPriceAfter = priceAfter.amounts.slice(0, b);

                swapAmounts = getExactSwapAmounts(
                    swapAmountsPriceBefore,
                    swapAmountsPriceAfter,
                    totalSwapAmount
                );
                // console.log("swapAmountsPriceBefore");
                // console.log(swapAmountsPriceBefore.toString());
                // console.log("swapAmountsPriceAfter");
                // console.log(swapAmountsPriceAfter.toString());
                // console.log("totalSwapAmount");
                // console.log(totalSwapAmount.toString());

                // console.log("swapAmounts");
                // console.log(swapAmounts.toString());

                highestPoiNotEnough = false;
                break;
            }

            priceBefore = priceAfter;
        }

        if (highestPoiNotEnough) {
            selectedPaths = [];
            swapAmounts = [];
        }

        // console.log("calcTotalReturn")
        totalReturn = calcTotalReturn(swapType, selectedPaths, swapAmounts);

        // Calculates the number of pools in all the paths to include the gas costs
        let totalNumberOfPools = 0;
        selectedPaths.forEach((path, i) => {
            // Find path data
            totalNumberOfPools += path.poolPairDataList.length;
        });

        // console.log("Number of pools in all paths: ")
        // console.log(totalNumberOfPools)

        let improvementCondition: boolean = false;
        if (totalNumberOfPools <= maxPools) {
            if (swapType === 'swapExactIn') {
                totalReturn = totalReturn.minus(
                    bmul(
                        new BigNumber(totalNumberOfPools).times(BONE),
                        costReturnToken
                    )
                );
                improvementCondition =
                    totalReturn.isGreaterThan(bestTotalReturn) ||
                    bestTotalReturn.isEqualTo(new BigNumber(0));
            } else {
                totalReturn = totalReturn.plus(
                    bmul(
                        new BigNumber(totalNumberOfPools).times(BONE),
                        costReturnToken
                    )
                );
                improvementCondition =
                    totalReturn.isLessThan(bestTotalReturn) ||
                    bestTotalReturn.isEqualTo(new BigNumber(0));
            }
        }

        if (improvementCondition === true) {
            bestSwapAmounts = swapAmounts;
            bestPaths = selectedPaths;
            bestTotalReturn = totalReturn;
        } else {
            break;
        }
    }

    // console.log("Best solution found")
    // console.log(bestSwapAmounts.toString());
    // console.log(bestPaths);
    // console.log(bestTotalReturn.toString());

    //// Prepare swap data from paths
    let swaps: Swap[][] = [];
    let totalSwapAmountWithRoundingErrors: BigNumber = new BigNumber(0);
    let dust: BigNumber = new BigNumber(0);
    let lenghtFirstPath;
    // TODO: change all inputAmount variable names to swapAmount
    bestSwapAmounts.forEach((swapAmount, i) => {
        totalSwapAmountWithRoundingErrors = totalSwapAmountWithRoundingErrors.plus(
            swapAmount
        );

        const path = selectedPaths[i];

        // // TODO: remove. To debug only!
        // printSpotPricePathBeforeAndAfterSwap(path, swapType, swapAmount);

        if (i == 0)
            // Store lenght of first path to add dust to correct rounding error at the end
            lenghtFirstPath = path.poolPairDataList.length;

        if (path.poolPairDataList.length == 1) {
            // Direct trade: add swap from only pool
            let swap: Swap = {
                pool: path.poolPairDataList[0].id,
                tokenIn: path.poolPairDataList[0].tokenIn,
                tokenOut: path.poolPairDataList[0].tokenOut,
                swapAmount: swapAmount.toString(),
                limitReturnAmount:
                    swapType === 'swapExactIn'
                        ? minAmountOut.toString()
                        : maxAmountIn.toString(),
                maxPrice: maxPrice.toString(),
            };
            swaps.push([swap]);
        } else {
            // Multi-hop:
            // Add swap from first pool
            let swap1hop: Swap = {
                pool: path.poolPairDataList[0].id,
                tokenIn: path.poolPairDataList[0].tokenIn,
                tokenOut: path.poolPairDataList[0].tokenOut,
                swapAmount:
                    swapType === 'swapExactIn'
                        ? swapAmount.toString()
                        : getReturnAmountSwap(
                              path.poolPairDataList[1],
                              swapType,
                              swapAmount
                          ).toString(),
                limitReturnAmount:
                    swapType === 'swapExactIn'
                        ? minAmountOut.toString()
                        : maxAmountIn.toString(),
                maxPrice: maxPrice.toString(),
            };

            // Add swap from second pool
            let swap2hop: Swap = {
                pool: path.poolPairDataList[1].id,
                tokenIn: path.poolPairDataList[1].tokenIn,
                tokenOut: path.poolPairDataList[1].tokenOut,
                swapAmount:
                    swapType === 'swapExactIn'
                        ? getReturnAmountSwap(
                              path.poolPairDataList[0],
                              swapType,
                              swapAmount
                          ).toString()
                        : swapAmount.toString(),
                limitReturnAmount:
                    swapType === 'swapExactIn'
                        ? minAmountOut.toString()
                        : maxAmountIn.toString(),
                maxPrice: maxPrice.toString(),
            };
            swaps.push([swap1hop, swap2hop]);
        }
    });

    // Since the individual swapAmounts for each path are integers, the sum of all swapAmounts
    // might not be exactly equal to the totalSwapAmount the user requested. We need to correct that rounding error
    // and we do that by adding the rounding error to the first path.
    if (swaps.length > 0) {
        dust = totalSwapAmount.minus(totalSwapAmountWithRoundingErrors);
        if (swapType === 'swapExactIn') {
            swaps[0][0].swapAmount = new BigNumber(swaps[0][0].swapAmount)
                .plus(dust)
                .toString(); // Add dust to first swapExactIn
        } else {
            if (lenghtFirstPath == 1)
                // First path is a direct path (only one pool)
                swaps[0][0].swapAmount = new BigNumber(swaps[0][0].swapAmount)
                    .plus(dust)
                    .toString();
            // Add dust to first swapExactOut
            // First path is a multihop path (two pools)
            else
                swaps[0][1].swapAmount = new BigNumber(swaps[0][1].swapAmount)
                    .plus(dust)
                    .toString(); // Add dust to second swapExactOut
        }
    }

    console.timeEnd('smartOrderRouterMultiHop');

    return [swaps, bestTotalReturn];
};

function getPricesOfInterest(sortedPaths: Path[], swapType: string): Price[] {
    let pricesOfInterest: Price[] = [];
    sortedPaths.forEach((thisPath, i) => {
        // New pool
        let pi: Price = {};
        pi.price = thisPath.spotPrice;
        pi.id = thisPath.id;
        pi.path = thisPath;
        pricesOfInterest.push(pi);

        // Max amount for this pool
        pi = {};
        pi.price = thisPath.spotPrice.plus(
            bmul(
                thisPath.limitAmount,
                bmul(thisPath.slippage, thisPath.spotPrice)
            )
        );
        pi.maxAmount = thisPath.id;
        pricesOfInterest.push(pi);

        for (let k = 0; k < i; k++) {
            let prevPath = sortedPaths[k];

            if (
                bmul(thisPath.slippage, thisPath.spotPrice).isLessThan(
                    bmul(prevPath.slippage, prevPath.spotPrice)
                )
            ) {
                let amountCross = bdiv(
                    thisPath.spotPrice.minus(prevPath.spotPrice),
                    bmul(prevPath.slippage, prevPath.spotPrice).minus(
                        bmul(thisPath.slippage, thisPath.spotPrice)
                    )
                );

                if (
                    amountCross.isLessThan(thisPath.limitAmount) &&
                    amountCross.isLessThan(prevPath.limitAmount)
                ) {
                    let epiA: Price = {};
                    epiA.price = thisPath.spotPrice.plus(
                        bmul(
                            amountCross,
                            bmul(thisPath.slippage, thisPath.spotPrice)
                        )
                    );
                    epiA.swap = [prevPath.id, thisPath.id];
                    pricesOfInterest.push(epiA);
                }

                if (
                    prevPath.limitAmount.isLessThan(thisPath.limitAmount) &&
                    prevPath.limitAmount.isLessThan(amountCross)
                ) {
                    let epiB: Price = {};
                    epiB.price = thisPath.spotPrice.plus(
                        bmul(
                            prevPath.limitAmount,
                            bmul(thisPath.slippage, thisPath.spotPrice)
                        )
                    );
                    epiB.swap = [prevPath.id, thisPath.id];
                    pricesOfInterest.push(epiB);
                }

                if (
                    thisPath.limitAmount.isLessThan(prevPath.limitAmount) &&
                    amountCross.isLessThan(thisPath.limitAmount)
                ) {
                    let epiC: Price = {};
                    epiC.price = prevPath.spotPrice.plus(
                        bmul(
                            thisPath.limitAmount,
                            bmul(prevPath.slippage, prevPath.spotPrice)
                        )
                    );
                    epiC.swap = [thisPath.id, prevPath.id];
                    pricesOfInterest.push(epiC);
                }
            } else {
                if (prevPath.limitAmount.isLessThan(thisPath.limitAmount)) {
                    let epiD: Price = {};
                    epiD.price = thisPath.spotPrice.plus(
                        bmul(
                            prevPath.limitAmount,
                            bmul(thisPath.slippage, thisPath.spotPrice)
                        )
                    );
                    epiD.swap = [prevPath.id, thisPath.id];
                    pricesOfInterest.push(epiD);
                }
            }
        }
    });

    return pricesOfInterest;
}

function calculateBestPathsForPricesOfInterest(
    paths: Path[],
    pricesOfInterest: Price[]
): Price[] {
    let bestPaths = [];
    let bestPathsIds = [];
    pricesOfInterest.forEach((e, i) => {
        if (e.id != null) {
            bestPathsIds.push(e.id);
            bestPaths.push(e.path);
        } else if (e.swap) {
            let index1 = bestPathsIds.indexOf(e.swap[0]);
            let index2 = bestPathsIds.indexOf(e.swap[1]);

            if (index1 != -1) {
                if (index2 != -1) {
                    let bestPath1 = bestPaths[index1];
                    let bestPath2 = bestPaths[index2];
                    bestPaths[index1] = bestPath2;
                    bestPaths[index2] = bestPath1;

                    let bestPathId1 = bestPathsIds[index1];
                    let bestPathId2 = bestPathsIds[index2];
                    bestPathsIds[index1] = bestPathId2;
                    bestPathsIds[index2] = bestPathId1;
                } else {
                    bestPaths[index1] = paths[e.swap[1]];
                    bestPathsIds[index1] = e.swap[1];
                }
            }
        } else if (e.maxAmount) {
            // Do nothing
        } else {
            console.log(e);
            console.error(
                'ERROR: poolID or swap not found in pricesOfInterest'
            );
        }
        pricesOfInterest[i].bestPaths = bestPaths.slice();
        // console.log(bestPaths)
    });

    return pricesOfInterest;
}

function getSwapAmountsForPriceOfInterest(
    selectedPaths: Path[],
    poi: BigNumber
): BigNumber[] {
    let swapAmounts: BigNumber[] = [];
    selectedPaths.forEach((path, i) => {
        let inputAmount = bdiv(
            poi.minus(path.spotPrice),
            bmul(path.slippage, path.spotPrice)
        );
        if (path.limitAmount.isLessThan(inputAmount)) {
            inputAmount = path.limitAmount;
        }
        swapAmounts.push(inputAmount);
    });
    return swapAmounts;
}

export const calcTotalReturn = (
    swapType: string,
    selectedPaths: Path[],
    swapAmounts: BigNumber[]
): BigNumber => {
    let path;
    let totalReturn = new BigNumber(0);
    selectedPaths.forEach((path, i) => {
        totalReturn = totalReturn.plus(
            getReturnAmountSwapPath(path, swapType, swapAmounts[i])
        );
    });
    return totalReturn;
};

function getExactSwapAmounts(
    swapAmountsPriceBefore: BigNumber[],
    swapAmountsPriceAfter: BigNumber[],
    totalSwapAmountWithRoundingErrors: BigNumber
): BigNumber[] {
    let deltaBeforeAfterAmounts: BigNumber[] = [];

    if (
        swapAmountsPriceAfter[swapAmountsPriceAfter.length - 1].isEqualTo(
            new BigNumber(0)
        )
    )
        swapAmountsPriceAfter.pop();

    swapAmountsPriceAfter.forEach((a, i) => {
        let diff = a.minus(swapAmountsPriceBefore[i]);
        deltaBeforeAfterAmounts.push(diff);
    });
    let totalInputBefore = swapAmountsPriceBefore.reduce((a, b) => a.plus(b));
    let totalInputAfter = swapAmountsPriceAfter.reduce((a, b) => a.plus(b));
    let deltaTotalInput = totalInputAfter.minus(totalInputBefore);

    // console.log("deltaTotalInput")
    // console.log(deltaTotalInput)
    // console.log("deltaBeforeAfterAmounts")
    // console.log(deltaBeforeAfterAmounts)

    let deltaTimesTarget: BigNumber[] = [];
    deltaBeforeAfterAmounts.forEach((a, i) => {
        let ratio = bdiv(
            totalSwapAmountWithRoundingErrors.minus(totalInputBefore),
            deltaTotalInput
        );

        // console.log("a")
        // console.log(a)
        // console.log("totalSwapAmountWithRoundingErrors.minus(totalInputBefore)")
        // console.log(totalSwapAmountWithRoundingErrors.minus(totalInputBefore))
        // console.log("mult")
        // console.log(mult)

        let deltaAmount = bmul(ratio, a);
        deltaTimesTarget.push(deltaAmount);
    });

    // console.log("deltaTimesTarget")
    // console.log(deltaTimesTarget)

    let swapAmounts: BigNumber[] = [];
    swapAmountsPriceBefore.forEach((a, i) => {
        let add = a.plus(deltaTimesTarget[i]);
        swapAmounts.push(add);
    });
    return swapAmounts;
}

//// TODO Remove: to debug only!
function printSpotPricePathBeforeAndAfterSwap(
    path: Path,
    swapType: string,
    swapAmount: BigNumber
) {
    console.log(path.id);
    console.log('spotPrice BEFORE trade');
    console.log(getSpotPricePath(path).toString());

    let pathAfterTrade: Path;
    pathAfterTrade = path;
    if (path.poolPairDataList.length == 1) {
        if (swapType === 'swapExactIn') {
            path.poolPairDataList[0].balanceIn = path.poolPairDataList[0].balanceIn.plus(
                swapAmount
            );
            path.poolPairDataList[0].balanceOut = path.poolPairDataList[0].balanceOut.minus(
                getReturnAmountSwap(
                    path.poolPairDataList[0],
                    swapType,
                    swapAmount
                )
            );
        } else {
            path.poolPairDataList[0].balanceIn = path.poolPairDataList[0].balanceIn.plus(
                getReturnAmountSwap(
                    path.poolPairDataList[0],
                    swapType,
                    swapAmount
                )
            );
            path.poolPairDataList[0].balanceOut = path.poolPairDataList[0].balanceOut.minus(
                swapAmount
            );
        }
    } else {
        if (swapType === 'swapExactIn') {
            path.poolPairDataList[0].balanceIn = path.poolPairDataList[0].balanceIn.plus(
                swapAmount
            );
            path.poolPairDataList[0].balanceOut = path.poolPairDataList[0].balanceOut.minus(
                getReturnAmountSwap(
                    path.poolPairDataList[0],
                    swapType,
                    swapAmount
                )
            );

            path.poolPairDataList[1].balanceIn = path.poolPairDataList[1].balanceIn.plus(
                getReturnAmountSwap(
                    path.poolPairDataList[0],
                    swapType,
                    swapAmount
                )
            );
            path.poolPairDataList[1].balanceOut = path.poolPairDataList[1].balanceOut.minus(
                getReturnAmountSwap(
                    path.poolPairDataList[1],
                    swapType,
                    getReturnAmountSwap(
                        path.poolPairDataList[0],
                        swapType,
                        swapAmount
                    )
                )
            );
        } else {
            path.poolPairDataList[0].balanceIn = path.poolPairDataList[0].balanceIn.plus(
                getReturnAmountSwap(
                    path.poolPairDataList[0],
                    swapType,
                    getReturnAmountSwap(
                        path.poolPairDataList[1],
                        swapType,
                        swapAmount
                    )
                )
            );
            path.poolPairDataList[0].balanceOut = path.poolPairDataList[0].balanceOut.minus(
                getReturnAmountSwap(
                    path.poolPairDataList[1],
                    swapType,
                    swapAmount
                )
            );

            path.poolPairDataList[1].balanceIn = path.poolPairDataList[1].balanceIn.plus(
                getReturnAmountSwap(
                    path.poolPairDataList[1],
                    swapType,
                    swapAmount
                )
            );
            path.poolPairDataList[1].balanceOut = path.poolPairDataList[1].balanceOut.minus(
                swapAmount
            );
        }
    }

    console.log('spotPrice AFTER  trade');
    console.log(getSpotPricePath(path).toString());
}
