// IncoScord AI secure backend — Node.js 20+
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.OPENAI_API_KEY;
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-5";
const MAX_BODY = 30 * 1024 * 1024;

const server = http.createServer(async (req, res) => {
  const setHeaders = () => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Content-Security-Policy", "default-src 'self' 'unsafe-inline' data: blob: https:; connect-src 'self' https://api.openai.com; img-src 'self' data: blob: https:; media-src 'self' blob: data: https:; object-src 'none'; base-uri 'self';");
  };
  setHeaders();
  const send = (status, data) => { res.writeHead(status, {"Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store"}); res.end(JSON.stringify(data)); };
  const readBody = () => new Promise((resolve, reject) => {
    let raw = ""; req.on("data", chunk => { raw += chunk; if (raw.length > MAX_BODY) { reject(new Error("Request too large (30 MB max).")); req.destroy(); }});
    req.on("end", () => { try { resolve(JSON.parse(raw || "{}")); } catch { reject(new Error("Invalid JSON request.")); }});
    req.on("error", reject);
  });
  const api = async (url, body, method="POST") => {
    const r = await fetch(url, {method, headers: {"Authorization":`Bearer ${API_KEY}`, ...(body ? {"Content-Type":"application/json"} : {})}, ...(body ? {body:JSON.stringify(body)} : {})});
    const data = await r.json().catch(()=>({}));
    if (!r.ok) throw new Error(data.error?.message || `OpenAI API returned HTTP ${r.status}`);
    return data;
  };

  if (req.method === "GET" && req.url === "/api/health") {
    return send(200, {ok:true, configured:Boolean(API_KEY), model:DEFAULT_MODEL, features:["web_search","vision","image_generation","video_generation","local_memory"]});
  }
  if (req.method === "POST" && req.url === "/api/chat") {
    if (!API_KEY) return send(503,{error:"Server not configured. Set OPENAI_API_KEY on the server; never paste a secret into public browser code."});
    try {
      const body = await readBody();
      const messages = Array.isArray(body.messages) ? body.messages : [];
      const system = messages.find(m=>m.role==="system")?.content || "";
      const input = messages.filter(m=>m.role!=="system").map(m=>{
        let content = m.content;
        if (typeof content === "string") return {role:m.role, content};
        if (!Array.isArray(content)) return {role:m.role, content:String(content ?? "")};
        const parts = content.map(p=>{
          if (p.type==="text") return {type:"input_text", text:p.text || ""};
          if (p.type==="image_url") return {type:"input_image", image_url:p.image_url?.url || p.image_url};
          if (p.type==="input_image") return p;
          if (p.type==="input_text") return p;
          return {type:"input_text", text:JSON.stringify(p)};
        });
        return {role:m.role, content:parts};
      });
      const instructions = `${system}\n\nFACT-CHECKING POLICY: For factual, recent, disputed, or specific questions, use the web_search tool before answering. Prefer primary and authoritative sources, cross-check important claims when practical, include concise source links/citations in the final answer, distinguish facts from estimates and opinions, state uncertainty, and never invent citations. For timeless creative requests, do not search unnecessarily.`;
      const result = await api("https://api.openai.com/v1/responses", {
        model: body.model || DEFAULT_MODEL,
        instructions,
        input,
        tools:[{type:"web_search"}],
        tool_choice: body.always_search === false ? "auto" : "required",
        max_output_tokens: body.max_tokens || 2500
      });
      let textOut = result.output_text || "";
      if (!textOut && Array.isArray(result.output)) {
        textOut = result.output.flatMap(item => item.content || []).filter(x=>x.type==="output_text").map(x=>x.text).join("\n");
      }
      return send(200,{output_text:textOut || "The model returned no text. Try again.", response_id:result.id, model:result.model});
    } catch(e) { return send(502,{error:e.message || "Chat request failed."}); }
  }
  if (req.method === "POST" && req.url === "/api/image") {
    if (!API_KEY) return send(503,{error:"Set OPENAI_API_KEY on the server first."});
    try {
      const body = await readBody();
      if (!body.prompt?.trim()) return send(400,{error:"A prompt is required."});
      const result = await api("https://api.openai.com/v1/responses", {
        model: body.model || DEFAULT_MODEL,
        input: body.prompt.trim(),
        tools:[{type:"image_generation", quality:"high", size:"1024x1024"}],
        tool_choice:"required",
        max_output_tokens: 1000
      });
      const item = (result.output || []).find(x=>x.type==="image_generation_call");
      if (item?.result) return send(200,{imageData:`data:image/png;base64,${item.result}`, model:result.model});
      return send(502,{error:"The model did not return an image. Check image-generation access for your API project."});
    } catch(e) { return send(502,{error:e.message || "Image generation failed."}); }
  }
  if (req.method === "POST" && req.url === "/api/video") {
    if (!API_KEY) return send(503,{error:"Set OPENAI_API_KEY on the server first."});
    try {
      const body = await readBody();
      if (!body.prompt?.trim()) return send(400,{error:"A prompt is required."});
      const result = await api("https://api.openai.com/v1/videos", {
        model: body.model || process.env.OPENAI_VIDEO_MODEL || "sora-2",
        prompt: body.prompt.trim(),
        size: body.size || "1280x720",
        seconds: String(body.seconds || "8")
      });
      return send(200,{id:result.id,status:result.status || "queued",message:"Video generation runs asynchronously. Poll /api/video/"+result.id+" for status."});
    } catch(e) { return send(502,{error:e.message || "Video generation failed. Your API project may not have video access."}); }
  }
  if (req.method === "GET" && req.url?.endsWith("/content") && req.url?.startsWith("/api/video/")) {
    if (!API_KEY) return send(503,{error:"Set OPENAI_API_KEY on the server first."});
    const id = decodeURIComponent(req.url.slice("/api/video/".length, -"/content".length));
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) return send(400,{error:"Invalid video job ID."});
    try {
      const r = await fetch(`https://api.openai.com/v1/videos/${id}/content`, {headers:{"Authorization":`Bearer ${API_KEY}`}});
      if (!r.ok) { const d=await r.json().catch(()=>({})); return send(r.status,{error:d.error?.message||`Video download returned HTTP ${r.status}`}); }
      const bytes = Buffer.from(await r.arrayBuffer());
      res.writeHead(200,{"Content-Type":"video/mp4","Content-Length":bytes.length,"Content-Disposition":`attachment; filename="incoscord-${id}.mp4"`,"Cache-Control":"no-store"});
      return res.end(bytes);
    } catch(e) { return send(502,{error:e.message||"Could not download generated video."}); }
  }
  if (req.method === "GET" && req.url?.startsWith("/api/video/")) {
    if (!API_KEY) return send(503,{error:"Set OPENAI_API_KEY on the server first."});
    const id = decodeURIComponent(req.url.slice("/api/video/".length));
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) return send(400,{error:"Invalid video job ID."});
    try {
      const result = await api(`https://api.openai.com/v1/videos/${id}`, null, "GET");
      return send(200,{id:result.id,status:result.status,progress:result.progress,expires_at:result.expires_at,error:result.error});
    } catch(e) { return send(502,{error:e.message || "Could not check video status."}); }
  }

  if (req.method !== "GET" && req.method !== "HEAD") return send(405,{error:"Method not allowed."});
  const pathname = decodeURIComponent((req.url || "/").split("?")[0]);
  const filePath = path.resolve(__dirname, pathname === "/" ? "index.html" : "." + pathname);
  if (!filePath.startsWith(__dirname + path.sep) && filePath !== path.join(__dirname,"index.html")) return send(403,{error:"Forbidden"});
  fs.readFile(filePath,(err, data)=>{
    if(err){res.writeHead(404,{"Content-Type":"text/plain; charset=utf-8"});return res.end("Not found");}
    const ext=path.extname(filePath);
    const type={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".png":"image/png",".svg":"image/svg+xml"}[ext]||"application/octet-stream";
    res.writeHead(200,{"Content-Type":type,"Cache-Control":ext===".html"?"no-cache":"public, max-age=3600"});res.end(data);
  });
});
server.listen(PORT,()=>console.log(`IncoScord AI running at http://localhost:${PORT}`));
