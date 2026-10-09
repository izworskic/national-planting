(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.GardenAutumn=api;})(typeof window!=="undefined"?window:null,function(){
"use strict";
const value=x=>x==null||x===""?null:Number.isFinite(Number(x))?Number(x):null;
function context(f,date){
 let month;try{month=Number(new Intl.DateTimeFormat("en-US",{month:"numeric",timeZone:f?.location?.timeZone||"America/New_York"}).format(date));}catch(_){month=date.getUTCMonth()+1;}
 const zone=String(f?.hardiness_zone?.zone||"").match(/^\d+/);
 return {month,zone:zone?Number(zone[0]):null,medianAirFreeze:f?.climate_normals?.dates?.fall_50?.mmdd||null,forecast:Boolean(f?.current_forecast?.periods)};
}
function garlic(i,f,date=new Date()){
 const c=context(f,date),soil=value(i.soil),frozen=i.workable==="frozen",workable=i.workable==="workable";
 let code="CHECK",heading="Check your bed before planting",why=[];
 if(frozen){code="HOLD";heading="Ground frozen: do not plant cloves";why.push("Wait for workable soil; never force cloves into frozen ground.");}
 else if(c.month>=3&&c.month<=8){code="WAIT";heading="Plan for fall garlic planting";why.push("Prepare well-drained beds for the autumn root establishment period.");}
 else if(c.month<=2||(c.month===12&&c.zone!==null&&c.zone<8)){code="LATE";heading="Late for usual fall root establishment";why.push("Workable ground may permit planting, but late rooting can reduce bulb performance.");}
 else if(soil!==null&&soil>=70&&c.month<=10){code="WAIT";heading="Warm soil: reassess as autumn cools";why.push("Wait for cooler fall soil unless local extension guidance recommends planting now.");}
 else if(c.month===9&&soil===null){code="CHECK";heading="Check soil temperature and local autumn timing";why.push("September can be early; air temperatures cannot substitute for measured soil conditions.");}
 else {code=workable?"PLANT":"CHECK";heading=workable?"Plant garlic now while soil is workable":"Plant if your bed remains workable";why.push("Aim to establish roots before the ground freezes, approximately three weeks in many colder-region guidelines. This tool does not predict ground-freeze date.");}
 if(c.zone!==null&&c.zone>=8)why.push("Mild-winter climates may plant later; select garlic varieties with suitable chilling needs.");
 why.push(i.kind==="softneck"?"Softneck garlic is frequently selected for milder winters; verify your cultivar.":"Hardneck garlic is commonly selected for colder winters; verify your cultivar.");
 why.push("Plant individual cloves with points upward in drained soil and follow local guidance on depth and mulch.");
 if(c.medianAirFreeze)why.push("Nearest NOAA median first AIR freeze: "+c.medianAirFreeze+". This is not the date soil freezes.");
 else why.push("NOAA first-freeze normals unavailable; no ground-freeze date is inferred.");
 return {code,heading,why,context:c,soilMeasured:soil!==null};
}
function bulbs(i,f,date=new Date()){
 const c=context(f,date),soil=value(i.soil),frozen=i.workable==="frozen",workable=i.workable==="workable";
 const type=["tulip","daffodil","crocus","hyacinth","allium"].includes(i.type)?i.type:"tulip";
 let code="CHECK",heading="Measure soil temperature at planting depth",why=[];
 if(frozen){code="HOLD";heading="Ground frozen: outdoor planting on hold";why.push("Do not force bulbs into frozen ground. Consider local guidance on containers, storage, or forcing.");}
 else if(c.month>=3&&c.month<=8){code="WAIT";heading="Fall is the usual spring-flowering bulb season";why.push("Spring bulb forcing is a different process from normal outdoor autumn planting.");}
 else if(soil!==null&&soil>60){code="WAIT";heading="Soil is too warm for routine bulb planting";why.push("Wait until soil cools to approximately 50–55°F or below, before ground freezing.");}
 else if(soil!==null){code=workable?"PLANT":"CHECK";heading=workable?"Plant while cool ground is workable":"Cool soil: confirm the ground is workable";why.push("Measured soil is cool enough; the full planting depth must remain workable.");}
 else if(workable&&[11,12,1,2].includes(c.month)){code="CHECK";heading="Bed workable: confirm soil temperature and plant promptly";why.push("Air frosts do not establish whether your soil is in the preferred bulb planting range.");}
 else {code="CHECK";heading="Measure soil before planting";why.push("University of Wisconsin Extension recommends approximately 50–55°F soil, before ground freezing.");}
 if(!frozen&&c.zone!==null&&c.zone>=8&&(type==="tulip"||type==="hyacinth")&&i.chilling!=="yes"){
  code="CHILL";heading="Review bulb prechilling requirements first";why.unshift("Mild winters can lack enough chilling for reliable "+type+" flowers. Confirm the specific cultivar's prechilling requirement with the supplier.");
 }
 if(c.zone!==null&&c.zone>=8)why.push("In mild climates, spring bulb performance depends on species, cultivar and available winter chill.");
 why.push("Follow species-specific bulb depth and spacing; use well-drained soil and avoid waterlogging.");
 if(c.medianAirFreeze)why.push("NOAA median first AIR freeze: "+c.medianAirFreeze+". This is not a measurement of soil-freeze timing.");
 return {code,heading,why,context:c,soilMeasured:soil!==null};
}
return {garlic,bulbs,context};
});