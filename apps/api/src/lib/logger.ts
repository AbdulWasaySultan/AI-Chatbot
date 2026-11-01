import { pino, type Logger } from 'pino';

// Customer contact details and message text are never logged (plans/04 §7).
const REDACT = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
  '*.password',
  '*.phone',
  '*.email',
  '*.text',
  '*.token',
];

export function createLogger(level: string): Logger {
  return pino({
    level,
    redact: { paths: REDACT, censor: '[redacted]' },
    base: { service: 'api' },
  });
}

export type { Logger };
