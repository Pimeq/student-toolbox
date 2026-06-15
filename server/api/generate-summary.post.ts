import { Mistral } from "@mistralai/mistralai"

const DETAIL_INSTRUCTIONS: Record<string, string> = {
    short: "Streszczenie ma byc bardzo zwiezle: 2-3 zdania przegladu oraz 3-4 najwazniejsze punkty kluczowe. Pomin sekcje szczegolowe (pusta tablica).",
    medium: "Streszczenie ma byc standardowe: kilka zdan przegladu, 4-6 punktow kluczowych oraz 2-3 sekcje tematyczne z krotkim omowieniem.",
    detailed: "Streszczenie ma byc szczegolowe: rozbudowany przeglad, 6-10 punktow kluczowych oraz kilka sekcji tematycznych z dokladnym omowieniem kazdej."
}

export default defineEventHandler(async (event) => {
    const body = await readBody(event)

    if (!body.text) {
        throw createError({ statusCode: 400, message: "Brak tekstu w zapytaniu." })
    }

    const detail = (body.detail as string) || "medium"
    const detailInstruction = DETAIL_INSTRUCTIONS[detail] || DETAIL_INSTRUCTIONS.medium

    const { mistralApiKey } = useRuntimeConfig()

    if (!mistralApiKey) {
        throw createError({ statusCode: 500, message: "Brak klucza API Mistral." })
    }

    const client = new Mistral({ apiKey: mistralApiKey })

    const prompt = `Na podstawie ponizszego tekstu przygotuj zwiezle streszczenie po polsku.
                    ${detailInstruction}
                    Streszczenie ma bazowac TYLKO na dostarczonym tekscie zrodlowym.
                    Zwroc wynik JEDYNIE w formie prawidlowego JSON o dokladnej strukturze:
                    {"summary": {"overview": "Krotki przeglad calosci", "keyPoints": ["Punkt kluczowy 1", "Punkt kluczowy 2"], "sections": [{"heading": "Naglowek sekcji", "content": "Omowienie sekcji"}]}}
                    Nie dodawaj zadnego innego wstepu czy komentarzy.

                    Tekst:
                    ${body.text}`

    try {
        const chatResponse = await client.chat.complete({
            model: "mistral-large-latest",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
            responseFormat: { type: "json_object" }
        })

        const responseContent = chatResponse.choices?.[0]?.message?.content

        if (!responseContent) {
            throw new Error("Brak odpowiedzi od modelu.")
        }

        return JSON.parse(responseContent as string)
    } catch (error) {
        console.error("Mistral API Error:", error)
        throw createError({ statusCode: 500, message: "Wystapil blad podczas generowania streszczenia. Sprobuj ponownie." })
    }
})
