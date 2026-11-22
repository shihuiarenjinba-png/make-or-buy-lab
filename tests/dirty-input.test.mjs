import assert from 'node:assert/strict';
import test from 'node:test';
import {evaluateMakeOrBuy,compareSupplierQuotes} from '../src/decision.js';

const profile={resources:[
  {id:'labor',capacityHours:1000,usedHours:700},
  {id:'machine',capacityHours:200,usedHours:100}
]};
const input={
  quantity:1000,
  make:{materialsPerUnit:350,variableLaborPerUnit:180,variableOverheadPerUnit:70,resourceHours:{labor:120,machine:60}},
  buy:{supplierUnitPrice:700},
  risk:{supplierReliabilityPercent:95,supplierLeadTimeDays:14,strategicCriticality:3,supplierConcentrationRisk:2}
};

test('blank required quantity and supplier price are rejected instead of becoming zero',()=>{
  assert.throws(()=>evaluateMakeOrBuy(profile,{...input,quantity:''}),/quantity is required/);
  assert.throws(()=>evaluateMakeOrBuy(profile,{...input,buy:{...input.buy,supplierUnitPrice:''}}),/buy\.supplierUnitPrice is required/);
  assert.throws(()=>evaluateMakeOrBuy(profile,{...input,buy:{...input.buy,supplierUnitPrice:'   '}}),/buy\.supplierUnitPrice is required/);
});

test('whitespace numeric strings are accepted while malformed and negative values fail closed',()=>{
  const x=evaluateMakeOrBuy(profile,{...input,quantity:' 1000 ',buy:{supplierUnitPrice:' 700 '}});
  assert.equal(x.quantity,1000);
  assert.equal(x.currentSupplierUnitPrice,700);
  assert.throws(()=>evaluateMakeOrBuy(profile,{...input,buy:{supplierUnitPrice:'abc'}}),/finite number/);
  assert.throws(()=>evaluateMakeOrBuy(profile,{...input,make:{...input.make,materialsPerUnit:-1}}),/finite number/);
  assert.throws(()=>evaluateMakeOrBuy(profile,{...input,buy:{supplierUnitPrice:Infinity}}),/finite number/);
});

test('risk and capacity damage are rejected or held explicitly',()=>{
  assert.throws(()=>evaluateMakeOrBuy(profile,{...input,risk:{...input.risk,supplierReliabilityPercent:101}}),/finite number/);
  assert.throws(()=>evaluateMakeOrBuy({...profile,resources:[{id:'labor',capacityHours:10,usedHours:11}]},input),/cannot exceed/);
  const hold=evaluateMakeOrBuy(profile,{...input,make:{...input.make,resourceHours:{labor:400,machine:150}}});
  assert.equal(hold.capacityFeasible,false);
  assert.equal(hold.recommendation,'HOLD');
});

test('malformed supplier quote does not silently rank as zero-cost supplier',()=>{
  assert.throws(()=>compareSupplierQuotes(profile,input,[{id:'bad',unitPrice:''}]),/buy\.supplierUnitPrice is required/);
  assert.throws(()=>compareSupplierQuotes(profile,input,[{id:'bad',unitPrice:'oops'}]),/finite number/);
});
