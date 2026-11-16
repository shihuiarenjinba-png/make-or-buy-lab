# Make or Buy Lab

Local-first make-or-buy decision support based on relevant cost and internal capacity.

## Purpose

Compare MAKE and BUY without biasing the result by allocating unchanged fixed costs only to internal production.

### MAKE includes
- direct materials
- variable labor
- variable overhead
- setup cost
- avoidable fixed cost
- decision-triggered step-fixed cost
- expected quality/rework cost
- internal logistics
- known opportunity cost
- other explicit relevant cost

### BUY includes
- supplier unit price
- freight
- inspection
- expected quality/rework cost
- switching cost
- tariff/import cost
- other explicit relevant cost

Unavoidable allocated fixed cost is shown separately and excluded from the monetary comparison.

## Capacity rule

Internal production consumes explicit labor/equipment hours. If MAKE is cheaper but exceeds current capacity, the recommendation is HOLD instead of blindly choosing MAKE.

## Risk rule

Supplier reliability, lead time, strategic criticality, and supplier concentration are shown as qualitative flags. The engine does not silently convert these into yen. Enter an expected monetary cost only when there is a defensible estimate.

## Outputs

- MAKE relevant cost and cost per unit
- BUY relevant cost and cost per unit
- cost difference
- break-even supplier unit price
- labor/equipment before/after utilization
- MAKE / BUY / HOLD recommendation
- qualitative supplier/strategy warnings

## Local UI

    npm test
    npm run check
    npm start

Open: http://localhost:8766/public/

Inputs can be stored in browser localStorage and results can be exported as JSON. No external API is needed for v1 and no company/supplier data is uploaded by the local UI.

See docs/MODEL.md and docs/LOCAL_CONNECTION_PLAN.md.
