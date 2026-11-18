import Link from "next/link";

const APK_URL = "https://expo.dev/artifacts/eas/kP0bkS_fH_HjugmhWwZivZnGVkJFpdx5F07alptaN3E.apk";

const FEATURES = [
  { icon: "🗺️", title: "Live map", desc: "See every active vehicle update its position in real time, with light, dark, and satellite map views." },
  { icon: "🔍", title: "Search by route or number", desc: "Find a vehicle by its registration number, or search From → To like checking a train's status." },
  { icon: "🔔", title: "Arrival alerts", desc: "Watch a vehicle and get notified the moment it starts, stops, or reaches its destination." },
  { icon: "🛡️", title: "Admin oversight", desc: "A dedicated dashboard to monitor the whole fleet, with the ability to suspend drivers or vehicles instantly." },
];

const STEPS = [
  { title: "Driver starts sharing", desc: "A driver registers their vehicle and route, then taps Start — their live location begins broadcasting." },
  { title: "Passenger finds it", desc: "Search by registration number or route, or just open the live map — no account required to search." },
  { title: "Stay updated", desc: "Watch a vehicle to get notified when it starts, stops, or arrives at its destination." },
];

export default function LandingPage() {
  return (
    <div className="mx-auto max-w-[1040px] px-5">
      <nav className="flex items-center justify-between py-5">
        <div className="flex items-center gap-2.5 text-lg font-extrabold">
          <span className="text-2xl">🚌</span>
          <span>VehicleTrack</span>
        </div>
        <Link
          href="/login"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Log in
        </Link>
      </nav>

      <section className="my-5 rounded-[28px] bg-gradient-to-br from-accent-dark to-accent px-8 py-16 text-center text-white sm:py-[72px]">
        <div className="mb-4 text-5xl sm:text-6xl">📍</div>
        <h1 className="mb-4 text-[28px] font-extrabold tracking-tight sm:text-[44px]">
          Know exactly where it is, in real time
        </h1>
        <p className="mx-auto mb-8 max-w-[560px] text-[15px] text-white/90 sm:text-lg">
          Live vehicle tracking for drivers and passengers — share a live location while driving, or find any bus,
          auto, taxi, or bike by its route or number, from anywhere.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href={APK_URL}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-[15px] font-bold text-accent-dark transition hover:-translate-y-0.5"
          >
            ⬇ Download the app
          </a>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-xl border-[1.5px] border-white/40 bg-white/15 px-7 py-3.5 text-[15px] font-bold text-white transition hover:-translate-y-0.5"
          >
            Use in browser
          </Link>
        </div>
      </section>

      <section className="mb-16">
        <h2 className="mb-3 text-center text-[22px] font-extrabold tracking-tight sm:text-[30px]">
          Everything a real tracking app needs
        </h2>
        <p className="mx-auto mb-9 max-w-[520px] text-center text-[15px] text-slate-500">
          Built for daily use — reliable live positions, not a one-time demo.
        </p>
        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-[18px] border border-slate-200 bg-white p-[26px]">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] bg-accent-light text-[22px]">
                {f.icon}
              </div>
              <h3 className="mb-1.5 text-base font-bold">{f.title}</h3>
              <p className="text-[13.5px] text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="mb-16">
        <h2 className="mb-3 text-center text-[22px] font-extrabold tracking-tight sm:text-[30px]">How it works</h2>
        <p className="mx-auto mb-9 max-w-[520px] text-center text-[15px] text-slate-500">
          Three steps, no setup required for passengers.
        </p>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="px-3 text-center">
              <div className="mx-auto mb-3.5 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-[15px] font-extrabold text-white">
                {i + 1}
              </div>
              <h3 className="mb-1.5 text-[15px] font-bold">{s.title}</h3>
              <p className="text-[13px] text-slate-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <h2 className="mb-9 text-center text-[22px] font-extrabold tracking-tight sm:text-[30px]">
          Built for both sides of the trip
        </h2>
        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2">
          <div className="rounded-[18px] border border-slate-200 bg-white p-7">
            <span className="mb-3 block text-3xl">🚐</span>
            <h3 className="mb-2.5 text-[17px] font-extrabold">For drivers</h3>
            <ul className="space-y-1.5">
              {["Register your vehicle and route in minutes", "Live location sharing while you drive", "Define stops along your route for passengers to track progress"].map(
                (t) => (
                  <li key={t} className="flex items-start gap-2 text-[13.5px] text-slate-500">
                    <span className="font-extrabold text-green-600">✓</span>
                    {t}
                  </li>
                )
              )}
            </ul>
          </div>
          <div className="rounded-[18px] border border-slate-200 bg-white p-7">
            <span className="mb-3 block text-3xl">🧑</span>
            <h3 className="mb-2.5 text-[17px] font-extrabold">For passengers</h3>
            <ul className="space-y-1.5">
              {["Search any vehicle without creating an account", "See live speed, route, and distance covered", "Get notified the instant your ride arrives"].map((t) => (
                <li key={t} className="flex items-start gap-2 text-[13.5px] text-slate-500">
                  <span className="font-extrabold text-green-600">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="download" className="mb-16">
        <div className="rounded-3xl border border-slate-200 bg-white px-8 py-12 text-center">
          <h2 className="mb-2.5 text-2xl font-extrabold">Ready to try it?</h2>
          <p className="mb-7 text-sm text-slate-500">Use it right in your browser, or download the Android app.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href={APK_URL}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-7 py-3.5 text-[15px] font-bold text-white transition hover:-translate-y-0.5"
            >
              ⬇ Download APK for Android
            </a>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl border-[1.5px] border-accent px-7 py-3.5 text-[15px] font-bold text-accent transition hover:-translate-y-0.5"
            >
              Create a free account
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-[13px] text-slate-500">
        <p>VehicleTrack — Live vehicle tracking, built for everyday use.</p>
      </footer>
    </div>
  );
}
