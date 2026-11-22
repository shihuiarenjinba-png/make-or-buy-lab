function finite(name,value,{min=-Infinity,max=Infinity}={}){
  const n=Number(value);
  if(!Number.isFinite(n)||n<min||n>max)throw new Error(name+' must be a finite number between '+min+' and '+max);
  return n;
}
function optional(name,value,options){
  if(value===undefined||value===null||String(value).trim()==='')return null;
  return finite(name,value,options);
}
function required(name,value,options){
  if(value===undefined||value===null||String(value).trim()==='')throw new Error(name+' is required');
  return finite(name,value,options);
}
function resources(profile={}){
  return (profile.resources||[]).map((r,i)=>{
    const id=String(r.id??('resource-'+(i+1)));
    const capacityHours=finite(id+'.capacityHours',r.capacityHours,{min:0});
    const usedHours=finite(id+'.usedHours',r.usedHours??0,{min:0});
    if(usedHours>capacityHours)throw new Error(id+'.usedHours cannot exceed capacityHours');
    return {id,name:String(r.name??id),type:String(r.type??'other'),capacityHours,usedHours};
  });
}
export function evaluateMakeOrBuy(profile={},input={}){
  const quantity=required('quantity',input.quantity,{min:1});
  const make={
    materials:finite('make.materialsPerUnit',input.make?.materialsPerUnit??0,{min:0})*quantity,
    variableLabor:finite('make.variableLaborPerUnit',input.make?.variableLaborPerUnit??0,{min:0})*quantity,
    variableOverhead:finite('make.variableOverheadPerUnit',input.make?.variableOverheadPerUnit??0,{min:0})*quantity,
    setup:finite('make.setupCost',input.make?.setupCost??0,{min:0}),
    avoidableFixed:finite('make.avoidableFixedCost',input.make?.avoidableFixedCost??0,{min:0}),
    stepFixed:finite('make.stepFixedCost',input.make?.stepFixedCost??0,{min:0}),
    qualityRework:finite('make.qualityReworkCost',input.make?.qualityReworkCost??0,{min:0}),
    internalLogistics:finite('make.internalLogisticsCost',input.make?.internalLogisticsCost??0,{min:0}),
    knownOpportunityCost:finite('make.knownOpportunityCost',input.make?.knownOpportunityCost??0,{min:0}),
    otherRelevant:finite('make.otherRelevantCost',input.make?.otherRelevantCost??0,{min:0})
  };
  const buy={
    supplier:required('buy.supplierUnitPrice',input.buy?.supplierUnitPrice,{min:0})*quantity,
    freight:finite('buy.freightCost',input.buy?.freightCost??0,{min:0}),
    inspection:finite('buy.inspectionCost',input.buy?.inspectionCost??0,{min:0}),
    qualityRework:finite('buy.qualityReworkCost',input.buy?.qualityReworkCost??0,{min:0}),
    switching:finite('buy.switchingCost',input.buy?.switchingCost??0,{min:0}),
    importTariff:finite('buy.importTariff',input.buy?.importTariff??0,{min:0}),
    otherRelevant:finite('buy.otherRelevantCost',input.buy?.otherRelevantCost??0,{min:0})
  };
  const makeRelevantCost=Object.values(make).reduce((a,b)=>a+b,0);
  const buyRelevantCost=Object.values(buy).reduce((a,b)=>a+b,0);
  const supplierNonUnitCost=buyRelevantCost-buy.supplier;
  const breakEvenSupplierUnitPrice=(makeRelevantCost-supplierNonUnitCost)/quantity;
  const unavoidableAllocatedFixedCost=finite('unavoidableAllocatedFixedCost',input.unavoidableAllocatedFixedCost??0,{min:0});
  const req=input.make?.resourceHours??{};
  const capacity=resources(profile).map(r=>{
    const addedHours=finite('make.resourceHours.'+r.id,req[r.id]??0,{min:0});
    const afterHours=r.usedHours+addedHours;
    return {...r,addedHours,afterHours,beforeUtilization:r.capacityHours>0?r.usedHours/r.capacityHours:null,afterUtilization:r.capacityHours>0?afterHours/r.capacityHours:null,remainingHoursAfter:r.capacityHours-afterHours,capacityBreach:afterHours>r.capacityHours};
  });
  const capacityFeasible=capacity.every(r=>!r.capacityBreach);
  const costDifference=buyRelevantCost-makeRelevantCost;
  let recommendation='HOLD',signal='ECONOMIC_TIE';
  if(makeRelevantCost<buyRelevantCost){if(capacityFeasible){recommendation='MAKE';signal='MAKE_LOWER_RELEVANT_COST'}else{signal='MAKE_CHEAPER_BUT_CAPACITY_BREACH'}}
  else if(buyRelevantCost<makeRelevantCost){recommendation='BUY';signal='BUY_LOWER_RELEVANT_COST'}
  const supplierReliability=optional('risk.supplierReliabilityPercent',input.risk?.supplierReliabilityPercent,{min:0,max:100});
  const strategicCriticality=optional('risk.strategicCriticality',input.risk?.strategicCriticality,{min:1,max:5});
  const supplierConcentrationRisk=optional('risk.supplierConcentrationRisk',input.risk?.supplierConcentrationRisk,{min:1,max:5});
  const supplierLeadTimeDays=optional('risk.supplierLeadTimeDays',input.risk?.supplierLeadTimeDays,{min:0});
  const qualitativeFlags=[];
  if(supplierReliability!==null&&supplierReliability<90)qualitativeFlags.push('LOW_SUPPLIER_RELIABILITY');
  if(strategicCriticality!==null&&strategicCriticality>=4)qualitativeFlags.push('HIGH_STRATEGIC_CRITICALITY');
  if(supplierConcentrationRisk!==null&&supplierConcentrationRisk>=4)qualitativeFlags.push('HIGH_SUPPLIER_CONCENTRATION');
  if(supplierLeadTimeDays!==null&&supplierLeadTimeDays>30)qualitativeFlags.push('LONG_SUPPLIER_LEAD_TIME');
  return {quantity,make:{components:make,relevantCost:makeRelevantCost,costPerUnit:makeRelevantCost/quantity},buy:{components:buy,relevantCost:buyRelevantCost,costPerUnit:buyRelevantCost/quantity},costDifference,cheaperBy:Math.abs(costDifference),breakEvenSupplierUnitPrice,currentSupplierUnitPrice:required('buy.supplierUnitPrice',input.buy?.supplierUnitPrice,{min:0}),capacity,capacityFeasible,recommendation,signal,excludedAllocatedFixedCost:unavoidableAllocatedFixedCost,risk:{supplierReliabilityPercent:supplierReliability,strategicCriticality,supplierConcentrationRisk,supplierLeadTimeDays,qualitativeFlags},assumptions:[
    'Only costs that change between MAKE and BUY belong in the relevant-cost comparison.',
    'Unavoidable allocated fixed cost is disclosed but excluded from both alternatives.',
    'Avoidable fixed cost is relevant because buying can eliminate that cost.',
    'Known opportunity cost is included only when explicitly supplied; future orders are not invented.',
    'Qualitative supplier/strategy risk flags are not automatically converted into yen.',
    'A cheaper MAKE alternative remains on HOLD if current internal capacity is breached.'
  ]};
}
export function compareSupplierQuotes(profile,input,quotes=[]){
  if(!Array.isArray(quotes))throw new Error('quotes must be an array');
  return quotes.map((q,i)=>{const result=evaluateMakeOrBuy(profile,{...input,buy:{...(input.buy||{}),supplierUnitPrice:q.unitPrice,...q.costs},risk:{...(input.risk||{}),...(q.risk||{})}});return {id:String(q.id??('supplier-'+(i+1))),name:String(q.name??q.id??('Supplier '+(i+1))),result};}).sort((a,b)=>a.result.buy.relevantCost-b.result.buy.relevantCost);
}
