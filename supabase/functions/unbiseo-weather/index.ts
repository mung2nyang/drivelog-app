// 서버 켜기만 — 받기·로그인·답은 handler.ts(시험이 서버를 켜지 않고 불러 쓰게).
import { handleRequest } from './handler.ts'
Deno.serve(handleRequest)
