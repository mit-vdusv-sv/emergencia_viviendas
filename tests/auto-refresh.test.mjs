import test from 'node:test';
import assert from 'node:assert/strict';
import {createAutoRefresh,REFRESH_INTERVAL} from '../src/auto-refresh.mjs';
function clock(){let time=0,task=null;return {now:()=>time,setTimer(fn,delay){task={fn,delay};return 1;},clearTimer(){task=null;},advance(ms){time+=ms;},get task(){return task;}};}
test('actualización automática cada cinco minutos y nueva espera después de completar',async()=>{
 const timer=clock();let calls=0;const updater=createAutoRefresh({...timer,run:async()=>{calls++;}});
 updater.start();assert.equal(REFRESH_INTERVAL,300000);assert.equal(calls,0);assert.equal(timer.task.delay,300000);
 timer.advance(300000);await timer.task.fn();assert.equal(calls,1);assert.equal(updater.nextAt,600000);assert.equal(timer.task.delay,300000);
});
test('evita consultas duplicadas mientras hay una actualización en curso',async()=>{
 const timer=clock();let finish,calls=0;const updater=createAutoRefresh({...timer,run:()=>{calls++;return new Promise(resolve=>{finish=resolve;});}});
 const first=updater.start({immediate:true});await Promise.resolve();const second=updater.trigger();assert.equal(first,second);assert.equal(calls,1);finish();await first;assert.ok(timer.task);
});
test('reintenta después de un fallo y recupera una pestaña suspendida',async()=>{
 const timer=clock();let calls=0,errors=0;const updater=createAutoRefresh({...timer,run:async()=>{calls++;if(calls===1)throw new Error('sin conexión');},onError:()=>{errors++;}});
 await updater.start({immediate:true});assert.equal(errors,1);assert.ok(timer.task);timer.advance(300001);await updater.wake();assert.equal(calls,2);assert.equal(updater.nextAt,600001);
});
test('no consulta antes del plazo y detenerlo cancela las siguientes consultas',async()=>{
 const timer=clock();let calls=0;const updater=createAutoRefresh({...timer,run:async()=>{calls++;}});
 updater.start();timer.advance(1000);await updater.wake();assert.equal(calls,0);updater.stop();assert.equal(timer.task,null);await updater.trigger();assert.equal(calls,0);
});
