import assert from 'node:assert/strict';
import test from 'node:test';
import {evaluateMakeOrBuy,compareSupplierQuotes} from '../src/decision.js';

const profile={resources:[
 {id:'labor',capacityHours:1120,usedHours:780},
 {id:'machine',capacityHours:180,usedHours:60}
]};
const base={
 quantity:1000,
 make:{materialsPerUnit:350,variableLaborPerUnit:180,variableOverheadPerUnit:70,setupCost:30000,avoidableFixedCost:50000,qualityReworkCost:10000,internalLogisticsCost:10000,resourceHours:{labor:160,machine:100}},
 buy:{supplierUnitPrice:700,freightCost:30000,inspectionCost:10000,qualityReworkCost:15000,switchingCost:10000},
 unavoidableAllocatedFixedCost:300000,
 risk:{supplierReliabilityPercent:95,supplierLeadTimeDays:14,strategicCriticality:3,supplierConcentrationRisk:2}
};

test('unavoidable allocated fixed cost is disclosed but excluded',()=>{
 const x=evaluateMakeOrBuy(profile,base);
 assert.equal(x.excludedAllocatedFixedCost,300000);
 assert.equal(x.make.relevantCost,700000);
 assert.equal(x.buy.relevantCost,765000);
 assert.equal(x.recommendation,'MAKE');
});
test('avoidable fixed cost is relevant to MAKE',()=>{
 const a=evaluateMakeOrBuy(profile,base);
 const b=evaluateMakeOrBuy(profile,{...base,make:{...base.make,avoidableFixedCost:0}});
 assert.equal(a.make.relevantCost-b.make.relevantCost,50000);
});
test('capacity breach holds a cheaper MAKE decision',()=>{
 const x=evaluateMakeOrBuy(profile,{...base,make:{...base.make,resourceHours:{labor:400,machine:130}}});
 assert.equal(x.make.relevantCost<x.buy.relevantCost,true);
 assert.equal(x.capacityFeasible,false);
 assert.equal(x.recommendation,'HOLD');
 assert.equal(x.signal,'MAKE_CHEAPER_BUT_CAPACITY_BREACH');
});
test('BUY is recommended when supplier relevant cost is lower',()=>{
 const x=evaluateMakeOrBuy(profile,{...base,buy:{...base.buy,supplierUnitPrice:550}});
 assert.equal(x.recommendation,'BUY');
});
test('break-even supplier price subtracts non-unit buy costs',()=>{
 const x=evaluateMakeOrBuy(profile,base);
 assert.equal(x.breakEvenSupplierUnitPrice,635);
});
test('qualitative risk is flagged but not monetized automatically',()=>{
 const x=evaluateMakeOrBuy(profile,{...base,risk:{supplierReliabilityPercent:80,supplierLeadTimeDays:45,strategicCriticality:5,supplierConcentrationRisk:5}});
 assert.deepEqual(x.risk.qualitativeFlags,['LOW_SUPPLIER_RELIABILITY','HIGH_STRATEGIC_CRITICALITY','HIGH_SUPPLIER_CONCENTRATION','LONG_SUPPLIER_LEAD_TIME']);
 assert.equal(x.buy.relevantCost,765000);
});
test('known opportunity cost can flip MAKE economics',()=>{
 const x=evaluateMakeOrBuy(profile,{...base,make:{...base.make,knownOpportunityCost:100000}});
 assert.equal(x.make.relevantCost,800000);
 assert.equal(x.recommendation,'BUY');
});
test('supplier quote comparison sorts by relevant buy cost',()=>{
 const rows=compareSupplierQuotes(profile,base,[{id:'a',unitPrice:710},{id:'b',unitPrice:680,costs:{freightCost:50000}}]);
 assert.equal(rows[0].id,'b');
});
test('invalid capacity fails closed',()=>{
 assert.throws(()=>evaluateMakeOrBuy({resources:[{id:'x',capacityHours:10,usedHours:11}]},base),/cannot exceed/);
});
