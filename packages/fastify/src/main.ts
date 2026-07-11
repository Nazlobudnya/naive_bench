import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { z } from 'zod';

const helloBodySchema = z.object({
    name: z.string(),
    org: z.string(),
});

async function authGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (request.headers.authorization !== 'Bearer custom_token') {
        await reply.code(401).send({
            message: 'Unauthorized',
        });
    }
}

const app = Fastify();
app.post(
    '/hello',
    {
        onRequest: authGuard,
    },
    async (request, reply) => {
        const result = helloBodySchema.safeParse(request.body);
        if (!result.success) {
            return reply.code(400).send({
                message: 'Validation failed',
                errors: result.error.issues,
            });
        }

        // const json = {
        //     user: {
        //         name: result.data.name,
        //         org: result.data.org,
        //         addr: 'some place far away',
        //         preferences: {
        //             personal_notif: true,
        //             channel_notif: true,
        //             banner_type: 'slim',
        //             card_type: 'extended',
        //         },
        //     },
        //     channels: [
        //         'safaewrgdgag',
        //         'sdfaertgjklasnjg',
        //         'elk2m342easdlc;vkm',
        //     ],
        // };

        reply.header('content-type', 'application/json');
        // return json;
        return `Hi ${result.data.name} from ${result.data.org}\n`;
    },
);

const port = Number(process.env.PORT ?? 3000);
app.listen(
    {
        port,
    },
    err => {
        if (err) {
            console.error(err);
            process.exit(1);
        }
        console.log(`fastify listening on port ${port}`);
    },
);
