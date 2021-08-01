import { useState } from 'react';
import { FilterProps, FilterValue, Row, IdType } from 'react-table'
import { PositionCandidate } from 'uniswap-v3-lp-optimizer-types';

export function DefaultColumnFilter({
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

export function GlobalFilter({
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

export function createSliderColumnFilter(min: number, max: number, step: number, valueFormatter: (val: number) => string) {
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

export function filterGreaterThan(rows: Array<Row<any>>, id: Array<IdType<any>>, filterValue: FilterValue) {
    return rows.filter((row) => {
        const rowValue = row.values[id[0]];
        return rowValue >= filterValue;
    });
}

export function createFilterRange(isUpper: boolean) {
    return function (rows: Array<Row<any>>, id: Array<IdType<any>>, filterValue: FilterValue) {
        return rows.filter((row) => {
            const rowValueRaw = row.values[id[0]];
            const comparisonValue = row.values.currentPrice;
            const rowValuePercent = (rowValueRaw - comparisonValue) / comparisonValue;
            return isUpper ? rowValuePercent >= filterValue : rowValuePercent <= filterValue;
        });
    }
}

export function singlePositionPerPoolFilter(
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