
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

// Internal Helper: Estimate Audio Features from Genres
const estimateAudioFeaturesFromArtists = (artists) => {
    // Heuristic Map: Keyword -> { danceability, energy, valence }
    const GENRE_MAP = {
        'pop': { d: 0.7, e: 0.7, v: 0.7 },
        'dance': { d: 0.8, e: 0.8, v: 0.7 },
        'edm': { d: 0.8, e: 0.9, v: 0.6 },
        'rap': { d: 0.8, e: 0.7, v: 0.6 },
        'hip hop': { d: 0.8, e: 0.7, v: 0.6 },
        'reggaeton': { d: 0.8, e: 0.8, v: 0.8 },
        'house': { d: 0.8, e: 0.8, v: 0.7 },
        'techno': { d: 0.7, e: 0.9, v: 0.5 },
        'rock': { d: 0.4, e: 0.8, v: 0.5 },
        'metal': { d: 0.3, e: 0.9, v: 0.4 },
        'punk': { d: 0.5, e: 0.9, v: 0.5 },
        'r&b': { d: 0.7, e: 0.5, v: 0.6 },
        'soul': { d: 0.6, e: 0.5, v: 0.6 },
        'latin': { d: 0.7, e: 0.6, v: 0.7 },
        'folk': { d: 0.4, e: 0.4, v: 0.5 },
        'acoustic': { d: 0.4, e: 0.3, v: 0.5 },
        'classical': { d: 0.2, e: 0.3, v: 0.5 },
        'ambient': { d: 0.2, e: 0.2, v: 0.5 },
        'jazz': { d: 0.5, e: 0.4, v: 0.6 },
        'lo-fi': { d: 0.6, e: 0.3, v: 0.5 },
        'indie': { d: 0.5, e: 0.6, v: 0.5 },
        'alternative': { d: 0.5, e: 0.7, v: 0.5 }
    };

    let totalD = 0, totalE = 0, totalV = 0;
    let count = 0;

    artists.forEach(artist => {
        artist.genres.forEach(genre => {
            const lowerGenre = genre.toLowerCase();
            // Find first matching key
            const match = Object.keys(GENRE_MAP).find(key => lowerGenre.includes(key));
            if (match) {
                totalD += GENRE_MAP[match].d;
                totalE += GENRE_MAP[match].e;
                totalV += GENRE_MAP[match].v;
                count++;
            }
        });
    });

    if (count === 0) return { danceability: 0.5, energy: 0.5, valence: 0.5 }; // Default

    return {
        danceability: totalD / count,
        energy: totalE / count,
        valence: totalV / count
    };
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
    // 3. Audio Features (Estimated)
    // Deprecated API workaround: Estimate based on genre mapping
    const audioFeatures = estimateAudioFeaturesFromArtists(topArtists);

    /* 
    // Deprecated Code:
    if (trackIds) {
        ...
    }
    */

    // 4. Transform into our usable format
    return {
        topArtists, // keep full objects for UI (names, images)
        topTracks,
        genreVector: calculateGenreVector(topArtists),
        audioFeatures,
        avgPopularity: calculateAveragePopularity(topArtists) // using artists popularity as proxy
    };
};
