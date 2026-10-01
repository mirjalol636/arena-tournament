/** API boundary: internal English errors never leak into product copy. */
const rules: [RegExp,string][] = [
 [/already registered|already a participant|already admitted/i,'Siz ushbu turnirga allaqachon yozilgansiz.'],
 [/already approved|cannot change approved/i,'Tasdiqlangan arizani qayta o‘zgartirib bo‘lmaydi.'],
 [/capacity|full/i,'Turnirdagi bo‘sh joylar tugagan. Arizani kutish ro‘yxatiga o‘tkazing.'],
 [/captain/i,'Bu amalni faqat jamoa sardori bajarishi mumkin.'],
 [/roster is locked/i,'Turnirga qabul qilingan jamoa tarkibi tarixni saqlash uchun qulflangan. Yangi tarkib uchun yangi jamoa yarating.'],
 [/team size|members|roster/i,'Jamoa tarkibi turnir talablariga mos emas. Asosiy va zaxira o‘yinchilarni tekshiring.'],
 [/game id/i,'Profilingizda ushbu o‘yin uchun ID kiriting.'],
 [/invalid credentials|incorrect|password/i,'Elektron pochta yoki parol noto‘g‘ri.'],
 [/email|nickname.*exists/i,'Bu elektron pochta yoki taxallus allaqachon ishlatilgan.'],
 [/slug.*locked|game, mode and format.*locked/i,'Arizalar mavjud: havola, o‘yin va formatni o‘zgartirib bo‘lmaydi.'],
 [/changed by another/i,'Boshqa tashkilotchi ma’lumotni yangiladi. Sahifani yangilab, qayta urinib ko‘ring.'],
 [/exists|duplicate|conflict/i,'Bu ma’lumot allaqachon mavjud. Sahifani yangilab tekshiring.'],
 [/registration must end|tournament end/i,'Sanalar ketma-ketligini tekshiring: qabul boshlanishi → qabul tugashi → turnir boshlanishi → turnir yakuni.'],
 [/https|video|url|host/i,'Ochiq HTTPS havola kiriting. Video uchun YouTube, Vimeo yoki MP4/WebM/OGG havolasi kerak.'],
 [/prize/i,'Sovrinlar yig‘indisi mukofot jamg‘armasidan oshmasligi kerak.'],
 [/not found/i,'So‘ralgan ma’lumot topilmadi.'],
 [/permission|access|forbidden|manage|authorized/i,'Bu amal uchun sizda ruxsat yo‘q.'],
 [/scheduled|scheduling|locked/i,'Turnir jadvali tuzilgan. Bu o‘zgartirishga ruxsat berilmaydi.'],
 [/registration.*closed/i,'Ro‘yxatdan o‘tish yopilgan.'],
];
export function apiMessage(detail: unknown,status:number):string {
 if (detail && typeof detail==='object' && !Array.isArray(detail) && 'message' in detail && typeof detail.message==='string') return detail.message;
 const text=typeof detail==='string'?detail:Array.isArray(detail)?detail.map(x=>String(x.msg||'')).join(' '):'';
 for(const [pattern,message] of rules) if(pattern.test(text)) return message;
 return status===401?'Hisobingizga qayta kiring.':status===403?'Bu amal uchun sizda ruxsat yo‘q.':status===404?'Ma’lumot topilmadi.':status===422?'Kiritilgan ma’lumotlarni tekshiring. Majburiy maydonlar va qiymatlar to‘g‘ri bo‘lishi kerak.':status===429?'So‘rovlar ko‘payib ketdi. Biroz kutib, qayta urinib ko‘ring.':status===409?'Ma’lumot holati o‘zgargan. Sahifani yangilab, qayta tekshiring.':'Xizmatga ulanishda xatolik. Birozdan so‘ng qayta urinib ko‘ring.';
}
