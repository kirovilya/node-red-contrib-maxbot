import { readFileSync } from "fs";
import { join } from "path";
import https from "https";
import http from "http";
import { Agent, setGlobalDispatcher } from "undici";

let configured = false;
let ca: string | Buffer;
let httpsAgent: https.Agent;

export function setupMincaCertificate(): void {
  if (configured) return;
  configured = true;

  try {
    const certPath = join(__dirname, "minca-root.pem");
    ca = readFileSync(certPath);

    httpsAgent = new https.Agent({ ca: ca as Buffer });

    const agent = new Agent({ connect: { ca } });
    setGlobalDispatcher(agent);

    console.log("[maxbot] MinCifry certificate configured from", certPath, "(API endpoint: platform-api2.max.ru)");
  } catch (e: any) {
    console.error("[maxbot] Failed to configure MinCifry certificate:", e.message);
  }
}

export interface MultipartBody {
  buffer: Buffer;
  contentType: string;
}

export function createMultipartBody(fieldName: string, buffer: Buffer, filename: string, contentType?: string): MultipartBody {
  const boundary = Math.random().toString(36).substring(2);
  const header = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${contentType || 'application/octet-stream'}\r\n\r\n`
  );
  const footer = Buffer.from(`\r\n--${boundary}--`);
  const bodyBuffer = Buffer.concat([header, buffer, footer, Buffer.from('\r\n')]);
  return {
    buffer: bodyBuffer,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

export function httpsFetch(input: string | URL, init?: RequestInit & { dispatcher?: any; multipartBody?: MultipartBody }): Promise<Response> {
  const url = input instanceof URL ? input : new URL(input);
  const isHttps = url.protocol === 'https:';

  if (!isHttps) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method: init?.method || 'GET',
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve(new Response(Buffer.concat(chunks), {
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers as HeadersInit,
          }));
        });
      });
      req.on('error', reject);
      if (init?.body) req.write(init.body);
      req.end();
    });
  }

  const options: https.RequestOptions = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname + url.search,
    method: init?.method || 'GET',
    agent: httpsAgent,
    ca: ca as Buffer,
    rejectUnauthorized: false,
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        resolve(new Response(Buffer.concat(chunks), {
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers as HeadersInit,
        }));
      });
    });

    req.on('error', reject);

    if (init?.multipartBody) {
      const { buffer, contentType } = init.multipartBody;
      req.setHeader('Content-Type', contentType);
      req.setHeader('Content-Length', buffer.length);
      req.write(buffer);
    } else if (init?.body) {
      req.write(init.body);
    }
    req.end();
  });
}
