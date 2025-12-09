import { motion } from 'framer-motion';
import { useLocation, Navigate } from 'react-router-dom';

const CompatibilityPage = () => {
    const location = useLocation();
    const result = location.state?.result;

    if (!result) {
        return <Navigate to="/" />;
    }

    const { score, breakdown, sharedArtists } = result;

    return (
        <div className="min-h-screen bg-bg-dark text-text-primary p-8 flex flex-col items-center">
            <motion.h1
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-4xl font-bold mb-12"
            >
                Compatibility Result
            </motion.h1>

            <div className="relative w-64 h-64 flex items-center justify-center mb-12">
                {/* Glow behind */}
                <div className="absolute inset-0 bg-brand-primary/20 blur-[60px] rounded-full" />

                {/* Score Circle */}
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 100, delay: 0.2 }}
                    className="w-full h-full rounded-full border-4 border-brand-primary flex items-center justify-center bg-bg-card relative z-10"
                >
                    <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                        className="text-7xl font-black gradient-text"
                    >
                        {score}%
                    </motion.span>
                </motion.div>
            </div>

            {/* Breakdown Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
                <div className="bg-bg-card p-6 rounded-2xl border border-white/5">
                    <h3 className="text-xl font-bold mb-4 text-text-secondary">Vibe Breakdown</h3>
                    <div className="space-y-4">
                        {Object.entries(breakdown || {}).map(([key, value], index) => (
                            <div key={key}>
                                <div className="flex justify-between mb-1 capitalize">
                                    <span>{key}</span>
                                    <span>{Math.floor(value)}%</span>
                                </div>
                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${value}% ` }}
                                        transition={{ delay: 1 + (index * 0.1), duration: 1 }}
                                        className="h-full bg-brand-primary"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-bg-card p-6 rounded-2xl border border-white/5">
                    <h3 className="text-xl font-bold mb-4 text-text-secondary">Shared Artists</h3>
                    {sharedArtists && sharedArtists.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {sharedArtists.map(artist => (
                                <span key={artist} className="px-3 py-1 bg-white/5 rounded-full text-sm hover:bg-white/10 transition-colors">
                                    {artist}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="text-text-secondary italic">No direct artist matches found.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CompatibilityPage;
