import { useEffect, useState, useMemo } from 'react';
import { Column, useTable, useSortBy, useFilters, useGlobalFilter, FilterProps, FilterValue, IdType, Row, usePagination, CellProps } from 'react-table'
import './App.css';
import { processPoolData } from './position-candidate-calculation';
import { PositionCandidate, PoolLiquidityDistributions, LiquidityDistributionBar, CalculationConfigurationValues } from 'uniswap-v3-lp-optimizer-types';

function formatAsPercent(number: number, decimalPlaces: number): string {
  return `${(number * 100).toFixed(decimalPlaces)}%`;
}

function valueWithPercentDifferenceFromTarget(number: number, comparisonNumber: number): string {
  return `${number.toFixed(6)} (${number - comparisonNumber <= 0 ? '' : '+'}${formatAsPercent((number - comparisonNumber) / comparisonNumber, 2)})`;
}

function DefaultColumnFilter({
  column: { filterValue, setFilter },
}: FilterProps<PositionCandidate>) {
  return (
    <input
      value={filterValue || ''}
      onChange={e => {
        setFilter(e.target.value || undefined)
      }}
      placeholder={`Filter...`}
    />
  )
}

function filterGreaterThan(rows: Array<Row<any>>, id: Array<IdType<any>>, filterValue: FilterValue) {
  return rows.filter((row) => {
    const rowValue = row.values[id[0]];
    return rowValue >= filterValue;
  });
}

function createFilterRange(isUpper: boolean) {
  return function (rows: Array<Row<any>>, id: Array<IdType<any>>, filterValue: FilterValue) {
    return rows.filter((row) => {
      const rowValueRaw = row.values[id[0]];
      const comparisonValue = row.values.currentPrice;
      const rowValuePercent = (rowValueRaw - comparisonValue) / comparisonValue;
      return isUpper ? rowValuePercent >= filterValue : rowValuePercent <= filterValue;
    });
  }
}

function singlePositionPerPoolFilter(
  rows: Array<Row<PositionCandidate>>,
  columnIds: Array<IdType<PositionCandidate>>,
  globalFilterValue: boolean
): Array<Row<PositionCandidate>> {
  if (globalFilterValue) {
    // Reduce list to the top APY position per pool
    return Object.values(rows.reduce((prev, curr) => {
      prev[curr.values.poolName] =
        (prev[curr.values.poolName] && prev[curr.values.poolName].values.estimatedAPY > curr.values.estimatedAPY)
          ? prev[curr.values.poolName]
          : curr;
      return prev;
    }, {} as { [poolName: string]: Row<PositionCandidate> }));
  } else {
    return rows;
  }
}

function liquidityVisualization(
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

function GlobalFilter({
  globalFilter,
  setGlobalFilter,
}: {
  globalFilter: boolean,
  setGlobalFilter: (filterValue: FilterValue) => void
}) {
  const [value, setValue] = useState(globalFilter);

  return <div className="table-global-filter-box">
    <input
      type="checkbox"
      checked={value}
      onChange={e => { setValue(e.target.checked); setGlobalFilter(e.target.checked) }}
    />
    Only show top APY position per pool
  </div>;
}

function CreateSliderColumnFilter(min: number, max: number, step: number, valueFormatter: (val: number) => string) {
  return function ({
    column: { filterValue, setFilter },
  }: FilterProps<PositionCandidate>) {
    return (
      <>
        <input
          className="slider-filter"
          type="range"
          min={min}
          max={max}
          step={step}
          value={filterValue}
          onChange={e => {
            setFilter(parseFloat(e.target.value));
          }}
        />
        <input
          type="text"
          value={valueFormatter(filterValue)}
          size={6}
          readOnly />
      </>
    );
  }
}


function App() {
  const [positionCandidates, setPositionCandidates] = useState<Array<PositionCandidate>>([]);
  const [poolLiquidityDistributions, setPoolLiquidityDistributions] = useState<PoolLiquidityDistributions | null>(null);
  const [configurationValues, setConfigurationValues] = useState<CalculationConfigurationValues>({
    liquidityAmountProvided: 1000
  });
  useEffect(() => {
    async function asyncPositionCandidateWrapper() {
      const poolData = await processPoolData(configurationValues);
      if (poolData) {
        setPositionCandidates(poolData.positionCandidates);
        setPoolLiquidityDistributions(poolData.poolLiquidityDistributions);
      }
    };
    asyncPositionCandidateWrapper();
  }, []);

  const data: Array<PositionCandidate> = useMemo(
    () => positionCandidates, [positionCandidates]
  );

  const defaultColumn = useMemo(
    () => ({
      Filter: DefaultColumnFilter,
    }),
    []
  )

  const columns: Array<Column<PositionCandidate>> = useMemo(
    () => [
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
        Filter: CreateSliderColumnFilter(-.05, 0, 0.002, val => `<${(val * 100).toFixed(1)}%`),
        filter: createFilterRange(false),
      },
      {
        Header: 'Range Upper',
        accessor: 'rangeUpper',
        Cell: props => valueWithPercentDifferenceFromTarget(props.value, props.row.values.currentPrice),
        sortType: 'basic',
        Filter: CreateSliderColumnFilter(0, .05, 0.002, val => `>${(val * 100).toFixed(1)}%`),
        filter: createFilterRange(true),
      },
      {
        Header: 'Liquidity Visualization',
        disableFilters: true,
        Cell: function (props: React.PropsWithChildren<CellProps<PositionCandidate, any>>) {
          return liquidityVisualization(
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
        Filter: CreateSliderColumnFilter(0, 1, 0.01, val => `>${(val * 100).toFixed(0)}%`),
        filter: filterGreaterThan,
      },
      {
        Header: 'Liquidity Coverage Expected Value',
        accessor: 'liquidityCoverageExpectedValue',
        Cell: props => formatAsPercent(props.value, 4),
        sortType: 'basic',
        Filter: CreateSliderColumnFilter(0, 0.01, 0.001, val => `>${(val * 100).toFixed(2)}%`),
        filter: filterGreaterThan,
      },
      {
        Header: 'APY Expected Value *** (See Disclaimer)',
        accessor: 'estimatedAPY',
        Cell: props => formatAsPercent(props.value, 2),
        sortType: 'basic',
        Filter: CreateSliderColumnFilter(0, 5, 0.1, val => `>${(val * 100).toFixed(0)}%`),
        filter: filterGreaterThan,
      },
    ],
    [poolLiquidityDistributions]
  );

  const tableInstance = useTable({
    columns,
    data,
    defaultColumn,
    initialState: {
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
    },
    globalFilter: singlePositionPerPoolFilter
  }, useFilters, useGlobalFilter, useSortBy, usePagination);

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    prepareRow,
    setGlobalFilter,
    globalFilteredRows,
    state,
    page,
    pageOptions,
    pageCount,
    state: { pageIndex },
    gotoPage,
    previousPage,
    nextPage,
    canPreviousPage,
    canNextPage,
  } = tableInstance;

  return (
    <div>
      <h1>Uniswap V3 Optimal Pool Position Estimation Tool</h1>
      <h4>Built using data from <a href="https://flipsidecrypto.com">Flipside Crypto</a>. [ <a href="https://app.flipsidecrypto.com/velocity/queries/11495506-6d15-4537-a808-27a1a3b3f946">Query 1</a>, <a href="https://app.flipsidecrypto.com/velocity/queries/bb47119b-a9ad-4c59-ac4d-be8c880786e9">Query 2</a> ]</h4>
      <div className="intro-container">
        <div className="intro-disclaimer">
          <p><strong>Disclaimer***: </strong>This tool is not investment advice, please use it at your own risk. It uses an expected value calculation to estimate the fee earning potential for a day (then extrapolated to APY). This is similar to the methodology of the <a href="https://uniswapv3.flipsidecrypto.com/">Flipside Uniswap Fees Calculator</a>. <strong>It assumes no changes to swap price, swap volumes or liquidity positions which is not realistic. It also does not account for Impermanent Loss currently. </strong>Use it to make directional decisions about investments, but past information makes no gaurantees about the future.</p>
          <p>For more information about the calculation methodology, see the <a href="https://github.com/timsoulm/UniswapV3LPOptimizer">Github README and code</a></p>
          <p>High level calculation presets (changing these will re-run calculation):</p>
          <ul>
            <li>(+/- 4) standard deviations from current price explored</li>
            <li>Bin size: 0.25 standard deviation</li>
            <li>Require that potential position overlaps with current price</li>
            <li>Liquidity $ amount provided:
              <input
                style={{ marginLeft: '8px' }}
                size={8}
                type="text"
                value={configurationValues.liquidityAmountProvided}
                onChange={(e) => setConfigurationValues({ liquidityAmountProvided: parseInt(e.target.value) })}
                onBlur={async function (e) {
                  setPositionCandidates([]);
                  const poolData = await processPoolData(configurationValues);
                  if (poolData) {
                    setPositionCandidates(poolData.positionCandidates);
                  }
                }} />
            </li>
            <li>Pool last 7 days volume requirement: $3.5M</li>
            <li>Pool last 1 day volume requirement: $0.5M</li>
          </ul>
        </div>
        <div className="intro-liquidity-visualization-image">
          <img src="liquidityVisualization.svg" alt="liquidity coverage calculation diagram" />
        </div>

      </div>
      {
        data.length === 0 ? <div className="table-loading-container">
          <div className="table-loading-text">Calculating positions... (this can take a little bit)</div>
          <div className="sk-chase">
            <div className="sk-chase-dot"></div>
            <div className="sk-chase-dot"></div>
            <div className="sk-chase-dot"></div>
            <div className="sk-chase-dot"></div>
            <div className="sk-chase-dot"></div>
            <div className="sk-chase-dot"></div>
          </div>
        </div> :
          <>
            <div className="table-top-settings">
              <h4>Showing <strong>{globalFilteredRows.length}</strong> potential pool {globalFilteredRows.length === 1 ? 'position' : 'positions'}</h4>
              <GlobalFilter
                globalFilter={state.globalFilter}
                setGlobalFilter={setGlobalFilter}
              />
            </div>
            <table {...getTableProps()} className="rwd-table">
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
            </table>
            <div className="table-pagination">
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
            </div>
          </>
      }
    </div >
  );
}

export default App;
