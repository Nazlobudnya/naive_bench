import { createServer, type ServerResponse } from 'node:http';
import { z } from 'zod';

const helloBodySchema = z.object({
    name: z.string(),
    org: z.string()
});

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
    const response = JSON.stringify(payload);
    res.writeHead(statusCode, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': response.length
    });
    res.end(response);
}

const server = createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/hello') {
        sendJson(res, 404, {
            message: 'Not Found'
        });
        return;
    }

    if (req.headers.authorization !== 'Bearer custom_token') {
        sendJson(res, 401, {
            message: 'Unauthorized'
        });
        return;
    }

    req.setEncoding('utf8');
    let raw: string = '';

    const onData = (chunk: string) => {
        raw += chunk;
    };

    const onEnd = async () => {
        cleanup();

        let body: unknown;
        try {
            body = JSON.parse(raw);
        } catch {
            sendJson(res, 400, {
                message: 'Invalid JSON'
            });
            return;
        }

        const result = helloBodySchema.safeParse(body);
        if (!result.success) {
            sendJson(res, 400, {
                message: 'Validation failed',
                errors: result.error.issues
            });
            return;
        }

        const response = `Hi ${result.data.name} from ${result.data.org}`;
        res.writeHead(200, {
            'content-type': 'text/plain; charset=utf-8',
            'content-length': response.length
        });
        res.end(response);
    };

    const onError = () => {
        cleanup();
    };

    const cleanup = () => {
        req.removeListener('data', onData);
        req.removeListener('end', onEnd);
        req.removeListener('error', onError);
    };

    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
});

process.on('uncaughtException', (e, o) => {
    console.log(e);
});

process.on('unhandledRejection', (r, o) => {
    console.log(r);
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => {
    console.log(`node:http listening on port ${port}`);
});
