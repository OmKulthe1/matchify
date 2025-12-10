import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const CallbackPage = () => {
    const navigate = useNavigate();
    const hasRun = useRef(false);

    useEffect(() => {
        if (hasRun.current) return;
        hasRun.current = true;

        // In a real app, we would send the ?code= query param to our backend here.
        // For now, we will just simulate a loading state and then redirect or show an error.

        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');

        if (code) {
            const exchangeToken = async () => {
                try {
                    // In development (Vite), /api routes aren't served automatically unless proxy configured or using 'vercel dev'.
                    // For production (Vercel), this works out of the box.
                    // We'll use a relative path.
                    const res = await fetch('/api/token', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code })
                    });

                    const data = await res.json();
                    console.log("Token exchange result:", data);

                    if (data.access_token) {
                        console.log("Success! Access Token acquired.");
                        // Start the heavy lifting...
                        setIsAnalyzing(true);

                        const { fetchUserSpotifyData } = await import('../lib/spotifyData');
                        const { getDeveloperProfile } = await import('../lib/api');
                        const { calculateCompatibility } = await import('../lib/logic');

                        // 1. Fetch User Data
                        const userData = await fetchUserSpotifyData(data.access_token);

                        // 2. Fetch Dev Data
                        const devData = await getDeveloperProfile();

                        if (!devData) {
                            // Fallback if dev profile missing in DB (e.g. first run)
                            alert("Developer profile not found in database. Cannot compare yet!");
                            navigate('/');
                            return;
                        }

                        // 3. Calculate
                        const result = calculateCompatibility(userData, devData);

                        // Debug logging
                        console.log("Configuration:", { user: userData, dev: devData, result });
                        setAnalyzedData(userData); // Enable "Update Profile" button in UI if we paused

                        // 4. Redirect with state
                        // We pass userData so ResultPage can offer to "Seed" the DB if needed
                        navigate('/result', { state: { result, userData } });

                    } else {
                        console.error("Failed to exchange token", data);
                    }
                } catch (err) {
                    console.error("API Call failed", err);
                }
            };

            exchangeToken();
        } else {
            console.error("No code found in URL");
        }

    }, [navigate]);

    const [analyzedData, setAnalyzedData] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleUpdateProfile = async () => {
        if (!analyzedData) return;
        const { updateDeveloperProfile } = await import('../lib/api');
        const success = await updateDeveloperProfile(analyzedData);
        if (success) {
            alert("Profile updated! The next comparison will use YOUR data.");
            // Optionally force re-run or just reload
            window.location.href = '/';
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-bg-dark text-text-primary">
            <div className="flex flex-col items-center gap-6">
                {/* Loading Animation - Pulse */}
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                    className="w-16 h-16 rounded-full bg-brand-primary/20 flex items-center justify-center"
                >
                    <div className="w-8 h-8 rounded-full bg-brand-primary" />
                </motion.div>

                <h2 className="text-2xl font-bold">{isAnalyzing ? "Calculating Compatibility..." : "Connecting to Spotify..."}</h2>
                <p className="text-text-secondary">{isAnalyzing ? "Comparing your music DNA" : "Authenticating securely"}</p>

                {/* Admin/Debug Control */}
                {analyzedData && (
                    <div className="mt-8 p-4 border border-brand-primary/30 rounded-lg bg-bg-card/50 text-center">
                        <p className="text-sm mb-4 text-text-muted">Detected User Data loaded.</p>
                        <button
                            onClick={handleUpdateProfile}
                            className="px-4 py-2 bg-brand-primary/20 text-brand-primary rounded hover:bg-brand-primary/30 transition-colors text-sm font-medium"
                        >
                            Set MY Data as Developer Profile
                        </button>
                        <p className="text-xs text-text-muted mt-2">(Use this if you are the owner to seed the DB)</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CallbackPage;
