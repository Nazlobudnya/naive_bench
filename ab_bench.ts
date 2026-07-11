import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { once } from 'node:events';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const WARMUP_RUNS = 0;
const PORT = 3000;
const CONNECTIONS = 100;
const REQUESTS = 10_000;
const BACKENDS = [
    'node-http',
    'express',
    'fastify',
    'nest-express',
    'nest-fastify',
];

const bodyFile = join(tmpdir(), 'bench-body.json');
writeFileSync(
    bodyFile,
    JSON.stringify({
        name: 'SomeName',
        org: 'SomeCorp',
    }),
);

const p_args = parseArgs({
    options: {
        b: {
            type: 'string',
            multiple: true,
        },
    },
});

const args = p_args.values;

if (!args.b?.length) {
    console.log(
        `
Use [-b] option to pass which backends to test. Options:
all - Test all backends
${BACKENDS.join('\n')}`,
    );
    process.exit(0);
}
const backendsToWorkOn = args.b.includes('all')
    ? BACKENDS
    : BACKENDS.filter(b => {
          return args.b!.includes(b);
      });

const runAbBench = async (server: ChildProcessWithoutNullStreams, backend: string) => {
    try {
        console.log(`\n=== ${backend} ===`);
        if (WARMUP_RUNS) {
            console.log(`Running ${WARMUP_RUNS} warmup rounds`);
        }
        for (let i = 0; i < WARMUP_RUNS; i++) {
            execFileSync(
                'ab',
                [
                    '-n',
                    String(REQUESTS),
                    '-c',
                    String(CONNECTIONS),
                    '-k',
                    '-p',
                    bodyFile,
                    '-T',
                    'application/json',
                    '-H',
                    'Authorization: Bearer custom_token',
                    `http://127.0.0.1:${PORT}/hello`,
                ],
                {
                    stdio: 'ignore',
                },
            );
            console.log(`Finished warmup round ${i + 1}`);
        }

        // Real run
        execFileSync(
            'ab',
            [
                '-n',
                String(REQUESTS),
                '-c',
                String(CONNECTIONS),
                '-k',
                '-p',
                bodyFile,
                '-T',
                'application/json',
                '-H',
                'Authorization: Bearer custom_token',
                `http://127.0.0.1:${PORT}/hello`,
            ],
            {
                stdio: 'inherit',
            },
        );
    } catch (error) {
        console.log('Error during ab testing');
        console.log(error);
    } finally {
        server.kill();
        await once(server, 'exit');
    }
};

const waitForListening = (server: ChildProcessWithoutNullStreams) => {
    return new Promise<void>((resolve, reject) => {
        server.stdout.on('data', (m: string) => {
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

for (const backend of backendsToWorkOn) {
    const server = spawn(
        'node',
        [
            join(import.meta.dirname, 'packages', backend, 'dist', 'main.js'),
        ],
        {
            env: {
                ...process.env,
                PORT: String(PORT),
            },
            stdio: 'pipe',
        },
    );
    server.stdout.setEncoding('utf8');

    try {
        await waitForListening(server);
        await runAbBench(server, backend);
    } catch (error) {
        console.log(`Failed to start ${backend}`);
        console.log(error);
        server.kill();
    }
}
