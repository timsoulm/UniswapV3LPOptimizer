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

const LIQUIDITY_AMT_USD = 1000;

const PROBABILITY_RANGE_CONFIDENCE = 3;

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
                            binLiquidity: new Array(TOTAL_NUMBER_OF_BINS).fill(0),
                            rangeLiquidity: [],
                            priceMean: poolSummary.L7_MEAN_PRICE_1_0,
                            currentPrice: poolSummary.LATEST_PRICE_1_0,
                            token1_USD: poolSummary.TOKEN1_USD,
                            token0_USD: poolSummary.TOKEN0_USD,
                            priceStandardDeviation: poolSummary.L7_STDDEV_PRICE_1_0,
                            dailyVolume: poolSummary.L7_SWAP_USD_AMOUNT_IN / 7,
                            feePercent: poolSummary.FEE_PERCENT
                        }
                    }
                });

                poolPositions.forEach(position => {
                    if (!(position.POOL_NAME in poolLiquiditySummary)) {
                        return;
                    }
                    const poolLiquiditySummaryForPosition = poolLiquiditySummary[position.POOL_NAME];

                    // The liquidity for this position will need to be spread out across the buckets that is covers.
                    // Assuming this can be done linearly for now, though may need to read more on liquidity
                    const liquidityPerBin =
                        position.LIQUIDITY_ADJ /
                        ((position.PRICE_UPPER_1_0 - position.PRICE_LOWER_1_0) / poolLiquiditySummaryForPosition.binWidth);

                    const lowerBinIndex =
                        Math.floor(((position.PRICE_LOWER_1_0 - poolLiquiditySummaryForPosition.currentPrice)
                            / poolLiquiditySummaryForPosition.binWidth) + BINS_ABOVE_OR_BELOW_CENTER);
                    const upperBinIndex =
                        Math.floor(((position.PRICE_UPPER_1_0 - poolLiquiditySummaryForPosition.currentPrice)
                            / poolLiquiditySummaryForPosition.binWidth) + BINS_ABOVE_OR_BELOW_CENTER);

                    // ignore these since the prices don't overlap with stddev range
                    if (lowerBinIndex > (TOTAL_NUMBER_OF_BINS - 1) || upperBinIndex < 0) {
                        return;
                    }

                    const lowerBinIndexInRange = Math.max(lowerBinIndex, 0);
                    const upperBinIndexInRange = Math.min(upperBinIndex, (TOTAL_NUMBER_OF_BINS - 1));

                    for (let i = lowerBinIndexInRange; i <= upperBinIndexInRange; i++) {
                        if (!poolLiquiditySummaryForPosition.binLiquidity[i]) {
                            poolLiquiditySummaryForPosition.binLiquidity[i] = liquidityPerBin;
                        } else {
                            poolLiquiditySummaryForPosition.binLiquidity[i] += liquidityPerBin;
                        }
                    }
                });

                for (const pool in poolLiquiditySummary) {
                    const currentPool = poolLiquiditySummary[pool];
                    const currentPrice = currentPool.currentPrice;
                    const token1_USD = currentPool.token1_USD;
                    const token0_USD = currentPool.token0_USD;
                    const normalDistFromMeanPrice = new NormalDistribution(currentPool.priceMean, currentPool.priceStandardDeviation);
                    const normalDistFromCurrentPrice = new NormalDistribution(currentPrice, currentPool.priceStandardDeviation);

                    // O(n^2) to get all the range liquidities for each pool distribution which is pretty expensive.
                    // Will take longer as a function of bin width getting smaller
                    for (let rangeLowerBoundIndex = 0; rangeLowerBoundIndex < currentPool.binLiquidity.length; rangeLowerBoundIndex++) {
                        let cumulativeLiquidity = 0;
                        for (let rangeUpperBoundIndex = rangeLowerBoundIndex; rangeUpperBoundIndex < currentPool.binLiquidity.length; rangeUpperBoundIndex++) {
                            cumulativeLiquidity += currentPool.binLiquidity[rangeUpperBoundIndex];

                            const rangeLower = ((rangeLowerBoundIndex - BINS_ABOVE_OR_BELOW_CENTER) * currentPool.binWidth) + currentPrice;
                            const rangeUpper = ((rangeUpperBoundIndex - BINS_ABOVE_OR_BELOW_CENTER) * currentPool.binWidth) + currentPrice;

                            if (REQUIRE_RANGE_OVERLAP_WITH_CURRENT_PRICE
                                && (rangeLower > currentPrice
                                    || rangeUpper < currentPrice)) {
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
                                estimatedDailyFees: 0, // calculation is below
                                estimatedAPY: 0,
                            };

                            // Solve the following system of equations to get amt0 and amt1
                            // Eq1: amt0 * (sqrt(upper) * sqrt(cprice)) / (sqrt(upper) - sqrt(cprice)) = amt1 / (sqrt(cprice) - sqrt(lower))
                            // Eq2: amt0 * token0usd + amt1 * token1usd = total_lp_amt
                            // 
                            // Eq2: amt1 = (total_lp_amt - amt0 * token0usd) / token1usd
                            // Eq1 w/ substitution for amt1:
                            //     amt0 * (sqrt(upper) * sqrt(cprice)) / (sqrt(upper) - sqrt(cprice)) =
                            //        ((total_lp_amt - amt0 * token0usd) / token1usd) / (sqrt(cprice) - sqrt(lower))
                            //
                            //    Solution from wolfram alpha: https://bit.ly/2V59Wyh
                            const amt0 = (LIQUIDITY_AMT_USD * (Math.sqrt(rangeUpper) - Math.sqrt(currentPrice))) /
                                (-Math.sqrt(rangeUpper) * Math.sqrt(currentPrice) * token1_USD * Math.sqrt(rangeLower) +
                                    Math.sqrt(rangeUpper) * currentPrice * token1_USD +
                                    Math.sqrt(rangeUpper) * token0_USD -
                                    Math.sqrt(currentPrice) * token0_USD
                                );
                            const amt1 = (LIQUIDITY_AMT_USD - amt0 * token0_USD) / token1_USD;

                            // Evaluate Case 2: lower < cprice <= upper from https://uniswapv3.flipsidecrypto.com/
                            const positionLiquidity = Math.min(
                                amt0 * (Math.sqrt(rangeUpper) * Math.sqrt(currentPrice)) / (Math.sqrt(rangeUpper) - Math.sqrt(currentPrice)),
                                amt1 / (Math.sqrt(currentPrice) - Math.sqrt(rangeLower))
                            );

                            rangeLiquidity.estimatedDailyFees =
                                // take the average of the probabilities from current price and mean price, then raise to the confidence
                                // exponent. The higher this exponent, the less confident we are that the price will actually
                                // stay within the specified range
                                ((rangeLiquidity.currentPriceProbabilityInRange + rangeLiquidity.meanPriceProbabilityInRange) / 2) ** PROBABILITY_RANGE_CONFIDENCE *
                                (positionLiquidity / rangeLiquidity.liquidity) *
                                currentPool.dailyVolume *
                                currentPool.feePercent * .01;

                            // TODO: fix bug where calculation sometimes comes out to NaN
                            // Maybe due to floating point precision in JS? Need to switch to Big.js anyway
                            if (!isNaN(rangeLiquidity.estimatedDailyFees)) {
                                rangeLiquidity.estimatedAPY = (rangeLiquidity.estimatedDailyFees / LIQUIDITY_AMT_USD) * 365 * 100;
                                currentPool.rangeLiquidity.push(rangeLiquidity);
                            }
                        }
                    }
                }

                const topRangePerPool = [];
                for (const pool in poolLiquiditySummary) {
                    const currentPool = poolLiquiditySummary[pool];
                    topRangePerPool.push({
                        poolName: pool,
                        optimalPosition: currentPool.rangeLiquidity.sort((a, b) => b.estimatedAPY - a.estimatedAPY)[0]
                    });
                }

                console.log(topRangePerPool);

                res.sendStatus(200);
            } else {
                res.sendStatus(400);
            }
        });
    });
});

app.use('/', router);

module.exports = app;