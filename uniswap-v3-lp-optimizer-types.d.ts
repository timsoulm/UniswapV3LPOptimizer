declare module 'uniswap-v3-lp-optimizer-types' {
    export type PoolRange = {
        rangeLower: number,
        rangeUpper: number,
        liquidity: number,
    }
    export type PoolLiquiditySummary = {
        [poolName: string]: {
            binWidth: number,
            binLiquidity: number[],
            rangeLiquidity: PoolRange[],
        }
    };
}