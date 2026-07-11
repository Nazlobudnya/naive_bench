import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { once } from 'node:events';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import autocannon from 'autocannon';

const WARMUP_RUNS = 0;
const PORT = 3000;
const CONNECTIONS = 100;
const REQUESTS = 10_000;
const BACKENDS = [
    'node-http',
    'express',
    'fastify',
    'nest-express',
    'nest-fastify'
];

const p_args = parseArgs({
    options: {
        b: {
            type: 'string',
            multiple: true
        }
    }
});

const args = p_args.values;

if (!args.b?.length) {
    console.log(
        `
        Use [-b] option to pass which backends to test. Options:
        all - Test all backends
        ${BACKENDS.join('\n')}
        `
    );
    process.exit(0);
}
const backends_to_work = args.b.includes('all')
    ? BACKENDS
    : BACKENDS.filter(b => {
          return args.b!.includes(b);
      });

const body = JSON.stringify({
    name: 'SomeName',
    org: 'SomeCorp'
});

const run_autocannon = () => {
    return autocannon({
        url: `http://127.0.0.1:${PORT}/hello`,
        connections: CONNECTIONS,
        amount: REQUESTS,
        method: 'POST',
        body,
        headers: {
            'content-type': 'application/json',
            authorization: 'Bearer custom_token'
        }
    });
};

const run_autocannon_bench = async (server: ChildProcessWithoutNullStreams, backend: string) => {
    try {
        console.log(`\n=== ${backend} ===`);
        if (WARMUP_RUNS) {
            console.log(`Running ${WARMUP_RUNS} warmup rounds`);
        }
        for (let i = 0; i < WARMUP_RUNS; i++) {
            await run_autocannon();
            console.log(`Finished warmup round ${i + 1}`);
        }

        // Real run
        const result = await run_autocannon();
        console.log(autocannon.printResult(result));
    } catch (error) {
        console.log('Error during autocannon testing');
        console.log(error);
    } finally {
        server.kill();
        await once(server, 'exit');
    }
};

const wait_for_listening = (server: ChildProcessWithoutNullStreams) => {
    return new Promise<void>((resolve, reject) => {
        server.stdout.on('data', (m: string) => {
            // @NOTE: simple way to wait for nest or other backend to start ie check for console.log messages
            if (m.includes('listening on port') || m.includes('successfully started')) {
                resolve();
            }
        });
        server.on('error', reject);
        server.on('exit', code => {
            reject(new Error(`Server exited before listening (code ${code})`));
        });
    });
};

for (const backend of backends_to_work) {
    const server = spawn(
        'node',
        [
            join(import.meta.dirname, 'packages', backend, 'dist', 'main.js')
        ],
        {
            env: {
                ...process.env,
                PORT: String(PORT)
            },
            stdio: 'pipe'
        }
    );
    server.stdout.setEncoding('utf8');

    try {
        await wait_for_listening(server);
        await run_autocannon_bench(server, backend);
    } catch (error) {
        console.log(`Failed to start ${backend}`);
        console.log(error);
        server.kill();
    }
}
