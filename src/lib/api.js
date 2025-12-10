import { supabase } from './supabase';

// This function will be called during the compatibility check
export const getDeveloperProfile = async () => {
    // We assume there's only one developer profile for now, or we fetch by ID if we had multiple.
    // The table name 'dev_taste_profile' comes from procedure.md
    const { data, error } = await supabase
        .from('dev_taste_profile')
        .select('*')
        .limit(1)
        .single();

    if (error) {
        console.error('Error fetching developer profile:', error);
        return null; // Handle error gracefully in UI
    }

    return data;
};

// Admin helper: Update the developer profile with the current user's data
export const updateDeveloperProfile = async (userData) => {
    // 1. Fetch existing ID to handle UUID requirements (fixes 'id: 1' error)
    const { data: existing } = await supabase
        .from('dev_taste_profile')
        .select('id')
        .limit(1)
        .maybeSingle();

    // Transform JS camelCase to DB snake_case
    const dbPayload = {
        top_artists: userData.topArtists,
        top_tracks: userData.topTracks,
        genre_vector: userData.genreVector,
        audio_feature_means: userData.audioFeatures, // Now estimated
        popularity_mean: userData.avgPopularity,
        updated_at: new Date().toISOString()
    };

    let error;

    if (existing) {
        const { error: err } = await supabase
            .from('dev_taste_profile')
            .update(dbPayload)
            .eq('id', existing.id);
        error = err;
    } else {
        const { error: err } = await supabase
            .from('dev_taste_profile')
            .insert(dbPayload);
        error = err;
    }

    if (error) {
        console.error('Error updating profile:', error);
        alert(`Failed to update profile: ${error.message}`);
        return false;
    }
    return true;
};
