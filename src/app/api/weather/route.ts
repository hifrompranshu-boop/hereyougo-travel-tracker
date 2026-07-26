import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const lat = request.nextUrl.searchParams.get("lat");
  const lon = request.nextUrl.searchParams.get("lon");
  const date = request.nextUrl.searchParams.get("date");

  if (!lat || !lon) {
    return NextResponse.json({ error: "lat and lon required" }, { status: 400 });
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    const conditions = ["Clear", "Partly cloudy", "Light rain", "Sunny"];
    const idx = Math.floor(Math.random() * conditions.length);
    return NextResponse.json({
      condition: conditions[idx],
      temp: 22,
      isOutdoorFriendly: conditions[idx] !== "Light rain",
      mock: true,
    });
  }

  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
    );
    const data = await res.json();
    const targetDate = date ?? new Date().toISOString().split("T")[0];
    const forecast = data.list?.find((f: { dt_txt: string }) =>
      f.dt_txt.startsWith(targetDate)
    );

    if (!forecast) {
      return NextResponse.json({ condition: "Unknown", isOutdoorFriendly: true });
    }

    const condition = forecast.weather[0].main;
    const isRain = ["Rain", "Drizzle", "Thunderstorm"].includes(condition);

    return NextResponse.json({
      condition: forecast.weather[0].description,
      temp: Math.round(forecast.main.temp),
      isOutdoorFriendly: !isRain,
    });
  } catch {
    return NextResponse.json({ condition: "Unknown", isOutdoorFriendly: true });
  }
}
