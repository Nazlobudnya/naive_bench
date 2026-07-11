import express, { type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';

const helloBodySchema = z.object({
    name: z.string(),
    org: z.string(),
});

function authGuard(req: Request, res: Response, next: NextFunction): void {
    if (req.headers.authorization !== 'Bearer custom_token') {
        res.status(401).json({
            message: 'Unauthorized',
        });
        return;
    }
    next();
}

const app = express();
app.use(express.json());

app.post('/hello', authGuard, (req: Request, res: Response) => {
    const result = helloBodySchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({
            message: 'Validation failed',
            errors: result.error.issues,
        });
        return;
    }
    /* const json = {
        user: {
            name: result.data.name,
            org: result.data.org,
            addr: 'some place far away',
            preferences: {
                personal_notif: true,
                channel_notif: true,
                banner_type: 'slim',
                card_type: 'extended',
            },
        },
        channels: [
            'safaewrgdgag',
            'sdfaertgjklasnjg',
            'elk2m342easdlc;vkm',
        ],
    };
    res.setHeader('content-type', 'application/json');
    res.send(json); */
    res.send(`Hi ${result.data.name} from ${result.data.org}`);
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
    console.log(`express listening on port ${port}`);
});
