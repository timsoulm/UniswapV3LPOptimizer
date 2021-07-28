import {
    UseColumnOrderInstanceProps,
    UseColumnOrderState,
    UseExpandedHooks,
    UseExpandedInstanceProps,
    UseExpandedOptions,
    UseExpandedRowProps,
    UseExpandedState,
    UseFiltersColumnOptions,
    UseFiltersColumnProps,
    UseFiltersInstanceProps,
    UseFiltersOptions,
    UseFiltersState,
    UseGlobalFiltersColumnOptions,
    UseGlobalFiltersInstanceProps,
    UseGlobalFiltersOptions,
    UseGlobalFiltersState,
    UseGroupByCellProps,
    UseGroupByColumnOptions,
    UseGroupByColumnProps,
    UseGroupByHooks,
    UseGroupByInstanceProps,
    UseGroupByOptions,
    UseGroupByRowProps,
    UseGroupByState,
    UsePaginationInstanceProps,
    UsePaginationOptions,
    UsePaginationState,
    UseResizeColumnsColumnOptions,
    UseResizeColumnsColumnProps,
    UseResizeColumnsOptions,
    UseResizeColumnsState,
    UseRowSelectHooks,
    UseRowSelectInstanceProps,
    UseRowSelectOptions,
    UseRowSelectRowProps,
    UseRowSelectState,
    UseRowStateCellProps,
    UseRowStateInstanceProps,
    UseRowStateOptions,
    UseRowStateRowProps,
    UseRowStateState,
    UseSortByColumnOptions,
    UseSortByColumnProps,
    UseSortByHooks,
    UseSortByInstanceProps,
    UseSortByOptions,
    UseSortByState
} from 'react-table'

declare module 'react-table' {
    // take this file as-is, or comment out the sections that don't apply to your plugin configuration

    export interface TableOptions<D extends Record<string, unknown>>
        extends UseSortByOptions<D>, UseFiltersOptions<D>, UsePaginationOptions<D>, { }

    export interface Hooks<D extends Record<string, unknown> = Record<string, unknown>>
        extends UseSortByHooks<D> { }

    export interface TableInstance<D extends Record<string, unknown> = Record<string, unknown>>
        extends UseSortByInstanceProps<D>, UseFiltersInstanceProps<D>, UsePaginationInstanceProps<D>, { }

    export interface TableState<D extends Record<string, unknown> = Record<string, unknown>>
        extends UseSortByState<D>, UseFiltersState<D>, UsePaginationState<D>, { }

    export interface ColumnInterface<D extends Record<string, unknown> = Record<string, unknown>>
        extends UseSortByColumnOptions<D>, UseFiltersColumnOptions<D> { }

    export interface ColumnInstance<D extends Record<string, unknown> = Record<string, unknown>>
        extends UseSortByColumnProps<D>, UseFiltersColumnProps<D> { }

    export interface Cell<D extends Record<string, unknown> = Record<string, unknown>, V = any>
        extends UseGroupByCellProps<D>,
        UseRowStateCellProps<D> { }

    export interface Row<D extends Record<string, unknown> = Record<string, unknown>>
        extends UseExpandedRowProps<D>,
        UseGroupByRowProps<D>,
        UseRowSelectRowProps<D>,
        UseRowStateRowProps<D> { }
}