import {clamp} from './util.js';
export const INITIAL_CHIPS=100;
export const HINT_COST=30;
export const AD_REWARD=20;
export const AD_DAILY_LIMIT=5;
export const PLAY_DAILY_CAP=200;
export function todayKey(now=new Date()) {return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;}
export function defaultProfile() {return {version:2,nickname:'',chips:INITIAL_CHIPS,paid:0,best:{},completed:{},history:[],earnings:{},adCount:{},demoGift:false};}
export function normalizeProfile(raw) {
 const base=defaultProfile();if(!raw||typeof raw!=='object')return base;
 const chips=clamp(Math.trunc(Number(raw.chips)||0),0,999999);
 return {...base,nickname:String(raw.nickname||'').slice(0,16),chips,paid:clamp(Math.trunc(Number(raw.paid)||0),0,chips),best:raw.best&&typeof raw.best==='object'?raw.best:{},completed:raw.completed&&typeof raw.completed==='object'?raw.completed:{},history:Array.isArray(raw.history)?raw.history.slice(0,30):[],earnings:raw.earnings&&typeof raw.earnings==='object'?raw.earnings:{},adCount:raw.adCount&&typeof raw.adCount==='object'?raw.adCount:{},demoGift:raw.demoGift===true};
}
export function awardRun(profile,key,amount,now=new Date()) {
 const date=todayKey(now);
 if(profile.completed[key])return {profile,earned:0,reason:'duplicate'};
 const earnedSoFar=Number(profile.earnings[date]||0);
 const earned=clamp(Math.trunc(amount),0,Math.max(0,PLAY_DAILY_CAP-earnedSoFar));
 const updated={...profile,completed:{...profile.completed,[key]:true},chips:profile.chips+earned,earnings:{...profile.earnings,[date]:earnedSoFar+earned}};
 return {profile:updated,earned,reason:earned===0?'cap':'ok'};
}
export function spendChips(profile,amount) {
 if(!Number.isInteger(amount)||amount<0||profile.chips<amount)return {profile,ok:false};
 const chips=profile.chips-amount;
 return {profile:{...profile,chips,paid:Math.min(Number(profile.paid)||0,chips)},ok:true}; // 무료 칩부터 써요 (충전 칩은 선물용으로 남겨요)
}
export function awardAd(profile,now=new Date()) {
 const date=todayKey(now), count=Number(profile.adCount[date]||0);
 if(count>=AD_DAILY_LIMIT)return {profile,earned:0,reason:'limit'};
 return {profile:{...profile,chips:profile.chips+AD_REWARD,adCount:{...profile.adCount,[date]:count+1}},earned:AD_REWARD,reason:'ok'};
}
// 결제로 충전한 칩 = 친구에게 선물할 수 있는 칩. 게임·광고로 번 칩이나 선물 받은 칩은 선물할 수 없어요.
export function grantPaid(profile,amount){const n=Math.max(0,Math.trunc(amount));return {...profile,chips:profile.chips+n,paid:(Number(profile.paid)||0)+n};}
