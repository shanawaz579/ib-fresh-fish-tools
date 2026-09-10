import { createClient } from 'npm:@supabase/supabase-js@2.81.1';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'working' },
  auth: { persistSession: false, autoRefreshToken: false },
});

const securityHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function publicError(message?: string) {
  if (message && /(invalid|expired|view only|not available)/i.test(message)) return message;
  return 'Unable to load the packing list. Ask the proprietor for a new link.';
}

function page() {
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <meta name="referrer" content="no-referrer" />
  <title>Packing List</title>
  <style nonce="${nonce}">
    :root{color-scheme:light;font-family:Inter,system-ui,-apple-system,sans-serif;background:#f6f8fb;color:#0f172a}
    *{box-sizing:border-box}body{margin:0;background:#f6f8fb}.header{background:#92400e;color:#fff;padding:calc(22px + env(safe-area-inset-top)) 18px 18px}.eyebrow{font-size:10px;font-weight:900;letter-spacing:1.4px;color:#fed7aa}.title{font-size:25px;font-weight:900;margin:4px 0}.date{font-size:12px;color:#ffedd5}.shell{max-width:680px;margin:auto}.body{padding:14px 14px 48px}.progress{display:flex;justify-content:space-between;align-items:center;background:#0f172a;color:#fff;padding:15px;border-radius:16px;margin-bottom:14px}.progress small{display:block;color:#94a3b8;font-size:9px;font-weight:900;letter-spacing:1px}.progress strong{display:block;margin-top:4px;font-size:16px}.badge{background:#7c2d12;color:#ffedd5;border-radius:12px;padding:9px 12px;font-size:12px;font-weight:900}.mode{margin:0 0 13px;color:#64748b;font-size:12px;font-weight:700}.section{display:flex;align-items:center;justify-content:space-between;margin:16px 2px 9px}.section h2{font-size:14px;margin:0}.section span{font-size:11px;color:#94a3b8}.card{background:#fff;border:1px solid #e2e8f0;border-left:4px solid #f59e0b;border-radius:14px;margin-bottom:10px;overflow:hidden;box-shadow:0 2px 4px #0f172a0a}.card.complete{border-left-color:#10b981}.customer{display:flex;justify-content:space-between;gap:12px;padding:13px 12px;font-weight:900}.total{white-space:nowrap;color:#b45309;font-size:12px}.item{display:grid;grid-template-columns:minmax(0,1fr) auto 44px;gap:10px;align-items:center;border-top:1px solid #f1f5f9;padding:10px 12px}.item-name{font-size:13px;font-weight:750}.quantity{font-size:12px;font-weight:900;color:#92400e;white-space:nowrap}.check{appearance:none;width:38px;height:38px;border:2px solid #cbd5e1;border-radius:10px;background:#fff;margin:0;display:grid;place-items:center}.check:checked{background:#10b981;border-color:#10b981}.check:checked:after{content:'✓';font-size:22px;font-weight:900;color:white}.check:disabled{opacity:.7}.item.done .item-name,.item.done .quantity{color:#94a3b8;text-decoration:line-through}.empty,.error{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:28px 18px;text-align:center;color:#64748b}.error{color:#991b1b;border-color:#fecaca;background:#fff7f7}.retry{border:0;background:#92400e;color:#fff;border-radius:10px;padding:10px 18px;font-weight:800;margin-top:12px}.loading{padding:60px;text-align:center;color:#64748b}.footer{text-align:center;color:#94a3b8;font-size:10px;padding-top:16px}
  </style>
</head>
<body>
  <div class="shell">
    <header class="header"><div class="eyebrow" id="business">PACKING TEAM</div><div class="title">Packing List</div><div class="date" id="date">Loading today’s list…</div></header>
    <main class="body" id="app"><div class="loading">Loading packing list…</div></main>
  </div>
  <script nonce="${nonce}">
    const params=new URLSearchParams(location.search);const token=params.get('token')||'';
    const sessionKey='packing-share-session';let sessionId=localStorage.getItem(sessionKey);if(!sessionId){sessionId=crypto.randomUUID();localStorage.setItem(sessionKey,sessionId)}
    const app=document.getElementById('app');let model=null;
    const quantity=(crates,kg)=>[crates>0?crates+' cr':'',kg>0?Number(kg)+' kg':''].filter(Boolean).join(' · ')||'0';
    const esc=value=>{const node=document.createElement('span');node.textContent=String(value??'');return node.innerHTML};
    function render(){
      const customers=[...(model.customers||[])].sort((a,b)=>{const ac=a.items.every(i=>i.loaded),bc=b.items.every(i=>i.loaded);return Number(ac)-Number(bc)||b.totalCrates-a.totalCrates||b.totalKg-a.totalKg||a.customerName.localeCompare(b.customerName)});
      const items=customers.flatMap(c=>c.items);const packed=items.filter(i=>i.loaded).length;const pending=customers.filter(c=>!c.items.every(i=>i.loaded)).length;
      document.getElementById('business').textContent=(model.businessName||'PACKING TEAM').toUpperCase();document.getElementById('date').textContent=model.packingDate;
      let out='<section class="progress"><div><small>PACKING PROGRESS</small><strong>'+packed+' of '+items.length+' items packed</strong></div><div class="badge">'+pending+' pending</div></section>';
      out+='<p class="mode">'+(model.allowUpdates?'Tap a checkbox when an item is packed. Changes sync to the proprietor’s app.':'View-only list')+'</p>';
      if(!customers.length){out+='<div class="empty">No selected sales remain for this packing list.</div>'}else{
        out+='<div class="section"><h2>Customer loads</h2><span>'+customers.length+' customers</span></div>';
        for(const customer of customers){const complete=customer.items.every(i=>i.loaded);out+='<article class="card '+(complete?'complete':'')+'"><div class="customer"><span>'+esc(customer.customerName)+'</span><span class="total">'+quantity(customer.totalCrates,customer.totalKg)+'</span></div>';
          for(const item of customer.items){out+='<label class="item '+(item.loaded?'done':'')+'"><span class="item-name">'+esc(item.name)+'</span><span class="quantity">'+quantity(item.crates,item.kg)+'</span><input class="check" type="checkbox" data-sale="'+item.saleId+'" '+(item.loaded?'checked':'')+' '+(!model.allowUpdates?'disabled':'')+' aria-label="Mark '+esc(item.name)+' packed" /></label>'}out+='</article>'}
      }
      out+='<div class="footer">This private link expires automatically. Do not forward it.</div>';app.innerHTML=out;
      app.querySelectorAll('.check').forEach(input=>input.addEventListener('change',update));
    }
    async function update(event){const input=event.currentTarget;const saleId=Number(input.dataset.sale);const loaded=input.checked;input.disabled=true;try{const response=await fetch(location.pathname,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,saleId,loaded,sessionId})});const body=await response.json();if(!response.ok)throw new Error(body.error);for(const customer of model.customers){const item=customer.items.find(i=>i.saleId===saleId);if(item)item.loaded=loaded}render()}catch(error){input.checked=!loaded;input.disabled=false;alert(error.message||'Could not save. Try again.') }}
    async function load(){try{const response=await fetch(location.pathname+'?format=json&token='+encodeURIComponent(token),{cache:'no-store'});const body=await response.json();if(!response.ok)throw new Error(body.error);model=body;render()}catch(error){app.innerHTML='<div class="error">'+esc(error.message||'This link is unavailable.')+'<br/><button class="retry" id="retry">Try again</button></div>';document.getElementById('retry').addEventListener('click',()=>location.reload())}}
    load();
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      ...securityHeaders,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`,
    },
  });
}

Deno.serve(async (request) => {
  if (!supabaseUrl || !supabaseAnonKey) return json({ error: 'Packing service is not configured.' }, 503);

  const url = new URL(request.url);

  if (request.method === 'GET' && url.searchParams.get('format') !== 'json') return page();

  if (request.method === 'GET') {
    const token = url.searchParams.get('token') ?? '';
    const { data, error } = await supabase.rpc('get_packing_share', { p_token: token });
    if (error) return json({ error: publicError(error.message) }, 404);
    return json(data);
  }

  if (request.method === 'POST') {
    let body: { token?: string; saleId?: number; loaded?: boolean; sessionId?: string };
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid request.' }, 400);
    }

    if (!body.token || !Number.isSafeInteger(body.saleId) || typeof body.loaded !== 'boolean') {
      return json({ error: 'Invalid packing update.' }, 400);
    }

    const { data, error } = await supabase.rpc('update_shared_packing_status', {
      p_token: body.token,
      p_sale_id: body.saleId,
      p_loaded: body.loaded,
      p_session_id: body.sessionId ?? null,
    });
    if (error) return json({ error: publicError(error.message) }, 403);
    return json(data);
  }

  return new Response(null, { status: 405, headers: { ...securityHeaders, Allow: 'GET, POST' } });
});
