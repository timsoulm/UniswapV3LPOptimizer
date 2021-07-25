import { useEffect, useState, useMemo } from 'react';
import { Column, useTable } from 'react-table'
import './App.css';
import { fetchPositionCandidates } from './position-candidate-calculation';
import { PositionCandidate } from 'uniswap-v3-lp-optimizer-types';


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
        Header: 'Range Lower',
        accessor: 'rangeLower',
      },
      {
        Header: 'Range Upper',
        accessor: 'rangeUpper',
      },
      {
        Header: 'Probability Price In Range',
        accessor: 'probabilityPriceInRange',
      },
      {
        Header: 'Liquidity Coverage Expected Value',
        accessor: 'liquidityCoverageExpectedValue',
      },
      {
        Header: 'APY Expected Value',
        accessor: 'estimatedAPY',
      },
    ],
    []
  );

  const tableInstance = useTable({ columns, data });

  if (data.length === 0) {
    return <div>Finding optimal positions per pool... (this will take about 15 seconds)</div>;
  }

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
  } = tableInstance;

  return (
    <div>
      <table {...getTableProps()} className="positionsTable">
        <thead>
          {headerGroups.map(headerGroup => (
            <tr {...headerGroup.getHeaderGroupProps()}>
              {headerGroup.headers.map(column => (
                <th {...column.getHeaderProps()}>
                  {column.render('Header')}
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
    </div>
  );
}

export default App;
