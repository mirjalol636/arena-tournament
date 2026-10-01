"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {api} from '@/services/api';
export function useApi<T>(path:string|null,interval=0){
 const [fetchedPath,setFetchedPath]=useState<string|null>(null);
 const [data,setData]=useState<T|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const generation=useRef(0), controller=useRef<AbortController|null>(null);
 const reload=useCallback(()=>{
  const current=++generation.current;
  controller.current?.abort();
  if(!path)return Promise.resolve();
  const abort=new AbortController();controller.current=abort;
  return api<T>(path,{signal:abort.signal}).then(response=>{
   if(!abort.signal.aborted&&current===generation.current){setData(response);setError('');}
  }).catch((e:Error)=>{if(!abort.signal.aborted&&current===generation.current)setError(e.message);})
  .finally(()=>{if(!abort.signal.aborted&&current===generation.current){setLoading(false);setFetchedPath(path);}});
 },[path]);
 useEffect(()=>{
  void reload();
  const visibleReload=()=>{if(document.visibilityState==='visible')void reload();};
  const timer=interval?setInterval(visibleReload,interval):undefined;
  if(interval)document.addEventListener('visibilitychange',visibleReload);
  return()=>{controller.current?.abort();if(timer)clearInterval(timer);document.removeEventListener('visibilitychange',visibleReload);};
 },[reload,interval]);
 return {data:fetchedPath===path?data:null,error:fetchedPath===path?error:'',loading:!!path&&(fetchedPath!==path||loading),reload};
}
