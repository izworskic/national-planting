(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.NationalPlantingSeasonYears=api;
})(typeof window!=="undefined"?window:globalThis,function(){
  function noon(d){const x=new Date(d);x.setHours(12,0,0,0);return x}
  function fromMMDD(mmdd,year){if(!mmdd)return null;const [m,d]=String(mmdd).split("-").map(Number);if(!(m>=1&&m<=12&&d>=1&&d<=31))return null;return new Date(year,m-1,d,12,0,0)}
  function daysBetween(a,b){return Math.round((noon(a)-noon(b))/86400000)}
  function resolve(springMMDD,fallMMDD,todayInput){
    const today=noon(todayInput||new Date()),year=today.getFullYear();
    let spring=fromMMDD(springMMDD,year),fall=fromMMDD(fallMMDD,year),springYear=year,fallYear=year;
    if(spring&&fall&&today>fall){springYear=year+1;spring=fromMMDD(springMMDD,springYear)}
    else if(spring&&!fall&&today>spring&&daysBetween(today,spring)>180){springYear=year+1;spring=fromMMDD(springMMDD,springYear)}
    return{spring,fall,springYear,fallYear,rolledSpring:springYear!==year};
  }
  return{fromMMDD,resolve};
});
