import { useEffect, useRef } from 'react';
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
                        // TODO: Store token (context or local storage for now) and redirect
                        console.log("Success! Access Token acquired.");
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

                <h2 className="text-2xl font-bold">Connecting to Spotify...</h2>
                <p className="text-text-secondary">Analyzing your music taste</p>
            </div>
        </div>
    );
};

export default CallbackPage;
