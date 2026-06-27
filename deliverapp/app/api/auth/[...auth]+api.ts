import { serverAuth } from '../../../lib/server-auth'; // server-side auth with database connection

export async function GET(request: Request) {
    try {
        return await serverAuth.handler(request);
    } catch (error) {
        console.error('Auth GET error:', error);
        return new Response(JSON.stringify({ error: 'Authentication error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function POST(request: Request) {
    try {
        // We explicitly return the handler to ensure Expo passes the body correctly
        return await serverAuth.handler(request);
    } catch (error) {
        console.error('Auth POST error:', error);
        return new Response(JSON.stringify({ error: 'Authentication error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
