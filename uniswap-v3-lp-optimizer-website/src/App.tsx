import { useEffect, useState, useMemo } from 'react';
import { useTable, useSortBy, useFilters, useGlobalFilter, usePagination } from 'react-table'
import './App.css';
import { processPoolData } from './position-candidate-calculation';
import { PositionCandidate, PoolLiquidityDistributions, CalculationConfigurationValues } from 'uniswap-v3-lp-optimizer-types';
import { DefaultColumnFilter, GlobalFilter, singlePositionPerPoolFilter } from './filter-utils';
import { getColumns, IntroContainer } from './components';

function App() {
  const [positionCandidates, setPositionCandidates] = useState<Array<PositionCandidate>>([]);
  const [poolLiquidityDistributions, setPoolLiquidityDistributions] = useState<PoolLiquidityDistributions | null>(null);
  const [configurationValues, setConfigurationValues] = useState<CalculationConfigurationValues>({
    liquidityAmountProvided: 1000,
    volumeMethodology: {
      timePeriod: 'daily',
      aggregation: 'mean'
    }
  });
  const [shouldCalculatePositions, setShouldCalculatePositions] = useState<boolean>(true);
  useEffect(() => {
    if (!shouldCalculatePositions) {
      return;
    }
    setPositionCandidates([]);

    async function asyncPositionCandidateWrapper() {
      const poolData = await processPoolData(configurationValues);
      if (poolData) {
        setPositionCandidates(poolData.positionCandidates);
        setPoolLiquidityDistributions(poolData.poolLiquidityDistributions);
      }
    };
    asyncPositionCandidateWrapper();

    setShouldCalculatePositions(false);
  }, [shouldCalculatePositions, configurationValues]);

  const data: Array<PositionCandidate> = useMemo(
    () => positionCandidates, [positionCandidates]
  );

  const defaultColumn = useMemo(
    () => ({
      Filter: DefaultColumnFilter,
    }),
    []
  );

  const columns = useMemo(() => getColumns(poolLiquidityDistributions), [poolLiquidityDistributions]);

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
      <h4>Built using data from <a href="https://flipsidecrypto.com">Flipside Crypto</a>. [ <a href="https://app.flipsidecrypto.com/velocity/queries/efed0457-5edc-46fa-ad7b-cffd01d5b93d">Query 1</a>, <a href="https://app.flipsidecrypto.com/velocity/queries/bb47119b-a9ad-4c59-ac4d-be8c880786e9">Query 2</a> ]</h4>

      <IntroContainer
        configurationValues={configurationValues}
        setConfigurationValues={setConfigurationValues}
        setShouldCalculatePositions={setShouldCalculatePositions} />
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
