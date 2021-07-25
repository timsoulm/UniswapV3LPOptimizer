import { useEffect, useState } from 'react';
import './App.css';
import { fetchPositionCandidates } from './position-candidate-calculation';
import { PositionCandidate } from 'uniswap-v3-lp-optimizer-types';


function App() {
  const [positionCandidates, setPositionCandidates] = useState<Array<PositionCandidate> | null>(null);
  useEffect(() => {
    async function asyncPositionCandidateWrapper() {
      const positionCandidates = await fetchPositionCandidates();
      setPositionCandidates(positionCandidates);
    };
    asyncPositionCandidateWrapper();
  }, []);

  return (
    <div>

      {positionCandidates ? <table className="positionsTable">
        <thead>
          <tr>
            <th>Pool Name</th>
            <th>Range Lower</th>
            <th>Range Upper</th>
            <th>Probability Price In Range</th>
            <th>Liquidity Coverage Expected Value</th>
            <th>APY Expected Value</th>
          </tr>
        </thead>
        <tbody>
          {positionCandidates.map(positionCandidate => {
            return (
              <tr key={positionCandidate.poolName}>
                <td>{positionCandidate.poolName}</td>
                <td>{positionCandidate.optimalPosition.rangeLower.toFixed(6)}</td>
                <td>{positionCandidate.optimalPosition.rangeUpper.toFixed(6)}</td>
                <td>{positionCandidate.optimalPosition.probabilityPriceInRange.toFixed(2)}</td>
                <td>{positionCandidate.optimalPosition.liquidityCoverageExpectedValue.toFixed(6)}</td>
                <td>{positionCandidate.optimalPosition.estimatedAPY.toFixed(2)}</td>
              </tr>);
          })}
        </tbody>
      </table> : <div>Loading positions... (this will take about 15 seconds)</div>}
    </div>
  );
}

export default App;
