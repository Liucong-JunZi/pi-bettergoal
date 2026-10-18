const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { createJiti } = require('jiti');
const jiti = createJiti(__filename, { alias: {
 '@earendil-works/pi-tui': join(__dirname, 'tui-stub.cjs'),
} });
const plugin = jiti('../.pi/extensions/pi-goal/index.ts').default;
const { makeWait, checkWait, eventMatches } = jiti('../.pi/extensions/pi-goal/wait-hooks.ts');
const { accountGoalTurn, createGoalState } = jiti('../.pi/extensions/pi-goal/goal-state.ts');

function harness() {
 const tools = {}, commands = {}, handlers = {}, listeners = new Set(), messages = [], entries = [], timers = new Set();
 let active = [], busy = false;
 const oldSet = global.setInterval, oldClear = global.clearInterval;
 global.setInterval = fn => { timers.add(fn); return { fn, unref() {} }; };
 global.clearInterval = t => timers.delete(t.fn);
 const ctx = { cwd: tmpdir(), isIdle: () => !busy, hasPendingMessages: () => false,
  ui: { setStatus() {}, notify() {}, async confirm() { return true; } },
  sessionManager: { getBranch: () => entries } };
 const pi = { registerTool(t) { tools[t.name] = t; }, registerCommand(n,t) { commands[n] = t; },
  registerMessageRenderer() {}, getActiveTools: () => active, setActiveTools: x => active = x,
  appendEntry(customType,data) { entries.push({type:'custom',customType,data}); },
  sendMessage(message,options) { messages.push({message,options}); },
  on(n,fn) { handlers[n] = fn; },
  events: { on(n,fn) { listeners.add(fn); return () => listeners.delete(fn); } } };
 plugin(pi);
 handlers.session_start({reason:'startup'},ctx);
 return { tools, ctx, messages, entries, timers, listeners,
  get state() { return entries.at(-1)?.data.goal; }, get active() { return active; },
  busy(v) { busy = v; }, tick() { for (const fn of [...timers]) fn(); },
  emit(data) { for (const fn of [...listeners]) fn(data); },
  call(n,args) { return tools[n].execute('id',args,undefined,undefined,ctx); },
  command(args) { return commands.goal.handler(args,ctx); },
  event(n,data={}) { return handlers[n]?.(data,ctx); },
  close() { handlers.session_shutdown({},ctx); global.setInterval=oldSet;global.clearInterval=oldClear; }
 };
}
async function run(fn) { const h = harness(); try { await h.command('test hook objective'); h.messages.length=0; await fn(h); } finally { h.close(); } }
const turns = h => h.messages.filter(m => m.options?.triggerTurn).length;

test('lifecycle tools remain exposed while waiting and paused; resume does not duplicate turns', async () => run(async h => {
 await h.call('wait_goal',{kind:'manual',reason:'permission'});
 for (const name of ['get_goal','pause_goal','resume_goal','clear_goal','set_goal_statusbar']) assert.ok(h.active.includes(name), name);
 const state = await h.call('get_goal',{}); assert.equal(state.details.goal.status,'waiting');
 assert.equal((await h.call('pause_goal',{reason:'user requests pause'})).terminate,true);
 assert.equal(h.state.status,'paused');
 await h.call('resume_goal',{reason:'user explicitly requests resume'});
 assert.equal(h.state.status,'active');assert.equal(turns(h),0);
 h.event('agent_end');await Promise.resolve();assert.equal(turns(h),1);
 await h.call('set_goal_statusbar',{enabled:false});assert.equal(h.entries.at(-1).data.statusBarEnabled,false);
 await h.call('clear_goal',{reason:'user requests clear'});assert.equal(h.state,null);
}));
test('tool declarations never flap across lifecycle transitions', async () => run(async h => {
 const all=['get_goal','pause_goal','resume_goal','clear_goal','set_goal_statusbar','wait_goal','achieve_goal','update_goal','create_goal'];
 const snapshot=()=>all.filter(n=>h.active.includes(n)).sort().join(',');
 const activeSet=snapshot();
 await h.call('wait_goal',{kind:'manual',reason:'waiting'});assert.equal(snapshot(),activeSet);
 await h.call('pause_goal',{reason:'paused'});assert.equal(snapshot(),activeSet);
 await h.call('resume_goal',{reason:'resumed'});assert.equal(snapshot(),activeSet);
 await h.call('clear_goal',{reason:'cleared'});
 assert.equal(snapshot(),'create_goal,get_goal');
}));
test('pause tool cancels hook and completion alias requires active state', async () => run(async h => {
 await h.call('wait_goal',{kind:'event',event:'done',reason:'output'});
 const signal={goalId:h.state.id,waitId:h.state.wait.id,event:'done'};
 await h.call('pause_goal',{reason:'user pause'});h.emit(signal);assert.equal(turns(h),0);assert.equal(h.timers.size,0);
 assert.equal((await h.call('achieve_goal',{status:'complete'})).isError,true);
 await h.call('resume_goal',{reason:'user resume'});
 await h.call('achieve_goal',{status:'complete'});assert.equal(h.state.status,'complete');
 await assert.rejects(h.call('resume_goal',{reason:'user resume'}));
}));
test('resume tool rejects missing goal, blank reason, duplicate resume and spent budget', async () => run(async h => {
 await assert.rejects(h.call('pause_goal',{reason:' '}));
 await assert.rejects(h.call('resume_goal',{reason:'explicit request'}));
 h.state.tokenBudget=1;h.state.tokensUsed=1;
 await h.call('pause_goal',{reason:'blocker'});
 await assert.rejects(h.call('resume_goal',{reason:'user resume'}));
 await h.call('clear_goal',{reason:'user clear'});
 await assert.rejects(h.call('resume_goal',{reason:'user resume'}));
}));
test('pure conditions validate bounds, timer, file changes and event correlation', () => {
 const dir = mkdtempSync(join(tmpdir(),'goal-hook-'));
 try {
  assert.throws(() => makeWait({reason:'x',kind:'time',seconds:0},dir));
  assert.throws(() => makeWait({reason:'x',kind:'time',seconds:Infinity},dir));
  const time = makeWait({reason:'x',kind:'time',seconds:2},dir,1000);
  assert.deepEqual(checkWait(time,2999),{});assert.equal(checkWait(time,3000).wake,'timer elapsed');
  const file = makeWait({reason:'x',kind:'file',path:'receipt',fileMode:'changed'},dir);
  assert.deepEqual(checkWait(file),{});writeFileSync(join(dir,'receipt'),'done');assert.ok(checkWait(file).wake);
  const event=makeWait({reason:'x',kind:'event',event:'done'},dir);
  assert.equal(eventMatches(event,'g',{goalId:'g',waitId:event.id,event:'done'}),true);
  assert.equal(eventMatches(event,'g',{goalId:'old',waitId:event.id,event:'done'}),false);
  assert.equal(checkWait(event,event.deadline).expired,true);
 } finally { rmSync(dir,{recursive:true,force:true}); }
});
test('wait stops continuation, terminates tool followup and preserves final-turn accounting', async () => run(async h => {
 h.event('turn_start');
 const result = await h.call('wait_goal',{kind:'event',reason:'waiting for test output',event:'done'});
 assert.equal(result.terminate,true);assert.equal(h.state.status,'waiting');
 // Declaration must not flap mid-turn: wait_goal stays declared, guarded by state.
 assert.ok(h.active.includes('wait_goal'));
 await assert.rejects(h.call('wait_goal',{kind:'manual',reason:'second wait'}));
 h.event('turn_end',{message:{usage:{input:3,output:4,totalTokens:7}}});
 h.event('agent_end');await Promise.resolve();assert.equal(turns(h),0);assert.ok(h.state.tokensUsed>0);
}));
test('matching event wakes exactly once; wrong/old event does not', async () => run(async h => {
 await h.call('wait_goal',{kind:'event',reason:'output',event:'done'});
 const signal={goalId:h.state.id,waitId:h.state.wait.id,event:'done'};
 h.emit({...signal,waitId:'stale'});assert.equal(h.state.status,'waiting');
 h.emit(signal);assert.equal(h.state.status,'active');assert.equal(turns(h),1);
 h.emit(signal);h.tick();assert.equal(turns(h),1);assert.equal(h.timers.size,0);assert.equal(h.listeners.size,0);
}));
test('busy wake latches until idle; user pause prevents it', async () => run(async h => {
 await h.call('wait_goal',{kind:'event',reason:'output',event:'done'});
 const signal={goalId:h.state.id,waitId:h.state.wait.id,event:'done'};
 h.busy(true);h.emit(signal);assert.equal(turns(h),0);assert.ok(h.state.wait.ready);
 await h.command('pause');h.busy(false);h.tick();h.emit(signal);assert.equal(h.state.status,'paused');assert.equal(turns(h),0);
}));
test('busy wake delivers when idle', async () => run(async h => {
 await h.call('wait_goal',{kind:'event',reason:'output',event:'done'});
 h.busy(true);h.emit({goalId:h.state.id,waitId:h.state.wait.id,event:'done'});
 h.busy(false);h.tick();assert.equal(turns(h),1);assert.equal(h.state.status,'active');
}));
test('clear, replace, reload and shutdown disarm hooks', async () => {
 for (const action of ['clear','replace','reload','shutdown','tree','switch']) await run(async h => {
  await h.call('wait_goal',{kind:'event',reason:'output',event:'done'});
  const signal={goalId:h.state.id,waitId:h.state.wait.id,event:'done'};
  if (action==='clear') await h.command('clear');
  if (action==='replace') await h.command('replacement goal');
  if (action==='reload') h.event('session_start',{reason:'reload'});
  if (action==='shutdown') h.event('session_shutdown');
  if (action==='tree') { h.event('session_before_tree'); h.event('session_tree'); assert.equal(h.state.status,'paused'); }
  if (action==='switch') h.event('session_before_switch');
  const n=turns(h);h.emit(signal);h.tick();assert.equal(turns(h),n);assert.equal(h.timers.size,0);assert.equal(h.listeners.size,0);
 });
});
test('file wake and expiry run without LLM polling', async () => run(async h => {
 const dir=mkdtempSync(join(tmpdir(),'goal-hook-file-'));
 try {
  const path=join(dir,'receipt');await h.call('wait_goal',{kind:'file',reason:'receipt',path});h.tick();assert.equal(turns(h),0);
  writeFileSync(path,'done');h.tick();assert.equal(turns(h),1);
  await h.call('wait_goal',{kind:'event',reason:'output',event:'done'});
  const signal={goalId:h.state.id,waitId:h.state.wait.id,event:'done'};
  h.state.wait.deadline=0;h.emit(signal);h.tick();assert.equal(h.state.status,'paused');assert.equal(turns(h),1);
 } finally {rmSync(dir,{recursive:true,force:true});}
}));
test('timer wakes once and actual turn budget limit cancels hooks', async () => run(async h => {
 await h.call('wait_goal',{kind:'time',reason:'cooldown',seconds:1});h.state.wait.deadline=0;
 h.tick();h.tick();assert.equal(turns(h),1);assert.equal(h.state.status,'active');
 h.state.tokenBudget=1;h.event('turn_start');
 await h.call('wait_goal',{kind:'event',reason:'output',event:'done'});
 h.event('turn_end',{message:{usage:{totalTokens:2}}});
 assert.equal(h.state.status,'budget_limited');assert.equal(h.timers.size,0);assert.equal(h.listeners.size,0);
}));
test('manual wait has no watcher and user can resume; budget limit wins over wait', async () => run(async h => {
 await h.call('wait_goal',{kind:'manual',reason:'need permission'});assert.equal(h.timers.size,0);
 await h.command('resume');assert.equal(h.state.status,'active');await Promise.resolve();assert.equal(turns(h),1);
 const s=createGoalState('x',1);s.status='waiting';assert.equal(accountGoalTurn(s,1,1).status,'budget_limited');
}));
