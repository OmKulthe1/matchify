
/**
 * This script is designed to be run via Node.js (locally or in GitHub Actions).
 * It uses the Helper/Admin Refresh Token to:
 * 1. Get a fresh Access Token.
 * 2. Fetch the latest music taste (Top Artists, Audio Features).
 * 3. Calculate the profile vectors.
 * 4. Update the 'dev_taste_profile' table in Supabase.
 */

import { createClient } from '@supabase/supabase-js';

// We can't use import.meta.env in Node.js scripts without special flags/bundlers usually.
// Depending on how user runs this, simple process.env is safer for a standalone script.
// But if running via 'node', we need dotenv.
// We'll assume the environment variables are loaded.

if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
    console.error("Missing Supabase Env Variables");
    process.exit(1);
}

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const SPOTIFY_CLIENT_ID = process.env.VITE_SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.SPOTIFY_DEV_REFRESH_TOKEN;

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !REFRESH_TOKEN) {
    console.error("Missing Spotify Env Variables (Client ID, Secret, or Buffer/Refresh Token)");
    process.exit(1);
}

async function getAccessToken() {
    const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: REFRESH_TOKEN,
    });

    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + (Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64'))
        },
        body: params
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error_description || data.error);
    return data.access_token;
}

// Re-implementing logic from spotifyData.js to be standalone (avoiding import issues in simple node script)
// In a larger repo we would use 'type': 'module' in package.json to share imports.
async function fetchSpotifyData(accessToken) {
    const headers = { Authorization: `Bearer ${accessToken}` };

    // Top Artists
    const artistsRes = await fetch('https://api.spotify.com/v1/me/top/artists?limit=50&time_range=medium_term', { headers });
    const artistsData = await artistsRes.json();
    const topArtists = artistsData.items || [];

    // Top Tracks
    const tracksRes = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=medium_term', { headers });
    const tracksData = await tracksRes.json();
    const topTracks = tracksData.items || [];

    // Audio Features
    const trackIds = topTracks.map(t => t.id).join(',');
    let audioFeatures = { danceability: 0.5, energy: 0.5, valence: 0.5 };

    if (trackIds) {
        const featuresRes = await fetch(`https://api.spotify.com/v1/audio-features?ids=${trackIds}`, { headers });
        const featuresData = await featuresRes.json();
        const features = featuresData.audio_features.filter(f => f !== null);

        if (features.length > 0) {
            audioFeatures = features.reduce((acc, curr) => ({
                danceability: acc.danceability + curr.danceability,
                energy: acc.energy + curr.energy,
                valence: acc.valence + curr.valence
            }), { danceability: 0, energy: 0, valence: 0 });

            audioFeatures.danceability /= features.length;
            audioFeatures.energy /= features.length;
            audioFeatures.valence /= features.length;
        }
    }

    // Genre Vector
    const genreCounts = {};
    let totalGenres = 0;
    topArtists.forEach(artist => {
        artist.genres.forEach(genre => {
            genreCounts[genre] = (genreCounts[genre] || 0) + 1;
            totalGenres++;
        });
    });
    const genreVector = {};
    Object.keys(genreCounts).forEach(key => {
        genreVector[key] = genreCounts[key] / totalGenres;
    });

    // Popularity
    const avgPopularity = topArtists.reduce((acc, a) => acc + a.popularity, 0) / (topArtists.length || 1);

    return { topArtists, topTracks, genreVector, audioFeatures, avgPopularity };
}

async function main() {
    try {
        console.log("1. Refreshing Access Token...");
        const accessToken = await getAccessToken();

        console.log("2. Fetching Spotify Data...");
        const data = await fetchSpotifyData(accessToken);

        console.log("3. Updating Supabase...");

        // We will upsert based on a single developer ID constant or just always update the first row
        // For simplicity, let's look for a row with a specific ID, or delete all and insert one.
        // Better: Upsert with a fixed 'dev_spotify_user_id' if we knew it.
        // Let's just storing a fixed 'dev_profile_id' or insert if empty.

        const payload = {
            dev_spotify_user_id: 'developer', // Fixed ID for lookup
            updated_at: new Date().toISOString(),
            top_artists: data.topArtists,
            top_tracks: data.topTracks,
            genre_vector: data.genreVector,
            audio_feature_means: data.audioFeatures,
            popularity_mean: data.avgPopularity
        };

        // Check if row exists
        const { data: existing } = await supabase.from('dev_taste_profile').select('id').eq('dev_spotify_user_id', 'developer').single();

        let error;
        if (existing) {
            const { error: err } = await supabase
                .from('dev_taste_profile')
                .update(payload)
                .eq('dev_spotify_user_id', 'developer');
            error = err;
        } else {
            const { error: err } = await supabase
                .from('dev_taste_profile')
                .insert([payload]);
            error = err;
        }

        if (error) throw error;

        console.log("✅ Developer Profile Updated Successfully!");

    } catch (err) {
        console.error("❌ Failed:", err);
        process.exit(1);
    }
}

main();
