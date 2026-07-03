import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { BUDGETS, ENV, serverReachable } from "./support/env"
import { printReportTable, record } from "./support/report"

const SAMPLE_TEXT = `Fotosynteza to proces, w którym rośliny przekształcają energię świetlną w energię chemiczną.
Zachodzi w chloroplastach, a jej produktem ubocznym jest tlen. Kluczową rolę odgrywa chlorofil,
barwnik pochłaniający światło. Proces dzieli się na fazę jasną i fazę ciemną (cykl Calvina).`

describe("Pierwsza odpowiedź AI (TTFT)", () => {
	let canRun = false

	beforeAll(async () => {
		canRun = Boolean(ENV.mistralApiKey) && (await serverReachable())
	})

	afterAll(() => printReportTable())

	it("mierzy TTFT endpointu generowania AI", async (ctx) => {
		if (!canRun) {
			ctx.skip()
			return
		}

		const start = performance.now()
		const response = await fetch(`${ENV.baseUrl}/api/generate-summary`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text: SAMPLE_TEXT, detail: "short" }),
		})

		expect(response.ok, `Endpoint AI zwrócił status ${response.status}`).toBe(true)
		expect(response.body).toBeTruthy()

		const reader = response.body!.getReader()
		await reader.read()
		const ttft = Math.round(performance.now() - start)
		await reader.cancel()

		record("Pierwsza odpowiedź AI (TTFT)", `${ttft} ms`)
		expect(ttft).toBeGreaterThan(0)
		expect(ttft).toBeLessThan(BUDGETS.AI_TTFT_MS)
	})
})
