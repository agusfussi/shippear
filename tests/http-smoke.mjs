import assert from "node:assert/strict"
const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3100"
const cases = [
  ["/login", {}, 200], ["/api/auth/session", {}, 401], ["/api/comercios", {}, 401],
  ["/api/mapa", {}, 401], ["/api/metricas", {}, 401], ["/api/productos", {}, 401],
  ["/api/visitas/20000000-0000-4000-8000-000000000001/analizar", {method:"POST",headers:{"Content-Type":"application/json"},body:"{}"}, 401],
  ["/api/auth/login", {method:"POST",headers:{"Content-Type":"application/json"},body:"{}"}, 400],
  ["/api/auth/login", {method:"POST",headers:{Origin:"https://origen-no-autorizado.invalid","Content-Type":"application/json"},body:"{}"}, 403],
  ["/api/no-existe", {}, 404],
]
for (const [path, options, expected] of cases) {
  const response = await fetch(base+path, options)
  assert.equal(response.status, expected, `${path}: se esperaba ${expected}, se recibió ${response.status}`)
  if (path.startsWith("/api/")) {
    const data=await response.json();assert.equal(typeof data.error,"string")
    assert.match(response.headers.get("cache-control")||"",/no-store/)
  }
  console.log(`PASS ${options.method||"GET"} ${path}: ${response.status}`)
}
