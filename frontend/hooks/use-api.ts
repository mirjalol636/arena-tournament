"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {api} from '@/services/api';
export function useApi<T>(path:string|null,interval=0){
  const [data,setData]=useState<T|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const generation=useRef(0);
  const reload=useCallback(async()=>{
    const current=++generation.current;
    if(!path){setData(null);setLoading(false);return;}
    try{const response=await api<T>(path);if(current===generation.current){setData(response);setError('');}}
    catch(e){if(current===generation.current)setError((e as Error).message);}
    finally{if(current===generation.current)setLoading(false);}
  },[path]);
  useEffect(()=>{setLoading(true);setData(null);void reload();const timer=interval?setInterval(reload,interval):undefined;return()=>{generation.current++;if(timer)clearInterval(timer);};},[reload,interval]);
  return {data,error,loading,reload};
}
