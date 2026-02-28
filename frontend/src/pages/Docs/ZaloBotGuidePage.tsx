import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LogoIcon } from '../../components/ui/LogoIcon';

export default function ZaloBotGuidePage() {
    const [activeSection, setActiveSection] = useState('intro');

    useEffect(() => {
        const handleScroll = () => {
            const sections = ['intro', 'step1', 'step2', 'step3', 'step4', 'troubleshoot'];

            for (const section of sections) {
                const element = document.getElementById(section);
                if (element) {
                    const rect = element.getBoundingClientRect();
                    if (rect.top >= 0 && rect.top <= 300) {
                        setActiveSection(section);
                        break;
                    }
                }
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
            setActiveSection(id);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20 selection:text-primary-900">

            {/* Navigation Bar */}
            <header className="fixed top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
                    <div className="flex items-center gap-3">
                        <Link to="/" className="flex items-center gap-2">
                            <div className="size-8 rounded-lg overflow-hidden border border-border bg-card flex items-center justify-center shadow-lg shadow-primary/10">
                                <LogoIcon className="w-full h-full" />
                            </div>
                            <span className="text-lg font-bold tracking-tight text-foreground">OmniRAG Docs</span>
                        </Link>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link to="/auth" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Log in</Link>
                        <Link to="/auth" className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-lg transition-all shadow-lg shadow-primary/20">
                            Get Started
                        </Link>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 lg:px-8 pt-32 pb-24 grid grid-cols-1 lg:grid-cols-4 gap-12 relative">

                {/* Sidebar Navigation */}
                <aside className="hidden lg:block col-span-1 border-r border-border pr-8">
                    <div className="sticky top-32 space-y-8">
                        <div>
                            <h5 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider">Guides</h5>
                            <ul className="space-y-1">
                                <li>
                                    <button
                                        onClick={() => scrollToSection('intro')}
                                        className={`text-sm w-full text-left px-3 py-2 rounded-lg transition-colors ${activeSection === 'intro' ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                                    >
                                        Introduction
                                    </button>
                                </li>
                                <li>
                                    <button
                                        onClick={() => scrollToSection('step1')}
                                        className={`text-sm w-full text-left px-3 py-2 rounded-lg transition-colors ${activeSection === 'step1' ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                                    >
                                        1. Create Zalo Setup
                                    </button>
                                </li>
                                <li>
                                    <button
                                        onClick={() => scrollToSection('step2')}
                                        className={`text-sm w-full text-left px-3 py-2 rounded-lg transition-colors ${activeSection === 'step2' ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                                    >
                                        2. Create App
                                    </button>
                                </li>
                                <li>
                                    <button
                                        onClick={() => scrollToSection('step3')}
                                        className={`text-sm w-full text-left px-3 py-2 rounded-lg transition-colors ${activeSection === 'step3' ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                                    >
                                        3. Get Bot Token
                                    </button>
                                </li>
                                <li>
                                    <button
                                        onClick={() => scrollToSection('step4')}
                                        className={`text-sm w-full text-left px-3 py-2 rounded-lg transition-colors ${activeSection === 'step4' ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                                    >
                                        4. Connect OmniRAG
                                    </button>
                                </li>
                                <li>
                                    <button
                                        onClick={() => scrollToSection('troubleshoot')}
                                        className={`text-sm w-full text-left px-3 py-2 rounded-lg transition-colors ${activeSection === 'troubleshoot' ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                                    >
                                        Troubleshooting
                                    </button>
                                </li>
                            </ul>
                        </div>
                    </div>
                </aside>

                {/* Content Area */}
                <div className="col-span-1 lg:col-span-3 space-y-16">

                    {/* Introduction */}
                    <section id="intro" className="scroll-mt-32">
                        <div className="space-y-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200 mb-2">
                                <span className="material-symbols-outlined text-sm">smart_toy</span>
                                Zalo Integration
                            </div>
                            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                                Zalo Bot Setup Guide
                            </h1>
                            <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl">
                                Learn how to connect your Zalo Official Account (OA) directly to OmniRAG using the official Zalo Bot Platform API. This integration allows for instant, automated AI responses to your customers on Zalo.
                            </p>

                            <div className="bg-muted/30 border border-border rounded-xl p-6 mt-8">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">You will need:</h3>
                                <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <li className="flex items-center gap-3 text-sm font-medium">
                                        <span className="size-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center material-symbols-outlined text-xs">check</span>
                                        A Zalo account
                                    </li>
                                    <li className="flex items-center gap-3 text-sm font-medium">
                                        <span className="size-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center material-symbols-outlined text-xs">check</span>
                                        Access to developers.zalo.me
                                    </li>
                                    <li className="flex items-center gap-3 text-sm font-medium">
                                        <span className="size-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center material-symbols-outlined text-xs">check</span>
                                        Access to Zalo Bot Platform
                                    </li>
                                    <li className="flex items-center gap-3 text-sm font-medium">
                                        <span className="size-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center material-symbols-outlined text-xs">check</span>
                                        ~10 minutes of setup time
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    <hr className="border-border" />

                    {/* Step 1 */}
                    <section id="step1" className="scroll-mt-32">
                        <div className="flex gap-4 mb-6">
                            <span className="flex-none size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-md shadow-primary/20">1</span>
                            <div>
                                <h2 className="text-2xl font-bold text-foreground">Create Zalo Setup</h2>
                                <p className="mt-2 text-muted-foreground">First, ensure you have an Official Account to use as a bot.</p>
                            </div>
                        </div>

                        <div className="ml-12 space-y-6">
                            <p className="text-secondary-foreground">
                                Go to <a href="https://oa.zalo.me/manage/oa" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">Zalo OA Management</a> and ensure you have an Official Account created. If you don't have one, click "Create New OA".
                            </p>

                            <div className="bg-muted rounded-xl border border-border/50 overflow-hidden aspect-video flex items-center justify-center relative group">
                                <div className="absolute inset-0 bg-muted/50 flex items-center justify-center">
                                    <p className="text-muted-foreground font-medium text-sm flex items-center gap-2">
                                        <span className="material-symbols-outlined">image</span>
                                        Screenshot: Zalo OA Dashboard will be inserted here
                                    </p>
                                </div>
                                {/* Placeholder for screenshot */}
                                <div className="absolute bottom-4 right-4 px-3 py-1 bg-background/80 backdrop-blur rounded-lg text-xs font-mono border border-border">img: zalo_oa_dashboard.png</div>
                            </div>

                            <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg border border-yellow-200 text-sm">
                                <strong>Note:</strong> Your OA should be verified for best results, but you can start testing with a standard OA.
                            </div>
                        </div>
                    </section>

                    {/* Step 2 */}
                    <section id="step2" className="scroll-mt-32">
                        <div className="flex gap-4 mb-6">
                            <span className="flex-none size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-md shadow-primary/20">2</span>
                            <div>
                                <h2 className="text-2xl font-bold text-foreground">Create App on Zalo Developers</h2>
                                <p className="mt-2 text-muted-foreground">Register your application to get API access.</p>
                            </div>
                        </div>

                        <div className="ml-12 space-y-6">
                            <ol className="space-y-4 list-decimal list-inside text-secondary-foreground marker:text-primary marker:font-bold">
                                <li>Go to <a href="https://developers.zalo.me/" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">Zalo for Developers</a> and log in.</li>
                                <li>Click on your profile picture in the top right and select <strong>"Add New App"</strong>.</li>
                                <li>Enter a name for your app (e.g., "OmniRAG Integration") and select <strong>"Official Account"</strong> as the category.</li>
                                <li>After creation, navigate to <strong>"Official Account"</strong> settings in the left sidebar and link your OA to this app.</li>
                            </ol>

                            <div className="bg-muted rounded-xl border border-border/50 overflow-hidden aspect-video flex items-center justify-center relative group">
                                <div className="absolute inset-0 bg-muted/50 flex items-center justify-center">
                                    <p className="text-muted-foreground font-medium text-sm flex items-center gap-2">
                                        <span className="material-symbols-outlined">image</span>
                                        Screenshot: Creating Zalo App
                                    </p>
                                </div>
                                <div className="absolute bottom-4 right-4 px-3 py-1 bg-background/80 backdrop-blur rounded-lg text-xs font-mono border border-border">img: create_zalo_app.png</div>
                            </div>
                        </div>
                    </section>

                    {/* Step 3 */}
                    <section id="step3" className="scroll-mt-32">
                        <div className="flex gap-4 mb-6">
                            <span className="flex-none size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-md shadow-primary/20">3</span>
                            <div>
                                <h2 className="text-2xl font-bold text-foreground">Get Bot Token</h2>
                                <p className="mt-2 text-muted-foreground">This is the key to connect your bot.</p>
                            </div>
                        </div>

                        <div className="ml-12 space-y-6">
                            <p className="text-secondary-foreground">
                                Visit the <a href="https://developers.zalo.me/tools/explorer" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">API Explorer</a> or your Zalo Bot Platform dashboard to generate an access token.
                            </p>

                            <div className="bg-muted-foreground/5 p-6 rounded-xl border border-border">
                                <h4 className="font-bold text-sm mb-3">Token Format Looks Like:</h4>
                                <code className="block bg-background p-4 rounded-lg border border-border font-mono text-sm break-all text-primary">
                                    1234567890:AbCdEfGhIjKlMnOpQrStUvWxYz...
                                </code>
                                <p className="text-xs text-muted-foreground mt-3">
                                    This token allows OmniRAG to read messages and reply as your bot. Keep it secret!
                                </p>
                            </div>

                            <div className="bg-muted rounded-xl border border-border/50 overflow-hidden aspect-video flex items-center justify-center relative group">
                                <div className="absolute inset-0 bg-muted/50 flex items-center justify-center">
                                    <p className="text-muted-foreground font-medium text-sm flex items-center gap-2">
                                        <span className="material-symbols-outlined">image</span>
                                        Screenshot: Copying Bot Token
                                    </p>
                                </div>
                                <div className="absolute bottom-4 right-4 px-3 py-1 bg-background/80 backdrop-blur rounded-lg text-xs font-mono border border-border">img: zalo_token.png</div>
                            </div>
                        </div>
                    </section>

                    {/* Step 4 */}
                    <section id="step4" className="scroll-mt-32">
                        <div className="flex gap-4 mb-6">
                            <span className="flex-none size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-md shadow-primary/20">4</span>
                            <div>
                                <h2 className="text-2xl font-bold text-foreground">Connect to OmniRAG</h2>
                                <p className="mt-2 text-muted-foreground">Final step to go live.</p>
                            </div>
                        </div>

                        <div className="ml-12 space-y-6">
                            <ol className="space-y-4 list-decimal list-inside text-secondary-foreground marker:text-primary marker:font-bold">
                                <li>Log in to your <strong>OmniRAG Dashboard</strong>.</li>
                                <li>Navigate to <strong>"Bots"</strong> and select the bot you want to connect.</li>
                                <li>Go to the <strong>"Channels"</strong> tab.</li>
                                <li>Paste your <strong>Bot Token</strong> into the Zalo Bot section.</li>
                                <li>Click <strong>"Connect Zalo Bot"</strong>.</li>
                            </ol>

                            <div className="p-4 bg-blue-50 text-blue-800 rounded-lg border border-blue-200 text-sm flex items-start gap-3">
                                <span className="material-symbols-outlined text-xl shrink-0">info</span>
                                <p>OmniRAG will automatically configure the Webhook URL and verify the connection. Once you see the "Connected" status, your bot is live!</p>
                            </div>

                            <div className="bg-muted rounded-xl border border-border/50 overflow-hidden aspect-video flex items-center justify-center relative group shadow-lg">
                                <div className="absolute inset-0 bg-muted/50 flex items-center justify-center">
                                    <p className="text-muted-foreground font-medium text-sm flex items-center gap-2">
                                        <span className="material-symbols-outlined">image</span>
                                        Screenshot: OmniRAG Zalo Config Screen
                                    </p>
                                </div>
                                <div className="absolute bottom-4 right-4 px-3 py-1 bg-background/80 backdrop-blur rounded-lg text-xs font-mono border border-border">img: omnirag_config.png</div>
                            </div>
                        </div>
                    </section>

                    <hr className="border-border" />

                    {/* Troubleshooting */}
                    <section id="troubleshoot" className="scroll-mt-32">
                        <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
                            <span className="material-symbols-outlined text-yellow-500">build</span>
                            Troubleshooting
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-6 bg-card rounded-xl border border-border hover:border-primary/20 transition-colors">
                                <h4 className="font-bold text-foreground mb-2">Bot not replying?</h4>
                                <p className="text-sm text-muted-foreground">Check if your OmniRAG bot is active and has documents uploaded. Also verify that the Zalo OA has "Send Message" permissions enabled.</p>
                            </div>

                            <div className="p-6 bg-card rounded-xl border border-border hover:border-primary/20 transition-colors">
                                <h4 className="font-bold text-foreground mb-2">"Invalid Token" Error</h4>
                                <p className="text-sm text-muted-foreground">Tokens can expire or be revoked. Try generating a new Access Token in the Zalo Developers portal and update it in OmniRAG.</p>
                            </div>

                            <div className="p-6 bg-card rounded-xl border border-border hover:border-primary/20 transition-colors">
                                <h4 className="font-bold text-foreground mb-2">Webhook Errors</h4>
                                <p className="text-sm text-muted-foreground">Ensure your backend PUBLIC_URL is correctly set in the environment variables and is accessible from the internet (not localhost).</p>
                            </div>

                            <div className="p-6 bg-card rounded-xl border border-border hover:border-primary/20 transition-colors">
                                <h4 className="font-bold text-foreground mb-2">Need more help?</h4>
                                <p className="text-sm text-muted-foreground">Contact our support team directly or check the <a href="#" className="text-primary hover:underline">Full Documentation</a>.</p>
                            </div>
                        </div>
                    </section>

                </div>
            </main>

            <footer className="border-t border-border py-12 bg-muted/30">
                <div className="mx-auto max-w-7xl px-6 text-center text-sm text-muted-foreground">
                    <p>© 2026 OmniRAG Systems. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}
