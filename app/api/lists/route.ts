import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/app/lib/auth";
import { loadTokensForDevice } from "@/app/lib/tokens";

export type LoopsList = {
    id: string;
    name: string;
    description: string | null;
    isPublic: boolean;
};

export async function GET(request: NextRequest) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const tokenMap = await loadTokensForDevice(request);
        const apiKey = tokenMap.loops || process.env.LOOPS_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                { error: "Loops API key not configured." },
                { status: 500 }
            );
        }

        const res = await fetch("https://app.loops.so/api/v1/lists", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
        });

        if (!res.ok) {
            const status = res.status;
            let errorMessage = `Loops API error: ${status}`;
            if (status === 401 || status === 403) {
                errorMessage = "Loops API Key Invalid";
            }
            console.error("[lists] Loops API error", status);
            return NextResponse.json({ error: errorMessage }, { status });
        }

        const lists: LoopsList[] = await res.json();
        return NextResponse.json({ lists });
    } catch {
        console.error("[lists] error");
        return NextResponse.json({ error: "Failed to fetch lists" }, { status: 500 });
    }
}
