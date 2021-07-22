declare module 'uniswap-v3-lp-optimizer-types' {
    export type PoolRange = {
        rangeLower: number,
        rangeUpper: number,
        liquidity: number,
        currentPriceProbabilityInRange: number,
        meanPriceProbabilityInRange: number,
        liquidityEfficiency: number
    }
    export type PoolLiquiditySummary = {
        [poolName: string]: {
            priceMean: number,
            currentPrice: number,
            token1_USD: number,
            token0_USD: number,
            priceStandardDeviation: number,
            binWidth: number,
            binLiquidity: number[],
            rangeLiquidity: PoolRange[],
            dailyVolume: number,
            feePercent: number
        }
    };
}