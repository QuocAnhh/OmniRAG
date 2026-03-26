export default function ParticleBackground() {
    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            {/* Top ambient — primary blue, very restrained */}
            <div
                className="absolute -top-[20%] left-[30%] w-[700px] h-[500px] rounded-full opacity-[0.07]"
                style={{
                    background: 'radial-gradient(ellipse, #4f8ef0, transparent 70%)',
                    filter: 'blur(60px)',
                    animation: 'ambientDrift1 18s ease-in-out infinite alternate',
                }}
            />
            {/* Bottom-left ambient — slightly warmer */}
            <div
                className="absolute bottom-[-10%] -left-[10%] w-[600px] h-[500px] rounded-full opacity-[0.05]"
                style={{
                    background: 'radial-gradient(ellipse, #3a6fd4, transparent 70%)',
                    filter: 'blur(80px)',
                    animation: 'ambientDrift2 22s ease-in-out infinite alternate',
                }}
            />
            {/* Right edge — very faint */}
            <div
                className="absolute top-[40%] -right-[5%] w-[400px] h-[400px] rounded-full opacity-[0.04]"
                style={{
                    background: 'radial-gradient(ellipse, #4f8ef0, transparent 70%)',
                    filter: 'blur(80px)',
                    animation: 'ambientDrift1 26s ease-in-out infinite alternate-reverse',
                }}
            />
            <style>{`
                @keyframes ambientDrift1 {
                    from { transform: translate(0, 0) scale(1); }
                    to   { transform: translate(40px, 30px) scale(1.08); }
                }
                @keyframes ambientDrift2 {
                    from { transform: translate(0, 0) scale(1); }
                    to   { transform: translate(-30px, -40px) scale(1.06); }
                }
            `}</style>
        </div>
    );
}
