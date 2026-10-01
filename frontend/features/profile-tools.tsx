"use client";
import Link from "next/link";
import Script from "next/script";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Loading,ErrorState,Empty } from "@/components/competition";
import { useAuth } from "@/components/auth-provider";
import { useApi } from "@/hooks/use-api";
import { mutate } from "@/services/api";
import type { Player,Team } from "@/types";
export function ProfileChecklist({p}:{p:Player}) {const fields=[['Ism',!!p.full_name?.trim()],['Hudud',!!p.region?.trim()],['O‘yin ID',!!Object.values(p.game_ids).some(Boolean)],['Avatar',!!p.avatar]] as const;const count=fields.filter(x=>x[1]).length;return <section className="profile-checklist"><div><strong>Profil tayyorligi</strong><span>{Math.round(count/fields.length*100)}%</span></div><progress max={fields.length} value={count}/><p>{fields.map(([label,done])=>`${done?'✓':'○'} ${label}`).join(' · ')}</p><small>Telefon va avatar ixtiyoriy. Turnir uchun tegishli o‘yin ID sini kiriting.</small></section>;}
export function OwnTeams(){const r=useApi<Team[]>('/users/me/teams');return <section className="section"><div className="section-heading"><h2>Jamoalarim</h2></div>{r.loading?<Loading/>:r.error?<ErrorState message={r.error} retry={r.reload}/>:!r.data?.length?<Empty title="Hali jamoangiz yo‘q" detail="Quyidagi shakl orqali jamoa yarating yoki sardoringizdan sizni qo‘shishni so‘rang."/>:<div className="participant-grid">{r.data.map(t=><Link key={t.id} className="participant-card" href={`/teams/${t.id}`}><div><strong>{t.name}</strong><small>Sardor: {t.captain} · {t.members.length} a’zo</small></div><span>Ko‘rish →</span></Link>)}</div>}</section>;}
export function TeamManager({team,onSaved}:{team:Team;onSaved:()=>void}) {
 const {user}=useAuth();const [open,setOpen]=useState(false);
 if(user?.nickname!==team.captain)return null;
 return <><Button variant="secondary" onClick={()=>setOpen(true)}>Jamoani va tarkibni tahrirlash</Button>{open&&<TeamEdit team={team} close={()=>setOpen(false)} onSaved={onSaved}/>}</>;
}
function TeamEdit({team,close,onSaved}:{team:Team;close:()=>void;onSaved:()=>void}) {
 const [q,setQ]=useState(''),[busy,setBusy]=useState(false),[members,setMembers]=useState(team.members);
 const players=useApi<Player[]>(`/players?q=${encodeURIComponent(q)}`);
 return <Modal open onOpenChange={v=>{if(!v&&!busy)close();}} title="Jamoa boshqaruvi" description="Turnirga qabul qilingan tarkib tarixni saqlash uchun qulflanadi. Nomi va logotipini yangilash mumkin."><form className="form" onSubmit={async e=>{e.preventDefault();setBusy(true);const f=new FormData(e.currentTarget);try{await mutate(`/teams/${team.id}`,{name:f.get('name'),logo:f.get('logo'),player_ids:members.filter(m=>!m.substitute&&m.id!==team.captain_id).map(m=>m.id),substitute_ids:members.filter(m=>m.substitute).map(m=>m.id)},'PUT');toast.success('Jamoa yangilandi');close();onSaved();}catch(e){toast.error((e as Error).message);}finally{setBusy(false);}}}>
 <label>Jamoa nomi<input name="name" required minLength={3} maxLength={80} defaultValue={team.name}/></label><label>Logo havolasi<input name="logo" type="url" defaultValue={team.logo}/></label><h3>Tarkib · {members.length}/12</h3>{members.map(m=><div className="list-row" key={m.id}><strong>{m.name}</strong>{m.id===team.captain_id?<small>Sardor</small>:<div className="row"><label className="checkbox"><input type="checkbox" checked={m.substitute} onChange={e=>setMembers(all=>all.map(x=>x.id===m.id?{...x,substitute:e.target.checked}:x))}/>Zaxira</label><Button type="button" size="sm" variant="ghost" onClick={()=>setMembers(all=>all.filter(x=>x.id!==m.id))}>Chiqarish</Button></div>}</div>)}<label>O‘yinchi topish<input value={q} onChange={e=>setQ(e.target.value)} placeholder="Taxallusni kiriting"/></label>{players.loading?<Loading/>:players.error?<ErrorState message={players.error} retry={players.reload}/>:<div className="roster-picker">{players.data?.filter(p=>!members.some(m=>m.id===p.id)).map(p=><div className="list-row" key={p.id}><span>{p.nickname}</span><Button type="button" size="sm" variant="secondary" disabled={members.length>=12} onClick={()=>setMembers(all=>[...all,{id:p.id,name:p.nickname,substitute:false}])}>Qo‘shish</Button></div>)}</div>}<Button disabled={busy}>{busy?'Saqlanmoqda…':'Jamoani saqlash'}</Button></form></Modal>;
}
type TelegramWindow=Window & {Telegram?:{WebApp?:{initData?:string}}};
export function TelegramConnect(){const [available,setAvailable]=useState(false),[busy,setBusy]=useState(false);return <><Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" onReady={()=>setAvailable(!!(window as TelegramWindow).Telegram?.WebApp?.initData)}/><h3>Telegramni ulash</h3><p>ARENA botidagi Mini App orqali ushbu hisobga kiring, so‘ng Telegram hisobingizni ulang.</p><Button variant="secondary" disabled={!available||busy} onClick={async()=>{const init_data=(window as TelegramWindow).Telegram?.WebApp?.initData;if(!init_data)return;setBusy(true);try{await mutate('/auth/telegram',{init_data});toast.success('Telegram hisobingiz ulandi');}catch(e){toast.error((e as Error).message);}finally{setBusy(false);}}}>{busy?'Ulanmoqda…':'Telegram hisobini ulash'}</Button>{!available&&<p className="hint">Bu tugma faqat Telegram Mini App ichida faollashadi.</p>}</>;}
