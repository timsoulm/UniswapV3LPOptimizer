import express from 'express';
import fetch from 'node-fetch';
import { PoolLiquiditySummary, PoolRange } from 'uniswap-v3-lp-optimizer-types';
import NormalDistribution from 'normal-distribution';

const app = express();
const router = express.Router();

const poolLiquiditySummary: PoolLiquiditySummary = {};

// The number of standard deviations to analyze surrounding the target price (+/- 10)
const PRICE_RANGE_NUM_OF_STD_DEVS = 20;

// The proportion of a standard deviation that a single bin represents
const BIN_WIDTH_PCT_OF_STD_DEV = .25;

// Number of buckets is the std devs to cover times number of buckets per std dev
// The middle bucket will be the target price, hence the +1
const TOTAL_NUMBER_OF_BINS = PRICE_RANGE_NUM_OF_STD_DEVS * (1 / BIN_WIDTH_PCT_OF_STD_DEV) + 1;
const BINS_ABOVE_OR_BELOW_CENTER = (TOTAL_NUMBER_OF_BINS - 1) / 2;

const REQUIRE_RANGE_OVERLAP_WITH_CURRENT_PRICE = true;

router.get('/fetch', (req, res) => {
    // Will pull the mean, stddev for 'WBTC-USDC 3000 60' pool
    const poolSummaryFetch = fetch('https://api.flipsidecrypto.com/api/v2/queries/11495506-6d15-4537-a808-27a1a3b3f946/data/latest');

    // Will pull all active non-zero positions for 'WBTC-USDC 3000 60' pool
    const poolPositionFetch = fetch('https://api.flipsidecrypto.com/api/v2/queries/bb47119b-a9ad-4c59-ac4d-be8c880786e9/data/latest');

    Promise.all([poolSummaryFetch, poolPositionFetch]).then(responseValues => {
        const poolSummaryResponseJson = responseValues[0].json();
        const poolPositionResponseJson = responseValues[1].json();
        Promise.all([poolSummaryResponseJson, poolPositionResponseJson]).then(responseJsonValues => {
            const poolSummaries = responseJsonValues[0];
            const poolPositions = responseJsonValues[1];
            if (Array.isArray(poolSummaries) && Array.isArray(poolPositions)) {
                poolSummaries.forEach(poolSummary => {
                    if (!poolLiquiditySummary[poolSummary.POOL_NAME]) {
                        poolLiquiditySummary[poolSummary.POOL_NAME] = {
                            binWidth: poolSummary.L7_STDDEV_PRICE_1_0 * BIN_WIDTH_PCT_OF_STD_DEV,
                            binLiquidity: new Array(TOTAL_NUMBER_OF_BINS),
                            rangeLiquidity: [],
                            priceMean: poolSummary.L7_MEAN_PRICE_1_0,
                            currentPrice: poolSummary.LATEST_PRICE_1_0,
                            priceStandardDeviation: poolSummary.L7_STDDEV_PRICE_1_0,
                            dailyVolume: poolSummary.L7_SWAP_USD_AMOUNT_IN / 7,
                            feePercent: poolSummary.FEE_PERCENT
                        }
                    }
                });

                poolPositions.forEach(position => {
                    const poolLiquiditySummaryForPosition = poolLiquiditySummary[position.POOL_NAME];

                    // The liquidity for this position will need to be spread out across the buckets that is covers.
                    // Assuming this can be done linearly for now, though may need to read more on liquidity
                    const liquidityPerBin =
                        position.LIQUIDITY_ADJ /
                        ((position.PRICE_UPPER_1_0_USD - position.PRICE_LOWER_1_0_USD) / poolLiquiditySummaryForPosition.binWidth);

                    const lowerBinIndex =
                        Math.floor(((position.PRICE_LOWER_1_0_USD - poolLiquiditySummaryForPosition.currentPrice)
                            / poolLiquiditySummaryForPosition.binWidth) + BINS_ABOVE_OR_BELOW_CENTER);
                    const upperBinIndex =
                        Math.floor(((position.PRICE_UPPER_1_0_USD - poolLiquiditySummaryForPosition.currentPrice)
                            / poolLiquiditySummaryForPosition.binWidth) + BINS_ABOVE_OR_BELOW_CENTER);

                    // ignore these since the prices don't overlap with stddev range
                    if (lowerBinIndex > (TOTAL_NUMBER_OF_BINS - 1) || upperBinIndex < 0) {
                        return;
                    }

                    const lowerBinIndexInRange = Math.max(lowerBinIndex, 0);
                    const upperBinIndexInRange = Math.min(upperBinIndex, (TOTAL_NUMBER_OF_BINS - 1));

                    for (let i = lowerBinIndexInRange; i <= upperBinIndexInRange; i++) {
                        if (!poolLiquiditySummary[position.POOL_NAME].binLiquidity[i]) {
                            poolLiquiditySummary[position.POOL_NAME].binLiquidity[i] = liquidityPerBin;
                        } else {
                            poolLiquiditySummary[position.POOL_NAME].binLiquidity[i] += liquidityPerBin;
                        }
                    }
                });

                for (const pool in poolLiquiditySummary) {
                    const normalDistFromMeanPrice = new NormalDistribution(poolLiquiditySummary[pool].priceMean, poolLiquiditySummary[pool].priceStandardDeviation);
                    const normalDistFromCurrentPrice = new NormalDistribution(poolLiquiditySummary[pool].currentPrice, poolLiquiditySummary[pool].priceStandardDeviation);

                    // O(n^2) to get all the range liquidities for each pool distribution which is pretty expensive.
                    // Will take longer as a function of bin width getting smaller
                    for (let rangeLowerBoundIndex = 0; rangeLowerBoundIndex < poolLiquiditySummary[pool].binLiquidity.length; rangeLowerBoundIndex++) {
                        let cumulativeLiquidity = 0;
                        for (let rangeUpperBoundIndex = rangeLowerBoundIndex; rangeUpperBoundIndex < poolLiquiditySummary[pool].binLiquidity.length; rangeUpperBoundIndex++) {
                            cumulativeLiquidity += poolLiquiditySummary[pool].binLiquidity[rangeUpperBoundIndex];

                            const rangeLower = ((rangeLowerBoundIndex - BINS_ABOVE_OR_BELOW_CENTER) * poolLiquiditySummary[pool].binWidth) + poolLiquiditySummary[pool].currentPrice;
                            const rangeUpper = ((rangeUpperBoundIndex - BINS_ABOVE_OR_BELOW_CENTER) * poolLiquiditySummary[pool].binWidth) + poolLiquiditySummary[pool].currentPrice;

                            if (REQUIRE_RANGE_OVERLAP_WITH_CURRENT_PRICE
                                && (rangeLower > poolLiquiditySummary[pool].currentPrice
                                    || rangeUpper < poolLiquiditySummary[pool].currentPrice)) {
                                continue;
                            }

                            const rangeLiquidity: PoolRange = {
                                rangeLower: rangeLower,
                                rangeUpper: rangeUpper,
                                liquidity: cumulativeLiquidity,
                                // The goal here is to use the standard deviation (aka daily price volatility) to estimate
                                // the probability of the price being in the range [a, b] along a normal distribution.
                                // Note that this is an early methodology which needs a lot of work to be able to map onto reality
                                currentPriceProbabilityInRange: normalDistFromCurrentPrice.probabilityBetween(rangeLower, rangeUpper),
                                meanPriceProbabilityInRange: normalDistFromMeanPrice.probabilityBetween(rangeLower, rangeUpper),
                                liquidityEfficiency: 0
                            };

                            rangeLiquidity.liquidityEfficiency =
                                ((rangeLiquidity.currentPriceProbabilityInRange + rangeLiquidity.meanPriceProbabilityInRange) / 2) *
                                (1 / rangeLiquidity.liquidity) *
                                poolLiquiditySummary[pool].dailyVolume *
                                poolLiquiditySummary[pool].feePercent * .01;

                            poolLiquiditySummary[pool].rangeLiquidity.push(rangeLiquidity);
                        }
                    }
                }
                const top5ranges = poolLiquiditySummary['WBTC-USDC 3000 60'].rangeLiquidity.sort((a, b) => b.liquidityEfficiency - a.liquidityEfficiency).slice(0, 5);
                console.log(top5ranges);
                res.sendStatus(200);
            } else {
                res.sendStatus(400);
            }
        });
    });
});

app.use('/', router);

module.exports = app;