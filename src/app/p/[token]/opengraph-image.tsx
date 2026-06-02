import { ImageResponse } from "next/og";
import { getAfterpartyByToken } from "@/lib/page-data";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "afterparty.digital";

export default async function OgImage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getAfterpartyByToken(token);
  const name = data.state === "live" && data.you ? data.you.name : "afterparty.digital";
  const eventName = data.state === "live" && data.event ? data.event.name : "Every event ends.";
  const count = data.state === "live" && data.event ? data.event.attendeeCount : 0;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #2a0a3a 0%, #4a0e5c 45%, #7a1352 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 4, opacity: 0.8, textTransform: "uppercase" }}>
          {eventName}
        </div>
        <div style={{ fontSize: 84, fontWeight: 800, marginTop: 24, lineHeight: 1.05 }}>
          {name === "afterparty.digital" ? name : `${name}'s afterparty`}
        </div>
        <div style={{ fontSize: 36, marginTop: 28, opacity: 0.85 }}>
          {count > 0 ? `${count} people were in the room — here's who to reach out to.` : "The connections shouldn't."}
        </div>
        <div style={{ display: "flex", marginTop: "auto", fontSize: 30, fontWeight: 700, color: "#f0abfc" }}>
          afterparty.digital
        </div>
      </div>
    ),
    size,
  );
}
