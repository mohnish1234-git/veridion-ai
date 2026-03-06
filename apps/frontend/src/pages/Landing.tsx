import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Shield, Brain, Newspaper, Lock, BarChart3, TrendingUp, Hexagon, Star, ChevronRight } from 'lucide-react';
import Aurora from '../components/reactbits/Aurora';
import SplitText from '../components/reactbits/SplitText';
import BlurText from '../components/reactbits/BlurText';
import GradientText from '../components/reactbits/GradientText';
import ShinyText from '../components/reactbits/ShinyText';
import ScrollReveal from '../components/reactbits/ScrollReveal';
import Magnet from '../components/reactbits/Magnet';
import CountUp from '../components/reactbits/CountUp';
import Spotlight from '../components/reactbits/Spotlight';
import StarBorder from '../components/reactbits/StarBorder';

const features = [
    { icon: BarChart3, title: 'Quantitative Core', desc: 'Mean-variance optimization, efficient frontier analysis, and dynamic rebalancing powered by institutional-grade algorithms.' },
    { icon: Brain, title: 'Behavioral AI', desc: 'Adaptive risk profiling that detects biases, panic-selling tendencies, and adjusts your strategy in real-time.' },
    { icon: Newspaper, title: 'Event Intelligence', desc: 'Real-time news monitoring with automated portfolio impact analysis and shock simulation capabilities.' },
];

const steps = [
    { num: 1, title: 'Tell Us About You', desc: 'Complete a quick questionnaire about your financial goals, risk tolerance, and investment horizon.' },
    { num: 2, title: 'AI Builds Your Strategy', desc: 'Our engine optimizes allocations, runs Monte Carlo simulations, and creates a personalized plan.' },
    { num: 3, title: 'Monitor & Adapt', desc: 'Track performance, receive intelligent alerts, and let the AI adapt to changing conditions.' },
];

const trustItems = [
    { icon: Lock, title: 'Bank-Grade Encryption', desc: 'AES-256 encryption at rest and TLS 1.3 in transit.' },
    { icon: Shield, title: 'SOC 2 Compliant', desc: 'Enterprise security standards with continuous monitoring.' },
    { icon: BarChart3, title: 'Transparent AI', desc: 'Every decision explained. Full audit trail. No black boxes.' },
];

export default function Landing() {
    const { scrollYProgress } = useScroll();
    const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -50]);

    return (
        <div className="min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-xl" style={{ background: 'rgba(10, 14, 23, 0.8)', borderColor: 'var(--color-border)' }}>
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--gradient-accent)' }}>
                            <Hexagon size={18} className="text-bg-primary" />
                        </div>
                        <GradientText text="Veridion AI" className="text-lg font-bold" />
                    </div>
                    <div className="hidden md:flex items-center gap-6">
                        <a href="#features" className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Features</a>
                        <a href="#security" className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Security</a>
                        <Link to="/login" className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Sign In</Link>
                        <Link to="/register" className="btn-primary text-sm">Get Started <ArrowRight size={14} /></Link>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
                <Aurora />
                <motion.div className="relative z-10 max-w-4xl mx-auto px-6 text-center" style={{ y: heroY }}>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-8 border" style={{ background: 'var(--color-accent-teal-dim)', borderColor: 'rgba(0,212,170,0.2)', color: 'var(--color-accent-teal)' }}>
                            <TrendingUp size={12} /> AI-Powered Wealth Management
                        </span>
                    </motion.div>
                    <h1 className="text-h1 mb-6" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)' }}>
                        <SplitText text="Intelligent Investing for" className="justify-center" />
                        <br />
                        <SplitText text="the Data-Driven" className="justify-center" delay={0.8} />
                    </h1>
                    <div className="mb-8">
                        <BlurText text="Adaptive risk. Transparent decisions. Institutional-grade algorithms for everyone." className="justify-center text-lg" />
                    </div>
                    <div className="flex items-center justify-center gap-4">
                        <Magnet>
                            <Link to="/register" className="btn-primary text-base px-8 py-3">
                                <ShinyText text="Start Investing" />
                                <ArrowRight size={16} />
                            </Link>
                        </Magnet>
                        <Link to="/login" className="btn-secondary text-base px-8 py-3">Sign In</Link>
                    </div>

                    {/* Mock chart line */}
                    <motion.div className="mt-16 mx-auto max-w-2xl" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2, duration: 0.8 }}>
                        <svg viewBox="0 0 600 120" className="w-full" style={{ filter: 'drop-shadow(0 0 20px rgba(0,212,170,0.2))' }}>
                            <defs>
                                <linearGradient id="heroLine" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#00D4AA" />
                                    <stop offset="100%" stopColor="#3B82F6" />
                                </linearGradient>
                                <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#00D4AA" stopOpacity="0.2" />
                                    <stop offset="100%" stopColor="#00D4AA" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                            <motion.path
                                d="M 0 80 Q 50 70, 100 65 T 200 50 T 300 55 T 400 35 T 500 25 T 600 15"
                                fill="none" stroke="url(#heroLine)" strokeWidth="2.5"
                                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2, delay: 1.5, ease: 'easeOut' }}
                            />
                            <path d="M 0 80 Q 50 70, 100 65 T 200 50 T 300 55 T 400 35 T 500 25 T 600 15 V 120 H 0 Z" fill="url(#heroFill)" />
                        </svg>
                    </motion.div>
                </motion.div>
            </section>

            {/* Features */}
            <section id="features" className="py-24 relative">
                <div className="max-w-6xl mx-auto px-6">
                    <ScrollReveal>
                        <div className="text-center mb-16">
                            <h2 className="text-h2 mb-4" style={{ fontSize: '2rem' }}>Three Pillars of Intelligence</h2>
                            <p className="text-body max-w-xl mx-auto" style={{ color: 'var(--color-text-secondary)' }}>Built on institutional-grade research, accessible to everyone.</p>
                        </div>
                    </ScrollReveal>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {features.map((f, i) => (
                            <ScrollReveal key={i} delay={i * 0.15}>
                                <Spotlight>
                                    <div className="glass p-8 h-full">
                                        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ background: 'var(--color-accent-teal-dim)' }}>
                                            <f.icon size={24} style={{ color: 'var(--color-accent-teal)' }} />
                                        </div>
                                        <h3 className="text-h3 mb-3">{f.title}</h3>
                                        <p className="text-body" style={{ color: 'var(--color-text-secondary)' }}>{f.desc}</p>
                                    </div>
                                </Spotlight>
                            </ScrollReveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* How it Works */}
            <section className="py-24" style={{ background: 'var(--color-bg-secondary)' }}>
                <div className="max-w-4xl mx-auto px-6">
                    <ScrollReveal>
                        <div className="text-center mb-16">
                            <h2 className="text-h2 mb-4" style={{ fontSize: '2rem' }}>How It Works</h2>
                        </div>
                    </ScrollReveal>
                    <div className="space-y-12">
                        {steps.map((step, i) => (
                            <ScrollReveal key={i} delay={i * 0.15} direction="left">
                                <div className="flex items-start gap-6">
                                    <div className="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold" style={{ background: 'var(--gradient-accent)', color: 'var(--color-bg-primary)' }}>
                                        <CountUp end={step.num} duration={0.8} />
                                    </div>
                                    <div>
                                        <h3 className="text-h3 mb-2">{step.title}</h3>
                                        <p className="text-body" style={{ color: 'var(--color-text-secondary)' }}>{step.desc}</p>
                                    </div>
                                </div>
                            </ScrollReveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* Security */}
            <section id="security" className="py-24">
                <div className="max-w-6xl mx-auto px-6">
                    <ScrollReveal>
                        <div className="text-center mb-16">
                            <h2 className="text-h2 mb-4" style={{ fontSize: '2rem' }}>Built on Trust</h2>
                            <p className="text-body max-w-xl mx-auto" style={{ color: 'var(--color-text-secondary)' }}>Enterprise-grade security with complete transparency.</p>
                        </div>
                    </ScrollReveal>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {trustItems.map((item, i) => (
                            <ScrollReveal key={i} delay={i * 0.12}>
                                <StarBorder>
                                    <div className="p-8">
                                        <item.icon size={28} style={{ color: 'var(--color-accent-teal)' }} className="mb-4" />
                                        <h3 className="text-h3 mb-2">{item.title}</h3>
                                        <p className="text-body" style={{ color: 'var(--color-text-secondary)' }}>{item.desc}</p>
                                    </div>
                                </StarBorder>
                            </ScrollReveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-32 relative overflow-hidden">
                <Aurora colors={['#00D4AA', '#3B82F6']} />
                <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
                    <ScrollReveal>
                        <GradientText text="Veridion AI" className="text-4xl md:text-5xl font-bold mb-6" />
                        <p className="text-lg mb-8" style={{ color: 'var(--color-text-secondary)' }}>
                            Start building your intelligent portfolio today.
                        </p>
                        <Magnet>
                            <Link to="/register" className="btn-primary text-lg px-10 py-4 inline-flex">
                                <ShinyText text="Get Started — It's Free" />
                                <ChevronRight size={20} />
                            </Link>
                        </Magnet>
                    </ScrollReveal>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    <div className="flex items-center gap-2">
                        <Lock size={12} /> End-to-end encrypted
                    </div>
                    <p>© 2025 Veridion AI. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}
