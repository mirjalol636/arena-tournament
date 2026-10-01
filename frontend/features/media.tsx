"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Play, Video, Plus, Pencil, Archive } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Loading, ErrorState, Empty } from "@/components/competition";
import { useApi } from "@/hooks/use-api";
import { api, mutate } from "@/services/api";
import { date } from "@/lib/utils";
import type { Tournament } from "@/types";
export type MediaItem={id:number;title:string;description:string;media_type:string;video_url:string;thumbnail_url:string;tournament_id:number|null;tournament:string|null;game:string|null;status:string;featured:boolean;provider:string;embed_url:string;published_at:string|null;created_at:string};
export const mediaTypes:Record<string,string>={trailer:'Turnir treyleri',gameplay:'O‘yin lavhasi',highlight:'Eng yaxshi lahzalar',promotion:'Targ‘ibot',announcement:'Video e’lon'};
const mediaStatus:Record<string,string>={draft:'Qoralama',published:'E’lon qilingan',archived:'Arxivlangan'};
function VideoPlayer({item}:{item:MediaItem}) {
 // Only the server-generated, allowlisted embed target reaches an iframe.
 const safeEmbed=/^https:\/\/(www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{11}|player\.vimeo\.com\/video\/\d+)$/.test(item.embed_url);
 return <div className="video-player">{item.provider==='file'?<video src={item.video_url} poster={item.thumbnail_url||undefined} controls playsInline preload="metadata"/>:safeEmbed?<iframe src={item.embed_url} title={item.title} sandbox="allow-scripts allow-same-origin allow-presentation" allow="fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>:<p>Videoni ko‘rsatib bo‘lmadi.</p>}</div>;
}
export function MediaSection({tournamentId,compact=false}:{tournamentId?:number;compact?:boolean}) {
 const [page,setPage]=useState(1),[game,setGame]=useState(''),[selected,setSelected]=useState<MediaItem|null>(null);
 const r=useApi<{items:MediaItem[];total:number}>(`/media?page=${page}&page_size=${compact?3:12}${tournamentId?`&tournament_id=${tournamentId}`:''}&game=${game}`);
 return <section className="section media-section"><div className="section-heading"><div><span className="eyebrow">ARENA KADRLARDA</span><h2>{tournamentId?'Turnir mediasi':'O‘yindan ham ko‘proq'}<span>.</span></h2></div>{!compact&&!tournamentId&&<select aria-label="Media o‘yini" value={game} onChange={e=>{setGame(e.target.value);setPage(1);}}><option value="">Barcha o‘yinlar</option><option value="efootball">eFootball</option><option value="pubg">PUBG Mobile</option></select>}</div>
 {r.loading?<Loading/>:r.error?<ErrorState message={r.error} retry={r.reload}/>:!r.data?.items.length?<Empty title="Hali video joylanmagan" detail="Treylerlar, o‘yin lavhalari va eng yaxshi lahzalar shu yerda paydo bo‘ladi."/>:<div className="media-grid">{r.data.items.map(m=><button className="media-card" key={m.id} onClick={()=>setSelected(m)} aria-label={`${m.title} videosini ochish`}><div className="media-poster">{m.thumbnail_url?<Image unoptimized width={640} height={360} src={m.thumbnail_url} alt="" loading="lazy"/>:<Video size={48}/>}<span className="play-circle"><Play size={20}/></span>{m.featured&&<span className="media-featured">Tavsiya etiladi</span>}</div><div className="media-copy"><small>{mediaTypes[m.media_type]} · {date(m.published_at||m.created_at)}</small><h3>{m.title}</h3><p>{m.description}</p>{m.tournament&&<span className="text-link">{m.tournament}</span>}</div></button>)}</div>}
 {!compact&&r.data&&r.data.total>12&&<div className="pagination"><Button variant="secondary" disabled={page===1} onClick={()=>setPage(p=>p-1)}>Oldingi</Button><span>{page} / {Math.ceil(r.data.total/12)}</span><Button variant="secondary" disabled={page*12>=r.data.total} onClick={()=>setPage(p=>p+1)}>Keyingi</Button></div>}
 <Modal open={!!selected} onOpenChange={v=>{if(!v)setSelected(null);}} title={selected?.title||'Video'} description={selected?.tournament||'ARENA Media'}>{selected&&<><VideoPlayer item={selected}/><p>{selected.description}</p><p className="hint">Video tashqi xizmatdan yuklanadi. Ovoz va ijroni o‘zingiz boshqarasiz.</p></>}</Modal>
 </section>;
}
export function MediaPage(){return <Shell><div className="container page"><MediaSection/></div></Shell>;}
export function MediaAdmin({tournaments}:{tournaments:Tournament[]}) {
 const [page,setPage]=useState(1),[q,setQ]=useState(''),[edit,setEdit]=useState<MediaItem|true|null>(null),[archive,setArchive]=useState<MediaItem|null>(null),[busy,setBusy]=useState(false);
 const r=useApi<{items:MediaItem[];total:number}>(`/admin/media?page=${page}&q=${encodeURIComponent(q)}`);
 const item=typeof edit==='object'?edit:null;
 return <section><div className="section-heading"><div><h2>Media kutubxonasi</h2><p>Treyler va lavhalarni e’lon qiling, turnirga biriktiring.</p></div><Button onClick={()=>setEdit(true)}><Plus size={16}/>Video qo‘shish</Button></div><input aria-label="Videolarni qidirish" placeholder="Sarlavha bo‘yicha qidirish…" value={q} onChange={e=>{setQ(e.target.value);setPage(1);}}/>
 {r.loading?<Loading/>:r.error?<ErrorState message={r.error} retry={r.reload}/>:!r.data?.items.length?<Empty title="Media topilmadi" detail="Birinchi videoni havola orqali qo‘shing."/>:<div className="management-list">{r.data.items.map(m=><article key={m.id}><div className="management-thumb">{m.thumbnail_url?<Image unoptimized width={640} height={360} src={m.thumbnail_url} alt="" loading="lazy"/>:<Video/>}</div><div><small>{mediaTypes[m.media_type]} · {mediaStatus[m.status]}{m.featured?' · Tavsiya etiladi':''}</small><h3>{m.title}</h3><p>{m.tournament||'Umumiy media'}</p></div><div className="row"><Button size="sm" variant="secondary" onClick={()=>setEdit(m)}><Pencil size={15}/>Tahrirlash</Button><Button size="sm" variant="ghost" disabled={m.status==='archived'} onClick={()=>setArchive(m)}><Archive size={15}/>Arxivlash</Button></div></article>)}</div>}
 {r.data&&r.data.total>24&&<div className="pagination"><Button disabled={page===1} onClick={()=>setPage(p=>p-1)}>Oldingi</Button><span>{page}</span><Button disabled={page*24>=r.data.total} onClick={()=>setPage(p=>p+1)}>Keyingi</Button></div>}
 <Modal open={!!edit} onOpenChange={v=>{if(!v&&!busy)setEdit(null);}} title={item?'Videoni tahrirlash':'Video qo‘shish'} description="YouTube, Vimeo yoki ochiq HTTPS MP4/WebM/OGG havolasi. Fayl serverga yuklanmaydi.">{edit&&<form key={item?.id||'new'} className="form" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);try{await mutate(item?`/media/${item.id}`:'/media',{title:f.get('title'),description:f.get('description'),media_type:f.get('media_type'),video_url:f.get('video_url'),thumbnail_url:f.get('thumbnail_url'),tournament_id:f.get('tournament_id')?Number(f.get('tournament_id')):null,game:f.get('game')||null,status:f.get('status'),featured:f.get('featured')==='on'},item?'PUT':'POST');toast.success('Video saqlandi');setEdit(null);await r.reload();}catch(e){toast.error((e as Error).message);}finally{setBusy(false);}}}>
 <label>Sarlavha<input name="title" required minLength={3} maxLength={160} defaultValue={item?.title}/></label><label>Tavsif<textarea name="description" maxLength={5000} defaultValue={item?.description}/></label><label>Video havolasi<input type="url" name="video_url" required placeholder="https://www.youtube.com/watch?v=…" defaultValue={item?.video_url}/></label><label>Muqova rasmi havolasi<input type="url" name="thumbnail_url" placeholder="https://…" defaultValue={item?.thumbnail_url}/></label><div className="form-grid"><label>Video turi<select name="media_type" defaultValue={item?.media_type||'highlight'}>{Object.entries(mediaTypes).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>Holat<select name="status" defaultValue={item?.status||'draft'}>{Object.entries(mediaStatus).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>Turnir<select name="tournament_id" defaultValue={item?.tournament_id||''}><option value="">Umumiy (faqat administrator)</option>{tournaments.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></label><label>O‘yin<select name="game" defaultValue={item?.game||''}><option value="">Belgilanmagan</option><option value="efootball">eFootball</option><option value="pubg">PUBG Mobile</option></select></label></div><label className="checkbox"><input type="checkbox" name="featured" defaultChecked={item?.featured}/>Tavsiya etilgan video</label>{item&&<VideoPlayer item={item}/>}<Button disabled={busy}>{busy?'Saqlanmoqda…':'Saqlash'}</Button></form>}</Modal>
 <Modal open={!!archive} onOpenChange={v=>{if(!v&&!busy)setArchive(null);}} title="Videoni arxivlash" description={archive?.title}><p>Video ommaviy sahifalardan olib tashlanadi. Keyin uni qayta e’lon qilish mumkin.</p><Button disabled={busy} onClick={async()=>{if(!archive)return;setBusy(true);try{await api(`/media/${archive.id}`,{method:'DELETE'});setArchive(null);await r.reload();toast.success('Video arxivlandi');}catch(e){toast.error((e as Error).message);}finally{setBusy(false);}}}>Arxivlashni tasdiqlash</Button></Modal>
 </section>;
}


export function HomeMediaCarousel() {
 const r=useApi<{items:MediaItem[];total:number}>("/media?featured=true&page=1&page_size=6",30000);
 const [index,setIndex]=useState(0);

 useEffect(()=>{
  const count=r.data?.items.length||0;
  if(count<2)return;
  const timer=setInterval(()=>setIndex(current=>(current+1)%count),7000);
  return()=>clearInterval(timer);
 },[r.data?.items.length]);

 if(r.loading)return <Loading/>;
 if(r.error)return null;

 const items=r.data?.items||[];
 if(!items.length)return null;

 const safeIndex=index>=items.length?0:index;
 const item=items[safeIndex];
 const safeEmbed=/^https:\/\/(www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{11}|player\.vimeo\.com\/video\/\d+)$/.test(item.embed_url);
 const autoplayEmbed=safeEmbed?`${item.embed_url}${item.embed_url.includes("?")?"&":"?"}autoplay=1&muted=1&mute=1&playsinline=1`:"";

 return <section className="section home-media-carousel">
  <div className="section-heading">
   <div><span className="eyebrow">ARENA MEDIA</span><h2>Eng yaxshi lavhalar<span>.</span></h2></div>
   <Link href="/media" className="text-link">Barcha videolar →</Link>
  </div>

  <div className="media-carousel-stage">
   <div className="media-carousel-player">
    {item.provider==="file"?<video key={item.id} src={item.video_url} poster={item.thumbnail_url||undefined} autoPlay muted loop playsInline controls preload="metadata"/>:
    safeEmbed?<iframe key={item.id} src={autoplayEmbed} title={item.title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>:
    item.thumbnail_url?<Image unoptimized width={1280} height={720} src={item.thumbnail_url} alt={item.title}/>:
    <div className="media-carousel-fallback"><Video size={60}/></div>}

    <div className="media-carousel-overlay">
     <small>{mediaTypes[item.media_type]||"ARENA Media"}{item.tournament?` · ${item.tournament}`:""}</small>
     <h3>{item.title}</h3>
     <p>{item.description}</p>
    </div>
   </div>

   {items.length>1&&<>
    <button className="media-carousel-arrow previous" aria-label="Oldingi video" onClick={()=>setIndex(current=>current===0?items.length-1:current-1)}>‹</button>
    <button className="media-carousel-arrow next" aria-label="Keyingi video" onClick={()=>setIndex(current=>(current+1)%items.length)}>›</button>
    <div className="media-carousel-dots">
     {items.map((mediaItem,i)=><button key={mediaItem.id} aria-label={`${i+1}-videoga o'tish`} className={i===safeIndex?"active":""} onClick={()=>setIndex(i)}/>)}
    </div>
   </>}
  </div>
 </section>;
}
