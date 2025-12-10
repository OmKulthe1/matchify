export default async function handler(req, res) {
    // Allow CORS for our frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { code } = req.body || req.query;

    if (!code) {
        return res.status(400).json({ error: 'Code is required' });
    }

    const client_id = process.env.VITE_SPOTIFY_CLIENT_ID;
    const client_secret = process.env.SPOTIFY_CLIENT_SECRET; // Only on server
    const redirect_uri = process.env.VITE_SPOTIFY_REDIRECT_URI;

    if (!client_secret) {
        return res.status(500).json({ error: 'Server misconfiguration: Missing Client Secret' });
    }

    try {
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri,
        });

        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64'))
            },
            body: params
        });

        // Handle non-JSON responses from Spotify (e.g. 502 Proxy Error, Service Unavailable)
        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('Spotify API returned non-JSON:', text);
            return res.status(502).json({ error: 'Spotify upstream error', details: text });
        }

        if (data.error) {
            return res.status(400).json(data);
        }

        // Return the tokens to the frontend
        // In a production app, we might set an HttpOnly cookie here instead for security
        return res.status(200).json(data);

    } catch (error) {
        console.error('Token exchange error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
