# Make or Buy model v1

## Relevant-cost rule

Only costs that change between MAKE and BUY belong in the decision.

### MAKE
- direct materials
- variable labor
- variable overhead
- setup
- avoidable fixed cost
- step-fixed cost
- expected quality/rework cost
- internal logistics
- known opportunity cost
- other explicit relevant cost

### BUY
- supplier price
- freight
- inspection
- expected quality/rework cost
- switching cost
- tariff/import cost
- other explicit relevant cost

## Fixed-cost warning

Unavoidable allocated fixed cost is displayed but excluded. Adding an unchanged head-office allocation, existing rent, or unchanged depreciation only to MAKE can incorrectly bias the result toward outsourcing.

## Capacity

MAKE also consumes explicit labor/equipment hours. A cheaper MAKE alternative is placed on HOLD when it breaches current capacity.

## Break-even supplier price

Break-even supplier unit price = (MAKE relevant cost - BUY non-unit relevant costs) / quantity.

This is the supplier price at which the two monetary alternatives are equal under the stated inputs.

## Risk boundary

Supplier reliability, lead time, strategic criticality, and supplier concentration are shown as qualitative flags. They are not converted into yen unless the user supplies a defensible expected monetary cost.

## Opportunity cost

The model never invents future work. Internal capacity opportunity cost is included only when a known displaced alternative or separately validated estimate exists.
