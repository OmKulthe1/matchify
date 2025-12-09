// Helper: Calculate Jaccard Similarity for sets (Artists/Tracks)
const calculateJaccard = (userSet, devSet) => {
    const intersection = userSet.filter(x => devSet.includes(x));
    const union = [...new Set([...userSet, ...devSet])];
    return union.length === 0 ? 0 : intersection.length / union.length;
};

// Helper: Cosine Similarity for Genre Vectors
// userVector and devVector are objects: { "pop": 0.5, "rock": 0.2 ... }
const calculateCosineSimilarity = (userVector, devVector) => {
    const allGenres = [...new Set([...Object.keys(userVector), ...Object.keys(devVector)])];

    let dotProduct = 0;
    let magA = 0;
    let magB = 0;

    allGenres.forEach(genre => {
        const valA = userVector[genre] || 0;
        const valB = devVector[genre] || 0;

        dotProduct += valA * valB;
        magA += valA * valA;
        magB += valB * valB;
    });

    if (magA === 0 || magB === 0) return 0;
    return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
};

// Helper: 1D Euclidean-like similarity (for simple numeric averages like "danceability")
// Returns 0 to 1, where 1 is identical.
const calculateNumericSimilarity = (valA, valB, maxPossibleDiff = 1.0) => {
    const diff = Math.abs(valA - valB);
    // Normalize diff to 0-1 range based on max possible difference for that feature
    const normalizedDiff = Math.min(diff / maxPossibleDiff, 1);
    return 1 - normalizedDiff;
};

export const calculateCompatibility = (userData, devData) => {
    // 1. Prepare Data
    // Assume input data structure from Spotify API wrappers
    const userArtists = userData.topArtists.map(a => a.id);
    const devArtists = devData.top_artists.map(a => a.id);

    // 2. Artist Similarity (30% weight)
    const artistScore = calculateJaccard(userArtists, devArtists);

    // 3. Genre Similarity (20% weight)
    // We assume these are pre-calculated frequency maps
    const genreScore = calculateCosineSimilarity(userData.genreVector, devData.genre_vector);

    // 4. Audio Features "Vibe" (25% weight)
    // Mean values for: danceability, energy, valence
    const userFeatures = userData.audioFeatures;
    const devFeatures = devData.audio_feature_means;

    const danceSim = calculateNumericSimilarity(userFeatures.danceability, devFeatures.danceability);
    const energySim = calculateNumericSimilarity(userFeatures.energy, devFeatures.energy);
    const valenceSim = calculateNumericSimilarity(userFeatures.valence, devFeatures.valence);

    const vibeScore = (danceSim + energySim + valenceSim) / 3;

    // 5. Popularity (10% weight) - Max diff is 100
    const popSim = calculateNumericSimilarity(userData.avgPopularity, devData.popularity_mean, 100);

    // 6. Final Weighted Score
    // Weights: Artist (0.3), Genre (0.2), Vibe (0.25), Popularity (0.10)
    // Missing: Tracks (0.15) - skipped for simplicity or merged into Artist
    // Adjust weights to sum to 1.0 if tracks are missing, or add track logic.
    // Let's re-normalize weights to sum to 1.0 without tracks for MVP, or assume 0 for tracks.
    // Normalized: 0.35, 0.25, 0.30, 0.10

    const finalScore = (
        (artistScore * 0.35) +
        (genreScore * 0.25) +
        (vibeScore * 0.30) +
        (popSim * 0.10)
    );

    return {
        score: Math.round(finalScore * 100),
        breakdown: {
            artist: Math.round(artistScore * 100),
            genre: Math.round(genreScore * 100),
            vibe: Math.round(vibeScore * 100),
            popularity: Math.round(popSim * 100)
        },
        sharedArtists: userData.topArtists
            .filter(a => devArtists.includes(a.id))
            .map(a => a.name)
            .slice(0, 5) // Top 5 shared
    };
};
