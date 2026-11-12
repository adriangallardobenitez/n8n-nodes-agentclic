// Prueba del nodo contra un servidor simulado con el contrato de la API pro v1.
const http = require('http');
const assert = require('assert');
const { Agentclic } = require(process.argv[2] + '/dist/nodes/Agentclic/Agentclic.node.js');

const CLIENT = '3f1c2a8e-5b7d-4e19-9a62-0c4d8b7e1f20';
const contacts = [];
let calls = [];
let rateLimitOnce = true;
for (let n = 0; n < 130; n++) contacts.push({ id: `c${n}`, name: `Contacto ${n}`, email: `c${n}@x.es`, phone: null });

const server = http.createServer((req, res) => {
	let raw = '';
	req.on('data', (c) => (raw += c));
	req.on('end', () => {
		const url = new URL(req.url, 'http://x');
		const body = raw ? JSON.parse(raw) : undefined;
		calls.push({ method: req.method, path: url.pathname, qs: Object.fromEntries(url.searchParams), body, auth: req.headers.authorization });
		const send = (s, j, h = {}) => { res.writeHead(s, { 'content-type': 'application/json', ...h }); res.end(JSON.stringify(j)); };
		if (req.headers.authorization !== 'Bearer ack_live_test') return send(401, { error: { code: 'UNAUTHORIZED', message: 'Token no válido' } });
		const p = url.pathname.replace('/api/public/pro/v1', '');
		if (p === '/me') return send(200, { token: { name: 't', scopes: ['contacts:write'], clientId: null }, credits: { balance: 10 } });
		if (p === '/clients') {
			if (rateLimitOnce) { rateLimitOnce = false; return send(429, { error: { code: 'RATE_LIMITED', message: 'x' } }, { 'retry-after': '1' }); }
			return send(200, { items: [{ id: CLIENT, name: 'Laura', company: 'Clínica Sol' }, { id: 'other', name: 'Pepe' }] });
		}
		if (p === `/clients/${CLIENT}/contacts/options`) return send(200, { stages: [{ id: 's1', name: 'Nuevo' }], fields: [{ id: 'f1', name: 'Tratamiento', type: 'text' }], channels: ['api'] });
		if (p === `/clients/${CLIENT}/contacts` && req.method === 'GET') {
			const start = Number(url.searchParams.get('cursor') ?? 0);
			const limit = Number(url.searchParams.get('limit') ?? 50);
			const page = contacts.slice(start, start + limit);
			const next = start + limit < contacts.length ? String(start + limit) : null;
			return send(200, { items: page, nextCursor: next, ...(start === 0 ? { total: contacts.length } : {}) });
		}
		if (p === `/clients/${CLIENT}/contacts` && req.method === 'POST') {
			if (body.email === 'existe@x.es') return send(409, { error: { code: 'CONTACT_EXISTS', message: 'Ya existe', details: { field: 'email', contactId: 'c7' } } });
			return send(201, { contact: { id: 'new', ...body } });
		}
		const m = p.match(new RegExp(`^/clients/${CLIENT}/contacts/([^/]+)$`));
		if (m && req.method === 'GET') return m[1] === 'c1' ? send(200, { contact: contacts[1] }) : send(404, { error: { code: 'NOT_FOUND', message: 'No existe' } });
		if (m && req.method === 'PATCH') return send(200, { contact: { id: m[1], ...body } });
		return send(404, { error: { code: 'NOT_FOUND', message: 'ruta' } });
	});
});

function ctx(params, { token = 'ack_live_test', continueOnFail = false, base } = {}) {
	const get = (name, _i, fallback, opts) => {
		let v = name in params ? params[name] : fallback;
		if (opts?.extractValue && v && typeof v === 'object' && 'value' in v) v = v.value;
		return v;
	};
	return {
		getInputData: () => [{ json: {} }],
		getNodeParameter: get,
		getCurrentNodeParameter: (name, opts) => get(name, 0, undefined, opts),
		getNode: () => ({ name: 'Agentclic', type: 'agentclic', typeVersion: 1, parameters: {} }),
		continueOnFail: () => continueOnFail,
		getCredentials: async () => ({ apiToken: token, baseUrl: base + '/api/public/pro/v1/' }),
		helpers: {
			async httpRequestWithAuthentication(_cred, o) {
				const u = new URL(o.url);
				for (const [k, v] of Object.entries(o.qs ?? {})) u.searchParams.set(k, String(v));
				const r = await fetch(u, { method: o.method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: o.body ? JSON.stringify(o.body) : undefined });
				return { statusCode: r.status, headers: Object.fromEntries(r.headers), body: await r.json() };
			},
		},
	};
}

(async () => {
	await new Promise((r) => server.listen(0, r));
	const base = `http://127.0.0.1:${server.address().port}`;
	const node = new Agentclic();
	const run = async (p, o) => (await node.execute.call(ctx(p, { base, ...o })))[0].map((x) => x.json);
	const rl = (v) => ({ mode: 'list', value: v });

	// Cuenta
	assert.equal((await run({ resource: 'account', operation: 'get' }))[0].credits.balance, 10);

	// Clientes (con 429 + Retry-After) y límite
	calls = [];
	const cl = await run({ resource: 'client', operation: 'getAll', returnAll: false, limit: 1 });
	assert.equal(cl.length, 1); assert.equal(calls.length, 2, 'reintenta tras 429');

	// Crear: vacíos fuera, custom fields como mapa, etapa
	calls = [];
	await run({ resource: 'contact', operation: 'create', clientId: rl(CLIENT), name: 'Lucía', email: '', phone: '600112233', additionalFields: { stageId: 's1', notes: '', customFields: { field: [{ fieldId: 'f1', value: 'Implantes' }] } } });
	assert.deepEqual(calls[0].body, { name: 'Lucía', phone: '600112233', stageId: 's1', customFields: { f1: 'Implantes' } });

	// Crear sin identidad → error de configuración
	await assert.rejects(run({ resource: 'contact', operation: 'create', clientId: rl(CLIENT), name: '', email: '', phone: '', additionalFields: { company: 'X' } }), /at least a name/);

	// Crear o actualizar: 409 → PATCH al contacto existente
	calls = [];
	const up = await run({ resource: 'contact', operation: 'upsert', clientId: rl(CLIENT), name: 'Ana', email: 'existe@x.es', phone: '', additionalFields: {} });
	assert.deepEqual(calls.map((c) => c.method), ['POST', 'PATCH']); assert.equal(calls[1].path.endsWith('/c7'), true); assert.equal(up[0].id, 'c7');

	// Crear (sin upsert) con 409 → error, y con continueOnFail devuelve el código y el id existente
	await assert.rejects(run({ resource: 'contact', operation: 'create', clientId: rl(CLIENT), email: 'existe@x.es', additionalFields: {} }), (e) => e.constructor.name === 'NodeApiError' && /already exists/.test(e.message));
	const cof = await run({ resource: 'contact', operation: 'create', clientId: rl(CLIENT), email: 'existe@x.es', additionalFields: {} }, { continueOnFail: true });
	assert.equal(cof[0].code, 'CONTACT_EXISTS'); assert.equal(cof[0].details.contactId, 'c7');

	// Actualizar: vacío borra y etapa vacía → null
	calls = [];
	await run({ resource: 'contact', operation: 'update', clientId: rl(CLIENT), contactId: { mode: 'id', value: 'c3' }, updateFields: { notes: '', stageId: '' } });
	assert.deepEqual(calls[0].body, { notes: '', stageId: null });

	// Obtener y 404
	assert.equal((await run({ resource: 'contact', operation: 'get', clientId: rl(CLIENT), contactId: rl('c1') }))[0].id, 'c1');
	await assert.rejects(run({ resource: 'contact', operation: 'get', clientId: rl(CLIENT), contactId: rl('zz') }), /No existe/);

	// Listar todos: paginación por cursor (130 = 100 + 30)
	calls = [];
	const all = await run({ resource: 'contact', operation: 'getAll', clientId: rl(CLIENT), returnAll: true, filters: { stages: ['s1', 'none'], q: 'ana' } });
	assert.equal(all.length, 130); assert.equal(calls.length, 2); assert.equal(calls[0].qs.stages, 's1,none'); assert.equal(calls[1].qs.cursor, '100');
	const some = await run({ resource: 'contact', operation: 'getAll', clientId: rl(CLIENT), returnAll: false, limit: 7, filters: {} });
	assert.equal(some.length, 7);

	// Token malo → mensaje claro
	await assert.rejects(run({ resource: 'account', operation: 'get' }, { token: 'bad' }), /not valid/);

	// Desplegables
	const lc = ctx({ clientId: rl(CLIENT) }, { base });
	assert.equal((await node.methods.loadOptions.getStages.call(lc))[0].value, 's1');
	assert.equal((await node.methods.loadOptions.getStagesWithNone.call(lc))[0].value, 'none');
	assert.equal((await node.methods.loadOptions.getCustomFields.call(lc))[0].name, 'Tratamiento');
	assert.equal((await node.methods.listSearch.searchClients.call(lc, 'sol')).results.length, 1);
	const sc = await node.methods.listSearch.searchContacts.call(lc, '');
	assert.equal(sc.results.length, 50); assert.equal(sc.paginationToken, '50');

	console.log('OK · todas las pruebas pasan');
	server.close();
})().catch((e) => { console.error('FALLO', e); process.exit(1); });
