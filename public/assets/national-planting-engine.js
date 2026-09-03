(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.NationalPlantingEngine=api;
})(typeof window!=="undefined"?window:globalThis,function(){
  const DAY=86400000;
  const PROTECTION={
    none:{id:"none",label:"Open garden",extensionDays:0},
    "row-cover":{id:"row-cover",label:"Row cover / frost blanket",extensionDays:7},
    "low-tunnel":{id:"low-tunnel",label:"Low tunnel / cold frame",extensionDays:14}
  };

  function noon(d){const x=new Date(d);x.setHours(12,0,0,0);return x}
  function addDays(d,n){if(!d||n==null)return null;const x=noon(d);x.setDate(x.getDate()+Number(n));return x}
  function diffDays(a,b){return Math.round((noon(a)-noon(b))/DAY)}
  function anchor(mmdd,year){if(!mmdd)return null;const [m,d]=String(mmdd).split("-").map(Number);return new Date(year,m-1,d,12,0,0)}
  function asNum(v){if(v==null||v==="")return null;const n=Number(v);return Number.isFinite(n)?n:null}
  function maturity(crop,override){const n=asNum(override);return n&&n>0?n:Number(crop?.maturity_days?.default||60)}
  function harvestMode(crop,id){return(crop.harvest_modes||[]).find(x=>x.id===id)||null}
  function harvestDays(crop,override,modeId="full"){
    if(modeId==="full")return maturity(crop,override);
    const mode=harvestMode(crop,modeId);return Number(mode?.days||maturity(crop,override));
  }
  function methodDays(crop,method,override,modeId="full"){
    if(modeId!=="full"){
      const mode=harvestMode(crop,modeId);
      if(mode?.method_days?.[method]!=null)return Number(mode.method_days[method]);
      if(mode?.days!=null){
        if(method==="indoor")return Number(crop.indoor_weeks||0)*7+Number(mode.method_days?.transplant||mode.days);
        return Number(mode.days);
      }
    }
    const custom=asNum(override);
    const directDefault=Number(crop.method_days?.direct||crop.maturity_days?.default||60);
    const transplantDefault=Number(crop.method_days?.transplant||crop.maturity_days?.default||60);
    if(method==="indoor")return Number(crop.indoor_weeks||0)*7+(custom||transplantDefault);
    if(custom)return custom;
    if(crop.method_days?.[method]!=null)return Number(crop.method_days[method]);
    return method==="transplant"?transplantDefault:directDefault;
  }
  function springDates(crop,springAnchor){
    const setout=crop.setout_offset_days==null?null:addDays(springAnchor,crop.setout_offset_days);
    return{indoor:setout&&crop.indoor_weeks!=null?addDays(setout,-7*crop.indoor_weeks):null,setout,direct:crop.direct_sow_offset_days==null?null:addDays(springAnchor,crop.direct_sow_offset_days)};
  }
  function methodSpringDate(crop,method,springAnchor){const s=springDates(crop,springAnchor);return method==="indoor"?s.indoor:method==="transplant"?s.setout:s.direct}
  function forecastRange(currentForecast){
    const vals=(currentForecast?.periods||[]).map(p=>{const t=asNum(p.temp_f);if(t==null)return null;return String(p.unit||"F").toUpperCase()==="C"?t*9/5+32:t}).filter(v=>v!=null);
    if(!vals.length)return{min:null,max:null};return{min:Math.round(Math.min(...vals)),max:Math.round(Math.max(...vals))};
  }
  function seasonFactor(crop,today,fallAnchor){if(!fallAnchor)return 1;return diffDays(fallAnchor,today)<=120?Number(crop.fall_slowdown_factor??1.15):1}
  function heatMode(lat,fallAnchor){const a=Math.abs(Number(lat));return!fallAnchor||a<29?"heat-limited":a<34?"long-season":"frost-limited"}
  function onionFit(crop,lat){
    if(!crop.photoperiod||!Number.isFinite(Number(lat)))return null;
    const a=Math.abs(Number(lat));
    if(a>=crop.photoperiod.long_day_min_lat)return"Long-day onions are the safest fit at this latitude; day-neutral cultivars can also work.";
    if(a<=crop.photoperiod.short_day_max_lat)return"Short-day onions fit this latitude; day-neutral cultivars can also work.";
    return"This latitude is a transition band: day-neutral onions are the simplest fit; check cultivar day-length class before buying seed.";
  }
  function protectionProfile(crop,mode="none"){
    const p=PROTECTION[mode]||PROTECTION.none;
    if(crop?.season!=="cool")return{...PROTECTION.none,requested:p.id,applies:false};
    return{...p,requested:p.id,applies:p.id!=="none"};
  }
  function protectedSpringDate(crop,method,ctx){
    const base=methodSpringDate(crop,method,ctx.springAnchor);
    if(!base||method==="indoor")return base;
    const p=protectionProfile(crop,ctx.protectionMode);
    return p.extensionDays?addDays(base,-p.extensionDays):base;
  }
  function coldDeadline(crop,fallAnchor,protectionMode="none"){
    if(!fallAnchor||crop.calendar_rule==="garlic")return null;
    const p=protectionProfile(crop,protectionMode);
    return addDays(fallAnchor,Number(crop.cold_extension_days||0)+Number(p.extensionDays||0));
  }
  function fallLastViable(crop,fallAnchor,maturityOverride,method,protectionMode="none"){
    if(!fallAnchor||crop.calendar_rule==="garlic")return null;
    const m=method||((crop.sow_methods||[]).includes("direct")?"direct":(crop.sow_methods||[]).includes("transplant")?"transplant":"indoor");
    const run=Math.ceil(methodDays(crop,m,maturityOverride,"full")*Number(crop.fall_slowdown_factor??1.15))+Number(crop.fall_safety_days??7);
    return addDays(coldDeadline(crop,fallAnchor,protectionMode),-run);
  }
  function latestStart(crop,ctx,method,modeId="full"){
    if(crop.calendar_rule==="garlic"){
      if(!ctx.fallAnchor)return null;
      return addDays(ctx.fallAnchor,Number(crop.fall_window_end_offset_days||14));
    }
    if(crop.season==="cool"&&heatMode(ctx.latitude,ctx.fallAnchor)!=="frost-limited")return null;
    const deadline=coldDeadline(crop,ctx.fallAnchor,ctx.protectionMode);
    if(!deadline)return null;
    const days=Math.ceil(methodDays(crop,method,ctx.maturityOverride?.[crop.id],modeId)*Number(crop.fall_slowdown_factor??1.15))+Number(crop.fall_safety_days??7);
    return addDays(deadline,-days);
  }
  function harvestWindow(crop,plantDate,maturityOverride,lateSeason,method="direct",modeId="full"){
    if(!plantDate)return null;
    const base=methodDays(crop,method,maturityOverride,modeId),factor=lateSeason?Number(crop.fall_slowdown_factor||1):1;
    const start=addDays(plantDate,Math.ceil(base*factor));
    const style=modeId==="full"?crop.harvest_style:harvestMode(crop,modeId)?.harvest_style;
    const span=style&&style!=="single"?Math.max(10,Math.round(base*.35)):7;
    return{start,end:addDays(start,span),mode:modeId};
  }
  function garlicWindow(crop,ctx){
    if(!ctx.fallAnchor)return{state:"regional",start:null,end:null};
    const start=addDays(ctx.fallAnchor,Number(crop.fall_window_start_offset_days||-30)),end=addDays(ctx.fallAnchor,Number(crop.fall_window_end_offset_days||14)),t=noon(ctx.today||new Date());
    return{state:t<start?"upcoming":t>end?"closed":"open",start,end};
  }
  function protectionNote(crop,ctx){
    const p=protectionProfile(crop,ctx.protectionMode);
    if(!p.applies)return null;
    return p.id==="row-cover"
      ?"Row-cover mode uses a conservative one-week planning extension for cool crops. Actual frost protection varies by fabric and weather."
      :"Low-tunnel/cold-frame mode uses a conservative two-week planning extension for cool crops. Vent on warm sunny days and monitor temperatures.";
  }
  function evaluateMethod(crop,method,ctx){
    if(!(crop.sow_methods||[]).includes(method))return null;
    const today=noon(ctx.today||new Date()),override=ctx.maturityOverride?.[crop.id],spring=protectedSpringDate(crop,method,ctx),range=forecastRange(ctx.currentForecast),soil=asNum(ctx.soilTempF),p=protectionProfile(crop,ctx.protectionMode);
    if(crop.calendar_rule==="garlic"){
      const g=garlicWindow(crop,ctx);
      return{method,state:g.state==="open"?"go":g.state==="upcoming"?"upcoming":"done",reason:g.state==="open"?"Traditional fall planting window is open.":g.state==="upcoming"?"Fall garlic window has not opened yet.":"Typical fall garlic window has passed.",earliest:g.start,latest:g.end,projectedHarvest:null,marginDays:g.end?diffDays(g.end,today):null,harvestMode:"full",protectionMode:p.id};
    }
    const climateMode=heatMode(ctx.latitude,ctx.fallAnchor);
    if(spring&&today<addDays(spring,-7)&&!(crop.season==="cool"&&climateMode!=="frost-limited"))return{method,state:"early",reason:"This method is still earlier than its normal spring window.",earliest:spring,latest:latestStart(crop,ctx,method),projectedHarvest:null,marginDays:null,harvestMode:"full",protectionMode:p.id};

    if(method!=="indoor"&&crop.season==="warm"&&(ctx.freezeLevel==="freeze"||ctx.freezeLevel==="hard-freeze"))return{method,state:"blocked",block:"freeze",reason:"A freeze appears in the 7-day forecast.",earliest:spring,latest:latestStart(crop,ctx,method),projectedHarvest:null,marginDays:null,harvestMode:"full",protectionMode:p.id};

    const kill=asNum(crop.kill_temp_f);
    if(method!=="indoor"&&kill!=null&&range.min!=null&&range.min<=kill)return{method,state:"blocked",block:"cold-threshold",reason:`The 7-day forecast reaches about ${range.min}°F, at or below this crop's modeled injury threshold near ${kill}°F. Protection mode does not override an actual kill-threshold forecast.`,earliest:spring,latest:latestStart(crop,ctx,method),projectedHarvest:null,marginDays:null,harvestMode:"full",protectionMode:p.id};

    if(method==="direct"&&soil!=null&&crop.soil_temp_min_f!=null&&soil<Number(crop.soil_temp_min_f))return{method,state:"blocked",block:"soil",reason:`Soil is ${soil}°F; this crop is safer to direct sow around ${crop.soil_temp_min_f}°F or warmer.`,earliest:spring,latest:latestStart(crop,ctx,method),projectedHarvest:null,marginDays:null,harvestMode:"full",protectionMode:p.id};

    const fullLatest=latestStart(crop,ctx,method,"full"),factor=seasonFactor(crop,today,ctx.fallAnchor);
    let selectedMode="full",latest=fullLatest;
    if(fullLatest&&today>fullLatest){
      const alternatives=(crop.harvest_modes||[]).filter(x=>x.id!=="full").slice().sort((a,b)=>Number(a.days)-Number(b.days));
      const alt=alternatives.find(x=>{const l=latestStart(crop,ctx,method,x.id);return l&&today<=l});
      if(alt){selectedMode=alt.id;latest=latestStart(crop,ctx,method,alt.id)}
      else return{method,state:"done",reason:"Not enough cold-season runway remains for this method.",earliest:spring,latest:fullLatest,projectedHarvest:null,marginDays:fullLatest?diffDays(fullLatest,today):null,harvestMode:"full",protectionMode:p.id};
    }

    let heatState=null;
    if(range.max!=null&&crop.heat_stop_f!=null&&range.max>=Number(crop.heat_stop_f))heatState="stop";
    else if(range.max!=null&&crop.heat_caution_f!=null&&range.max>=Number(crop.heat_caution_f))heatState="caution";
    if(crop.season==="cool"&&method!=="indoor"&&heatState==="stop"){
      const margin=latest?diffDays(latest,today):null;
      if(ctx.temporaryShade){heatState="managed"}
      else if(margin==null||margin>10)return{method,state:"blocked",block:"heat",reason:`The 7-day forecast reaches about ${range.max}°F, above this crop's reliable cool-season establishment window.`,earliest:spring,latest,projectedHarvest:null,marginDays:margin,harvestMode:selectedMode,protectionMode:p.id};
    }

    const run=Math.ceil(methodDays(crop,method,override,selectedMode)*factor),harvest=addDays(today,run),margin=latest?diffDays(latest,today):null,limited=selectedMode!=="full",lastChance=margin!=null&&margin<=7;
    let state=limited?"limited":["caution","managed"].includes(heatState)?"caution":"go";
    if(lastChance&&!limited)state="last-chance";
    const mode=selectedMode==="full"?null:harvestMode(crop,selectedMode);
    const reason=limited
      ?`Full maturity is too late, but ${mode?.label||selectedMode} is still realistic.`
      :lastChance
        ?`This is near the last viable ${method} window.`
        :heatState==="managed"
          ?`The forecast reaches about ${range.max}°F. Temporary shade can help establishment, but ambient heat is still high; monitor moisture and seedlings closely.`
          :heatState==="caution"
            ?`Viable, but the 7-day forecast reaches about ${range.max}°F; use a season-suited cultivar and protect from heat stress.`
            :"Enough seasonal runway remains.";
    return{method,state,reason,earliest:spring,latest,projectedHarvest:harvest,marginDays:margin,harvestMode:selectedMode,forecastMaxF:range.max,forecastMinF:range.min,protectionMode:p.id,temporaryShade:Boolean(ctx.temporaryShade)};
  }
  function bestOutdoor(evals){
    const rank={go:6,"last-chance":5,limited:4,caution:3,blocked:1,early:0,done:-1,upcoming:0};
    return evals.filter(x=>x&&x.method!=="indoor").sort((a,b)=>(rank[b.state]??-9)-(rank[a.state]??-9))[0]||null;
  }
  function nextSuccession(crop,startDate,today,lastViable){
    if(!crop.succession_interval_days||!startDate)return null;
    let next=noon(startDate),guard=0;while(next<=noon(today)&&guard++<80)next=addDays(next,crop.succession_interval_days);
    if(lastViable&&next>lastViable)return null;return next;
  }
  function successionFromToday(crop,ctx,best){
    if(!crop.succession_interval_days||!best||!["go","last-chance","limited","caution"].includes(best.state))return null;
    const next=addDays(ctx.today||new Date(),crop.succession_interval_days),latest=latestStart(crop,{...ctx,today:next},best.method,best.harvestMode||"full");
    if(latest&&next>latest)return null;
    return{date:next,intervalDays:Number(crop.succession_interval_days),method:best.method,note:"If you plant now, this is the next repeat-sowing target if weather still fits."};
  }
  function actionFor(crop,ctx){
    const spring=ctx.springAnchor?springDates(crop,ctx.springAnchor):{indoor:null,setout:null,direct:null};
    const evaluations=(crop.sow_methods||[]).map(m=>evaluateMethod(crop,m,ctx)).filter(Boolean),best=bestOutdoor(evaluations),indoor=evaluations.find(x=>x.method==="indoor")||null,transplant=evaluations.find(x=>x.method==="transplant")||null,direct=evaluations.find(x=>x.method==="direct")||null;
    const fallDirect=(crop.sow_methods||[]).includes("direct")?fallLastViable(crop,ctx.fallAnchor,ctx.maturityOverride?.[crop.id],"direct",ctx.protectionMode):null;
    const fallTransplant=(crop.sow_methods||[]).includes("transplant")?fallLastViable(crop,ctx.fallAnchor,ctx.maturityOverride?.[crop.id],"transplant",ctx.protectionMode):null;
    const succession=successionFromToday(crop,ctx,best);
    const chosen=best&&["go","last-chance","limited","caution"].includes(best.state)?best:(indoor&&["go","last-chance","limited","caution"].includes(indoor.state)?indoor:null);
    const harvest=chosen?.projectedHarvest?harvestWindow(crop,ctx.today||new Date(),ctx.maturityOverride?.[crop.id],seasonFactor(crop,ctx.today||new Date(),ctx.fallAnchor)>1,chosen.method,chosen.harvestMode):null;
    return{crop,spring,evaluations,best,direct,transplant,indoor,lastFall:fallDirect||fallTransplant,fallDirect,fallTransplant,nextSuccession:succession?.date||null,succession,harvest,soilGate:crop.soil_temp_min_f?`Direct sow at about ${crop.soil_temp_min_f}°F soil or warmer; optimum ${crop.soil_temp_opt_f?.[0]}–${crop.soil_temp_opt_f?.[1]}°F.`:null,heatGate:crop.heat_caution_f?`Quality or establishment becomes less reliable around ${crop.heat_caution_f}°F${crop.bolting_risk?"; bolting risk rises":""}.`:null,onionFit:onionFit(crop,ctx.latitude),protectionNote:protectionNote(crop,ctx)};
  }
  function relayOptions(row,rows,ctx){
    if(!row.harvest?.start)return[];
    const harvestDate=row.harvest.start,ids=row.crop.follow_with||[],map=new Map(rows.map(r=>[r.crop.id,r.crop])),out=[];
    for(const id of ids){
      const crop=map.get(id);if(!crop)continue;
      const future={...ctx,today:harvestDate,currentForecast:null,soilTempF:null};
      const ev=(crop.sow_methods||[]).map(m=>evaluateMethod(crop,m,future)).filter(x=>x&&["go","last-chance","limited","caution"].includes(x.state));
      const pick=bestOutdoor(ev)||ev.find(x=>x.method==="indoor");
      if(pick)out.push({crop,method:pick.method,state:pick.state,harvestMode:pick.harvestMode,date:harvestDate});
      if(out.length>=3)break;
    }
    return out;
  }
  function classifyNow(rows){
    const out={direct:[],transplant:[],indoor:[],lastCall:[],fall:[],succession:[]};
    for(const r of rows){
      if(r.direct&&["go","caution","last-chance","limited"].includes(r.direct.state))out.direct.push(r);
      if(r.transplant&&["go","caution","last-chance","limited"].includes(r.transplant.state))out.transplant.push(r);
      if(r.indoor&&["go","caution","last-chance","limited"].includes(r.indoor.state))out.indoor.push(r);
      if([r.direct,r.transplant,r.indoor].some(x=>x&&["last-chance","limited"].includes(x.state)))out.lastCall.push(r);
      if(r.crop.season==="cool"&&r.best&&["go","caution","last-chance","limited"].includes(r.best.state))out.fall.push(r);
      if(r.succession)out.succession.push(r);
    }
    const urgency=r=>{const vals=[r.direct,r.transplant,r.indoor].filter(Boolean).map(x=>x.marginDays).filter(x=>x!=null);return vals.length?Math.min(...vals):999};
    for(const k of Object.keys(out))out[k].sort((a,b)=>urgency(a)-urgency(b)||a.crop.name.localeCompare(b.crop.name));
    return out;
  }
  function build(crops,ctx){
    const rows=crops.map(c=>actionFor(c,ctx));for(const r of rows)r.relays=relayOptions(r,rows,ctx);
    const range=forecastRange(ctx.currentForecast),p=PROTECTION[ctx.protectionMode]||PROTECTION.none;
    return{mode:heatMode(ctx.latitude,ctx.fallAnchor),forecast:range,rows,now:classifyNow(rows),context:{soilTempF:asNum(ctx.soilTempF),freezeLevel:ctx.freezeLevel||"unknown",protectionMode:p.id,protectionLabel:p.label,temporaryShade:Boolean(ctx.temporaryShade)}};
  }
  return{addDays,diffDays,anchor,maturity,harvestDays,methodDays,springDates,methodSpringDate,forecastRange,seasonFactor,protectionProfile,protectedSpringDate,coldDeadline,fallLastViable,latestStart,harvestWindow,onionFit,heatMode,garlicWindow,evaluateMethod,nextSuccession,successionFromToday,actionFor,relayOptions,build};
});
