import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getSpotifyAuthUrl } from '../lib/spotify';
import { supabase } from '../lib/supabase';
import { fetchUserSpotifyData } from '../lib/spotifyData';

const AdminPage = () => {
    const [status, setStatus] = useState("Idle");
    const [token, setToken] = useState("");

    useEffect(() => {
        // Simple way to capture the token if we were redirected here
        // Ideally we reuse the Callback logic or just manually paste a token here for super-admin usage
        const params = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = params.get("access_token");
        // Note: Our current auth flow uses Code flow, so this might need the code exchange logic again
        // OR we just use the same "Connect Spotify" flow but with a special flag.
    }, []);

    const handleUpdate = async () => {
        if (!token) {
            alert("Please paste a temporary Access Token from the console or network tab of the main login flow.");
            return;
        }

        setStatus("Fetching Spotify Data...");
        try {
            const data = await fetchUserSpotifyData(token);

            setStatus("Updating Database...");
            const payload = {
                dev_spotify_user_id: 'developer',
                top_artists: data.topArtists,
                top_tracks: data.topTracks,
                genre_vector: data.genreVector,
                audio_feature_means: data.audioFeatures,
                popularity_mean: data.avgPopularity,
                updated_at: new Date().toISOString()
            };

            // Upsert
            const { error } = await supabase
                .from('dev_taste_profile')
                .upsert(payload, { onConflict: 'dev_spotify_user_id' });

            if (error) throw error;
            setStatus("Success! Database Updated.");

        } catch (err) {
            setStatus("Error: " + err.message);
        }
    };

    return (
        <div className="min-h-screen bg-bg-dark text-text-primary flex flex-col items-center justify-center p-8">
            <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

            <div className="w-full max-w-md space-y-4">
                <input
                    type="text"
                    placeholder="Paste Access Token Here"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="w-full p-4 bg-bg-card border border-white/10 rounded-xl text-white"
                />

                <button
                    onClick={handleUpdate}
                    className="w-full py-4 bg-brand-primary text-black font-bold rounded-full hover:opacity-90 transition"
                >
                    Update Developer Profile
                </button>

                {status && <p className="text-center text-text-secondary">{status}</p>}
            </div>

            <div className="mt-12 text-xs text-text-secondary max-w-lg">
                <p>Instructions:</p>
                <ol className="list-decimal pl-5 space-y-2 mt-2">
                    <li>Log in to the app normally as a user.</li>
                    <li>Open DevTools (F12) &gt; Network Tab.</li>
                    <li>Look for the request to <code>/api/token</code>.</li>
                    <li>Copy the <code>access_token</code> from the response.</li>
                    <li>Paste it above and click Update.</li>
                </ol>
            </div>
        </div>
    );
};

export default AdminPage;
