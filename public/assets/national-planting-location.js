(function(root){
  "use strict";

  function esc(value){
    return String(value ?? "").replace(/[&<>"']/g,function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }

  function label(loc){
    if(loc?.place&&loc?.stateCode)return loc.place+", "+loc.stateCode;
    if(loc?.displayName)return String(loc.displayName).split(",").slice(0,2).join(",");
    if(loc?.postcode)return String(loc.postcode);
    return "your location";
  }

  async function readJson(response,fallback){
    const text=await response.text();
    let data=null;
    try{data=text?JSON.parse(text):null}catch(_){data=null}
    if(!response.ok){
      const detail=data?.error||data?.detail||((fallback||"Request failed")+" · HTTP "+response.status);
      throw new Error(detail);
    }
    if(!data)throw new Error(fallback||"Location lookup unavailable");
    return data;
  }

  async function fetchWithRetry(url,options){
    let response=await fetch(url,options);
    if([502,503,504].includes(response.status)){
      await new Promise(function(resolve){setTimeout(resolve,650)});
      response=await fetch(url,options);
    }
    return response;
  }

  async function geocode(query){
    const q=String(query||"").trim();
    if(!q)throw new Error("Enter a U.S. city or ZIP code");
    const response=await fetchWithRetry("./api/national-geocode?q="+encodeURIComponent(q));
    return readJson(response,"Location lookup unavailable");
  }

  async function reverseGeocode(latitude,longitude){
    const lat=Number(Number(latitude).toFixed(3));
    const lon=Number(Number(longitude).toFixed(3));
    const response=await fetchWithRetry("./api/national-geocode",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({latitude:lat,longitude:lon})
    });
    return readJson(response,"Current location lookup unavailable");
  }

  async function deviceLocation(){
    if(!navigator.geolocation)throw new Error("This browser does not support device location");
    const position=await new Promise(function(resolve,reject){
      navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,timeout:10000,maximumAge:300000});
    }).catch(function(error){
      if(error?.code===1)throw new Error("Location permission was not granted");
      if(error?.code===2)throw new Error("Your location could not be determined");
      if(error?.code===3)throw new Error("Location lookup timed out");
      throw new Error("Your browser could not provide a location");
    });
    return reverseGeocode(position.coords.latitude,position.coords.longitude);
  }

  function bind(form,onLocation){
    if(!form)return;
    const input=form.querySelector("input");
    const button=form.querySelector(".btn");
    const geoButton=form.querySelector("[data-use-location]");
    const status=form.parentElement?.querySelector(".status");

    form.addEventListener("submit",async function(event){
      event.preventDefault();
      const q=String(input?.value||"").trim();
      if(!q){if(status)status.textContent="Enter a U.S. city or ZIP code.";return}
      if(button)button.disabled=true;
      if(status)status.textContent="Finding "+q+"…";
      try{
        const loc=await geocode(q);
        if(status)status.textContent=label(loc);
        await onLocation(loc);
      }catch(error){
        if(status)status.innerHTML='<span class="error">'+esc(error?.message||"Location lookup unavailable")+'</span>';
      }finally{
        if(button)button.disabled=false;
      }
    });

    if(geoButton){
      if(!navigator.geolocation)geoButton.hidden=true;
      else geoButton.addEventListener("click",async function(){
        geoButton.disabled=true;
        if(status)status.textContent="Using your device location…";
        try{
          const loc=await deviceLocation();
          if(input)input.value=loc.query||label(loc);
          if(status)status.textContent=label(loc);
          await onLocation(loc);
        }catch(error){
          if(status)status.innerHTML='<span class="error">'+esc(error?.message||"Location lookup unavailable")+'</span>';
        }finally{
          geoButton.disabled=false;
        }
      });
    }
  }

  root.NationalPlantingLocation={esc,label,geocode,reverseGeocode,deviceLocation,bind};
})(window);
