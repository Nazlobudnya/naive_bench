import { z } from 'zod';

const helloBodySchema = z.object({
    name: z.string(),
    org: z.string()
});

function jsonResponse(statusCode: number, payload: unknown): Response {
    return new Response(JSON.stringify(payload), {
        status: statusCode,
        headers: {
            'content-type': 'application/json; charset=utf-8'
        }
    });
}

process.on('uncaughtException', (e, o) => {
    console.log(e);
});

process.on('unhandledRejection', (r, o) => {
    console.log(r);
});

const port = Number(process.env.PORT ?? 3000);

Bun.serve({
    port,
    async fetch(req) {
        if (req.method !== 'POST' || new URL(req.url).pathname !== '/hello') {
            return jsonResponse(404, {
                message: 'Not Found'
            });
        }

        if (req.headers.get('authorization') !== 'Bearer custom_token') {
            return jsonResponse(401, {
                message: 'Unauthorized'
            });
        }

        let body: unknown;
        try {
            body = await req.json();
        } catch {
            return jsonResponse(400, {
                message: 'Invalid JSON'
            });
        }

        const result = helloBodySchema.safeParse(body);
        if (!result.success) {
            return jsonResponse(400, {
                message: 'Validation failed',
                errors: result.error.issues
            });
        }

        return new Response(`Hi ${result.data.name} from ${result.data.org}`, {
            headers: {
                'content-type': 'text/plain; charset=utf-8'
            }
        });
    }
});

console.log(`bun listening on port ${port}`);
