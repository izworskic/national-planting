/* Shared view for three locally resolved, source-aware fall decisions. */
(function(){
 "use strict";
 const N=window.NationalTools,E=window.GardenFallDecisions;
 if(!N||!E)return;
 const mode=document.body.dataset.decision;
 const form=document.querySelector("#place"),controls=document.querySelector("#decision-controls");
 const output=document.querySelector("#decision-output"),status=document.querySelector("#location-status");
 const observed=document.querySelector("#source-strip");
 let loc=null,feed=null,request=0;
 const make=(tag,text,cls)=>{const v=document.createElement(tag);v.textContent=text;if(cls)v.className=cls;return v;};
 function asInputs(){
   const v={};
   controls.querySelectorAll("select,input").forEach(el=>{v[el.id]=el.value;});
   return v;
 }
 function zoneText(c){return c.hardinessZone===null?"Not available":String(c.hardinessZone)+" (ZIP-area estimate)";}
 function fmtDate(ms,zone){
   if(ms===null||!Number.isFinite(ms))return "No ≤36°F hour in the available forecast";
   try{return new Intl.DateTimeFormat("en-US",{timeZone:zone,month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(ms));}
   catch(_){return "Check latest hourly forecast";}
 }
 function render(){
   if(!loc)return;
   let answer;
   try{answer=E[mode](asInputs(),feed,new Date());}
   catch(_){output.replaceChildren(make("p","Unable to calculate this decision from the current data. Please review your inputs.","notice"));output.hidden=false;return;}
   const c=answer.context;output.hidden=false;output.replaceChildren();
   const head=make("div","YOUR GARDEN VERDICT · "+answer.code.replaceAll("_"," "),"decision-flag");
   const title=make("h2",answer.title);
   const lead=make("p",answer.lead,"decision-lead");
   output.append(head,title,lead);
   const taskTitle=make("h3","What to do next");
   const list=document.createElement("ol");answer.actions.forEach(t=>list.appendChild(make("li",t)));
   output.append(taskTitle,list);
   const exp=make("h3","How the evidence affects this answer");const ul=document.createElement("ul");
   answer.why.forEach(t=>ul.appendChild(make("li",t)));
   output.append(exp,ul);
   observed.hidden=false;observed.replaceChildren();
   const metrics=[
     ["NWS hourly forecast",c.forecastState==="CURRENT"?"Current":c.forecastState==="UNAVAILABLE"?"Unavailable":"Stale / incomplete"],
     ["Next ≤36°F forecast hour",c.forecastState==="CURRENT"?fmtDate(c.nextFrostRiskAt,c.timeZone):"Not established"],
     ["NOAA median first air freeze",c.medianFirstAirFreeze||"Unavailable"],
     ["USDA hardiness zone",zoneText(c)]
   ];
   metrics.forEach(([label,value])=>{
     const item=document.createElement("div");item.className="metric";
     item.append(make("span",label),make("strong",value));observed.appendChild(item);
   });
   if(typeof window.gtag==="function")window.gtag("event","autumn_garden_verdict",{tool:mode,verdict:answer.code,has_current_nws:c.forecastState==="CURRENT"});
 }
 async function choose(place){
   loc=place;feed=null;const current=++request;
   controls.hidden=false;output.hidden=true;observed.hidden=true;
   status.textContent="Checking NOAA / NWS conditions for "+N.label(place)+"…";
   try{
     const lat=Number(place.latitude),lon=Number(place.longitude);
     if(!Number.isFinite(lat)||!Number.isFinite(lon))throw Error("No coordinates");
     const q=new URLSearchParams({lat:String(lat),lon:String(lon)});
     if(/^\d{5}$/.test(place.postcode||""))q.set("zip",place.postcode);
     const res=await fetch("/api/national-frost?"+q.toString(),{signal:AbortSignal.timeout(16000)});
     if(!res.ok)throw Error("NOAA/NWS service unavailable");
     const data=await res.json();if(current!==request)return;feed=data;
     status.textContent=N.label(place)+" · "+(data.degraded?"Partial official climate/forecast evidence":"Official climate and weather context checked");
   }catch(_){
     if(current!==request)return;
     status.textContent=N.label(place)+" · Official frost source unavailable. This tool will label unknown forecast conditions explicitly.";
   }
   render();
 }
 controls.addEventListener("input",render);
 N.bind(form,choose);
 const q=new URLSearchParams(window.location.search).get("q");
 if(q){const input=form.querySelector("input");input.value=q;form.requestSubmit();}
})();