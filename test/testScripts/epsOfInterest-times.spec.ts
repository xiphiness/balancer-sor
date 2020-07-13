// Tests Multihop SOR vs static allPools.json file.
// Includes timing data.
import { expect, assert } from 'chai';
import 'mocha';
const sor = require('../src');
const BigNumber = require('bignumber.js');
const { utils } = require('ethers');
const allPools = require('./allPools.json');
import { BONE } from '../src/bmath';

const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // DAI
const ANT = '0x960b236A07cf122663c4303350609A66A7B288C0';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const MKR = '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2';

BigNumber.config({
    EXPONENTIAL_AT: [-100, 100],
    ROUNDING_MODE: BigNumber.ROUND_HALF_EVEN,
    DECIMAL_PLACES: 18,
});

describe('Testing Timings', () => {
    it('Full Multihop SOR, WETH>DAI, swapExactIn, EPS Version With Subgraph Pool Data', async () => {
        const amountIn = new BigNumber(1).times(BONE);

        const allPoolsReturned = await sor.getAllPublicSwapPools();

        console.time('TOTAL');
        console.time('filterPoolsWithTokensDirect');
        const directPools = await sor.filterPoolsWithTokensDirect(
            allPoolsReturned,
            WETH,
            DAI
        );
        console.timeEnd('filterPoolsWithTokensDirect');

        console.time('filterPoolsWithTokensMultihop');
        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsReturned,
            WETH,
            DAI
        );
        console.timeEnd('filterPoolsWithTokensMultihop');

        console.time('parsePoolData');
        let pools, pathData;
        [pools, pathData] = sor.parsePoolData(
            directPools,
            WETH.toLowerCase(), // TODO - Why is this required????
            DAI.toLowerCase(),
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens
        );
        console.timeEnd('parsePoolData');

        console.time('processPaths');
        let paths = sor.processPaths(pathData, pools, 'swapExactIn');
        console.timeEnd('processPaths');

        console.time('processEpsOfInterestMultiHop');
        let epsOfInterest = sor.processEpsOfInterestMultiHop(
            paths,
            'swapExactIn'
        );
        console.timeEnd('processEpsOfInterestMultiHop');

        console.time('smartOrderRouterMultiHopEpsOfInterest');
        let sorSwapsEps, totalReturnEps;
        [
            sorSwapsEps,
            totalReturnEps,
        ] = sor.smartOrderRouterMultiHopEpsOfInterest(
            JSON.parse(JSON.stringify(pools)),
            paths,
            'swapExactIn',
            amountIn,
            4,
            new BigNumber(0),
            epsOfInterest
        );
        console.timeEnd('smartOrderRouterMultiHopEpsOfInterest');
        console.timeEnd('TOTAL');
    }).timeout(30000);
});
