import { motion } from 'framer-motion';
import { Button } from '../components/Button';

import { getSpotifyAuthUrl } from '../lib/spotify';

const LandingPage = () => {
    const handleLogin = () => {
        window.location.href = getSpotifyAuthUrl();
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
            {/* Background Ambience */}
            <div className="absolute inset-0 bg-gradient-to-b from-bg-dark via-bg-dark to-[#0f1f15] z-0" />
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-brand-primary/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-accent-blue/10 rounded-full blur-[120px]" />

            <div className="container relative z-10 flex flex-col items-center text-center">
                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="text-6xl md:text-8xl font-black mb-6 tracking-tight"
                >
                    Dev<span className="gradient-text">Matchify</span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.8 }}
                    className="text-xl md:text-2xl text-text-secondary max-w-2xl mb-12"
                >
                    Do you vibe with the developer? Compare your music taste and see if you're compatible.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                >
                    <Button onClick={handleLogin} className="min-w-[200px]">
                        Connect Spotify
                    </Button>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1, duration: 1 }}
                    className="mt-24 flex gap-8 text-text-secondary text-sm"
                >
                    <p>Powered by Spotify API</p>
                    <span>•</span>
                    <p>Privacy First</p>
                </motion.div>
            </div>
        </div>
    );
};

export default LandingPage;
