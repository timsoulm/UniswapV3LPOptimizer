import { PoolLiquiditySummary, PoolRange, PositionCandidate } from 'uniswap-v3-lp-optimizer-types';
import NormalDistribution from 'normal-distribution';

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
const MINIMUM_PROBABILITY_IN_RANGE = 0.1;

const LIQUIDITY_AMT_USD = 1000;

const POOL_L7_LIQUIDITY_THRESHOLD = 3_500_000;
const POOL_L1_LIQUIDITY_THRESHOLD = 500_000;

function convertBinIndexToPrice(index: number, binWidth: number, centerPrice: number) {
    return ((index - BINS_ABOVE_OR_BELOW_CENTER) * binWidth) + centerPrice;
}

export async function fetchPositionCandidates(): Promise<PositionCandidate[] | null> {
    const [poolSummaryResponse, poolPositionResponse] = await Promise.all([
        fetch('https://api.flipsidecrypto.com/api/v2/queries/11495506-6d15-4537-a808-27a1a3b3f946/data/latest'),
        fetch('https://api.flipsidecrypto.com/api/v2/queries/bb47119b-a9ad-4c59-ac4d-be8c880786e9/data/latest')
    ]);

    const [poolSummaries, poolPositions] = await Promise.all([
        poolSummaryResponse.json(),
        poolPositionResponse.json()
    ]);

    if (!Array.isArray(poolSummaries) || !Array.isArray(poolPositions)) {
        return null;
    }

    poolSummaries.forEach(poolSummary => {
        // Set some pool volume requirements here to get a better idea of pools with
        // some stability
        if (poolSummary.L7_SWAP_USD_AMOUNT_IN < POOL_L7_LIQUIDITY_THRESHOLD
            || poolSummary.L1_SWAP_USD_AMOUNT_IN < POOL_L1_LIQUIDITY_THRESHOLD) {
            return;
        }
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
                poolLiquiditySummaryForPosition.binLiquidity[i] = position.LIQUIDITY_ADJ;
            } else {
                poolLiquiditySummaryForPosition.binLiquidity[i] += position.LIQUIDITY_ADJ;
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
            for (let rangeUpperBoundIndex = rangeLowerBoundIndex; rangeUpperBoundIndex < currentPool.binLiquidity.length; rangeUpperBoundIndex++) {
                const rangeLower = ((rangeLowerBoundIndex - BINS_ABOVE_OR_BELOW_CENTER) * currentPool.binWidth) + currentPrice;
                const rangeUpper = ((rangeUpperBoundIndex - BINS_ABOVE_OR_BELOW_CENTER) * currentPool.binWidth) + currentPrice;

                if (REQUIRE_RANGE_OVERLAP_WITH_CURRENT_PRICE
                    && (rangeLower > currentPrice
                        || rangeUpper < currentPrice)) {
                    continue;
                }

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

                // TODO: fix bug where calculation sometimes comes out to NaN
                // Maybe due to floating point precision in JS? Need to switch to Big.js anyway
                // Same with liquidityCoverageExpectedValue below...
                if (isNaN(positionLiquidity)) {
                    continue;
                }

                let liquidityCoverageExpectedValue = 0;
                for (let i = rangeLowerBoundIndex; i <= rangeUpperBoundIndex; i++) {
                    const binLowerPrice = convertBinIndexToPrice(i, currentPool.binWidth, currentPrice);
                    const binUpperPrice = convertBinIndexToPrice(i + 1, currentPool.binWidth, currentPrice);
                    const currentPriceProbabilityInBin = normalDistFromCurrentPrice.probabilityBetween(binLowerPrice, binUpperPrice);
                    const meanPriceProbabilityInBin = normalDistFromMeanPrice.probabilityBetween(binLowerPrice, binUpperPrice);
                    const aggregateProbabilityInBin = (currentPriceProbabilityInBin + meanPriceProbabilityInBin) / 2;
                    liquidityCoverageExpectedValue += (positionLiquidity / (currentPool.binLiquidity[i] + positionLiquidity)) * aggregateProbabilityInBin;
                }

                if (isNaN(liquidityCoverageExpectedValue)) {
                    continue;
                }

                const estimatedDailyFees = liquidityCoverageExpectedValue *
                    currentPool.dailyVolume *
                    currentPool.feePercent * .01;

                const rangeLiquidity: PoolRange = {
                    rangeLower: rangeLower,
                    rangeUpper: rangeUpper,
                    probabilityPriceInRange:
                        (normalDistFromCurrentPrice.probabilityBetween(rangeLower, rangeUpper)
                            + normalDistFromMeanPrice.probabilityBetween(rangeLower, rangeUpper)) / 2,
                    liquidityCoverageExpectedValue: liquidityCoverageExpectedValue,
                    estimatedDailyFees: estimatedDailyFees,
                    estimatedAPY: (estimatedDailyFees / LIQUIDITY_AMT_USD) * 365 * 100
                };

                currentPool.rangeLiquidity.push(rangeLiquidity);
            }
        }
    }

    const topRangePerPool = [];
    for (const pool in poolLiquiditySummary) {
        const currentPool = poolLiquiditySummary[pool];
        topRangePerPool.push({
            poolName: pool,
            optimalPosition: currentPool.rangeLiquidity
                .filter(a => a.probabilityPriceInRange >= MINIMUM_PROBABILITY_IN_RANGE)
                .sort((a, b) => b.estimatedAPY - a.estimatedAPY)[0]
        });
    }

    return topRangePerPool;
}