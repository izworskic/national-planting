(function(){"use strict";const E=window.GardenAutumn,N=window.NationalTools,mode=document.body.dataset.mode;
const form=document.querySelector("#place"),controls=document.querySelector("#controls"),output=document.querySelector("#output"),status=document.querySelector("#status");
let loc=null,forecast=null,sequence=0;
const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
function render(){if(!loc)return;
const x=E[mode]({soil:document.querySelector("#soil").value,workable:document.querySelector("#workable").value,kind:document.querySelector("#kind")?.value,type:document.querySelector("#type")?.value,chilling:document.querySelector("#chilling")?.value},forecast,new Date());
output.hidden=false;output.replaceChildren();
const badge=el("span",x.code);badge.className="badge";const h=el("h2",x.heading);
const p=el("p","Confidence: conditional • "+(x.context.forecast?"NWS forecast available":"Forecast unavailable")+" • Soil temperature: "+(x.soilMeasured?"gardener measurement":"not measured"));p.className="muted";
const ul=document.createElement("ul");x.why.forEach(t=>ul.appendChild(el("li",t)));output.append(badge,h,p,ul);
if(window.gtag)gtag("event","gardening_decision",{mode:mode,verdict:x.code,measured_soil:x.soilMeasured});}
async function onPlace(location){loc=location;forecast=null;const n=++sequence;controls.hidden=false;output.hidden=true;
status.textContent="Checking NOAA and NWS near "+N.label(location)+"…";
try{const q=new URLSearchParams({lat:String(location.latitude),lon:String(location.longitude)});
if(/^\d{5}$/.test(location.query||""))q.set("zip",location.query);
const r=await fetch("/api/national-frost?"+q.toString(),{signal:AbortSignal.timeout(16000)});
if(!r.ok)throw Error("Source unavailable");const data=await r.json();if(n!==sequence)return;
forecast=data;status.textContent=N.label(location)+" · "+(data.degraded?"Partial official weather data":"Official weather context available");
}catch(_){if(n!==sequence)return;status.textContent=N.label(location)+" · Live weather unavailable. Answer is based on the soil information you supply.";}render();}
controls.addEventListener("input",render);N.bind(form,onPlace);
const q=new URLSearchParams(location.search).get("q");if(q){form.querySelector("input").value=q;form.requestSubmit();}
})();