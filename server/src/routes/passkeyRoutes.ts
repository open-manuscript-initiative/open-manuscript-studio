import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import { PasskeyAccountInactiveError, listPasskeys, registrationOptions, registerPasskey, removePasskey, authenticationOptions, authenticatePasskey } from '../services/passkeyService.js';
/** Mounted at v1; legacy mount is a compatibility facade over these handlers. */
export const passkeyRouter = Router();
passkeyRouter.use((_request, response, next) => { response.setHeader('Cache-Control', 'no-store'); next(); });
function respondWithSession(request: Request, response: Response, result: {
    user: unknown;
    token: string;
    expiresAt: Date;
}) {
    response.cookie('omi_session', result.token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        expires: result.expiresAt,
        path: '/',
    });
    if (request.headers['x-omi-native-client'] === '1') {
        response.status(200).json({
            user: result.user,
            token: result.token,
            expiresAt: result.expiresAt.toISOString(),
        });
        return;
    }
    response.status(200).json({ user: result.user });
}
passkeyRouter.get('/passkeys', requireSession, async (request: AuthenticatedRequest, response) => {
    response.json(await listPasskeys(request.authUserId!));
});
passkeyRouter.post('/passkeys/registration/options', requireSession, async (request: AuthenticatedRequest, response) => {
    try {
        response.json(await registrationOptions(request.authUserId!));
    }
    catch (error) {
        if (!(error instanceof PasskeyAccountInactiveError))
            throw error;
        response.status(401).json({ error: { code: 'NOT_AUTHENTICATED', message: 'Authentication is required.' } });
    }
});
passkeyRouter.post('/passkeys/registration/verify', requireSession, async (request: AuthenticatedRequest, response) => {
    try {
        await registerPasskey(request.authUserId!, request.body);
        response.status(201).json({ ok: true });
    }
    catch {
        response.status(400).json({ error: { code: 'PASSKEY_REGISTRATION_FAILED', message: 'The passkey could not be registered. Start setup again and retry.' } });
    }
});
passkeyRouter.delete('/passkeys/:passkeyId', requireSession, async (request: AuthenticatedRequest, response) => {
    const id = z.string().uuid().safeParse(request.params.passkeyId);
    if (!id.success) {
        response.status(400).json({ error: { code: 'INVALID_PASSKEY_ID', message: 'Invalid passkey identifier.' } });
        return;
    }
    await removePasskey(request.authUserId!, id.data);
    response.status(204).end();
});
passkeyRouter.post('/passkeys/login/options', async (_request, response) => {
    response.json(await authenticationOptions());
});
passkeyRouter.post('/passkeys/login/verify', async (request, response) => {
    try {
        respondWithSession(request, response, await authenticatePasskey(request.body));
    }
    catch {
        response.status(401).json({ error: { code: 'PASSKEY_LOGIN_FAILED', message: 'Passkey sign-in could not be verified. Try again or use another sign-in method.' } });
    }
});
