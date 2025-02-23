import {TOKEN_URL} from "@/src/config";

export default async function handler(req: any, res: any) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    const url = TOKEN_URL;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(req.body),
        });

        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        console.error("❌ Proxy error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}
