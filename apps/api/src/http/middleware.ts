import { randomUUID } from 'node:crypto';
import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodType, type z } from 'zod';
import { can, type Permission } from '@fj/shared';
import { AppError, forbidden, unauthenticated } from '../lib/errors.ts';
import type { Logger } from '../lib/logger.ts';
import type { Auth } from '../auth/auth.ts';
import './context.ts';

export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  req.id = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
};

/** Loads the signed-in user (if any) from the session cookie. */
export function loadSession(auth: Auth): RequestHandler {
  return async (req, _res, next) => {
    const user = await auth.getSessionUser(req.headers);
    if (user) req.user = user;
    next();
  };
}

export const requireUser: RequestHandler = (req, _res, next) => {
  if (!req.user) throw unauthenticated();
  next();
};

/** Requires a workspace permission. Must run after workspaceContext(). */
export function authorize(permission: Permission): RequestHandler {
  return (req, _res, next) => {
    if (!req.workspace) throw new AppError('INTERNAL', 'Workspace context missing');
    if (!can(req.workspace.role, permission)) throw forbidden();
    next();
  };
}

export function parse<S extends ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError('VALIDATION_FAILED', 'Some fields are invalid', formatZodError(result.error));
  }
  return result.data;
}

function formatZodError(error: ZodError) {
  return error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError('NOT_FOUND', 'Route not found'));
};

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, req: Request, res: Response, _next: NextFunction) => {
    let appError: AppError;
    if (err instanceof AppError) appError = err;
    else if (err instanceof ZodError) {
      appError = new AppError('VALIDATION_FAILED', 'Some fields are invalid', formatZodError(err));
    } else if (isBodyParseError(err)) {
      appError = new AppError('VALIDATION_FAILED', 'Request body is not valid JSON');
    } else {
      appError = new AppError('INTERNAL', 'Something went wrong on our side');
      logger.error({ err, requestId: req.id, path: req.path }, 'unhandled error');
    }
    res.status(appError.httpStatus).json({
      error: {
        code: appError.code,
        message: appError.message,
        ...(appError.details !== undefined ? { details: appError.details } : {}),
        requestId: req.id,
      },
    });
  };
}

function isBodyParseError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.parse.failed';
}

/**
 * Fixed-window rate limiter held in memory (plans/13 §3). Fine for a single API instance;
 * swap the store for Redis or Postgres when running several instances.
 */
export function rateLimit(opts: { windowMs: number; max: number; key: (req: Request) => string }): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, opts.windowMs);
  sweep.unref();
  return (req, res, next) => {
    const now = Date.now();
    const key = opts.key(req);
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + opts.windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > opts.max) {
      res.setHeader('retry-after', Math.ceil((entry.resetAt - now) / 1000));
      throw new AppError('RATE_LIMITED', 'Too many requests. Please slow down.');
    }
    next();
  };
}
