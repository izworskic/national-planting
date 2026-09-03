(function(root,factory){const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;if(root)root.NationalPlantingEngine=api;})(typeof window!=="undefined"?window:globalThis,function(){
  const DAY=86400000;
  function noon(d){const x=new Date(d);x.setHours(12,0,0,0);return x}
  function addDays(d,n){if(!d||n==null)return null;const x=noon(d);x.setDate(x.getDate()+Number(n));return x}
  function diffDays(a,b){return Math.round((noon(a)-noon(b))/DAY)}
  function anchor(mmdd,year){if(!mmdd)return null;const [m,d]=String(mmdd).split("-").map(Number);return new Date(year,m-1,d,12,0,0)}
  function maturity(crop,override){const n=Number(override);return Number.isFinite(n)&&n>0?n:Number(crop?.maturity_days?.default||60)}
  function springDates(crop,springAnchor){const setout=crop.setout_offset_days==null?null:addDays(springAnchor,crop.setout_offset_days);return{indoor:setout&&crop.indoor_weeks!=null?addDays(setout,-7*crop.indoor_weeks):null,setout,direct:crop.direct_sow_offset_days==null?null:addDays(springAnchor,crop.direct_sow_offset_days)}}
  function fallLastViable(crop,fallAnchor,maturityOverride){if(!fallAnchor||crop.id==="garlic")return null;const run=Math.ceil(maturity(crop,maturityOverride)*Number(crop.fall_slowdown_factor||1.15))+Number(crop.fall_safety_days||7);return addDays(fallAnchor,-run)}
  function harvestWindow(crop,plantDate,maturityOverride,lateSeason){if(!plantDate)return null;const base=maturity(crop,maturityOverride);const factor=lateSeason?Number(crop.fall_slowdown_factor||1):1;const start=addDays(plantDate,Math.ceil(base*factor));const span=crop.harvest_style&&crop.harvest_style!=="single"?Math.max(14,Math.round(base*.45)):10;return{start,end:addDays(start,span)}}
  function nextSuccession(crop,startDate,today,lastViable){if(!crop.succession_interval_days||!startDate)return null;let next=noon(startDate),guard=0;while(next<=noon(today)&&guard++<80)next=addDays(next,crop.succession_interval_days);if(lastViable&&next>lastViable)return null;return next}
  function onionFit(crop,lat){if(!crop.photoperiod||!Number.isFinite(Number(lat)))return null;const a=Math.abs(Number(lat));if(a>=crop.photoperiod.long_day_min_lat)return"Long-day onions are the safest fit at this latitude; day-neutral cultivars can also work.";if(a<=crop.photoperiod.short_day_max_lat)return"Short-day onions fit this latitude; day-neutral cultivars can also work.";return"This latitude is a transition band: day-neutral onions are the simplest fit; check cultivar day-length class before buying seed."}
  function heatMode(lat,fallAnchor){const a=Math.abs(Number(lat));return !fallAnchor||a<29?"heat-limited":a<34?"long-season":"frost-limited"}
  function actionFor(crop,ctx){const today=noon(ctx.today||new Date()),spring=ctx.springAnchor?springDates(crop,ctx.springAnchor):{indoor:null,setout:null,direct:null};const lastFall=fallLastViable(crop,ctx.fallAnchor,ctx.maturityOverride?.[crop.id]);const freeze=ctx.freezeLevel;
    const events=[spring.indoor&&{type:"start indoors",date:spring.indoor},spring.direct&&{type:"direct sow",date:spring.direct},spring.setout&&{type:"transplant",date:spring.setout}].filter(Boolean);
    const due=events.filter(e=>Math.abs(diffDays(today,e.date))<=7);
    let primary=due[0]||null;
    if(crop.season==="warm"&&(freeze==="freeze"||freeze==="hard-freeze")&&primary&&primary.type!=="start indoors")primary={type:"hold outdoors",date:primary.date,reason:"A freeze remains in the 7-day forecast."};
    const springStart=spring.direct||spring.setout||spring.indoor;
    const next=nextSuccession(crop,springStart,today,lastFall);
    const fallPlant=lastFall?addDays(lastFall,-Math.max(0,Number(crop.succession_interval_days||14))):null;
    const harvest=harvestWindow(crop,(primary&&primary.date)||next||fallPlant,ctx.maturityOverride?.[crop.id],!!(fallPlant&&today>=fallPlant));
    return{crop,spring,lastFall,nextSuccession:next,primary,harvest,soilGate:crop.soil_temp_min_f?`Do not direct sow below about ${crop.soil_temp_min_f}°F soil; optimum ${crop.soil_temp_opt_f?.[0]}–${crop.soil_temp_opt_f?.[1]}°F.`:null,heatGate:crop.heat_caution_f?`Growth/quality becomes less reliable around ${crop.heat_caution_f}°F${crop.bolting_risk?"; bolting risk rises":""}.`:null,onionFit:onionFit(crop,ctx.latitude)}
  }
  function classifyNow(rows,ctx){const today=noon(ctx.today||new Date());const out={plant:[],start:[],transplant:[],succession:[],fall:[]};for(const r of rows){if(r.primary?.type==="direct sow")out.plant.push(r);if(r.primary?.type==="start indoors")out.start.push(r);if(r.primary?.type==="transplant")out.transplant.push(r);if(r.nextSuccession&&Math.abs(diffDays(r.nextSuccession,today))<=14)out.succession.push(r);if(r.lastFall&&diffDays(r.lastFall,today)>=0&&diffDays(r.lastFall,today)<=70)out.fall.push(r)}return out}
  function build(crops,ctx){const rows=crops.map(c=>actionFor(c,ctx));return{mode:heatMode(ctx.latitude,ctx.fallAnchor),rows,now:classifyNow(rows,ctx)}}
  return{addDays,diffDays,anchor,maturity,springDates,fallLastViable,harvestWindow,nextSuccession,onionFit,heatMode,actionFor,build};
});
