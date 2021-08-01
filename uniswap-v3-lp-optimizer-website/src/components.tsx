import { Column, CellProps, TablePropGetter, TableProps, HeaderGroup, TableBodyPropGetter, TableBodyProps, Row } from 'react-table'
import { PositionCandidate, PoolLiquidityDistributions, CalculationConfigurationValues } from 'uniswap-v3-lp-optimizer-types';
import { createSliderColumnFilter, createFilterRange, filterGreaterThan } from './filter-utils';
import { formatAsPercent, valueWithPercentDifferenceFromTarget, LiquidityVisualization } from './utils';

export function getColumns(poolLiquidityDistributions: PoolLiquidityDistributions | null): Array<Column<PositionCandidate>> {
    return [
        {
            Header: 'Pool Name',
            accessor: 'poolName',
        },
        {
            Header: 'Current Price',
            accessor: 'currentPrice',
            Cell: props => props.value.toFixed(6),
            sortType: 'basic',
            disableFilters: true,
        },
        {
            Header: 'Range Lower',
            accessor: 'rangeLower',
            Cell: props => valueWithPercentDifferenceFromTarget(props.value, props.row.values.currentPrice),
            sortType: 'basic',
            Filter: createSliderColumnFilter(-.05, 0, 0.002, val => `<${(val * 100).toFixed(1)}%`),
            filter: createFilterRange(false),
        },
        {
            Header: 'Range Upper',
            accessor: 'rangeUpper',
            Cell: props => valueWithPercentDifferenceFromTarget(props.value, props.row.values.currentPrice),
            sortType: 'basic',
            Filter: createSliderColumnFilter(0, .05, 0.002, val => `>${(val * 100).toFixed(1)}%`),
            filter: createFilterRange(true),
        },
        {
            Header: 'Liquidity Visualization',
            disableFilters: true,
            Cell: function (props: React.PropsWithChildren<CellProps<PositionCandidate, any>>) {
                return LiquidityVisualization(
                    props.row.values.currentPrice,
                    props.row.values.rangeLower,
                    props.row.values.rangeUpper,
                    poolLiquidityDistributions ? poolLiquidityDistributions[props.row.values.poolName] : null
                );
            }
        },
        {
            Header: 'Probability Price In Range',
            accessor: 'probabilityPriceInRange',
            Cell: props => formatAsPercent(props.value, 2),
            sortType: 'basic',
            Filter: createSliderColumnFilter(0, 1, 0.01, val => `>${(val * 100).toFixed(0)}%`),
            filter: filterGreaterThan,
        },
        {
            Header: 'Liquidity Coverage Expected Value',
            accessor: 'liquidityCoverageExpectedValue',
            Cell: props => formatAsPercent(props.value, 4),
            sortType: 'basic',
            Filter: createSliderColumnFilter(0, 0.01, 0.001, val => `>${(val * 100).toFixed(2)}%`),
            filter: filterGreaterThan,
        },
        {
            Header: 'APY Expected Value *** (See Disclaimer)',
            accessor: 'estimatedAPY',
            Cell: props => formatAsPercent(props.value, 2),
            sortType: 'basic',
            Filter: createSliderColumnFilter(0, 5, 0.1, val => `>${(val * 100).toFixed(0)}%`),
            filter: filterGreaterThan,
        },
    ];
};

export function IntroContainer(props: {
    configurationValues: CalculationConfigurationValues,
    setConfigurationValues: React.Dispatch<React.SetStateAction<CalculationConfigurationValues>>,
    setShouldCalculatePositions: React.Dispatch<React.SetStateAction<boolean>>
}) {
    const configurationValues = props.configurationValues;
    const setConfigurationValues = props.setConfigurationValues;
    const setShouldCalculatePositions = props.setShouldCalculatePositions;

    function handleVolumeMethodologyChangeEvent(isTimePeriod: boolean) {
        return function (e: React.ChangeEvent<HTMLInputElement>) {
            const volumeMethodology = { ...configurationValues.volumeMethodology };
            if (isTimePeriod) {
                volumeMethodology.timePeriod = e.target.value as 'daily' | 'hourly';
            } else {
                volumeMethodology.aggregation = e.target.value as 'mean' | 'median';
            }
            setConfigurationValues({
                ...configurationValues,
                volumeMethodology: volumeMethodology
            });
            setShouldCalculatePositions(true);
        }
    }

    return <div className="intro-container">
        <div className="intro-disclaimer">
            <p><strong>Disclaimer***: </strong>This tool is not investment advice, please use it at your own risk. It uses an expected value calculation to estimate the fee earning potential for a day (then extrapolated to APY). This is similar to the methodology of the <a href="https://uniswapv3.flipsidecrypto.com/">Flipside Uniswap Fees Calculator</a>. <strong>It assumes no changes to swap price, swap volumes or liquidity positions which is not realistic. It also does not account for Impermanent Loss currently. </strong>Use it to make directional decisions about investments, but past information makes no gaurantees about the future.</p>
            <p>For more information about the calculation methodology, see the <a href="https://github.com/timsoulm/UniswapV3LPOptimizer">Github README and code</a></p>
            <p>High level calculation presets (changing these will re-run calculation):</p>
            <ul>
                <li>Evaluate +/- 4 standard deviations from current price, bin size = 1/4 std dev</li>
                <li>Require that potential position overlaps with current price</li>
                <li>Liquidity $ amount provided:
                    <input
                        style={{ marginLeft: '8px' }}
                        size={8}
                        type="text"
                        value={configurationValues.liquidityAmountProvided}
                        onChange={(e) => setConfigurationValues({ ...configurationValues, liquidityAmountProvided: parseInt(e.target.value) })}
                        onBlur={async function (e) {
                            setShouldCalculatePositions(true);
                        }} />
                </li>
                <li>Volume estimation methodology:
                    <form>
                        <ul>
                            <li>
                                <input
                                    type='radio'
                                    value='daily'
                                    checked={configurationValues.volumeMethodology.timePeriod === 'daily'}
                                    onChange={handleVolumeMethodologyChangeEvent(true)} /> Daily
                                <input
                                    type='radio'
                                    value='hourly'
                                    checked={configurationValues.volumeMethodology.timePeriod === 'hourly'}
                                    onChange={handleVolumeMethodologyChangeEvent(true)} /> Hourly
                            </li>
                            <li>
                                <input
                                    type='radio'
                                    value='mean'
                                    checked={configurationValues.volumeMethodology.aggregation === 'mean'}
                                    onChange={handleVolumeMethodologyChangeEvent(false)}
                                /> Mean
                                <input
                                    type='radio'
                                    value='median'
                                    checked={configurationValues.volumeMethodology.aggregation === 'median'}
                                    onChange={handleVolumeMethodologyChangeEvent(false)}
                                /> Median
                            </li>
                        </ul>
                    </form>
                </li>
                <li>Pool avg daily volume min threshold: $1M</li>
            </ul>
        </div>
        <div className="intro-righthand-side">
            <div className="intro-liquidity-visualization-image">
                <img src="liquidityVisualization.svg" alt="liquidity coverage calculation diagram" />
            </div>
            <div className="intro-donation-section">
                <p>
                    Finding this site useful?
                </p>
                <p><strong>BTC Donations:</strong> 39R2n93kXVKba2Uv9i4JbsPDDjYoz2jgGq</p>
                <p><strong>ETH Donations:</strong> 0xcE109E4879D1B2765c8439b7FBaA2E7640fBE832</p>
            </div>
        </div>
    </div>;
}

export function TablePagination(props: {
    pageOptions: number[],
    pageCount: number,
    pageIndex: number,
    gotoPage: (updater: number | ((pageIndex: number) => number)) => void,
    previousPage: () => void,
    nextPage: () => void,
    canPreviousPage: boolean,
    canNextPage: boolean
}) {
    const {
        pageOptions,
        pageCount,
        pageIndex,
        gotoPage,
        previousPage,
        nextPage,
        canPreviousPage,
        canNextPage
    } = props;

    return <div className="table-pagination">
        <button onClick={() => gotoPage(0)} disabled={!canPreviousPage}>
            {'<<'}
        </button>{' '}
        <button onClick={() => previousPage()} disabled={!canPreviousPage}>
            {'<'}
        </button>{' '}
        <button onClick={() => nextPage()} disabled={!canNextPage}>
            {'>'}
        </button>{' '}
        <button onClick={() => gotoPage(pageCount - 1)} disabled={!canNextPage}>
            {'>>'}
        </button>{' '}
        <span>
            Page{' '}
            <strong>
                {pageIndex + 1} of {pageOptions.length}
            </strong>{' '}
        </span>
    </div>;
}

export function TableLoadingComponent() {
    return <div className="table-loading-container">
        <div className="table-loading-text">Calculating positions... (this can take a little bit)</div>
        <div className="sk-chase">
            <div className="sk-chase-dot"></div>
            <div className="sk-chase-dot"></div>
            <div className="sk-chase-dot"></div>
            <div className="sk-chase-dot"></div>
            <div className="sk-chase-dot"></div>
            <div className="sk-chase-dot"></div>
        </div>
    </div>;
}

export function TableBody(props: {
    getTableProps: (propGetter?: TablePropGetter<PositionCandidate> | undefined) => TableProps,
    headerGroups: HeaderGroup<PositionCandidate>[],
    getTableBodyProps: (propGetter?: TableBodyPropGetter<PositionCandidate> | undefined) => TableBodyProps,
    page: Row<PositionCandidate>[],
    prepareRow: (row: Row<PositionCandidate>) => void
}) {
    const { getTableProps, headerGroups, getTableBodyProps, page, prepareRow } = props;
    return <table {...getTableProps()} className="rwd-table">
        <thead>
            {headerGroups.map(headerGroup => (
                <tr {...headerGroup.getHeaderGroupProps()}>
                    {headerGroup.headers.map(column => (
                        <th {...column.getHeaderProps()}>
                            <div className="table-header-container">
                                <div {...column.getSortByToggleProps()}>
                                    {column.render('Header')}
                                    <span>
                                        {column.isSorted ? (column.isSortedDesc ? ' ▼' : ' ▲') : ''}
                                    </span>
                                </div>
                                <div>{column.canFilter ? column.render('Filter') : null}</div>
                            </div>
                        </th>
                    ))}
                </tr>
            ))}
        </thead>
        <tbody {...getTableBodyProps()}>
            {page.map((row, i) => {
                prepareRow(row)
                return (
                    <tr {...row.getRowProps()}>
                        {row.cells.map(cell => {
                            return <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
                        })}
                    </tr>
                )
            })}
        </tbody>
    </table>;
}

export const initialTableState = {
    hiddenColumns: [
        'currentPrice'
    ],
    globalFilter: true,
    filters: [
        {
            id: 'rangeLower',
            value: -0.01
        },
        {
            id: 'rangeUpper',
            value: 0.01
        },
        {
            id: 'probabilityPriceInRange',
            value: 0.1
        },
        {
            id: 'liquidityCoverageExpectedValue',
            value: 0
        },
        {
            id: 'estimatedAPY',
            value: 0
        },
    ],
    pageSize: 10
};