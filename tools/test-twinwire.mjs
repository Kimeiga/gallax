import assert from 'node:assert/strict';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import WebSocket from 'ws';
import {EventClient} from 'twinwire/client';
import CONTRACT from '../geckos-server/src/contract.json' with {type:'json'};
const reserve=net.createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const rtc=process.env.TEST_RTC==='1',base='http://127.0.0.1:'+port;
if(rtc)globalThis.RTCPeerConnection=(await import('node-datachannel/polyfill')).RTCPeerConnection;
const child=spawn(process.execPath,['--import','tsx','geckos-server/src/server.ts'],{env:{...process.env,PORT:String(port),RTC:rtc?'1':'0',RTC_PORT:String(port+1)},stdio:['ignore','pipe','pipe']});
let log='';for(const s of [child.stdout,child.stderr])s.on('data',d=>{log=(log+d).slice(-10000);});
const clients=[],sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(fn,ms=12000){const end=performance.now()+ms;while(!await fn()){if(performance.now()>end)throw Error('Timed out: '+log);await sleep(15);}}
function make(){
 const c=new EventClient({url:base.replace('http','ws')+'/connect',room:CONTRACT.namespace,latest:CONTRACT.latest,stateMaxAgeMs:500,rtc:rtc?undefined:false,reconnectBaseMs:30,websocket:url=>new WebSocket(url,{origin:'http://localhost'})});
 const messages=new Map();for(const name of ['init','snapshot','position_ack','chat_message','building_placed','building_rotated','player_entered_home','player_left']){messages.set(name,[]);c.on(name,data=>messages.get(name).push(data));}
 clients.push(c);c.connect();return {c,all:n=>messages.get(n),last:n=>messages.get(n).at(-1)};
}
try{
 await wait(async()=>{try{return(await fetch(base+'/health')).ok;}catch{return false;}});
 const a=make(),b=make();await wait(()=>a.c.net.status==='online'&&b.c.net.status==='online'&&a.c.net.clock.synced&&b.c.net.clock.synced);
 if(rtc)await wait(()=>a.c.transport==='rtc'&&b.c.transport==='rtc');
 for(const [p,name]of [[a,'Twinwire A'],[b,'Twinwire B']])p.c.emit('join',{lng:-73.968,lat:40.781,name,spriteNum:1});
 await wait(()=>a.last('init')&&b.last('init')&&a.last('snapshot')?.state.length===2);
 const id=a.c.id,lng=-73.9679,lat=40.7811;
 a.c.emit('move',{lng,lat,seq:3});await wait(()=>a.last('position_ack')?.seq===3&&b.last('snapshot')?.state.find(p=>p.id===id)?.x===lng);
 a.c.emit('move',{lng:Infinity,lat,seq:4});await sleep(150);assert.equal(a.last('position_ack').lng,lng,'invalid coordinate cannot mutate authority');
 a.c.emit('place_building',{buildingType:'house',lng,lat});await wait(()=>b.last('building_placed'));
 const building=b.last('building_placed').building;assert.equal(building.ownerId,id);
 b.c.emit('rotate_building',{buildingId:building.id,rotation:2});await sleep(120);assert.equal(a.all('building_rotated').length,0,'other player cannot rotate owned building');
 a.c.emit('enter_home',{homeId:building.id,spriteNum:1,playerName:'Twinwire A'});await wait(()=>b.last('player_entered_home')?.homeId===building.id);
 a.c.net.pause();await wait(()=>a.c.net.status==='paused');a.c.emit('chat',{message:'queued once during reconnect'});
 await sleep(150);assert.equal(b.all('player_left').length,0,'pause must retain player and private home presence');
 a.c.connect();await wait(()=>a.c.net.status==='online'&&a.all('init').length===2&&b.all('chat_message').length===1&&a.c.ready('snapshot'));
 assert.equal(a.c.id,id);const init=a.last('init'),player=init.players.find(p=>p.id===id);
 assert.equal(player.lng,lng);assert.equal(player.lat,lat);assert.equal(player.currentHome,building.id);assert.equal(init.buildings[0].ownerId,id);
 await sleep(200);assert.equal(b.all('chat_message').length,1);assert.equal(b.all('chat_message')[0].message,'queued once during reconnect');
 const health=await fetch(base+'/health').then(r=>r.json());assert.equal(health.twinwire,'2.2.0');assert.equal(health.sessions,2);
 console.log(JSON.stringify({ok:true,transport:rtc?'rtc':'ws',movement:true,invalidCoordinatesRejected:true,privateHomeAndOwnershipRetained:true,sameSession:true,queuedChat:'once'}));
}finally{
 clients.forEach(c=>c.close());if(child.exitCode===null){const ended=once(child,'exit');child.kill();await ended;}
}
