
// Helper to extract genre vector from top artists
export const calculateGenreVector = (artists) => {
    const genreCounts = {};
    let total = 0;

    artists.forEach(artist => {
        artist.genres.forEach(genre => {
            genreCounts[genre] = (genreCounts[genre] || 0) + 1;
            total++;
        });
    });

    // Normalize to 0-1
    const vector = {};
    Object.keys(genreCounts).forEach(key => {
        vector[key] = genreCounts[key] / total;
    });

    return vector;
};

// Helper to calculate average popularity
export const calculateAveragePopularity = (items) => {
    if (!items.length) return 0;
    const sum = items.reduce((acc, item) => acc + item.popularity, 0);
    return sum / items.length;
};

// Helper: Fetch User Data from Spotify
export const fetchUserSpotifyData = async (accessToken) => {
    const headers = { Authorization: `Bearer ${accessToken}` };

    // 1. Get Top Artists
    const artistsRes = await fetch('https://api.spotify.com/v1/me/top/artists?limit=50&time_range=medium_term', { headers });
    const artistsData = await artistsRes.json();
    const topArtists = artistsData.items || [];

    // 2. Get Top Tracks (for audio features)
    const tracksRes = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=medium_term', { headers });
    const tracksData = await tracksRes.json();
    const topTracks = tracksData.items || [];

    // 3. Get Audio Features for those tracks
    // Spotify allows comma-separated IDs, max 100
    const trackIds = topTracks.map(t => t.id).join(',');
    let audioFeatures = { danceability: 0.5, energy: 0.5, valence: 0.5 }; // Defaults

    if (trackIds) {
        const featuresRes = await fetch(`https://api.spotify.com/v1/audio-features?ids=${trackIds}`, { headers });
        const featuresData = await featuresRes.json();
        const features = featuresData.audio_features.filter(f => f !== null);

        // Calculate Means
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

    // 4. Transform into our usable format
    return {
        topArtists, // keep full objects for UI (names, images)
        topTracks,
        genreVector: calculateGenreVector(topArtists),
        audioFeatures,
        avgPopularity: calculateAveragePopularity(topArtists) // using artists popularity as proxy
    };
};
