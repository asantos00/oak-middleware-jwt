import {
  Context,
  ErrorStatus,
  Handlers,
  JwtObject,
  Middleware,
  Opts,
  RouterContext,
  RouterMiddleware,
  validateJwt,
} from "../deps.ts";

export type customMessagesT = {
  expired?: string; // Message for when the token is expired, uses iat to determine
  invalid?: string; // Message for when the token is invalid
};

export interface JwtMiddlewareOptions {
  secret: string; // Secret key
  decryptedTokenHandler?: (
    ctx: Context | RouterContext,
    jwtObject: JwtObject,
  ) => void; // Callback for decrypted token
  isThrowing?: boolean; // True if you want the throw message from djwt, False, if you prefer custom messages (uses ctx.throw()). Default true, recommended false
  critHandlers?: Handlers; // see djwt
  customMessages?: customMessagesT; // Custom error messages
  expiresAfter?: number; // Duration for expiration, uses iat to determine if the token is expired. E.g. (1000*60*60) = 1 hour expiration time
}

export interface MiddlewareOptions {
  (options: JwtMiddlewareOptions): RouterMiddleware | Middleware;
}

export const jwtMiddleware = <
  T extends RouterMiddleware | Middleware = Middleware,
>({
  secret,
  isThrowing = true,
  critHandlers,
  decryptedTokenHandler,
  customMessages,
  expiresAfter,
}: JwtMiddlewareOptions): T => {
  const jwtMiddlewareCore: RouterMiddleware = async (ctx, next) => {
    let isUnauthorized = true;
    let isExpired = false;

    if (ctx.request.headers.has("Authorization")) {
      const authHeader = ctx.request.headers.get("Authorization")!;
      if (authHeader.startsWith("Bearer ") && authHeader.length > 7) {
        const token = authHeader.slice(7);

        const jwtOptions: Opts = { isThrowing };
        if (critHandlers) jwtOptions.critHandlers = critHandlers;

        const decryptedToken = await validateJwt(
          token,
          secret,
          jwtOptions,
        );

        if (decryptedToken) {
          if (
            expiresAfter &&
            decryptedToken.payload?.iat &&
            decryptedToken.payload?.iat <
              (new Date().getTime() - (expiresAfter || 0))
          ) {
            isExpired = true;
          } else {
            isUnauthorized = false;
            decryptedTokenHandler && decryptedTokenHandler(ctx, decryptedToken);
          }
        }
      }
    }

    if (isUnauthorized) {
      ctx.throw(
        ErrorStatus.Unauthorized,
        isExpired
          ? (customMessages?.expired ?? "Token expired")
          : (customMessages?.invalid ?? "Authentication failed"),
      );
    }

    await next();
  };

  return jwtMiddlewareCore as T;
};

export default { jwtMiddleware };
