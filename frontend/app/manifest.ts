import type { MetadataRoute } from 'next';
export default function manifest():MetadataRoute.Manifest{return {name:'ARENA Tournament Manager',short_name:'ARENA',description:'Turnirlar, natijalar va jamoalar bir joyda',lang:'uz',start_url:'/',display:'standalone',background_color:'#090a10',theme_color:'#090a10',icons:[{src:'/favicon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]};}
