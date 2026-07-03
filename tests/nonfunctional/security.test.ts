import { afterAll, describe, expect, it } from "vitest"
import {
	anonClient,
	ENV,
	hasPrimaryUser,
	hasSecondUser,
	hasSupabaseCreds,
	resolveWritableGroupId,
	serverReachable,
	signIn,
} from "./support/env"
import { printReportTable, record } from "./support/report"

afterAll(() => printReportTable())

describe("Bezpieczeństwo — brak wycieku klucza API", () => {
	it("odpowiedzi HTTP nie zawierają klucza API Mistral", async (ctx) => {
		if (!ENV.mistralApiKey || !(await serverReachable())) {
			ctx.skip()
			return
		}

		const key = ENV.mistralApiKey
		const leaks: string[] = []
		const assertNoKey = (where: string, haystack: string) => {
			if (haystack.includes(key)) leaks.push(where)
		}

		const home = await fetch(ENV.baseUrl)
		assertNoKey("strona główna (body)", await home.text())
		assertNoKey("strona główna (nagłówki)", JSON.stringify([...home.headers.entries()]))

		const ok = await fetch(`${ENV.baseUrl}/api/generate-summary`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text: "Krótki tekst testowy.", detail: "short" }),
		})
		assertNoKey("odpowiedź AI (body)", await ok.text())
		assertNoKey("odpowiedź AI (nagłówki)", JSON.stringify([...ok.headers.entries()]))

		const bad = await fetch(`${ENV.baseUrl}/api/generate-summary`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}),
		})
		assertNoKey("odpowiedź AI 4xx (body)", await bad.text())

		record("Bezpieczeństwo (brak klucza API w HTTP)", leaks.length === 0 ? "0 wycieków" : `${leaks.length} wycieków`)
		expect(leaks, `Klucz API znaleziony w: ${leaks.join(", ")}`).toHaveLength(0)
	})
})

describe.skipIf(!hasSupabaseCreds)("Bezpieczeństwo — reguły RLS", () => {
	it("anonimowy gość nie odczytuje prywatnych zdarzeń", async () => {
		const anon = anonClient()
		const { data } = await anon.from("events").select("id").limit(50)

		record("Bezpieczeństwo RLS (dostęp anonimowy)", (data?.length ?? 0) === 0 ? "0 rekordów" : "WYCIEK")
		expect(data?.length ?? 0, "Anonimowy dostęp zwrócił zdarzenia — RLS nieszczelne").toBe(0)
	})

	it.skipIf(!hasPrimaryUser || !hasSecondUser)(
		"użytkownik nie może modyfikować ani usuwać cudzych zdarzeń",
		async () => {
			const owner = await signIn(process.env.TEST_USER_EMAIL!, process.env.TEST_USER_PASSWORD!)
			const intruder = await signIn(process.env.TEST_USER2_EMAIL!, process.env.TEST_USER2_PASSWORD!)

			const groupId = await resolveWritableGroupId(owner)
			expect(groupId, "Brak grupy prywatnej właściciela").toBeTruthy()

			const created = await owner.supabase
				.from("events")
				.insert({
					title: `NF-TEST RLS ${Date.now()}`,
					group_id: groupId!,
					uploaded_by: owner.userId,
					starts_at: new Date().toISOString(),
					ends_at: new Date(Date.now() + 3_600_000).toISOString(),
				})
				.select("id")
				.single()
			expect(created.error, created.error?.message).toBeNull()
			const eventId = created.data!.id

			try {
				const updated = await intruder.supabase
					.from("events")
					.update({ title: "PRZEJĘTE" })
					.eq("id", eventId)
					.select("id")
				expect(updated.data?.length ?? 0, "Intruz zmodyfikował cudze zdarzenie").toBe(0)

				const deleted = await intruder.supabase.from("events").delete().eq("id", eventId).select("id")
				expect(deleted.data?.length ?? 0, "Intruz usunął cudze zdarzenie").toBe(0)

				const stillThere = await owner.supabase.from("events").select("id, title").eq("id", eventId).single()
				expect(stillThere.data?.id).toBe(eventId)
				expect(stillThere.data?.title).not.toBe("PRZEJĘTE")

				record("Bezpieczeństwo RLS (izolacja zapisu)", "0 naruszeń")
			} finally {
				await owner.supabase.from("events").delete().eq("id", eventId)
			}
		},
	)
})
