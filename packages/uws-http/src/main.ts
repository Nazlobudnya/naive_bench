import { App, type HttpResponse } from 'uWebSockets.js';
import { unknown, z } from 'zod';

const MAX_REQ_PAYLOAD_SIZE_BYTES = 1024 * 1; // 1Kb
const helloBodySchema = z.object({
    name: z.string(),
    org: z.string()
});

function sendJson(res: HttpResponse, status: string, payload: unknown): void {
    const response = JSON.stringify(payload);
    res.cork(() => {
        res.writeStatus(status)
            .writeHeader('content-type', 'application/json; charset=utf-8')
            .end(response);
    });
}

process.on('uncaughtException', (e, o) => {
    console.log(e);
});

process.on('unhandledRejection', (r, o) => {
    console.log(r);
});

const port = Number(process.env.PORT ?? 3000);

App()
    .post('/hello', (res, req) => {
        const authorization = req.getHeader('authorization');

        if (authorization !== 'Bearer custom_token') {
            sendJson(res, '401 Unauthorized', {
                message: 'Unauthorized'
            });
            return;
        }

        let aborted = false;
        res.onAborted(() => {
            aborted = true;
        });

        const finish = (body: unknown) => {
            if (aborted) {
                return;
            }

            const result = helloBodySchema.safeParse(body);
            if (!result.success) {
                sendJson(res, '400 Bad Request', {
                    message: 'Validation failed',
                    errors: result.error.issues
                });
                return;
            }

            const response = `Hi ${result.data.name} from ${result.data.org}`;
            res.cork(() => {
                res.writeStatus('200 OK')
                    .writeHeader('content-type', 'text/plain; charset=utf-8')
                    .end(response);
            });
        };

        res.collectBody(MAX_REQ_PAYLOAD_SIZE_BYTES, raw_body => {
            if (raw_body === null) {
                sendJson(res, '413 Payload size exceeded', {
                    message: 'Payload size exceeded'
                });
                return;
            }

            let body = unknown;
            try {
                body = JSON.parse(Buffer.from(raw_body).toString('utf-8'));
            } catch {
                sendJson(res, '400 Bad Request', {
                    message: 'Invalid JSON'
                });
                return;
            }

            finish(body);
        });
    })
    .any('/*', res => {
        sendJson(res, '404 Not Found', {
            message: 'Not Found'
        });
    })
    .listen(port, token => {
        if (token) {
            console.log(`uWebSockets.js listening on port ${port}`);
        } else {
            console.log(`uWebSockets.js failed to listen on port ${port}`);
            process.exit(1);
        }
    });
