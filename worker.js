export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
  const reply=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers});
  if(url.pathname==='/api/status')return reply({ready:!!env.DB,protected:!!env.SYNC_TOKEN});
  if(!env.DB||!env.SYNC_TOKEN)return reply({error:'Configurare binding DB e secret SYNC_TOKEN'},503);
  if(request.headers.get('Authorization')!==`Bearer ${env.SYNC_TOKEN}`)return reply({error:'Accesso non autorizzato'},401);
  if(url.pathname!=='/api/snapshot')return reply({error:'Non trovato'},404);
  try {
   await env.DB.prepare('CREATE TABLE IF NOT EXISTS crm_snapshots (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL, updated_at TEXT NOT NULL)').run();
   if(request.method==='GET'){
    const record=await env.DB.prepare('SELECT payload,updated_at FROM crm_snapshots WHERE id=1').first();
    return reply(record?{exists:true,data:JSON.parse(record.payload),updated_at:record.updated_at}:{exists:false});
   }
   if(request.method==='PUT'){
    const body=await request.json();
    if(!body||typeof body!=='object'||!Array.isArray(body.clients)||!Array.isArray(body.visits)||!Array.isArray(body.invoices))return reply({error:'Dati non validi'},400);
    const payload=JSON.stringify(body);
    if(payload.length>1500000)return reply({error:'Archivio troppo grande'},413);
    const now=new Date().toISOString();
    await env.DB.prepare('INSERT INTO crm_snapshots(id,payload,updated_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').bind(payload,now).run();
    return reply({ok:true,updated_at:now});
   }
   return reply({error:'Metodo non consentito'},405);
  }catch(e){return reply({error:'Errore database: '+e.message},500)}
 }
};
