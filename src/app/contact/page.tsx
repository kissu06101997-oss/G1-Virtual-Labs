import type { Metadata } from "next";
import Image from "next/image";
import { ArrowUpRight, Clock3, Mail, MessageCircle, Phone, UserRound } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ContactForm } from "@/components/ContactForm";
import { GlassBack } from "@/components/GlassBack";
import { getCurrentSession, getRequestLocale } from "@/lib/auth";
import { CONTACT } from "@/lib/contact";
import "./contact.css";

export async function generateMetadata(): Promise<Metadata> {
  const te = await getRequestLocale() === "te-IN";
  return { title: `${te ? "మమ్మల్ని సంప్రదించండి" : "Contact Us"} | ${CONTACT.organization}` };
}

export default async function ContactPage() {
  const [auth, locale] = await Promise.all([getCurrentSession(), getRequestLocale()]);
  const te = locale === "te-IN";
  const cards = [
    { title: te ? "ఈమెయిల్ పంపండి" : "Email Us", info: CONTACT.email, icon: Mail, href: `mailto:${CONTACT.email}`, color: "teal" },
    { title: te ? "ఫోన్ చేయండి" : "Call Us", info: CONTACT.phoneLabel, icon: Phone, href: `tel:${CONTACT.phone}`, color: "violet" },
    { title: te ? "వాట్సాప్" : "WhatsApp", info: te ? "మాతో నేరుగా మాట్లాడండి." : "Connect with us directly.", icon: MessageCircle, href: CONTACT.whatsappUrl, color: "emerald" },
    { title: te ? "సంప్రదింపు సమయం" : "Contact Hours", info: CONTACT.hours, icon: Clock3, color: "amber" },
  ];

  return <>
    <AppHeader auth={auth} locale={locale} />
    <main id="main-content" className="g1-public-shell g1-premium g1-contact">
      <GlassBack href="/" label={te ? "ముఖపుటకు తిరిగి" : "Back to home"} />
      <header className="g1-card g1-info-card g1-contact-hero">
        <div>
          <p className="g1-contact-brand">{CONTACT.organization}</p>
          <h1>{te ? "కలిసి కొత్త అవకాశాలను అన్వేషిద్దాం." : "Let's connect and explore possibilities."}</h1>
          <p>{te
            ? "మీరు విద్యార్థి, ఉపాధ్యాయుడు, సంస్థ ప్రతినిధి లేదా సహకారంపై ఆసక్తి ఉన్నవారైనా, వర్చువల్ విజ్ఞాన విద్యలోని అవకాశాలను తెలుసుకోవడానికి మేము సహాయం చేస్తాము. ప్రయోగశాలల వినియోగం, వేదిక సమాచారం, సాంకేతిక సహాయం, సంస్థాగత సహకారం లేదా అభిప్రాయాల కోసం మమ్మల్ని సంప్రదించండి."
            : "Whether you're a student, educator, institution or potential collaborator, we're here to help you discover the possibilities of virtual science education. Contact us for laboratory access, product information, technical assistance, institutional collaboration and feedback."}</p>
        </div>
        <Image src="/brand/contact-illustration.webp" width={864} height={524} alt="" sizes="(min-width: 960px) 405px, 285px" />
      </header>

      <ul className="g1-contact-channels" aria-label={te ? "అధికారిక సంప్రదింపు మార్గాలు" : "Official contact channels"}>
        {cards.map(({ title, info, icon: Icon, href, color }) => {
          const content = <>
            <span className="g1-contact-icon"><Icon size={22} aria-hidden="true" /></span>
            <strong>{title}</strong>
            <span className="g1-contact-channel-info" dir="ltr">{info}</span>
            {href && <ArrowUpRight size={17} className="g1-contact-link-arrow" aria-hidden="true" />}
          </>;
          const className = "g1-card g1-info-card g1-contact-channel";
          return <li key={color} data-channel={color}>
            {href ? <a className={className} href={href}>{content}</a> : <div className={className}>{content}</div>}
          </li>;
        })}
      </ul>

      <section className="g1-card g1-info-card g1-contact-representative" aria-labelledby="contact-founder">
        <span className="g1-contact-icon"><UserRound size={35} aria-hidden="true" /></span>
        <div>
          <p className="g1-contact-brand">{CONTACT.organization}</p>
          <h2 id="contact-founder">{CONTACT.founder}</h2>
          <p className="g1-contact-role">{te ? "వ్యవస్థాపకులు మరియు అధికారిక సంప్రదింపు ప్రతినిధి" : "Founder & Official Contact Representative"}</p>
          <p>{te
            ? "సంస్థాగత విచారణలు, సహకారం, వేదిక ప్రదర్శనలు లేదా G1 Virtual Labs గురించి మరింత సమాచారం కోసం మా అధికారిక సంప్రదింపు మార్గాలను ఉపయోగించండి."
            : "For institutional inquiries, collaborations, product demonstrations and further information about G1 Virtual Labs, please connect with us through our official contact channels."}</p>
        </div>
      </section>
      <ContactForm locale={locale} />
    </main>
  </>;
}
