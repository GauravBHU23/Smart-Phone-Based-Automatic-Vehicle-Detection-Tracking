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
    <div className="overflow-x-hidden bg-slate-50">
      <div className="mx-auto max-w-[1040px] px-5 lg:max-w-[1200px] lg:px-8">
        <nav className="flex items-center justify-between py-5 lg:py-7">
          <div className="flex items-center gap-2.5 text-lg font-extrabold lg:text-xl">
            <span className="text-2xl lg:text-3xl">🚌</span>
            <span>VehicleTrack</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="#how-it-works" className="hidden text-sm font-semibold text-slate-600 transition hover:text-accent lg:inline">
              How it works
            </a>
            <Link
              href="/login"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-accent hover:bg-slate-50 hover:text-accent"
            >
              Log in
            </Link>
          </div>
        </nav>

        <section className="relative my-5 overflow-hidden rounded-[28px] bg-gradient-to-br from-accent-dark to-accent px-8 py-16 text-center text-white sm:py-[72px] lg:my-8 lg:grid lg:grid-cols-2 lg:items-center lg:px-16 lg:py-24 lg:text-left">
          <div
            className="pointer-events-none absolute -right-24 -top-24 hidden h-[420px] w-[420px] rounded-full bg-white/10 blur-3xl lg:block"
            aria-hidden
          />
          <div className="relative lg:pr-8">
            <div className="mb-4 text-5xl sm:text-6xl lg:text-7xl">📍</div>
            <h1 className="mb-4 text-[28px] font-extrabold leading-tight tracking-tight sm:text-[44px] lg:text-[52px]">
              Know exactly where it is, in real time
            </h1>
            <p className="mx-auto mb-8 max-w-[560px] text-[15px] text-white/90 sm:text-lg lg:mx-0 lg:max-w-[460px]">
              Live vehicle tracking for drivers and passengers — share a live location while driving, or find any bus,
              auto, taxi, or bike by its route or number, from anywhere.
            </p>
            <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
              <a
                href={APK_URL}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-[15px] font-bold text-accent-dark shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:shadow-xl"
              >
                ⬇ Download the app
              </a>
              <Link
                href="/search"
                className="inline-flex items-center gap-2 rounded-xl border-[1.5px] border-white/40 bg-white/15 px-7 py-3.5 text-[15px] font-bold text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/25"
              >
                Use in browser
              </Link>
            </div>
          </div>
          <div className="relative mt-10 hidden lg:block">
            <div className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/90">
                <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
                Live — UP70AB1234
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white/10 p-4">
                <div>
                  <p className="text-xs text-white/70">Civil Lines → Naini</p>
                  <p className="mt-1 text-2xl font-extrabold">38 km/h</p>
                </div>
                <span className="text-4xl">🚌</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-2/3 rounded-full bg-white/80" />
              </div>
            </div>
          </div>
        </section>

        <section className="mb-16 lg:mb-24">
          <h2 className="mb-3 text-center text-[22px] font-extrabold tracking-tight sm:text-[30px] lg:text-[34px]">
            Everything a real tracking app needs
          </h2>
          <p className="mx-auto mb-9 max-w-[520px] text-center text-[15px] text-slate-500 lg:mb-12 lg:text-base">
            Built for daily use — reliable live positions, not a one-time demo.
          </p>
          <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-[18px] border border-slate-200 bg-white p-[26px] transition hover:-translate-y-1 hover:border-accent/30 hover:shadow-lg lg:p-7"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] bg-accent-light text-[22px]">
                  {f.icon}
                </div>
                <h3 className="mb-1.5 text-base font-bold">{f.title}</h3>
                <p className="text-[13.5px] text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="mb-16 scroll-mt-10 lg:mb-24">
          <h2 className="mb-3 text-center text-[22px] font-extrabold tracking-tight sm:text-[30px] lg:text-[34px]">
            How it works
          </h2>
          <p className="mx-auto mb-9 max-w-[520px] text-center text-[15px] text-slate-500 lg:mb-14 lg:text-base">
            Three steps, no setup required for passengers.
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 lg:gap-10">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative px-3 text-center">
                {i < STEPS.length - 1 && (
                  <div className="absolute left-[calc(50%+28px)] right-[calc(-50%+28px)] top-5 hidden h-px bg-slate-200 sm:block" />
                )}
                <div className="relative mx-auto mb-3.5 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-[15px] font-extrabold text-white lg:h-12 lg:w-12 lg:text-base">
                  {i + 1}
                </div>
                <h3 className="mb-1.5 text-[15px] font-bold lg:text-base">{s.title}</h3>
                <p className="text-[13px] text-slate-500 lg:text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-16 lg:mb-24">
          <h2 className="mb-9 text-center text-[22px] font-extrabold tracking-tight sm:text-[30px] lg:mb-12 lg:text-[34px]">
            Built for both sides of the trip
          </h2>
          <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:gap-8">
            <div className="rounded-[18px] border border-slate-200 bg-white p-7 transition hover:shadow-lg lg:p-10">
              <span className="mb-3 block text-3xl lg:text-4xl">🚐</span>
              <h3 className="mb-2.5 text-[17px] font-extrabold lg:text-xl">For drivers</h3>
              <ul className="space-y-1.5 lg:space-y-2.5">
                {["Register your vehicle and route in minutes", "Live location sharing while you drive", "Define stops along your route for passengers to track progress"].map(
                  (t) => (
                    <li key={t} className="flex items-start gap-2 text-[13.5px] text-slate-500 lg:text-sm">
                      <span className="font-extrabold text-green-600">✓</span>
                      {t}
                    </li>
                  )
                )}
              </ul>
            </div>
            <div className="rounded-[18px] border border-slate-200 bg-white p-7 transition hover:shadow-lg lg:p-10">
              <span className="mb-3 block text-3xl lg:text-4xl">🧑</span>
              <h3 className="mb-2.5 text-[17px] font-extrabold lg:text-xl">For passengers</h3>
              <ul className="space-y-1.5 lg:space-y-2.5">
                {["Search any vehicle without creating an account", "See live speed, route, and distance covered", "Get notified the instant your ride arrives"].map((t) => (
                  <li key={t} className="flex items-start gap-2 text-[13.5px] text-slate-500 lg:text-sm">
                    <span className="font-extrabold text-green-600">✓</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="download" className="mb-16 lg:mb-20">
          <div className="rounded-3xl border border-slate-200 bg-white px-8 py-12 text-center lg:py-16">
            <h2 className="mb-2.5 text-2xl font-extrabold lg:text-3xl">Ready to try it?</h2>
            <p className="mb-7 text-sm text-slate-500 lg:text-base">Use it right in your browser, or download the Android app.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <a
                href={APK_URL}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-7 py-3.5 text-[15px] font-bold text-white transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                ⬇ Download APK for Android
              </a>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl border-[1.5px] border-accent px-7 py-3.5 text-[15px] font-bold text-accent transition hover:-translate-y-0.5 hover:bg-accent-light"
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
    </div>
  );
}
