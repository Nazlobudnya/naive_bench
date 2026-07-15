import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { once } from 'node:events';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import autocannon, { type Options } from 'autocannon';

const WARMUP_RUNS = 3;
const PORT = 3000;
let CONNECTIONS = 100;
let REQUESTS = 10_000;
let DURATION = 10;

const BACKENDS = [
    'node-http',
    'bun-http',
    'uws-http',
    'express',
    'fastify',
    'nest-express',
    'nest-fastify'
];

const p_args = parseArgs({
    options: {
        b: {
            type: 'string',
            multiple: true,
            default: [
                'all'
            ]
        },
        r: {
            type: 'string',
            multiple: false
        },
        c: {
            type: 'string',
            multiple: false
        },
        d: {
            type: 'string',
            multiple: false
        },
        help: {
            type: 'boolean'
        }
    }
});

if (Object.keys(p_args.values).includes('help')) {
    console.log(`
        Autocannon test runner

        -b - specify which backends to test. Default: all. 
            Options:
                all - Test all backend
${BACKENDS.map(b => `\t\t${b}`).join('\n')}

        -r - number of requests to make, when not specified would be picked as benchmark approach instead of [-d]. Default: 10_000

        -c - number of connection. Default: 100

        -d - duration of the test in seconds. Overrides -r. Default: null
        
    `);

    process.exit(0);
}

const { b } = p_args.values;

const backends_to_work = b.includes('all')
    ? BACKENDS
    : BACKENDS.filter(backend => {
          return b!.includes(backend);
      });

console.info(`Will run tests on ${backends_to_work.join(', ')}`);

const body = JSON.stringify({
    name: 'SomeName',
    org: 'SomeCorp'
});

const get_ac_options = (cli_args: typeof p_args.values) => {
    const opts: AC_OPTIONS = {
        connections: CONNECTIONS,
        amount: REQUESTS,
        duration: undefined
    };

    if (cli_args.c) {
        const num = Number.parseInt(cli_args.c);
        if (Number.isFinite(num) && !Number.isNaN(num)) {
            opts.connections = num;
        }
    }

    if (cli_args.d) {
        const num = Number.parseInt(cli_args.d);
        if (Number.isFinite(num) && !Number.isNaN(num)) {
            opts.duration = num;
            opts.amount = undefined;
        }
    }

    if (cli_args.r && !opts.duration) {
        const num = Number.parseInt(cli_args.r);
        if (Number.isFinite(num) && !Number.isNaN(num)) {
            opts.amount = num;
        }
    }

    return opts;
};

type AC_OPTIONS = {
    connections?: number;
    amount?: number;
    duration?: number;
};

const ac_opts = get_ac_options(p_args.values);

const run_autocannon = (opts: AC_OPTIONS) => {
    const ac_opts: Options = {
        url: `http://127.0.0.1:${PORT}/hello`,
        connections: opts.connections,
        amount: opts.duration ? undefined : opts.amount,
        method: 'POST',
        body,
        headers: {
            'content-type': 'application/json',
            authorization: 'Bearer custom_token'
        }
    };

    if (opts.duration) {
        ac_opts.duration = opts.duration;
    }

    return autocannon(ac_opts);
};

const run_autocannon_bench = async (server: ChildProcessWithoutNullStreams, backend: string) => {
    try {
        console.log(`\n=== ${backend} ===`);
        if (WARMUP_RUNS) {
            console.log(`=> Running ${WARMUP_RUNS} warmup rounds`);
        }
        for (let i = 0; i < WARMUP_RUNS; i++) {
            await run_autocannon(ac_opts);
            console.log(`Finished warmup round ${i + 1}`);
        }

        console.log('=> Running actual test');
        const result = await run_autocannon(ac_opts);
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
    // bun runs TS directly, no build step
    const is_bun = backend === 'bun-http';
    const server = spawn(
        is_bun ? 'bun' : 'node',
        [
            is_bun
                ? join(import.meta.dirname, 'packages', backend, 'src', 'main.ts')
                : join(import.meta.dirname, 'packages', backend, 'dist', 'main.js')
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
