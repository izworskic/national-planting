'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../public/assets/national-planting-page-v3.js','utf8');
const snippet=source.slice(source.indexOf('  let michiganRequest=0;'),source.indexOf('  async function run(loc){'));
function el(){return {children:[],textContent:'',append(...x){this.children.push(...x)},replaceChildren(...x){this.children=x;this.textContent=''}}}
function setup(fetch){const root=el(),context={fetch,byId:()=>root,document:{createElement:el,createTextNode:s=>({textContent:s})},encodeURIComponent};vm.createContext(context);vm.runInContext(snippet+';globalThis.load=loadMichiganGuidance;',context);return {root,load:context.load}}
test('Michigan contract loads source guidance while other states never request it',async()=>{
 let calls=0;const x=setup(async url=>{calls++;assert.match(url,/place=48706/);return {ok:true,json:async()=>({version:'1.0',station:'Bay City',crops:[{name:'Garlic',code:'PLAN_GARLIC',detail:'Before hard freeze'}],limitation:'Planning reference'})}});
 await x.load({stateCode:'MI',postcode:'48706'});assert.equal(calls,1);assert.equal(x.root.children[0].textContent,'Michigan garden guidance · Bay City');assert.match(x.root.children[2].children[0].children[1].textContent,/hard freeze/);
 await x.load({stateCode:'WI',postcode:'53703'});assert.equal(calls,1);assert.equal(x.root.children.length,0);
});
test('failed or incompatible contracts fail gracefully and stale responses do not overwrite a new location',async()=>{
 let resolve;const x=setup(()=>new Promise(r=>{resolve=r}));const first=x.load({stateCode:'MI',postcode:'48706'});await x.load({stateCode:'WI',postcode:'53703'});resolve({ok:true,json:async()=>({version:'1.0',station:'Bay City',crops:[]})});await first;assert.equal(x.root.children.length,0);
 const y=setup(async()=>({ok:true,json:async()=>({version:'2.0',station:'Bay City',crops:[]})}));await y.load({stateCode:'MI',place:'Bay City'});assert.match(y.root.textContent,/unavailable/);
});
