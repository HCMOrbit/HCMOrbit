import React, { useState } from "react";
import { Mail, MessageSquare, Linkedin, Send, CheckCircle2, ArrowUpRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import NavHeader from "../components/NavHeader";
import { api, formatApiError } from "../lib/api";

const TOPICS = [
  { value: "partnership", label: "Partnership" },
  { value: "press",       label: "Press / Media" },
  { value: "speaking",    label: "Speaking / Podcast" },
  { value: "feedback",    label: "Product feedback" },
  { value: "support",     label: "Support" },
  { value: "other",       label: "Other" },
];

function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", topic: "partnership", company: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.message.trim().length < 10) {
      toast.error("Please share a bit more detail (10+ characters).");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/contact", form);
      setDone(true);
      toast.success("Message sent — we'll be in touch shortly.");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-8 sm:p-10 shadow-sm" data-testid="contact-form-success">
        <div className="w-12 h-12 rounded-full bg-[#0D9373]/10 text-[#0D9373] flex items-center justify-center mb-4">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h3 className="font-heading text-2xl font-bold text-[#0A1628] mb-2">Message sent.</h3>
        <p className="text-[#475569] leading-relaxed mb-6">
          Thanks, {form.name.split(" ")[0]}. We&apos;ve received your note and will reply to{" "}
          <span className="text-[#0A1628] font-medium">{form.email}</span> within 2 business days.
        </p>
        <button
          onClick={() => { setDone(false); setForm({ name: "", email: "", topic: "partnership", company: "", message: "" }); }}
          className="text-sm font-semibold text-[#0D9373] hover:text-[#0b7c61]"
          data-testid="contact-send-another"
        >
          Send another message →
        </button>
      </div>
    );
  }

  const inputCls =
    "w-full px-4 py-3 text-[15px] bg-white border border-[#E2E8F0] rounded-lg " +
    "placeholder:text-[#94A3B8] text-[#0F172A] " +
    "focus:border-[#0D9373] focus:ring-4 focus:ring-[#0D9373]/15 outline-none transition";

  return (
    <form onSubmit={submit} className="rounded-2xl border border-[#E2E8F0] bg-white p-6 sm:p-8 shadow-sm" data-testid="contact-form">
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-xs font-semibold text-[#0A1628] uppercase tracking-wider mb-1.5">Name</span>
          <input required value={form.name} onChange={set("name")} placeholder="Jane Doe" className={inputCls} data-testid="contact-name" />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-[#0A1628] uppercase tracking-wider mb-1.5">Email</span>
          <input required type="email" value={form.email} onChange={set("email")} placeholder="you@company.com" className={inputCls} data-testid="contact-email" />
        </label>
      </div>

      <label className="block mt-4">
        <span className="block text-xs font-semibold text-[#0A1628] uppercase tracking-wider mb-1.5">Company <span className="text-[#94A3B8] normal-case font-normal">(optional)</span></span>
        <input value={form.company} onChange={set("company")} placeholder="Workday partner, customer, agency..." className={inputCls} data-testid="contact-company" />
      </label>

      <div className="mt-4">
        <span className="block text-xs font-semibold text-[#0A1628] uppercase tracking-wider mb-2">What&apos;s this about?</span>
        <div className="flex flex-wrap gap-2" data-testid="contact-topics">
          {TOPICS.map((t) => {
            const active = form.topic === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, topic: t.value }))}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  active
                    ? "bg-[#0A1628] text-white border-[#0A1628]"
                    : "bg-white text-[#475569] border-[#E2E8F0] hover:border-[#0A1628] hover:text-[#0A1628]"
                }`}
                data-testid={`contact-topic-${t.value}`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <label className="block mt-5">
        <span className="block text-xs font-semibold text-[#0A1628] uppercase tracking-wider mb-1.5">Message</span>
        <textarea
          required
          rows={5}
          minLength={10}
          maxLength={5000}
          value={form.message}
          onChange={set("message")}
          placeholder="Tell us what you have in mind…"
          className={inputCls + " resize-y min-h-[120px]"}
          data-testid="contact-message"
        />
        <span className="block mt-1 text-xs text-[#94A3B8]">{form.message.length}/5000</span>
      </label>

      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-xs text-[#64748B] max-w-md">
          By sending, you agree to our{" "}
          <Link to="/privacy" className="text-[#0D9373] hover:underline">privacy policy</Link>.
          We reply within 2 business days.
        </p>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#0D9373] hover:bg-[#0b7c61] disabled:bg-[#94A3B8] text-white text-sm font-semibold shadow-sm transition-colors shrink-0"
          data-testid="contact-submit"
        >
          {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <>Send message <Send className="w-4 h-4" /></>}
        </button>
      </div>
    </form>
  );
}

function ChannelCard({ icon: Icon, eyebrow, title, body, href, external, testid }) {
  const Wrapper = external ? "a" : Link;
  const wrapperProps = external
    ? { href, target: "_blank", rel: "noreferrer" }
    : { to: href };
  return (
    <Wrapper
      {...wrapperProps}
      data-testid={testid}
      className="group relative rounded-2xl border border-[#E2E8F0] bg-white p-6 hover:border-[#0D9373] hover:shadow-lg transition-all"
    >
      <div className="flex items-start justify-between mb-5">
        <div className="w-11 h-11 rounded-xl bg-[#0A1628] text-white flex items-center justify-center group-hover:bg-[#0D9373] transition-colors">
          <Icon className="w-5 h-5" />
        </div>
        <ArrowUpRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#0D9373] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all" />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0D9373] mb-1">{eyebrow}</p>
      <h3 className="font-heading text-lg font-bold text-[#0A1628] mb-1">{title}</h3>
      <p className="text-sm text-[#64748B] leading-relaxed">{body}</p>
    </Wrapper>
  );
}

export default function Connect() {
  return (
    <div className="min-h-screen bg-[#F8FAFC]" data-testid="connect-page">
      <NavHeader />

      {/* Dark navy hero ------------------------------------------------------ */}
      <section className="relative bg-[#0A1628] text-white overflow-hidden">
        {/* Subtle radial accents */}
        <div className="pointer-events-none absolute inset-0 opacity-40"
             style={{ background:
               "radial-gradient(600px circle at 15% 20%, rgba(13,147,115,0.18), transparent 60%), " +
               "radial-gradient(700px circle at 90% 80%, rgba(13,147,115,0.12), transparent 60%)" }} />
        <div className="relative max-w-[1100px] mx-auto px-4 lg:px-8 py-20 lg:py-28">
          <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0D9373] mb-4">
            Connect with HCMOrbit
          </span>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight max-w-3xl leading-[1.05]">
            Let&apos;s talk.
          </h1>
          <p className="mt-5 text-lg text-[#CBD5E1] max-w-2xl leading-relaxed">
            Drop us a note, ping the community, or say hello on LinkedIn — whichever&apos;s easier.
            We read every message.
          </p>
        </div>
      </section>

      {/* Form + channel cards ------------------------------------------------ */}
      <section className="max-w-[1100px] mx-auto px-4 lg:px-8 py-14 lg:py-20">
        <div className="grid lg:grid-cols-5 gap-8 lg:gap-12">
          <div className="lg:col-span-3">
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-[#0A1628] tracking-tight mb-2">
              Send us a message
            </h2>
            <p className="text-[#64748B] mb-6">A real human reads every note. We aim to reply within 2 business days.</p>
            <ContactForm />
          </div>

          <aside className="lg:col-span-2 space-y-4" data-testid="connect-channels">
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-[#0A1628] tracking-tight mb-2">
              Or pick a channel
            </h2>
            <p className="text-[#64748B] mb-2">Same team, different inboxes.</p>
            <ChannelCard
              icon={Mail}
              eyebrow="Direct email"
              title="hello@hcmorbit.com"
              body="Best for partnerships, press, and anything that needs a paper trail."
              href="mailto:hello@hcmorbit.com"
              external
              testid="connect-email"
            />
            <ChannelCard
              icon={MessageSquare}
              eyebrow="Community"
              title="Ask in the open"
              body="Got a Workday question? The community usually answers in minutes."
              href="/community"
              testid="connect-community"
            />
            <ChannelCard
              icon={Linkedin}
              eyebrow="LinkedIn"
              title="Follow & DM"
              body="Updates, founder posts, and an open inbox for thoughts and intros."
              href="https://www.linkedin.com/company/hcmorbit"
              external
              testid="connect-linkedin"
            />
          </aside>
        </div>
      </section>
    </div>
  );
}
