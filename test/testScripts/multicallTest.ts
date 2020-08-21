require('dotenv').config();
const sor = require('../../src');
const { ethers } = require('ethers');
import { JsonRpcProvider } from 'ethers/providers';
import _ from 'lodash'; // Import the entire lodash library

const multicall = '0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE441';

async function runSingle() {
    let provider = new JsonRpcProvider(
        `https://mainnet.infura.io/v3/${process.env.INFURA}`
    );

    let allPools = await sor.getAllPublicSwapPools();

    console.log(allPools.pools.length);
    try {
        console.time('multi');
        let allPoolsOnChain = await sor.getAllPoolDataOnChain(
            allPools,
            multicall,
            provider
        );
        console.timeEnd('multi');

        console.log(`First Pool:`);
        console.log(Object.values(allPoolsOnChain.pools)[0]);
    } catch (error) {
        console.log(`ERROR ${error.message}`);
    }

    return;
}

// Increases number of multicalls to test limit.
async function runLoopTest() {
    let provider = new JsonRpcProvider(
        `https://mainnet.infura.io/v3/${process.env.INFURA}`
    );

    let allPools = await sor.getAllPublicSwapPools();
    let i = 0;
    while (i < 5) {
        console.log(allPools.pools.length);
        try {
            console.time('multi');
            let allPoolsOnChain = await sor.getAllPoolDataOnChain(
                allPools,
                multicall,
                provider
            );
            console.timeEnd('multi');
        } catch (error) {
            break;
        }

        let newPools = _.cloneDeep(allPools.pools);

        newPools = allPools.pools.concat(newPools);
        allPools.pools = newPools;

        i++;
    }

    return;
}

runSingle();
