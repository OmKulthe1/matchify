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
    // Transform JS camelCase to DB snake_case
    const dbPayload = {
        id: 1, // Assuming singleton row with ID 1
        top_artists: userData.topArtists,
        top_tracks: userData.topTracks,
        genre_vector: userData.genreVector,
        audio_feature_means: userData.audioFeatures, // Now estimated
        popularity_mean: userData.avgPopularity,
        updated_at: new Date().toISOString()
    };

    const { error } = await supabase
        .from('dev_taste_profile')
        .upsert(dbPayload);

    if (error) {
        console.error('Error updating profile:', error);
        alert('Failed to update profile!');
        return false;
    }
    return true;
};
