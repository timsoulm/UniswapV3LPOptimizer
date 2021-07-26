import { useEffect, useState, useMemo } from 'react';
import { Column, useTable, useSortBy, useFilters, FilterProps } from 'react-table'
import './App.css';
import { fetchPositionCandidates } from './position-candidate-calculation';
import { PositionCandidate } from 'uniswap-v3-lp-optimizer-types';

function formatAsPercent(number: number, decimalPlaces: number): string {
  return `${(number * 100).toFixed(decimalPlaces)}%`;
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

function App() {
  const [positionCandidates, setPositionCandidates] = useState<Array<PositionCandidate>>([]);
  useEffect(() => {
    async function asyncPositionCandidateWrapper() {
      const positionCandidates = await fetchPositionCandidates();
      setPositionCandidates(positionCandidates);
    };
    asyncPositionCandidateWrapper();
  }, []);

  const data: Array<PositionCandidate> = useMemo(
    () => positionCandidates, [positionCandidates]
  );

  const defaultColumn = useMemo(
    () => ({
      // Let's set up our default Filter UI
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
      },
      {
        Header: 'Range Lower',
        accessor: 'rangeLower',
        Cell: props => props.value.toFixed(6),
        sortType: 'basic'
      },
      {
        Header: 'Range Upper',
        accessor: 'rangeUpper',
        Cell: props => props.value.toFixed(6),
        sortType: 'basic'
      },
      {
        Header: 'Probability Price In Range',
        accessor: 'probabilityPriceInRange',
        Cell: props => formatAsPercent(props.value, 2),
        sortType: 'basic'
      },
      {
        Header: 'Liquidity Coverage Expected Value',
        accessor: 'liquidityCoverageExpectedValue',
        Cell: props => formatAsPercent(props.value, 4),
        sortType: 'basic'
      },
      {
        Header: 'APY Expected Value',
        accessor: 'estimatedAPY',
        Cell: props => formatAsPercent(props.value, 2),
        sortType: 'basic'
      },
    ],
    []
  );

  const tableInstance = useTable({ columns, data, defaultColumn }, useFilters, useSortBy);

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
  } = tableInstance;

  return (
    <div>
      <h1>Uniswap V3 Optimal Position per Pool</h1>
      {data.length === 0 ? <div className="table-loading-container">
        <div className="table-loading-text">Calculating optimal positions... (this can take up to 15 seconds)</div>
        <div className="sk-chase">
          <div className="sk-chase-dot"></div>
          <div className="sk-chase-dot"></div>
          <div className="sk-chase-dot"></div>
          <div className="sk-chase-dot"></div>
          <div className="sk-chase-dot"></div>
          <div className="sk-chase-dot"></div>
        </div>
      </div> :
        <table {...getTableProps()} className="rwd-table">
          <thead>
            {headerGroups.map(headerGroup => (
              <tr {...headerGroup.getHeaderGroupProps()}>
                {headerGroup.headers.map(column => (
                  <th {...column.getHeaderProps(column.getSortByToggleProps())}>
                    <div className="table-header-flex">
                      {column.render('Header')}
                      <span>
                        {column.isSorted ? (column.isSortedDesc ? ' ▼' : ' ▲') : ''}
                      </span>
                      <div>{column.canFilter ? column.render('Filter') : null}</div>
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody {...getTableBodyProps()}>
            {rows.map(row => {
              prepareRow(row)
              return (
                <tr {...row.getRowProps()}>
                  {row.cells.map(cell => {
                    return (
                      <td {...cell.getCellProps()}>
                        {cell.render('Cell')}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      }
    </div >
  );
}

export default App;
