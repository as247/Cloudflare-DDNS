const cache = new Map();
const CACHE_EXPIRES = 1000 * 60 * 60 * 24; // 24 hours
export default {
    async fetch(request) {
        cacheCleanup();
        const url = new URL(request.url);
        const params = url.searchParams;
        const zoneId = getParam(params, ['user', 'username', 'login', 'email', 'key']);
        const authToken = getParam(params, ['pass', 'password', 'token', 'access_token', 'secret']);
        const domain = getParam(params, ['host', 'hostname', 'domain']);
        const ip = getParam(params, ['ip', 'myip']) || request.headers.get('CF-Connecting-IP');
        let ttl = parseInt(getParam(params, ['ttl'], '120'), 10);
        if (Number.isNaN(ttl))
            ttl = 120;
        if (ttl !== 1)
            ttl = Math.max(60, Math.min(ttl, 86400));
        const proxied = ['1', 'true', 'yes']
            .includes(getParam(params, ['proxied', 'proxy'], 'false').toLowerCase());

        if (!zoneId || !authToken || !domain || !ip) {
            return new Response('badparam Missing required parameters: user, pass, host, ip', { status: 400 });
        }
        if (!isIPv4(ip) && !isIPv6(ip)) {
            return new Response("badparam");
        }
        const recordType = isIPv6(ip) ? 'AAAA' : 'A';
        const cacheKey=`${zoneId}-${domain}-${recordType}`;
        const cached = cache.get(cacheKey);
        if (cached && cached.content === ip && cached.ttl === ttl && cached.proxied === proxied) {
            return new Response(`nochg ${ip}`);
        }

        const headers = {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
        };
        const context={
            cacheKey,
            headers,
            zoneId,
            recordType,
            domain,
            ip,
            ttl,
            proxied,
        }

        try {
            let existing;
            // Step 1: list all A/AAAA records by domain
            if(!cached){
                logApiCall("Call listing api")
                const listRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?name=${domain}&type=${recordType}`, { headers });
                const listJson = await listRes.json();
                if (!listJson.success) {
                    const code = listJson.errors?.[0]?.code;
                    if (code === 9109 || code === 10000) {
                        return new Response("badauth");
                    }
                    return new Response("911", { status: 500 });
                }
                const records = listJson.result || [];

                if (records.length > 1) {
                    // Delete all, then create new one
                    logApiCall("Call delete api")
                    const results = await Promise.all(records.map(record =>
                        fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${record.id}`, {
                            method: 'DELETE',
                            headers,
                        })
                    ));

                    if (results.some(r => !r.ok))
                        return new Response("911", { status: 500 });
                    const createRes = await createDnsRecord(context);
                    if (createRes.success){
                        saved(createRes.result, context);
                        return new Response(`good ${ip}`)
                    }
                    return new Response('911', { status: 500 });
                }
                existing = records[0];
            }else{
                existing = cached;
            }


            if (existing && existing.content === ip) {
                saved(existing, context);
                return new Response(`nochg ${ip}`);
            }

            if (existing) {
                const updateJson = await updateDnsRecord(existing.id, context);
                if (!updateJson.success) {
                    const code = updateJson.errors?.[0]?.code;
                    if (code === 9109 || code === 10000)
                        return new Response("badauth");
                    if (code !== 81057) {
                        return new Response('911', {status: 500});
                    }
                } else {
                    saved(updateJson.result, context);
                    return new Response(`good ${ip}`);
                }
            }

            const createRes = await createDnsRecord(context);
            if (createRes.success){
                saved(createRes.result, context);
                return new Response(`good ${ip}`);
            }
            return new Response('911', { status: 500 });

        } catch (err) {
            if (err.message === "AUTH")
                return new Response("badauth");
            return new Response("911", { status: 500 });
        }
    }
}

function getParam(params, keys, def = null) {
    for (const key of keys) {
        const val = params.get(key);
        if (val !== null) return val;
    }
    return def;
}

function isIPv4(ip) {
    return /^((25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(25[0-5]|2[0-4]\d|1?\d?\d)$/.test(ip);
}

function isIPv6(ip) {
    return /^[0-9a-fA-F:]+$/.test(ip) && ip.includes(":");
}
function logApiCall(msg){
    console.log(msg);
}
function saved(record, context) {
    cache.set(context.cacheKey, {...record,
        ttl: context.ttl,
        proxied: context.proxied,
        cacheTime: Date.now()});
}
let lastCleanup = 0;
function cacheCleanup(){
    if (Date.now() - lastCleanup < 300000)
        return;
    lastCleanup = Date.now();
    cache.forEach((value, key)=>{
        if(Date.now() - value.cacheTime > CACHE_EXPIRES){
            cache.delete(key);
        }
    });
}
async function updateDnsRecord(id, context) {
    logApiCall("Call update api")
    const updateRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${context.zoneId}/dns_records/${id}`, {
        method: 'PUT',
        headers:context.headers,
        body: JSON.stringify({
            type: context.recordType,
            name: context.domain,
            content: context.ip,
            ttl: context.ttl,
            proxied: context.proxied,
        })
    });
    return updateRes.json();
}
async function createDnsRecord(context) {
    logApiCall("Call create api")
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${context.zoneId}/dns_records`, {
        method: 'POST',
        headers:context.headers,
        body: JSON.stringify({
            type:context.recordType,
            name:context.domain,
            content:context.ip,
            ttl:context.ttl,
            proxied:context.proxied,
        })
    });
    const json = await res.json();

    if (!json.success) {
        const code = json.errors?.[0]?.code;

        if (code === 9109 || code === 10000)
            throw new Error("AUTH");

        throw new Error("CREATE");
    }

    return json;
}
