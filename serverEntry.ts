import express from 'express';
import { registerWhatsAppWebhook } from './server/kccWhatsAppWebhook.js';

const expressJson = express.json.bind(express);
const expressListen = express.application.listen;

express.json = ((options: any = {}) => expressJson({
  ...options,
  verify(req: any, res: any, buf: Buffer) {
    req.rawBody = Buffer.from(buf);
    if (typeof options.verify === 'function') options.verify(req, res, buf);
  },
})) as typeof express.json;

express.application.listen = function patchedListen(this: express.Application, ...args: any[]) {
  const app = this;
  if (!(app as any).__kccWhatsAppWebhookRegistered) {
    registerWhatsAppWebhook(app);
    (app as any).__kccWhatsAppWebhookRegistered = true;
  }
  return expressListen.apply(app, args as any);
};

await import('./server.ts');
