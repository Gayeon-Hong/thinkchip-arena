import {clamp} from './util.js';
export const INITIAL_CHIPS=100;
export const HINT_COST=30;
export const AD_REWARD=20;
export const AD_DAILY_LIMIT=5;
export const PLAY_DAILY_CAP=200;
export function todayKey(now=new Date()) {return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;}
export function defaultProfile() {return {version:2,nickname:'',chips:INITIAL_CHIPS,best:{},completed:{},history:[],earnings:{},adCount:{},demoGift:false};}
export function normalizeProfile(raw) {
 const base=defaultProfile();if(!raw||typeof raw!=='object')return base;
 return {...base,nickname:String(raw.nickname||'').slice(0,16),chips:clamp(Math.trunc(Number(raw.chips)||0),0,999999),best:raw.best&&typeof raw.best==='object'?raw.best:{},completed:raw.completed&&typeof raw.completed==='object'?raw.completed:{},history:Array.isArray(raw.history)?raw.history.slice(0,30):[],earnings:raw.earnings&&typeof raw.earnings==='object'?raw.earnings:{},adCount:raw.adCount&&typeof raw.adCount==='object'?raw.adCount:{},demoGift:raw.demoGift===true};
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
 return {profile:{...profile,chips:profile.chips-amount},ok:true};
}
export function awardAd(profile,now=new Date()) {
 const date=todayKey(now), count=Number(profile.adCount[date]||0);
 if(count>=AD_DAILY_LIMIT)return {profile,earned:0,reason:'limit'};
 return {profile:{...profile,chips:profile.chips+AD_REWARD,adCount:{...profile.adCount,[date]:count+1}},earned:AD_REWARD,reason:'ok'};
}
