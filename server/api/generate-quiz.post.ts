import { Mistral } from "@mistralai/mistralai"

export default defineEventHandler(async (event) => {
    const body = await readBody(event)

    if (!body.text || !body.questionCount) {
        throw createError({ statusCode: 400, message: "Brak tekstu lub liczby pytań w zapytaniu." })
    }

    const { mistralApiKey } = useRuntimeConfig()

    if (!mistralApiKey) {
        throw createError({ statusCode: 500, message: "Brak klucza API Mistral." })
    }

    const client = new Mistral({ apiKey: mistralApiKey })

    const prompt = `Na podstawie poniższego tekstu wygeneruj interaktywny quiz składający się z ${body.questionCount} pytań.
                    Odpowiedzi mają bazować TYLKO na dostarczonym tekście źródłowym. 
                    Zwróć wynik JEDYNIE w formie prawidłowego JSON o dokładnej strukturze:
                    {"quiz": [{"question": "Treść pytania", "answers": ["Odp A", "Odp B", "Odp C", "Odp D"], "correct": 0}]}
                    gdzie "correct" to indeks (licząc od 0) poprawnej odpowiedzi.
                    Nie dodawaj żadnego innego wstępu czy komentarzy.

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
        throw createError({ statusCode: 500, message: "Wystąpił błąd podczas generowania quizu. Spróbuj ponownie." })
    }
})
