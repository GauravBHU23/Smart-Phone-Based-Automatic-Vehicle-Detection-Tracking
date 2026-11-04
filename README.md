# Smart Phone-Based Automatic Vehicle Detection & Tracking

Live vehicle tracking system using a driver's smartphone GPS instead of dedicated
hardware. Drivers share their location from the app; passengers see active
vehicles (bus/auto/taxi/bike) live on a map.

## Structure

- `backend/VehicleTracking.Api` — ASP.NET Core Web API + SignalR + PostgreSQL (EF Core)
- `mobile/` — React Native (Expo) app with Driver mode and Passenger mode

## ⚠️ Important: folder name contains `&`

This project folder is named `...Vehicle Detection & Tracking`. On Windows, npm's
generated `.cmd`/`.ps1` shims (`tsc.cmd`, `expo.cmd`, etc. inside `node_modules\.bin`)
break when the path contains ` & ` — they mis-parse the path and fail with errors like
`'Tracking\mobile\node_modules\.bin\' is not recognized...`.

Workarounds used in this project / recommended for you:
- Run tools directly via `node`, e.g. `node node_modules\typescript\bin\tsc --noEmit`
  instead of `npx tsc`.
- `npm install <pkg>` works fine; it's only running the installed binaries via npx/.cmd
  that breaks.
- For Expo specifically, use `npx expo-cli` bugs aside, if `npx expo start` fails,
  run `node node_modules\expo\bin\cli start` instead.
- **Best long-term fix**: rename the project folder to remove `&` (e.g. replace with
  "and" or "-"), and update your editor's open folder. Everything will work with
  plain `npx`/`npm run` after that.

## Backend setup

Requires: .NET 8 SDK, PostgreSQL (local or Docker).

```powershell
cd backend\VehicleTracking.Api

# 1. Start PostgreSQL (if using Docker):
docker run --name vehicle-tracking-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=vehicle_tracking -p 5432:5432 -d postgres:16

# 2. Update appsettings.json connection string if needed (default assumes
#    localhost:5432, db "vehicle_tracking", user "postgres", password "postgres").

# 3. Apply migrations
dotnet ef database update

# 4. Run the API
dotnet run
```

API will listen on `https://localhost:5xxx` (check console output) and expose:
- `POST /api/auth/register`, `POST /api/auth/login`
- `POST /api/vehicles`, `GET /api/vehicles/mine` (Driver only)
- `POST /api/vehicles/{id}/start`, `POST /api/vehicles/{id}/stop`
- `POST /api/vehicles/{id}/location` (Driver posts GPS ping)
- `GET /api/vehicles/active` (public, Passenger reads live vehicles)
- SignalR hub at `/hubs/tracking` broadcasts `VehicleLocationUpdated` events

Swagger UI available at `/swagger` in Development.

**Before running on a real phone**: update `Jwt:Key` in `appsettings.json` to a
real random secret, and find your machine's LAN IP (`ipconfig`) to use in the
mobile app config (see below) — `localhost` won't resolve from a phone.

## Mobile app setup

Requires: Node.js, Expo Go app on your phone (or an emulator).

```powershell
cd mobile
npm install

# Edit src/api/config.ts and set API_BASE_URL to your computer's LAN IP, e.g.:
#   http://192.168.1.50:5000

npm start
```

Scan the QR code with Expo Go. Register two accounts to test end-to-end:
one as **Driver** (add a vehicle, tap Start — your phone's GPS now streams
to the backend), and one as **Passenger** (see the vehicle move live on
the map).

## Current scope (Phase 1 — MVP)

- [x] Driver auth, vehicle registration, start/stop tracking
- [x] Smartphone GPS → backend → SignalR → passenger map (live)
- [x] Passenger live map filtered by vehicle type
- [ ] Movement/activity auto-detection (Phase 2)
- [ ] AI-based vehicle type classification (Phase 3)
- [ ] Route-based ETA, trip history analytics, admin dashboard (Phase 4)
