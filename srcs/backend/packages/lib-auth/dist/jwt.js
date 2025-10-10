// src/jwt.ts
import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
// TODO
// use private/public key pair
export default fp(async (auth) => {
    auth.register(jwt, {
        secret: process.env.JWT_SECRET,
    });
    auth.decorate('authenticate', async (req, reply) => {
        try {
            await req.jwtVerify();
        }
        catch {
            return reply.code(401).send({ error: 'Unauthorized' });
        }
    });
});
//# sourceMappingURL=jwt.js.map