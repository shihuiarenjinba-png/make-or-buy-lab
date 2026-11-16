import {evaluateMakeOrBuy} from './decision.js';
const $=id=>document.getElementById(id),n=id=>Number($(id).value||0);
const yen=v=>Math.round(v).toLocaleString('ja-JP')+'円',pct=v=>v===null?'—':(v*100).toFixed(1)+'%';
let last=null;
const ids=['quantity','unavoidableAllocatedFixedCost','materialsPerUnit','variableLaborPerUnit','variableOverheadPerUnit','setupCost','avoidableFixedCost','stepFixedCost','makeQuality','internalLogistics','knownOpportunityCost','makeOther','laborHours','machineHours','supplierUnitPrice','freightCost','inspectionCost','buyQuality','switchingCost','importTariff','buyOther','supplierReliability','supplierLeadTime','strategicCriticality','supplierConcentration','laborCapacity','laborUsed','machineCapacity','machineUsed'];
function payload(){
 return {
  profile:{resources:[
   {id:'labor',name:'労働',type:'labor',capacityHours:n('laborCapacity'),usedHours:n('laborUsed')},
   {id:'machine',name:'設備',type:'equipment',capacityHours:n('machineCapacity'),usedHours:n('machineUsed')}
  ]},
  input:{
   quantity:n('quantity'),unavoidableAllocatedFixedCost:n('unavoidableAllocatedFixedCost'),
   make:{materialsPerUnit:n('materialsPerUnit'),variableLaborPerUnit:n('variableLaborPerUnit'),variableOverheadPerUnit:n('variableOverheadPerUnit'),setupCost:n('setupCost'),avoidableFixedCost:n('avoidableFixedCost'),stepFixedCost:n('stepFixedCost'),qualityReworkCost:n('makeQuality'),internalLogisticsCost:n('internalLogistics'),knownOpportunityCost:n('knownOpportunityCost'),otherRelevantCost:n('makeOther'),resourceHours:{labor:n('laborHours'),machine:n('machineHours')}},
   buy:{supplierUnitPrice:n('supplierUnitPrice'),freightCost:n('freightCost'),inspectionCost:n('inspectionCost'),qualityReworkCost:n('buyQuality'),switchingCost:n('switchingCost'),importTariff:n('importTariff'),otherRelevantCost:n('buyOther')},
   risk:{supplierReliabilityPercent:n('supplierReliability'),supplierLeadTimeDays:n('supplierLeadTime'),strategicCriticality:n('strategicCriticality'),supplierConcentrationRisk:n('supplierConcentration')}
  }
 };
}
const card=(a,b)=>'<div class="card"><span>'+a+'</span><strong>'+b+'</strong></div>';
function evaluate(){
 try{
  const p=payload(),r=evaluateMakeOrBuy(p.profile,p.input);last={...p,result:r};
  $('decision').className='decision '+r.recommendation.toLowerCase();
  $('decision').textContent=r.recommendation+' — '+r.signal;
  $('cards').innerHTML=[
   card('MAKE relevant cost',yen(r.make.relevantCost)),card('BUY relevant cost',yen(r.buy.relevantCost)),
   card('MAKE / 個',yen(r.make.costPerUnit)),card('BUY / 個',yen(r.buy.costPerUnit)),
   card('差額',yen(r.cheaperBy)),card('外注単価の損益分岐',yen(r.breakEvenSupplierUnitPrice)),
   card('除外した配賦固定費',yen(r.excludedAllocatedFixedCost))
  ].join('');
  $('resources').innerHTML=r.capacity.map(x=>'<tr><td>'+x.name+'</td><td>'+x.usedHours.toFixed(1)+' / '+x.capacityHours.toFixed(1)+'</td><td>+'+x.addedHours.toFixed(1)+'</td><td>'+x.afterHours.toFixed(1)+'</td><td>'+pct(x.afterUtilization)+'</td><td>'+(x.capacityBreach?'BREACH':'OK')+'</td></tr>').join('');
  $('risk').textContent=r.risk.qualitativeFlags.length?'非金銭リスク: '+r.risk.qualitativeFlags.join(' / '):'定性的な重大警告は入力条件上ありません。';
  $('assumptions').innerHTML=r.assumptions.map(x=>'<li>'+x+'</li>').join('');
 }catch(e){$('decision').className='decision hold';$('decision').textContent=e.message}
}
function save(){const p=payload();localStorage.setItem('make-or-buy-lab-inputs',JSON.stringify(p));$('decision').textContent='入力をこのブラウザに保存しました。'}
function restore(){try{const p=JSON.parse(localStorage.getItem('make-or-buy-lab-inputs')||'null');if(!p)return;
 const i=p.input||{},m=i.make||{},b=i.buy||{},r=i.risk||{},res=p.profile?.resources||[];
 const map={quantity:i.quantity,unavoidableAllocatedFixedCost:i.unavoidableAllocatedFixedCost,materialsPerUnit:m.materialsPerUnit,variableLaborPerUnit:m.variableLaborPerUnit,variableOverheadPerUnit:m.variableOverheadPerUnit,setupCost:m.setupCost,avoidableFixedCost:m.avoidableFixedCost,stepFixedCost:m.stepFixedCost,makeQuality:m.qualityReworkCost,internalLogistics:m.internalLogisticsCost,knownOpportunityCost:m.knownOpportunityCost,makeOther:m.otherRelevantCost,laborHours:m.resourceHours?.labor,machineHours:m.resourceHours?.machine,supplierUnitPrice:b.supplierUnitPrice,freightCost:b.freightCost,inspectionCost:b.inspectionCost,buyQuality:b.qualityReworkCost,switchingCost:b.switchingCost,importTariff:b.importTariff,buyOther:b.otherRelevantCost,supplierReliability:r.supplierReliabilityPercent,supplierLeadTime:r.supplierLeadTimeDays,strategicCriticality:r.strategicCriticality,supplierConcentration:r.supplierConcentrationRisk,laborCapacity:res.find(x=>x.id==='labor')?.capacityHours,laborUsed:res.find(x=>x.id==='labor')?.usedHours,machineCapacity:res.find(x=>x.id==='machine')?.capacityHours,machineUsed:res.find(x=>x.id==='machine')?.usedHours};
 for(const [id,v] of Object.entries(map))if(v!==undefined&&v!==null&&$(id))$(id).value=v;
 }catch{}}
function exportJson(){if(!last)evaluate();const blob=new Blob([JSON.stringify({...last,generatedAt:new Date().toISOString()},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='make-or-buy-result.json';a.click();URL.revokeObjectURL(a.href)}
$('evaluate').addEventListener('click',evaluate);$('save').addEventListener('click',save);$('export').addEventListener('click',exportJson);ids.forEach(id=>$(id)?.addEventListener('change',evaluate));restore();evaluate();
