import type { FastifyInstance } from 'fastify';
declare module 'fastify' {
    interface FastifyInstance {
        authenticate(req: FastifyRequest, reply: FastifyReply): void;
    }
}
export type JWT = FastifyInstance['jwt'];
declare const _default: (auth: FastifyInstance<import("fastify").RawServerDefault, import("http").IncomingMessage, import("http").ServerResponse<import("http").IncomingMessage>, import("fastify").FastifyBaseLogger, import("fastify").FastifyTypeProviderDefault>) => Promise<void>;
export default _default;
//# sourceMappingURL=jwt.d.ts.map