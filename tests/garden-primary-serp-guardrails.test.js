const test=require("node:test");const assert=require("node:assert/strict");const fs=require("node:fs");const path=require("node:path");
test("primary gardening tool obeys 1M impressions snippet and canonical rules",()=>{
 const html=fs.readFileSync(path.join(__dirname,"..","public/national-tools/planting/index.html"),"utf8");
 const title=html.match(/<title>([^<]+)<\/title>/)?.[1];
 const desc=html.match(/<meta name="description" content="([^"]+)"/)?.[1];
 assert.ok(title&&title.length<=60&&title.includes("Chris Izworski"),"title <=60 and byline");
 assert.ok(desc&&desc.length<=158,"description <=158");
 assert.ok(html.includes('rel="canonical" href="https://chrisizworski.com/national-tools/planting/"'),"single canonical");
 assert.match(html,/https:\/\/chrisizworski\.com\/#person/);
});
