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

function moveWhatsAppWebhookBeforeProtectedApiGuard(app: express.Application): void {
  const router = (app as any)._router;
  const stack = router?.stack;
  if (!Array.isArray(stack)) throw new Error('KCC Express router stack unavailable; refusing unsafe webhook registration');

  const webhookLayers = stack.filter((layer: any) => layer?.route?.path === '/api/whatsapp/webhook');
  if (webhookLayers.length !== 2) {
    throw new Error(`Expected exactly 2 WhatsApp webhook route layers, found ${webhookLayers.length}`);
  }

  const protectedApiGuardIndex = stack.findIndex((layer: any) =>
    !layer?.route && typeof layer?.handle === 'function' && String(layer.handle).includes('requireOwnerAuth(req, res, next)')
  );

  if (protectedApiGuardIndex < 0) {
    throw new Error('Protected API authorization middleware not found; refusing ambiguous webhook ordering');
  }

  for (const layer of webhookLayers) {
    const index = stack.indexOf(layer);
    if (index >= 0) stack.splice(index, 1);
  }

  const jsonParserIndex = stack.findIndex((layer: any) =>
    layer?.name === 'jsonParser' || layer?.name === 'bodyParser'
  );
  if (jsonParserIndex < 0) {
    throw new Error('Express JSON parser middleware not found; refusing to place webhook before raw-body capture');
  }

  stack.splice(jsonParserIndex + 1, 0, ...webhookLayers);

  const firstWebhookIndex = stack.indexOf(webhookLayers[0]);
  const updatedGuardIndex = stack.findIndex((layer: any) =>
    !layer?.route && typeof layer?.handle === 'function' && String(layer.handle).includes('requireOwnerAuth(req, res, next)')
  );

  if (firstWebhookIndex < 0 || updatedGuardIndex < 0 || firstWebhookIndex >= updatedGuardIndex) {
    throw new Error('WhatsApp webhook route was not placed before protected API authorization middleware');
  }
}

express.application.listen = function patchedListen(this: express.Application, ...args: any[]) {
  const app = this;
  if (!(app as any).__kccWhatsAppWebhookRegistered) {
    registerWhatsAppWebhook(app);
    moveWhatsAppWebhookBeforeProtectedApiGuard(app);
    (app as any).__kccWhatsAppWebhookRegistered = true;
  }
  return expressListen.apply(app, args as any);
};

void import('./server.ts').catch((error) => {
  console.error('[KCC Entrypoint] Failed to load server.ts:', error);
  process.exitCode = 1;
});
