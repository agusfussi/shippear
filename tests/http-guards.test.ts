import assert from "node:assert/strict"
import test from "node:test"
import { z } from "zod"
import { ApiError, body } from "../lib/db/http"

const schema=z.object({nombre:z.string()})
const request=(payload:string,origin="https://app.example.invalid")=>new Request("https://app.example.invalid/api/prueba",{method:"POST",headers:{Origin:origin},body:payload})
test("decodifica JSON y texto UTF-8 sin realizar solicitudes de red",async()=>{assert.deepEqual(await body(request('{"nombre":"Té"}'),schema),{nombre:"Té"})})
test("rechaza JSON inválido con 400",async()=>{await assert.rejects(()=>body(request("no-json"),schema),(e:unknown)=>e instanceof ApiError&&e.status===400)})
test("rechaza cambios desde otro origen con 403",async()=>{await assert.rejects(()=>body(request("{}","https://otro.example.invalid"),schema),(e:unknown)=>e instanceof ApiError&&e.status===403)})
test("limita el tamaño aunque no haya Content-Length",async()=>{await assert.rejects(()=>body(request("a".repeat(100001)),schema),(e:unknown)=>e instanceof ApiError&&e.status===413)})
