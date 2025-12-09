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
