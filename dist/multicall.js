"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const bmath = __importStar(require("./bmath"));
// LEGACY FUNCTION - Keep Input/Output Format
function parsePoolDataOnChain(pools, tokenIn, tokenOut, multiAddress, provider) {
    return __awaiter(this, void 0, void 0, function* () {
        if (pools.length === 0)
            throw Error('There are no pools with selected tokens');
        const multiAbi = require('./abi/multicall.json');
        const bpoolAbi = require('./abi/bpool.json');
        const multi = new ethers_1.ethers.Contract(multiAddress, multiAbi, provider);
        const iface = new ethers_1.ethers.utils.Interface(bpoolAbi);
        const promises = [];
        let calls = [];
        let poolData = [];
        pools.forEach(p => {
            calls.push([p.id, iface.functions.getBalance.encode([tokenIn])]);
            calls.push([p.id, iface.functions.getBalance.encode([tokenOut])]);
            calls.push([
                p.id,
                iface.functions.getNormalizedWeight.encode([tokenIn]),
            ]);
            calls.push([
                p.id,
                iface.functions.getNormalizedWeight.encode([tokenOut]),
            ]);
            calls.push([p.id, iface.functions.getSwapFee.encode([])]);
        });
        try {
            const [blockNumber, response] = yield multi.aggregate(calls);
            let i = 0;
            let chunkResponse = [];
            let returnPools = [];
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
                returnPools.push(obj);
            });
            return returnPools;
        }
        catch (e) {
            console.error('Failure querying onchain balances', { error: e });
            return;
        }
    });
}
exports.parsePoolDataOnChain = parsePoolDataOnChain;
function getAllPoolDataOnChain(pools, multiAddress, provider) {
    return __awaiter(this, void 0, void 0, function* () {
        if (pools.pools.length === 0)
            throw Error('There are no pools with selected tokens');
        const multiAbi = require('./abi/multicall.json');
        const bpoolAbi = require('./abi/bpool.json');
        const multi = new ethers_1.ethers.Contract(multiAddress, multiAbi, provider);
        const bPool = new ethers_1.ethers.utils.Interface(bpoolAbi);
        const promises = [];
        let calls = [];
        for (let i = 0; i < pools.pools.length; i++) {
            let p = pools.pools[i];
            calls.push([p.id, bPool.functions.getSwapFee.encode([])]);
            // Checks all tokens for pool
            p.tokens.forEach(token => {
                calls.push([
                    p.id,
                    bPool.functions.getBalance.encode([token.address]),
                ]);
                calls.push([
                    p.id,
                    bPool.functions.getDenormalizedWeight.encode([token.address]),
                ]);
            });
        }
        try {
            console.log(`Multicalls: ${calls.length}`);
            const [blockNumber, response] = yield multi.aggregate(calls);
            let i = 0;
            let chunkResponse = [];
            let returnPools = [];
            // let noCalls = pools.pools.reduce((acc, pool) => acc + (pool.tokensList.length), 0);
            // console.log(`noCalls ${noCalls}`)
            let j = 0;
            // Required otherwise we overwrite original argument
            let poolsCopy = JSON.parse(JSON.stringify(pools.pools));
            let onChainPools = { pools: [] };
            for (let i = 0; i < poolsCopy.length; i++) {
                let p = poolsCopy[i];
                p.swapFee = ethers_1.utils.formatEther(bmath.bnum(response[j]).toString());
                j++;
                p.tokens.forEach(token => {
                    let balance = bmath.scale(bmath.bnum(response[j]), -token.decimals);
                    token.balance = balance.toString();
                    j++;
                    token.denormWeight = ethers_1.utils.formatEther(bmath.bnum(response[j]).toString());
                    j++;
                });
                onChainPools.pools.push(p);
            }
            return onChainPools;
        }
        catch (e) {
            console.error('Failure querying onchain balances', { error: e });
            return;
        }
    });
}
exports.getAllPoolDataOnChain = getAllPoolDataOnChain;
