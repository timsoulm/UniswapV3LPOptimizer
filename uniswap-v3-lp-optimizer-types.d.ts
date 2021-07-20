declare module 'uniswap-v3-lp-optimizer-types' {
    export type PoolRange = {
        rangeLower: number,
        rangeUpper: number,
        liquidity: number,
        normalDistributionProbabilityInRange: number
    }
    export type PoolLiquiditySummary = {
        [poolName: string]: {
            priceMean: number,
            priceStandardDeviation: number,
            binWidth: number,
            binLiquidity: number[],
            rangeLiquidity: PoolRange[],
        }
    };
}