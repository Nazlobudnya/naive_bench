import { App, type HttpResponse } from 'uWebSockets.js';
import { z } from 'zod';

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

        // Chunk memory is owned by uWS and invalid after each onData
        // callback returns, so non-last chunks must be copied
        let pending: Buffer | null = null;
        res.onData((chunk, isLast) => {
            if (!isLast) {
                pending = pending
                    ? Buffer.concat([
                          pending,
                          Buffer.from(chunk)
                      ])
                    : Buffer.concat([
                          Buffer.from(chunk)
                      ]);
                return;
            }

            const raw = pending
                ? Buffer.concat([
                      pending,
                      Buffer.from(chunk)
                  ]).toString('utf8')
                : Buffer.from(chunk).toString('utf8');

            let body: unknown;
            try {
                body = JSON.parse(raw);
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
