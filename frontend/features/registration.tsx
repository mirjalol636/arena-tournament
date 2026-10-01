"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock3 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Loading, ErrorState, Badge } from "@/components/competition";
import { useApi } from "@/hooks/use-api";
import { mutate } from "@/services/api";
import { date, time, gameName } from "@/lib/utils";
import type { Tournament, Player, Team } from "@/types";
export type EntryState = {window:string;full:boolean;available:number;registration:{id:number;status:string}|null;already_participant:boolean;server_now:string};
const labels:Record<string,string>={not_started:"Qabul hali boshlanmagan",ended:"Qabul muddati tugagan",closed:"Ro‘yxatdan o‘tish yopilgan",finished:"Turnir yakunlangan",pending:"Arizangiz ko‘rib chiqilmoqda",approved:"Ishtirokingiz tasdiqlangan",waitlist:"Siz kutish ro‘yxatidasiz",rejected:"Arizangiz rad etilgan"};
export function RegistrationEntry({t,onSaved}:{t:Tournament;onSaved:()=>void}) {
 const {user,ready}=useAuth();
 const state=useApi<EntryState>(user?`/tournaments/${t.slug}/registration-state`:null,30000);
 const [open,setOpen]=useState(false);
 const [elapsed,setElapsed]=useState({key:"",ms:0});
 const serverNow=state.data?.server_now||t.server_now;
 useEffect(()=>{const received=Date.now();const id=setInterval(()=>setElapsed({key:serverNow,ms:Date.now()-received}),1000);return()=>clearInterval(id);},[serverNow]);
 const now=Date.parse(serverNow)+(elapsed.key===serverNow?elapsed.ms:0);
 const windowState=t.status==='finished'?'finished':t.status!=='registration'?'closed':now<Date.parse(t.registration_start)?'not_started':now>Date.parse(t.registration_end)?'ended':'open';
 const own=state.data?.registration?.status;
 const full=state.data?.full??t.participants>=t.max_participants;
 const blocked=windowState!=='open'||!!own||!!state.data?.already_participant;
 const label=labels[own||windowState]||(state.data?.already_participant?'Siz turnir ishtirokchisisiz':full?'Kutish ro‘yxatiga yozilish':'Ro‘yxatdan o‘tish');
 const target=windowState==='not_started'?t.registration_start:t.registration_end;
 const seconds=Math.max(0,Math.ceil((Date.parse(target)-now)/1000));
 return <div className="registration-entry">
  <Button disabled={!ready||(!!user&&(state.loading||!!state.error))||blocked} onClick={()=>setOpen(true)}>{label}</Button>
  {state.error&&<ErrorState message={state.error} retry={state.reload}/>}
  {(windowState==='not_started'||windowState==='open')&&<p className="hint"><Clock3 size={14}/> {windowState==='not_started'?'Qabul boshlanishiga':'Qabul tugashiga'}: {Math.floor(seconds/86400)} kun {Math.floor(seconds%86400/3600)} soat {Math.floor(seconds%3600/60)} daqiqa<br/>{date(target)}, {time(target)} · Toshkent vaqti (UTC+5)</p>}
  {full&&windowState==='open'&&!own&&<p className="hint">Barcha joylar band. Arizangiz kutish ro‘yxatiga tushadi; bo‘sh joy ochilsa tashkilotchi ko‘rib chiqadi.</p>}
  {own==='rejected'&&<p className="hint">Sababini aniqlash uchun tashkilotchi bilan bog‘laning. Takroriy ariza yuborilmaydi.</p>}
  {open&&<RegistrationWizard t={t} close={()=>setOpen(false)} onSaved={()=>{void state.reload();onSaved();}}/>}
 </div>;
}
function RegistrationWizard({t,close,onSaved}:{t:Tournament;close:()=>void;onSaved:()=>void}) {
 const {user}=useAuth();
 const profile=useApi<Player>(user?'/users/me/profile':null);
 const teams=useApi<Team[]>(user&&t.mode==='team'?'/users/me/teams':null);
 const [step,setStep]=useState(0),[busy,setBusy]=useState(false),[team,setTeam]=useState(''),[accepted,setAccepted]=useState(false),[done,setDone]=useState('');
 const captained=teams.data?.filter(x=>x.captain_id===profile.data?.id)||[];
 const reason=(x:Team)=>{const active=x.members.filter(m=>!m.substitute).length;return active<t.min_team_size?`Kamida ${t.min_team_size} asosiy o‘yinchi kerak`:x.members.length>t.max_team_size?`Ko‘pi bilan ${t.max_team_size} a’zo mumkin`:'';};
 return <Modal open onOpenChange={v=>{if(!v&&!busy)close();}} title="Turnirga ariza" description={t.name}>
 {!user?<div className="form"><p>Ariza yuborish uchun hisobingizga kiring.</p><Button asChild><Link href="/login">Kirish / Hisob yaratish</Link></Button></div>:<>
 <ol className="entry-steps">{['O‘yinchi','O‘yin va jamoa','Qoidalar','Natija'].map((label,i)=><li key={label} aria-current={step===i?'step':undefined} className={step===i?'active':step>i?'complete':''}><span>{i+1}</span>{label}</li>)}</ol>
 {profile.loading?<Loading/>:profile.error?<ErrorState message={profile.error} retry={profile.reload}/>:step===0?<form className="form" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);try{await mutate('/users/me/profile',{full_name:f.get('full_name'),region:f.get('region'),phone:f.get('phone'),avatar:profile.data?.avatar||'',game_ids:profile.data?.game_ids||{}},'PUT');await profile.reload();setStep(1);}catch(e){toast.error((e as Error).message);}finally{setBusy(false);}}}>
 <div className="form-grid"><label>To‘liq ism<input name="full_name" required minLength={2} maxLength={120} defaultValue={profile.data?.full_name}/></label><label>Taxallus<input disabled value={user.nickname}/></label><label>Hudud<input name="region" required defaultValue={profile.data?.region}/></label><label>Telefon (ixtiyoriy)<input name="phone" type="tel" defaultValue={profile.data?.phone}/></label></div><Button disabled={busy}>{busy?'Saqlanmoqda…':'Davom etish'}</Button></form>:step===1?<form className="form" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);try{await mutate('/users/me/profile',{full_name:profile.data?.full_name,region:profile.data?.region,phone:profile.data?.phone||'',avatar:profile.data?.avatar||'',game_ids:{...profile.data?.game_ids,[t.game]:f.get('game_id')}},'PUT');setStep(2);}catch(e){toast.error((e as Error).message);}finally{setBusy(false);}}}>
 <label>{gameName(t.game)} ID<input name="game_id" required maxLength={100} defaultValue={profile.data?.game_ids[t.game]}/></label>
 {t.mode==='team'&&<><p>Faqat sardor ariza yuboradi. Asosiy tarkib: kamida {t.min_team_size}; zaxiralar bilan jami: ko‘pi bilan {t.max_team_size}.</p>{teams.loading?<Loading/>:teams.error?<ErrorState message={teams.error} retry={teams.reload}/>:<label>Jamoangiz<select required value={team} onChange={e=>setTeam(e.target.value)}><option value="">Jamoani tanlang</option>{captained.map(x=><option key={x.id} value={x.id} disabled={!!reason(x)}>{x.name} · {x.members.length} a’zo{reason(x)?` — ${reason(x)}`:''}</option>)}</select></label>}{!teams.loading&&!captained.length&&<p className="notice">Siz sardor bo‘lgan jamoa topilmadi.</p>}{captained.filter(x=>reason(x)).map(x=><p className="hint" key={x.id}>{x.name}: {reason(x)}. <Link href={`/teams/${x.id}`}>Tarkibni boshqarish</Link></p>)}<Link className="text-link" href="/profile">Jamoa yaratish yoki tarkibni boshqarish →</Link></>}
 <div className="row"><Button type="button" variant="secondary" onClick={()=>setStep(0)}>Orqaga</Button><Button disabled={busy||(t.mode==='team'&&!team)}>Davom etish</Button></div></form>:step===2?<div className="form"><div className="rules-preview">{t.rules||'Qo‘shimcha qoidalar e’lon qilinmagan.'}</div><label className="checkbox"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/>Turnir qoidalarini o‘qidim va roziman.</label><p className="hint">Ariza yuborish ishtirok avtomatik tasdiqlanishini anglatmaydi. Tashkilotchi arizani ko‘rib chiqadi.</p><div className="row"><Button variant="secondary" disabled={busy} onClick={()=>setStep(1)}>Orqaga</Button><Button disabled={busy||!accepted} onClick={async()=>{setBusy(true);try{const r=await mutate<{status:string}>(`/tournaments/${t.slug}/register`,{team_id:t.mode==='team'?Number(team):null});setDone(r.status);setStep(3);onSaved();}catch(e){toast.error((e as Error).message);onSaved();}finally{setBusy(false);}}}>{busy?'Yuborilmoqda…':'Arizani yuborish'}</Button></div></div>:<div className="success-state" role="status"><CheckCircle2/><h3>Arizangiz qabul qilindi</h3><Badge status={done}/><p>{done==='waitlist'?'Joylar band bo‘lgani uchun kutish ro‘yxatiga qo‘shildingiz.':'Arizangiz tashkilotchi tomonidan ko‘rib chiqiladi.'} Holatini profilingizda kuzating.</p><Button asChild><Link href="/profile">Arizalarimni ko‘rish</Link></Button><Button variant="ghost" onClick={close}>Yopish</Button></div>}
 </>}
 </Modal>;
}
