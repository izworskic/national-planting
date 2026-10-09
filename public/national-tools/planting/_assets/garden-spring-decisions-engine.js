/* Specialized garden decisions based on extension guidance and current NOAA/NWS context. */
(function(root,factory){
 const result=factory(typeof module==="object"&&module.exports?require("./garden-fall-decisions-engine.js"):root.GardenFallDecisions);
 if(typeof module==="object"&&module.exports)module.exports=result;
 if(root)root.GardenFallDecisions=Object.assign({},root.GardenFallDecisions||{},result);
})(typeof window!=="undefined"?window:null,function(core){
 "use strict";
 if(!core||typeof core.context!=="function")throw Error("Shared garden forecast context missing");
 const pick=(o,keys,def)=>keys.includes(o)?o:def;
 const num=(x,min,max)=>x===""||x===null||x===undefined?null:Number.isFinite(Number(x))&&Number(x)>=min&&Number(x)<=max?Number(x):null;
 const notes=c=>[
   c.forecastState==="CURRENT"?"Hourly NWS data available; forecast temperatures are grid estimates, not measured plant/soil temperatures.":"Current NWS hourly forecast is missing, stale or incomplete; no safe-weather claim is made.",
   c.medianFirstAirFreeze?"NOAA median first AIR freeze: "+c.medianFirstAirFreeze+". A historical probability is not a predicted date.":"NOAA median air freeze unavailable."
 ];
 const output=(code,title,lead,actions,c,why=[])=>({code,title,lead,actions,context:c,why:[...why,...notes(c)]});
 const types={
  panicle:{name:"Panicle / Limelight / Quick Fire",wood:"new"},
  smooth:{name:"Smooth / Annabelle / Incrediball",wood:"new"},
  bigleaf:{name:"Bigleaf / mophead / lacecap",wood:"old"},
  oakleaf:{name:"Oakleaf",wood:"old"},
  mountain:{name:"Mountain / serrata",wood:"old"},
  climbing:{name:"Climbing hydrangea",wood:"old"},
  rebloom:{name:"Confirmed reblooming bigleaf",wood:"both"}
 };
 function pruneHydrangea(input,feed,now=new Date()){
   const c=core.context(feed,now),type=types[input.type]||null,kind=pick(input.goal,["size","blooms","cleanup"],"blooms");
   const season=c.month,trim=input.bloom==="finished",winter=[10,11,12,1,2].includes(season),lateDormant=[2,3,4].includes(season);
   const earlyAfterBloom=season>=5&&season<=7&&trim;
   if(input.goal==="cleanup"&&input.damaged==="yes")
     return output("SANITIZE","Remove confirmed dead, broken or diseased stems only","Selective sanitation is different from cutting back healthy buds.",["Make clean cuts back to healthy wood; disinfect tools when managing disease.","Do not remove healthy branches on an unidentified or old-wood hydrangea just to tidy the outline."],c);
   if(!type)return output("IDENTIFY_FIRST","Identify your hydrangea before pruning","Pruning schedules differ radically between species; guessing can remove next year’s flower buds.",["Look for cone-shaped panicle heads, snowball-like smooth blooms, or bigleaf/oakleaf/mountain characteristics.","Find the botanical name on a plant label or ask your local extension service, then return for a species-specific decision."],c);
   if(type.wood==="old"||type.wood==="both"){
     if(earlyAfterBloom&&type.wood==="old"&&kind==="size")
       return output("PRUNE_LIGHTLY","Limited shaping may fit after flowering","Old-wood hydrangeas set next year’s buds later in summer; early post-bloom shaping is generally safest.",["Remove only the stems needed for shaping, ideally before August in northern climates.","Avoid severe cutting; leave most healthy canes and next season’s potential flower buds.","For mountain, oakleaf, climbing and bigleaf species, confirm local timing with extension advice."],c,["Old-wood hydrangeas carry next season’s buds on last season’s stems."]);
     if(type.wood==="both"&&earlyAfterBloom&&kind==="size")
       return output("LIGHT_OPTION","Reblooming plants allow limited early shaping","Confirmed rebloomers can flower on both older and current-season growth, but heavy pruning still reduces the next flush.",["Trim minimally after bloom, avoiding severe reduction.","Preserve healthy stems for the strongest next-year display."],c);
     if(winter||season>=8||lateDormant)
       return output("DONOT_PRUNE","Do not cut back healthy stems now","You could remove flower buds already formed on old growth.",["Leave healthy branches and dormant buds untouched.","Remove definitely dead or broken wood only after confirming it is not simply dormant.","If necessary, schedule limited shaping immediately after flowering next summer."],c,["Bigleaf, mountain, oakleaf and climbing hydrangeas normally flower from buds carried on older stems.",type.wood==="both"?"Rebloomers can flower on new stems too, but aggressive pruning may still sacrifice the first display.":""]);
     return output("WAIT_FOR_BLOOM","Wait for the plant to finish blooming","The safest regular pruning window for old-wood varieties is shortly after bloom, before next year’s buds develop.",["Let current blooms finish before any size-related shaping.","If the plant has not bloomed or its cultivar is uncertain, postpone major pruning."],c);
   }
   if(type.wood==="new"){
     if(lateDormant&&kind==="size")
       return output("PRUNE_NOW","Late winter or early spring is a good pruning window","Panicle and established smooth hydrangeas bloom on new growth, so dormant-season shaping usually preserves summer flowers.",["For panicle types, shorten branches to sturdy buds, preserving a strong framework.","For smooth types, prune only as hard as needed; established shrubs tolerate stronger rejuvenation.","Do not force a drastic cut on an immature or weak plant."],c,["University of Minnesota Extension favors dormant or spring pruning for these new-wood types."]);
     if(lateDormant)
       return output("OPTIONAL","Pruning is optional for healthy shrubs","New-wood hydrangeas do not require annual heavy pruning to bloom.",["Leave an established plant alone if size and structure work.","Remove clearly dead or damaged stems; prune for shape before growth accelerates."],c);
     if(winter)
       return output("WAIT_UNTIL_SPRING","Prefer late winter or early spring for shaping","These new-wood hydrangeas can be pruned in other dormant periods, but leaving dry blooms and stems through winter is often useful.",["Mark the plant for late-winter pruning before new growth begins.","For now, remove only hazardous broken wood, if present."],c);
     if(season>=5&&season<=9)
       return output("AVOID_MAJOR_CUTS","Avoid major pruning during active growth or bloom","Heavy cutting now removes the current season’s developing or present flowers.",["Deadhead spent flowers lightly if desired.","Plan structural pruning for next dormant season."],c);
   }
   return output("CHECK_TIMING","Confirm pruning timing locally","The best choice depends on cultivar, condition and local seasonal development.",["Avoid drastic cuts without species identification."],c);
 }
 const seeds={
  peas:{name:"Peas",minimum:40,preferred:45,type:"cool",warning:"Soil above 40°F may allow emergence, but very cold saturated soil slows germination."},
  spinach:{name:"Spinach",minimum:40,preferred:45,type:"cool",warning:"Very warm soil can inhibit spinach germination."},
  lettuce:{name:"Lettuce",minimum:40,preferred:50,type:"cool",warning:"Soil heat above 85°F can suppress germination for some lettuces."},
  radish:{name:"Radishes",minimum:40,preferred:50,type:"cool",warning:"Radishes can germinate in cool soil; hot soil may hurt root quality."},
  carrots:{name:"Carrots",minimum:40,preferred:50,type:"cool",warning:"Carrots can take longer to germinate in low soil temperatures."},
  beets:{name:"Beets",minimum:45,preferred:50,type:"cool",warning:"A thermometer at seed depth is more useful than daily air highs."},
  beans:{name:"Bush and pole beans",minimum:60,preferred:65,type:"warm",warning:"Beans often rot in cold, soggy ground. Avoid sowing into soil below 60°F."},
  sweetcorn:{name:"Sweet corn (standard)",minimum:60,preferred:65,type:"warm",warning:"Sweet corn has cultivar-specific germination requirements; supersweet may require warmer soil."},
  cucumbers:{name:"Cucumbers",minimum:60,preferred:65,type:"warm",warning:"Cold wet soil risks seed rot; 60°F is a minimum practical screen, not the optimum."},
  squash:{name:"Summer and winter squash",minimum:60,preferred:65,type:"warm",warning:"Warm soils improve emergence; cold waterlogged soil risks seed rot."},
  melons:{name:"Melons",minimum:65,preferred:70,type:"warm",warning:"Melons generally need warmer soil than most cool-season crops."}
 };
 function soilReadiness(input,feed,now=new Date()){
   const c=core.context(feed,now),crop=seeds[input.crop]||seeds.beans;
   const measured=num(input.soil,0,120),state=pick(input.ground,["saturated","wet","crumbly","dry","frozen"],"unknown");
   const forecast=c.forecastState==="CURRENT",risk=c.nextFrostRiskHours!==null&&c.nextFrostRiskHours<=72;
   if(state==="frozen")return output("DO_NOT_SOW","Frozen ground: planting must wait","Seeds need seed-to-soil contact and favorable moisture and temperature.",["Recheck after the bed thaws and is workable.","Measure soil temperature at actual sowing depth."],c);
   if(state==="saturated")return output("DO_NOT_SOW","The seedbed is too wet to work","Soggy, compacted soil can rot seed and harm structure even when it is warm enough.",["Wait until soil crumbles instead of smearing or sticking when squeezed.","Improve drainage; never use air temperature alone to judge readiness."],c);
   if(measured===null)return output("MEASURE_SOIL","Measure the soil before you plant "+crop.name.toLowerCase(),"No measured soil temperature was entered, so an evidence-based germination verdict cannot be issued.",["Measure at seeding depth in the morning for several days.","Do not substitute today's air high or a regional map for your garden-bed temperature.","Enter the measured reading and moisture condition for a specific verdict."],c,["Crop-specific planning screen: at least "+crop.minimum+"°F in the seedbed; warmer conditions often improve speed."]);
   if(measured<crop.minimum)return output("WAIT_FOR_WARMTH","Soil is below the "+crop.minimum+"°F planting screen","You reported "+measured+"°F, which is colder than the practical germination threshold for "+crop.name.toLowerCase()+".",["Wait for a warmer measured soil trend before direct-seeding.","Check the seed packet's variety-specific requirements, especially for corn and melons."],c,[crop.warning]);
   if(state==="dry")return output("FIX_MOISTURE","Soil is warm enough but lacks moisture","You measured "+measured+"°F, but very dry seedbeds may prevent reliable germination.",["Moisten the sowing zone evenly and keep it from crusting or drying out.","Recheck temperature and moisture after watering; do not flood the bed."],c,[crop.warning]);
   if(state==="unknown")return output("CHECK_MOISTURE","Temperature passes; verify the seedbed is workable","Measured "+measured+"°F is above the threshold for "+crop.name.toLowerCase()+", but moisture and soil structure were not confirmed.",["Squeeze a handful of soil. It should crumble instead of forming a muddy smear.","Recheck a morning soil temperature at sowing depth.","Proceed only when the bed is neither waterlogged nor excessively dry."],c,[crop.warning]);
   if(crop.type==="warm"&&risk)return output("FROST_RISK","Soil is warm, but a cold night threatens warm-season emergence","Temperature is at or above the seedbed screen, yet a possible frost appears in the next 72 hours.",["Delay tender crop sowing or plan safe frost protection after emergence.","Check the NWS forecast near the sowing site daily; soil warmth alone cannot protect tender shoots."],c,[crop.warning]);
   if(measured<crop.preferred)return output("MARGINAL","Plantable but near the cool end of the range","Measured "+measured+"°F meets the minimum for "+crop.name.toLowerCase()+" but emergence could still be slow.",["If sowing now, expect slower or uneven germination and monitor soil wetness.","Consider waiting for steadier warmth for more reliable emergence."],c,[crop.warning]);
   return output("READY_CONDITIONAL","Seedbed temperature and condition fit "+crop.name.toLowerCase(),"Measured "+measured+"°F passes the conservative temperature screen and you marked the bed workable.",["Sow according to seed packet depth and spacing.","Monitor real soil moisture and the forecast, especially after heavy rainfall.","This decision covers seedbed readiness, not calendar suitability or varietal day length."],c,[crop.warning]);
 }
 function hardeningOff(input,feed,now=new Date()){
   const c=core.context(feed,now);
   const crop=pick(input.crop,["warm","cool","flower"],"warm");
   const day=num(input.day,0,14);const condition=pick(input.exposure,["shade","partial","sun","wind"],"shade");
   const tender=crop==="warm"||crop==="flower",minimum=tender?45:36;
   const daytime=(c.forecastState==="CURRENT"&&c.low7d!==null);
   const imminent=c.nextFrostRiskHours!==null&&c.nextFrostRiskHours<=48;
   if(day===null)return output("NEED_PROGRESS","Which hardening-off day are you on?","Gradual exposure is essential, and elapsed acclimation time changes a safe plan.",["Choose the number of days you have been moving seedlings outdoors, starting at zero.","Start with a protected, shaded few hours during mild weather."],c);
   if(day===0)return output("START_SHADED","Start with a brief sheltered outing","Indoor seedlings have not yet adapted to outdoor UV, breeze or temperature changes.",["Place in bright shade sheltered from strong wind for roughly 1–2 hours on a mild day.","Bring seedlings indoors before evening temperatures drop.","Keep seed trays watered but avoid waterlogged soil."],c,["University of Minnesota Extension recommends gradually increasing sun and outdoor time over about two weeks."]);
   if(condition==="wind")return output("SHELTER_FIRST","Strong wind: use shelter, not an endurance test","Young seedlings can lose moisture and sustain mechanical damage in wind, even if temperatures are mild.",["Move them to a sheltered porch or cold frame with ventilation.","Resume more exposed conditions gradually as stems and leaves strengthen."],c);
   if(imminent)return output("PROTECT_FROM_FROST","Forecast frost risk: bring seedlings in","An NWS hour at or below 36°F occurs within the next 48 hours; containers may cool rapidly.",["Bring tender trays indoors before cold weather.","If seedlings are outdoors in a cold frame, ensure a suitable frost-free temperature; a cover is not a guarantee.","Resume gradual exposure when the immediate cold risk passes."],c);
   if(c.forecastState!=="CURRENT")return output("VERIFY_LOCAL_FORECAST","Forecast unavailable: do not assume outdoor nights are safe","The source is stale or unavailable. Gradual shade exposure can be planned, but safety depends on current local conditions.",["Check current overnight temperature and wind independently.","Keep seedlings indoors overnight until cold risk is verified.","Return when live hourly weather data are available."],c);
   if(tender&&c.low7d!==null&&c.low7d<minimum)return output("DAYTIME_ONLY","Keep tender seedlings indoors overnight","The seven-day forecast contains lows below "+minimum+"°F; many warm-season seedlings can be stressed before freezing.",["Use brief sheltered daytime outings during warm weather, followed by indoor nights.","Build tolerance gradually without exposing tender plants to frost or chilling.","Check the forecast daily for safer transplant weather."],c);
   if(day<=3)return output("SHADE_STAGE","Increase protected outdoor time gradually","You are in the first days of hardening off; direct midday sun can scorch leaves.",["Aim for a few hours of dappled light, then return indoors overnight.","Add short intervals of gentle morning sun and shelter from strong wind."],c);
   if(day<=7)return output(condition==="sun"?"REDUCE_SUN":"ADD_SUN_GRADUALLY",condition==="sun"?"Ease back from full sun":"Add morning sun in stages","The middle of hardening off should build light and wind tolerance without sudden all-day full-sun exposure.",["Extend outdoor time gradually and expose plants to a little more sun each day.","Move back to shelter if leaves bleach, wilt persistently or wind dries containers.","Keep tender transplants in at night until night temperatures are reliably suitable."],c);
   if(day<=11)return output("NEARLY_HARDENED","Continue extended outdoor days","Plants have had multiple days to acclimate, but overnight temperatures and crop tolerance still matter.",["Try longer daylight exposure and check leaves for sunburn or wind stress.","Only leave plants outside overnight if the weather is reliably suitable for that crop.","Transplant in late afternoon or cloudy conditions when the bed and weather are suitable."],c);
   return output("READY_TO_ASSESS","Hardening period complete; assess transplant conditions","Around two weeks of gradual exposure can prepare many transplants, but soil readiness and local cold risk still gate planting.",["Transplant on a calm, overcast day or late afternoon after confirming suitable soil temperature.","Protect new transplants from unusual sun, wind, and late frost.","If plants show stress, slow down rather than moving directly to full exposure."],c);
 }
 return {pruneHydrangea,soilReadiness,hardeningOff,seeds,types};
});