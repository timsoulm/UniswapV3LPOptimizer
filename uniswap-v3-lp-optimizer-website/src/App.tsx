import { useEffect, useState, useMemo } from 'react';
import { Column, useTable, useSortBy } from 'react-table'
import './App.css';
import { fetchPositionCandidates } from './position-candidate-calculation';
import { PositionCandidate } from 'uniswap-v3-lp-optimizer-types';

function formatAsPercent(number: number, decimalPlaces: number): string {
  return `${(number * 100).toFixed(decimalPlaces)}%`;
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
        sortType: 'basic'
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

  const tableInstance = useTable({ columns, data }, useSortBy);

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
      {data.length === 0 ? <div>Finding optimal positions per pool... (this will take about 15 seconds)</div> :
        <table {...getTableProps()} className="rwd-table">
          <thead>
            {headerGroups.map(headerGroup => (
              <tr {...headerGroup.getHeaderGroupProps()}>
                {headerGroup.headers.map(column => (
                  <th {...column.getHeaderProps(column.getSortByToggleProps())}>
                    {column.render('Header')}
                    <span>
                      {column.isSorted ? (column.isSortedDesc ? ' ▼' : ' ▲') : ''}
                    </span>
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
        </table>}
    </div>
  );
}

export default App;
