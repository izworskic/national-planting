/* U.S. fall-garden decision rules: separates NWS forecasts, NOAA averages and user observations. */
(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.GardenFallDecisions=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const HOURS=3600000,DAY=24*HOURS;
 const n=x=>(x===null||x===undefined||x==="")?null:Number.isFinite(Number(x))?Number(x):null;
 function local(now,zone){
   const d=new Date(now);
   try{
     const p=new Intl.DateTimeFormat("en-US",{timeZone:zone,year:"numeric",month:"numeric",day:"numeric"}).formatToParts(d);
     const o=Object.fromEntries(p.filter(x=>x.type!=="literal").map(x=>[x.type,Number(x.value)]));
     return {year:o.year,month:o.month,day:o.day};
   }catch(_){return {year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate()};}
 }
 function daysUntil(mmdd,date){
   const m=/^(\d{2})-(\d{2})$/.exec(String(mmdd||""));
   if(!m)return null;
   const mo=Number(m[1]),day=Number(m[2]);
   const dst=new Date(Date.UTC(date.year,mo-1,day));
   if(dst.getUTCMonth()!==mo-1||dst.getUTCDate()!==day)return null;
   return Math.round((dst.getTime()-Date.UTC(date.year,date.month-1,date.day))/DAY);
 }
 function context(feed,now){
   const zone=feed?.location?.timeZone||"America/New_York";
   const today=local(now,zone);
   const avg=feed?.climate_normals?.dates?.fall_50?.mmdd||null;
   const zoneValue=String(feed?.hardiness_zone?.zone||"").match(/^(\d+)/);
   const hardiness=zoneValue?Number(zoneValue[1]):null;
   const updated=Date.parse(feed?.current_forecast?.updated_at||"");
   const fresh=Number.isFinite(updated)&&updated<=now.getTime()+HOURS&&now.getTime()-updated<=12*HOURS;
   const hasPeriods=Array.isArray(feed?.current_forecast?.periods)&&feed.current_forecast.periods.length>0;
   const hours=fresh&&hasPeriods?feed.current_forecast.periods
     .map(p=>{const raw=n(p.temp_f);return {time:Date.parse(p.time),temp:raw===null?null:(p.unit==="C"?raw*9/5+32:raw)};})
     .filter(p=>Number.isFinite(p.time)&&p.temp!==null&&p.time>=now.getTime()-2*HOURS&&p.time<=now.getTime()+7*DAY):[];
   const alert=hours.filter(x=>x.temp<=36).sort((a,b)=>a.time-b.time)[0]||null;
   const freeze=hours.filter(x=>x.temp<=32).sort((a,b)=>a.time-b.time)[0]||null;
   const hard=hours.filter(x=>x.temp<=28).sort((a,b)=>a.time-b.time)[0]||null;
   return {
     timeZone:zone,today,month:today.month,medianFirstAirFreeze:avg,
     daysToMedianAirFreeze:daysUntil(avg,today),hardinessZone:hardiness,
     stationMiles:n(feed?.climate_normals?.distance_miles),
     forecastState:hours.length?"CURRENT":(hasPeriods?"STALE_OR_INVALID":"UNAVAILABLE"),
     nextFrostRiskAt:alert?.time||null,nextFreezeAt:freeze?.time||null,nextHardFreezeAt:hard?.time||null,
     nextFrostRiskHours:alert?Math.max(0,Math.round((alert.time-now.getTime())/HOURS)):null,
     low7d:hours.length?Math.min(...hours.map(x=>x.temp)):null,
     forecastUpdated:feed?.current_forecast?.updated_at||null
   };
 }
 function notes(c){
   const arr=[];
   if(c.medianFirstAirFreeze)arr.push("NOAA historical median first AIR freeze: "+c.medianFirstAirFreeze+" at the nearest usable station"+(c.stationMiles!=null?", "+Math.round(c.stationMiles)+" miles from the selected place":"")+". This is not a forecast, nor the date garden soil freezes.");
   else arr.push("NOAA historical first-freeze estimate unavailable; no freeze date is assumed.");
   if(c.forecastState!=="CURRENT")arr.push("Live NWS hourly forecast is missing or stale. We cannot say frost is absent or that the upcoming night is safe.");
   else if(c.nextFrostRiskAt===null)arr.push("NWS has no hour at or below 36°F in its currently returned seven-day hours. Local cold pockets and leaves may run colder.");
   else arr.push("An NWS hour at or below 36°F is forecast within "+c.nextFrostRiskHours+" hours. This is a conservative frost-risk screen, not a measured leaf temperature.");
   return arr;
 }
 function result(code,title,lead,actions,c,explain=[]){return {code,title,lead,actions,why:[...explain,...notes(c)],context:c};}
 function tomatoes(input,feed,now=new Date()){
   const c=context(feed,now),s=["flower","small","mature","breaker","colored"].includes(input.stage)?input.stage:"mature";
   const risk=c.nextFrostRiskHours!==null&&c.nextFrostRiskHours<=72;
   const freeze7=c.nextFrostRiskAt!==null;
   const median=c.daysToMedianAirFreeze;
   const turning=["breaker","colored"].includes(s),mature=s==="mature",early=s==="flower"||s==="small";
   if(risk){
     const steps=turning?["Pick tomatoes showing color before the cold night; they can finish ripening indoors.","Protect remaining plants only if you can cover them properly."]:
       mature?["Pick fully sized mature-green fruit before frost; arrange indoors in one layer at room temperature.","Inspect for the pale star or whitening at the blossom end; immature green fruit may never ripen well."]:
       ["Harvest any colored or fully mature-green fruit on the plant.","Flowers and small immature green fruit are unlikely to ripen indoors to good quality. Consider using them green only when appropriate."];
     if(input.cover==="yes")steps.push("A secured frost cloth can buy time in light frost, but cannot guarantee protection from a hard freeze.");
     return result("HARVEST","Act before the forecast cold night",turning?"Fruit that has begun coloring can usually finish indoors.":mature?"Mature-green tomatoes can sometimes ripen indoors; check maturity.":"Your newest fruit has a high frost-loss risk.",steps,c,["University of Minnesota Extension advises bringing fruit indoors when frost threatens; fruit that is truly immature often disappoints."]);
   }
   if(freeze7&&early)return result("LOW_CHANCE","New fruit is at risk this week","The next seven days contain a possible frost, and flowers or small fruit generally need substantially more warm growing time.",["Keep harvesting fruit that has already begun coloring.","Recheck the forecast daily rather than assuming that a cover will extend the season enough for new fruit."],c);
   if(early&&median!==null&&median<=21&&c.month>=7&&c.month<=12)return result("LOW_CHANCE","Limited time for new tomatoes to ripen","The historical first-freeze midpoint is close, but this is not the predicted freeze date.",["Prioritize existing mature fruit instead of depending on flowers or small green fruit.","If your microclimate stays warm longer, some fruit may continue developing; monitor nightly lows."],c);
   if(turning)return result("PROMISING","Already coloring: good ripening potential","Turning tomatoes can ripen indoors even if autumn weather changes.",["Leave fruit on the plant while conditions are favorable and monitor upcoming cold nights.","Move coloring fruit indoors before frost, and keep it in one layer at room temperature."],c);
   if(mature)return result("MONITOR","Mature-green fruit: watch the next cold nights","Fully sized, mature-green tomatoes may finish indoors but readiness is not guaranteed by size alone.",["Look for a white or pale star at the blossom end, or an early blush of color.","If frost approaches, pick mature-green fruit and ripen it indoors. Avoid refrigerating unripe tomatoes."],c);
   return result("UNCERTAIN","New fruit needs more warm growing time","No exact ripening date can be inferred from a flower or small green fruit.",["Monitor fruit development and the seven-day cold forecast.","Use the variety's maturity information as broad context, not as a guaranteed countdown for individual fruit."],c);
 }
 function dahlias(input,feed,now=new Date()){
   const c=context(feed,now),foliage=["green","frosted","dead"].includes(input.foliage)?input.foliage:"green";
   const setting=input.setting==="pot"?"pot":"ground",soil=input.soil||"unknown",drainage=input.drainage||"unknown";
   if(setting==="pot")return result("MOVE_POT","Protect or move your potted dahlia","Containers expose tubers to colder air than surrounding ground.",["Move the container to a frost-free sheltered place before a hard freeze.","If storing dormant tubers, follow extension curing and storage guidance; do not let them freeze."],c);
   if(soil==="frozen")return result("GROUND_FROZEN","Ground already frozen: avoid forcing the clump","Frozen soil risks tuber breakage and may already have damaged the tubers.",["Try digging after a safe thaw if possible; do not pry frozen clumps apart.","For future seasons in cold climates, dig before persistent soil freezing."],c);
   const cold=c.hardinessZone!==null&&c.hardinessZone<=7;
   const warm=c.hardinessZone!==null&&c.hardinessZone>=8;
   if(warm&&drainage==="good"&&foliage==="green"&&c.nextHardFreezeAt===null&&c.forecastState==="CURRENT")
     return result("OPTION","In-ground overwintering may be an option","Mild-winter, well-drained gardens can sometimes leave dahlias in place, but winter survival is not guaranteed.",["Mulch according to local guidance and keep water from pooling at the crown.","If the plants are valuable, lift and store some tubers as insurance."],c,["USDA hardiness zone describes extreme winter cold, not your exact tuber survival conditions."]);
   if(foliage==="frosted"||foliage==="dead"){
     return result(cold||drainage==="wet"?"DIG":"CONSIDER_DIG",cold?"Dig and store the tubers":"Assess whether to lift the tubers","Frost-damaged tops indicate the outdoor growing season is ending.",["Lift gently before the soil freezes solid, keeping the crown and tuber necks intact.","Allow to dry appropriately and store above freezing; inspect for rot or desiccation over winter."],c,["Penn State Extension notes that growers may wait until after foliage is frost damaged to dig, but waiting for first frost is not essential."]);
   }
   if(drainage==="wet")return result("DIG","Wet soil increases winter rot risk","Even in a relatively mild zone, prolonged wet winter soil can destroy tubers.",["Consider lifting tubers while the soil is workable, especially if winter is cold.","Keep lifted tubers frost-free and dry enough to prevent rot, without allowing severe shriveling."],c);
   if(cold&&(c.nextFrostRiskAt!==null||[10,11,12].includes(c.month)))
     return result("PREPARE","Prepare to dig before persistent freezing","Dahlias are not reliably winter-hardy outdoors in colder zones, regardless of whether foliage is still green.",["You do not need to wait for a killing frost if a hard freeze is approaching.","Dig while the bed is workable and follow local tuber curing/storage instructions."],c);
   if(c.hardinessZone===null)return result("CHECK_ZONE","Winter-survival context is missing","The USDA zone lookup did not return a result. No survival assumption is made.",["Check local extension guidance and drainage before considering in-ground overwintering.","In climates with freezing soils, lift and store valuable tubers."],c);
   return result("WATCH","Watch foliage, drainage and approaching cold","A green dahlia may keep flowering while frost-free weather holds; overwintering depends on zone and drainage.",["Check the overnight weather forecast and your garden's first frost exposure.","Decide whether to lift before persistent freezing, or try in-ground overwintering only where locally appropriate."],c);
 }
 const species={
   rye:{name:"Winter rye (cereal rye)",family:"cold_grass",window:"late",winter:"survives"},
   wheat:{name:"Winter wheat",family:"cold_grass",window:"mid",winter:"survives"},
   oats:{name:"Oats",family:"early",window:"early",winter:"winterkills"},
   radish:{name:"Forage radish",family:"early",window:"early",winter:"winterkills"},
   crimson:{name:"Crimson clover",family:"legume",window:"mid",winter:"variable"},
   vetch:{name:"Hairy vetch",family:"legume",window:"mid",winter:"survives"},
   buckwheat:{name:"Buckwheat",family:"summer",window:"summer",winter:"winterkills"}
 };
 function coverCrop(input,feed,now=new Date()){
   const c=context(feed,now),crop=species[input.species]||species.rye;
   const soil=n(input.soil),ground=input.ground||"unknown",days=c.daysToMedianAirFreeze;
   const warmRegion=c.hardinessZone!==null&&c.hardinessZone>=8;
   if(ground==="frozen")return result("GROUND_FROZEN","Soil frozen: do not broadcast into a frozen bed","Seeds need seed-to-soil contact and suitable temperatures to establish.",["Look for a workable thaw or wait for an appropriate later seeding season.","A frozen-ground broadcast is not equivalent to reliable establishment."],c);
   if(input.bed==="occupied")return result("CLEAR_BED","Finish the current crop before sowing","Planting a cover crop requires seed-to-soil contact; underseeding requires a different management plan.",["Clear, prepare and sow the bed first; recheck seasonal timing after it's available.","Avoid damaging roots of plants you intend to keep."],c);
   if(crop.family==="summer"&&([9,10,11,12,1,2].includes(c.month)||c.nextFrostRiskAt!==null))
     return result("TOO_LATE_FOR_SPECIES","Not a good autumn choice for buckwheat","Buckwheat is a warm-season cover crop that frost can kill; sowing in cold autumn soil is unlikely to deliver useful cover.",["Consider winter rye for a late-season erosion-control goal.","Reserve buckwheat for a warm, frost-free gap in the growing season."],c);
   if(!warmRegion&&crop.window==="early"&&((days!==null&&days<=28&&c.month>=8)||c.month>=11)){
     return result("LATE_FOR_SPECIES","Too late for reliable fall growth of "+crop.name,"This species needs meaningful warm-season establishment before winter; median air frost timing is an imperfect proxy.",["Use winter rye if your main goal is cover rather than a deep radish root or large oat canopy.","Confirm your local extension's seeding cutoff before buying seed."],c);
   }
   if(!warmRegion&&crop.window==="mid"&&((days!==null&&days<=14&&c.month>=8)||c.month>=12)){
     return result("LATE_FOR_SPECIES","Limited establishment time for "+crop.name,"A very late fall seeding can germinate without building useful fall growth.",["Winter rye is generally the more reliable late-fall alternative.","A legume's spring nitrogen benefit cannot be assumed from an insufficient fall stand."],c);
   }
   if(soil!==null&&soil<35){
     return result("CHECK_SOIL","Measured soil is very cold for germination","You reported an unusually low bed-temperature reading; cold soils slow or stop germination.",["Confirm the reading at seed depth and check species-specific local extension guidance.","Do not treat above-freezing AIR forecasts as proof the seedbed is warm enough."],c);
   }
   if(crop.window==="late"&&c.month>=10&&c.month<=12&&ground==="workable"){
     return result("POSSIBLE","Winter rye may still be possible","Winter rye is among the latest-planted reliable fall cover crops, but late sowing yields less fall biomass.",["Sow into a prepared, workable bed with seed-to-soil contact and adequate moisture.","Plan to terminate the rye before spring vegetable planting; mature rye residues can temporarily tie up nitrogen."],c,["This tool does not infer germination temperatures from air forecasts."]);
   }
   if(c.month>=3&&c.month<=6&&crop.window==="late"){
     return result("PLAN_FALL","Plan fall seeding or choose a spring cover crop","The main fall rye establishment window has not arrived.",["If growing an early vegetable crop, research spring cover crop alternatives before seeding.","Coordinate cover crop termination with spring planting."],c);
   }

   const actions=[
     "Seed into a weed-free, prepared bed while soil is workable and moisture is available.",
     crop.winter==="winterkills"?"This species is often winterkilled in cold climates; meaningful fall growth is needed to deliver benefits.":"If it survives winter, plan spring termination so it does not compete with the next crop."
   ];
   if(crop.family==="legume")actions.push("Legume nitrogen benefits depend on inoculation, establishment, and adequate growth; they are not guaranteed.");
   if(c.month>=8&&c.month<=11)return result("CONDITIONAL","Seeding "+crop.name+" may fit this fall","Local cultivar, soil moisture, seedbed preparation, and autumn duration determine establishment.",actions,c);
   return result("REVIEW_SEASON","Check the crop's normal seeding season","This crop needs a suitable warm or cool season; this model cannot certify an arbitrary planting date.",actions,c);
 }
 return {context,tomatoes,dahlias,coverCrop,local,daysUntil};
});