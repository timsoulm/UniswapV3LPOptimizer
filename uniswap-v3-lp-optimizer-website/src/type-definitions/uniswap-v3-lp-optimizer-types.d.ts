declare module 'uniswap-v3-lp-optimizer-types' {
    export type PoolRange = {
        rangeLower: number,
        rangeUpper: number,
        probabilityPriceInRange: number,
        liquidityCoverageExpectedValue: number,
        estimatedAPY: number
    }
    export type PositionCandidate = PoolRange & {
        poolName: string,
        currentPrice: number
    }
    export type LiquidityDistributionBar = {
        liquidity: number,
        binPrice: number
    }
    export type PoolLiquidityDistributions = {
        [poolName: string]: LiquidityDistributionBar[]
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
    export type PoolProcessingResult = {
        positionCandidates: PositionCandidate[],
        poolLiquidityDistributions: PoolLiquidityDistributions
    };
}