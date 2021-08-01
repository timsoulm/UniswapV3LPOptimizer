import { LiquidityDistributionBar } from 'uniswap-v3-lp-optimizer-types';

export function formatAsPercent(number: number, decimalPlaces: number): string {
    return `${(number * 100).toFixed(decimalPlaces)}%`;
}

export function valueWithPercentDifferenceFromTarget(number: number, comparisonNumber: number): string {
    return `${number.toFixed(6)} (${number - comparisonNumber <= 0 ? '' : '+'}${formatAsPercent((number - comparisonNumber) / comparisonNumber, 2)})`;
}

export function LiquidityVisualization(
    currentPrice: number,
    rangeLower: number,
    rangeUpper: number,
    liquidityDistribution: LiquidityDistributionBar[] | null) {
    if (!liquidityDistribution) {
        return null;
    }

    const largestHeight = liquidityDistribution.slice().sort((a, b) => b.liquidity - a.liquidity)[0].liquidity;
    return <div className="liquidity-chart-container">
        {liquidityDistribution.map((l, i) => {
            let barBackgroundColor = '#CCDAF5';
            if (l.binPrice === currentPrice) {
                barBackgroundColor = '#606060';
            } else if (l.binPrice >= rangeLower && l.binPrice <= rangeUpper) {
                barBackgroundColor = '#7994F7';
            }

            return <div
                key={i}
                className="liquidity-chart-bar"
                style={{
                    height: (l.liquidity / largestHeight) * 100 + '%',
                    backgroundColor: barBackgroundColor
                }}>
            </div>;
        })}
    </div>;
}