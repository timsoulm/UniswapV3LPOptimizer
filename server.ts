import express from 'express';
import fetch from 'node-fetch';
import { PoolLiquiditySummary } from 'uniswap-v3-lp-optimizer-types';

const app = express();
const router = express.Router();

const poolLiquiditySummary: PoolLiquiditySummary = {};

const BIN_WIDTH = 500;
const UPPER_PRICE = 100000;

router.get('/fetch', (req, res) => {
    // Will pull all active non-zero positions for 'WBTC-USDC 3000 60' pool
    fetch('https://api.flipsidecrypto.com/api/v2/queries/bb47119b-a9ad-4c59-ac4d-be8c880786e9/data/latest')
        .then(flipsideResponse => flipsideResponse.json())
        .then((json: unknown) => {
            if (Array.isArray(json)) {
                json.forEach(position => {
                    if (!poolLiquiditySummary[position.POOL_NAME]) {
                        poolLiquiditySummary[position.POOL_NAME] = {
                            binWidth: BIN_WIDTH,
                            binLiquidity: new Array(UPPER_PRICE / BIN_WIDTH),
                            rangeLiquidity: []
                        }
                    }
                    // Need a more generic way of choosing the buckets for a given coin pair, possibly
                    // by using the ticks and tick spacing. Details on tick math here: https://uniswap.org/whitepaper-v3.pdf
                    // Should also switch to a library like Big.js since native javascript numbers are imprecise
                    const lowerBinIndex = Math.floor(position.PRICE_LOWER_1_0_USD / BIN_WIDTH);
                    const upperBinIndex = Math.floor(position.PRICE_UPPER_1_0_USD / BIN_WIDTH) + 1;

                    // The liquidity for this position will need to be spread out across the buckets that is covers.
                    // Assuming this can be done linearly for now, though may need to read more on liquidity
                    const liquidityPerBin = position.LIQUIDITY_ADJ / (upperBinIndex - lowerBinIndex);

                    // Will currently cut off the bins are the UPPER_PRICE
                    for (let i = lowerBinIndex; i < Math.min(poolLiquiditySummary[position.POOL_NAME].binLiquidity.length, upperBinIndex); i++) {
                        if (!poolLiquiditySummary[position.POOL_NAME].binLiquidity[i]) {
                            poolLiquiditySummary[position.POOL_NAME].binLiquidity[i] = liquidityPerBin;
                        } else {
                            poolLiquiditySummary[position.POOL_NAME].binLiquidity[i] += liquidityPerBin;
                        }
                    }
                });
                for (const pool in poolLiquiditySummary) {
                    // O(n^2) to get all the range liquidities for each pool distribution which is pretty expensive.
                    // Will take longer as a functino of bin width getting smaller 
                    for (let rangeLowerBoundIndex = 0; rangeLowerBoundIndex < poolLiquiditySummary[pool].binLiquidity.length; rangeLowerBoundIndex++) {
                        let cumulativeLiquidity = 0;
                        for (let rangeUpperBoundIndex = rangeLowerBoundIndex; rangeUpperBoundIndex < poolLiquiditySummary[pool].binLiquidity.length; rangeUpperBoundIndex++) {
                            cumulativeLiquidity += poolLiquiditySummary[pool].binLiquidity[rangeUpperBoundIndex];
                            poolLiquiditySummary[pool].rangeLiquidity.push({
                                rangeLower: rangeLowerBoundIndex * BIN_WIDTH,
                                rangeUpper: (rangeUpperBoundIndex + 1) * BIN_WIDTH,
                                liquidity: cumulativeLiquidity,
                            });
                        }
                    }
                }
                console.log(poolLiquiditySummary['WBTC-USDC 3000 60'].rangeLiquidity);
                res.sendStatus(200);
            } else {
                res.sendStatus(400);
            }
        });
});

app.use('/', router);

module.exports = app;