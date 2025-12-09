const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;
// Using the scopes defined in procedure.md
// 'user-top-read' is essential for getting the user's music taste
const SCOPES = [
    "user-top-read",
    "user-read-private",
    "user-read-email"
];

export const getSpotifyAuthUrl = () => {
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: "code", // Matches procedure.md: Backend exchanges code -> access token
        redirect_uri: REDIRECT_URI,
        scope: SCOPES.join(" "),
        show_dialog: "true",
    });

    return `https://accounts.spotify.com/authorize?${params.toString()}`;
};
