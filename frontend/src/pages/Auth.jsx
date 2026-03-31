import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiService, getToken } from '../utils/api';

export default function Auth() {
    const navigate = useNavigate();
    const [mode, setMode] = useState('login');

    // Form States
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (getToken()) navigate('/');
    }, [navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (mode === 'register') {
            if (password !== confirmPassword) {
                return setError('Passwords do not match. Please check again.');
            }
        }

        setLoading(true);

        try {
            if (mode === 'login') {
                await ApiService.login(username, password);
                navigate('/');
            } else {
                await ApiService.register(fullName, email, username, password);
                setSuccess('Registration successful! E2E Payment Sample has been deployed to your account. Please log in.');
                setMode('login');
                setUsername('');
                setPassword('');
                setConfirmPassword('');
                setFullName('');
                setEmail('');
            }
        } catch (err) {
            setError(err.message || 'An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const features = [
        {
            icon: 'fa-bolt',
            color: 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30',
            title: 'Lightning Fast Requests',
            desc: 'Incredibly fast REST API testing with a clean interface. Fully supports JSON, Form-Data, Url-Encoded payloads, file uploads, and comprehensive Authorization management.'
        },
        {
            icon: 'fa-gauge-high',
            color: 'text-rose-500 bg-rose-100 dark:bg-rose-900/30',
            title: 'Performance Load Testing',
            desc: 'No separate tools needed! Simulate thousands of Concurrent Virtual Users (VUs), configure Spawn Rates, and set test durations. Get real-time metric reports and P95 response times for every endpoint.'
        },
        {
            icon: 'fa-route',
            color: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30',
            title: 'Visual API Workflows',
            desc: 'Chain dozens of your API endpoints into a single visual automation workflow (Node-based). Extract variables from one endpoint response to the next seamlessly using environment variables.'
        },
        {
            icon: 'fa-server',
            color: 'text-pink-500 bg-pink-100 dark:bg-pink-900/30',
            title: 'Smart Mock Servers',
            desc: 'Frontend developers no longer need to wait for backend APIs to be ready. Instantly create smart Mock APIs complete with customized status codes, custom headers, and dynamic response bodies.'
        },
        {
            icon: 'fa-network-wired',
            color: 'text-indigo-500 bg-indigo-100 dark:bg-indigo-900/30',
            title: 'Local Agent Tunneling',
            desc: 'Test your localhost APIs directly from the cloud without using Ngrok. Natively integrated via secure WebSocket connections. Perfect for testing Webhooks and third-party integrations instantly.'
        },
        {
            icon: 'fa-users',
            color: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30',
            title: 'Real-Time Collaboration',
            desc: 'Invite your teammates into Workspaces with no quota limits. Share Collections, request folders, variables, and testing scenario results in real-time, just like Google Docs.'
        },
        {
            icon: 'fa-satellite-dish',
            color: 'text-purple-500 bg-purple-100 dark:bg-purple-900/30',
            title: 'MITM HTTPS Interceptor',
            desc: 'Intercept, inspect, and modify HTTP/HTTPS traffic from any mobile device or browser. Install the generated Root CA to decrypt SSL traffic and debug external services on the fly.'
        },
        {
            icon: 'fa-mobile-screen-button',
            color: 'text-orange-500 bg-orange-100 dark:bg-orange-900/30',
            title: 'Android ADB & Chaos',
            desc: 'Automate physical Android devices via ADB. Trigger UI taps, swipes, read live Logcat streams, and simulate network failures with the built-in Chaos Engine directly from the browser.'
        }
    ];

    const useCases = [
        {
            title: "Payment Gateway & Webhook Testing",
            subtitle: "Securely Simulate Financial Transactions",
            desc: "Validate Payment Gateway integrations (like Midtrans, Stripe, Xendit) that require Webhook responses to your local server. Use our Local Agent Tunneling feature to receive third-party payloads directly to your localhost environment without exposing public IPs, then automate logic validation with API Flow Tests.",
            image: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            reverse: false
        },
        {
            title: "End-to-End E-Commerce Scenarios",
            subtitle: "Visual API Workflows",
            desc: "Test the entire user shopping flow in one scenario. Start from the Login endpoint to get a Bearer Token, inject that token dynamically into the Add to Cart endpoint, apply discounts, until the Checkout process. Everything is chained visually using the Node Editor, making it easy for QA Engineers to find bottlenecks in business logic.",
            image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            reverse: true
        },
        {
            title: "Flash Sale Campaign Stress Testing",
            subtitle: "Performance Load Testing Engine",
            desc: "Ensure your server doesn't crash during sudden traffic spikes. Define Concurrent Virtual Users, set the Spawn Rate per second, and monitor P95 Response Time, success rates, and failure rates in real-time. Get comprehensive Excel reports after testing for analysis by your DevOps or SRE team.",
            image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            reverse: false
        },
        {
            title: "Mobile App Debugging & Chaos Engineering",
            subtitle: "MITM Proxy & ADB Integration",
            desc: "Connect your Android device to the Rest Flow local agent proxy. Intercept SSL traffic from your mobile apps, monitor live Logcat streams, and inject artificial network delays (Chaos Testing) to see how your app handles 502 Bad Gateway errors or slow connections.",
            image: "https://images.unsplash.com/photo-1526498460520-4c246339dccb?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            reverse: true
        }
    ];

    const testimonials = [
        {
            name: "Ahdian Rawuli",
            role: "DevOps Engineer, Danamon",
            text: "Since migrating to Rest Flow, our DevOps team can perform API Flow tests and Performance Load Testing directly from a single workspace. It is highly efficient, lightweight, and saves a lot of server resources!",
            initial: "A",
            color: "from-blue-500 to-indigo-500"
        },
        {
            name: "Dewa Mahendra",
            role: "Security Ops, Tokopedia",
            text: "The Local Agent Tunneling feature is incredibly secure and fast. It significantly helps our Security and QA teams test our internal e-commerce webhooks without exposing the environment to the public.",
            initial: "D",
            color: "from-emerald-500 to-teal-500"
        },
        {
            name: "Firdaus Rachman",
            role: "IT Manager, Kitabisa",
            text: "The UI/UX offered is highly intuitive. The Visual API Workflows feature makes it easy for our QA team to create end-to-end donation transaction testing scenarios without having to write much manual code.",
            initial: "F",
            color: "from-orange-500 to-red-500"
        },
        {
            name: "Ahmad Rifqi",
            role: "Senior Developer, Indosat",
            text: "The presence of Smart Mock Servers in Rest Flow has accelerated our frontend team's development cycle by up to 2x. There is no longer a 'blocker' while waiting for the backend endpoints to be ready.",
            initial: "R",
            color: "from-purple-500 to-pink-500"
        },
        {
            name: "Syahid",
            role: "Principal Engineer, Amazon",
            text: "The engine's scalability and Performance Test reports are very solid. This is the best open-source API tools ecosystem that can directly compete with expensive enterprise software.",
            initial: "S",
            color: "from-yellow-500 to-orange-500"
        }
    ];

    return (
        // Wrapper using fixed inset-0 w-full h-full overflow-y-auto
        // This approach resets the scrollbar and isolates the page from the global layout
        <div className='fixed inset-0 z-50 w-full h-full overflow-y-auto overflow-x-hidden bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-sans selection:bg-blue-500 selection:text-white flex flex-col'>

            {/* Navbar */}
            <nav className="sticky top-0 w-full z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 transition-colors">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-extrabold text-xl tracking-tight">
                        <i className="fa-solid fa-bolt"></i> Rest Flow
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-xs sm:text-sm font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 shadow-sm">
                            100% Open Source
                        </span>
                    </div>
                </div>
            </nav>

            <main className="flex-grow flex flex-col">

                {/* Hero & Form Section */}
                <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-20 flex flex-col lg:flex-row items-center gap-12 lg:gap-20">

                    {/* Left Copywriting */}
                    <div className="flex-1 text-center lg:text-left z-10">
                        <div className="inline-block mb-4 px-4 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold text-sm border border-blue-200 dark:border-blue-800 shadow-sm">
                            🚀 V2.0 : Performance Testing feature has been released
                        </div>
                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6 leading-tight text-gray-900 dark:text-white">
                            The Free & Powerful <br className="hidden lg:block" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">API Ecosystem</span>
                        </h1>
                        <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                            Leave expensive paid API tools behind. Rest Flow combines API Testing, Visual Automation, Mock Servers, Performance Load Testing, and Localhost Tunneling into a single collaborative workspace.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 sm:gap-6 text-sm font-bold text-gray-600 dark:text-gray-300">
                            <div className="flex items-center gap-2"><i className="fa-solid fa-check-circle text-emerald-500 text-lg"></i> Free Forever</div>
                            <div className="flex items-center gap-2"><i className="fa-solid fa-check-circle text-emerald-500 text-lg"></i> Flow Template Injection</div>
                            <div className="flex items-center gap-2"><i className="fa-solid fa-check-circle text-emerald-500 text-lg"></i> Real-time Team Collaboration</div>
                        </div>
                    </div>

                    {/* Right Form Card */}
                    <div className="w-full max-w-md relative z-10 shrink-0">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[2rem] blur-xl opacity-20 animate-pulse"></div>

                        <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-700 p-8 sm:p-10">
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">{mode === 'login' ? 'Welcome Back' : 'Join the Community'}</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{mode === 'login' ? 'Sign in to access your workspace.' : 'Create your free account today.'}</p>
                            </div>

                            {error && <div className="mb-6 bg-red-50 border border-red-200 text-red-600 text-sm p-3.5 rounded-xl flex items-start gap-3"><i className="fa-solid fa-circle-exclamation mt-0.5"></i><span className="font-medium">{error}</span></div>}
                            {success && <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm p-3.5 rounded-xl flex items-start gap-3"><i className="fa-solid fa-circle-check mt-0.5"></i><span className="font-medium">{success}</span></div>}

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {mode === 'register' && (
                                    <>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Full Name</label>
                                        <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 dark:bg-slate-900/50 dark:border-slate-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="John Doe" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Email Address</label>
                                        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 dark:bg-slate-900/50 dark:border-slate-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="john@example.com" />
                                    </div>
                                    </>
                                )}

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Username</label>
                                    <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 dark:bg-slate-900/50 dark:border-slate-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="developer_123" />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Password</label>
                                    <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 dark:bg-slate-900/50 dark:border-slate-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="••••••••" />
                                </div>

                                {mode === 'register' && (
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Confirm Password</label>
                                        <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 dark:bg-slate-900/50 dark:border-slate-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="••••••••" />
                                    </div>
                                )}

                                <button type="submit" disabled={loading} className="w-full flex justify-center items-center gap-2 py-3.5 px-4 mt-2 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-70 transition-all">
                                    {loading ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Processing...</> : <>{mode === 'login' ? 'Enter Workspace' : 'Create Free Account'} <i className="fa-solid fa-arrow-right ml-1"></i></>}
                                </button>
                            </form>

                            <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
                                {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
                                <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setSuccess(''); }} className="font-bold text-blue-600 dark:text-blue-400 hover:text-blue-500 transition-colors">
                                    {mode === 'login' ? 'Sign up now' : 'Login here'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Features Section */}
                <div className="w-full border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-800/30 py-20 lg:py-32">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-16 lg:mb-20">
                            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl tracking-tight">Complete Toolkit for Modern Developers</h2>
                            <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">We designed these features to accelerate your workflow from the testing phase to high-performance deployment.</p>
                        </div>
                        {/* Diperbarui ke grid xl:grid-cols-4 untuk mengakomodasi 8 fitur */}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
                            {features.map((feature, idx) => (
                                <div key={idx} className="bg-gray-50 dark:bg-slate-800 rounded-3xl p-8 border border-gray-100 dark:border-slate-700 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group flex flex-col">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-6 ${feature.color} shadow-sm group-hover:scale-110 transition-transform shrink-0`}><i className={`fa-solid ${feature.icon}`}></i></div>
                                    <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">{feature.title}</h3>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed flex-grow">{feature.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Use Cases Section */}
                <div className="w-full border-t border-gray-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-20 lg:py-32">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-16 lg:mb-24">
                            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl tracking-tight">Solutions for Various Complex Scenarios</h2>
                            <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">See how Rest Flow is used in real-world industry environments to solve microservices architecture problems.</p>
                        </div>

                        <div className="space-y-24 lg:space-y-32">
                            {useCases.map((useCase, idx) => (
                                <div key={idx} className={`flex flex-col lg:flex-row items-center gap-12 lg:gap-16 ${useCase.reverse ? 'lg:flex-row-reverse' : ''}`}>
                                    <div className="w-full lg:w-1/2 flex-shrink-0">
                                        <div className="relative group">
                                            <div className="absolute -inset-4 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-3xl blur-lg opacity-20 group-hover:opacity-40 transition duration-500"></div>
                                            <img src={useCase.image} alt={useCase.title} className="relative rounded-2xl shadow-2xl object-cover w-full aspect-[4/3] border border-gray-200 dark:border-slate-700" />
                                        </div>
                                    </div>
                                    <div className="w-full lg:w-1/2 flex flex-col justify-center">
                                        <h4 className="text-blue-600 dark:text-blue-400 font-bold tracking-wider uppercase text-sm mb-2">{useCase.subtitle}</h4>
                                        <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6 leading-tight">{useCase.title}</h3>
                                        <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">{useCase.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* NEW Self-Hosting Section */}
                <div className="w-full border-t border-gray-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-20 lg:py-32">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-3xl p-10 lg:p-16 border border-gray-100 dark:border-slate-700 shadow-xl flex flex-col lg:flex-row items-center gap-10">
                            {/* Decorative Background */}
                            <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-blue-100 dark:bg-blue-900/30 rounded-full blur-3xl"></div>

                            <div className="relative z-10 flex-grow text-center lg:text-left">
                                <span className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2 block">Take Command</span>
                                <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl tracking-tight mb-4">
                                    Self-Host Rest Flow on Your Own Server
                                </h2>
                                <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl leading-relaxed mb-0">
                                    For maximum privacy, security compliance, and direct integration with your private internal networks, you can easily deploy Rest Flow on your own infrastructure via Docker. Get complete control over your data and testing environment.
                                </p>
                            </div>
                            <div className="relative z-10 shrink-0">
                                <a 
                                    href="https://github.com/ahdianrawuli/rest-flow" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-3 px-8 py-4 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-lg font-bold shadow-lg transition-colors"
                                >
                                    <i className="fa-brands fa-github text-xl"></i>
                                    View Installation Guide
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Testimonials Section */}
                <div className="w-full border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-800/30 py-20 lg:py-32">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl tracking-tight">Trusted by Experts</h2>
                            <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">See what the community of renowned developers and engineers say about the Rest Flow API ecosystem.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {testimonials.map((testi, idx) => (
                                <div key={idx} className={`bg-gray-50 dark:bg-slate-800 p-8 rounded-3xl border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col justify-between hover:shadow-lg transition-shadow ${idx === 3 ? 'lg:col-span-2' : ''} ${idx === 4 ? 'lg:col-span-1 md:col-span-2' : ''}`}>
                                    <div className="mb-6">
                                        <div className="flex gap-1 text-amber-400 text-sm mb-4">
                                            <i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i>
                                        </div>
                                        <p className="text-gray-700 dark:text-gray-300 italic text-base lg:text-lg leading-relaxed font-medium">"{testi.text}"</p>
                                    </div>
                                    <div className="flex items-center gap-4 mt-auto border-t border-gray-200 dark:border-slate-700 pt-6">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-lg bg-gradient-to-br ${testi.color} shadow-md shrink-0`}>
                                            {testi.initial}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 dark:text-white text-base">{testi.name}</h4>
                                            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mt-0.5">{testi.role}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </main>

            {/* Modern Powered By Footer - Added pb-16/pb-24 for mobile clearance */}
            <footer className="w-full bg-slate-900 dark:bg-slate-950 pt-12 pb-24 sm:pb-16 mt-auto border-t border-slate-800 shrink-0">
            <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center justify-center gap-3">
                <div className="text-sm text-slate-400 font-medium tracking-wide">
                    © 2026 &nbsp;
                    <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500">
                    AutoDev Platform
                    </span>. All rights reserved.
                </div>
            </div>
            </div>

            </footer>

        </div>
    );
}
