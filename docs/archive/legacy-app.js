// ZILCH — ANCIENNE APPLICATION (dépôt ProfesseurT/Zilch, dev ChatGPT).
// ARCHIVE DE RÉFÉRENCE — NE PAS EXÉCUTER, NE PAS IMPORTER.
// Seul intérêt : la forme réelle des données localStorage 'dixmille_compagnon_v1'
// que migrateLegacy() doit savoir lire. Les 3 blocs audio base64 (228 Ko) ont été retirés.

(() => {
'use strict';
const KEY='dixmille_compagnon_v1';
const defaultState=()=>({version:1,sound:true,players:[],games:[],activeGame:null});
let state=load(); let pendingGeo=null; let toastTimer=null; let audioCtx=null;
function load(){try{const raw=localStorage.getItem(KEY);return raw?Object.assign(defaultState(),JSON.parse(raw)):defaultState()}catch(e){return defaultState()}}
function save(){localStorage.setItem(KEY,JSON.stringify(state));renderSound()}
function id(){return (crypto&&crypto.randomUUID)?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function fmt(n){return Number(n||0).toLocaleString('fr-FR')}
function dateFmt(iso){try{return new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(iso))}catch{return iso}}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),1800)}
function go(name){document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id===name));document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.go===name));if(name==='players')renderPlayers();if(name==='newgame')renderNewGame();if(name==='game')renderGame();if(name==='history')renderHistory();if(name==='stats')renderStats();if(name==='home')renderHome();scrollTo({top:0,behavior:'smooth'})}
document.addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b)go(b.dataset.go)});

function renderSound(){document.getElementById('soundToggle').textContent=state.sound?'🔊':'🔇'}
document.getElementById('soundToggle').onclick=()=>{state.sound=!state.sound;save();if(state.sound)beep('tap')};
const SOUND_DATA={
  /* [3 blocs base64 retirés : SOUND_DATA = { z, zp, penalty }] */
};
const soundPlayers={};
function playMp3(kind){
  if(!state.sound)return;
  try{
    if(!soundPlayers[kind]){soundPlayers[kind]=new Audio(SOUND_DATA[kind]); soundPlayers[kind].preload='auto';}
    const a=soundPlayers[kind]; a.pause(); a.currentTime=0; const p=a.play(); if(p&&p.catch)p.catch(()=>{});
  }catch(e){}
}
function ac(){if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();return audioCtx}
function tone(ctx,t0,f0,f1,dur,type='sawtooth',gain=.16){const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(f0,t0);o.frequency.exponentialRampToValueAtTime(Math.max(30,f1),t0+dur);g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(gain,t0+.025);g.gain.exponentialRampToValueAtTime(.0001,t0+dur);o.connect(g).connect(ctx.destination);o.start(t0);o.stop(t0+dur+.03)}
function beep(kind){if(!state.sound)return;if(kind==='z'||kind==='zp'||kind==='penalty'){playMp3(kind);return}try{const c=ac(),t=c.currentTime+.01;tone(c,t,520,680,.09,'sine',.05)}catch(e){}}

function addPlayer(name){name=(name||'').trim();if(!name)return null;if(state.players.some(p=>p.name.toLowerCase()===name.toLowerCase())){toast('Ce joueur existe déjà.');return null}const p={id:id(),name,createdAt:new Date().toISOString()};state.players.push(p);save();return p}
function playerById(pid){return state.players.find(p=>p.id===pid)}
function renderPlayers(){const root=document.getElementById('playersList');if(!state.players.length){root.innerHTML='<div class="card list-empty">Aucun joueur. Une table de jeu étrangement paisible.</div>';return}root.innerHTML=state.players.map(p=>{const played=state.games.filter(g=>g.participants.some(x=>x.playerId===p.id)).length;const wins=state.games.filter(g=>g.winnerId===p.id).length;return `<div class="card spread"><div><strong>${esc(p.name)}</strong><div class="muted small">${played} partie${played>1?'s':''} • ${wins} victoire${wins>1?'s':''}</div></div><button class="btn ghost danger-text" data-delete-player="${p.id}">Supprimer</button></div>`}).join('');root.querySelectorAll('[data-delete-player]').forEach(b=>b.onclick=()=>{const pid=b.dataset.deletePlayer;if(state.activeGame&&state.activeGame.participants.some(x=>x.playerId===pid)){toast('Impossible : joueur dans la partie en cours.');return}if(confirm('Supprimer ce joueur ? Son historique de parties restera conservé.')){state.players=state.players.filter(p=>p.id!==pid);save();renderPlayers()}})}
document.getElementById('addPlayerBtn').onclick=()=>{const i=document.getElementById('playerName');if(addPlayer(i.value)){i.value='';renderPlayers();toast('Joueur ajouté.')}};
document.getElementById('playerName').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('addPlayerBtn').click()});

function renderNewGame(){const root=document.getElementById('newGamePlayers');if(!state.players.length)root.innerHTML='<div class="notice">Ajoute au moins deux joueurs ci-dessous.</div>';else root.innerHTML=state.players.map(p=>`<div class="player-chip"><label><input type="checkbox" value="${p.id}"><span class="dot"></span>${esc(p.name)}</label><span class="badge">joueur</span></div>`).join('');document.getElementById('locationLabel').value='';pendingGeo=null;renderGeo()}
document.getElementById('quickAddPlayer').onclick=()=>{const i=document.getElementById('quickPlayerName'),p=addPlayer(i.value);if(p){i.value='';renderNewGame();const cb=document.querySelector(`#newGamePlayers input[value="${CSS.escape(p.id)}"]`);if(cb)cb.checked=true}};
document.getElementById('quickPlayerName').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('quickAddPlayer').click()});
function renderGeo(){const g=document.getElementById('geoStatus');g.innerHTML=pendingGeo?`GPS : <strong>${pendingGeo.lat.toFixed(5)}, ${pendingGeo.lon.toFixed(5)}</strong><br><span class="small">Précision ±${Math.round(pendingGeo.accuracy)} m</span>`:'Aucune position enregistrée.'}
document.getElementById('geoBtn').onclick=()=>{if(!navigator.geolocation){toast('Géolocalisation non disponible.');return}const b=document.getElementById('geoBtn');b.disabled=true;b.textContent='Détection…';navigator.geolocation.getCurrentPosition(pos=>{pendingGeo={lat:pos.coords.latitude,lon:pos.coords.longitude,accuracy:pos.coords.accuracy};renderGeo();b.disabled=false;b.textContent='📍 Détecter GPS';toast('Position enregistrée.')},err=>{b.disabled=false;b.textContent='📍 Détecter GPS';toast(err.code===1?'Autorisation de localisation refusée.':'Position GPS indisponible.');},{enableHighAccuracy:true,timeout:9000,maximumAge:60000})};
document.getElementById('clearGeoBtn').onclick=()=>{pendingGeo=null;renderGeo()};
document.getElementById('startGameBtn').onclick=()=>{if(state.activeGame){toast('Une partie est déjà en cours.');go('game');return}const ids=[...document.querySelectorAll('#newGamePlayers input:checked')].map(x=>x.value);if(ids.length<2){toast('Il faut au moins deux joueurs.');return}const now=new Date().toISOString();state.activeGame={id:id(),startedAt:now,locationLabel:document.getElementById('locationLabel').value.trim(),geo:pendingGeo,turnIndex:0,entryAttempts:0,events:[],participants:ids.map(pid=>({playerId:pid,nameSnapshot:playerById(pid)?.name||'Joueur',score:0,lossSeq:[]}))};save();go('game')};

function active(){return state.activeGame}
function currentParticipant(){const g=active();return g?g.participants[g.turnIndex]:null}
function renderGame(){const g=active();if(!g){go('home');return}if(!Number.isFinite(g.entryAttempts))g.entryAttempts=0;const p=currentParticipant();document.getElementById('turnPlayer').textContent=p.nameSnapshot;document.getElementById('turnTotal').textContent=fmt(p.score);document.getElementById('toWin').textContent=p.score>=10000?'Objectif atteint':`${fmt(Math.max(0,10000-p.score))} pts avant 10 000`;document.getElementById('turnCountBadge').textContent=`${g.events.length} tour${g.events.length>1?'s':''}`;document.getElementById('scoreboard').innerHTML=g.participants.map((x,i)=>`<div class="score-row ${i===g.turnIndex?'current':''}"><div><div class="score-name">${i===g.turnIndex?'▶ ':''}${esc(x.nameSnapshot)}</div><div class="loss-seq">${x.lossSeq.length?'Série : '+x.lossSeq.join(' · '):'Aucune série Z'}</div></div><div class="score-total">${fmt(x.score)}</div></div>`).join('');document.getElementById('attemptCount').textContent=`${g.entryAttempts} / 3`;document.getElementById('failedAttemptBtn').disabled=g.entryAttempts>=3;document.getElementById('undoBtn').disabled=!g.events.length;document.getElementById('turnScoreInput').value=''}
function snapshot(g){return {turnIndex:g.turnIndex,entryAttempts:g.entryAttempts||0,participants:g.participants.map(p=>({score:p.score,lossSeq:[...p.lossSeq]}))}}
function nextTurn(g){g.turnIndex=(g.turnIndex+1)%g.participants.length;g.entryAttempts=0}
function checkPenalty(seq){const n=seq.length;if(n>=2){const a=seq[n-2],b=seq[n-1];if((a==='Z+'&&b==='Z+')||(a!==b&&[a,b].every(x=>x==='Z'||x==='Z+')))return true}if(n>=3&&seq.slice(-3).every(x=>x==='Z'))return true;return false}
function recordTurn(type,points=0){const g=active();if(!g)return;const p=currentParticipant(),before=snapshot(g);let penalty=0;if(type==='score'){p.score+=points;p.lossSeq=[];beep('tap')}else{p.lossSeq.push(type);if(checkPenalty(p.lossSeq)){p.score-=1000;penalty=-1000;p.lossSeq=[];beep('penalty')}else beep(type==='Z'?'z':'zp')}
const ev={id:id(),at:new Date().toISOString(),playerId:p.playerId,playerName:p.nameSnapshot,type,points:type==='score'?points:0,penalty,before,afterScore:p.score};g.events.push(ev);if(p.score>=10000){finishGame(p.playerId,false);return}nextTurn(g);save();renderGame();const notice=document.getElementById('gameNotice');if(penalty){notice.className='notice penalty';notice.innerHTML=`<strong>${esc(p.nameSnapshot)} : -1 000 pts.</strong> La série est remise à zéro.`}else{notice.className='notice';notice.textContent=type==='score'?`${p.nameSnapshot} marque ${fmt(points)} points.`:`${p.nameSnapshot} : ${type}. Tour perdu.`}}
document.getElementById('validateScoreBtn').onclick=()=>{const i=document.getElementById('turnScoreInput'),v=Number(i.value);if(!Number.isFinite(v)||v<250){toast('Score minimum : 250 points.');return}if(v%50!==0){toast('Le score doit être un multiple de 50.');return}recordTurn('score',v)};
document.getElementById('turnScoreInput').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('validateScoreBtn').click()});
document.getElementById('failedAttemptBtn').onclick=()=>{const g=active();if(!g)return;g.entryAttempts=(g.entryAttempts||0)+1;save();if(g.entryAttempts>=3){toast('3 essais insuffisants : Z.');recordTurn('Z');return}renderGame();document.getElementById('gameNotice').className='notice';document.getElementById('gameNotice').textContent=`Essai ${g.entryAttempts}/3 insuffisant. Encore ${3-g.entryAttempts} essai${3-g.entryAttempts>1?'s':''}.`};
document.getElementById('zBtn').onclick=()=>recordTurn('Z');document.getElementById('zpBtn').onclick=()=>recordTurn('Z+');
document.getElementById('undoBtn').onclick=()=>{const g=active();if(!g||!g.events.length)return;const ev=g.events.pop();g.turnIndex=ev.before.turnIndex;g.entryAttempts=ev.before.entryAttempts||0;g.participants.forEach((p,i)=>{p.score=ev.before.participants[i].score;p.lossSeq=[...ev.before.participants[i].lossSeq]});save();renderGame();toast('Dernier tour annulé.')};
document.getElementById('abandonBtn').onclick=()=>{if(confirm('Terminer cette partie sans vainqueur ?'))finishGame(null,true)};
function finishGame(winnerId,abandoned){const g=active();if(!g)return;const finished={...g,finishedAt:new Date().toISOString(),winnerId:winnerId||null,abandoned:!!abandoned};state.games.unshift(finished);state.activeGame=null;save();if(abandoned){toast('Partie archivée.');go('history');return}const w=finished.participants.find(p=>p.playerId===winnerId);showWinner(w,finished)}
function showWinner(w,g){const root=document.getElementById('modalRoot');root.innerHTML=`<div class="modal-backdrop"><div class="modal"><div class="muted small">VICTOIRE</div><div class="winner">${esc(w.nameSnapshot)}</div><p>${fmt(w.score)} points en ${g.events.filter(e=>e.playerId===w.playerId).length} tours. La science a parlé, ou quelque chose d'approchant.</p><button id="closeWin" class="btn primary" style="width:100%">Voir l'historique</button></div></div>`;document.getElementById('closeWin').onclick=()=>{root.innerHTML='';go('history')}}

function renderHome(){const b=document.getElementById('resumeGameBtn');b.classList.toggle('hidden',!state.activeGame);if(state.activeGame)b.textContent=`Reprendre • ${currentParticipant()?.nameSnapshot||'partie en cours'}`}
document.getElementById('resumeGameBtn').onclick=()=>go('game');
function renderHistory(){const root=document.getElementById('historyList');if(!state.games.length){root.innerHTML='<div class="card list-empty">Aucune partie terminée.</div>';return}root.innerHTML=state.games.map(g=>{const sorted=[...g.participants].sort((a,b)=>b.score-a.score);const winner=g.winnerId?g.participants.find(p=>p.playerId===g.winnerId):null;return `<div class="history-item"><div class="spread"><div class="title">${winner?'🏆 '+esc(winner.nameSnapshot):'Partie terminée'}</div><span class="badge ${g.abandoned?'red':'gold'}">${g.abandoned?'arrêtée':'terminée'}</span></div><div class="meta">${dateFmt(g.finishedAt)}${g.locationLabel?' • '+esc(g.locationLabel):''}${g.geo?' • GPS':''}</div><div class="podium">${sorted.map((p,i)=>`${i+1}. ${esc(p.nameSnapshot)} <strong>${fmt(p.score)}</strong>`).join(' &nbsp; ')}</div><div class="small muted" style="margin-top:8px">${g.events.length} tours • ${g.events.filter(e=>e.type==='Z').length} Z • ${g.events.filter(e=>e.type==='Z+').length} Z+ • ${g.events.filter(e=>e.penalty).length} pénalité${g.events.filter(e=>e.penalty).length>1?'s':''}</div></div>`}).join('')}
function renderStats(){const completed=state.games.filter(g=>!g.abandoned);const totalTurns=state.games.reduce((s,g)=>s+g.events.length,0);const penalties=state.games.reduce((s,g)=>s+g.events.filter(e=>e.penalty).length,0);document.getElementById('globalStats').innerHTML=`<div class="kpi"><span>Parties</span><strong>${state.games.length}</strong></div><div class="kpi"><span>Tours</span><strong>${totalTurns}</strong></div><div class="kpi"><span>Victoires attribuées</span><strong>${completed.filter(g=>g.winnerId).length}</strong></div><div class="kpi"><span>-1 000</span><strong>${penalties}</strong></div>`;const root=document.getElementById('playerStats');if(!state.players.length){root.innerHTML='<div class="card list-empty">Ajoute des joueurs pour voir leurs statistiques.</div>';return}const rows=state.players.map(p=>{const games=state.games.filter(g=>g.participants.some(x=>x.playerId===p.id)),wins=games.filter(g=>g.winnerId===p.id).length,events=games.flatMap(g=>g.events.filter(e=>e.playerId===p.id)),scores=events.filter(e=>e.type==='score').map(e=>e.points),z=events.filter(e=>e.type==='Z').length,zp=events.filter(e=>e.type==='Z+').length,pen=events.filter(e=>e.penalty).length,best=scores.length?Math.max(...scores):0,avg=scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):0,rate=games.length?Math.round(wins/games.length*100):0;return {p,games:wins||games.length?games.length:0,wins,rate,z,zp,pen,best,avg}}).sort((a,b)=>b.wins-a.wins||b.rate-a.rate||a.p.name.localeCompare(b.p.name));root.innerHTML=rows.map(r=>`<div class="card"><div class="spread"><h3>${esc(r.p.name)}</h3><span class="badge gold">${r.wins} victoire${r.wins>1?'s':''}</span></div><div class="kpis"><div class="kpi"><span>Taux de victoire</span><strong>${r.rate}%</strong></div><div class="kpi"><span>Meilleur tour</span><strong>${fmt(r.best)}</strong></div><div class="kpi"><span>Moyenne / score</span><strong>${fmt(r.avg)}</strong></div><div class="kpi"><span>Z / Z+</span><strong>${r.z} / ${r.zp}</strong></div></div><div class="notice" style="margin-top:10px">${r.games} partie${r.games>1?'s':''} • ${r.pen} pénalité${r.pen>1?'s':''} de -1 000</div></div>`).join('')}

renderSound();renderHome();
})();
</script>

<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}
</script>

</body>
